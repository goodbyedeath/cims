<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\WaForm;
use App\Services\WhatsAppService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class WaFormController extends Controller
{
    public function index(): Response
    {
        $forms = WaForm::with('user:id,name')
            ->withCount('rules')
            ->latest()
            ->get();

        return Inertia::render('WaForm/Index', [
            'forms'       => $forms,
            'configured'  => ! empty(config('services.wablas.token')),
            'interactive' => (bool) config('services.wablas.interactive', false),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateForm($request);
        $data['user_id'] = Auth::id();
        WaForm::create($data);

        return back()->with('success', 'WhatsApp form dibuat.');
    }

    public function update(Request $request, WaForm $waForm): RedirectResponse
    {
        $waForm->update($this->validateForm($request));

        return back()->with('success', 'WhatsApp form diperbarui.');
    }

    public function destroy(WaForm $waForm): RedirectResponse
    {
        $waForm->delete();

        return back()->with('success', 'WhatsApp form dihapus.');
    }

    public function sendTest(Request $request, WaForm $waForm, WhatsAppService $wa): RedirectResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:20'],
        ]);

        $res = $wa->sendForm($validated['phone'], $waForm);

        if (! ($res['success'] ?? false)) {
            return back()->with('error', 'Gagal mengirim: '.($res['error'] ?? 'unknown'));
        }

        $mode = ($res['mode'] ?? '') === 'native' ? 'interaktif' : 'menu teks';

        return back()->with('success', "Form terkirim ke {$validated['phone']} ({$mode}).");
    }

    /**
     * @return array<string,mixed>
     */
    private function validateForm(Request $request): array
    {
        $type = $request->input('type', 'button');

        $rules = [
            'title'     => ['required', 'string', 'max:100'],
            'type'      => ['required', Rule::in(['button', 'list', 'product', 'product_list', 'flow'])],
            'header'    => ['nullable', 'string', 'max:60'],
            'body'      => ['required', 'string', 'max:1024'],
            'footer'    => ['nullable', 'string', 'max:60'],
            'is_active' => ['boolean'],
        ];

        switch ($type) {
            case 'button':
                $rules['items'] = ['required', 'array', 'min:1', 'max:3']; // WhatsApp: ≤3 reply buttons
                $rules['items.*.text'] = ['required', 'string', 'max:20'];
                $rules['items.*.id'] = ['nullable', 'string', 'max:50'];
                break;

            case 'list':
                $rules['button_label'] = ['required', 'string', 'max:24'];
                $rules['items'] = ['required', 'array', 'min:1'];
                $rules['items.*.title'] = ['required', 'string', 'max:24'];
                $rules['items.*.rows'] = ['required', 'array', 'min:1'];
                $rules['items.*.rows.*.title'] = ['required', 'string', 'max:24'];
                $rules['items.*.rows.*.description'] = ['nullable', 'string', 'max:72'];
                $rules['items.*.rows.*.id'] = ['nullable', 'string', 'max:50'];
                break;

            case 'product':
                $rules['config.catalog_id'] = ['required', 'string', 'max:100'];
                $rules['config.product_retailer_id'] = ['required', 'string', 'max:100'];
                break;

            case 'product_list':
                $rules['config.catalog_id'] = ['required', 'string', 'max:100'];
                $rules['items'] = ['required', 'array', 'min:1'];
                $rules['items.*.title'] = ['required', 'string', 'max:24'];
                $rules['items.*.products'] = ['required', 'array', 'min:1'];
                $rules['items.*.products.*.product_retailer_id'] = ['required', 'string', 'max:100'];
                break;

            case 'flow':
                $rules['config.flow_id'] = ['required', 'string', 'max:100'];
                $rules['config.flow_cta'] = ['required', 'string', 'max:20'];
                $rules['config.flow_screen'] = ['nullable', 'string', 'max:100'];
                $rules['config.flow_action'] = ['nullable', Rule::in(['navigate', 'data_exchange'])];
                $rules['config.flow_token'] = ['nullable', 'string', 'max:100'];
                break;
        }

        $validated = $request->validate($rules);

        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['items'] = $validated['items'] ?? [];
        $validated['config'] = $validated['config'] ?? null;
        if ($type !== 'list') {
            $validated['button_label'] = null;
        }

        return $validated;
    }
}
