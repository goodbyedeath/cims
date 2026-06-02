<?php

use Monolog\Handler\NullHandler;
use Monolog\Handler\StreamHandler;
use Monolog\Processor\PsrLogMessageProcessor;

return [

    'default' => env('LOG_CHANNEL', 'daily'),

    'deprecations' => [
        'channel' => env('LOG_DEPRECATIONS_CHANNEL', 'null'),
        'trace'   => env('LOG_DEPRECATIONS_TRACE', false),
    ],

    'channels' => [

        // Production default — rotates daily, keeps 30 days
        'daily' => [
            'driver'               => 'daily',
            'path'                 => storage_path('logs/laravel.log'),
            'level'                => env('LOG_LEVEL', 'error'),
            'days'                 => env('LOG_DAILY_DAYS', 30),
            'replace_placeholders' => true,
        ],

        // Verbose channel — only enable via LOG_CHANNEL=debug during troubleshooting
        'debug' => [
            'driver'               => 'daily',
            'path'                 => storage_path('logs/debug.log'),
            'level'                => 'debug',
            'days'                 => 3,
            'replace_placeholders' => true,
        ],

        // Security events (rate-limit hits, auth failures, PIN brute-force)
        'security' => [
            'driver'               => 'daily',
            'path'                 => storage_path('logs/security.log'),
            'level'                => 'warning',
            'days'                 => 90,
            'replace_placeholders' => true,
        ],

        'stack' => [
            'driver'            => 'stack',
            'channels'          => explode(',', (string) env('LOG_STACK', 'daily')),
            'ignore_exceptions' => false,
        ],

        'single' => [
            'driver'               => 'single',
            'path'                 => storage_path('logs/laravel.log'),
            'level'                => env('LOG_LEVEL', 'error'),
            'replace_placeholders' => true,
        ],

        'slack' => [
            'driver'               => 'slack',
            'url'                  => env('LOG_SLACK_WEBHOOK_URL'),
            'username'             => env('LOG_SLACK_USERNAME', env('APP_NAME', 'CIMS')),
            'emoji'                => env('LOG_SLACK_EMOJI', ':boom:'),
            'level'                => 'critical',
            'replace_placeholders' => true,
        ],

        'stderr' => [
            'driver'     => 'monolog',
            'level'      => env('LOG_LEVEL', 'error'),
            'handler'    => StreamHandler::class,
            'handler_with' => ['stream' => 'php://stderr'],
            'processors' => [PsrLogMessageProcessor::class],
        ],

        'null' => [
            'driver'  => 'monolog',
            'handler' => NullHandler::class,
        ],

        'emergency' => [
            'path' => storage_path('logs/emergency.log'),
        ],

    ],

];
