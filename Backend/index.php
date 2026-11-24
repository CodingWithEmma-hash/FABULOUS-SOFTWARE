<?php

declare(strict_types=1);

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/initDb.php';
require_once __DIR__ . '/helpers/http.php';

require_once __DIR__ . '/routes/authRoutes.php';
require_once __DIR__ . '/routes/dashboardRoutes.php';
require_once __DIR__ . '/routes/patientRoutes.php';
require_once __DIR__ . '/routes/assessmentRoutes.php';
require_once __DIR__ . '/routes/userRoutes.php';
require_once __DIR__ . '/routes/notificationRoutes.php';
require_once __DIR__ . '/routes/reportRoutes.php';
require_once __DIR__ . '/routes/settingsRoutes.php';

loadEnv();
sendCorsHeaders();

// Resolve request path cleanly across both php -S and XAMPP Apache subdirectory mounts.
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$rawPath = parse_url($requestUri, PHP_URL_PATH) ?: '/';
$path = rawurldecode($rawPath);

$docRoot = isset($_SERVER['DOCUMENT_ROOT']) ? realpath($_SERVER['DOCUMENT_ROOT']) : false;
$appDir = realpath(__DIR__);
if ($docRoot !== false && $appDir !== false && str_starts_with(strtolower($appDir), strtolower($docRoot))) {
    $mountPrefix = str_replace('\\', '/', substr($appDir, strlen($docRoot)));
    $mountPrefix = $mountPrefix === '' ? '' : '/' . ltrim($mountPrefix, '/');
    if ($mountPrefix !== '' && str_starts_with($path, $mountPrefix)) {
        $path = substr($path, strlen($mountPrefix));
    }
} elseif (PHP_SAPI !== 'cli-server') {
    $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($path, $scriptDir)) {
        $path = substr($path, strlen($scriptDir));
    }
}

if ($path === '/index.php') {
    $path = '/';
} elseif (str_starts_with($path, '/index.php/')) {
    $path = substr($path, strlen('/index.php'));
}

if ($path === '' || $path[0] !== '/') {
    $path = '/' . $path;
}
if (strlen($path) > 1) {
    $path = rtrim($path, '/');
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

// Home route
if ($method === 'GET' && $path === '/') {
    jsonResponse([
        'success' => true,
        'message' => 'Hospital Decision Support System API is running.',
    ], 200);
}

// Connect to MySQL
try {
    $pdo = getDbConnection();
    ensureDatabaseInitialized($pdo);
} catch (Throwable $e) {
    error_log('Database connection error: ' . $e->getMessage());
    jsonResponse([
        'success' => false,
        'message' => 'Database connection error.',
    ], 500);
}

// Database health check
if ($method === 'GET' && $path === '/api/health') {
    try {
        initializeDatabase($pdo, false);
        $row = $pdo->query('SELECT 1 AS database_status')->fetch();
        $connected = isset($row['database_status']) && (int) $row['database_status'] === 1;

        jsonResponse([
            'success' => true,
            'message' => 'Backend and MySQL are connected successfully.',
            'database' => $connected ? 'Connected' : 'Disconnected',
        ], 200);
    } catch (Throwable $e) {
        error_log('Health check error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Database connection error.',
        ], 500);
    }
}

// Dispatch API route groups
$routeGroups = [
    '/api/auth' => 'handleAuthRoutes',
    '/api/dashboard' => 'handleDashboardRoutes',
    '/api/patients' => 'handlePatientRoutes',
    '/api/assessments' => 'handleAssessmentRoutes',
    '/api/users' => 'handleUserRoutes',
    '/api/notifications' => 'handleNotificationRoutes',
    '/api/reports' => 'handleReportRoutes',
    '/api/settings' => 'handleSettingsRoutes',
];

foreach ($routeGroups as $prefix => $handler) {
    if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
        $subPath = substr($path, strlen($prefix));
        if ($handler($pdo, $method, $subPath)) {
            exit;
        }
        break;
    }
}

jsonResponse([
    'success' => false,
    'message' => 'API endpoint not found.',
], 404);
