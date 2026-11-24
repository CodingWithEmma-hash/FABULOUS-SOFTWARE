<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers/http.php';

function getDashboard(PDO $pdo, array $authUser): void
{
    try {
        $userId = (int) $authUser['id'];

        $totalPatients = (int) $pdo->query("SELECT COUNT(*) FROM patients")->fetchColumn();
        $totalAssessments = (int) $pdo->query("SELECT COUNT(*) FROM assessments")->fetchColumn();
        $clinicalAlertsCount = (int) $pdo->query("
            SELECT COUNT(*)
            FROM assessments
            WHERE status IN (
                'Clinical Review Required',
                'Prompt Clinical Review Required'
            )
        ")->fetchColumn();
        $activeStaff = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active'")->fetchColumn();

        $notifStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM notifications
            WHERE recipient_id = ? AND is_read = 0
        ");
        $notifStmt->execute([$userId]);
        $unreadNotifications = (int) $notifStmt->fetchColumn();

        $recentActivities = $pdo->query("
            SELECT
                a.id,
                a.action,
                a.description,
                a.created_at,
                u.full_name AS staff_name
            FROM activity_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 5
        ")->fetchAll();

        $recentPatients = $pdo->query("
            SELECT
                id,
                patient_id,
                full_name,
                gender,
                created_at
            FROM patients
            ORDER BY created_at DESC
            LIMIT 5
        ")->fetchAll();

        $clinicalAlerts = $pdo->query("
            SELECT
                a.id,
                a.assessment_code,
                a.status,
                a.assessment_date,
                p.full_name AS patient_name,
                p.patient_id
            FROM assessments a
            LEFT JOIN patients p ON a.patient_id = p.id
            WHERE a.status IN (
                'Clinical Review Required',
                'Prompt Clinical Review Required'
            )
            ORDER BY a.assessment_date DESC
            LIMIT 5
        ")->fetchAll();

        jsonResponse([
            'success' => true,
            'message' => 'Dashboard data retrieved successfully.',
            'stats' => [
                'totalPatients' => $totalPatients,
                'totalAssessments' => $totalAssessments,
                'clinicalAlerts' => $clinicalAlertsCount,
                'activeStaff' => $activeStaff,
                'unreadNotifications' => $unreadNotifications,
            ],
            'recentActivities' => $recentActivities,
            'recentPatients' => $recentPatients,
            'clinicalAlerts' => $clinicalAlerts,
        ], 200);
    } catch (Throwable $e) {
        error_log('Dashboard data error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve dashboard information.',
        ], 500);
    }
}
