<?php

declare(strict_types=1);

class JwtExpiredException extends RuntimeException {}
class JwtInvalidException extends RuntimeException {}

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder !== 0) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    $decoded = base64_decode(strtr($data, '-_', '+/'), true);
    if ($decoded === false) {
        throw new JwtInvalidException('Invalid base64url encoding.');
    }
    return $decoded;
}

/**
 * Generate an HS256 JWT compatible with Node.js jsonwebtoken.
 */
function jwtEncode(array $payload, string $secret, int $expiresInSeconds = 28800): string
{
    $now = time();
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];

    $claims = array_merge($payload, [
        'iat' => $now,
        'exp' => $now + $expiresInSeconds,
    ]);

    $headerEncoded = base64UrlEncode((string) json_encode($header, JSON_UNESCAPED_SLASHES));
    $payloadEncoded = base64UrlEncode((string) json_encode($claims, JSON_UNESCAPED_SLASHES));
    $signingInput = "{$headerEncoded}.{$payloadEncoded}";
    $signature = hash_hmac('sha256', $signingInput, $secret, true);

    return "{$signingInput}." . base64UrlEncode($signature);
}

/**
 * Verify and decode an HS256 JWT.
 */
function jwtDecode(string $token, string $secret): array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new JwtInvalidException('Malformed JWT.');
    }

    [$headerEncoded, $payloadEncoded, $signatureEncoded] = $parts;

    $header = json_decode(base64UrlDecode($headerEncoded), true);
    if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
        throw new JwtInvalidException('Unsupported JWT algorithm.');
    }

    $expectedSignature = hash_hmac('sha256', "{$headerEncoded}.{$payloadEncoded}", $secret, true);
    $actualSignature = base64UrlDecode($signatureEncoded);

    if (!hash_equals($expectedSignature, $actualSignature)) {
        throw new JwtInvalidException('Invalid JWT signature.');
    }

    $payload = json_decode(base64UrlDecode($payloadEncoded), true);
    if (!is_array($payload)) {
        throw new JwtInvalidException('Invalid JWT payload.');
    }

    if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
        throw new JwtExpiredException('JWT has expired.');
    }

    return $payload;
}
