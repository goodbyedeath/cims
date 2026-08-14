<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\RagBackendException;
use App\Models\Channel;
use App\Models\Order;
use App\Models\Payment;
use App\Services\RagClient;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ReportController extends Controller
{
    /** Order statuses in the order we want them surfaced in breakdowns. */
    private const STATUSES = ['delivered', 'process', 'confirmed', 'pending', 'cancel'];

    public function index(): Response
    {
        return Inertia::render('Reports/Index');
    }

    public function weekly(Request $request): Response|HttpResponse
    {
        $report = $this->weeklyMetrics();

        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('reports.weekly', $report);

            return $pdf->download("weekly-report-{$report['start']}.pdf");
        }

        return Inertia::render('Reports/Weekly', [
            'report' => $report,
        ]);
    }

    public function monthly(Request $request): Response|HttpResponse
    {
        $month = (int) ($request->query('month') ?: now()->month);
        $year = (int) ($request->query('year') ?: now()->year);

        $report = $this->monthlyMetrics($month, $year);

        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('reports.monthly', $report);

            return $pdf->download("monthly-report-{$year}-{$month}.pdf");
        }

        return Inertia::render('Reports/Monthly', [
            'report' => $report,
        ]);
    }

    /**
     * Generate an AI executive narrative for a report period using the existing
     * RAG backend. Metrics are recomputed server-side (never trusted from the
     * client), embedded into the prompt, and the LLM is asked to summarise them.
     */
    public function insights(Request $request, RagClient $rag): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', 'in:weekly,monthly'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'provider' => ['nullable', 'string', 'in:ollama,gemini'],
        ]);

        if (! $rag->isConfigured()) {
            return response()->json([
                'error' => 'The AI backend is not configured.',
            ], 503);
        }

        $data = $validated['type'] === 'weekly'
            ? $this->weeklyMetrics()
            : $this->monthlyMetrics(
                (int) ($validated['month'] ?? now()->month),
                (int) ($validated['year'] ?? now()->year),
            );

        $prompt = $this->buildInsightPrompt($validated['type'], $data);

        try {
            $result = $rag->ask($prompt, 4, $validated['provider'] ?? null);
        } catch (RagBackendException $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'detail' => $e->detail,
            ], 502);
        }

        return response()->json([
            'insight' => $result['answer'] ?? '',
            'provider_used' => $result['provider_used'] ?? null,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Metric builders (shared by the page, the PDF, and the AI insight prompt)
    // ──────────────────────────────────────────────────────────────────────

    /** @return array<string,mixed> */
    private function weeklyMetrics(): array
    {
        $start = now()->startOfWeek();
        $end = now()->endOfWeek();
        $prevStart = $start->copy()->subWeek();
        $prevEnd = $end->copy()->subWeek();

        $orders = Order::whereBetween('order_date', [$start, $end]);

        $revenue = (float) (clone $orders)->where('status', 'delivered')->sum('grand_total');
        $prevRevenue = (float) Order::whereBetween('order_date', [$prevStart, $prevEnd])
            ->where('status', 'delivered')->sum('grand_total');
        $totalOrders = (clone $orders)->count();
        $prevOrders = Order::whereBetween('order_date', [$prevStart, $prevEnd])->count();

        $topChannels = Channel::where('status', 'active')
            ->orderByDesc('performance_score')
            ->limit(10)
            ->get(['company_name', 'performance_score', 'channel_grade']);

        return [
            'period' => $start->format('d M') . ' - ' . $end->format('d M Y'),
            'start' => $start->format('Y-m-d'),
            'totalOrders' => $totalOrders,
            'deliveredOrders' => (clone $orders)->where('status', 'delivered')->count(),
            'cancelledOrders' => (clone $orders)->where('status', 'cancel')->count(),
            'pendingOrders' => (clone $orders)->where('status', 'pending')->count(),
            'revenue' => $revenue,
            'newChannels' => Channel::whereBetween('created_at', [$start, $end])->count(),
            'topChannels' => $topChannels,
            'statusBreakdown' => $this->statusBreakdown($start, $end),
            'deltas' => [
                'orders' => $this->pctDelta($totalOrders, $prevOrders),
                'revenue' => $this->pctDelta($revenue, $prevRevenue),
            ],
            'trend' => $this->weeklyTrend(8),
        ];
    }

    /** @return array<string,mixed> */
    private function monthlyMetrics(int $month, int $year): array
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $orders = Order::whereBetween('order_date', [$start, $end]);

        $revenue = (float) (clone $orders)->where('status', 'delivered')->sum('grand_total');
        $totalOrders = (clone $orders)->count();

        $prevDate = $start->copy()->subMonthNoOverflow();
        $prevStart = $prevDate->copy()->startOfMonth();
        $prevEnd = $prevDate->copy()->endOfMonth();
        $prevRevenue = (float) Order::whereBetween('order_date', [$prevStart, $prevEnd])
            ->where('status', 'delivered')->sum('grand_total');
        $prevOrders = Order::whereBetween('order_date', [$prevStart, $prevEnd])->count();

        $growth = $prevRevenue > 0
            ? round((($revenue - $prevRevenue) / $prevRevenue) * 100, 1)
            : ($revenue > 0 ? null : 0);

        $topChannels = Channel::select(
                'channels.company_name',
                'channels.performance_score',
                'channels.channel_grade',
                'channels.successful_order',
                DB::raw('COUNT(orders.id) as monthly_orders')
            )
            ->leftJoin('orders', function ($join) use ($start, $end) {
                $join->on('orders.channel_id', '=', 'channels.id')
                     ->where('orders.status', 'delivered')
                     ->whereBetween('orders.order_date', [$start, $end]);
            })
            ->where('channels.status', 'active')
            ->groupBy('channels.id', 'channels.company_name', 'channels.performance_score', 'channels.channel_grade', 'channels.successful_order')
            ->orderByDesc('monthly_orders')
            ->orderByDesc('channels.performance_score')
            ->limit(10)
            ->get();

        $gradeDistribution = Channel::select('channel_grade', DB::raw('count(*) as count'))
            ->whereIn('status', ['active', 'inactive'])
            ->groupBy('channel_grade')
            ->get();

        $paymentSummary = Payment::select(
            'payment_status',
            DB::raw('count(*) as count'),
            DB::raw('SUM(remaining_debt) as total_debt')
        )
            ->groupBy('payment_status')
            ->get();

        return [
            'month' => $month,
            'year' => $year,
            'totalOrders' => $totalOrders,
            'deliveredOrders' => (clone $orders)->where('status', 'delivered')->count(),
            'cancelledOrders' => (clone $orders)->where('status', 'cancel')->count(),
            'revenue' => $revenue,
            'growth' => $growth,
            'topChannels' => $topChannels,
            'gradeDistribution' => $gradeDistribution,
            'paymentSummary' => $paymentSummary,
            'statusBreakdown' => $this->statusBreakdown($start, $end),
            'deltas' => [
                'orders' => $this->pctDelta($totalOrders, $prevOrders),
                'revenue' => $this->pctDelta($revenue, $prevRevenue),
            ],
            'trend' => $this->monthlyTrend($month, $year, 6),
        ];
    }

    /**
     * Count of orders per status within a date range, in a stable order.
     *
     * @return list<array{status:string,count:int}>
     */
    private function statusBreakdown(Carbon $start, Carbon $end): array
    {
        $rows = Order::whereBetween('order_date', [$start, $end])
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        return array_map(
            fn (string $s) => ['status' => $s, 'count' => (int) ($rows[$s] ?? 0)],
            self::STATUSES,
        );
    }

    /**
     * Delivered revenue and order volume for the last N weeks (oldest first).
     *
     * @return list<array{label:string,revenue:float,orders:int}>
     */
    private function weeklyTrend(int $weeks): array
    {
        $anchor = now()->startOfWeek();
        $trend = [];

        for ($i = $weeks - 1; $i >= 0; $i--) {
            $ws = $anchor->copy()->subWeeks($i);
            $we = $ws->copy()->endOfWeek();
            $trend[] = [
                'label' => $ws->format('d M'),
                'revenue' => (float) Order::whereBetween('order_date', [$ws, $we])
                    ->where('status', 'delivered')->sum('grand_total'),
                'orders' => Order::whereBetween('order_date', [$ws, $we])->count(),
            ];
        }

        return $trend;
    }

    /**
     * Delivered revenue and order volume for the last N months ending at the
     * selected month (oldest first).
     *
     * @return list<array{label:string,revenue:float,orders:int}>
     */
    private function monthlyTrend(int $month, int $year, int $months): array
    {
        $anchor = Carbon::create($year, $month, 1)->startOfMonth();
        $trend = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $ms = $anchor->copy()->subMonthsNoOverflow($i);
            $me = $ms->copy()->endOfMonth();
            $trend[] = [
                'label' => $ms->format('M Y'),
                'revenue' => (float) Order::whereBetween('order_date', [$ms, $me])
                    ->where('status', 'delivered')->sum('grand_total'),
                'orders' => Order::whereBetween('order_date', [$ms, $me])->count(),
            ];
        }

        return $trend;
    }

    /**
     * Percentage change vs a baseline. Returns null when there is no baseline
     * (a brand-new value with nothing to compare against).
     */
    private function pctDelta(float $current, float $prev): ?float
    {
        if ($prev <= 0) {
            return $current > 0 ? null : 0.0;
        }

        return round((($current - $prev) / $prev) * 100, 1);
    }

    /** Build a grounded prompt asking the LLM to narrate the report figures. */
    private function buildInsightPrompt(string $type, array $data): string
    {
        $idr = fn ($n) => 'Rp ' . number_format((float) $n, 0, ',', '.');

        $lines = [];
        $lines[] = $type === 'weekly'
            ? "You are a sales analyst. Write a concise executive summary of this WEEKLY business report for {$data['period']}."
            : "You are a sales analyst. Write a concise executive summary of this MONTHLY business report for "
                . Carbon::create($data['year'], $data['month'], 1)->format('F Y') . '.';

        $lines[] = '';
        $lines[] = 'Base your analysis ONLY on the figures below. Do not invent numbers.';
        $lines[] = '';
        $lines[] = 'KEY FIGURES:';
        $lines[] = "- Total orders: {$data['totalOrders']}";
        $lines[] = "- Delivered orders: {$data['deliveredOrders']}";
        $lines[] = "- Cancelled orders: {$data['cancelledOrders']}";
        $lines[] = '- Delivered revenue: ' . $idr($data['revenue']);

        if (isset($data['deltas'])) {
            $od = $data['deltas']['orders'];
            $rd = $data['deltas']['revenue'];
            $lines[] = '- Orders vs previous ' . ($type === 'weekly' ? 'week' : 'month') . ': '
                . ($od === null ? 'no prior baseline' : ($od >= 0 ? "+{$od}%" : "{$od}%"));
            $lines[] = '- Revenue vs previous ' . ($type === 'weekly' ? 'week' : 'month') . ': '
                . ($rd === null ? 'no prior baseline' : ($rd >= 0 ? "+{$rd}%" : "{$rd}%"));
        }

        if (! empty($data['statusBreakdown'])) {
            $parts = array_map(fn ($s) => "{$s['status']}={$s['count']}", $data['statusBreakdown']);
            $lines[] = '- Order status breakdown: ' . implode(', ', $parts);
        }

        if (! empty($data['trend'])) {
            $lines[] = '';
            $lines[] = ucfirst($type === 'weekly' ? 'weekly' : 'monthly') . ' delivered-revenue trend (oldest to newest):';
            foreach ($data['trend'] as $t) {
                $lines[] = "  - {$t['label']}: " . $idr($t['revenue']) . " ({$t['orders']} orders)";
            }
        }

        $top = collect($data['topChannels'] ?? [])->take(5)
            ->map(fn ($c) => is_array($c) ? $c['company_name'] : $c->company_name)
            ->filter()->values()->all();
        if (! empty($top)) {
            $lines[] = '';
            $lines[] = 'Top channels: ' . implode(', ', $top) . '.';
        }

        $lines[] = '';
        $lines[] = 'Format the answer as Markdown with these short sections:';
        $lines[] = '**Headline** (one sentence), **What changed** (2-3 bullets on trend & deltas), '
            . '**Watch-outs** (1-2 bullets on cancellations or declines), '
            . '**Recommended actions** (2-3 concrete bullets). Keep it under 200 words. Use IDR (Rp) for money.';

        return implode("\n", $lines);
    }
}
