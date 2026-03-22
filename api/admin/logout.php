<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

unset($_SESSION['plaza_admin_id']);
session_regenerate_id(true);

send_json(['ok' => true]);
