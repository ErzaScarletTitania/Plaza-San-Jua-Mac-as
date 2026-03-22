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

function users_file(): string
{
    $dir = storage_path('users');
    ensure_dir($dir);
    $file = $dir . DIRECTORY_SEPARATOR . 'users.json';

    if (!file_exists($file)) {
        file_put_contents($file, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    return $file;
}

function load_users(): array
{
    $decoded = json_decode(file_get_contents(users_file()) ?: '[]', true);
    return is_array($decoded) ? $decoded : [];
}

function save_users(array $users): void
{
    file_put_contents(
        users_file(),
        json_encode(array_values($users), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );
}

function normalize_text(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', $value) ?? '');
}

function normalize_email(string $value): string
{
    return strtolower(normalize_text($value));
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

function require_logged_in_user(): array
{
    $userId = $_SESSION['plaza_user_id'] ?? '';
    if (!$userId) {
        send_json(['ok' => false, 'message' => 'Debes iniciar sesión.'], 401);
    }

    $user = find_user_by_id($userId);
    if (!$user) {
        unset($_SESSION['plaza_user_id']);
        send_json(['ok' => false, 'message' => 'La sesión ya no está disponible.'], 401);
    }

    return $user;
}
