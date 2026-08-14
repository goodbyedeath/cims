<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CatalogSetting;
use App\Models\Channel;
use App\Models\EmailAccount;
use App\Models\EmailBlast;
use App\Models\EmailBlastRecipient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmailBlastController extends Controller
{
    public function index(): Response
    {
        $blasts = EmailBlast::with(['user:id,name', 'emailAccount:id,name,email'])
            ->withCount([
                'recipients as opened_count' => fn ($q) => $q->whereNotNull('opened_at'),
                'recipients as pending_count' => fn ($q) => $q->whereIn('status', ['pending', 'processing']),
            ])
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
            // SMTP accounts this user can send from (shared + personal).
            'emailAccounts' => EmailAccount::visibleTo(Auth::user())
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'from_name']),
            'defaultFrom' => config('mail.from.address'),
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

    /**
     * Prepare a blast: store attachments, create the blast record and one
     * "pending" recipient row per channel. Actual sending happens in batches
     * via processBatch() so a large blast never blocks a single request long
     * enough to hit the web server / PHP execution timeout.
     */
    public function send(Request $request): JsonResponse
    {
        $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:10000'],
            'sender_name' => ['nullable', 'string', 'max:100'],
            'email_account_id' => ['nullable', 'integer', 'exists:email_accounts,id'],
            'target' => ['required', 'in:all,filtered,selected'],
            'filters' => ['nullable', 'array'],
            'channel_ids' => ['nullable', 'array'],
            'attachments' => ['nullable', 'array', 'max:3'],
            'attachments.*' => [
                'file', 'max:5120',
                'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,zip,csv,txt',
            ],
        ]);

        $channels = $this->buildQuery($request)
            ->get(['id', 'email']);

        if ($channels->isEmpty()) {
            return response()->json(['message' => 'Tidak ada channel dengan email.'], 422);
        }

        // The chosen sending account must be shared or the user's own.
        if ($request->filled('email_account_id')
            && ! EmailAccount::visibleTo(Auth::user())->whereKey($request->email_account_id)->exists()) {
            return response()->json(['message' => 'Akun email tidak tersedia untuk Anda.'], 422);
        }

        $attachments = [];
        foreach ($request->file('attachments', []) as $file) {
            $path = $file->store('email-blast-attachments', 'local');
            $attachments[] = [
                'path' => $path,
                'name' => $file->getClientOriginalName(),
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
            ];
        }

        $blast = EmailBlast::create([
            'user_id' => Auth::id(),
            'email_account_id' => $request->email_account_id ?: null,
            'title' => $request->title,
            'subject' => $request->subject,
            'body' => $request->body,
            'total_recipients' => $channels->count(),
            'status' => 'sending',
            'filters' => $request->filters,
            'attachments' => $attachments,
            'sender_name' => $request->sender_name ?: null,
        ]);

        $now = now();
        $rows = $channels->map(fn ($c) => [
            'email_blast_id' => $blast->id,
            'channel_id'     => $c->id,
            'email'          => $c->email,
            'status'         => 'pending',
            'created_at'     => $now,
            'updated_at'     => $now,
        ])->all();

        foreach (array_chunk($rows, 500) as $chunk) {
            EmailBlastRecipient::insert($chunk);
        }

        return response()->json([
            'blast_id' => $blast->id,
            'total'    => $blast->total_recipients,
        ]);
    }

    /**
     * Send the next batch of pending recipients for a blast. Driven repeatedly
     * by the client until no pending recipients remain.
     */
    public function processBatch(Request $request, EmailBlast $emailBlast): JsonResponse
    {
        $request->validate(['size' => ['nullable', 'integer', 'min:1', 'max:50']]);
        $batchSize = (int) $request->input('size', 25);

        set_time_limit(120);

        // Recover rows stranded in "processing" by a driver that died mid-batch
        // (browser closed, PHP killed) so they become claimable again.
        $emailBlast->recipients()
            ->where('status', 'processing')
            ->where('updated_at', '<', now()->subMinutes(10))
            ->update(['status' => 'pending']);

        // Claim the batch atomically: two concurrent drivers (compose-modal loop
        // + Show-page resume, or two tabs) must never grab the same rows — that
        // double-sends. lockForUpdate makes the second claimer wait, then see
        // "processing" and pick different rows.
        $claimedIds = [];
        \Illuminate\Support\Facades\DB::transaction(function () use ($emailBlast, $batchSize, &$claimedIds) {
            $claimedIds = $emailBlast->recipients()
                ->where('status', 'pending')
                ->orderBy('id')
                ->limit($batchSize)
                ->lockForUpdate()
                ->pluck('id')
                ->all();

            if ($claimedIds !== []) {
                EmailBlastRecipient::whereIn('id', $claimedIds)->update(['status' => 'processing']);
            }
        });

        $pending = $emailBlast->recipients()->whereIn('id', $claimedIds)->get();

        if ($pending->isNotEmpty()) {
            $channels = Channel::whereIn('id', $pending->pluck('channel_id'))
                ->get(['id', 'channel_code', 'company_name', 'email', 'owner_name', 'gender'])
                ->keyBy('id');

            // Send through the blast's chosen SMTP account; NULL = .env default.
            $account     = $emailBlast->emailAccount;
            $mailer      = $account ? Mail::build($account->mailerConfig()) : Mail::mailer();
            $senderName  = $emailBlast->sender_name ?: ($account?->from_name ?: config('mail.from.name'));
            $fromAddress = $account?->email ?: config('mail.from.address');
            $attachments = $emailBlast->attachments ?? [];

            foreach ($pending as $recipient) {
                $channel = $channels->get($recipient->channel_id);

                if (!$channel) {
                    $recipient->update(['status' => 'failed', 'error' => 'Channel not found']);
                    continue;
                }

                try {
                    $personalBody    = $this->renderTemplate($emailBlast->body, $channel, $recipient->id);
                    $personalSubject = $this->replacePlaceholders($emailBlast->subject, $channel);

                    $mailer->html($personalBody, function ($msg) use ($channel, $personalSubject, $senderName, $fromAddress, $attachments) {
                        $msg->from($fromAddress, $senderName)
                            ->to($channel->email)
                            ->subject($personalSubject);

                        foreach ($attachments as $attachment) {
                            $msg->attach(Storage::disk('local')->path($attachment['path']), [
                                'as'   => $attachment['name'],
                                'mime' => $attachment['mime'],
                            ]);
                        }
                    });

                    $recipient->update(['status' => 'sent', 'sent_at' => now(), 'error' => null]);
                } catch (\Throwable $e) {
                    Log::error("Email blast failed [{$recipient->email}]: {$e->getMessage()}");
                    $recipient->update(['status' => 'failed', 'error' => $e->getMessage()]);
                }

                usleep(100000); // 0.1s — gentle SMTP pacing
            }
        }

        $sent      = $emailBlast->recipients()->where('status', 'sent')->count();
        $failed    = $emailBlast->recipients()->where('status', 'failed')->count();
        // "processing" rows belong to another concurrent driver — still remaining.
        $remaining = $emailBlast->recipients()->whereIn('status', ['pending', 'processing'])->count();
        $done      = $remaining === 0;

        $emailBlast->update([
            'sent_count'   => $sent,
            'failed_count' => $failed,
            'status'       => $done
                ? ($sent === 0 ? 'failed' : 'completed')
                : 'sending',
        ]);

        return response()->json([
            'sent'      => $sent,
            'failed'    => $failed,
            'remaining' => $remaining,
            'total'     => $emailBlast->total_recipients,
            'done'      => $done,
        ]);
    }

    /**
     * Send the composed email to one address (usually the sender's own inbox)
     * so the real rendering/deliverability can be checked before blasting.
     * Attachments are not included — they're only uploaded on the real send.
     */
    public function testSend(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:10000'],
            'sender_name' => ['nullable', 'string', 'max:100'],
            'email_account_id' => ['nullable', 'integer', 'exists:email_accounts,id'],
        ]);

        $account = $request->filled('email_account_id')
            ? EmailAccount::visibleTo(Auth::user())->whereKey($request->email_account_id)->first()
            : null;

        if ($request->filled('email_account_id') && ! $account) {
            return response()->json(['ok' => false, 'message' => 'Akun email tidak tersedia untuk Anda.'], 422);
        }

        $dummy = new Channel([
            'company_name' => 'PT Contoh Mitra Jaya',
            'owner_name'   => 'Ahmad Santoso',
            'channel_code' => 'CH-TEST',
            'gender'       => 'male',
        ]);

        try {
            $html = $this->renderTemplate($request->body, $dummy);
            $subject = '[TEST] ' . $this->replacePlaceholders($request->subject, $dummy);
            $senderName = $request->sender_name ?: ($account?->from_name ?: config('mail.from.name'));
            $fromAddress = $account?->email ?: config('mail.from.address');
            $mailer = $account ? Mail::build($account->mailerConfig()) : Mail::mailer();

            $mailer->html($html, fn ($msg) => $msg
                ->from($fromAddress, $senderName)
                ->to($request->email)
                ->subject($subject));
        } catch (\Throwable $e) {
            Log::error("Email blast test send failed [{$request->email}]: {$e->getMessage()}");

            return response()->json(['ok' => false, 'message' => 'Gagal mengirim: ' . $e->getMessage()], 422);
        }

        return response()->json(['ok' => true, 'message' => "Email test terkirim ke {$request->email}."]);
    }

    /**
     * Re-queue every failed recipient of a finished blast as "pending" so the
     * client can drive processBatch() again — transient SMTP failures become
     * recoverable instead of permanent.
     */
    public function retryFailed(EmailBlast $emailBlast): JsonResponse
    {
        $requeued = $emailBlast->recipients()
            ->where('status', 'failed')
            ->update(['status' => 'pending', 'error' => null]);

        if ($requeued === 0) {
            return response()->json(['ok' => false, 'message' => 'Tidak ada penerima gagal untuk diulang.'], 422);
        }

        $emailBlast->update(['status' => 'sending']);

        return response()->json(['ok' => true, 'requeued' => $requeued]);
    }

    /**
     * Open-tracking pixel (signed public URL embedded in each sent email).
     * Records the first open, then always returns a 1×1 transparent GIF.
     */
    public function trackOpen(EmailBlastRecipient $recipient): \Illuminate\Http\Response
    {
        if ($recipient->opened_at === null) {
            $recipient->update(['opened_at' => now()]);
        }

        $gif = base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

        return response($gif, 200, [
            'Content-Type' => 'image/gif',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        ]);
    }

    public function show(EmailBlast $emailBlast): Response
    {
        $emailBlast->load([
            'user:id,name',
            'emailAccount:id,name,email',
            'recipients.channel:id,channel_code,company_name',
        ]);

        return Inertia::render('EmailBlast/Show', [
            'blast' => $emailBlast,
        ]);
    }

    public function destroy(EmailBlast $emailBlast): RedirectResponse
    {
        foreach ($emailBlast->attachments ?? [] as $attachment) {
            Storage::disk('local')->delete($attachment['path']);
        }

        $emailBlast->delete();

        return back()->with('success', 'Email blast history deleted.');
    }

    public function downloadAttachment(EmailBlast $emailBlast, int $index): StreamedResponse
    {
        $attachment = $emailBlast->attachments[$index] ?? null;

        abort_unless($attachment && Storage::disk('local')->exists($attachment['path']), 404);

        return Storage::disk('local')->download($attachment['path'], $attachment['name']);
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
     * Wrap plain-text body inside the branded HTML template. When a recipient
     * id is given, an open-tracking pixel (signed URL) is embedded.
     */
    private function renderTemplate(string $plainText, Channel $channel, ?int $recipientId = null): string
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

        // Open-tracking pixel — signed so recipient ids can't be enumerated.
        if ($recipientId !== null) {
            $pixelUrl = URL::signedRoute('email-blast.open', ['recipient' => $recipientId]);
            $html = str_replace(
                '</body>',
                '<img src="' . htmlspecialchars($pixelUrl, ENT_QUOTES, 'UTF-8') . '" width="1" height="1" alt="" style="display:block;border:0;" /></body>',
                $html
            );
        }

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
            [e($channel->company_name), e($channel->owner_name ?? ''), e($channel->channel_code), e("{$title} {$channel->owner_name}"), e($greeting), $unsubscribeUrl],
            $text
        );
    }
}
