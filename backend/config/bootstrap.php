<?php
/**
 * Arquivo carregado no início de toda API.
 * Cuida de: cabeçalhos CORS, formato JSON, e checagem de login.
 */

require_once __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');

// --- CORS: permite que o front-end (React) fale com essa API ---
// Troque '*' pelo seu domínio real depois que tudo estiver funcionando,
// ex: header('Access-Control-Allow-Origin: https://seudominio.com');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();

/** Lê o corpo JSON da requisição e devolve como array associativo */
function getJsonInput(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

/** Responde em JSON e encerra a execução */
function respond($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Garante que existe um usuário logado (sessão válida).
 * Chame essa função no topo de qualquer endpoint que exija login.
 */
function exigirLogin(): array {
    if (empty($_SESSION['usuario_id'])) {
        respond(['erro' => 'Não autenticado. Faça login novamente.'], 401);
    }
    return [
        'id' => $_SESSION['usuario_id'],
        'cargo' => $_SESSION['usuario_cargo'] ?? 'vendedor',
    ];
}

/** Garante que o usuário logado é admin ou gerente */
function exigirGerencia(): array {
    $usuario = exigirLogin();
    if (!in_array($usuario['cargo'], ['admin', 'gerente'])) {
        respond(['erro' => 'Você não tem permissão para essa ação.'], 403);
    }
    return $usuario;
}
