<?php

use App\Http\Controllers\AiScoreController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\ChannelController;
use App\Http\Controllers\CompanySettingController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\OfferingController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\BlastTemplateController;
use App\Http\Controllers\ChannelRequestController;
use App\Http\Controllers\EmailBlastController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\LoginAttemptController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\PipelineController;
use App\Http\Controllers\ProductCatalogController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\WaBlastController;
use App\Http\Controllers\UnsubscribeController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// ── Health check — uptime monitors hit this; returns 200 or 503 ───────────────
Route::get('/health', function () {
    $checks = ['db' => false, 'cache' => false, 'storage' => false];

    try { DB::select('SELECT 1'); $checks['db'] = true; } catch (\Throwable) {}
    try { cache()->put('health', 1, 5); $checks['cache'] = cache()->get('health') === 1; } catch (\Throwable) {}
    $checks['storage'] = is_writable(storage_path('logs'));

    $ok = !in_array(false, $checks, true);
    return response()->json([
        'status'  => $ok ? 'ok' : 'degraded',
        'checks'  => $checks,
        'version' => config('app.version', '1.0'),
        'ts'      => now()->toIso8601String(),
    ], $ok ? 200 : 503);
})->middleware('throttle:30,1')->name('health');

// Unsubscribe — public, signed URL, no auth required
Route::get('/unsubscribe/{channel}', [UnsubscribeController::class, 'show'])->name('unsubscribe.show');
Route::post('/unsubscribe/{channel}', [UnsubscribeController::class, 'confirm'])->name('unsubscribe.confirm');

// Public catalog — no auth required, rate-limited, PIN-gated
Route::middleware(['throttle:catalog-public'])->group(function () {
    Route::get('/catalog/public', [ProductCatalogController::class, 'publicView'])->name('catalog.public');
    Route::post('/catalog/public/verify', [ProductCatalogController::class, 'publicVerify'])
        ->middleware('throttle:catalog-pin')
        ->name('catalog.public.verify');
    Route::post('/catalog/public/signout', [ProductCatalogController::class, 'publicSignOut'])->name('catalog.public.signout');
});

// Public search — no auth required
Route::get('/search', [SearchController::class, 'index'])->name('search.index')->middleware('throttle:60,1');
Route::post('/search/verify-pin', [SearchController::class, 'verifyPin'])->name('search.verify-pin')->middleware('throttle:5,1');
Route::post('/search/signout', [SearchController::class, 'signOut'])->name('search.signout');

// Guest — 30 req/min per IP (DDoS mitigation on public endpoints)
Route::middleware(['guest', 'throttle:30,1'])->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);

    // Password Reset
    Route::get('/forgot-password', [PasswordResetController::class, 'showForgot'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])->name('password.email');
    Route::get('/reset-password', [PasswordResetController::class, 'showReset'])->name('password.reset');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->name('password.update');
});

