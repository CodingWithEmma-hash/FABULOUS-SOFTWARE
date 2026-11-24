<?php

declare(strict_types=1);

/**
 * Load key=value pairs from Backend/.env into $_ENV and putenv().
 */
function loadEnv(?string $path = null): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $envPath = $path ?? dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
    if (!is_file($envPath) || !is_readable($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if (str_starts_with($trimmed, 'export ')) {
            $trimmed = trim(substr($trimmed, 7));
        }

        $eqPos = strpos($trimmed, '=');
        if ($eqPos === false) {
            continue;
        }

        $key = trim(substr($trimmed, 0, $eqPos));
        $value = trim(substr($trimmed, $eqPos + 1));

        if ($key === '') {
            continue;
        }

        $len = strlen($value);
        if ($len >= 2 && (
            ($value[0] === '"' && $value[$len - 1] === '"') ||
            ($value[0] === "'" && $value[$len - 1] === "'")
        )) {
            $value = substr($value, 1, -1);
        } else {
            // Strip inline comments for unquoted values (matching dotenv behavior).
            $hashPos = strpos($value, ' #');
            if ($hashPos !== false) {
                $value = rtrim(substr($value, 0, $hashPos));
            }
        }

        if (getenv($key) === false && !array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
            putenv("{$key}={$value}");
        }
    }
}

function envValue(string $key, ?string $default = null): ?string
{
    loadEnv();
    if (array_key_exists($key, $_ENV)) {
        return (string) $_ENV[$key];
    }
    $val = getenv($key);
    return $val !== false ? (string) $val : $default;
}
