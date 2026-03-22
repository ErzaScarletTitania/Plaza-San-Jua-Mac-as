<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'message' => 'Método no permitido.'], 405);
}

$payload = read_payload();
$email = normalize_email((string) ($payload['email'] ?? ''));
$password = (string) ($payload['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    send_json(['ok' => false, 'message' => 'Completa el correo y la contraseña.'], 422);
}

$user = find_user_by_email($email);
if (!$user || !password_verify($password, (string) ($user['passwordHash'] ?? ''))) {
    send_json(['ok' => false, 'message' => 'Correo o contraseña incorrectos.'], 401);
}

$_SESSION['plaza_user_id'] = $user['id'];

send_json([
    'ok' => true,
    'user' => public_user($user),
]);
