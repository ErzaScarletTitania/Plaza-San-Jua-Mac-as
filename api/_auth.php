<?php

declare(strict_types=1);

require __DIR__ . DIRECTORY_SEPARATOR . '_database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    $isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('plaza_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function send_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_payload(): array
{
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw ?: '[]', true);

    return is_array($payload) ? $payload : [];
}

function storage_path(string ...$parts): string
{
    $base = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
    return $base . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $parts);
}

function ensure_dir(string $path): void
{
    if (!is_dir($path)) {
        mkdir($path, 0775, true);
    }
}

function read_json_file(string $file, array $default = []): array
{
    if (!file_exists($file)) {
        return $default;
    }

    $handle = fopen($file, 'rb');
    if (!$handle) {
        return $default;
    }

    flock($handle, LOCK_SH);
    $raw = stream_get_contents($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    $decoded = json_decode($raw ?: '[]', true);
    return is_array($decoded) ? $decoded : $default;
}

function write_json_file(string $file, array $payload): void
{
    ensure_dir(dirname($file));
    $handle = fopen($file, 'cb');
    if (!$handle) {
        throw new RuntimeException(sprintf('No se pudo abrir %s para escritura.', $file));
    }

    flock($handle, LOCK_EX);
    ftruncate($handle, 0);
    rewind($handle);
    fwrite(
        $handle,
        json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
}

function normalize_text(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', $value) ?? '');
}

function normalize_email(string $value): string
{
    return strtolower(normalize_text($value));
}

function normalize_datetime(?string $value): string
{
    if (!$value) {
        return date(DATE_ATOM);
    }

    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return date(DATE_ATOM);
    }

    return date(DATE_ATOM, $timestamp);
}

function datetime_for_sql(?string $value): string
{
    return date('Y-m-d H:i:s', strtotime(normalize_datetime($value)));
}

function user_profile_defaults(array $profile = []): array
{
    return [
        'fullName' => normalize_text((string) ($profile['fullName'] ?? '')),
        'phone' => normalize_text((string) ($profile['phone'] ?? '')),
        'district' => normalize_text((string) ($profile['district'] ?? '')),
        'addressLine1' => normalize_text((string) ($profile['addressLine1'] ?? '')),
        'addressLine2' => normalize_text((string) ($profile['addressLine2'] ?? '')),
        'reference' => normalize_text((string) ($profile['reference'] ?? '')),
    ];
}

function users_file(): string
{
    $file = storage_path('users', 'users.json');
    if (!file_exists($file)) {
        write_json_file($file, []);
    }

    return $file;
}

function admins_file(): string
{
    $file = storage_path('admin', 'admins.json');
    if (!file_exists($file)) {
        write_json_file($file, []);
    }

    return $file;
}

function load_users(): array
{
    return read_json_file(users_file());
}

function save_users(array $users): void
{
    write_json_file(users_file(), array_values($users));
}

function load_admins(): array
{
    return read_json_file(admins_file());
}

function save_admins(array $admins): void
{
    write_json_file(admins_file(), array_values($admins));
}

function hash_secret_custom(string $value): string
{
    $salt = bin2hex(random_bytes(16));
    $hash = hash('sha256', $salt . '|' . $value);
    return 'sha256$' . $salt . '$' . $hash;
}

function verify_secret_custom(string $value, string $hash): bool
{
    if (str_starts_with($hash, 'sha256$')) {
        $parts = explode('$', $hash, 3);
        if (count($parts) !== 3) {
            return false;
        }

        [, $salt, $digest] = $parts;
        return hash_equals($digest, hash('sha256', $salt . '|' . $value));
    }

    return password_verify($value, $hash);
}

function public_user(array $user): array
{
    return [
        'id' => $user['id'],
        'email' => $user['email'],
        'fullName' => $user['fullName'],
        'createdAt' => $user['createdAt'],
        'profile' => user_profile_defaults($user['profile'] ?? []),
        'social' => [
            'googleEnabled' => (bool) ($user['social']['googleEnabled'] ?? false),
            'facebookEnabled' => (bool) ($user['social']['facebookEnabled'] ?? false),
        ],
    ];
}

function public_admin(array $admin): array
{
    return [
        'id' => $admin['id'],
        'email' => $admin['email'],
        'fullName' => $admin['fullName'],
        'createdAt' => $admin['createdAt'] ?? '',
        'role' => $admin['role'] ?? 'owner',
    ];
}

function db_user_from_rows(array $userRow, ?array $addressRow = null): array
{
    return [
        'id' => (string) $userRow['id'],
        'email' => normalize_email((string) ($userRow['email'] ?? '')),
        'fullName' => normalize_text((string) ($userRow['full_name'] ?? '')),
        'passwordHash' => (string) ($userRow['password_hash'] ?? ''),
        'createdAt' => normalize_datetime((string) ($userRow['created_at'] ?? '')),
        'updatedAt' => normalize_datetime((string) ($userRow['updated_at'] ?? $userRow['created_at'] ?? '')),
        'profile' => user_profile_defaults([
            'fullName' => (string) ($userRow['full_name'] ?? ''),
            'phone' => (string) ($addressRow['phone'] ?? ''),
            'district' => (string) ($addressRow['district'] ?? ''),
            'addressLine1' => (string) ($addressRow['address_line1'] ?? ''),
            'addressLine2' => (string) ($addressRow['address_line2'] ?? ''),
            'reference' => (string) ($addressRow['reference_text'] ?? ''),
        ]),
        'social' => [
            'googleEnabled' => (bool) ($userRow['social_google_enabled'] ?? false),
            'facebookEnabled' => (bool) ($userRow['social_facebook_enabled'] ?? false),
        ],
    ];
}

function db_admin_from_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'email' => normalize_email((string) ($row['email'] ?? '')),
        'fullName' => normalize_text((string) ($row['full_name'] ?? '')),
        'passwordHash' => (string) ($row['password_hash'] ?? ''),
        'role' => normalize_text((string) ($row['role'] ?? 'owner')) ?: 'owner',
        'createdAt' => normalize_datetime((string) ($row['created_at'] ?? '')),
        'updatedAt' => normalize_datetime((string) ($row['updated_at'] ?? $row['created_at'] ?? '')),
    ];
}

