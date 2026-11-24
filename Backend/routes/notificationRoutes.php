<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/controllers/notificationController.php';
require_once dirname(__DIR__) . '/middleware/authMiddleware.php';

function handleNotificationRoutes(PDO $pdo, string $method, string $subPath): bool
{
    if ($method === 'GET' && ($subPath === '' || $subPath === '/')) {
        protect($pdo);
        getNotifications($pdo);
        return true;
    }

    if ($method === 'GET' && $subPath === '/unread-count') {
        protect($pdo);
        getUnreadCount($pdo);
        return true;
    }

    if ($method === 'POST' && $subPath === '/mark-all-read') {
        protect($pdo);
        markAllNotificationsAsRead($pdo);
        return true;
    }

    if ($method === 'PATCH' && preg_match('#^/([^/]+)/read$#', $subPath, $matches)) {
        $id = rawurldecode($matches[1]);
        protect($pdo);
        markNotificationAsRead($pdo, $id);
        return true;
    }

    if ($method === 'DELETE' && preg_match('#^/([^/]+)$#', $subPath, $matches)) {
        $id = rawurldecode($matches[1]);
        protect($pdo);
        deleteNotification($pdo, $id);
        return true;
    }

    return false;
}
