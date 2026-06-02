<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Public Catalog PIN
    |--------------------------------------------------------------------------
    | Set CATALOG_PUBLIC_PIN in your .env to require visitors to enter this
    | code before they can view the public product catalog. Leave empty to
    | disable the gate (catalog is open to anyone with the URL).
    |
    */
    'public_pin' => env('CATALOG_PUBLIC_PIN', ''),
];
