<?php

declare(strict_types=1);

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/services/geminiService.php';

function testGemini(): void
{
    try {
        echo "Testing Gemini API...\n";
        loadEnv();

        if (!envValue('GEMINI_API_KEY')) {
            throw new RuntimeException('GEMINI_API_KEY is missing from .env');
        }

        $model = envValue('GEMINI_MODEL', 'gemini-2.5-flash') ?: 'gemini-2.5-flash';
        echo "Selected model: {$model}\n";

        $response = callGeminiApi($model, [
            'contents' => [
                [
                    'parts' => [
                        ['text' => 'Reply with exactly this sentence: Gemini API is working successfully.'],
                    ],
                ],
            ],
        ]);

        echo "\nGEMINI RESPONSE:\n";
        echo extractGeminiText($response) . "\n";
        echo "\nGemini API test completed successfully.\n";
    } catch (Throwable $e) {
        fwrite(STDERR, "\nGEMINI API TEST FAILED:\n" . $e->getMessage() . "\n");
        if ($e->getCode()) {
            fwrite(STDERR, 'HTTP Status: ' . $e->getCode() . "\n");
        }
        exit(1);
    }
}

testGemini();
