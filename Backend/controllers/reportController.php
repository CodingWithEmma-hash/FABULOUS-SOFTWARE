<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers/http.php';

function getReportData(PDO $pdo): void
{
    try {
        $startDate = isset($_GET['startDate']) ? trim((string) $_GET['startDate']) : '';
        $endDate = isset($_GET['endDate']) ? trim((string) $_GET['endDate']) : '';

        $patientStats = $pdo->query("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) AS male,
                SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) AS female,
                SUM(CASE WHEN gender NOT IN ('Male', 'Female') THEN 1 ELSE 0 END) AS other
            FROM patients
        ")->fetch();

        $query = "
            SELECT
                a.*,
                p.full_name AS lookup_patient_name,
                p.patient_id AS lookup_patient_code,
                u.full_name AS lookup_clinician_name
            FROM assessments a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN users u ON a.clinician_id = u.id
            WHERE 1=1
        ";
        $params = [];

        if ($startDate !== '') {
            $query .= " AND a.assessment_date >= ?";
            $params[] = $startDate;
        }

        if ($endDate !== '') {
            $query .= " AND a.assessment_date <= ?";
            $params[] = $endDate;
        }

        $query .= " ORDER BY a.assessment_date DESC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $assessmentsRows = $stmt->fetchAll();

        $promptCount = 0;
        $standardCount = 0;
        $assessments = [];

        foreach ($assessmentsRows as $a) {
            $dateStr = '';
            if (!empty($a['assessment_date'])) {
                $dateStr = explode('T', (string) $a['assessment_date'])[0];
                $dateStr = explode(' ', $dateStr)[0];
            }

            $statusVal = $a['status'] ?? 'Clinical Review Required';
            $isPrompt = str_contains($statusVal, 'Prompt');
            if ($isPrompt) {
                $promptCount++;
            } else {
                $standardCount++;
            }

            $assessments[] = [
                'id' => !empty($a['assessment_code']) ? $a['assessment_code'] : 'ASM' . $a['id'],
                'code' => $a['assessment_code'] ?? null,
                'patientId' => !empty($a['patient_code'])
                    ? $a['patient_code']
                    : (!empty($a['lookup_patient_code']) ? $a['lookup_patient_code'] : (string) $a['patient_id']),
                'patientName' => !empty($a['patient_name'])
                    ? $a['patient_name']
                    : (!empty($a['lookup_patient_name']) ? $a['lookup_patient_name'] : 'Unknown Patient'),
                'date' => $dateStr,
                'clinician' => !empty($a['clinician'])
                    ? $a['clinician']
                    : (!empty($a['lookup_clinician_name']) ? $a['lookup_clinician_name'] : 'Staff Clinician'),
                'severity' => !empty($a['severity']) ? $a['severity'] : 'Moderate',
                'status' => $statusVal,
                'observations' => $a['observations'] ?? '',
                'recommendations' => $a['recommendations'] ?? '',
            ];
        }

        jsonResponse([
            'success' => true,
            'summary' => [
                'totalPatients' => (int) ($patientStats['total'] ?? 0),
                'totalAssessments' => count($assessments),
                'clinicalReviews' => $standardCount,
                'promptReviews' => $promptCount,
            ],
            'genderStats' => [
                'male' => (int) ($patientStats['male'] ?? 0),
                'female' => (int) ($patientStats['female'] ?? 0),
                'other' => (int) ($patientStats['other'] ?? 0),
            ],
            'statusStats' => [
                'prompt' => $promptCount,
                'clinical' => $standardCount,
            ],
            'assessments' => $assessments,
        ], 200);
    } catch (Throwable $e) {
        error_log('Report data error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to generate report data.',
        ], 500);
    }
}
