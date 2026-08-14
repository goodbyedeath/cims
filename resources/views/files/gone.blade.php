@php
    $company = \App\Models\CatalogSetting::getValue('company_name', 'Component Sales');
    $expired = ($reason ?? '') === 'expired';
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $expired ? 'Tautan kedaluwarsa' : 'Tautan tidak ditemukan' }} — {{ $company }}</title>
    <meta name="robots" content="noindex, nofollow">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #0d1424; color: #e8ecf3; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: #1a2340; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; max-width: 420px; width: 100%; padding: 36px 28px; text-align: center; }
        .icon { font-size: 40px; margin-bottom: 14px; }
        h1 { font-size: 18px; color: #fff; }
        p { font-size: 14px; color: #8da2d1; margin-top: 10px; line-height: 1.5; }
        .brand { font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #D4AF37; font-weight: 700; margin-top: 22px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">{{ $expired ? '⏳' : '🔍' }}</div>
        <h1>{{ $expired ? 'Tautan sudah kedaluwarsa' : 'Tautan tidak ditemukan' }}</h1>
        <p>
            {{ $expired
                ? 'File ini sudah tidak tersedia untuk diunduh. Silakan hubungi kami untuk mendapatkan tautan baru.'
                : 'Tautan yang Anda buka tidak valid atau sudah dihapus.' }}
        </p>
        <div class="brand">{{ $company }}</div>
    </div>
</body>
</html>
