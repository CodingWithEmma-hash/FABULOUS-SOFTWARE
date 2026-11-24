<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers/http.php';
require_once dirname(__DIR__) . '/services/geminiService.php';

function generateAssessmentCode(): string
{
    return 'ASM-' . strtoupper(bin2hex(random_bytes(5)));
}

function numberOrNull(mixed $value): int|float|null
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_numeric($value)) {
        $num = (float) $value;
        return floor($num) === $num && !str_contains((string) $value, '.') ? (int) $value : $num;
    }

    return null;
}

function parseArrayField(mixed $value): array
{
    if ($value === null || $value === '') {
        return [];
    }

    if (is_array($value)) {
        return $value;
    }

    $decoded = json_decode((string) $value, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        return is_array($decoded) ? $decoded : [];
    }

    return [(string) $value];
}

function formatAssessment(array $a): array
{
    return [
        'id' => (int) $a['id'],
        'dbId' => (int) $a['id'],
        'assessmentCode' => $a['assessment_code'],
        'patientId' => $a['patient_code'] ?? $a['patient_id'],
        'patientCode' => $a['patient_code'] ?? null,
        'patientName' => $a['patient_name'] ?? null,
        'gender' => $a['gender'] ?? null,
        'dateOfBirth' => $a['date_of_birth'] ?? null,
        'phone' => $a['patient_phone'] ?? ($a['phone'] ?? null),
        'bloodGroup' => $a['blood_group'] ?? null,
        'genotype' => $a['genotype'] ?? null,
        'date' => $a['assessment_date'],
        'assessmentDate' => $a['assessment_date'],
        'clinician' => $a['clinician_name'] ?? ($a['clinician'] ?? ''),
        'ageGroup' => $a['age_group'],
        'symptoms' => $a['symptoms'],
        'duration' => $a['symptom_duration'] ?? ($a['duration'] ?? null),
        'severity' => $a['severity'],
        'temperature' => $a['temperature'],
        'bloodPressure' => $a['blood_pressure'],
        'pulse' => $a['pulse_rate'] ?? ($a['pulse'] ?? null),
        'respiratoryRate' => $a['respiratory_rate'],
        'oxygen' => $a['oxygen_saturation'] ?? ($a['oxygen'] ?? null),
        'weight' => $a['weight'],
        'medicalHistory' => $a['medical_history'],
        'medications' => $a['medications'],
        'observations' => parseArrayField($a['observations'] ?? null),
        'aiSummary' => $a['ai_summary'] ?? null,
        'recommendations' => parseArrayField($a['recommendations'] ?? null),
        'warningSigns' => parseArrayField($a['warning_signs'] ?? null),
        'aiReviewPriority' => $a['ai_review_priority'] ?? null,
        'status' => $a['status'],
        'reviewNotes' => $a['review_notes'] ?? null,
        'reviewedBy' => $a['reviewed_by'] ?? null,
        'reviewedAt' => $a['reviewed_at'] ?? null,
        'createdAt' => $a['created_at'],
    ];
}

function performSafetyChecks(array $data): array
{
    $alerts = [];

    $temperature = $data['temperature'];
    $pulse = $data['pulse'];
    $respiratoryRate = $data['respiratoryRate'];
    $oxygen = $data['oxygen'];

    if ($temperature !== null && $temperature >= 40) {
        $alerts[] = 'Very high temperature recorded (40°C or above).';
    }

    if ($pulse !== null && ($pulse > 130 || $pulse < 40)) {
        $alerts[] = 'Potentially concerning pulse rate recorded.';
    }

    if ($respiratoryRate !== null && ($respiratoryRate > 30 || $respiratoryRate < 8)) {
        $alerts[] = 'Potentially concerning respiratory rate recorded.';
    }

    if ($oxygen !== null && $oxygen <= 90) {
        $alerts[] = 'Low oxygen saturation recorded (90% or below).';
    }

    if ($temperature !== null && $temperature >= 38 && $temperature < 40) {
        $alerts[] = 'Elevated temperature recorded.';
    }

    if ($oxygen !== null && $oxygen > 90 && $oxygen < 94) {
        $alerts[] = 'Oxygen saturation is below 94%.';
    }

    return $alerts;
}

