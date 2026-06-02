<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maintenance — Sedang Dalam Perbaikan</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#070a12;color:#fff;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
  .wrap{text-align:center;max-width:440px}
  .icon{font-size:4rem;margin-bottom:1rem;display:block}
  h1{font-size:1.5rem;font-weight:800;margin-bottom:.75rem;color:#f0f3f9}
  .badge{display:inline-block;padding:.25rem .875rem;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.3);color:#D4AF37;font-size:.75rem;font-weight:600;border-radius:2rem;letter-spacing:.05em;margin-bottom:1.25rem}
  p{font-size:.9rem;color:#6783c1;line-height:1.7;margin-bottom:2rem}
</style>
</head>
<body>
<div class="wrap">
  <span class="icon">🔧</span>
  <div class="badge">MAINTENANCE MODE</div>
  <h1>Sedang Dalam Perbaikan</h1>
  <p>Sistem sedang menjalani pemeliharaan terjadwal. Kami akan kembali online sebentar lagi. Terima kasih atas kesabaran Anda.</p>
  @if(isset($exception) && $exception->getMessage())
  <p style="color:#4164b2;font-size:.8rem">{{ $exception->getMessage() }}</p>
  @endif
</div>
</body>
</html>
