<?php
/**
 * Configuração de conexão com o banco de dados MySQL.
 *
 * IMPORTANTE: Preencha os 4 valores abaixo com os dados que aparecem
 * no hPanel da Hostinger em "Bancos de Dados > Gerenciar".
 * NUNCA compartilhe este arquivo publicamente (ele não deve ir pro GitHub
 * público - veja o .gitignore).
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'u849479574_banco_toca');
define('DB_USER', 'u849479574_rafael');
define('DB_PASS', '?Bancotoca2026');

function getConnection(): PDO {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['erro' => 'Falha na conexão com o banco de dados.']);
        exit;
    }
}
