<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers/http.php';

function formatUser(array $u): array
{
    return [
        'id' => (int) $u['id'],
        'staffId' => $u['staff_id'],
        'fullName' => $u['full_name'],
        'username' => $u['username'],
        'email' => $u['email'],
        'phone' => $u['phone'] ?? '',
        'role' => $u['role'],
        'status' => $u['status'] === 'active' ? 'Active' : 'Inactive',
        'createdAt' => $u['created_at'],
    ];
}

// GET ALL USERS
function getUsers(PDO $pdo): void
{
    try {
        $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
        $role = isset($_GET['role']) ? trim((string) $_GET['role']) : '';
        $status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';

        $query = "
            SELECT id, staff_id, full_name, username, email, phone, role, status, created_at
            FROM users
            WHERE 1=1
        ";
        $params = [];

        if ($search !== '') {
            $query .= " AND (full_name LIKE ? OR username LIKE ? OR staff_id LIKE ? OR email LIKE ?)";
            $term = "%{$search}%";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        if ($role !== '' && strtolower($role) !== 'all') {
            $query .= " AND role = ?";
            $params[] = $role;
        }

        if ($status !== '' && strtolower($status) !== 'all') {
            $query .= " AND status = ?";
            $params[] = strtolower($status);
        }

        $query .= " ORDER BY created_at DESC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $users = array_map('formatUser', $rows);

        $statsRow = $pdo->query("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN role = 'Administrator' THEN 1 ELSE 0 END) AS admins,
                SUM(CASE WHEN role = 'Pharmacist' THEN 1 ELSE 0 END) AS pharmacists
            FROM users
        ")->fetch();

        jsonResponse([
            'success' => true,
            'users' => $users,
            'stats' => [
                'total' => (int) ($statsRow['total'] ?? 0),
                'active' => (int) ($statsRow['active'] ?? 0),
                'admins' => (int) ($statsRow['admins'] ?? 0),
                'pharmacists' => (int) ($statsRow['pharmacists'] ?? 0),
            ],
        ], 200);
    } catch (Throwable $e) {
        error_log('Get users error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to retrieve user accounts.',
        ], 500);
    }
}

// CREATE USER
function createUser(PDO $pdo, array $authUser): void
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
        $status = !empty($body['status']) ? strtolower(trim((string) $body['status'])) : 'active';

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

        $normalizedEmail = strtolower($email);

        $checkStmt = $pdo->prepare("
            SELECT id FROM users WHERE email = ? OR username = ? OR staff_id = ? LIMIT 1
        ");
        $checkStmt->execute([$normalizedEmail, $username, $staffId]);

        if ($checkStmt->fetch()) {
            jsonResponse([
                'success' => false,
                'message' => 'A staff account with this email, username or Staff ID already exists.',
            ], 409);
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        $insertStmt = $pdo->prepare("
            INSERT INTO users (staff_id, full_name, email, phone, username, password_hash, role, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $insertStmt->execute([
            $staffId,
            $fullName,
            $normalizedEmail,
            $phone,
            $username,
            $passwordHash,
            $role,
            $status,
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
                "Created staff account {$staffId} ({$fullName}).",
            ]);
        }

        jsonResponse([
            'success' => true,
            'message' => 'User account created successfully.',
            'userId' => $newUserId,
        ], 201);
    } catch (Throwable $e) {
        error_log('Create user error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to create user account.',
        ], 500);
    }
}

// UPDATE USER
function updateUser(PDO $pdo, string $id, array $authUser): void
{
    try {
        $body = getJsonBody();

        $findStmt = $pdo->prepare("SELECT * FROM users WHERE id = ? OR staff_id = ? LIMIT 1");
        $findStmt->execute([$id, $id]);
        $user = $findStmt->fetch();

        if (!$user) {
            jsonResponse([
                'success' => false,
                'message' => 'User account not found.',
            ], 404);
        }

        $newName = !empty($body['fullName']) && trim((string) $body['fullName']) !== ''
            ? trim((string) $body['fullName'])
            : $user['full_name'];
        $newEmail = !empty($body['email']) && trim((string) $body['email']) !== ''
            ? strtolower(trim((string) $body['email']))
            : $user['email'];
        $newUsername = !empty($body['username']) && trim((string) $body['username']) !== ''
            ? trim((string) $body['username'])
            : $user['username'];
        $newPhone = array_key_exists('phone', $body)
            ? (trim((string) $body['phone']) !== '' ? trim((string) $body['phone']) : null)
            : $user['phone'];
        $newRole = !empty($body['role']) ? trim((string) $body['role']) : $user['role'];
        $newStatus = !empty($body['status']) ? strtolower(trim((string) $body['status'])) : $user['status'];

        $passwordHash = $user['password_hash'];
        if (!empty($body['password']) && strlen(trim((string) $body['password'])) >= 8) {
            $passwordHash = password_hash(trim((string) $body['password']), PASSWORD_BCRYPT, ['cost' => 12]);
        }

        $updateStmt = $pdo->prepare("
            UPDATE users
            SET full_name = ?,
                email = ?,
                username = ?,
                phone = ?,
                role = ?,
                status = ?,
                password_hash = ?
            WHERE id = ?
        ");
        $updateStmt->execute([
            $newName,
            $newEmail,
            $newUsername,
            $newPhone,
            $newRole,
            $newStatus,
            $passwordHash,
            (int) $user['id'],
        ]);

        if (!empty($authUser['id'])) {
            $logStmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, description)
                VALUES (?, ?, ?)
            ");
            $logStmt->execute([
                (int) $authUser['id'],
                'USER_UPDATED',
                "Updated user profile for {$user['staff_id']} ({$newName}).",
            ]);
        }

        jsonResponse([
            'success' => true,
            'message' => 'User account updated successfully.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Update user error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to update user account.',
        ], 500);
    }
}

// TOGGLE USER STATUS
function toggleUserStatus(PDO $pdo, string $id, array $authUser): void
{
    try {
        $findStmt = $pdo->prepare("
            SELECT id, staff_id, full_name, status FROM users WHERE id = ? OR staff_id = ? LIMIT 1
        ");
        $findStmt->execute([$id, $id]);
        $user = $findStmt->fetch();

        if (!$user) {
            jsonResponse([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $newStatus = $user['status'] === 'active' ? 'inactive' : 'active';

        $updateStmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
        $updateStmt->execute([$newStatus, (int) $user['id']]);

        if (!empty($authUser['id'])) {
            $logStmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, description)
                VALUES (?, ?, ?)
            ");
            $logStmt->execute([
                (int) $authUser['id'],
                'USER_STATUS_CHANGE',
                "Changed status of {$user['staff_id']} to {$newStatus}.",
            ]);
        }

        $displayStatus = $newStatus === 'active' ? 'Active' : 'Inactive';
        jsonResponse([
            'success' => true,
            'message' => "User status changed to {$displayStatus}.",
            'status' => $displayStatus,
        ], 200);
    } catch (Throwable $e) {
        error_log('Toggle user status error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to update user status.',
        ], 500);
    }
}

// DELETE USER
function deleteUser(PDO $pdo, string $id, array $authUser): void
{
    try {
        if (
            (string) ($authUser['id'] ?? '') === $id ||
            (string) ($authUser['staff_id'] ?? '') === $id
        ) {
            jsonResponse([
                'success' => false,
                'message' => 'You cannot delete your own account.',
            ], 400);
        }

        $delStmt = $pdo->prepare("DELETE FROM users WHERE id = ? OR staff_id = ?");
        $delStmt->execute([$id, $id]);

        jsonResponse([
            'success' => true,
            'message' => 'User deleted successfully.',
        ], 200);
    } catch (Throwable $e) {
        error_log('Delete user error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Unable to delete user.',
        ], 500);
    }
}
