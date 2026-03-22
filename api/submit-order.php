<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw ?: '[]', true);

if (!is_array($payload) || empty($payload['customer']['fullName']) || empty($payload['items'])) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Pedido inválido'], JSON_UNESCAPED_UNICODE);
    exit;
}

$storageDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'orders';
if (!is_dir($storageDir)) {
    mkdir($storageDir, 0775, true);
}

$orderId = 'PSJM-' . date('Ymd-His') . '-' . substr(bin2hex(random_bytes(4)), 0, 8);
$payload['orderId'] = $orderId;
$payload['savedAt'] = date(DATE_ATOM);

$target = $storageDir . DIRECTORY_SEPARATOR . $orderId . '.json';
file_put_contents(
    $target,
    json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
);

echo json_encode(['ok' => true, 'orderId' => $orderId], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
