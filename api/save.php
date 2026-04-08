<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Validate basic structure
if (!isset($data['version']) || !isset($data['devices']) || !isset($data['cables'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid network data']);
    exit;
}

// Create saves directory if it doesn't exist
$savesDir = __DIR__ . '/../data/saves';
if (!is_dir($savesDir)) {
    mkdir($savesDir, 0755, true);
}

// Generate filename with timestamp
$timestamp = $data['timestamp'] ?? time();
$filename = sprintf('network_%d.json', $timestamp);
$filepath = $savesDir . '/' . $filename;

// Add metadata
$data['saved_at'] = date('c');
$data['saved_by'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// Save to file
if (file_put_contents($filepath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
    exit;
}

// Return success
http_response_code(200);
echo json_encode([
    'success' => true,
    'filename' => $filename,
    'message' => 'Network saved successfully'
]);
?>