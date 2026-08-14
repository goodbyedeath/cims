<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\WaBotRule;
use App\Models\WaForm;
use App\Models\WaInboundMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class WaBotController extends Controller
{
    public function index(Request $request): Response
    {
        $rules = WaBotRule::with('form:id,title')
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        $inbound = WaInboundMessage::with(['channel:id,channel_code,company_name', 'rule:id,name'])
            ->latest()
            ->limit(40)
            ->get();

        $secret = (string) config('services.wablas.secret', '');

        return Inertia::render('WaBot/Index', [
            'rules'        => $rules,
            'inbound'      => $inbound,
            'forms'        => WaForm::where('is_active', true)->orderBy('title')->get(['id', 'title', 'type']),
            'configured'   => ! empty(config('services.wablas.token')),
            'webhook_url'  => $secret !== '' ? url('/wa/webhook/'.$secret) : null,
            'has_secret'   => $secret !== '',
            'stats'        => [
                'rules'        => WaBotRule::count(),
                'active_rules' => WaBotRule::where('is_active', true)->count(),
                'inbound'      => WaInboundMessage::count(),
                'replied'      => WaInboundMessage::where('reply_sent', true)->count(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateRule($request);
        $data['user_id'] = Auth::id();
        WaBotRule::create($data);

        return back()->with('success', 'Aturan chatbot ditambahkan.');
    }

    public function update(Request $request, WaBotRule $waBotRule): RedirectResponse
    {
        $waBotRule->update($this->validateRule($request));

        return back()->with('success', 'Aturan chatbot diperbarui.');
    }

    public function destroy(WaBotRule $waBotRule): RedirectResponse
    {
        $waBotRule->delete();

        return back()->with('success', 'Aturan chatbot dihapus.');
    }

    /**
     * @return array<string,mixed>
     */
    private function validateRule(Request $request): array
    {
        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:100'],
            'match_type'    => ['required', Rule::in(['exact', 'contains', 'starts_with', 'default'])],
            'keyword'       => ['nullable', 'string', 'max:255', Rule::requiredIf(fn () => $request->match_type !== 'default')],
            'reply_type'    => ['required', Rule::in(['text', 'form'])],
            'reply_message' => ['nullable', 'string', 'max:5000', Rule::requiredIf(fn () => $request->reply_type === 'text')],
            'wa_form_id'    => ['nullable', 'exists:wa_forms,id', Rule::requiredIf(fn () => $request->reply_type === 'form')],
            'priority'      => ['nullable', 'integer', 'min:0', 'max:1000'],
            'is_active'     => ['boolean'],
        ]);

        // Clear the unused reply field so stale data doesn't linger.
        if (($validated['reply_type'] ?? 'text') === 'text') {
            $validated['wa_form_id'] = null;
        } else {
            $validated['reply_message'] = null;
        }

        $validated['priority'] = $validated['priority'] ?? 0;
        $validated['is_active'] = $validated['is_active'] ?? true;

        return $validated;
    }
}
