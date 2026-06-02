<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CatalogSetting;
use App\Models\Channel;
use App\Models\EmailBlast;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class EmailBlastController extends Controller
{
    public function index(): Response
    {
        $blasts = EmailBlast::with('user:id,name')
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $provinces = Channel::where('status', 'active')
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->distinct()
            ->pluck('province')
            ->filter()
            ->sort()
            ->values();

        return Inertia::render('EmailBlast/Index', [
            'blasts' => $blasts,
            'provinces' => $provinces,
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'target' => ['required', 'in:all,filtered,selected'],
            'filters' => ['nullable', 'array'],
            'channel_ids' => ['nullable', 'array'],
        ]);

        $channels = $this->buildQuery($request)
            ->get(['id', 'channel_code', 'company_name', 'email', 'province', 'channel_grade']);

        return response()->json([
            'count' => $channels->count(),
            'channels' => $channels,
        ]);
    }

    public function send(Request $request): RedirectResponse
    {
        $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:10000'],
            'sender_name' => ['nullable', 'string', 'max:100'],
            'target' => ['required', 'in:all,filtered,selected'],
            'filters' => ['nullable', 'array'],
            'channel_ids' => ['nullable', 'array'],
        ]);

        $channels = $this->buildQuery($request)
            ->get(['id', 'channel_code', 'company_name', 'email', 'owner_name']);

        if ($channels->isEmpty()) {
            return back()->with('error', 'Tidak ada channel dengan email.');
        }

        $blast = EmailBlast::create([
            'user_id' => Auth::id(),
            'title' => $request->title,
            'subject' => $request->subject,
            'body' => $request->body,
            'total_recipients' => $channels->count(),
            'status' => 'sending',
            'filters' => $request->filters,
        ]);

        $sentCount = 0;
        $failedCount = 0;

        foreach ($channels as $channel) {
            $personalBody    = $this->renderTemplate($request->body, $channel);
            $personalSubject = $this->replacePlaceholders($request->subject, $channel);

            try {
                $senderName = $request->sender_name ?: config('mail.from.name');
                $fromAddress = config('mail.from.address');

                Mail::html($personalBody, function ($msg) use ($channel, $personalSubject, $senderName, $fromAddress) {
                    $msg->from($fromAddress, $senderName)
                        ->to($channel->email)
                        ->subject($personalSubject);
                });

                $blast->recipients()->create([
                    'channel_id' => $channel->id,
                    'email' => $channel->email,
                    'status' => 'sent',
                    'sent_at' => now(),
                ]);
                $sentCount++;
            } catch (\Throwable $e) {
                Log::error("Email blast failed [{$channel->email}]: {$e->getMessage()}");
                $blast->recipients()->create([
                    'channel_id' => $channel->id,
                    'email' => $channel->email,
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ]);
                $failedCount++;
            }

            usleep(200000); // 0.2s delay
        }

        $blast->update([
            'sent_count' => $sentCount,
            'failed_count' => $failedCount,
            'status' => $failedCount === $channels->count() ? 'failed' : 'completed',
        ]);

        return back()->with('success', "Email blast selesai: {$sentCount} terkirim, {$failedCount} gagal.");
    }

    public function show(EmailBlast $emailBlast): Response
    {
        $emailBlast->load([
            'user:id,name',
            'recipients.channel:id,channel_code,company_name',
        ]);

        return Inertia::render('EmailBlast/Show', [
            'blast' => $emailBlast,
        ]);
    }

    public function destroy(EmailBlast $emailBlast): RedirectResponse
    {
        $emailBlast->delete();

        return back()->with('success', 'Email blast history deleted.');
    }

    public function renderPreview(Request $request): JsonResponse
    {
        $request->validate([
            'body' => ['required', 'string', 'max:10000'],
        ]);

        // Render with a dummy recipient for the in-app preview
        $dummy = new Channel([
            'company_name' => 'PT Contoh Mitra Jaya',
            'owner_name'   => 'Ahmad Santoso',
            'channel_code' => 'CH-PREVIEW',
            'gender'       => 'male',
        ]);

        return response()->json([
            'html' => $this->renderTemplate($request->body, $dummy),
        ]);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Wrap plain-text body inside the branded HTML template.
     */
    private function renderTemplate(string $plainText, Channel $channel): string
    {
        $templatePath = resource_path('email-templates/base.html');
        $html = file_get_contents($templatePath);

        $companyName    = CatalogSetting::getValue('company_name', 'CIMS');
        $companyTagline = CatalogSetting::getValue('company_tagline', 'IT Component Distributor');
        $senderEmail    = config('mail.from.address', 'noreply@example.com');
        $senderPhone = CatalogSetting::getValue('company_phone', '081910002704');
        $senderWa    = preg_replace('/\D/', '', $senderPhone);   // strip non-digits
        // Convert local Indonesian format (08xx) → international (628xx) for wa.me
        if (str_starts_with($senderWa, '0')) {
            $senderWa = '62' . substr($senderWa, 1);
        }

        // Email header can be customised separately from the main company name
        $emailHeaderName    = CatalogSetting::getValue('email_header_name', '')    ?: $companyName;
        $emailHeaderInitial = CatalogSetting::getValue('email_header_initial', '') ?: mb_strtoupper(mb_substr($companyName, 0, 1));

        // Logo: use uploaded company logo if available, otherwise render initial letter
        $logoPath = CatalogSetting::getValue('company_logo_path');
        $logoUrl  = $logoPath ? \Illuminate\Support\Facades\Storage::disk('public')->url($logoPath) : null;

        $boxStyle   = 'width:56px;height:56px;background:linear-gradient(135deg,#D4AF37,#F5D060);border-radius:14px;display:inline-block;overflow:hidden;vertical-align:middle;';
        $emailLogoHtml = $logoUrl
            ? '<div style="' . $boxStyle . '">'
              . '<img src="' . htmlspecialchars($logoUrl, ENT_QUOTES, 'UTF-8') . '" '
              . 'alt="' . htmlspecialchars($emailHeaderName, ENT_QUOTES, 'UTF-8') . '" '
              . 'style="width:56px;height:56px;object-fit:contain;display:block;" />'
              . '</div>'
            : '<div style="' . $boxStyle . 'line-height:56px;font-size:22px;font-weight:800;color:#1a1a2e;letter-spacing:-0.5px;text-align:center;">'
              . htmlspecialchars($emailHeaderInitial, ENT_QUOTES, 'UTF-8')
              . '</div>';

        $html = str_replace(
            ['{{company_name}}', '{{company_tagline}}', '{{email_logo_html}}',
             '{{sender_email}}', '{{sender_phone}}', '{{sender_wa}}'],
            [
                htmlspecialchars($emailHeaderName, ENT_QUOTES, 'UTF-8'),
                htmlspecialchars($companyTagline,  ENT_QUOTES, 'UTF-8'),
                $emailLogoHtml,
                htmlspecialchars($senderEmail,     ENT_QUOTES, 'UTF-8'),
                htmlspecialchars($senderPhone,     ENT_QUOTES, 'UTF-8'),
                htmlspecialchars($senderWa,        ENT_QUOTES, 'UTF-8'),
            ],
            $html
        );

        // Inject content — convert plain text → styled HTML paragraphs
        $html = str_replace('{{content}}', $this->textToHtml($plainText), $html);

        // Per-channel personalisation (existing {placeholder} system)
        // Generate a signed unsubscribe URL valid for 30 days (null-safe for preview dummy)
        $unsubscribeUrl = $channel->id
            ? URL::signedRoute('unsubscribe.show', ['channel' => $channel->id], now()->addDays(30))
            : '#';

        return $this->replacePlaceholders($html, $channel, $unsubscribeUrl);
    }

    /**
     * Convert plain text to HTML paragraphs with preserved line breaks.
     * Double blank lines → new paragraph; single newlines → <br>.
     * All text is HTML-escaped to prevent injection.
     */
    private function textToHtml(string $text): string
    {
        $paragraphs = preg_split('/\n{2,}/', trim($text));
        $html       = '';

        foreach ($paragraphs as $para) {
            $escaped = htmlspecialchars($para, ENT_QUOTES, 'UTF-8');
            $escaped = str_replace("\n", '<br>', $escaped);
            $html   .= "<p style=\"margin:0 0 18px;font-size:15px;color:#4a5568;line-height:1.8;\">{$escaped}</p>";
        }

        return $html;
    }

    private function buildQuery(Request $request)
    {
        $query = Channel::where('status', 'active')
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->where('email_invalid', false)
            ->where('email_unsubscribed', false);

        $target = $request->input('target', 'all');

        if ($target === 'selected' && $request->channel_ids) {
            $query->whereIn('id', $request->channel_ids);
        } elseif ($target === 'filtered') {
            $filters = $request->input('filters', []);
            if (!empty($filters['province'])) {
                $query->where('province', $filters['province']);
            }
            if (!empty($filters['grade'])) {
                $query->where('channel_grade', $filters['grade']);
            }
        }

        return $query;
    }

    private function replacePlaceholders(string $text, Channel $channel, string $unsubscribeUrl = '#'): string
    {
        $greeting = $channel->gender === 'female' ? 'Ibu' : 'Bapak';
        $title    = $channel->gender === 'female' ? 'Bu' : 'Pak';

        return str_replace(
            ['{company_name}', '{owner_name}', '{channel_code}', '{owner_title}', '{owner_greeting}', '{unsubscribe_url}'],
            [$channel->company_name, $channel->owner_name ?? '', $channel->channel_code, "{$title} {$channel->owner_name}", $greeting, $unsubscribeUrl],
            $text
        );
    }
}
