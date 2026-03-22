<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'message' => 'Método no permitido.'], 405);
}

$user = require_logged_in_user();
$payload = read_payload();

$profile = [
    'fullName' => normalize_text((string) ($payload['fullName'] ?? '')),
    'phone' => normalize_text((string) ($payload['phone'] ?? '')),
    'district' => normalize_text((string) ($payload['district'] ?? '')),
    'addressLine1' => normalize_text((string) ($payload['addressLine1'] ?? '')),
    'addressLine2' => normalize_text((string) ($payload['addressLine2'] ?? '')),
    'reference' => normalize_text((string) ($payload['reference'] ?? '')),
];

if (mb_strlen($profile['fullName']) < 3) {
    send_json(['ok' => false, 'message' => 'Completa tu nombre.'], 422);
}

if (strlen($profile['phone']) < 6) {
    send_json(['ok' => false, 'message' => 'Completa un teléfono de contacto.'], 422);
}

if (mb_strlen($profile['district']) < 2) {
    send_json(['ok' => false, 'message' => 'Completa el distrito.'], 422);
}

if (mb_strlen($profile['addressLine1']) < 6) {
    send_json(['ok' => false, 'message' => 'Completa la dirección principal.'], 422);
}

$user['fullName'] = $profile['fullName'];
$user['profile'] = $profile;
$user['updatedAt'] = date(DATE_ATOM);

replace_user($user);

send_json([
    'ok' => true,
    'user' => public_user($user),
]);
