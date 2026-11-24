<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/controllers/settingsController.php';
require_once dirname(__DIR__) . '/middleware/authMiddleware.php';

function handleSettingsRoutes(PDO $pdo, string $method, string $subPath): bool
{
    if ($method === 'GET' && ($subPath === '' || $subPath === '/')) {
        $user = protect($pdo);
        getSettings($pdo, $user);
        return true;
    }

    if ($method === 'POST' && $subPath === '/hospital') {
        protect($pdo);
        saveHospitalSettings($pdo);
        return true;
    }

    if ($method === 'POST' && $subPath === '/system') {
        protect($pdo);
        saveSystemSettings($pdo);
        return true;
    }

    return false;
}
