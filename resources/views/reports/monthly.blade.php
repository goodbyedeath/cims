<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Monthly Report - {{ $year }}/{{ str_pad($month, 2, '0', STR_PAD_LEFT) }}</title>
    <style>
        body { font-family: 'Helvetica', sans-serif; color: #1a2847; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #D4AF37; padding-bottom: 15px; }
        .header h1 { color: #1a2847; margin: 0; font-size: 24px; }
        .header p { color: #6783c1; margin: 5px 0 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #1a2847; color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; }
        td { padding: 8px 12px; border-bottom: 1px solid #d9e0f0; }
        tr:nth-child(even) { background: #f8f9fc; }
        .section { margin-top: 25px; }
        .section h3 { color: #1a2847; border-bottom: 2px solid #d9e0f0; padding-bottom: 8px; }
        .kpi-row { display: flex; gap: 10px; margin-bottom: 20px; }
        .kpi { background: #f0f3f9; padding: 15px; border-radius: 8px; text-align: center; flex: 1; }
        .kpi .value { font-size: 22px; font-weight: bold; color: #D4AF37; }
        .kpi .label { color: #6783c1; font-size: 10px; text-transform: uppercase; }
        .footer { margin-top: 30px; text-align: center; color: #8da2d1; font-size: 10px; border-top: 1px solid #d9e0f0; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CIMS Monthly Executive Report</h1>
        <p>{{ date('F Y', mktime(0, 0, 0, $month, 1, $year)) }}</p>
    </div>

    <table>
        <tr>
            <td style="width:20%; text-align:center; background:#f0f3f9; padding:15px;">
                <div style="font-size:24px; font-weight:bold; color:#4164b2;">{{ $totalOrders }}</div>
                <div style="color:#6783c1; font-size:9px; text-transform:uppercase;">Total Orders</div>
            </td>
            <td style="width:20%; text-align:center; background:#f0f3f9; padding:15px;">
                <div style="font-size:24px; font-weight:bold; color:#10b981;">{{ $deliveredOrders }}</div>
                <div style="color:#6783c1; font-size:9px; text-transform:uppercase;">Delivered</div>
            </td>
            <td style="width:20%; text-align:center; background:#f0f3f9; padding:15px;">
                <div style="font-size:24px; font-weight:bold; color:#ef4444;">{{ $cancelledOrders }}</div>
                <div style="color:#6783c1; font-size:9px; text-transform:uppercase;">Cancelled</div>
            </td>
            <td style="width:20%; text-align:center; background:#f0f3f9; padding:15px;">
                <div style="font-size:24px; font-weight:bold; color:#D4AF37;">Rp {{ number_format($revenue, 0, ',', '.') }}</div>
                <div style="color:#6783c1; font-size:9px; text-transform:uppercase;">Revenue</div>
            </td>
            <td style="width:20%; text-align:center; background:#f0f3f9; padding:15px;">
                <div style="font-size:24px; font-weight:bold; color:{{ $growth === null ? '#4164b2' : ($growth >= 0 ? '#10b981' : '#ef4444') }};">{{ $growth === null ? 'N/A' : ($growth >= 0 ? '+' : '') . $growth . '%' }}</div>
                <div style="color:#6783c1; font-size:9px; text-transform:uppercase;">Growth</div>
            </td>
        </tr>
    </table>

    <div class="section">
        <h3>Payment Summary</h3>
        <table>
            <thead>
                <tr><th>Status</th><th>Count</th><th>Outstanding Debt</th></tr>
            </thead>
            <tbody>
                @foreach($paymentSummary as $p)
                <tr>
                    <td style="text-transform:capitalize;">{{ $p->payment_status }}</td>
                    <td>{{ $p->count }}</td>
                    <td>Rp {{ number_format($p->total_debt ?? 0, 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="section">
        <h3>Top 10 Channels</h3>
        <table>
            <thead>
                <tr><th>#</th><th>Company</th><th>Score</th><th>Grade</th><th>Orders This Month</th></tr>
            </thead>
            <tbody>
                @foreach($topChannels as $i => $ch)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>{{ $ch->company_name }}</td>
                    <td style="font-weight:bold; color:#D4AF37;">{{ $ch->performance_score }}</td>
                    <td style="text-transform:uppercase;">{{ $ch->channel_grade }}</td>
                    <td>{{ $ch->monthly_orders ?? 0 }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="section">
        <h3>Channel Grade Distribution</h3>
        <table>
            <thead>
                <tr><th>Grade</th><th>Count</th></tr>
            </thead>
            <tbody>
                @foreach($gradeDistribution as $g)
                <tr>
                    <td style="text-transform:uppercase;">{{ $g->channel_grade }}</td>
                    <td>{{ $g->count }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="footer">
        Generated by CIMS on {{ now()->format('d M Y H:i') }}
    </div>
</body>
</html>
