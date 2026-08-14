<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\BlastFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Upload endpoint for blast attachments. Files are stored privately (local
 * disk) and only ever reached through a per-recipient tracked link — never a
 * public URL and never a WA media send.
 */
class BlastFileController extends Controller
{
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,zip', 'max:20480'],
            'expiry_hours' => ['required', 'integer', 'min:1', 'max:48'],
        ]);

        $file = $request->file('file');
        $path = $file->store('blast_files', 'local');

        $blastFile = BlastFile::create([
            'user_id'       => Auth::id(),
            'original_name' => $file->getClientOriginalName(),
            'stored_path'   => $path,
            'mime'          => $file->getClientMimeType(),
            'size'          => $file->getSize(),
            'expires_at'    => now()->addHours((int) $data['expiry_hours']),
        ]);

        return response()->json([
            'ok'         => true,
            'id'         => $blastFile->id,
            'name'       => $blastFile->original_name,
            'size'       => $blastFile->humanSize(),
            'expires_at' => $blastFile->expires_at->toIso8601String(),
        ]);
    }
}