function db_primary_address_row(PDO $db, string $userId): ?array
{
    $stmt = $db->prepare(
        'SELECT * FROM user_addresses WHERE user_id = :user_id ORDER BY is_default DESC, id ASC LIMIT 1'
    );
    $stmt->execute(['user_id' => $userId]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

function db_find_user_by_email_local(string $email): ?array
{
    $db = db_try_connection();
    if (!$db) {
        return null;
    }

    try {
        $stmt = $db->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        if (!is_array($row)) {
            return null;
        }

        return db_user_from_rows($row, db_primary_address_row($db, (string) $row['id']));
    } catch (Throwable) {
        return null;
    }
}

function db_find_user_by_id_local(string $userId): ?array
{
    $db = db_try_connection();
    if (!$db) {
        return null;
    }

    try {
        $stmt = $db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch();
        if (!is_array($row)) {
            return null;
        }

        return db_user_from_rows($row, db_primary_address_row($db, (string) $row['id']));
    } catch (Throwable) {
        return null;
    }
}

function db_find_admin_by_email_local(string $email): ?array
{
    $db = db_try_connection();
    if (!$db) {
        return null;
    }

    try {
        $stmt = $db->prepare('SELECT * FROM admins WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        return is_array($row) ? db_admin_from_row($row) : null;
    } catch (Throwable) {
        return null;
    }
}

function db_find_admin_by_id_local(string $adminId): ?array
{
    $db = db_try_connection();
    if (!$db) {
        return null;
    }

    try {
        $stmt = $db->prepare('SELECT * FROM admins WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $adminId]);
        $row = $stmt->fetch();
        return is_array($row) ? db_admin_from_row($row) : null;
    } catch (Throwable) {
        return null;
    }
}

function db_replace_user_local(array $user): void
{
    $db = db_try_connection();
    if (!$db) {
        return;
    }

    $profile = user_profile_defaults($user['profile'] ?? []);
    $social = is_array($user['social'] ?? null) ? $user['social'] : [];

    try {
        $db->beginTransaction();
        $stmt = $db->prepare(
            'INSERT INTO users (
                id, email, full_name, password_hash, social_google_enabled, social_facebook_enabled, created_at, updated_at
            ) VALUES (
                :id, :email, :full_name, :password_hash, :google_enabled, :facebook_enabled, :created_at, :updated_at
            )
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                full_name = VALUES(full_name),
                password_hash = VALUES(password_hash),
                social_google_enabled = VALUES(social_google_enabled),
                social_facebook_enabled = VALUES(social_facebook_enabled),
                updated_at = VALUES(updated_at)'
        );
        $stmt->execute([
            'id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $user['fullName'],
            'password_hash' => $user['passwordHash'] ?? null,
            'google_enabled' => !empty($social['googleEnabled']) ? 1 : 0,
            'facebook_enabled' => !empty($social['facebookEnabled']) ? 1 : 0,
            'created_at' => datetime_for_sql((string) ($user['createdAt'] ?? null)),
            'updated_at' => datetime_for_sql((string) ($user['updatedAt'] ?? $user['createdAt'] ?? null)),
        ]);

        $db->prepare('DELETE FROM user_addresses WHERE user_id = :user_id')->execute([
            'user_id' => $user['id'],
        ]);

        if ($profile['addressLine1'] !== '' || $profile['district'] !== '' || $profile['phone'] !== '') {
            $stmt = $db->prepare(
                'INSERT INTO user_addresses (
                    user_id, label, phone, district, address_line1, address_line2, reference_text, is_default, created_at, updated_at
                ) VALUES (
                    :user_id, :label, :phone, :district, :address_line1, :address_line2, :reference_text, 1, :created_at, :updated_at
                )'
            );
            $stmt->execute([
                'user_id' => $user['id'],
                'label' => 'Principal',
                'phone' => $profile['phone'] ?: null,
                'district' => $profile['district'] ?: null,
                'address_line1' => $profile['addressLine1'] ?: null,
                'address_line2' => $profile['addressLine2'] ?: null,
                'reference_text' => $profile['reference'] ?: null,
                'created_at' => datetime_for_sql((string) ($user['createdAt'] ?? null)),
                'updated_at' => datetime_for_sql((string) ($user['updatedAt'] ?? $user['createdAt'] ?? null)),
            ]);
        }

        $db->commit();
    } catch (Throwable) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
    }
}

function db_replace_admin_local(array $admin): void
{
    $db = db_try_connection();
    if (!$db) {
        return;
    }

    try {
        $stmt = $db->prepare(
            'INSERT INTO admins (
                id, email, full_name, password_hash, role, created_at, updated_at
            ) VALUES (
                :id, :email, :full_name, :password_hash, :role, :created_at, :updated_at
            )
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                full_name = VALUES(full_name),
                password_hash = VALUES(password_hash),
                role = VALUES(role),
                updated_at = VALUES(updated_at)'
        );
        $stmt->execute([
            'id' => $admin['id'],
            'email' => $admin['email'],
            'full_name' => $admin['fullName'],
            'password_hash' => $admin['passwordHash'] ?? null,
            'role' => $admin['role'] ?? 'owner',
            'created_at' => datetime_for_sql((string) ($admin['createdAt'] ?? null)),
            'updated_at' => datetime_for_sql((string) ($admin['updatedAt'] ?? $admin['createdAt'] ?? null)),
        ]);
    } catch (Throwable) {
        return;
    }
}

