<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$admin = require_logged_in_admin();
$storageDir = storage_path('orders');
$files = is_dir($storageDir) ? (glob($storageDir . DIRECTORY_SEPARATOR . '*.json') ?: []) : [];
$orders = [];

foreach ($files as $file) {
    $order = read_json_file($file);
    if ($order === []) {
        continue;
    }

    $orders[] = [
        'orderId' => (string) ($order['orderId'] ?? ''),
        'savedAt' => (string) ($order['savedAt'] ?? ''),
        'total' => (float) ($order['total'] ?? 0),
        'status' => (string) ($order['status'] ?? 'pending_payment_review'),
        'statusLabel' => (string) ($order['statusLabel'] ?? 'Pendiente de revision'),
        'paymentMethod' => (string) ($order['customer']['paymentMethod'] ?? ''),
        'customerName' => (string) ($order['customer']['fullName'] ?? ''),
        'district' => (string) ($order['customer']['district'] ?? ''),
        'itemCount' => count($order['items'] ?? []),
    ];
}

usort(
    $orders,
    static fn (array $left, array $right): int => strcmp((string) ($right['savedAt'] ?? ''), (string) ($left['savedAt'] ?? ''))
);

$totalRevenue = array_reduce(
    $orders,
    static fn (float $carry, array $order): float => $carry + (float) ($order['total'] ?? 0),
    0.0
);

send_json([
    'ok' => true,
    'admin' => public_admin($admin),
    'summary' => [
        'orderCount' => count($orders),
        'revenuePen' => round($totalRevenue, 2),
    ],
    'orders' => $orders,
]);
