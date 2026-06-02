<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id'         => $request->user()->id,
                    'name'       => $request->user()->name,
                    'email'      => $request->user()->email,
                    'role'       => $request->user()->role,
                    'avatar_url' => $request->user()->avatar
                                    ? \Illuminate\Support\Facades\Storage::disk('public')->url($request->user()->avatar)
                                    : null,
                ] : null,
            ],
            'flash' => [
                'success'         => fn () => $request->session()->get('success'),
                'error'           => fn () => $request->session()->get('error'),
                'lockout_seconds' => fn () => $request->session()->get('lockout_seconds'),
            ],
            'unreadNotifications' => fn () => $request->user()
                ? $request->user()->unreadNotifications()->count()
                : 0,
            'company' => fn () => [
                'name'     => \App\Models\CatalogSetting::getValue('company_name', 'CIMS'),
                'tagline'  => \App\Models\CatalogSetting::getValue('company_tagline', ''),
                'logo_url' => (fn ($p) => $p ? \Illuminate\Support\Facades\Storage::disk('public')->url($p) : null)(
                    \App\Models\CatalogSetting::getValue('company_logo_path')
                ),
            ],
        ];
    }
}