// Auth — 120 req/min per IP
Route::middleware(['auth', 'throttle:120,1'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::redirect('/', '/dashboard');

    // Profile
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->name('profile.password');
    Route::post('/profile/avatar', [ProfileController::class, 'updateAvatar'])->name('profile.avatar');
    Route::delete('/profile/avatar', [ProfileController::class, 'removeAvatar'])->name('profile.avatar.remove');

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Channels
    Route::resource('channels', ChannelController::class);
    Route::get('/channels-generate-code', [ChannelController::class, 'generateCode'])->name('channels.generateCode');
    Route::post('/channels-import', [ChannelController::class, 'import'])->name('channels.import');
    Route::post('/channels-sync-google-sheet', [ChannelController::class, 'syncGoogleSheet'])->name('channels.syncGoogleSheet');
    Route::post('/channels-destroy-all', [ChannelController::class, 'destroyAll'])->name('channels.destroyAll');
    Route::post('/channels-bulk-geocode', [ChannelController::class, 'bulkGeocode'])->name('channels.bulkGeocode');
    Route::post('/channels/{channel}/toggle-email-invalid', [ChannelController::class, 'toggleEmailInvalid'])->name('channels.toggleEmailInvalid');
    Route::post('/channels/{channel}/toggle-unsubscribed', [ChannelController::class, 'toggleUnsubscribed'])->name('channels.toggleUnsubscribed');

    // Orders
    Route::resource('orders', OrderController::class);
    Route::get('/orders/{order}/pdf', [OrderController::class, 'pdf'])->name('orders.pdf');

    // Offerings
    Route::resource('offerings', OfferingController::class);
    Route::get('/offerings/{offering}/pdf', [OfferingController::class, 'pdf'])->name('offerings.pdf');
    Route::post('/offerings/{offering}/convert', [OfferingController::class, 'convert'])->name('offerings.convert');
    Route::put('/offerings/{offering}/full', [OfferingController::class, 'updateFull'])->name('offerings.updateFull');

    // Payments
    Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
    Route::get('/payments/{payment}', [PaymentController::class, 'show'])->name('payments.show');
    Route::post('/installments/{installment}/pay', [PaymentController::class, 'payInstallment'])->name('installments.pay');

    // Map
    Route::get('/map', [MapController::class, 'index'])->name('map.index');

    // AI Scores
    Route::get('/ai-scores', [AiScoreController::class, 'index'])->name('ai-scores.index');
    Route::post('/ai-scores/recalculate', [AiScoreController::class, 'recalculate'])->name('ai-scores.recalculate');

    // Reports
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('/reports/weekly', [ReportController::class, 'weekly'])->name('reports.weekly');
    Route::get('/reports/monthly', [ReportController::class, 'monthly'])->name('reports.monthly');

    // Inventory
    Route::get('/inventory', [InventoryController::class, 'index'])->name('inventory.index');
    Route::post('/inventory', [InventoryController::class, 'store'])->name('inventory.store');
    Route::post('/inventory/srp-formula', [InventoryController::class, 'saveSrpFormula'])->name('inventory.srp-formula');
    Route::post('/inventory/import', [InventoryController::class, 'import'])->name('inventory.import');
    Route::post('/inventory/sync-google-sheet', [InventoryController::class, 'syncGoogleSheet'])->name('inventory.sync-google-sheet');
    Route::put('/inventory/{inventory}', [InventoryController::class, 'update'])->name('inventory.update');
    Route::delete('/inventory', [InventoryController::class, 'destroyAll'])->name('inventory.destroy-all');
    Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy'])->name('inventory.destroy');

    // Product Catalog
    Route::get('/catalog', [ProductCatalogController::class, 'index'])->name('catalog.index');
    Route::post('/catalog', [ProductCatalogController::class, 'store'])->name('catalog.store');
    Route::put('/catalog/{catalog}', [ProductCatalogController::class, 'update'])->name('catalog.update');
    Route::delete('/catalog/{catalog}', [ProductCatalogController::class, 'destroy'])->name('catalog.destroy');
    Route::get('/catalog/export', [ProductCatalogController::class, 'export'])->name('catalog.export');
    Route::post('/catalog/sync-google-sheet', [ProductCatalogController::class, 'syncGoogleSheet'])->name('catalog.sync-google-sheet');
    // Brand logos
    Route::post('/catalog/brands/logo', [ProductCatalogController::class, 'storeBrand'])->name('catalog.brands.store');
    Route::delete('/catalog/brands/logo', [ProductCatalogController::class, 'destroyBrand'])->name('catalog.brands.destroy');
    // Partner PIN management
    Route::post('/catalog/partner-pin/generate', [ProductCatalogController::class, 'generatePin'])->name('catalog.pin.generate');
    Route::post('/catalog/partner-pin/clear', [ProductCatalogController::class, 'clearPin'])->name('catalog.pin.clear');

    // WhatsApp Blast
    Route::get('/wa-blast', [WaBlastController::class, 'index'])->name('wa-blast.index');
    Route::post('/wa-blast/preview', [WaBlastController::class, 'preview'])->name('wa-blast.preview');
    Route::post('/wa-blast/send', [WaBlastController::class, 'send'])->name('wa-blast.send');
    Route::get('/wa-blast/{waBlast}', [WaBlastController::class, 'show'])->name('wa-blast.show');
    Route::delete('/wa-blast/{waBlast}', [WaBlastController::class, 'destroy'])->name('wa-blast.destroy');

    // Email Blast
    Route::get('/email-blast', [EmailBlastController::class, 'index'])->name('email-blast.index');
    Route::post('/email-blast/preview', [EmailBlastController::class, 'preview'])->name('email-blast.preview');
    Route::post('/email-blast/render-preview', [EmailBlastController::class, 'renderPreview'])->name('email-blast.render-preview');
    Route::post('/email-blast/send', [EmailBlastController::class, 'send'])->name('email-blast.send');
    Route::get('/email-blast/{emailBlast}', [EmailBlastController::class, 'show'])->name('email-blast.show');
    Route::delete('/email-blast/{emailBlast}', [EmailBlastController::class, 'destroy'])->name('email-blast.destroy');

    // Blast Templates
    Route::get('/blast-templates', [BlastTemplateController::class, 'index'])->name('blast-templates.index');
    Route::post('/blast-templates', [BlastTemplateController::class, 'store'])->name('blast-templates.store');
    Route::put('/blast-templates/{blastTemplate}', [BlastTemplateController::class, 'update'])->name('blast-templates.update');
    Route::delete('/blast-templates/{blastTemplate}', [BlastTemplateController::class, 'destroy'])->name('blast-templates.destroy');

    // Channel Requests
    Route::get('/channel-requests', [ChannelRequestController::class, 'index'])->name('channel-requests.index');
    Route::post('/channel-requests', [ChannelRequestController::class, 'store'])->name('channel-requests.store');
    Route::get('/channel-requests/{channelRequest}', [ChannelRequestController::class, 'show'])->name('channel-requests.show');
    Route::post('/channel-requests/{channelRequest}/status', [ChannelRequestController::class, 'updateStatus'])->name('channel-requests.updateStatus');
    Route::delete('/channel-requests/{channelRequest}', [ChannelRequestController::class, 'destroy'])->name('channel-requests.destroy');

    // Pipeline
    Route::get('/pipeline', [PipelineController::class, 'index'])->name('pipeline.index');
    Route::post('/pipeline', [PipelineController::class, 'store'])->name('pipeline.store');
    Route::put('/pipeline/{pipeline}', [PipelineController::class, 'update'])->name('pipeline.update');
    Route::delete('/pipeline/{pipeline}', [PipelineController::class, 'destroy'])->name('pipeline.destroy');

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead'])->name('notifications.readAll');

    // Admin only
    Route::middleware('can:manage-users')->group(function () {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');

        Route::get('/login-attempts', [LoginAttemptController::class, 'index'])->name('login-attempts.index');

        // Company Settings
        Route::get('/settings/company', [CompanySettingController::class, 'index'])->name('settings.company');
        Route::put('/settings/company', [CompanySettingController::class, 'update'])->name('settings.company.update');
        Route::post('/settings/company/logo', [CompanySettingController::class, 'updateLogo'])->name('settings.company.logo');
        Route::delete('/settings/company/logo', [CompanySettingController::class, 'destroyLogo'])->name('settings.company.logo.destroy');
        Route::post('/settings/bank-accounts', [CompanySettingController::class, 'storeBankAccount'])->name('settings.bank-accounts.store');
        Route::delete('/settings/bank-accounts/{index}', [CompanySettingController::class, 'destroyBankAccount'])->name('settings.bank-accounts.destroy');
    });
});
