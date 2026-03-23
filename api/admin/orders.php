<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$admin = require_logged_in_admin();
$orders = list_all_orders();

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
