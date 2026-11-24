<?php

declare(strict_types=1);

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/initDb.php';

function createAdmin(): void
{
    try {
        loadEnv();

        $staffId = envValue('ADMIN_STAFF_ID');
        $fullName = envValue('ADMIN_FULL_NAME');
        $email = envValue('ADMIN_EMAIL');
        $username = envValue('ADMIN_USERNAME');
        $password = envValue('ADMIN_PASSWORD');

        if (!$staffId || !$fullName || !$email || !$username || !$password) {
            throw new RuntimeException('Complete all ADMIN settings in your .env file.');
        }

        if (strlen($password) < 12) {
            throw new RuntimeException('Administrator password must be at least 12 characters.');
        }

        $pdo = getDbConnection();
        initializeDatabase($pdo, false);

        $normalizedEmail = strtolower($email);

        $stmt = $pdo->prepare("
            SELECT id FROM users
            WHERE username = ? OR email = ? OR staff_id = ?
            LIMIT 1
        ");
        $stmt->execute([$username, $normalizedEmail, $staffId]);

        if ($stmt->fetch()) {
            echo "An account with these administrator details already exists.\n";
            return;
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        $insert = $pdo->prepare("
            INSERT INTO users
            (staff_id, full_name, email, username, password_hash, role, status)
            VALUES (?, ?, ?, ?, ?, 'Administrator', 'active')
        ");
        $insert->execute([
            $staffId,
            $fullName,
            $normalizedEmail,
            $username,
            $passwordHash,
        ]);

        echo "Administrator account created successfully.\n";
        echo "Username: {$username}\n";
        echo "Log in using the administrator password in your .env file.\n";
    } catch (Throwable $e) {
        fwrite(STDERR, 'Administrator setup failed: ' . $e->getMessage() . "\n");
        exit(1);
    }
}

createAdmin();
