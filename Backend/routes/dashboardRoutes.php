<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/controllers/dashboardController.php';
require_once dirname(__DIR__) . '/middleware/authMiddleware.php';

function handleDashboardRoutes(PDO $pdo, string $method, string $subPath): bool
{
    if ($method === 'GET' && ($subPath === '' || $subPath === '/')) {
        $user = protect($pdo);
        getDashboard($pdo, $user);
        return true;
    }

    return false;
}
