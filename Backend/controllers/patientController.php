<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers/http.php';

function generatePatientId(): string
{
    $year = date('Y');
    $randomCode = strtoupper(bin2hex(random_bytes(4)));
    return "PAT-{$year}-{$randomCode}";
}

function formatPatient(array $p): array
{
    $formattedDob = '';
    if (!empty($p['date_of_birth'])) {
        $formattedDob = explode('T', (string) $p['date_of_birth'])[0];
        $formattedDob = explode(' ', $formattedDob)[0];
    }

    return [
        'id' => (int) $p['id'],
        'patientId' => $p['patient_id'],
        'fullName' => $p['full_name'],
        'name' => $p['full_name'],
        'dob' => $formattedDob,
        'dateOfBirth' => $formattedDob,
        'gender' => $p['gender'],
        'phone' => $p['phone'],
        'email' => $p['email'] ?? '',
        'address' => $p['residential_address'],
        'residentialAddress' => $p['residential_address'],
        'emergencyName' => $p['contact_person'],
        'contactPerson' => $p['contact_person'],
        'relationship' => $p['relationship'],
        'emergencyPhone' => $p['emergency_phone'],
        'bloodGroup' => !empty($p['blood_group']) ? $p['blood_group'] : 'Unknown',
        'genotype' => !empty($p['genotype']) ? $p['genotype'] : 'Unknown',
        'allergies' => !empty($p['allergies']) ? $p['allergies'] : 'None',
        'medicalHistory' => !empty($p['medical_history']) ? $p['medical_history'] : 'None',
        'createdAt' => $p['created_at'],
    ];
}

// REGISTER NEW PATIENT
function registerPatient(PDO $pdo, array $authUser): void
{
    try {
        $body = getJsonBody();
        $fullName = trim((string) ($body['fullName'] ?? ''));
        $dob = trim((string) ($body['dob'] ?? ''));
        $gender = trim((string) ($body['gender'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));
        $emailRaw = isset($body['email']) ? trim((string) $body['email']) : '';
        $address = trim((string) ($body['address'] ?? ''));
        $emergencyName = trim((string) ($body['emergencyName'] ?? ''));
        $relationship = trim((string) ($body['relationship'] ?? ''));
        $emergencyPhone = trim((string) ($body['emergencyPhone'] ?? ''));
        $bloodGroup = isset($body['bloodGroup']) && trim((string) $body['bloodGroup']) !== '' ? trim((string) $body['bloodGroup']) : null;
        $genotype = isset($body['genotype']) && trim((string) $body['genotype']) !== '' ? trim((string) $body['genotype']) : null;
        $allergies = isset($body['allergies']) && trim((string) $body['allergies']) !== '' ? trim((string) $body['allergies']) : null;
        $medicalHistory = isset($body['medicalHistory']) && trim((string) $body['medicalHistory']) !== '' ? trim((string) $body['medicalHistory']) : null;

        if (
            $fullName === '' ||
            $dob === '' ||
            $gender === '' ||
            $phone === '' ||
            $address === '' ||
            $emergencyName === '' ||
            $relationship === '' ||
            $emergencyPhone === ''
        ) {
            jsonResponse([
                'success' => false,
                'message' => 'Please complete all required patient information.',
            ], 400);
        }

        if (!in_array($gender, ['Male', 'Female', 'Other'], true)) {
            jsonResponse([
                'success' => false,
                'message' => 'Invalid gender selection.',
            ], 400);
        }

        $dt = DateTimeImmutable::createFromFormat('Y-m-d', $dob);
        $today = date('Y-m-d');
        if (!$dt || $dt->format('Y-m-d') !== $dob || $dob > $today) {
            jsonResponse([
                'success' => false,
                'message' => 'Please provide a valid date of birth.',
            ], 400);
        }

        $phonePattern = '/^[0-9+\-\s()]{7,20}$/';
        if (!preg_match($phonePattern, $phone) || !preg_match($phonePattern, $emergencyPhone)) {
            jsonResponse([
                'success' => false,
                'message' => 'Please provide valid phone numbers.',
            ], 400);
        }

        $normalizedEmail = $emailRaw !== '' ? strtolower($emailRaw) : null;
        if ($normalizedEmail !== null && !filter_var($normalizedEmail, FILTER_VALIDATE_EMAIL)) {
            jsonResponse([
                'success' => false,
                'message' => 'Please provide a valid email address.',
            ], 400);
        }

        $patientId = generatePatientId();

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            INSERT INTO patients (
                patient_id,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                residential_address,
                contact_person,
                relationship,
                emergency_phone,
                blood_group,
                genotype,
                allergies,
                medical_history,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $patientId,
            $fullName,
            $dob,
            $gender,
            $phone,
            $normalizedEmail,
            $address,
            $emergencyName,
            $relationship,
            $emergencyPhone,
            $bloodGroup,
            $genotype,
            $allergies,
            $medicalHistory,
            !empty($authUser['id']) ? (int) $authUser['id'] : null,
        ]);

        $insertId = (int) $pdo->lastInsertId();

        if (!empty($authUser['id'])) {
            $logStmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, description)
                VALUES (?, ?, ?)
            ");
            $logStmt->execute([
                (int) $authUser['id'],
                'PATIENT_REGISTRATION',
                "Registered patient {$patientId} - {$fullName}.",
            ]);
        }

        $notifStmt = $pdo->prepare("
            INSERT INTO notifications (recipient_id, title, message, type, priority)
            VALUES (?, ?, ?, 'patient', 'medium')
        ");
        $notifStmt->execute([
            !empty($authUser['id']) ? (int) $authUser['id'] : null,
            'New Patient Registered',
            "Patient {$fullName} ({$patientId}) has been registered.",
        ]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => 'Patient registered successfully.',
            'patient' => [
                'id' => $insertId,
                'patientId' => $patientId,
                'fullName' => $fullName,
                'gender' => $gender,
                'phone' => $phone,
            ],
        ], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Patient registration error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to register patient. Please try again.',
        ], 500);
    }
}

