<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/env.php';
require_once dirname(__DIR__) . '/helpers/http.php';
require_once dirname(__DIR__) . '/helpers/jwt.php';

const ALLOWED_STAFF_ROLES = [
    'Administrator',
    'Doctor',
    'Pharmacist',
    'Nurse',
    'Staff',
];

function generateAuthToken(array $user): string
{
    $secret = envValue('JWT_SECRET');
    if (!$secret) {
        throw new RuntimeException('JWT_SECRET is not configured.');
    }

    return jwtEncode([
        'id' => (int) $user['id'],
        'role' => $user['role'],
    ], $secret, 8 * 3600);
}

function publicUser(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'staffId' => $user['staff_id'],
        'fullName' => $user['full_name'],
        'email' => $user['email'],
        'phone' => $user['phone'] ?? null,
        'username' => $user['username'],
        'role' => $user['role'],
        'status' => $user['status'],
    ];
}

// STAFF LOGIN
function authLogin(PDO $pdo): void
{
    try {
        $body = getJsonBody();
        $identifier = isset($body['identifier']) ? trim((string) $body['identifier']) : '';
        $password = isset($body['password']) ? (string) $body['password'] : '';

        if ($identifier === '' || $password === '') {
            jsonResponse([
                'success' => false,
                'message' => 'Username/email and password are required.',
            ], 400);
        }

        $stmt = $pdo->prepare("
            SELECT * FROM users
            WHERE username = ?
               OR email = ?
               OR staff_id = ?
            LIMIT 1
        ");
        $stmt->execute([$identifier, $identifier, $identifier]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse([
                'success' => false,
                'message' => 'Invalid login credentials.',
            ], 401);
        }

        if ($user['status'] !== 'active') {
            jsonResponse([
                'success' => false,
                'message' => 'This account is inactive. Contact an administrator.',
            ], 403);
        }

        if (!password_verify($password, $user['password_hash'])) {
            jsonResponse([
                'success' => false,
                'message' => 'Invalid login credentials.',
            ], 401);
        }

        $token = generateAuthToken($user);

        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (user_id, action, description)
            VALUES (?, ?, ?)
        ");
        $logStmt->execute([(int) $user['id'], 'LOGIN', 'User logged in successfully.']);

        jsonResponse([
            'success' => true,
            'message' => 'Login successful.',
            'token' => $token,
            'user' => publicUser($user),
        ], 200);
    } catch (Throwable $e) {
        error_log('Login error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to complete login.',
        ], 500);
    }
}

// REGISTER STAFF
function authRegister(PDO $pdo, array $authUser): void
{
    try {
        $body = getJsonBody();
        $staffId = trim((string) ($body['staffId'] ?? ''));
        $fullName = trim((string) ($body['fullName'] ?? ''));
        $email = trim((string) ($body['email'] ?? ''));
        $phone = isset($body['phone']) && trim((string) $body['phone']) !== '' ? trim((string) $body['phone']) : null;
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $role = trim((string) ($body['role'] ?? ''));

        if ($staffId === '' || $fullName === '' || $email === '' || $username === '' || $password === '' || $role === '') {
            jsonResponse([
                'success' => false,
                'message' => 'Please complete all required fields.',
            ], 400);
        }

        if (strlen($password) < 8) {
            jsonResponse([
                'success' => false,
                'message' => 'Password must contain at least 8 characters.',
            ], 400);
        }

        if (!in_array($role, ALLOWED_STAFF_ROLES, true)) {
            jsonResponse([
                'success' => false,
                'message' => 'Invalid staff role.',
            ], 400);
        }

        $normalizedEmail = strtolower($email);

        $checkStmt = $pdo->prepare("
            SELECT id FROM users
            WHERE email = ? OR username = ? OR staff_id = ?
            LIMIT 1
        ");
        $checkStmt->execute([$normalizedEmail, $username, $staffId]);

        if ($checkStmt->fetch()) {
            jsonResponse([
                'success' => false,
                'message' => 'Email, username or staff ID already exists.',
            ], 409);
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        $insertStmt = $pdo->prepare("
            INSERT INTO users (staff_id, full_name, email, phone, username, password_hash, role)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $insertStmt->execute([
            $staffId,
            $fullName,
            $normalizedEmail,
            $phone,
            $username,
            $passwordHash,
            $role,
        ]);

        $newUserId = (int) $pdo->lastInsertId();

        if (!empty($authUser['id'])) {
            $logStmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, description)
                VALUES (?, ?, ?)
            ");
            $logStmt->execute([
                (int) $authUser['id'],
                'STAFF_REGISTRATION',
                "Created staff account {$staffId}.",
            ]);
        }

        jsonResponse([
            'success' => true,
            'message' => 'Staff account created successfully.',
            'userId' => $newUserId,
        ], 201);
    } catch (Throwable $e) {
        error_log('Staff registration error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to register staff account.',
        ], 500);
    }
}

// GET LOGGED-IN USER
function authGetMe(PDO $pdo, array $authUser): void
{
    try {
        $stmt = $pdo->prepare("
            SELECT id, staff_id, full_name, email, phone,
                   username, role, status
            FROM users
            WHERE id = ?
            LIMIT 1
        ");
        $stmt->execute([(int) $authUser['id']]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse([
                'success' => false,
                'message' => 'User account not found.',
            ], 404);
        }

        if ($user['status'] !== 'active') {
            jsonResponse([
                'success' => false,
                'message' => 'This account is inactive.',
            ], 403);
        }

        jsonResponse([
            'success' => true,
            'user' => publicUser($user),
        ], 200);
    } catch (Throwable $e) {
        error_log('Get user error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve user information.',
        ], 500);
    }
}

// LOGOUT
function authLogout(PDO $pdo, array $authUser): void
{
    try {
        if (!empty($authUser['id'])) {
            $stmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, description)
                VALUES (?, ?, ?)
            ");
            $stmt->execute([(int) $authUser['id'], 'LOGOUT', 'User logged out.']);
        }

        jsonResponse([
            'success' => true,
            'message' => 'Logout recorded. Please clear the token in your browser.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Logout error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to record logout.',
        ], 500);
    }
}

