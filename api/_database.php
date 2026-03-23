<?php

declare(strict_types=1);

function db_config(): array
{
    return [
        'host' => trim((string) ($_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: '')),
        'port' => trim((string) ($_ENV['DB_PORT'] ?? getenv('DB_PORT') ?: '3306')),
        'name' => trim((string) ($_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: '')),
        'user' => trim((string) ($_ENV['DB_USER'] ?? getenv('DB_USER') ?: '')),
        'password' => (string) ($_ENV['DB_PASSWORD'] ?? getenv('DB_PASSWORD') ?: ''),
        'charset' => trim((string) ($_ENV['DB_CHARSET'] ?? getenv('DB_CHARSET') ?: 'utf8mb4')),
    ];
}

function db_is_configured(): bool
{
    $config = db_config();
    return $config['host'] !== '' && $config['name'] !== '' && $config['user'] !== '';
}

function db_dsn(): string
{
    $config = db_config();
    return sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $config['host'],
        $config['port'],
        $config['name'],
        $config['charset']
    );
}

function db_connection(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $config = db_config();
    if (!db_is_configured()) {
        throw new RuntimeException('La configuracion de MySQL no esta completa.');
    }

    $connection = new PDO(
        db_dsn(),
        $config['user'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    return $connection;
}

function db_try_connection(): ?PDO
{
    try {
        return db_connection();
    } catch (Throwable) {
        return null;
    }
}
