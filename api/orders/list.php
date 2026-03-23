<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$user = require_logged_in_user();
$orders = list_orders_for_user($user);

send_json(['ok' => true, 'orders' => $orders]);
