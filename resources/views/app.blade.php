<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title inertia>{{ $dynamicCompanyName ?? config('app.name', 'CIMS') }}</title>
    @if(!empty($noindex))
    <meta name="robots" content="noindex, nofollow">
    @endif

    {{-- PWA --}}
    <meta name="application-name" content="{{ $dynamicCompanyName ?? 'CIMS' }}">
    <meta name="theme-color" content="#1a2744">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="{{ $dynamicCompanyName ?? 'CIMS' }}">
    <link rel="manifest" href="/build/manifest.webmanifest">
    @if(!empty($dynamicLogoUrl))
    {{-- Use uploaded company logo as favicon / app icon --}}
    <link rel="icon" type="image/png" href="{{ $dynamicLogoUrl }}">
    <link rel="apple-touch-icon" href="{{ $dynamicLogoUrl }}">
    @else
    {{-- Fallback to static icons --}}
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    @endif
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('/build/sw.js', { scope: '/' })
                    .catch(function (e) { console.warn('SW registration failed:', e); });
            });
        }
    </script>

    {{-- Fonts: preconnect + non-blocking load to avoid render-blocking --}}
    <link rel="preconnect" href="https://fonts.bunny.net" crossorigin>
    <link rel="dns-prefetch" href="https://fonts.bunny.net">
    <link rel="preload" as="style" href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800&display=swap"
          onload="this.onload=null;this.rel='stylesheet'">
    <noscript>
        <link rel="stylesheet" href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800&display=swap">
    </noscript>

    @viteReactRefresh
    @vite('resources/js/app.jsx')
    @inertiaHead
</head>
<body class="font-sans antialiased">
    @inertia
</body>
</html>
