<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['ok' => false, 'message' => 'Método no permitido.'], 405);
}

$user = require_logged_in_user();
$storageDir = storage_path('orders');

if (!is_dir($storageDir)) {
    send_json(['ok' => true, 'orders' => []]);
}

$files = glob($storageDir . DIRECTORY_SEPARATOR . '*.json') ?: [];
$orders = [];

foreach ($files as $file) {
    $order = json_decode(file_get_contents($file) ?: '[]', true);
    if (!is_array($order)) {
        continue;
    }

    $matchesAccount = (($order['account']['id'] ?? '') !== '' && ($order['account']['id'] ?? '') === $user['id']);
    $matchesEmail = normalize_email((string) ($order['customer']['email'] ?? '')) === $user['email'];

    if (!$matchesAccount && !$matchesEmail) {
        continue;
    }

    $orders[] = [
        'orderId' => (string) ($order['orderId'] ?? ''),
        'savedAt' => (string) ($order['savedAt'] ?? ''),
        'total' => (float) ($order['total'] ?? 0),
        'status' => (string) ($order['status'] ?? 'pending_payment_review'),
        'statusLabel' => (string) ($order['statusLabel'] ?? 'Pendiente de validación de pago'),
        'paymentMethod' => (string) ($order['customer']['paymentMethod'] ?? ''),
    ];
}

usort(
    $orders,
    static fn (array $left, array $right): int => strcmp((string) ($right['savedAt'] ?? ''), (string) ($left['savedAt'] ?? ''))
);

send_json(['ok' => true, 'orders' => $orders]);
