<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Penawaran {{ $offering->ref_no ?? $offering->offering_no }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1a2847;
            font-size: 11px;
            line-height: 1.5;
            background: #ffffff;
        }

        .page {
            padding: 32px 36px;
        }

        /* ── Header ── */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            border-bottom: 3px solid #D4AF37;
            padding-bottom: 18px;
        }
        .header-table td { vertical-align: top; padding-bottom: 12px; }
        .brand-name {
            font-size: 22px;
            font-weight: 900;
            color: #0d1424;
            letter-spacing: -0.5px;
        }
        .brand-tagline {
            font-size: 9px;
            color: #6783c1;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-top: 2px;
        }
        .doc-title {
            font-size: 18px;
            font-weight: 800;
            color: #0d1424;
            text-align: right;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .doc-refno {
            font-size: 13px;
            font-weight: 700;
            color: #D4AF37;
            text-align: right;
            font-family: 'Courier New', monospace;
            margin-top: 3px;
        }
        .doc-meta {
            font-size: 9px;
            color: #6783c1;
            text-align: right;
            margin-top: 2px;
        }

        /* ── Status badge ── */
        .status-badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        .status-draft     { background: #e5e7eb; color: #374151; }
        .status-sent      { background: #dbeafe; color: #1e40af; }
        .status-accepted  { background: #d1fae5; color: #065f46; }
        .status-rejected  { background: #fee2e2; color: #991b1b; }
        .status-expired   { background: #ffedd5; color: #9a3412; }

        /* ── Info blocks ── */
        .info-row {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .info-row td { vertical-align: top; width: 50%; padding-right: 20px; }
        .info-row td:last-child { padding-right: 0; }

        .info-box {
            background: #f0f3f9;
            border-radius: 8px;
            padding: 12px 14px;
        }
        .info-box-label {
            font-size: 8px;
            font-weight: 700;
            color: #6783c1;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            border-bottom: 1px solid #d9e0f0;
            padding-bottom: 4px;
        }
        .info-line {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3px;
        }
        .info-line .lbl { color: #6783c1; font-size: 10px; width: 40%; }
        .info-line .val { color: #0d1424; font-size: 10px; font-weight: 600; }
        .info-line .val.mono { font-family: 'Courier New', monospace; color: #D4AF37; }

        /* ── Items table ── */
        .section-label {
            font-size: 9px;
            font-weight: 700;
            color: #6783c1;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        .items-table th {
            background: #1a2847;
            color: #ffffff;
            padding: 8px 10px;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            font-weight: 700;
        }
        .items-table th.right { text-align: right; }
        .items-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e8ecf3;
            color: #273c6b;
            font-size: 10px;
            vertical-align: top;
        }
        .items-table td.right { text-align: right; color: #1a2847; font-weight: 600; }
        .items-table tr:last-child td { border-bottom: none; }
        .items-table tr:nth-child(even) td { background: #f8f9fc; }
        .items-table .product-name { color: #0d1424; font-weight: 700; }
        .items-table .product-spec { color: #8da2d1; font-size: 9px; margin-top: 2px; }
        .items-table .sku { color: #D4AF37; font-family: 'Courier New', monospace; font-size: 9px; }
        .no-col { width: 28px; }

        /* ── Totals ── */
        .totals-row {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .totals-row td { vertical-align: top; }
        .totals-left { width: 55%; padding-right: 20px; vertical-align: top; }
        .totals-right { width: 45%; }
        .totals-box {
            border: 1px solid #d9e0f0;
            border-radius: 8px;
            overflow: hidden;
        }
        .totals-line {
            width: 100%;
            border-collapse: collapse;
        }
        .totals-line tr td {
            padding: 7px 12px;
            border-bottom: 1px solid #e8ecf3;
            font-size: 10px;
        }
        .totals-line tr:last-child td { border-bottom: none; }
        .totals-line .t-lbl { color: #6783c1; }
        .totals-line .t-val { text-align: right; font-weight: 600; color: #0d1424; }
        .totals-line .t-val.discount { color: #dc2626; }
        .grand-row td {
            background: #1a2847;
            color: #ffffff;
            font-size: 12px;
            font-weight: 800;
            padding: 10px 12px;
        }
        .grand-row .t-val { text-align: right; color: #D4AF37; font-size: 14px; }

        /* ── Notes ── */
        .notes-box {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 10px 12px;
            margin-bottom: 16px;
            font-size: 10px;
            color: #78350f;
        }
        .notes-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #92400e; margin-bottom: 4px; }

        /* ── Catatan Penting ── */
        .important-box {
            background: #f0f3f9;
            border-left: 3px solid #D4AF37;
            border-radius: 6px;
            padding: 12px 14px;
            margin-bottom: 16px;
        }
        .important-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #6783c1;
            margin-bottom: 6px;
        }
        .important-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .important-list li {
            font-size: 10px;
            color: #273c6b;
            padding: 3px 0 3px 14px;
            position: relative;
        }
        .important-list li:before {
            content: "•";
            position: absolute;
            left: 0;
            color: #D4AF37;
            font-weight: 700;
        }

        /* ── Signature ── */
        .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
        }
        .sig-cell {
            width: 33.33%;
            text-align: center;
            padding: 0 16px;
            border-top: none;
        }
        .sig-line {
            border-bottom: 1px solid #b3c1e0;
            height: 50px;
            margin-bottom: 6px;
        }
        .sig-title { font-size: 9px; color: #6783c1; text-transform: uppercase; letter-spacing: 0.8px; }
        .sig-name  { font-size: 10px; font-weight: 700; color: #0d1424; margin-top: 2px; }

        /* ── Footer ── */
        .footer {
            margin-top: 28px;
            border-top: 1px solid #d9e0f0;
            padding-top: 10px;
            text-align: center;
            font-size: 8px;
            color: #8da2d1;
        }
        .footer strong { color: #D4AF37; }
    </style>
</head>
<body>
<div class="page">

    {{-- ── Header ──────────────────────────────────────────────────── --}}
    <table class="header-table">
        <tr>
            <td style="width:55%">
                @if(!empty($company['logo_url']))
                    <img src="{{ $company['logo_url'] }}" alt="{{ $company['name'] }}" style="max-height:36px; max-width:160px; object-fit:contain; margin-bottom:4px;">
                @endif
                <div class="brand-name">{{ $company['name'] }}</div>
                @if(!empty($company['tagline']))
                    <div class="brand-tagline">{{ $company['tagline'] }}</div>
                @endif
            </td>
            <td style="width:45%; text-align:right">
                <div class="doc-title">Surat Penawaran Harga</div>
                <div class="doc-refno">{{ $offering->ref_no ?? $offering->offering_no }}</div>
                <div class="doc-meta">{{ \Carbon\Carbon::parse($offering->offering_date)->isoFormat('D MMMM Y') }}</div>
            </td>
        </tr>
    </table>

    {{-- ── Offering + Channel Info ─────────────────────────────────── --}}
    <table class="info-row">
        <tr>
            <td>
                <div class="info-box">
                    <div class="info-box-label">Informasi Penawaran</div>
                    <table class="info-line">
                        <tr>
                            <td class="lbl">No. Ref</td>
                            <td class="val mono">{{ $offering->ref_no ?? '—' }}</td>
                        </tr>
                        <tr>
                            <td class="lbl">No. Penawaran</td>
                            <td class="val mono" style="font-size:9px; color:#6783c1">{{ $offering->offering_no }}</td>
                        </tr>
                        <tr>
                            <td class="lbl">Tanggal Penawaran</td>
                            <td class="val">{{ \Carbon\Carbon::parse($offering->offering_date)->isoFormat('D MMM Y') }}</td>
                        </tr>
                        @if($offering->valid_until)
                        <tr>
                            <td class="lbl">Berlaku Hingga</td>
                            <td class="val" style="color:#D4AF37; font-weight:700">{{ \Carbon\Carbon::parse($offering->valid_until)->isoFormat('D MMM Y') }}</td>
                        </tr>
                        @endif
                        <tr>
                            <td class="lbl">Sales</td>
                            <td class="val">{{ $offering->sales?->name ?? '—' }}</td>
                        </tr>
                        <tr>
                            <td class="lbl">Status</td>
                            <td class="val">
                                <span class="status-badge status-{{ $offering->status }}">{{ ucfirst($offering->status) }}</span>
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
            <td>
                <div class="info-box">
                    <div class="info-box-label">Kepada Yth.</div>
                    <table class="info-line">
                        <tr>
                            <td class="lbl">Perusahaan</td>
                            <td class="val" style="font-size:11px; font-weight:800; color:#0d1424">{{ $offering->channel?->company_name ?? '—' }}</td>
                        </tr>
                        <tr>
                            <td class="lbl">Kode</td>
                            <td class="val mono">{{ $offering->channel?->channel_code ?? '—' }}</td>
                        </tr>
                        @if($offering->channel?->owner_name)
                        <tr>
                            <td class="lbl">Pemilik</td>
                            <td class="val">{{ $offering->channel->owner_name }}</td>
                        </tr>
                        @endif
                        @if($offering->channel?->phone)
                        <tr>
                            <td class="lbl">Telepon</td>
                            <td class="val">{{ $offering->channel->phone }}</td>
                        </tr>
                        @endif
                        @if($offering->channel?->email)
                        <tr>
                            <td class="lbl">Email</td>
                            <td class="val" style="font-size:9px">{{ $offering->channel->email }}</td>
                        </tr>
                        @endif
                        @if($offering->channel?->address || $offering->channel?->city)
                        <tr>
                            <td class="lbl">Alamat</td>
                            <td class="val" style="font-size:9px; line-height:1.4">
                                {{ collect([$offering->channel->address, $offering->channel->district, $offering->channel->city, $offering->channel->province])->filter()->join(', ') }}
                            </td>
                        </tr>
                        @endif
                    </table>
                </div>
            </td>
        </tr>
    </table>

    {{-- ── Items ──────────────────────────────────────────────────── --}}
    <div class="section-label">Detail Penawaran Barang</div>
    <table class="items-table">
        <thead>
            <tr>
                <th class="no-col">#</th>
                <th>Produk</th>
                <th>Kode Barang</th>
                <th class="right" style="width:40px">Qty</th>
                <th class="right" style="width:100px">Harga / Unit</th>
                <th class="right" style="width:100px">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($offering->items as $i => $item)
            <tr>
                <td style="color:#8da2d1; font-size:9px; text-align:center">{{ $i + 1 }}</td>
                <td>
                    <div class="product-name">{{ $item->inventory?->product ?? '—' }}</div>
                    @if($item->inventory?->spesifikasi)
                        <div class="product-spec">{{ $item->inventory->spesifikasi }}</div>
                    @endif
                </td>
                <td>
                    <div class="sku">{{ $item->inventory?->sku_no ?? '—' }}</div>
                    @if($item->inventory?->kode_barang)
                        <div style="color:#8da2d1; font-size:9px">{{ $item->inventory->kode_barang }}</div>
                    @endif
                </td>
                <td class="right" style="text-align:center">{{ $item->qty }}</td>
                <td class="right">Rp {{ number_format($item->price, 0, ',', '.') }}</td>
                <td class="right" style="color:#D4AF37">Rp {{ number_format($item->total, 0, ',', '.') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    {{-- ── Totals ──────────────────────────────────────────────────── --}}
    <table class="totals-row">
        <tr>
            <td class="totals-left">
                @if($offering->note)
                <div class="notes-box">
                    <div class="notes-label">Catatan</div>
                    {{ $offering->note }}
                </div>
                @endif
            </td>
            <td class="totals-right">
                <div class="totals-box">
                    <table class="totals-line">
                        <tr>
                            <td class="t-lbl">Subtotal</td>
                            <td class="t-val">Rp {{ number_format($offering->subtotal, 0, ',', '.') }}</td>
                        </tr>
                        @if($offering->discount > 0)
                        <tr>
                            <td class="t-lbl">Diskon</td>
                            <td class="t-val discount">- Rp {{ number_format($offering->discount, 0, ',', '.') }}</td>
                        </tr>
                        @endif
                        <tr>
                            <td class="t-lbl">Pajak ({{ $offering->tax > 0 && $offering->subtotal > 0 ? round(($offering->tax / $offering->subtotal) * 100) : 0 }}%)</td>
                            <td class="t-val">Rp {{ number_format($offering->tax, 0, ',', '.') }}</td>
                        </tr>
                        <tr class="grand-row">
                            <td class="t-lbl" style="color:#d9e0f0; font-size:11px; font-weight:800">Grand Total</td>
                            <td class="t-val">Rp {{ number_format($offering->grand_total, 0, ',', '.') }}</td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>

    {{-- ── Catatan Penting ─────────────────────────────────────────── --}}
    <div class="important-box">
        <div class="important-label">Catatan Penting</div>
        <ul class="important-list">
            <li>Harga berlaku hingga {{ $offering->valid_until ? \Carbon\Carbon::parse($offering->valid_until)->isoFormat('D MMMM Y') : '—' }}.</li>
            <li>Harga sewaktu-waktu dapat berubah tanpa pemberitahuan.</li>
            <li>Untuk informasi lebih lanjut hubungi sales representative Anda.</li>
        </ul>
    </div>

    {{-- ── Signature ───────────────────────────────────────────────── --}}
    <table class="signature-table">
        <tr>
            <td class="sig-cell">
                <div class="sig-line"></div>
                <div class="sig-title">Dibuat Oleh</div>
                <div class="sig-name">{{ $offering->sales?->name ?? '—' }}</div>
            </td>
            <td class="sig-cell">
                <div class="sig-line"></div>
                <div class="sig-title">Disetujui Oleh</div>
                <div class="sig-name">&nbsp;</div>
            </td>
            <td class="sig-cell">
                <div class="sig-line"></div>
                <div class="sig-title">Diterima Oleh</div>
                <div class="sig-name">{{ $offering->channel?->company_name ?? '—' }}</div>
            </td>
        </tr>
    </table>

    {{-- ── Footer ──────────────────────────────────────────────────── --}}
    <div class="footer">
        <strong>{{ $company['name'] }}</strong> &bull; Dokumen ini dicetak secara otomatis dari sistem CIMS &bull;
        Dicetak: {{ \Carbon\Carbon::now()->isoFormat('D MMM Y, HH:mm') }}
    </div>

</div>
</body>
</html>
