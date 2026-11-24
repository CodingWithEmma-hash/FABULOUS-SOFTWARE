<?php

declare(strict_types=1);

require_once __DIR__ . '/env.php';

/**
 * Get the shared PDO MySQL connection instance.
 */
function getDbConnection(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    loadEnv();

    $host = envValue('DB_HOST', 'localhost');
    $port = (int) (envValue('DB_PORT', '3306') ?: 3306);
    $dbName = envValue('DB_NAME', 'hospital_dss');
    $user = envValue('DB_USER', 'root');
    $password = envValue('DB_PASSWORD', '');

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $host,
        $port,
        $dbName
    );

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

/**
 * Verify MySQL connectivity (used by CLI scripts).
 */
function testDatabaseConnection(): void
{
    try {
        $pdo = getDbConnection();
        $pdo->query('SELECT 1');
        echo "MySQL database connected successfully!\n";
    } catch (Throwable $e) {
        fwrite(STDERR, 'MySQL connection failed: ' . $e->getMessage() . "\n");
        exit(1);
    }
}
