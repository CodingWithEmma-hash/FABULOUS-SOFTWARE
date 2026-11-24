<?php

declare(strict_types=1);

/**
 * Send CORS and security headers matching the Express API setup.
 */
function sendCorsHeaders(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header('Access-Control-Allow-Origin: ' . ($origin !== '' ? $origin : '*'));
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('X-Content-Type-Options: nosniff');
    header('Content-Type: application/json; charset=utf-8');

    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/**
 * Send a JSON response with the given HTTP status code and terminate.
 */
function jsonResponse(array $payload, int $statusCode = 200): never
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Parse JSON request body (or form-encoded POST data as fallback).
 */
function getJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw !== false && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    if (!empty($_POST)) {
        return $_POST;
    }

    return [];
}

/**
 * Extract the Authorization Bearer token across Apache, CGI/FastCGI, and PHP built-in server.
 */
function getBearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? null;

    if ($header === null && function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $key => $value) {
                if (strcasecmp((string) $key, 'Authorization') === 0) {
                    $header = (string) $value;
                    break;
                }
            }
        }
    }

    if (!$header || !str_starts_with($header, 'Bearer ')) {
        return null;
    }

    $token = trim(substr($header, 7));
    return $token !== '' ? $token : null;
}

function getClientIp(): ?string
{
    return $_SERVER['REMOTE_ADDR'] ?? null;
}
