<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'wablas' => [
        'url' => env('WABLAS_URL', 'https://jkt.wablas.com'),
        'token' => env('WABLAS_TOKEN'),
        'secret' => env('WABLAS_SECRET'),
        // Attempt native interactive messages (buttons / list / product / flow)
        // for WhatsApp forms. Leave false to always use the numbered text-menu
        // fallback, which works on every account.
        'interactive' => env('WABLAS_INTERACTIVE', false),
        // Endpoint that accepts a Cloud-API "interactive" object. Adjust to your
        // Wablas plan's interactive route if needed.
        'interactive_endpoint' => env('WABLAS_INTERACTIVE_ENDPOINT', '/api/v2/send-interactive'),
    ],

    'google_maps' => [
        'key' => env('GOOGLE_MAPS_API_KEY'),
    ],

    'serpapi' => [
        'key' => env('SERPAPI_KEY'),
    ],

    // Which WhatsApp provider outbound sends use: 'baileys' (self-hosted
    // gateway, default) or 'meta' (official Cloud API). See App\Services\WhatsAppService.
    'wa' => [
        'driver' => env('WA_DRIVER', 'baileys'),
    ],

    // Official Meta WhatsApp Business Cloud API (graph.facebook.com) — webhook
    // verification/signature + outbound send (App\Services\MetaCloudService).
    'whatsapp_cloud' => [
        'verify_token'    => env('WHATSAPP_CLOUD_VERIFY_TOKEN'),
        'app_secret'      => env('META_APP_SECRET'),
        'phone_number_id' => env('META_PHONE_NUMBER_ID'),
        'access_token'    => env('META_ACCESS_TOKEN'),
        'graph_version'   => env('META_GRAPH_VERSION', 'v21.0'),
    ],

    'google_sheet' => [
        'inventory_id' => env('GOOGLE_SHEET_INVENTORY_ID'),
        'channel_id' => env('GOOGLE_SHEET_CHANNEL_ID'),
        'catalog_id' => env('GOOGLE_SHEET_CATALOG_ID'),
    ],

];
