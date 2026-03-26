<?php

declare(strict_types=1);

require __DIR__ . DIRECTORY_SEPARATOR . '_auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$payload = read_payload();
$customer = is_array($payload['customer'] ?? null) ? $payload['customer'] : [];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
$allowedPaymentMethods = ['Yape', 'BCP', 'PayPal', 'Binance USDT BEP20'];
$minimumOrder = 50;
$deliveryFee = 5.0;

if (normalize_text((string) ($customer['fullName'] ?? '')) === '' || empty($items)) {
    send_json(['ok' => false, 'message' => 'Pedido invalido.'], 422);
}

$paymentMethod = normalize_text((string) ($customer['paymentMethod'] ?? ''));
if (!in_array($paymentMethod, $allowedPaymentMethods, true)) {
    send_json(['ok' => false, 'message' => 'Selecciona un metodo de pago valido.'], 422);
}

$normalizedItems = [];
$computedSubtotal = 0.0;
foreach ($items as $item) {
    if (!is_array($item)) {
        continue;
    }

    $price = (float) ($item['price'] ?? 0);
    $quantity = max(1, (int) ($item['quantity'] ?? 1));
    $name = normalize_text((string) ($item['name'] ?? ''));

    if ($price <= 0 || $name === '') {
        continue;
    }

    $normalizedItems[] = [
        'id' => normalize_text((string) ($item['id'] ?? '')),
        'variantId' => normalize_text((string) ($item['variantId'] ?? '')),
        'variantLabel' => normalize_text((string) ($item['variantLabel'] ?? '')),
        'variantType' => normalize_text((string) ($item['variantType'] ?? '')),
        'name' => $name,
        'image' => normalize_text((string) ($item['image'] ?? '')),
        'price' => round($price, 2),
        'quantity' => $quantity,
    ];
    $computedSubtotal += $price * $quantity;
}

if ($normalizedItems === []) {
    send_json(['ok' => false, 'message' => 'Tu carrito no tiene productos validos.'], 422);
}

$computedSubtotal = round($computedSubtotal, 2);
if ($computedSubtotal < $minimumOrder) {
    send_json(['ok' => false, 'message' => 'El pedido minimo para delivery es S/ 50.00.'], 422);
}

$computedTotal = round($computedSubtotal + $deliveryFee, 2);

$orderId = 'PSJM-' . date('Ymd-His') . '-' . substr(bin2hex(random_bytes(4)), 0, 8);
$order = [
    'orderId' => $orderId,
    'status' => 'pending_payment_review',
    'statusLabel' => 'Pendiente de validacion de pago',
    'savedAt' => date(DATE_ATOM),
    'createdAt' => (string) ($payload['createdAt'] ?? date(DATE_ATOM)),
    'currency' => 'PEN',
    'minimumOrder' => $minimumOrder,
    'subtotal' => $computedSubtotal,
    'deliveryFee' => $deliveryFee,
    'total' => $computedTotal,
    'customer' => [
        'fullName' => normalize_text((string) ($customer['fullName'] ?? '')),
        'email' => normalize_email((string) ($customer['email'] ?? '')),
        'phone' => normalize_text((string) ($customer['phone'] ?? '')),
        'district' => normalize_text((string) ($customer['district'] ?? '')),
        'addressLine1' => normalize_text((string) ($customer['addressLine1'] ?? '')),
        'addressLine2' => normalize_text((string) ($customer['addressLine2'] ?? '')),
        'reference' => normalize_text((string) ($customer['reference'] ?? '')),
        'paymentMethod' => $paymentMethod,
        'notes' => normalize_text((string) ($customer['notes'] ?? '')),
    ],
    'account' => [
        'id' => normalize_text((string) (($payload['account']['id'] ?? '') ?: '')),
        'email' => normalize_email((string) (($payload['account']['email'] ?? '') ?: '')),
    ],
    'items' => $normalizedItems,
];

persist_order($order);

send_json(['ok' => true, 'orderId' => $orderId, 'statusLabel' => $order['statusLabel']]);
