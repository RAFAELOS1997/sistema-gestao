<?php
require_once __DIR__ . '/../config/bootstrap.php';

exigirLogin();
$pdo = getConnection();
$tipo = $_GET['tipo'] ?? '';

switch ($tipo) {
    case 'vendas_periodo':
        vendasPorPeriodo($pdo);
        break;
    case 'produtos_mais_vendidos':
        produtosMaisVendidos($pdo);
        break;
    case 'resumo_dia':
        resumoDia($pdo);
        break;
    case 'estoque_baixo':
        estoqueBaixo($pdo);
        break;
    default:
        respond(['erro' => 'Tipo de relatório inválido. Use: vendas_periodo, produtos_mais_vendidos, resumo_dia, estoque_baixo.'], 400);
}

function vendasPorPeriodo(PDO $pdo): void {
    $inicio = $_GET['data_inicio'] ?? date('Y-m-d', strtotime('-30 days'));
    $fim = $_GET['data_fim'] ?? date('Y-m-d');

    $stmt = $pdo->prepare(
        "SELECT DATE(criado_em) AS dia, COUNT(*) AS total_vendas, SUM(total) AS faturamento
         FROM vendas
         WHERE status = 'concluida' AND criado_em BETWEEN ? AND ?
         GROUP BY DATE(criado_em)
         ORDER BY dia ASC"
    );
    $stmt->execute([$inicio . ' 00:00:00', $fim . ' 23:59:59']);
    respond($stmt->fetchAll());
}

function produtosMaisVendidos(PDO $pdo): void {
    $limite = (int) ($_GET['limite'] ?? 10);
    $stmt = $pdo->prepare(
        "SELECT p.id, p.nome, SUM(vi.quantidade) AS total_vendido, SUM(vi.subtotal) AS receita
         FROM venda_itens vi
         JOIN produtos p ON p.id = vi.produto_id
         JOIN vendas v ON v.id = vi.venda_id
         WHERE v.status = 'concluida'
         GROUP BY p.id, p.nome
         ORDER BY total_vendido DESC
         LIMIT ?"
    );
    $stmt->bindValue(1, $limite, PDO::PARAM_INT);
    $stmt->execute();
    respond($stmt->fetchAll());
}

function resumoDia(PDO $pdo): void {
    $dia = $_GET['data'] ?? date('Y-m-d');
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) AS total_vendas, COALESCE(SUM(total),0) AS faturamento,
                COALESCE(AVG(total),0) AS ticket_medio
         FROM vendas WHERE status = 'concluida' AND DATE(criado_em) = ?"
    );
    $stmt->execute([$dia]);
    respond($stmt->fetch());
}

function estoqueBaixo(PDO $pdo): void {
    $stmt = $pdo->query(
        "SELECT id, nome, quantidade_estoque, estoque_minimo
         FROM produtos WHERE ativo = 1 AND quantidade_estoque <= estoque_minimo
         ORDER BY quantidade_estoque ASC"
    );
    respond($stmt->fetchAll());
}