function db_orders_for_user_local(array $user): array
{
    $db = db_try_connection();
    if (!$db) {
        return [];
    }

    try {
        $stmt = $db->prepare(
            'SELECT public_order_id, saved_at, total, status_code, status_label, payment_method
             FROM orders
             WHERE user_id = :user_id OR customer_email = :email
             ORDER BY saved_at DESC'
        );
        $stmt->execute([
            'user_id' => $user['id'],
            'email' => $user['email'],
        ]);
        $rows = $stmt->fetchAll();
        if (!is_array($rows)) {
            return [];
        }

        return array_map(
            static function (array $row): array {
                return [
                    'orderId' => (string) ($row['public_order_id'] ?? ''),
                    'savedAt' => normalize_datetime((string) ($row['saved_at'] ?? '')),
                    'total' => (float) ($row['total'] ?? 0),
                    'status' => (string) ($row['status_code'] ?? 'pending_payment_review'),
                    'statusLabel' => (string) ($row['status_label'] ?? 'Pendiente de validacion de pago'),
                    'paymentMethod' => (string) ($row['payment_method'] ?? ''),
                ];
            },
            $rows
        );
    } catch (Throwable) {
        return [];
    }
}

function db_all_orders_local(): array
{
    $db = db_try_connection();
    if (!$db) {
        return [];
    }

    try {
        $stmt = $db->query(
            'SELECT public_order_id, saved_at, total, status_code, status_label, payment_method, customer_name, district
             FROM orders
             ORDER BY saved_at DESC'
        );
        $rows = $stmt->fetchAll();
        if (!is_array($rows)) {
            return [];
        }

        return array_map(
            static function (array $row): array {
                return [
                    'orderId' => (string) ($row['public_order_id'] ?? ''),
                    'savedAt' => normalize_datetime((string) ($row['saved_at'] ?? '')),
                    'total' => (float) ($row['total'] ?? 0),
                    'status' => (string) ($row['status_code'] ?? 'pending_payment_review'),
                    'statusLabel' => (string) ($row['status_label'] ?? 'Pendiente de revision'),
                    'paymentMethod' => (string) ($row['payment_method'] ?? ''),
                    'customerName' => (string) ($row['customer_name'] ?? ''),
                    'district' => (string) ($row['district'] ?? ''),
                    'itemCount' => 0,
                ];
            },
            $rows
        );
    } catch (Throwable) {
        return [];
    }
}

