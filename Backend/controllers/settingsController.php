<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers/http.php';

// GET SETTINGS
function getSettings(PDO $pdo, ?array $authUser): void
{
    try {
        $stmt = $pdo->query("SELECT * FROM hospital_settings WHERE id = 1 LIMIT 1");
        $settings = $stmt->fetch() ?: [];

        $account = $authUser ? [
            'fullName' => $authUser['full_name'],
            'email' => $authUser['email'],
            'username' => $authUser['username'],
            'staffId' => $authUser['staff_id'],
            'role' => $authUser['role'],
        ] : null;

        jsonResponse([
            'success' => true,
            'hospital' => [
                'name' => $settings['hospital_name'] ?? 'General Hospital, Ikot Ekpene',
                'email' => $settings['hospital_email'] ?? 'info@ghikotekpene.gov.ng',
                'phone' => $settings['hospital_phone'] ?? '+234 803 000 1234',
                'address' => $settings['hospital_address'] ?? '14 Hospital Road',
                'city' => $settings['hospital_city'] ?? 'Ikot Ekpene',
                'state' => $settings['hospital_state'] ?? 'Akwa Ibom',
            ],
            'system' => [
                'systemName' => $settings['system_name'] ?? 'AI-Based Hospital Decision Support System',
                'dateFormat' => $settings['date_format'] ?? 'DD/MM/YYYY',
                'language' => $settings['language'] ?? 'English',
                'timezone' => $settings['timezone'] ?? 'Africa/Lagos',
                'historyEnabled' => ($settings['history_enabled'] ?? 1) != 0,
            ],
            'account' => $account,
        ], 200);
    } catch (Throwable $e) {
        error_log('Get settings error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve settings.',
        ], 500);
    }
}

// SAVE HOSPITAL SETTINGS
function saveHospitalSettings(PDO $pdo): void
{
    try {
        $body = getJsonBody();
        $name = !empty($body['name']) ? (string) $body['name'] : 'General Hospital, Ikot Ekpene';
        $email = !empty($body['email']) ? (string) $body['email'] : 'info@ghikotekpene.gov.ng';
        $phone = !empty($body['phone']) ? (string) $body['phone'] : '+234 803 000 1234';
        $address = (string) ($body['address'] ?? '');
        $city = !empty($body['city']) ? (string) $body['city'] : 'Ikot Ekpene';
        $state = !empty($body['state']) ? (string) $body['state'] : 'Akwa Ibom';

        $stmt = $pdo->prepare("
            INSERT INTO hospital_settings (id, hospital_name, hospital_email, hospital_phone, hospital_address, hospital_city, hospital_state)
            VALUES (1, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                hospital_name = VALUES(hospital_name),
                hospital_email = VALUES(hospital_email),
                hospital_phone = VALUES(hospital_phone),
                hospital_address = VALUES(hospital_address),
                hospital_city = VALUES(hospital_city),
                hospital_state = VALUES(hospital_state)
        ");
        $stmt->execute([$name, $email, $phone, $address, $city, $state]);

        jsonResponse([
            'success' => true,
            'message' => 'Hospital information saved successfully.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Save hospital settings error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to save hospital information.',
        ], 500);
    }
}

// SAVE SYSTEM PREFERENCES
function saveSystemSettings(PDO $pdo): void
{
    try {
        $body = getJsonBody();
        $systemName = !empty($body['systemName']) ? (string) $body['systemName'] : 'AI-Based Hospital Decision Support System';
        $dateFormat = !empty($body['dateFormat']) ? (string) $body['dateFormat'] : 'DD/MM/YYYY';
        $language = !empty($body['language']) ? (string) $body['language'] : 'English';
        $timezone = !empty($body['timezone']) ? (string) $body['timezone'] : 'Africa/Lagos';
        $historyEnabled = !empty($body['historyEnabled']) ? 1 : 0;

        $stmt = $pdo->prepare("
            INSERT INTO hospital_settings (id, system_name, date_format, language, timezone, history_enabled)
            VALUES (1, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                system_name = VALUES(system_name),
                date_format = VALUES(date_format),
                language = VALUES(language),
                timezone = VALUES(timezone),
                history_enabled = VALUES(history_enabled)
        ");
        $stmt->execute([$systemName, $dateFormat, $language, $timezone, $historyEnabled]);

        jsonResponse([
            'success' => true,
            'message' => 'System preferences saved successfully.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Save system settings error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to save system preferences.',
        ], 500);
    }
}
