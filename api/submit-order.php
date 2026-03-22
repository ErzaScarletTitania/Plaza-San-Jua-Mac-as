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
    send_json(['ok' => false, 'message' => 'Método no permitido.'], 405);
}

$payload = read_payload();
$customer = is_array($payload['customer'] ?? null) ? $payload['customer'] : [];
$items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
$allowedPaymentMethods = ['Yape', 'BCP', 'PayPal', 'Binance USDT BEP20'];
$minimumOrder = 50;

if (normalize_text((string) ($customer['fullName'] ?? '')) === '' || empty($items)) {
    send_json(['ok' => false, 'message' => 'Pedido inválido.'], 422);
}

$paymentMethod = normalize_text((string) ($customer['paymentMethod'] ?? ''));
if (!in_array($paymentMethod, $allowedPaymentMethods, true)) {
    send_json(['ok' => false, 'message' => 'Selecciona un método de pago válido.'], 422);
}

$normalizedItems = [];
$computedTotal = 0.0;
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
        'name' => $name,
        'image' => normalize_text((string) ($item['image'] ?? '')),
        'price' => round($price, 2),
        'quantity' => $quantity,
    ];
    $computedTotal += $price * $quantity;
}

if ($normalizedItems === []) {
    send_json(['ok' => false, 'message' => 'Tu carrito no tiene productos válidos.'], 422);
}

$computedTotal = round($computedTotal, 2);
if ($computedTotal < $minimumOrder) {
    send_json(['ok' => false, 'message' => 'El pedido mínimo para delivery es S/ 50.00.'], 422);
}

$storageDir = storage_path('orders');
ensure_dir($storageDir);

$orderId = 'PSJM-' . date('Ymd-His') . '-' . substr(bin2hex(random_bytes(4)), 0, 8);
$order = [
    'orderId' => $orderId,
    'status' => 'pending_payment_review',
    'statusLabel' => 'Pendiente de validación de pago',
    'savedAt' => date(DATE_ATOM),
    'createdAt' => (string) ($payload['createdAt'] ?? date(DATE_ATOM)),
    'currency' => 'PEN',
    'minimumOrder' => $minimumOrder,
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

$target = $storageDir . DIRECTORY_SEPARATOR . $orderId . '.json';
write_json_file($target, $order);

send_json(['ok' => true, 'orderId' => $orderId, 'statusLabel' => $order['statusLabel']]);