function db_public_users_local(): array
{
    $db = db_try_connection();
    if (!$db) {
        return [];
    }

    try {
        $stmt = $db->query(
            'SELECT u.id, u.email, u.full_name, u.created_at, a.district
             FROM users u
             LEFT JOIN user_addresses a ON a.user_id = u.id AND a.is_default = 1
             ORDER BY u.created_at DESC'
        );
        $rows = $stmt->fetchAll();
        if (!is_array($rows)) {
            return [];
        }

        return array_map(
            static function (array $row): array {
                return [
                    'id' => (string) ($row['id'] ?? ''),
                    'email' => (string) ($row['email'] ?? ''),
                    'fullName' => (string) ($row['full_name'] ?? ''),
                    'createdAt' => normalize_datetime((string) ($row['created_at'] ?? '')),
                    'district' => (string) ($row['district'] ?? ''),
                ];
            },
            $rows
        );
    } catch (Throwable) {
        return [];
    }
}

function db_replace_order_local(array $order): void
{
    $db = db_try_connection();
    if (!$db) {
        return;
    }

    $userId = normalize_text((string) ($order['account']['id'] ?? ''));
    if ($userId !== '') {
        $user = find_user_by_id($userId);
        if ($user) {
            db_replace_user_local($user);
        } else {
            $userId = '';
        }
    }

    try {
        $db->beginTransaction();
        $stmt = $db->prepare(
            'INSERT INTO orders (
                public_order_id, user_id, account_email, customer_name, customer_email, customer_phone,
                district, address_line1, address_line2, reference_text, payment_method, notes,
                status_code, status_label, currency, minimum_order, total, created_at, saved_at
            ) VALUES (
                :public_order_id, :user_id, :account_email, :customer_name, :customer_email, :customer_phone,
                :district, :address_line1, :address_line2, :reference_text, :payment_method, :notes,
                :status_code, :status_label, :currency, :minimum_order, :total, :created_at, :saved_at
            )
            ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id),
                account_email = VALUES(account_email),
                customer_name = VALUES(customer_name),
                customer_email = VALUES(customer_email),
                customer_phone = VALUES(customer_phone),
                district = VALUES(district),
                address_line1 = VALUES(address_line1),
                address_line2 = VALUES(address_line2),
                reference_text = VALUES(reference_text),
                payment_method = VALUES(payment_method),
                notes = VALUES(notes),
                status_code = VALUES(status_code),
                status_label = VALUES(status_label),
                minimum_order = VALUES(minimum_order),
                total = VALUES(total),
                saved_at = VALUES(saved_at)'
        );
        $stmt->execute([
            'public_order_id' => $order['orderId'],
            'user_id' => $userId !== '' ? $userId : null,
            'account_email' => normalize_email((string) ($order['account']['email'] ?? '')) ?: null,
            'customer_name' => normalize_text((string) ($order['customer']['fullName'] ?? '')),
            'customer_email' => normalize_email((string) ($order['customer']['email'] ?? '')) ?: null,
            'customer_phone' => normalize_text((string) ($order['customer']['phone'] ?? '')) ?: null,
            'district' => normalize_text((string) ($order['customer']['district'] ?? '')) ?: null,
            'address_line1' => normalize_text((string) ($order['customer']['addressLine1'] ?? '')) ?: null,
            'address_line2' => normalize_text((string) ($order['customer']['addressLine2'] ?? '')) ?: null,
            'reference_text' => normalize_text((string) ($order['customer']['reference'] ?? '')) ?: null,
            'payment_method' => normalize_text((string) ($order['customer']['paymentMethod'] ?? '')),
            'notes' => normalize_text((string) ($order['customer']['notes'] ?? '')) ?: null,
            'status_code' => normalize_text((string) ($order['status'] ?? 'pending_payment_review')),
            'status_label' => normalize_text((string) ($order['statusLabel'] ?? 'Pendiente de validacion de pago')),
            'currency' => normalize_text((string) ($order['currency'] ?? 'PEN')) ?: 'PEN',
            'minimum_order' => (float) ($order['minimumOrder'] ?? 50),
            'total' => (float) ($order['total'] ?? 0),
            'created_at' => datetime_for_sql((string) ($order['createdAt'] ?? null)),
            'saved_at' => datetime_for_sql((string) ($order['savedAt'] ?? $order['createdAt'] ?? null)),
        ]);

        $stmt = $db->prepare('SELECT id FROM orders WHERE public_order_id = :public_order_id LIMIT 1');
        $stmt->execute(['public_order_id' => $order['orderId']]);
        $orderRow = $stmt->fetch();
        if (!is_array($orderRow)) {
            $db->rollBack();
            return;
        }

        $orderDbId = (int) $orderRow['id'];
        $db->prepare('DELETE FROM order_items WHERE order_id = :order_id')->execute(['order_id' => $orderDbId]);
        $db->prepare('DELETE FROM payments WHERE order_id = :order_id')->execute(['order_id' => $orderDbId]);

        $itemStmt = $db->prepare(
            'INSERT INTO order_items (
                order_id, product_id, product_name, image_url, unit_price, quantity, created_at
            ) VALUES (
                :order_id, :product_id, :product_name, :image_url, :unit_price, :quantity, :created_at
            )'
        );
        foreach (($order['items'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }

            $itemStmt->execute([
                'order_id' => $orderDbId,
                'product_id' => normalize_text((string) ($item['id'] ?? '')) ?: null,
                'product_name' => normalize_text((string) ($item['name'] ?? '')),
                'image_url' => normalize_text((string) ($item['image'] ?? '')) ?: null,
                'unit_price' => (float) ($item['price'] ?? 0),
                'quantity' => max(1, (int) ($item['quantity'] ?? 1)),
                'created_at' => datetime_for_sql((string) ($order['savedAt'] ?? $order['createdAt'] ?? null)),
            ]);
        }

        $paymentStmt = $db->prepare(
            'INSERT INTO payments (
                order_id, provider, channel_reference, amount, currency, status_code, proof_url, created_at, reviewed_at
            ) VALUES (
                :order_id, :provider, NULL, :amount, :currency, :status_code, NULL, :created_at, NULL
            )'
        );
        $paymentStmt->execute([
            'order_id' => $orderDbId,
            'provider' => normalize_text((string) ($order['customer']['paymentMethod'] ?? 'manual')),
            'amount' => (float) ($order['total'] ?? 0),
            'currency' => normalize_text((string) ($order['currency'] ?? 'PEN')) ?: 'PEN',
            'status_code' => normalize_text((string) ($order['status'] ?? 'pending_payment_review')),
            'created_at' => datetime_for_sql((string) ($order['savedAt'] ?? $order['createdAt'] ?? null)),
        ]);

        $db->commit();
    } catch (Throwable) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
    }
}

