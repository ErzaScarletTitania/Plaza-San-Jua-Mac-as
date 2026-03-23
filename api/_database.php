<?php

declare(strict_types=1);

function runtime_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $file = __DIR__ . DIRECTORY_SEPARATOR . '_runtime-config.php';
    if (file_exists($file)) {
        $loaded = require $file;
        $config = is_array($loaded) ? $loaded : [];
        return $config;
    }

    $config = [];
    return $config;
}

function db_config_value(string $key, string $fallback = ''): string
{
    $runtime = runtime_config();
    $runtimeDb = is_array($runtime['db'] ?? null) ? $runtime['db'] : [];

    if (($runtimeDb[$key] ?? '') !== '') {
        return trim((string) $runtimeDb[$key]);
    }

    return trim((string) ($_ENV[$key] ?? getenv($key) ?: $fallback));
}

function db_config(): array
{
    return [
        'host' => db_config_value('DB_HOST'),
        'port' => db_config_value('DB_PORT', '3306'),
        'name' => db_config_value('DB_NAME'),
        'user' => db_config_value('DB_USER'),
        'password' => db_config_value('DB_PASSWORD'),
        'charset' => db_config_value('DB_CHARSET', 'utf8mb4'),
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
