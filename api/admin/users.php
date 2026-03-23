<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$admin = require_logged_in_admin();
$users = list_public_users();

send_json([
    'ok' => true,
    'admin' => public_admin($admin),
    'summary' => [
        'userCount' => count($users),
    ],
    'users' => $users,
]);