function find_user_by_email(string $email): ?array
{
    $dbUser = db_find_user_by_email_local($email);
    if ($dbUser) {
        return $dbUser;
    }

    foreach (load_users() as $user) {
        if (($user['email'] ?? '') === $email) {
            db_replace_user_local($user);
            return $user;
        }
    }

    return null;
}

function find_user_by_id(string $userId): ?array
{
    $dbUser = db_find_user_by_id_local($userId);
    if ($dbUser) {
        return $dbUser;
    }

    foreach (load_users() as $user) {
        if (($user['id'] ?? '') === $userId) {
            db_replace_user_local($user);
            return $user;
        }
    }

    return null;
}

function find_admin_by_email(string $email): ?array
{
    $dbAdmin = db_find_admin_by_email_local($email);
    if ($dbAdmin) {
        return $dbAdmin;
    }

    foreach (load_admins() as $admin) {
        if (($admin['email'] ?? '') === $email) {
            db_replace_admin_local($admin);
            return $admin;
        }
    }

    return null;
}

function find_admin_by_id(string $adminId): ?array
{
    $dbAdmin = db_find_admin_by_id_local($adminId);
    if ($dbAdmin) {
        return $dbAdmin;
    }

    foreach (load_admins() as $admin) {
        if (($admin['id'] ?? '') === $adminId) {
            db_replace_admin_local($admin);
            return $admin;
        }
    }

    return null;
}

