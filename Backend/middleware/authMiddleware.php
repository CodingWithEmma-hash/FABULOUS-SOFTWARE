<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/env.php';
require_once dirname(__DIR__) . '/helpers/http.php';
require_once dirname(__DIR__) . '/helpers/jwt.php';

/**
 * Verify Bearer JWT and return the active user row, or terminate with 401/500 JSON.
 */
function protect(PDO $pdo): array
{
    try {
        $token = getBearerToken();

        if ($token === null) {
            jsonResponse([
                'success' => false,
                'message' => 'Authentication required. Please log in.',
            ], 401);
        }

        $secret = envValue('JWT_SECRET');
        if (!$secret) {
            jsonResponse([
                'success' => false,
                'message' => 'Authentication configuration error.',
            ], 500);
        }

        $decoded = jwtDecode($token, $secret);
        $userId = $decoded['id'] ?? null;

        if (!$userId) {
            jsonResponse([
                'success' => false,
                'message' => 'Invalid or expired login token.',
            ], 401);
        }

        $stmt = $pdo->prepare("
            SELECT id, staff_id, full_name, email,
                   username, role, status
            FROM users
            WHERE id = ?
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || $user['status'] !== 'active') {
            jsonResponse([
                'success' => false,
                'message' => 'Your account is unavailable. Please log in again.',
            ], 401);
        }

        return $user;
    } catch (JwtExpiredException | JwtInvalidException $e) {
        jsonResponse([
            'success' => false,
            'message' => 'Invalid or expired login token.',
        ], 401);
    } catch (Throwable $e) {
        error_log('Authentication error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Authentication failed.',
        ], 500);
    }
}

/**
 * Enforce role-based authorization, returning 403 JSON if unauthorized.
 */
function authorize(array $user, string ...$roles): void
{
    if (!in_array($user['role'] ?? '', $roles, true)) {
        jsonResponse([
            'success' => false,
            'message' => 'You do not have permission to perform this action.',
        ], 403);
    }
}
