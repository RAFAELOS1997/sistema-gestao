<?php
require_once __DIR__ . '/../config/bootstrap.php';

$acao = $_GET['acao'] ?? '';

switch ($acao) {
    case 'login':
        login();
        break;
    case 'logout':
        logout();
        break;
    case 'verificar':
        verificar();
        break;
    default:
        respond(['erro' => 'Ação inválida. Use ?acao=login, logout ou verificar.'], 400);
}

function login(): void {
    $dados = getJsonInput();
    $email = trim($dados['email'] ?? '');
    $senha = $dados['senha'] ?? '';

    if (!$email || !$senha) {
        respond(['erro' => 'Informe email e senha.'], 422);
    }

    $pdo = getConnection();
    $stmt = $pdo->prepare('SELECT id, nome, email, senha_hash, cargo, ativo FROM usuarios WHERE email = ?');
    $stmt->execute([$email]);
    $usuario = $stmt->fetch();

    if (!$usuario || !$usuario['ativo'] || !password_verify($senha, $usuario['senha_hash'])) {
        respond(['erro' => 'Email ou senha incorretos.'], 401);
    }

    $_SESSION['usuario_id'] = $usuario['id'];
    $_SESSION['usuario_cargo'] = $usuario['cargo'];

    respond([
        'usuario' => [
            'id' => $usuario['id'],
            'nome' => $usuario['nome'],
            'email' => $usuario['email'],
            'cargo' => $usuario['cargo'],
        ],
    ]);
}

function logout(): void {
    $_SESSION = [];
    session_destroy();
    respond(['ok' => true]);
}

function verificar(): void {
    if (empty($_SESSION['usuario_id'])) {
        respond(['logado' => false]);
    }
    respond(['logado' => true, 'cargo' => $_SESSION['usuario_cargo']]);
}
