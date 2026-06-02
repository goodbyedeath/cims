<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\OrderRequest;
use App\Models\Channel;
use App\Models\Installment;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Pipeline;
use App\Models\User;
use App\Notifications\LowStockNotification;
use App\Notifications\NewOrderNotification;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'status', 'date_from', 'date_to', 'sort_by', 'sort_dir']);

        $sortable = ['order_date', 'order_no', 'grand_total', 'status'];
        $sortBy   = in_array($filters['sort_by'] ?? '', $sortable, true) ? $filters['sort_by'] : 'order_date';
        $sortDir  = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $orders = Order::with([
            'channel:id,channel_code,company_name',
            'sales:id,name',
            'payment:id,order_id,payment_status',
        ])
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($query) use ($search) {
                    $query->where('order_no', 'like', "%{$search}%")
                        ->orWhereHas('channel', fn ($cq) => $cq->where('company_name', 'like', "%{$search}%"));
                });
            })
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('order_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('order_date', '<=', $date))
            ->orderBy($sortBy, $sortDir)
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Orders/Index', [
            'orders' => $orders,
            'filters' => $filters,
        ]);
    }

    public function create(Request $request): Response
    {
        $channels = Channel::where('status', 'active')
            ->get(['id', 'channel_code', 'company_name']);

        $inventories = Inventory::all(['id', 'sku_no', 'product', 'kode_barang', 'spesifikasi', 'notes', 'qty', 'srp', 'm1']);

        $initialChannelId = $request->integer('channel_id') ?: null;

        // If coming from a pipeline opportunity, pass its context
        $pipelineHint = null;
        if ($pipelineId = $request->integer('pipeline_id')) {
            $pl = Pipeline::with('channel:id,company_name')->find($pipelineId, ['id', 'title', 'channel_id', 'value', 'note']);
            if ($pl) {
                $pipelineHint = ['id' => $pl->id, 'title' => $pl->title, 'value' => $pl->value, 'note' => $pl->note];
                $initialChannelId = $initialChannelId ?? $pl->channel_id;
            }
        }

        return Inertia::render('Orders/Form', [
            'channels'         => $channels,
            'inventories'      => $inventories,
            'initialChannelId' => $initialChannelId,
            'pipelineHint'     => $pipelineHint,
        ]);
    }

    public function store(OrderRequest $request): RedirectResponse
    {
        try {
        return DB::transaction(function () use ($request) {
            $validated = $request->validated();

            $channel = Channel::find($validated['channel_id']);
            if ($channel && $channel->status === 'blacklist') {
                return back()->withErrors(['channel_id' => 'Channel ini diblacklist dan tidak dapat membuat pesanan baru.']);
            }

            // Calculate totals from items
            $subtotal = 0;
            foreach ($validated['items'] as $item) {
                $subtotal += $item['qty'] * $item['price'];
            }

            $discount = (float) ($validated['discount'] ?? 0);
            $taxRate = (float) ($validated['tax_rate'] ?? 11);
            $tax = round($subtotal * ($taxRate / 100));
            $grandTotal = $subtotal - $discount + $tax;

            // Generate ref_no: DIS03 + ddmm0yy + 3-digit daily sequence (e.g. DIS032805026001)
            $orderDate  = $validated['order_date'];
            $d          = \Carbon\Carbon::parse($orderDate);
            $datePart   = $d->format('dm') . '0' . $d->format('y'); // ddmm0yy e.g. 2805026
            $prefix     = 'DIS03' . $datePart;
            // Deleted orders have null ref_no, so withTrashed() is not needed
            $lastRefNo  = Order::where('ref_no', 'like', $prefix . '%')
                ->lockForUpdate()
                ->max('ref_no');
            $seq        = $lastRefNo ? ((int) substr($lastRefNo, -3)) + 1 : 1;
            $refNo      = $prefix . str_pad((string) $seq, 3, '0', STR_PAD_LEFT);

            $order = Order::create([
                'order_no' => 'ORD-' . strtoupper(Str::random(8)),
                'ref_no'   => $refNo,
                'channel_id' => $validated['channel_id'],
                'sales_id' => Auth::id(),
                'order_date' => $validated['order_date'],
                'delivery_date' => $validated['delivery_date'] ?? null,
                'status' => 'pending',
                'payment_method' => $validated['payment_method'],
                'subtotal' => $subtotal,
                'discount' => $discount,
                'tax' => $tax,
                'grand_total' => $grandTotal,
                'note' => $validated['note'] ?? null,
            ]);

            // Lock & pre-validate all stock before writing any order items
            // (lockForUpdate inside the transaction prevents concurrent over-selling)
            $inventoryLocks = [];
            foreach ($validated['items'] as $item) {
                $inv = Inventory::where('id', $item['inventory_id'])->lockForUpdate()->first();
                if ($inv && $inv->qty !== null && $inv->qty < $item['qty']) {
                    throw new \RuntimeException(
                        "Stok tidak cukup untuk produk: {$inv->product}. Tersedia: {$inv->qty}, diminta: {$item['qty']}."
                    );
                }
                $inventoryLocks[$item['inventory_id']] = $inv;
            }

            // Create order items & deduct inventory stock
            foreach ($validated['items'] as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'inventory_id' => $item['inventory_id'],
                    'qty' => $item['qty'],
                    'price' => $item['price'],
                    'total' => $item['qty'] * $item['price'],
                ]);

                $inventory = $inventoryLocks[$item['inventory_id']] ?? null;
                if ($inventory && $inventory->qty !== null) {
                    $inventory->decrement('qty', $item['qty']);
                }
            }

            // Create payment
            $paymentType = $validated['payment_type'] ?? 'cash';
            $dp = $paymentType === 'cash' ? $grandTotal : (float) ($validated['dp'] ?? 0);
            $remaining = max(0, $grandTotal - $dp);
            $installmentCount = $paymentType === 'installment' ? (int) ($validated['installment_count'] ?? 0) : 0;

            $payment = Payment::create([
                'order_id' => $order->id,
                'type_order' => $paymentType,
                'dp' => $dp,
                'remaining_debt' => $remaining,
                'installment_count' => $installmentCount,
                'payment_status' => $remaining <= 0 ? 'paid' : ($dp > 0 ? 'partial' : 'unpaid'),
            ]);

            // Create installments if applicable
            if ($paymentType === 'installment' && $installmentCount > 0 && $remaining > 0) {
                $installmentAmount = $remaining / $installmentCount;

                for ($i = 1; $i <= $installmentCount; $i++) {
                    Installment::create([
                        'payment_id' => $payment->id,
                        'installment_no' => $i,
                        'due_date' => \Carbon\Carbon::parse($validated['order_date'])->addMonths($i),
                        'amount' => round($installmentAmount),
                        'percentage' => round(100 / $installmentCount, 2),
                        'status' => 'unpaid',
                    ]);
                }
            }

            // Update channel counters
            Channel::where('id', $validated['channel_id'])->increment('pending_order');

            // Notify all users about new order
            $order->load('channel:id,company_name');
            $users = User::all();
            foreach ($users as $user) {
                $user->notify(new NewOrderNotification($order));
            }

            // Check low stock after deduction
            foreach ($validated['items'] as $item) {
                $inv = Inventory::find($item['inventory_id']);
                if ($inv && $inv->qty !== null && $inv->qty <= 5) {
                    foreach ($users as $user) {
                        $user->notify(new LowStockNotification($inv));
                    }
                }
            }

            return redirect()->route('orders.show', $order)
                ->with('success', 'Order created successfully.');
        });
        } catch (\RuntimeException $e) {
            // Friendly user-facing error (e.g. insufficient stock) instead of 500
            return back()->with('error', $e->getMessage());
        }
    }

    public function show(Order $order): Response
    {
        $order->load([
            'channel:id,channel_code,company_name,owner_name,address,city,district,province',
            'sales:id,name',
            'items.inventory:id,sku_no,product,kode_barang,spesifikasi',
            'payment.installments',
        ]);

        $channelPipelines = $order->channel_id
            ? Pipeline::where('channel_id', $order->channel_id)
                ->whereNotIn('stage', ['won', 'lost'])
                ->orderBy('expected_close_date')
                ->get(['id', 'title', 'stage', 'value', 'probability', 'expected_close_date'])
            : collect();

        $bankAccounts = json_decode(\App\Models\CatalogSetting::getValue('bank_accounts', '[]'), true) ?? [];

        return Inertia::render('Orders/Show', [
            'order'            => $order,
            'channelPipelines' => $channelPipelines,
            'bankAccounts'     => $bankAccounts,
        ]);
    }

    public function edit(Order $order): Response
    {
        $order->load('items.inventory:id,sku_no,product,kode_barang,spesifikasi,qty,srp,m1');

        $channels    = Channel::where('status', 'active')->get(['id', 'channel_code', 'company_name']);
        $inventories = Inventory::all(['id', 'sku_no', 'product', 'kode_barang', 'spesifikasi', 'notes', 'qty', 'srp', 'm1']);

        return Inertia::render('Orders/Form', [
            'channels'    => $channels,
            'inventories' => $inventories,
            'order'       => $order,
        ]);
    }

    public function update(Request $request, Order $order): RedirectResponse
    {
        // Full edit from the edit form (contains items)
        if ($request->has('items')) {
            return $this->fullUpdate($request, $order);
        }

        // Status-only update from the Show page
        $validated = $request->validate([
            'status' => ['required', 'in:pending,confirmed,process,delivered,cancel'],
            'delivery_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
        ]);

        $oldStatus = $order->status;
        $newStatus = $validated['status'];

        DB::transaction(function () use ($order, $validated, $oldStatus, $newStatus) {
            $updateData = ['status' => $newStatus];

            if (isset($validated['delivery_date'])) {
                $updateData['delivery_date'] = $validated['delivery_date'];
            }
            if (isset($validated['note'])) {
                $updateData['note'] = $validated['note'];
            }

            if ($newStatus === 'delivered' && !$order->delivery_date) {
                $updateData['delivery_date'] = now()->toDateString();
            }

            $order->update($updateData);

            // Sync payment status + ref_no with order status change
            if ($oldStatus !== $newStatus) {
                $payment = $order->payment()->lockForUpdate()->first();
                if ($newStatus === 'cancel') {
                    // Free the sequence slot so a new order today can reuse this number
                    $order->update(['ref_no' => null]);
                    $payment?->update(['payment_status' => 'cancelled']);
                } elseif ($oldStatus === 'cancel') {
                    // Restore payment status (ref_no stays null — slot may have been reused)
                    $payment?->update(['payment_status' => $this->derivePaymentStatus($payment)]);
                }
            }

            $channel = $order->channel;
            if ($channel && $oldStatus !== $newStatus) {
                match ($oldStatus) {
                    'pending'   => $channel->pending_order > 0    ? $channel->decrement('pending_order')    : null,
                    'delivered' => $channel->successful_order > 0  ? $channel->decrement('successful_order')  : null,
                    'cancel'    => $channel->cancelation_order > 0 ? $channel->decrement('cancelation_order') : null,
                    default     => null,
                };
                match ($newStatus) {
                    'pending'   => $channel->increment('pending_order'),
                    'delivered' => $channel->increment('successful_order'),
                    'cancel'    => $channel->increment('cancelation_order'),
                    default     => null,
                };
            }
        });

        return redirect()->route('orders.show', $order)
            ->with('success', 'Order updated successfully.');
    }

    private function fullUpdate(Request $request, Order $order): RedirectResponse
    {
        try {
            return DB::transaction(function () use ($request, $order) {
                $validated = $request->validate([
                    'channel_id'     => ['required', 'exists:channels,id'],
                    'order_date'     => ['required', 'date'],
                    'delivery_date'  => ['nullable', 'date'],
                    'payment_method' => ['required', 'in:cash,transfer,credit'],
                    'discount'       => ['nullable', 'numeric', 'min:0'],
                    'tax_rate'       => ['nullable', 'numeric', 'min:0', 'max:100'],
                    'note'           => ['nullable', 'string'],
                    'items'          => ['required', 'array', 'min:1'],
                    'items.*.inventory_id' => ['required', 'exists:inventories,id'],
                    'items.*.qty'    => ['required', 'integer', 'min:1'],
                    'items.*.price'  => ['required', 'numeric', 'min:0'],
                ]);

                // Restore stock for all existing items before replacing them
                $order->load('items');
                foreach ($order->items as $oldItem) {
                    $inv = Inventory::find($oldItem->inventory_id);
                    if ($inv && $inv->qty !== null) {
                        $inv->increment('qty', $oldItem->qty);
                    }
                }

                $order->items()->delete();

                // Recalculate totals
                $subtotal = 0;
                foreach ($validated['items'] as $item) {
                    $subtotal += $item['qty'] * $item['price'];
                }
                $discount   = (float) ($validated['discount'] ?? 0);
                $taxRate    = (float) ($validated['tax_rate'] ?? 11);
                $tax        = round($subtotal * ($taxRate / 100));
                $grandTotal = $subtotal - $discount + $tax;

                // Lock & validate stock for incoming items
                $inventoryLocks = [];
                foreach ($validated['items'] as $item) {
                    $inv = Inventory::where('id', $item['inventory_id'])->lockForUpdate()->first();
                    if ($inv && $inv->qty !== null && $inv->qty < $item['qty']) {
                        throw new \RuntimeException(
                            "Stok tidak cukup untuk produk: {$inv->product}. Tersedia: {$inv->qty}, diminta: {$item['qty']}."
                        );
                    }
                    $inventoryLocks[$item['inventory_id']] = $inv;
                }

                // Write new items & deduct stock
                foreach ($validated['items'] as $item) {
                    OrderItem::create([
                        'order_id'     => $order->id,
                        'inventory_id' => $item['inventory_id'],
                        'qty'          => $item['qty'],
                        'price'        => $item['price'],
                        'total'        => $item['qty'] * $item['price'],
                    ]);

                    $inv = $inventoryLocks[$item['inventory_id']] ?? null;
                    if ($inv && $inv->qty !== null) {
                        $inv->decrement('qty', $item['qty']);
                    }
                }

                // Handle channel counter if channel changed
                $oldChannelId = $order->channel_id;
                if ((int) $validated['channel_id'] !== (int) $oldChannelId) {
                    $oldChannel = Channel::find($oldChannelId);
                    $newChannel = Channel::find($validated['channel_id']);
                    if ($oldChannel) {
                        match ($order->status) {
                            'pending'   => $oldChannel->pending_order > 0    ? $oldChannel->decrement('pending_order')    : null,
                            'delivered' => $oldChannel->successful_order > 0  ? $oldChannel->decrement('successful_order')  : null,
                            'cancel'    => $oldChannel->cancelation_order > 0 ? $oldChannel->decrement('cancelation_order') : null,
                            default     => null,
                        };
                    }
                    if ($newChannel) {
                        match ($order->status) {
                            'pending'   => $newChannel->increment('pending_order'),
                            'delivered' => $newChannel->increment('successful_order'),
                            'cancel'    => $newChannel->increment('cancelation_order'),
                            default     => null,
                        };
                    }
                }

                $order->update([
                    'channel_id'     => $validated['channel_id'],
                    'order_date'     => $validated['order_date'],
                    'delivery_date'  => $validated['delivery_date'] ?? null,
                    'payment_method' => $validated['payment_method'],
                    'subtotal'       => $subtotal,
                    'discount'       => $discount,
                    'tax'            => $tax,
                    'grand_total'    => $grandTotal,
                    'note'           => $validated['note'] ?? null,
                ]);

                // Update payment amounts to reflect new grand_total
                // Use lockForUpdate + fresh query to avoid stale cached model
                $payment = $order->payment()->lockForUpdate()->first();
                if ($payment && $payment->payment_status !== 'cancelled') {
                    if ($payment->type_order === 'cash') {
                        $payment->update([
                            'dp'             => $grandTotal,
                            'remaining_debt' => 0,
                            'payment_status' => 'paid',
                        ]);
                    } else {
                        $newRemaining = max(0.0, $grandTotal - $payment->dp);
                        $payment->update([
                            'remaining_debt' => $newRemaining,
                            'payment_status' => $this->derivePaymentStatus(
                                $payment->fresh()->fill(['remaining_debt' => $newRemaining])
                            ),
                        ]);

                        // Redistribute amount across still-unpaid installments
                        $unpaidInstallments = $payment->installments()
                            ->where('status', '!=', 'paid')
                            ->get();
                        if ($unpaidInstallments->count() > 0) {
                            $perInstallment = round($newRemaining / $unpaidInstallments->count());
                            foreach ($unpaidInstallments as $inst) {
                                $inst->update(['amount' => $perInstallment]);
                            }
                        }
                    }
                }

                return redirect()->route('orders.show', $order)
                    ->with('success', 'Order updated successfully.');
            });
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    private function derivePaymentStatus(Payment $payment): string
    {
        if ($payment->remaining_debt <= 0) return 'paid';
        if ($payment->dp > 0)             return 'partial';
        return 'unpaid';
    }

    public function pdf(Order $order): \Illuminate\Http\Response
    {
        $order->load([
            'channel:id,channel_code,company_name,owner_name,phone,email,address,city,district,province',
            'sales:id,name',
            'items.inventory:id,sku_no,product,kode_barang,spesifikasi',
            'payment.installments',
        ]);

        $company = [
            'name'     => \App\Models\CatalogSetting::getValue('company_name', 'Component Sales'),
            'tagline'  => \App\Models\CatalogSetting::getValue('company_tagline', 'Sistem Integrator'),
            'logo_url' => (fn ($p) => $p ? \Illuminate\Support\Facades\Storage::disk('public')->url($p) : null)(
                \App\Models\CatalogSetting::getValue('company_logo_path')
            ),
        ];

        $pdf = Pdf::loadView('orders.pdf', compact('order', 'company'))
            ->setPaper('a4', 'portrait');

        $filename = 'ORDER-' . ($order->ref_no ?? $order->order_no) . '.pdf';

        return $pdf->download($filename);
    }

    public function destroy(Order $order): RedirectResponse
    {
        DB::transaction(function () use ($order) {
            $channel = $order->channel;
            if ($channel) {
                match ($order->status) {
                    'pending'   => $channel->pending_order > 0    ? $channel->decrement('pending_order')    : null,
                    'delivered' => $channel->successful_order > 0  ? $channel->decrement('successful_order')  : null,
                    'cancel'    => $channel->cancelation_order > 0 ? $channel->decrement('cancelation_order') : null,
                    default     => null,
                };
            }

            // Cancel the payment record so /payments doesn't show stale paid/unpaid status
            if ($order->payment) {
                $order->payment->update(['payment_status' => 'cancelled']);
            }

            // Free the ref_no slot so it can be reused on the same day
            $order->update(['ref_no' => null]);
            $order->delete();
        });

        return redirect()->route('orders.index')
            ->with('success', 'Order deleted successfully.');
    }
}
