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

        // Build the Patient activity chart from live table records.
        $weekStart = (new DateTimeImmutable('monday this week'))->setTime(0, 0, 0);
        $weekEnd = $weekStart->modify('+7 days');

        $visitStmt = $pdo->prepare("
            SELECT assessment_date AS activity_date, COUNT(*) AS total
            FROM assessments
            WHERE assessment_date >= ? AND assessment_date < ?
            GROUP BY assessment_date
        ");
        $visitStmt->execute([$weekStart->format('Y-m-d'), $weekEnd->format('Y-m-d')]);
        $visitsByDate = [];
        foreach ($visitStmt->fetchAll() as $row) {
            $visitsByDate[$row['activity_date']] = (int) $row['total'];
        }

        $admissionStmt = $pdo->prepare("
            SELECT DATE(created_at) AS activity_date, COUNT(*) AS total
            FROM patients
            WHERE created_at >= ? AND created_at < ?
            GROUP BY DATE(created_at)
        ");
        $admissionStmt->execute([
            $weekStart->format('Y-m-d 00:00:00'),
            $weekEnd->format('Y-m-d 00:00:00'),
        ]);
        $admissionsByDate = [];
        foreach ($admissionStmt->fetchAll() as $row) {
            $admissionsByDate[$row['activity_date']] = (int) $row['total'];
        }

        $patientActivity = [];
        $labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        for ($day = 0; $day < 7; $day++) {
            $date = $weekStart->modify("+{$day} days");
            $dateKey = $date->format('Y-m-d');
            $patientActivity[] = [
                'label' => $labels[$day],
                'visits' => $visitsByDate[$dateKey] ?? 0,
                'admissions' => $admissionsByDate[$dateKey] ?? 0,
            ];
        }

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
            'patientActivity' => $patientActivity,
        ], 200);
    } catch (Throwable $e) {
        error_log('Dashboard data error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve dashboard information.',
        ], 500);
    }
}
