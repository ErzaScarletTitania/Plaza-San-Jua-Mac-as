<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$adminId = $_SESSION['plaza_admin_id'] ?? '';
if ($adminId === '') {
    send_json(['ok' => false, 'admin' => null], 401);
}

$admin = find_admin_by_id($adminId);
if (!$admin) {
    unset($_SESSION['plaza_admin_id']);
    send_json(['ok' => false, 'admin' => null], 401);
}

send_json([
    'ok' => true,
    'admin' => public_admin($admin),
]);
