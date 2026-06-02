<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Installment;
use App\Models\Payment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PaymentController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'status', 'type', 'overdue', 'sort_by', 'sort_dir']);

        $sortable = ['created_at', 'payment_status', 'type_order'];
        $sortBy   = in_array($filters['sort_by'] ?? '', $sortable, true) ? $filters['sort_by'] : 'created_at';
        $sortDir  = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $payments = Payment::with([
            // withTrashed() so soft-deleted orders still populate their data
            'order' => fn ($q) => $q->withTrashed()->select('id', 'order_no', 'ref_no', 'grand_total', 'channel_id', 'deleted_at'),
            'order.channel:id,company_name',
            'installments',
        ])
            ->when($filters['search'] ?? null, function ($q, $search) {
                // withTrashed() inside callback so soft-deleted orders are searchable too
                $q->whereHas('order', function ($oq) use ($search) {
                    $oq->withTrashed()
                        ->where('order_no', 'like', "%{$search}%")
                        ->orWhereHas('channel', fn ($cq) => $cq->where('company_name', 'like', "%{$search}%"));
                });
            })
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('payment_status', $status))
            ->when($filters['type'] ?? null, fn ($q, $type) => $q->where('type_order', $type))
            // Overdue filter: payments that have at least one late installment
            ->when(($filters['overdue'] ?? '') === '1', fn ($q) =>
                $q->whereHas('installments', fn ($iq) => $iq->where('status', 'late'))
            )
            ->orderBy($sortBy, $sortDir)
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Payments/Index', [
            'payments' => $payments,
            'filters' => $filters,
        ]);
    }

    public function show(Payment $payment): Response
    {
        $payment->load([
            'order.channel',
            'order.items.inventory',
            'installments',
        ]);

        return Inertia::render('Orders/Show', [
            'order' => $payment->order,
        ]);
    }

    public function payInstallment(Request $request, Installment $installment): RedirectResponse
    {
        $request->validate([
            'paid_date' => ['nullable', 'date'],
        ]);

        DB::transaction(function () use ($installment, $request) {
            // Lock the payment row first to prevent concurrent over-payment
            $payment = Payment::where('id', $installment->payment_id)->lockForUpdate()->first();

            $installment->update([
                'status'    => 'paid',
                'paid_date' => $request->input('paid_date', now()->toDateString()),
            ]);

            // Recompute remaining debt from the actual sum of unpaid installments
            $unpaidTotal = $payment->installments()->where('status', '!=', 'paid')->sum('amount');
            $payment->remaining_debt  = max(0, $unpaidTotal);
            $payment->payment_status  = $unpaidTotal <= 0 ? 'paid' : 'partial';
            $payment->save();
        });

        return back()->with('success', 'Installment marked as paid.');
    }
}
