<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$admin = require_logged_in_admin();
$users = array_map(
    static function (array $user): array {
        return [
            'id' => (string) ($user['id'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'fullName' => (string) ($user['fullName'] ?? ''),
            'createdAt' => (string) ($user['createdAt'] ?? ''),
            'district' => (string) ($user['profile']['district'] ?? ''),
        ];
    },
    load_users()
);

usort(
    $users,
    static fn (array $left, array $right): int => strcmp((string) ($right['createdAt'] ?? ''), (string) ($left['createdAt'] ?? ''))
);

send_json([
    'ok' => true,
    'admin' => public_admin($admin),
    'summary' => [
        'userCount' => count($users),
    ],
    'users' => $users,
]);
