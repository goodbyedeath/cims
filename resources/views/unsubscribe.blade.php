<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Berhenti Berlangganan — {{ $companyName }}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      background: #f0f2f5;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      width: 100%; max-width: 480px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      padding: 32px 40px 24px;
      text-align: center;
    }
    .logo-box {
      width: 52px; height: 52px;
      background: linear-gradient(135deg, #D4AF37, #F5D060);
      border-radius: 13px;
      display: inline-flex; align-items: center; justify-content: center;
      margin-bottom: 14px;
      font-size: 20px; font-weight: 800; color: #1a1a2e;
      overflow: hidden;
    }
    .logo-box img { width: 52px; height: 52px; object-fit: contain; display: block; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; color: #fff; letter-spacing: -.3px; }
    .header p  { margin: 5px 0 0; font-size: 10px; color: #D4AF37; letter-spacing: 1.8px; text-transform: uppercase; font-weight: 600; }
    .body { padding: 36px 40px; }
    .icon-wrap {
      width: 64px; height: 64px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px; font-size: 28px;
    }
    .icon-wrap.warning { background: #fff8e1; }
    .icon-wrap.success { background: #e8f5e9; }
    .icon-wrap.info    { background: #e3f2fd; }
    h2 { margin: 0 0 10px; font-size: 20px; font-weight: 700; color: #1a1a2e; text-align: center; }
    .sub  { font-size: 14px; color: #4a5568; text-align: center; line-height: 1.7; margin: 0 0 28px; }
    .recipient {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 14px 18px; margin-bottom: 24px; text-align: center;
    }
    .recipient .name  { font-size: 15px; font-weight: 600; color: #1a1a2e; }
    .recipient .email { font-size: 12px; color: #a0aec0; margin-top: 2px; }
    .btn {
      display: block; width: 100%;
      padding: 13px; border-radius: 10px;
      font-size: 15px; font-weight: 600;
      cursor: pointer; border: none; text-align: center;
      text-decoration: none; transition: opacity .15s;
    }
    .btn:hover { opacity: .88; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-muted  { background: #f1f5f9; color: #64748b; margin-top: 10px; }
    .note { font-size: 11px; color: #a0aec0; text-align: center; margin-top: 18px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <!-- Header -->
    <div class="header">
      @php
        $logoPath = \App\Models\CatalogSetting::getValue('company_logo_path');
        $logoUrl  = $logoPath ? \Illuminate\Support\Facades\Storage::disk('public')->url($logoPath) : null;
        $initial  = \App\Models\CatalogSetting::getValue('email_header_initial', '') ?: mb_strtoupper(mb_substr($companyName, 0, 1));
      @endphp
      <div class="logo-box">
        @if($logoUrl)
          <img src="{{ $logoUrl }}" alt="{{ $companyName }}">
        @else
          {{ $initial }}
        @endif
      </div>
      <h1>{{ $companyName }}</h1>
      <p>{{ $companyTagline }}</p>
    </div>

    <!-- Body -->
    <div class="body">

      @if($confirmed)
        {{-- ── Success state ── --}}
        <div class="icon-wrap success">✅</div>
        <h2>Berhasil Berhenti Berlangganan</h2>
        <p class="sub">
          Anda tidak akan lagi menerima email blast dari <strong>{{ $companyName }}</strong>.<br>
          Jika ini bukan keinginan Anda, hubungi kami langsung.
        </p>
        <p class="note">
          Anda dapat menghubungi tim kami untuk berlangganan kembali kapan saja.
        </p>

      @elseif($already)
        {{-- ── Already unsubscribed ── --}}
        <div class="icon-wrap info">ℹ️</div>
        <h2>Sudah Berhenti Berlangganan</h2>
        <p class="sub">
          Alamat email Anda sudah terdaftar sebagai berhenti berlangganan.<br>
          Anda tidak akan menerima email blast dari kami.
        </p>
        <p class="note">
          Jika ingin berlangganan kembali, hubungi tim {{ $companyName }}.
        </p>

      @else
        {{-- ── Confirmation page ── --}}
        <div class="icon-wrap warning">✉️</div>
        <h2>Berhenti Berlangganan?</h2>
        <p class="sub">
          Anda akan berhenti menerima email promosi dan informasi dari<br>
          <strong>{{ $companyName }}</strong>.
        </p>

        <div class="recipient">
          <div class="name">{{ $channel->company_name }}</div>
          <div class="email">{{ $channel->email }}</div>
        </div>

        <form method="POST" action="{{ request()->fullUrl() }}">
          @csrf
          <button type="submit" class="btn btn-danger">
            Ya, Berhenti Berlangganan
          </button>
        </form>
        <a href="/" class="btn btn-muted">Batal</a>

        <p class="note">
          Email ini dikirim kepada {{ $channel->company_name }} ({{ $channel->email }}).<br>
          Klik konfirmasi hanya jika Anda yakin ingin berhenti berlangganan.
        </p>
      @endif

    </div>
  </div>
</body>
</html>
