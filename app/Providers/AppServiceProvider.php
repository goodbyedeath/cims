<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\CatalogSetting;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // 30 req/min per IP for the public catalog page
        RateLimiter::for('catalog-public', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });

        // 5 PIN attempts/min per IP — brute-force protection
        RateLimiter::for('catalog-pin', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Public channel registration — OTP sends are the abusable action
        // (each one fires a WhatsApp message), so keep them tight.
        RateLimiter::for('catalog-otp', function (Request $request) {
            return Limit::perMinute(3)->by($request->ip());
        });
        RateLimiter::for('catalog-register', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Share company branding (logo, name) with the root Blade view so
        // favicon, PWA meta tags, and <title> update whenever settings change.
        View::composer('app', function ($view) {
            try {
                $logoPath   = CatalogSetting::getValue('company_logo_path');
                $logoUrl    = $logoPath ? Storage::disk('public')->url($logoPath) : null;
                $companyName = CatalogSetting::getValue('company_name', 'CIMS');
            } catch (\Throwable) {
                // DB may not be available yet during migrations/setup
                $logoUrl     = null;
                $companyName = 'CIMS';
            }

            $view->with([
                'dynamicLogoUrl'    => $logoUrl,
                'dynamicCompanyName' => $companyName,
            ]);
        });
    }
}
