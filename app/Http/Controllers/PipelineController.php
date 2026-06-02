<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Models\Inventory;
use App\Models\Pipeline;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class PipelineController extends Controller
{
    private const STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

    public function index(): Response
    {
        $pipelines = Pipeline::with([
            'channel:id,channel_code,company_name,successful_order,pending_order,cancelation_order',
            'sales:id,name',
        ])->latest()->get();

        $grouped = collect(self::STAGES)->mapWithKeys(fn ($stage) => [
            $stage => $pipelines->where('stage', $stage)->values(),
        ]);

        $totalValue    = $pipelines->whereNotIn('stage', ['lost'])->sum('value');
        $weightedValue = $pipelines->whereNotIn('stage', ['won', 'lost'])
            ->sum(fn ($p) => ($p->value ?? 0) * ($p->probability / 100));

        $channels = Channel::where('status', 'active')
            ->orderBy('company_name')
            ->get(['id', 'channel_code', 'company_name']);

        $inventories = Inventory::select('id', 'sku_no', 'product', 'qty')
            ->orderBy('product')
            ->get();

        return Inertia::render('Pipeline/Index', [
            'grouped'       => $grouped,
            'totalValue'    => round($totalValue, 2),
            'weightedValue' => round($weightedValue, 2),
            'channels'      => $channels,
            'inventories'   => $inventories,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title'               => ['required', 'string', 'max:150'],
            'channel_id'          => ['nullable', 'integer', 'exists:channels,id'],
            'value'               => ['nullable', 'numeric', 'min:0'],
            'probability'         => ['nullable', 'integer', 'min:0', 'max:100'],
            'stage'               => ['required', 'in:' . implode(',', self::STAGES)],
            'expected_close_date' => ['nullable', 'date'],
            'note'                => ['nullable', 'string'],
            'requested_items'     => ['nullable', 'string'],
        ]);

        Pipeline::create([
            ...$validated,
            'sales_id'    => Auth::id(),
            'probability' => $validated['probability'] ?? 50,
        ]);

        return back()->with('success', 'Opportunity created.');
    }

    public function update(Request $request, Pipeline $pipeline): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'title'               => ['sometimes', 'required', 'string', 'max:150'],
            'channel_id'          => ['nullable', 'integer', 'exists:channels,id'],
            'value'               => ['nullable', 'numeric', 'min:0'],
            'probability'         => ['nullable', 'integer', 'min:0', 'max:100'],
            'stage'               => ['sometimes', 'required', 'in:' . implode(',', self::STAGES)],
            'expected_close_date' => ['nullable', 'date'],
            'note'                => ['nullable', 'string'],
            'requested_items'     => ['nullable', 'string'],
            'lost_reason'         => ['nullable', 'string', 'max:255'],
        ]);

        $pipeline->update($validated);

        if ($request->wantsJson()) {
            return response()->json(['success' => true]);
        }

        return back()->with('success', 'Opportunity updated.');
    }

    public function destroy(Pipeline $pipeline): RedirectResponse
    {
        $pipeline->delete();

        return back()->with('success', 'Opportunity deleted.');
    }
}
