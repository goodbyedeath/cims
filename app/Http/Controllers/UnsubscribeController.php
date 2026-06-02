<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CatalogSetting;
use App\Models\Channel;
use Illuminate\Http\Request;
use Illuminate\View\View;

class UnsubscribeController extends Controller
{
    /**
     * Show the unsubscribe confirmation page.
     * The link in the email is a signed URL valid for 30 days.
     */
    public function show(Request $request, Channel $channel): View
    {
        if (!$request->hasValidSignature()) {
            abort(403, 'Link tidak valid atau sudah kedaluwarsa.');
        }

        return view('unsubscribe', [
            'channel'        => $channel,
            'companyName'    => CatalogSetting::getValue('company_name', 'CIMS'),
            'companyTagline' => CatalogSetting::getValue('company_tagline', 'IT Component Distributor'),
            'confirmed'      => false,
            'already'        => $channel->email_unsubscribed,
        ]);
    }

    /**
     * Process the unsubscribe action (POST from confirmation form).
     */
    public function confirm(Request $request, Channel $channel): View
    {
        if (!$request->hasValidSignature()) {
            abort(403, 'Link tidak valid atau sudah kedaluwarsa.');
        }

        if (!$channel->email_unsubscribed) {
            $channel->update([
                'email_unsubscribed'    => true,
                'email_unsubscribed_at' => now(),
            ]);
        }

        return view('unsubscribe', [
            'channel'        => $channel,
            'companyName'    => CatalogSetting::getValue('company_name', 'CIMS'),
            'companyTagline' => CatalogSetting::getValue('company_tagline', 'IT Component Distributor'),
            'confirmed'      => true,
            'already'        => false,
        ]);
    }
}
