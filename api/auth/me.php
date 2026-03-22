<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['ok' => false, 'message' => 'Método no permitido.'], 405);
}

$userId = $_SESSION['plaza_user_id'] ?? '';
if (!$userId) {
    send_json(['ok' => true, 'user' => null]);
}

$user = find_user_by_id($userId);
if (!$user) {
    unset($_SESSION['plaza_user_id']);
    send_json(['ok' => true, 'user' => null]);
}

send_json([
    'ok' => true,
    'user' => public_user($user),
]);
