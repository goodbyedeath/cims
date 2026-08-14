<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\BlastFileLink;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Public (no-auth) delivery of blast attachments via unguessable per-recipient
 * tokens. Two routes on purpose: the landing page is what the WhatsApp link
 * preview crawler hits (so previews don't inflate download counts); the
 * download route records the open and streams the bytes.
 */
class PublicFileController extends Controller
{
    /** Branded landing page with OpenGraph tags for the WhatsApp preview card. */
    public function show(string $token): Response
    {
        $link = BlastFileLink::where('token', $token)->first();
        $file = $link?->file;

        if (! $file) {
            return response()->view('files.gone', ['reason' => 'notfound'], 404);
        }
        if (! $file->isActive()) {
            return response()->view('files.gone', ['reason' => 'expired'], 410);
        }

        return response()->view('files.landing', ['file' => $file, 'token' => $token]);
    }

    /** Record the open (first-touch + counters) and stream the file. */
    public function download(string $token): StreamedResponse|Response
    {
        $link = BlastFileLink::where('token', $token)->first();
        $file = $link?->file;

        if (! $file) {
            return response()->view('files.gone', ['reason' => 'notfound'], 404);
        }
        if (! $file->isActive()) {
            return response()->view('files.gone', ['reason' => 'expired'], 410);
        }

        $link->forceFill([
            'downloaded_at'  => $link->downloaded_at ?? now(),
            'download_count' => (int) $link->download_count + 1,
        ])->save();
        $file->increment('download_count');

        return \Illuminate\Support\Facades\Storage::disk('local')
            ->download($file->stored_path, $file->original_name);
    }
}
