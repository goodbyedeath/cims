<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Models\Order;
use App\Models\Payment;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ReportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Reports/Index');
    }

    public function weekly(Request $request): Response|HttpResponse
    {
        $startOfWeek = now()->startOfWeek();
        $endOfWeek = now()->endOfWeek();
        $period = $startOfWeek->format('d M') . ' - ' . $endOfWeek->format('d M Y');

        $ordersThisWeek = Order::whereBetween('order_date', [$startOfWeek, $endOfWeek]);

        $totalOrders = (clone $ordersThisWeek)->count();
        $deliveredOrders = (clone $ordersThisWeek)->where('status', 'delivered')->count();
        $cancelledOrders = (clone $ordersThisWeek)->where('status', 'cancel')->count();
        $pendingOrders = (clone $ordersThisWeek)->where('status', 'pending')->count();
        $revenue = (float) (clone $ordersThisWeek)->where('status', 'delivered')->sum('grand_total');
        $newChannels = Channel::whereBetween('created_at', [$startOfWeek, $endOfWeek])->count();

        $topChannels = Channel::where('status', 'active')
            ->orderByDesc('performance_score')
            ->limit(10)
            ->get(['company_name', 'performance_score', 'channel_grade']);

        $report = [
            'period' => $period,
            'totalOrders' => $totalOrders,
            'deliveredOrders' => $deliveredOrders,
            'cancelledOrders' => $cancelledOrders,
            'pendingOrders' => $pendingOrders,
            'revenue' => $revenue,
            'newChannels' => $newChannels,
            'topChannels' => $topChannels,
        ];

        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('reports.weekly', array_merge($report, [
                'topChannels' => $topChannels,
            ]));

            return $pdf->download("weekly-report-{$startOfWeek->format('Y-m-d')}.pdf");
        }

        return Inertia::render('Reports/Weekly', [
            'report' => $report,
        ]);
    }

    public function monthly(Request $request): Response|HttpResponse
    {
        $month = (int) ($request->query('month') ?: now()->month);
        $year = (int) ($request->query('year') ?: now()->year);

        $ordersThisMonth = Order::whereMonth('order_date', $month)->whereYear('order_date', $year);

        $totalOrders = (clone $ordersThisMonth)->count();
        $deliveredOrders = (clone $ordersThisMonth)->where('status', 'delivered')->count();
        $cancelledOrders = (clone $ordersThisMonth)->where('status', 'cancel')->count();
        $revenue = (float) (clone $ordersThisMonth)->where('status', 'delivered')->sum('grand_total');

        // Previous month — use day=1 to avoid Carbon overflow on days 29-31
        $prevDate    = Carbon::create($year, $month, 1)->subMonthNoOverflow();
        $prevRevenue = (float) Order::whereMonth('order_date', $prevDate->month)
            ->whereYear('order_date', $prevDate->year)
            ->where('status', 'delivered')
            ->sum('grand_total');

        $growth = $prevRevenue > 0
            ? round((($revenue - $prevRevenue) / $prevRevenue) * 100, 1)
            : ($revenue > 0 ? null : 0);

        // Top channels ranked by delivered orders in the selected month
        $topChannels = Channel::select(
                'channels.company_name',
                'channels.performance_score',
                'channels.channel_grade',
                'channels.successful_order',
                DB::raw('COUNT(orders.id) as monthly_orders')
            )
            ->leftJoin('orders', function ($join) use ($month, $year) {
                $join->on('orders.channel_id', '=', 'channels.id')
                     ->where('orders.status', 'delivered')
                     ->whereMonth('orders.order_date', $month)
                     ->whereYear('orders.order_date', $year);
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

        $report = [
            'month' => $month,
            'year' => $year,
            'totalOrders' => $totalOrders,
            'deliveredOrders' => $deliveredOrders,
            'cancelledOrders' => $cancelledOrders,
            'revenue' => $revenue,
            'growth' => $growth,
            'topChannels' => $topChannels,
            'gradeDistribution' => $gradeDistribution,
            'paymentSummary' => $paymentSummary,
        ];

        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('reports.monthly', array_merge($report, [
                'topChannels' => $topChannels,
                'gradeDistribution' => $gradeDistribution,
                'paymentSummary' => $paymentSummary,
            ]));

            return $pdf->download("monthly-report-{$year}-{$month}.pdf");
        }

        return Inertia::render('Reports/Monthly', [
            'report' => $report,
        ]);
    }
}