// UPDATE PROFILE
function authUpdateProfile(PDO $pdo, array $authUser): void
{
    try {
        $body = getJsonBody();
        $fullName = trim((string) ($body['fullName'] ?? ''));
        $email = trim((string) ($body['email'] ?? ''));
        $username = trim((string) ($body['username'] ?? ''));

        if ($fullName === '' || $email === '' || $username === '') {
            jsonResponse([
                'success' => false,
                'message' => 'Full name, email, and username are required.',
            ], 400);
        }

        $normalizedEmail = strtolower($email);

        $conflictStmt = $pdo->prepare("
            SELECT id FROM users
            WHERE (email = ? OR username = ?) AND id != ?
            LIMIT 1
        ");
        $conflictStmt->execute([$normalizedEmail, $username, (int) $authUser['id']]);

        if ($conflictStmt->fetch()) {
            jsonResponse([
                'success' => false,
                'message' => 'Email or username is already taken by another account.',
            ], 409);
        }

        $updateStmt = $pdo->prepare("
            UPDATE users
            SET full_name = ?, email = ?, username = ?
            WHERE id = ?
        ");
        $updateStmt->execute([$fullName, $normalizedEmail, $username, (int) $authUser['id']]);

        $fetchStmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
        $fetchStmt->execute([(int) $authUser['id']]);
        $updated = $fetchStmt->fetch();

        jsonResponse([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'user' => publicUser($updated),
        ], 200);
    } catch (Throwable $e) {
        error_log('Update profile error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to update profile.',
        ], 500);
    }
}

// CHANGE PASSWORD
function authChangePassword(PDO $pdo, array $authUser): void
{
    try {
        $body = getJsonBody();
        $currentPassword = (string) ($body['currentPassword'] ?? '');
        $newPassword = (string) ($body['newPassword'] ?? '');

        if ($currentPassword === '' || $newPassword === '') {
            jsonResponse([
                'success' => false,
                'message' => 'Current password and new password are required.',
            ], 400);
        }

        if (strlen($newPassword) < 8) {
            jsonResponse([
                'success' => false,
                'message' => 'New password must be at least 8 characters.',
            ], 400);
        }

        $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([(int) $authUser['id']]);
        $row = $stmt->fetch();

        if (!$row) {
            jsonResponse([
                'success' => false,
                'message' => 'User account not found.',
            ], 404);
        }

        if (!password_verify($currentPassword, $row['password_hash'])) {
            jsonResponse([
                'success' => false,
                'message' => 'Current password does not match our records.',
            ], 400);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

        $updateStmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $updateStmt->execute([$passwordHash, (int) $authUser['id']]);

        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (user_id, action, description)
            VALUES (?, ?, ?)
        ");
        $logStmt->execute([
            (int) $authUser['id'],
            'PASSWORD_CHANGED',
            'User changed account password.',
        ]);

        jsonResponse([
            'success' => true,
            'message' => 'Password changed successfully.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Change password error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to change password.',
        ], 500);
    }
}
