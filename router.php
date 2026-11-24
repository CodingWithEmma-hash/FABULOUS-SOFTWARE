<?php

declare(strict_types=1);

/**
 * Router script for running the entire project (Frontend + Backend) with PHP's built-in server:
 *   php -S localhost:8000 router.php
 */
$uriPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');

// Route /Backend/* and /api/* requests to Backend/index.php
if (
    $uriPath === '/Backend' ||
    str_starts_with($uriPath, '/Backend/') ||
    $uriPath === '/api' ||
    str_starts_with($uriPath, '/api/')
) {
    // Block direct access to dotfiles like Backend/.env
    if (preg_match('#/\.#', $uriPath)) {
        http_response_code(403);
        echo 'Forbidden';
        exit;
    }

    require __DIR__ . '/Backend/index.php';
    exit;
}

// Serve static files from project root / Frontend
$fullPath = realpath(__DIR__ . $uriPath);
if ($fullPath !== false && str_starts_with($fullPath, __DIR__) && is_file($fullPath)) {
    return false;
}

if ($uriPath === '/' || $uriPath === '') {
    header('Location: /Frontend/index.html', true, 302);
    exit;
}

http_response_code(404);
echo 'Not Found';