// CREATE ASSESSMENT
function createAssessment(PDO $pdo, array $authUser): void
{
    if (($authUser['role'] ?? '') === 'Administrator') {
        jsonResponse([
            'success' => false,
            'message' => 'Administrators are not permitted to create or perform clinical AI assessments. Only clinical healthcare staff (Doctors, Nurses) may conduct assessments.',
        ], 403);
    }

    try {
        $body = getJsonBody();
        $patientId = $body['patientId'] ?? null;
        $ageGroup = (string) ($body['ageGroup'] ?? '');
        $symptoms = trim((string) ($body['symptoms'] ?? ''));
        $duration = (string) ($body['duration'] ?? '');
        $severity = (string) ($body['severity'] ?? '');
        $temperature = $body['temperature'] ?? null;
        $bloodPressure = (string) ($body['bloodPressure'] ?? '');
        $pulse = $body['pulse'] ?? null;
        $respiratoryRate = $body['respiratoryRate'] ?? ($body['respiratory'] ?? null);
        $oxygen = $body['oxygen'] ?? null;
        $weight = $body['weight'] ?? null;
        $medicalHistory = (string) ($body['medicalHistory'] ?? '');
        $medications = (string) ($body['medications'] ?? '');
        $assessmentDate = $body['assessmentDate'] ?? null;

        if (!$patientId || $symptoms === '') {
            jsonResponse([
                'success' => false,
                'message' => 'Patient and symptoms are required.',
            ], 400);
        }

        $pdo->beginTransaction();

        $patientStmt = $pdo->prepare("
            SELECT id, patient_id, full_name
            FROM patients
            WHERE id = ? OR patient_id = ?
            LIMIT 1
        ");
        $patientStmt->execute([$patientId, $patientId]);
        $patient = $patientStmt->fetch();

        if (!$patient) {
            $pdo->rollBack();
            jsonResponse([
                'success' => false,
                'message' => 'Patient record not found.',
            ], 404);
        }

        $assessmentData = [
            'patientName' => $patient['full_name'],
            'patientCode' => $patient['patient_id'],
            'ageGroup' => $ageGroup,
            'symptoms' => $symptoms,
            'duration' => $duration,
            'severity' => $severity,
            'temperature' => numberOrNull($temperature),
            'bloodPressure' => $bloodPressure,
            'pulse' => numberOrNull($pulse),
            'respiratoryRate' => numberOrNull($respiratoryRate),
            'oxygen' => numberOrNull($oxygen),
            'weight' => numberOrNull($weight),
            'medicalHistory' => $medicalHistory,
            'medications' => $medications,
        ];

        $safetyAlerts = performSafetyChecks($assessmentData);

        try {
            $aiResult = generateClinicalAssessment($assessmentData);
        } catch (Throwable $aiError) {
            error_log('Gemini assessment error: ' . $aiError->getMessage());
            $pdo->rollBack();
            jsonResponse([
                'success' => false,
                'message' => 'The AI assessment could not be generated. Please try again.',
                'error' => $aiError->getMessage(),
            ], 502);
        }

        $warningSigns = array_values(array_unique(array_merge(
            $safetyAlerts,
            $aiResult['warning_signs']
        )));

        $isUrgent = count($safetyAlerts) > 0 || $aiResult['suggested_review_priority'] === 'Urgent';

        $status = $isUrgent
            ? 'Prompt Clinical Review Required'
            : 'Clinical Review Required';

        $reviewPriority = $isUrgent
            ? 'Urgent'
            : $aiResult['suggested_review_priority'];

        $observations = array_values(array_merge(
            $aiResult['observations'],
            $safetyAlerts
        ));

        $recommendations = $aiResult['recommendations'];
        $assessmentCode = generateAssessmentCode();

        if ($assessmentDate !== null && trim((string) $assessmentDate) !== '') {
            $timestamp = strtotime((string) $assessmentDate);
            if ($timestamp === false) {
                $pdo->rollBack();
                jsonResponse([
                    'success' => false,
                    'message' => 'Invalid assessment date.',
                ], 400);
            }
            $formattedDate = date('Y-m-d', $timestamp);
        } else {
            $formattedDate = date('Y-m-d');
        }

        $insertStmt = $pdo->prepare("
            INSERT INTO assessments (
                assessment_code,
                patient_id,
                clinician_id,
                assessment_date,
                age_group,
                symptoms,
                symptom_duration,
                severity,
                temperature,
                blood_pressure,
                pulse_rate,
                respiratory_rate,
                oxygen_saturation,
                weight,
                medical_history,
                medications,
                observations,
                ai_summary,
                recommendations,
                warning_signs,
                ai_review_priority,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $insertStmt->execute([
            $assessmentCode,
            (int) $patient['id'],
            (int) $authUser['id'],
            $formattedDate,
            $assessmentData['ageGroup'],
            $assessmentData['symptoms'],
            $assessmentData['duration'],
            $assessmentData['severity'],
            $assessmentData['temperature'],
            $assessmentData['bloodPressure'],
            $assessmentData['pulse'],
            $assessmentData['respiratoryRate'],
            $assessmentData['oxygen'],
            $assessmentData['weight'],
            $assessmentData['medicalHistory'],
            $assessmentData['medications'],
            json_encode($observations, JSON_UNESCAPED_UNICODE),
            $aiResult['clinical_summary'],
            json_encode($recommendations, JSON_UNESCAPED_UNICODE),
            json_encode($warningSigns, JSON_UNESCAPED_UNICODE),
            $reviewPriority,
            $status,
        ]);

        $assessmentId = (int) $pdo->lastInsertId();

        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (user_id, action, description, ip_address)
            VALUES (?, ?, ?, ?)
        ");
        $logStmt->execute([
            (int) $authUser['id'],
            'Assessment Created',
            "Assessment {$assessmentCode} created for {$patient['full_name']}.",
            getClientIp(),
        ]);

        $notifStmt = $pdo->prepare("
            INSERT INTO notifications (title, message, type, priority, recipient_id, assessment_id, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $notifStmt->execute([
            'New AI Assessment',
            "An AI-assisted assessment has been generated for {$patient['full_name']}. Clinical review is required.",
            'assessment',
            $isUrgent ? 'high' : 'medium',
            (int) $authUser['id'],
            $assessmentId,
            (int) $patient['id'],
        ]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => 'AI-assisted assessment generated and saved successfully.',
            'assessment' => [
                'id' => $assessmentId,
                'assessmentCode' => $assessmentCode,
                'patientId' => (int) $patient['id'],
                'patientCode' => $patient['patient_id'],
                'patientName' => $patient['full_name'],
                'assessmentDate' => $formattedDate,
                'clinician' => $authUser['full_name'] ?? '',
                'observations' => $observations,
                'aiSummary' => $aiResult['clinical_summary'],
                'recommendations' => $recommendations,
                'warningSigns' => $warningSigns,
                'aiReviewPriority' => $reviewPriority,
                'status' => $status,
                'vitalSigns' => [
                    'temperature' => $assessmentData['temperature'],
                    'bloodPressure' => $assessmentData['bloodPressure'],
                    'pulse' => $assessmentData['pulse'],
                    'respiratoryRate' => $assessmentData['respiratoryRate'],
                    'oxygen' => $assessmentData['oxygen'],
                    'weight' => $assessmentData['weight'],
                ],
            ],
        ], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Create assessment error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to create assessment.',
            'error' => $e->getMessage(),
        ], 500);
    }
}

// GET ALL ASSESSMENTS
function getAssessments(PDO $pdo): void
{
    try {
        $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
        $status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';
        $startDate = isset($_GET['startDate']) ? trim((string) $_GET['startDate']) : '';
        $endDate = isset($_GET['endDate']) ? trim((string) $_GET['endDate']) : '';

        $sql = "
            SELECT
                a.*,
                p.patient_id AS patient_code,
                p.full_name AS patient_name,
                p.gender,
                p.date_of_birth,
                p.phone AS patient_phone,
                p.blood_group,
                p.genotype,
                u.full_name AS clinician_name
            FROM assessments a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN users u ON a.clinician_id = u.id
            WHERE 1 = 1
        ";
        $params = [];

        if ($search !== '') {
            $sql .= " AND (
                a.assessment_code LIKE ?
                OR p.patient_id LIKE ?
                OR p.full_name LIKE ?
                OR a.symptoms LIKE ?
            )";
            $term = "%{$search}%";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        if ($status !== '') {
            $sql .= " AND a.status = ?";
            $params[] = $status;
        }

        if ($startDate !== '') {
            $sql .= " AND DATE(a.assessment_date) >= ?";
            $params[] = $startDate;
        }

        if ($endDate !== '') {
            $sql .= " AND DATE(a.assessment_date) <= ?";
            $params[] = $endDate;
        }

        $sql .= " ORDER BY a.assessment_date DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $statsRow = $pdo->query("
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Pending Review') AS pending,
                SUM(status = 'Clinical Review Required') AS clinicalReview,
                SUM(status = 'Prompt Clinical Review Required') AS urgentReview,
                SUM(status = 'Reviewed') AS reviewed
            FROM assessments
        ")->fetch();

        jsonResponse([
            'success' => true,
            'assessments' => array_map('formatAssessment', $rows),
            'stats' => [
                'total' => (int) ($statsRow['total'] ?? 0),
                'pending' => (int) ($statsRow['pending'] ?? 0),
                'clinicalReview' => (int) ($statsRow['clinicalReview'] ?? 0),
                'urgentReview' => (int) ($statsRow['urgentReview'] ?? 0),
                'reviewed' => (int) ($statsRow['reviewed'] ?? 0),
            ],
        ], 200);
    } catch (Throwable $e) {
        error_log('Get assessments error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve assessments.',
        ], 500);
    }
}

// GET ONE ASSESSMENT
function getAssessmentById(PDO $pdo, string $id): void
{
    try {
        $stmt = $pdo->prepare("
            SELECT
                a.*,
                p.patient_id AS patient_code,
                p.full_name AS patient_name,
                p.gender,
                p.date_of_birth,
                p.phone AS patient_phone,
                p.blood_group,
                p.genotype,
                u.full_name AS clinician_name
            FROM assessments a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN users u ON a.clinician_id = u.id
            WHERE a.id = ? OR a.assessment_code = ?
            LIMIT 1
        ");
        $stmt->execute([$id, $id]);
        $row = $stmt->fetch();

        if (!$row) {
            jsonResponse([
                'success' => false,
                'message' => 'Assessment not found.',
            ], 404);
        }

        jsonResponse([
            'success' => true,
            'assessment' => formatAssessment($row),
        ], 200);
    } catch (Throwable $e) {
        error_log('Get assessment error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve assessment.',
        ], 500);
    }
}

// DELETE ASSESSMENT
function deleteAssessment(PDO $pdo, string $id, array $authUser): void
{
    try {
        $pdo->beginTransaction();

        $findStmt = $pdo->prepare("
            SELECT id, assessment_code
            FROM assessments
            WHERE id = ? OR assessment_code = ?
            LIMIT 1
        ");
        $findStmt->execute([$id, $id]);
        $assessment = $findStmt->fetch();

        if (!$assessment) {
            $pdo->rollBack();
            jsonResponse([
                'success' => false,
                'message' => 'Assessment not found.',
            ], 404);
        }

        $delNotif = $pdo->prepare("DELETE FROM notifications WHERE assessment_id = ?");
        $delNotif->execute([(int) $assessment['id']]);

        $delAsm = $pdo->prepare("DELETE FROM assessments WHERE id = ?");
        $delAsm->execute([(int) $assessment['id']]);

        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (user_id, action, description, ip_address)
            VALUES (?, ?, ?, ?)
        ");
        $logStmt->execute([
            (int) $authUser['id'],
            'Assessment Deleted',
            "Assessment {$assessment['assessment_code']} deleted.",
            getClientIp(),
        ]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => 'Assessment deleted successfully.',
        ], 200);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Delete assessment error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to delete assessment.',
        ], 500);
    }
}
