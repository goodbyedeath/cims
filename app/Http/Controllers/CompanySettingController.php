<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CatalogSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class CompanySettingController extends Controller
{
    public function index(): Response
    {
        $bankAccounts = json_decode(CatalogSetting::getValue('bank_accounts', '[]'), true) ?? [];

        return Inertia::render('Settings/Company', [
            'company' => [
                'name'                 => CatalogSetting::getValue('company_name', ''),
                'tagline'              => CatalogSetting::getValue('company_tagline', ''),
                'phone'                => CatalogSetting::getValue('company_phone', ''),
                'email_header_name'    => CatalogSetting::getValue('email_header_name', ''),
                'email_header_initial' => CatalogSetting::getValue('email_header_initial', ''),
                'logo_url' => (fn ($p) => $p ? Storage::disk('public')->url($p) : null)(
                    CatalogSetting::getValue('company_logo_path')
                ),
            ],
            'bankAccounts' => $bankAccounts,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            'name'                 => ['required', 'string', 'max:100'],
            'tagline'              => ['nullable', 'string', 'max:150'],
            'phone'                => ['nullable', 'string', 'max:30'],
            'email_header_name'    => ['nullable', 'string', 'max:100'],
            'email_header_initial' => ['nullable', 'string', 'max:4'],
        ]);

        CatalogSetting::setValue('company_name', $request->input('name'));
        CatalogSetting::setValue('company_tagline', $request->input('tagline', ''));
        CatalogSetting::setValue('company_phone', $request->input('phone', ''));
        CatalogSetting::setValue('email_header_name', $request->input('email_header_name', ''));
        CatalogSetting::setValue('email_header_initial', $request->input('email_header_initial', ''));

        return back()->with('success', 'Company info updated.');
    }

    public function updateLogo(Request $request): RedirectResponse
    {
        $request->validate(['logo' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:2048']]);

        $old = CatalogSetting::getValue('company_logo_path');
        if ($old && Storage::disk('public')->exists($old)) {
            Storage::disk('public')->delete($old);
        }

        $path = $request->file('logo')->store('company', 'public');
        CatalogSetting::setValue('company_logo_path', $path);

        return back()->with('success', 'Logo updated.');
    }

    public function destroyLogo(): RedirectResponse
    {
        $path = CatalogSetting::getValue('company_logo_path');
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
        CatalogSetting::forgetValue('company_logo_path');

        return back()->with('success', 'Logo removed.');
    }

    public function storeBankAccount(Request $request): RedirectResponse
    {
        $request->validate([
            'bank_name'      => ['required', 'string', 'max:50'],
            'account_number' => ['required', 'string', 'max:50'],
            'account_holder' => ['required', 'string', 'max:100'],
        ]);

        $accounts   = json_decode(CatalogSetting::getValue('bank_accounts', '[]'), true) ?? [];
        $accounts[] = [
            'bank_name'      => strtoupper(trim($request->input('bank_name'))),
            'account_number' => trim($request->input('account_number')),
            'account_holder' => trim($request->input('account_holder')),
        ];
        CatalogSetting::setValue('bank_accounts', json_encode($accounts));

        return back()->with('success', 'Bank account added.');
    }

    public function destroyBankAccount(int $index): RedirectResponse
    {
        $accounts = json_decode(CatalogSetting::getValue('bank_accounts', '[]'), true) ?? [];
        array_splice($accounts, $index, 1);
        CatalogSetting::setValue('bank_accounts', json_encode(array_values($accounts)));

        return back()->with('success', 'Bank account removed.');
    }
}
