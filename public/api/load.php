<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$savesDir = __DIR__ . '/../data/saves';

if (!is_dir($savesDir)) {
    http_response_code(404);
    echo json_encode(['error' => 'No saves found']);
    exit;
}

// Get filename parameter
$filename = $_GET['file'] ?? null;

if ($filename) {
    // Load specific file
    $filepath = $savesDir . '/' . basename($filename); // Prevent directory traversal
    if (!is_file($filepath)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found']);
        exit;
    }

    $data = json_decode(file_get_contents($filepath), true);
    if ($data === null) {
        http_response_code(500);
        echo json_encode(['error' => 'Invalid JSON in file']);
        exit;
    }

    http_response_code(200);
    echo json_encode($data);
    exit;
} else {
    // List all saves
    $files = array_filter(scandir($savesDir), function($file) use ($savesDir) {
        return is_file($savesDir . '/' . $file) && pathinfo($file, PATHINFO_EXTENSION) === 'json';
    });

    $saves = [];
    foreach ($files as $file) {
        $filepath = $savesDir . '/' . $file;
        $stats = stat($filepath);
        $data = json_decode(file_get_contents($filepath), true);

        $saves[] = [
            'filename' => $file,
            'timestamp' => $stats['mtime'],
            'saved_at' => $data['saved_at'] ?? date('c', $stats['mtime']),
            'device_count' => isset($data['devices']) ? count($data['devices']) : 0,
            'cable_count' => isset($data['cables']) ? count($data['cables']) : 0
        ];
    }

    // Sort by filename timestamp descending (more reliable than mtime)
    usort($saves, function($a, $b) {
        return strcmp($b['filename'], $a['filename']);
    });

    http_response_code(200);
    echo json_encode(['saves' => $saves]);
    exit;
}
?>