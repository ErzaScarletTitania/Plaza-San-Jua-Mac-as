<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_auth.php';
require dirname(__DIR__) . DIRECTORY_SEPARATOR . '_mysql_schema.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'message' => 'Metodo no permitido.'], 405);
}

$admin = require_logged_in_admin();

if (!db_is_configured()) {
    send_json(['ok' => false, 'message' => 'La configuracion MySQL no esta disponible en runtime.'], 503);
}

function execute_schema(PDO $db, string $sql): void
{
    $statements = preg_split('/;\s*(?:\R|$)/', trim($sql)) ?: [];
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if ($statement === '') {
            continue;
        }

        $db->exec($statement);
    }
}

function migrate_orders_from_storage(): int
{
    $storageDir = storage_path('orders');
    $files = is_dir($storageDir) ? (glob($storageDir . DIRECTORY_SEPARATOR . '*.json') ?: []) : [];
    $count = 0;

    foreach ($files as $file) {
        $order = read_json_file($file);
        if ($order === []) {
            continue;
        }

        persist_order($order);
        $count++;
    }

    return $count;
}

try {
    $db = db_connection();
    execute_schema($db, mysql_schema_sql());

    $users = load_users();
    foreach ($users as $user) {
        if (is_array($user)) {
            db_replace_user_local($user);
        }
    }

    $admins = load_admins();
    foreach ($admins as $storedAdmin) {
        if (is_array($storedAdmin)) {
            db_replace_admin_local($storedAdmin);
        }
    }

    $migratedOrders = migrate_orders_from_storage();

    send_json([
        'ok' => true,
        'message' => 'Migracion MySQL completada.',
        'actor' => public_admin($admin),
        'summary' => [
            'users' => count($users),
            'admins' => count($admins),
            'orders' => $migratedOrders,
        ],
    ]);
} catch (Throwable $error) {
    send_json([
        'ok' => false,
        'message' => 'No se pudo migrar la base MySQL.',
        'details' => $error->getMessage(),
    ], 500);
}
