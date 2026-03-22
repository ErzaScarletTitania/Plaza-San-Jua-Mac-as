<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'message' => 'Método no permitido.'], 405);
}

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}

session_destroy();

send_json(['ok' => true]);
