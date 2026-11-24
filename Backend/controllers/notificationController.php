<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers/http.php';

function formatNotification(array $n): array
{
    $idNum = (int) $n['id'];
    return [
        'id' => 'NOT' . str_pad((string) $idNum, 3, '0', STR_PAD_LEFT),
        'dbId' => $idNum,
        'title' => $n['title'],
        'message' => $n['message'],
        'type' => $n['type'] ?: 'system',
        'priority' => $n['priority'] ?: 'low',
        'read' => (bool) $n['is_read'],
        'isRead' => (bool) $n['is_read'],
        'createdAt' => $n['created_at'],
    ];
}

// GET NOTIFICATIONS
function getNotifications(PDO $pdo): void
{
    try {
        $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
        $type = isset($_GET['type']) ? trim((string) $_GET['type']) : '';
        $priority = isset($_GET['priority']) ? trim((string) $_GET['priority']) : '';
        $status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';

        $query = "
            SELECT id, title, message, type, priority, is_read, created_at
            FROM notifications
            WHERE 1=1
        ";
        $params = [];

        if ($search !== '') {
            $query .= " AND (title LIKE ? OR message LIKE ?)";
            $term = "%{$search}%";
            $params[] = $term;
            $params[] = $term;
        }

        if ($type !== '' && strtolower($type) !== 'all') {
            $query .= " AND type = ?";
            $params[] = strtolower($type);
        }

        if ($priority !== '' && strtolower($priority) !== 'all') {
            $query .= " AND priority = ?";
            $params[] = strtolower($priority);
        }

        if ($status !== '' && strtolower($status) !== 'all') {
            if (strtolower($status) === 'unread') {
                $query .= " AND is_read = 0";
            } elseif (strtolower($status) === 'read') {
                $query .= " AND is_read = 1";
            }
        }

        $query .= " ORDER BY created_at DESC LIMIT 50";

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $notifications = array_map('formatNotification', $rows);

        $statsRow = $pdo->query("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
                SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) AS highPriority,
                SUM(CASE WHEN type = 'system' THEN 1 ELSE 0 END) AS systemUpdates
            FROM notifications
        ")->fetch();

        jsonResponse([
            'success' => true,
            'notifications' => $notifications,
            'stats' => [
                'total' => (int) ($statsRow['total'] ?? 0),
                'unread' => (int) ($statsRow['unread'] ?? 0),
                'highPriority' => (int) ($statsRow['highPriority'] ?? 0),
                'systemUpdates' => (int) ($statsRow['systemUpdates'] ?? 0),
            ],
        ], 200);
    } catch (Throwable $e) {
        error_log('Get notifications error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve notifications.',
        ], 500);
    }
}

// GET UNREAD COUNT
function getUnreadCount(PDO $pdo): void
{
    try {
        $unread = (int) $pdo->query("SELECT COUNT(*) FROM notifications WHERE is_read = 0")->fetchColumn();
        jsonResponse([
            'success' => true,
            'unread' => $unread,
        ], 200);
    } catch (Throwable $e) {
        jsonResponse([
            'success' => true,
            'unread' => 0,
        ], 200);
    }
}

// MARK AS READ
function markNotificationAsRead(PDO $pdo, string $id): void
{
    try {
        $numericId = preg_replace('/^NOT/i', '', $id);
        $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ?");
        $stmt->execute([$numericId]);

        jsonResponse([
            'success' => true,
            'message' => 'Notification marked as read.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Mark notification read error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to update notification.',
        ], 500);
    }
}

// MARK ALL AS READ
function markAllNotificationsAsRead(PDO $pdo): void
{
    try {
        $pdo->exec("UPDATE notifications SET is_read = 1 WHERE is_read = 0");

        jsonResponse([
            'success' => true,
            'message' => 'All notifications marked as read.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Mark all notifications read error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to update notifications.',
        ], 500);
    }
}

// DELETE NOTIFICATION
function deleteNotification(PDO $pdo, string $id): void
{
    try {
        $numericId = preg_replace('/^NOT/i', '', $id);
        $stmt = $pdo->prepare("DELETE FROM notifications WHERE id = ?");
        $stmt->execute([$numericId]);

        jsonResponse([
            'success' => true,
            'message' => 'Notification deleted.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Delete notification error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to delete notification.',
        ], 500);
    }
}
