<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/controllers/reportController.php';
require_once dirname(__DIR__) . '/middleware/authMiddleware.php';

function handleReportRoutes(PDO $pdo, string $method, string $subPath): bool
{
    if ($method === 'GET' && ($subPath === '' || $subPath === '/')) {
        protect($pdo);
        getReportData($pdo);
        return true;
    }

    return false;
}