// GET ALL PATIENTS
function getPatients(PDO $pdo): void
{
    try {
        $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
        $gender = isset($_GET['gender']) ? trim((string) $_GET['gender']) : '';

        $query = "
            SELECT id, patient_id, full_name, date_of_birth, gender, phone, email,
                   residential_address, contact_person, relationship, emergency_phone,
                   blood_group, genotype, allergies, medical_history, created_at
            FROM patients
            WHERE 1=1
        ";
        $params = [];

        if ($search !== '') {
            $query .= " AND (full_name LIKE ? OR patient_id LIKE ? OR phone LIKE ?)";
            $term = "%{$search}%";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        if ($gender !== '' && strtolower($gender) !== 'all') {
            $query .= " AND gender = ?";
            $params[] = $gender;
        }

        $query .= " ORDER BY created_at DESC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $patients = array_map('formatPatient', $rows);

        $statsRow = $pdo->query("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) AS male,
                SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) AS female,
                SUM(CASE WHEN gender NOT IN ('Male', 'Female') THEN 1 ELSE 0 END) AS other
            FROM patients
        ")->fetch();

        jsonResponse([
            'success' => true,
            'patients' => $patients,
            'stats' => [
                'total' => (int) ($statsRow['total'] ?? 0),
                'male' => (int) ($statsRow['male'] ?? 0),
                'female' => (int) ($statsRow['female'] ?? 0),
                'other' => (int) ($statsRow['other'] ?? 0),
            ],
        ], 200);
    } catch (Throwable $e) {
        error_log('Get patients error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve patient records.',
        ], 500);
    }
}

// GET SINGLE PATIENT BY ID
function getPatientById(PDO $pdo, string $id): void
{
    try {
        $stmt = $pdo->prepare("SELECT * FROM patients WHERE id = ? OR patient_id = ? LIMIT 1");
        $stmt->execute([$id, $id]);
        $row = $stmt->fetch();

        if (!$row) {
            jsonResponse([
                'success' => false,
                'message' => 'Patient record not found.',
            ], 404);
        }

        jsonResponse([
            'success' => true,
            'patient' => formatPatient($row),
        ], 200);
    } catch (Throwable $e) {
        error_log('Get patient error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve patient information.',
        ], 500);
    }
}

// UPDATE PATIENT
function updatePatient(PDO $pdo, string $id, array $authUser): void
{
    try {
        $body = getJsonBody();
        $patientName = trim((string) ($body['fullName'] ?? $body['name'] ?? ''));
        $gender = trim((string) ($body['gender'] ?? ''));
        $patientPhone = trim((string) ($body['phone'] ?? ''));
        $patientDob = trim((string) ($body['dob'] ?? $body['dateOfBirth'] ?? ''));
        $email = isset($body['email']) && trim((string) $body['email']) !== '' ? trim((string) $body['email']) : null;
        $patientAddress = trim((string) ($body['address'] ?? $body['residentialAddress'] ?? ''));

        if ($patientName === '' || $gender === '' || $patientPhone === '' || $patientDob === '') {
            jsonResponse([
                'success' => false,
                'message' => 'Name, gender, phone, and date of birth are required.',
            ], 400);
        }

        $stmt = $pdo->prepare("
            UPDATE patients
            SET full_name = ?,
                gender = ?,
                phone = ?,
                date_of_birth = ?,
                email = ?,
                residential_address = ?
            WHERE id = ? OR patient_id = ?
        ");
        $stmt->execute([
            $patientName,
            $gender,
            $patientPhone,
            $patientDob,
            $email,
            $patientAddress !== '' ? $patientAddress : null,
            $id,
            $id,
        ]);

        if ($stmt->rowCount() === 0) {
            jsonResponse([
                'success' => false,
                'message' => 'Patient not found or no changes made.',
            ], 404);
        }

        if (!empty($authUser['id'])) {
            $logStmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, description)
                VALUES (?, ?, ?)
            ");
            $logStmt->execute([
                (int) $authUser['id'],
                'PATIENT_UPDATED',
                "Updated record for patient {$patientName}.",
            ]);
        }

        jsonResponse([
            'success' => true,
            'message' => 'Patient record updated successfully.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Update patient error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to update patient record.',
        ], 500);
    }
}

// DELETE PATIENT
function deletePatient(PDO $pdo, string $id, array $authUser): void
{
    try {
        $checkStmt = $pdo->prepare("
            SELECT patient_id, full_name FROM patients WHERE id = ? OR patient_id = ? LIMIT 1
        ");
        $checkStmt->execute([$id, $id]);
        $existing = $checkStmt->fetch();

        if (!$existing) {
            jsonResponse([
                'success' => false,
                'message' => 'Patient record not found.',
            ], 404);
        }

        $delStmt = $pdo->prepare("DELETE FROM patients WHERE id = ? OR patient_id = ?");
        $delStmt->execute([$id, $id]);

        if (!empty($authUser['id'])) {
            $logStmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, description)
                VALUES (?, ?, ?)
            ");
            $logStmt->execute([
                (int) $authUser['id'],
                'PATIENT_DELETED',
                "Deleted patient record {$existing['patient_id']} ({$existing['full_name']}).",
            ]);
        }

        jsonResponse([
            'success' => true,
            'message' => 'Patient record deleted successfully.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Delete patient error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to delete patient record.',
        ], 500);
    }
}