function replace_user(array $updatedUser): void
{
    $users = load_users();
    foreach ($users as $index => $user) {
        if (($user['id'] ?? '') === ($updatedUser['id'] ?? '')) {
            $users[$index] = $updatedUser;
            save_users($users);
            db_replace_user_local($updatedUser);
            return;
        }
    }

    $users[] = $updatedUser;
    save_users($users);
    db_replace_user_local($updatedUser);
}

function replace_admin(array $updatedAdmin): void
{
    $admins = load_admins();
    foreach ($admins as $index => $admin) {
        if (($admin['id'] ?? '') === ($updatedAdmin['id'] ?? '')) {
            $admins[$index] = $updatedAdmin;
            save_admins($admins);
            db_replace_admin_local($updatedAdmin);
            return;
        }
    }

    $admins[] = $updatedAdmin;
    save_admins($admins);
    db_replace_admin_local($updatedAdmin);
}

function persist_order(array $order): void
{
    $storageDir = storage_path('orders');
    ensure_dir($storageDir);
    $target = $storageDir . DIRECTORY_SEPARATOR . $order['orderId'] . '.json';
    write_json_file($target, $order);
    db_replace_order_local($order);
}

function list_orders_for_user(array $user): array
{
    $dbOrders = db_orders_for_user_local($user);
    if ($dbOrders !== []) {
        return $dbOrders;
    }

    $storageDir = storage_path('orders');
    if (!is_dir($storageDir)) {
        return [];
    }

    $files = glob($storageDir . DIRECTORY_SEPARATOR . '*.json') ?: [];
    $orders = [];

    foreach ($files as $file) {
        $order = read_json_file($file);
        if ($order === []) {
            continue;
        }

        $matchesAccount = (($order['account']['id'] ?? '') !== '' && ($order['account']['id'] ?? '') === $user['id']);
        $matchesEmail = normalize_email((string) ($order['customer']['email'] ?? '')) === $user['email'];

        if (!$matchesAccount && !$matchesEmail) {
            continue;
        }

        $orders[] = [
            'orderId' => (string) ($order['orderId'] ?? ''),
            'savedAt' => (string) ($order['savedAt'] ?? ''),
            'total' => (float) ($order['total'] ?? 0),
            'status' => (string) ($order['status'] ?? 'pending_payment_review'),
            'statusLabel' => (string) ($order['statusLabel'] ?? 'Pendiente de validacion de pago'),
            'paymentMethod' => (string) ($order['customer']['paymentMethod'] ?? ''),
        ];
    }

    usort(
        $orders,
        static fn (array $left, array $right): int => strcmp((string) ($right['savedAt'] ?? ''), (string) ($left['savedAt'] ?? ''))
    );

    return $orders;
}

function list_all_orders(): array
{
    $dbOrders = db_all_orders_local();
    if ($dbOrders !== []) {
        return $dbOrders;
    }

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

    return $orders;
}

function list_public_users(): array
{
    $dbUsers = db_public_users_local();
    if ($dbUsers !== []) {
        return $dbUsers;
    }

    $users = array_map(
        static function (array $user): array {
            return [
                'id' => (string) ($user['id'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'fullName' => (string) ($user['fullName'] ?? ''),
                'createdAt' => (string) ($user['createdAt'] ?? ''),
                'district' => (string) ($user['profile']['district'] ?? ''),
            ];
        },
        load_users()
    );

    usort(
        $users,
        static fn (array $left, array $right): int => strcmp((string) ($right['createdAt'] ?? ''), (string) ($left['createdAt'] ?? ''))
    );

    return $users;
}

function require_logged_in_user(): array
{
    $userId = $_SESSION['plaza_user_id'] ?? '';
    if (!$userId) {
        send_json(['ok' => false, 'message' => 'Debes iniciar sesion.'], 401);
    }

    $user = find_user_by_id($userId);
    if (!$user) {
        unset($_SESSION['plaza_user_id']);
        send_json(['ok' => false, 'message' => 'La sesion ya no esta disponible.'], 401);
    }

    return $user;
}

function require_logged_in_admin(): array
{
    $adminId = $_SESSION['plaza_admin_id'] ?? '';
    if (!$adminId) {
        send_json(['ok' => false, 'message' => 'Debes iniciar sesion como administrador.'], 401);
    }

    $admin = find_admin_by_id($adminId);
    if (!$admin) {
        unset($_SESSION['plaza_admin_id']);
        send_json(['ok' => false, 'message' => 'La sesion de administracion ya no esta disponible.'], 401);
    }

    return $admin;
}
