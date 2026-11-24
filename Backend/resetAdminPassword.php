<?php

declare(strict_types=1);

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';

function resetAdminPassword(): void
{
    try {
        loadEnv();

        $username = envValue('ADMIN_USERNAME');
        $newPassword = envValue('ADMIN_PASSWORD');

        if (!$username || !$newPassword) {
            throw new RuntimeException('Admin username or password missing from .env');
        }

        if (strlen($newPassword) < 12) {
            throw new RuntimeException('Admin password must be at least 12 characters.');
        }

        $pdo = getDbConnection();
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

        $stmt = $pdo->prepare("
            UPDATE users
            SET password_hash = ?
            WHERE username = ? AND role = 'Administrator'
        ");
        $stmt->execute([$hashedPassword, $username]);

        if ($stmt->rowCount() === 0) {
            echo "Administrator account not found.\n";
        } else {
            echo "Administrator password reset successfully!\n";
        }
    } catch (Throwable $e) {
        fwrite(STDERR, 'Password reset failed: ' . $e->getMessage() . "\n");
        exit(1);
    }
}

resetAdminPassword();
