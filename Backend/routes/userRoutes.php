<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/controllers/userController.php';
require_once dirname(__DIR__) . '/middleware/authMiddleware.php';

function handleUserRoutes(PDO $pdo, string $method, string $subPath): bool
{
    if ($subPath === '' || $subPath === '/') {
        if ($method === 'GET') {
            protect($pdo);
            getUsers($pdo);
            return true;
        }

        if ($method === 'POST') {
            $user = protect($pdo);
            authorize($user, 'Administrator');
            createUser($pdo, $user);
            return true;
        }
    }

    if ($method === 'PATCH' && preg_match('#^/([^/]+)/status$#', $subPath, $matches)) {
        $id = rawurldecode($matches[1]);
        $user = protect($pdo);
        authorize($user, 'Administrator');
        toggleUserStatus($pdo, $id, $user);
        return true;
    }

    if (preg_match('#^/([^/]+)$#', $subPath, $matches)) {
        $id = rawurldecode($matches[1]);

        if ($method === 'PUT') {
            $user = protect($pdo);
            authorize($user, 'Administrator');
            updateUser($pdo, $id, $user);
            return true;
        }

        if ($method === 'DELETE') {
            $user = protect($pdo);
            authorize($user, 'Administrator');
            deleteUser($pdo, $id, $user);
            return true;
        }
    }

    return false;
}
