<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/controllers/authController.php';
require_once dirname(__DIR__) . '/middleware/authMiddleware.php';

function handleAuthRoutes(PDO $pdo, string $method, string $subPath): bool
{
    if ($method === 'POST' && $subPath === '/login') {
        authLogin($pdo);
        return true;
    }

    if ($method === 'GET' && $subPath === '/me') {
        $user = protect($pdo);
        authGetMe($pdo, $user);
        return true;
    }

    if ($method === 'POST' && $subPath === '/logout') {
        $user = protect($pdo);
        authLogout($pdo, $user);
        return true;
    }

    if ($method === 'PUT' && $subPath === '/profile') {
        $user = protect($pdo);
        authUpdateProfile($pdo, $user);
        return true;
    }

    if ($method === 'PUT' && $subPath === '/change-password') {
        $user = protect($pdo);
        authChangePassword($pdo, $user);
        return true;
    }

    if ($method === 'POST' && $subPath === '/register') {
        $user = protect($pdo);
        authorize($user, 'Administrator');
        authRegister($pdo, $user);
        return true;
    }

    return false;
}
