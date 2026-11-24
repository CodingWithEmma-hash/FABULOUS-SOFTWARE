<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/controllers/patientController.php';
require_once dirname(__DIR__) . '/middleware/authMiddleware.php';

function handlePatientRoutes(PDO $pdo, string $method, string $subPath): bool
{
    if ($method === 'POST' && $subPath === '/register') {
        $user = protect($pdo);
        registerPatient($pdo, $user);
        return true;
    }

    if ($method === 'GET' && ($subPath === '' || $subPath === '/')) {
        protect($pdo);
        getPatients($pdo);
        return true;
    }

    if (preg_match('#^/([^/]+)$#', $subPath, $matches)) {
        $id = rawurldecode($matches[1]);

        if ($method === 'GET') {
            protect($pdo);
            getPatientById($pdo, $id);
            return true;
        }

        if ($method === 'PUT') {
            $user = protect($pdo);
            updatePatient($pdo, $id, $user);
            return true;
        }

        if ($method === 'DELETE') {
            $user = protect($pdo);
            deletePatient($pdo, $id, $user);
            return true;
        }
    }

    return false;
}
