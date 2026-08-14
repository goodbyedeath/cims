<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Spintax: {halo|hai|selamat} → one option picked at random, so every recipient
 * gets a slightly different message (anti-ban). Nested groups supported.
 *
 * MUST run AFTER {file} + placeholders are resolved — a raw {file}/{company_name}
 * left in the text would otherwise be collapsed to a single-option group.
 */
class SpintaxParser
{
    public static function parse(string $text): string
    {
        // Repeatedly resolve the innermost {a|b|c} groups until none remain.
        $guard = 0;
        while (str_contains($text, '{') && preg_match('/\{([^{}]*)\}/', $text) && $guard++ < 100) {
            $text = preg_replace_callback('/\{([^{}]*)\}/', function (array $m): string {
                $options = explode('|', $m[1]);

                return $options[array_rand($options)];
            }, $text) ?? $text;
        }

        return $text;
    }

    /** True when the text contains at least one real {a|b} variation group. */
    public static function hasVariation(string $text): bool
    {
        return (bool) preg_match('/\{[^{}]*\|[^{}]*\}/', $text);
    }
}
