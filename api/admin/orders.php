<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

$admin = require_logged_in_admin();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = decode_json_request();
    $orderId = normalize_text((string) ($payload['orderId'] ?? ''));
    $status = normalize_text((string) ($payload['status'] ?? ''));
    $note = normalize_text((string) ($payload['note'] ?? ''));

    $updated = update_order_status($orderId, $status, [
        'author' => (string) ($admin['email'] ?? 'admin'),
        'note' => $note,
    ]);

    if (!$updated) {
        send_json(['ok' => false, 'message' => 'No se pudo actualizar el pedido.'], 422);
    }

    send_json([
        'ok' => true,
        'admin' => public_admin($admin),
        'order' => $updated,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
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
}

send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
