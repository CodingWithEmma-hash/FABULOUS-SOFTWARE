<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/controllers/assessmentController.php';
require_once dirname(__DIR__) . '/middleware/authMiddleware.php';

function handleAssessmentRoutes(PDO $pdo, string $method, string $subPath): bool
{
    if ($subPath === '' || $subPath === '/') {
        if ($method === 'POST') {
            $user = protect($pdo);
            if (($user['role'] ?? '') === 'Administrator') {
                jsonResponse([
                    'success' => false,
                    'message' => 'Administrators are not permitted to create or perform clinical AI assessments. Only clinical healthcare staff may conduct assessments.',
                ], 403);
            }
            createAssessment($pdo, $user);
            return true;
        }

        if ($method === 'GET') {
            protect($pdo);
            getAssessments($pdo);
            return true;
        }
    }

    if (preg_match('#^/([^/]+)$#', $subPath, $matches)) {
        $id = rawurldecode($matches[1]);

        if ($method === 'GET') {
            protect($pdo);
            getAssessmentById($pdo, $id);
            return true;
        }

        if ($method === 'DELETE') {
            $user = protect($pdo);
            deleteAssessment($pdo, $id, $user);
            return true;
        }
    }

    return false;
}
