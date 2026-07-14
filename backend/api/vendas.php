<?php
require_once __DIR__ . '/../config/bootstrap.php';

$usuario = exigirLogin();
$pdo = getConnection();
$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':
        listar($pdo);
        break;
    case 'POST':
        registrarVenda($pdo, $usuario);
        break;
    case 'DELETE':
        cancelarVenda($pdo);
        break;
    default:
        respond(['erro' => 'Método não suportado.'], 405);
}

function listar(PDO $pdo): void {
    if (!empty($_GET['id'])) {
        $stmt = $pdo->prepare('SELECT * FROM vendas WHERE id = ?');
        $stmt->execute([$_GET['id']]);
        $venda = $stmt->fetch();
        if (!$venda) respond(['erro' => 'Venda não encontrada.'], 404);

        $itens = $pdo->prepare(
            'SELECT vi.*, p.nome AS produto_nome FROM venda_itens vi
             JOIN produtos p ON p.id = vi.produto_id WHERE vi.venda_id = ?'
        );
        $itens->execute([$venda['id']]);
        $venda['itens'] = $itens->fetchAll();
        respond($venda);
    }

    $sql = 'SELECT v.*, u.nome AS vendedor_nome, c.nome AS cliente_nome
            FROM vendas v
            JOIN usuarios u ON u.id = v.usuario_id
            LEFT JOIN clientes c ON c.id = v.cliente_id
            WHERE 1=1';
    $params = [];

    if (!empty($_GET['data_inicio'])) {
        $sql .= ' AND v.criado_em >= ?';
        $params[] = $_GET['data_inicio'] . ' 00:00:00';
    }
    if (!empty($_GET['data_fim'])) {
        $sql .= ' AND v.criado_em <= ?';
        $params[] = $_GET['data_fim'] . ' 23:59:59';
    }
    $sql .= ' ORDER BY v.criado_em DESC LIMIT 200';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    respond($stmt->fetchAll());
}

/**
 * Registra uma venda completa (PDV).
 * Espera JSON: { cliente_id, forma_pagamento, desconto, itens: [{produto_id, quantidade}] }
 * Usa transação: ou tudo é salvo (venda + baixa de estoque), ou nada é.
 */
function registrarVenda(PDO $pdo, array $usuario): void {
    $d = getJsonInput();
    if (empty($d['itens']) || !is_array($d['itens'])) {
        respond(['erro' => 'A venda precisa ter ao menos um item.'], 422);
    }

    try {
        $pdo->beginTransaction();

        $subtotal = 0;
        $itensValidados = [];

        foreach ($d['itens'] as $item) {
            $stmt = $pdo->prepare('SELECT id, preco_venda, quantidade_estoque FROM produtos WHERE id = ? FOR UPDATE');
            $stmt->execute([$item['produto_id']]);
            $produto = $stmt->fetch();

            if (!$produto) {
                throw new Exception('Produto id ' . $item['produto_id'] . ' não encontrado.');
            }
            $qtd = (int) $item['quantidade'];
            if ($qtd <= 0) {
                throw new Exception('Quantidade inválida para o produto id ' . $item['produto_id']);
            }
            if ($produto['quantidade_estoque'] < $qtd) {
                throw new Exception('Estoque insuficiente para o produto id ' . $item['produto_id']);
            }

            $itemSubtotal = $produto['preco_venda'] * $qtd;
            $subtotal += $itemSubtotal;

            $itensValidados[] = [
                'produto_id' => $produto['id'],
                'quantidade' => $qtd,
                'preco_unitario' => $produto['preco_venda'],
                'subtotal' => $itemSubtotal,
            ];
        }

        $desconto = $d['desconto'] ?? 0;
        $total = max(0, $subtotal - $desconto);

        $stmtVenda = $pdo->prepare(
            'INSERT INTO vendas (usuario_id, cliente_id, forma_pagamento, subtotal, desconto, total)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmtVenda->execute([
            $usuario['id'],
            $d['cliente_id'] ?? null,
            $d['forma_pagamento'] ?? 'dinheiro',
            $subtotal,
            $desconto,
            $total,
        ]);
        $vendaId = $pdo->lastInsertId();

        $stmtItem = $pdo->prepare(
            'INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmtEstoque = $pdo->prepare(
            'UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?'
        );

        foreach ($itensValidados as $item) {
            $stmtItem->execute([$vendaId, $item['produto_id'], $item['quantidade'], $item['preco_unitario'], $item['subtotal']]);
            $stmtEstoque->execute([$item['quantidade'], $item['produto_id']]);
        }

        $pdo->commit();
        respond(['ok' => true, 'venda_id' => $vendaId, 'total' => $total], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        respond(['erro' => $e->getMessage()], 422);
    }
}

function cancelarVenda(PDO $pdo): void {
    exigirGerencia();
    $id = $_GET['id'] ?? null;
    if (!$id) respond(['erro' => 'Informe o id da venda.'], 422);

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT * FROM vendas WHERE id = ? AND status = "concluida"');
        $stmt->execute([$id]);
        $venda = $stmt->fetch();
        if (!$venda) throw new Exception('Venda não encontrada ou já cancelada.');

        $itens = $pdo->prepare('SELECT * FROM venda_itens WHERE venda_id = ?');
        $itens->execute([$id]);

        $devolver = $pdo->prepare('UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?');
        foreach ($itens->fetchAll() as $item) {
            $devolver->execute([$item['quantidade'], $item['produto_id']]);
        }

        $pdo->prepare('UPDATE vendas SET status = "cancelada" WHERE id = ?')->execute([$id]);

        $pdo->commit();
        respond(['ok' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        respond(['erro' => $e->getMessage()], 422);
    }
}
