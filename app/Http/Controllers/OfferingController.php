<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\OfferingRequest;
use App\Models\CatalogSetting;
use App\Models\Channel;
use App\Models\Inventory;
use App\Models\Offering;
use App\Models\OfferingItem;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class OfferingController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'status', 'date_from', 'date_to', 'sort_by', 'sort_dir']);

        $sortable = ['offering_date', 'ref_no', 'grand_total', 'status', 'valid_until'];
        $sortBy   = in_array($filters['sort_by'] ?? '', $sortable, true) ? $filters['sort_by'] : 'offering_date';
        $sortDir  = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $offerings = Offering::with([
            'channel:id,channel_code,company_name',
            'sales:id,name',
        ])
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($query) use ($search) {
                    $query->where('offering_no', 'like', "%{$search}%")
                        ->orWhere('ref_no', 'like', "%{$search}%")
                        ->orWhereHas('channel', fn ($cq) => $cq->where('company_name', 'like', "%{$search}%"));
                });
            })
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->where('offering_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->where('offering_date', '<=', $date))
            ->orderBy($sortBy, $sortDir)
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Offerings/Index', [
            'offerings' => $offerings,
            'filters'   => $filters,
        ]);
    }

    public function create(Request $request): Response
    {
        $channels = Channel::where('status', 'active')
            ->get(['id', 'channel_code', 'company_name']);

        $inventories = Inventory::all(['id', 'sku_no', 'product', 'kode_barang', 'spesifikasi', 'notes', 'qty', 'srp', 'm1']);

        $initialChannelId = $request->integer('channel_id') ?: null;

        return Inertia::render('Offerings/Form', [
            'channels'         => $channels,
            'inventories'      => $inventories,
            'initialChannelId' => $initialChannelId,
        ]);
    }

    public function store(OfferingRequest $request): RedirectResponse
    {
        return DB::transaction(function () use ($request) {
            $validated = $request->validated();

            // Calculate totals from items
            $subtotal = 0;
            foreach ($validated['items'] as $item) {
                $subtotal += $item['qty'] * $item['price'];
            }

            $discount   = (float) ($validated['discount'] ?? 0);
            $taxRate    = (float) ($validated['tax_rate'] ?? 11);
            $tax        = round($subtotal * ($taxRate / 100));
            $grandTotal = $subtotal - $discount + $tax;

            // Generate ref_no: PEN03 + ddmmyy + 3-digit daily sequence
            $offeringDate = $validated['offering_date'];
            $seqToday     = Offering::whereDate('offering_date', $offeringDate)->lockForUpdate()->count();
            $seq          = $seqToday + 1;
            $datePart     = \Carbon\Carbon::parse($offeringDate)->format('dmy');
            $refNo        = 'PEN03' . $datePart . str_pad((string) $seq, 3, '0', STR_PAD_LEFT);

            $offering = Offering::create([
                'offering_no'   => 'OFF-' . strtoupper(Str::random(8)),
                'ref_no'        => $refNo,
                'channel_id'    => $validated['channel_id'],
                'sales_id'      => Auth::id(),
                'offering_date' => $validated['offering_date'],
                'valid_until'   => $validated['valid_until'] ?? null,
                'status'        => 'draft',
                'subtotal'      => $subtotal,
                'discount'      => $discount,
                'tax'           => $tax,
                'grand_total'   => $grandTotal,
                'note'          => $validated['note'] ?? null,
            ]);

            // Create offering items — do NOT deduct inventory stock (quotation only)
            foreach ($validated['items'] as $item) {
                OfferingItem::create([
                    'offering_id'  => $offering->id,
                    'inventory_id' => $item['inventory_id'],
                    'qty'          => $item['qty'],
                    'price'        => $item['price'],
                    'total'        => $item['qty'] * $item['price'],
                ]);
            }

            return redirect()->route('offerings.show', $offering)
                ->with('success', 'Offering created successfully.');
        });
    }

    public function show(Offering $offering): Response
    {
        $offering->load([
            'channel:id,channel_code,company_name,owner_name,phone,email,address,city,district,province',
            'sales:id,name',
            'items.inventory:id,sku_no,product,kode_barang,spesifikasi',
        ]);

        return Inertia::render('Offerings/Show', [
            'offering' => $offering,
        ]);
    }

    public function edit(Offering $offering): Response
    {
        $channels = Channel::where('status', 'active')
            ->get(['id', 'channel_code', 'company_name']);

        $inventories = Inventory::all(['id', 'sku_no', 'product', 'kode_barang', 'spesifikasi', 'notes', 'qty', 'srp', 'm1']);

        $offering->load('items');

        return Inertia::render('Offerings/Edit', [
            'offering'    => $offering,
            'channels'    => $channels,
            'inventories' => $inventories,
        ]);
    }

    public function update(Request $request, Offering $offering): RedirectResponse
    {
        $validated = $request->validate([
            'status'      => ['required', 'in:draft,sent,accepted,rejected,expired'],
            'valid_until' => ['nullable', 'date'],
            'note'        => ['nullable', 'string'],
        ]);

        $updateData = ['status' => $validated['status']];

        if (array_key_exists('valid_until', $validated)) {
            $updateData['valid_until'] = $validated['valid_until'];
        }
        if (array_key_exists('note', $validated)) {
            $updateData['note'] = $validated['note'];
        }

        $offering->update($updateData);

        return redirect()->route('offerings.show', $offering)
            ->with('success', 'Offering updated successfully.');
    }

    public function updateFull(OfferingRequest $request, Offering $offering): RedirectResponse
    {
        return DB::transaction(function () use ($request, $offering) {
            $validated = $request->validated();

            $subtotal = 0;
            foreach ($validated['items'] as $item) {
                $subtotal += $item['qty'] * $item['price'];
            }

            $discount   = (float) ($validated['discount'] ?? 0);
            $taxRate    = (float) ($validated['tax_rate'] ?? 11);
            $tax        = round($subtotal * ($taxRate / 100));
            $grandTotal = $subtotal - $discount + $tax;

            $offering->update([
                'channel_id'    => $validated['channel_id'],
                'offering_date' => $validated['offering_date'],
                'valid_until'   => $validated['valid_until'] ?? null,
                'subtotal'      => $subtotal,
                'discount'      => $discount,
                'tax'           => $tax,
                'grand_total'   => $grandTotal,
                'note'          => $validated['note'] ?? null,
            ]);

            $offering->items()->delete();
            foreach ($validated['items'] as $item) {
                OfferingItem::create([
                    'offering_id'  => $offering->id,
                    'inventory_id' => $item['inventory_id'],
                    'qty'          => $item['qty'],
                    'price'        => $item['price'],
                    'total'        => $item['qty'] * $item['price'],
                ]);
            }

            return redirect()->route('offerings.show', $offering)
                ->with('success', 'Offering updated successfully.');
        });
    }

    public function destroy(Offering $offering): RedirectResponse
    {
        $offering->delete();

        return redirect()->route('offerings.index')
            ->with('success', 'Offering deleted successfully.');
    }

    public function pdf(Offering $offering): \Illuminate\Http\Response
    {
        $offering->load([
            'channel:id,channel_code,company_name,owner_name,phone,email,address,city,district,province',
            'sales:id,name',
            'items.inventory:id,sku_no,product,kode_barang,spesifikasi',
        ]);

        $company = [
            'name'     => CatalogSetting::getValue('company_name', 'Component Sales'),
            'tagline'  => CatalogSetting::getValue('company_tagline', 'Sistem Integrator'),
            'logo_url' => (fn ($p) => $p ? Storage::disk('public')->url($p) : null)(
                CatalogSetting::getValue('company_logo_path')
            ),
        ];

        $pdf = Pdf::loadView('offerings.pdf', compact('offering', 'company'))
            ->setPaper('a4', 'portrait');

        $filename = 'PENAWARAN-' . ($offering->ref_no ?? $offering->offering_no) . '.pdf';

        return $pdf->download($filename);
    }

    public function convert(Offering $offering): RedirectResponse
    {
        return redirect('/orders/create?channel_id=' . $offering->channel_id)
            ->with('success', 'Membuat order baru dari penawaran ' . ($offering->ref_no ?? $offering->offering_no) . '. Silakan isi detail order.');
    }
}
