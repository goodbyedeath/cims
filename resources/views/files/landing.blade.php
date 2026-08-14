@php
    $company = \App\Models\CatalogSetting::getValue('company_name', 'Component Sales');
    $downloadUrl = url('/file/'.$token.'/download');
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $file->original_name }} — {{ $company }}</title>

    {{-- OpenGraph: this is what the WhatsApp link preview card renders --}}
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="{{ $company }}">
    <meta property="og:title" content="{{ $file->original_name }}">
    <meta property="og:description" content="Unduh file ({{ $file->humanSize() }}) dari {{ $company }}.">
    <meta name="robots" content="noindex, nofollow">

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #0d1424; color: #e8ecf3; min-height: 100vh;
            display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .card {
            background: #1a2340; border: 1px solid rgba(255,255,255,.08); border-radius: 20px;
            max-width: 420px; width: 100%; padding: 32px 28px; text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,.4);
        }
        .brand { font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: #D4AF37; font-weight: 700; margin-bottom: 24px; }
        .icon { width: 64px; height: 64px; margin: 0 auto 18px; border-radius: 16px; background: rgba(212,175,55,.12); display: flex; align-items: center; justify-content: center; font-size: 28px; }
        .name { font-size: 17px; font-weight: 700; color: #fff; word-break: break-word; line-height: 1.4; }
        .meta { font-size: 13px; color: #8da2d1; margin-top: 6px; }
        .btn {
            display: inline-flex; align-items: center; gap: 8px; margin-top: 24px; width: 100%; justify-content: center;
            background: #D4AF37; color: #0d1424; font-weight: 700; font-size: 15px;
            padding: 14px 24px; border-radius: 12px; text-decoration: none; transition: background .15s;
        }
        .btn:hover { background: #e6c14f; }
        .foot { margin-top: 20px; font-size: 11px; color: #5a6b8f; }
    </style>
</head>
<body>
    <div class="card">
        <div class="brand">{{ $company }}</div>
        <div class="icon">📄</div>
        <div class="name">{{ $file->original_name }}</div>
        <div class="meta">{{ strtoupper(pathinfo($file->original_name, PATHINFO_EXTENSION)) }} · {{ $file->humanSize() }}</div>
        <a class="btn" href="{{ $downloadUrl }}">⬇ Unduh File</a>
        <div class="foot">Tautan ini dikirim khusus untuk Anda.</div>
    </div>
</body>
</html>
