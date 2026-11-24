<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/env.php';

class GeminiServiceException extends RuntimeException {}

/**
 * Call the Gemini REST API to generate structured clinical decision-support data.
 */
function callGeminiApi(string $model, array $payload): array
{
    $apiKey = envValue('GEMINI_API_KEY');
    if (!$apiKey) {
        throw new GeminiServiceException('Gemini API key is missing from the backend .env file.');
    }

    if (!function_exists('curl_init')) {
        throw new GeminiServiceException('PHP cURL extension is required for Gemini API requests.');
    }

    $url = sprintf(
        'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent',
        rawurlencode($model)
    );

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);

    $rawResponse = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($rawResponse === false) {
        throw new GeminiServiceException('Gemini network request failed: ' . $curlError);
    }

    $decoded = json_decode($rawResponse, true);

    if ($httpCode < 200 || $httpCode >= 300) {
        $apiMsg = $decoded['error']['message'] ?? $rawResponse;
        throw new GeminiServiceException($apiMsg, $httpCode);
    }

    if (!is_array($decoded)) {
        throw new GeminiServiceException('Gemini returned an invalid response.');
    }

    return $decoded;
}

/**
 * Extract the text output from a Gemini generateContent response.
 */
function extractGeminiText(array $response): string
{
    $parts = $response['candidates'][0]['content']['parts'] ?? [];
    if (!is_array($parts)) {
        return '';
    }

    $texts = [];
    foreach ($parts as $part) {
        if (isset($part['text']) && is_string($part['text'])) {
            $texts[] = $part['text'];
        }
    }

    return trim(implode("\n", $texts));
}

/**
 * Generate a preliminary clinical decision-support assessment via Gemini.
 */
function generateClinicalAssessment(array $patientData): array
{
    $model = envValue('GEMINI_MODEL', 'gemini-2.5-flash') ?: 'gemini-2.5-flash';
    $patientJson = json_encode($patientData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    $prompt = <<<PROMPT

You are an AI clinical decision-support assistant.

Your task is to analyse the supplied patient assessment information
and provide preliminary clinical decision-support information for
a qualified healthcare professional.

IMPORTANT SAFETY RULES:
1. Do not claim to establish a confirmed diagnosis.
2. Do not prescribe medications or recommend medication dosages.
3. Do not replace the judgment of a qualified healthcare professional.
4. Identify concerning symptoms and abnormal vital signs.
5. Never describe a potentially serious presentation as definitely safe.
6. If information is missing, explicitly acknowledge the limitation.
7. Recommend urgent clinical assessment when the information suggests
   a potentially serious or time-sensitive condition.
8. Use clear, professional and understandable language.
9. Base your response only on the supplied information.
10. Do not invent symptoms, measurements or patient history.

PATIENT ASSESSMENT INFORMATION:

{$patientJson}

Return a structured assessment containing:
- A brief clinical summary.
- Important observations.
- Practical recommendations for the clinician.
- Any identified warning signs.
- A suggested review priority.

Your response is preliminary decision support and must be reviewed
by a qualified healthcare professional.

PROMPT;

    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt],
                ],
            ],
        ],
        'generationConfig' => [
            'temperature' => 0.2,
            'responseMimeType' => 'application/json',
            'responseJsonSchema' => [
                'type' => 'object',
                'properties' => [
                    'clinical_summary' => ['type' => 'string'],
                    'observations' => [
                        'type' => 'array',
                        'items' => ['type' => 'string'],
                    ],
                    'recommendations' => [
                        'type' => 'array',
                        'items' => ['type' => 'string'],
                    ],
                    'warning_signs' => [
                        'type' => 'array',
                        'items' => ['type' => 'string'],
                    ],
                    'suggested_review_priority' => [
                        'type' => 'string',
                        'enum' => ['Routine', 'Prompt', 'Urgent'],
                    ],
                ],
                'required' => [
                    'clinical_summary',
                    'observations',
                    'recommendations',
                    'warning_signs',
                    'suggested_review_priority',
                ],
            ],
        ],
    ];

    $response = null;
    $lastError = null;

    for ($attempt = 1; $attempt <= 3; $attempt++) {
        try {
            $response = callGeminiApi($model, $payload);
            break;
        } catch (GeminiServiceException $error) {
            $lastError = $error;
            $status = $error->getCode();
            $message = $error->getMessage();

            $isTemporary = in_array($status, [500, 429, 503], true)
                || str_contains($message, '"code":503')
                || str_contains($message, '"code":429')
                || str_contains($message, '"code":500');

            if (!$isTemporary || $attempt === 3) {
                throw $error;
            }

            sleep($attempt * 2);
        }
    }

    if (!$response) {
        throw $lastError ?? new GeminiServiceException('Gemini could not generate a response.');
    }

    $responseText = extractGeminiText($response);
    if ($responseText === '') {
        throw new GeminiServiceException('Gemini returned an empty response.');
    }

    $result = json_decode($responseText, true);
    if (!is_array($result)) {
        throw new GeminiServiceException('Gemini returned an invalid JSON response.');
    }

    if (
        !isset($result['clinical_summary']) || !is_string($result['clinical_summary']) ||
        !isset($result['observations']) || !is_array($result['observations']) ||
        !isset($result['recommendations']) || !is_array($result['recommendations']) ||
        !isset($result['warning_signs']) || !is_array($result['warning_signs']) ||
        !in_array($result['suggested_review_priority'] ?? '', ['Routine', 'Prompt', 'Urgent'], true)
    ) {
        throw new GeminiServiceException('Gemini returned an incomplete assessment.');
    }

    return $result;
}
