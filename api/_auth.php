<?php

declare(strict_types=1);

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
        'profile' => $user['profile'],
        'social' => $user['social'],
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

function find_user_by_email(string $email): ?array
{
    foreach (load_users() as $user) {
        if (($user['email'] ?? '') === $email) {
            return $user;
        }
    }

    return null;
}

function find_user_by_id(string $userId): ?array
{
    foreach (load_users() as $user) {
        if (($user['id'] ?? '') === $userId) {
            return $user;
        }
    }

    return null;
}

function find_admin_by_email(string $email): ?array
{
    foreach (load_admins() as $admin) {
        if (($admin['email'] ?? '') === $email) {
            return $admin;
        }
    }

    return null;
}

function find_admin_by_id(string $adminId): ?array
{
    foreach (load_admins() as $admin) {
        if (($admin['id'] ?? '') === $adminId) {
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
            return;
        }
    }

    $users[] = $updatedUser;
    save_users($users);
}

function replace_admin(array $updatedAdmin): void
{
    $admins = load_admins();
    foreach ($admins as $index => $admin) {
        if (($admin['id'] ?? '') === ($updatedAdmin['id'] ?? '')) {
            $admins[$index] = $updatedAdmin;
            save_admins($admins);
            return;
        }
    }

    $admins[] = $updatedAdmin;
    save_admins($admins);
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
