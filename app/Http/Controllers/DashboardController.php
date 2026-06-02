<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Models\ChannelRequest;
use App\Models\Installment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Pipeline;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $now = now();
        $currentMonth = $now->month;
        $currentYear  = $now->year;
        $chartMonths  = (int) $request->input('months', 12);

        // ── KPI Stats ─────────────────────────────────────────────
        $totalChannels  = Channel::count();
        $activeChannels = Channel::where('status', 'active')->count();

        // Revenue = all non-cancelled orders this month
        $monthlyRevenue = (float) Order::whereNotIn('status', ['cancel'])
            ->whereMonth('order_date', $currentMonth)
            ->whereYear('order_date', $currentYear)
            ->sum('grand_total');

        $lastMonthRevenue = (float) Order::whereNotIn('status', ['cancel'])
            ->whereMonth('order_date', $now->copy()->subMonth()->month)
            ->whereYear('order_date', $now->copy()->subMonth()->year)
            ->sum('grand_total');

        $revenueGrowth = $lastMonthRevenue > 0
            ? round((($monthlyRevenue - $lastMonthRevenue) / $lastMonthRevenue) * 100, 1)
            : ($monthlyRevenue > 0 ? 100 : 0);

        $outstandingDebt = (float) Payment::where('payment_status', '!=', 'paid')
            ->sum('remaining_debt');

        $pendingOrders = Order::where('status', 'pending')->count();

        // ── Revenue Chart ──────────────────────────────────────────
        // All non-cancelled orders grouped by month
        $revenueChart = Order::whereNotIn('status', ['cancel'])
            ->where('order_date', '>=', $now->copy()->subMonths($chartMonths - 1)->startOfMonth())
            ->select(
                DB::raw("DATE_FORMAT(order_date, '%Y-%m') as month"),
                DB::raw('SUM(grand_total) as total')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        // ── Top Channels ───────────────────────────────────────────
        // Prioritise channels that have actual orders
        $topChannels = Channel::where('status', 'active')
            ->where('performance_score', '>', 0)
            ->orderByDesc('performance_score')
            ->limit(5)
            ->get(['id', 'channel_code', 'company_name', 'performance_score', 'channel_grade', 'successful_order']);

        // Fallback: if no scored channels, show top by order count
        if ($topChannels->isEmpty()) {
            $topChannels = Channel::where('status', 'active')
                ->orderByDesc('successful_order')
                ->orderByDesc('pending_order')
                ->limit(5)
                ->get(['id', 'channel_code', 'company_name', 'performance_score', 'channel_grade', 'successful_order']);
        }

        // ── Recent Orders ──────────────────────────────────────────
        $recentOrders = Order::with('channel:id,company_name')
            ->latest('order_date')
            ->limit(5)
            ->get();

        // ── AI Alerts ──────────────────────────────────────────────
        // Only channels that have been scored AND are risk graded
        $aiAlerts = Channel::where('channel_grade', 'risk')
            ->where('performance_score', '>', 0)
            ->where('status', 'active')
            ->orderBy('performance_score')
            ->limit(5)
            ->get(['id', 'channel_code', 'company_name', 'channel_grade', 'performance_score']);

        // ── Overdue Installments ───────────────────────────────────
        $overdueInstallments = Installment::where('status', 'late')
            ->with('payment.order.channel:id,company_name')
            ->limit(5)
            ->get();

        // ── Channel Requests ───────────────────────────────────────
        $channelRequests = ChannelRequest::with(['channel:id,channel_code,company_name', 'user:id,name'])
            ->latest()
            ->limit(5)
            ->get();

        $pendingRequests = ChannelRequest::where('status', 'pending')->count();

        // ── Pipeline Stats ─────────────────────────────────────────
        $allPipelines = Pipeline::all(['id', 'stage', 'value', 'probability']);
        $wonCount      = $allPipelines->where('stage', 'won')->count();
        $lostCount     = $allPipelines->where('stage', 'lost')->count();
        $closedCount   = $wonCount + $lostCount;

        $pipelineStats = [
            'totalValue'    => round((float) $allPipelines->whereNotIn('stage', ['lost'])->sum('value'), 2),
            'weightedValue' => round($allPipelines->whereNotIn('stage', ['won', 'lost'])->sum(
                fn ($p) => ((float) ($p->value ?? 0)) * ($p->probability / 100)
            ), 2),
            'winRate'    => $closedCount > 0 ? round($wonCount / $closedCount * 100, 1) : null,
            'openCount'  => $allPipelines->whereNotIn('stage', ['won', 'lost'])->count(),
            'byStage'    => $allPipelines->groupBy('stage')->map->count(),
        ];

        $upcomingDeals = Pipeline::whereNotIn('stage', ['won', 'lost'])
            ->whereNotNull('expected_close_date')
            ->orderBy('expected_close_date')
            ->with('channel:id,company_name')
            ->limit(4)
            ->get(['id', 'title', 'channel_id', 'value', 'probability', 'stage', 'expected_close_date']);

        return Inertia::render('Dashboard/Index', [
            'stats' => [
                'totalChannels'  => $totalChannels,
                'activeChannels' => $activeChannels,
                'monthlyRevenue' => $monthlyRevenue,
                'revenueGrowth'  => $revenueGrowth,
                'outstandingDebt' => $outstandingDebt,
                'pendingOrders'  => $pendingOrders,
            ],
            'revenueChart'     => $revenueChart,
            'chartMonths'      => $chartMonths,
            'topChannels'      => $topChannels,
            'recentOrders'     => $recentOrders,
            'aiAlerts'         => $aiAlerts,
            'overdueInstallments' => $overdueInstallments,
            'channelRequests'  => $channelRequests,
            'pendingRequests'  => $pendingRequests,
            'pipelineStats'    => $pipelineStats,
            'upcomingDeals'    => $upcomingDeals,
        ]);
    }
}
