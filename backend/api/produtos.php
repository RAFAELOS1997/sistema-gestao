<?php
require_once __DIR__ . '/../config/bootstrap.php';

exigirLogin();
$pdo = getConnection();
$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':
        listar($pdo);
        break;
    case 'POST':
        criar($pdo);
        break;
    case 'PUT':
        atualizar($pdo);
        break;
    case 'DELETE':
        excluir($pdo);
        break;
    default:
        respond(['erro' => 'Método não suportado.'], 405);
}

function listar(PDO $pdo): void {
    // ?busca=texto  ?estoque_baixo=1  ?id=5 (um único produto)
    if (!empty($_GET['id'])) {
        $stmt = $pdo->prepare('SELECT * FROM produtos WHERE id = ?');
        $stmt->execute([$_GET['id']]);
        $produto = $stmt->fetch();
        respond($produto ?: ['erro' => 'Produto não encontrado.'], $produto ? 200 : 404);
    }

    $sql = 'SELECT * FROM produtos WHERE ativo = 1';
    $params = [];

    if (!empty($_GET['busca'])) {
        $sql .= ' AND (nome LIKE ? OR codigo_barras LIKE ?)';
        $termo = '%' . $_GET['busca'] . '%';
        $params[] = $termo;
        $params[] = $termo;
    }
    if (!empty($_GET['estoque_baixo'])) {
        $sql .= ' AND quantidade_estoque <= estoque_minimo';
    }
    $sql .= ' ORDER BY nome ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    respond($stmt->fetchAll());
}

function criar(PDO $pdo): void {
    exigirGerencia();
    $d = getJsonInput();

    if (empty($d['nome']) || !isset($d['preco_venda'])) {
        respond(['erro' => 'Nome e preço de venda são obrigatórios.'], 422);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO produtos (nome, descricao, categoria_id, codigo_barras, preco_custo, preco_venda, quantidade_estoque, estoque_minimo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $d['nome'],
        $d['descricao'] ?? null,
        $d['categoria_id'] ?? null,
        $d['codigo_barras'] ?? null,
        $d['preco_custo'] ?? 0,
        $d['preco_venda'],
        $d['quantidade_estoque'] ?? 0,
        $d['estoque_minimo'] ?? 0,
    ]);

    respond(['id' => $pdo->lastInsertId(), 'ok' => true], 201);
}

function atualizar(PDO $pdo): void {
    exigirGerencia();
    $d = getJsonInput();
    if (empty($d['id'])) {
        respond(['erro' => 'Informe o id do produto.'], 422);
    }

    $campos = ['nome','descricao','categoria_id','codigo_barras','preco_custo','preco_venda','quantidade_estoque','estoque_minimo','ativo'];
    $sets = [];
    $valores = [];
    foreach ($campos as $c) {
        if (array_key_exists($c, $d)) {
            $sets[] = "$c = ?";
            $valores[] = $d[$c];
        }
    }
    if (!$sets) {
        respond(['erro' => 'Nenhum campo para atualizar.'], 422);
    }
    $valores[] = $d['id'];

    $stmt = $pdo->prepare('UPDATE produtos SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($valores);
    respond(['ok' => true]);
}

function excluir(PDO $pdo): void {
    exigirGerencia();
    parse_str(file_get_contents('php://input'), $d);
    $id = $_GET['id'] ?? $d['id'] ?? null;
    if (!$id) {
        respond(['erro' => 'Informe o id do produto.'], 422);
    }
    // Exclusão lógica (mantém histórico de vendas intacto)
    $stmt = $pdo->prepare('UPDATE produtos SET ativo = 0 WHERE id = ?');
    $stmt->execute([$id]);
    respond(['ok' => true]);
}
