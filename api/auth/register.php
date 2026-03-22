<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'message' => 'Método no permitido.'], 405);
}

$payload = read_payload();
$fullName = normalize_text((string) ($payload['fullName'] ?? ''));
$email = normalize_email((string) ($payload['email'] ?? ''));
$password = (string) ($payload['password'] ?? '');

if (mb_strlen($fullName) < 3) {
    send_json(['ok' => false, 'message' => 'Ingresa un nombre válido.'], 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    send_json(['ok' => false, 'message' => 'Ingresa un correo válido.'], 422);
}

if (strlen($password) < 8) {
    send_json(['ok' => false, 'message' => 'La contraseña debe tener al menos 8 caracteres.'], 422);
}

if (find_user_by_email($email)) {
    send_json(['ok' => false, 'message' => 'Ese correo ya está registrado.'], 409);
}

$user = [
    'id' => 'USR-' . substr(bin2hex(random_bytes(6)), 0, 12),
    'email' => $email,
    'fullName' => $fullName,
    'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
    'createdAt' => date(DATE_ATOM),
    'profile' => [
        'fullName' => $fullName,
        'phone' => '',
        'district' => '',
        'addressLine1' => '',
        'addressLine2' => '',
        'reference' => '',
    ],
    'social' => [
        'googleEnabled' => false,
        'facebookEnabled' => false,
    ],
];

replace_user($user);
$_SESSION['plaza_user_id'] = $user['id'];

send_json([
    'ok' => true,
    'user' => public_user($user),
]);
