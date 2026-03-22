<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$payload = read_payload();
$email = normalize_email((string) ($payload['email'] ?? ''));
$password = (string) ($payload['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    send_json(['ok' => false, 'message' => 'Completa el correo y la contrasena.'], 422);
}

$admin = find_admin_by_email($email);
if (!$admin || !verify_secret_custom($password, (string) ($admin['passwordHash'] ?? ''))) {
    send_json(['ok' => false, 'message' => 'Credenciales de administracion invalidas.'], 401);
}

session_regenerate_id(true);
$_SESSION['plaza_admin_id'] = $admin['id'];

send_json([
    'ok' => true,
    'admin' => public_admin($admin),
]);
