<?php

declare(strict_types=1);

return [
    'backend_url'  => env('RAG_BACKEND_URL'),
    'api_key'      => env('RAG_BACKEND_API_KEY'),
    'http_timeout' => (int) env('RAG_HTTP_TIMEOUT', 120),
];
