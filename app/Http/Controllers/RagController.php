<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\RagBackendException;
use App\Models\RagDocument;
use App\Services\RagClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class RagController extends Controller
{
    public function __construct(private readonly RagClient $rag) {}

    public function index(): Response
    {
        $stats = [
            'documents'   => (int) RagDocument::count(),
            'chunks'      => (int) RagDocument::sum('chunks_indexed'),
            'pdf'         => (int) RagDocument::where('source', 'file')->count(),
            'text'        => (int) RagDocument::where('source', 'text')->count(),
            'last_ingest' => optional(RagDocument::latest()->value('created_at'))?->toIso8601String(),
        ];

        $recent = RagDocument::query()
            ->with('user:id,name')
            ->latest()
            ->limit(5)
            ->get(['id', 'title', 'source', 'filename', 'chunks_indexed', 'user_id', 'created_at'])
            ->map(fn ($d) => [
                'id'             => $d->id,
                'title'          => $d->title,
                'source'         => $d->source,
                'filename'       => $d->filename,
                'chunks_indexed' => $d->chunks_indexed,
                'user'           => $d->user?->only(['id', 'name']),
                'created_at'     => $d->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Rag/Index', [
            'configured' => $this->rag->isConfigured(),
            'stats'      => $stats,
            'recent'     => $recent,
        ]);
    }

    public function askPage(): Response
    {
        return Inertia::render('Rag/Ask');
    }

    public function ingestPage(): Response
    {
        return Inertia::render('Rag/Ingest');
    }

    public function documents(Request $request): Response
    {
        $documents = RagDocument::query()
            ->with('user:id,name')
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Rag/Documents', [
            'documents' => $documents,
        ]);
    }

    // ── JSON proxy endpoints ─────────────────────────────────────────────────

    public function health(): JsonResponse
    {
        if (! $this->rag->isConfigured()) {
            return response()->json([
                'configured' => false,
                'status'     => 'unconfigured',
            ], 200);
        }

        try {
            $payload = $this->rag->health();

            return response()->json([
                'configured' => true,
                'status'     => $payload['status'] ?? 'unknown',
                'payload'    => $payload,
            ]);
        } catch (RagBackendException $e) {
            return response()->json([
                'configured' => true,
                'status'     => 'offline',
                'error'      => $e->errorCode,
                'detail'     => $e->detail,
            ], 200);
        }
    }

    public function ask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query'    => ['required', 'string', 'min:2', 'max:2000'],
            'top_k'    => ['nullable', 'integer', 'min:1', 'max:20'],
            'provider' => ['nullable', 'string', 'in:ollama,gemini'],
        ]);

        @set_time_limit(((int) config('rag.http_timeout', 120)) + 10);

        try {
            $payload = $this->rag->ask(
                $validated['query'],
                (int) ($validated['top_k'] ?? 5),
                $validated['provider'] ?? null,
            );

            return response()->json($payload);
        } catch (RagBackendException $e) {
            return response()->json($e->toArray(), $e->statusCode ?: 502);
        }
    }

    public function ingestText(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title'  => ['required', 'string', 'max:255'],
            'source' => ['nullable', 'string', 'max:255'],
            'text'   => ['required', 'string', 'min:10'],
        ]);

        try {
            $payload = $this->rag->ingestText(
                $validated['title'],
                $validated['source'] ?? 'paste',
                $validated['text'],
            );

            $this->recordDocument($payload, [
                'title'  => $validated['title'],
                'source' => 'text',
                'bytes'  => strlen($validated['text']),
            ]);

            return response()->json($payload);
        } catch (RagBackendException $e) {
            return response()->json($e->toArray(), $e->statusCode ?: 502);
        }
    }

    public function ingestFile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file'  => ['required', 'file', 'mimes:pdf', 'max:20480'], // 20 MB
            'title' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $payload = $this->rag->ingestFile(
                $request->file('file'),
                $validated['title'] ?? null,
            );

            $this->recordDocument($payload, [
                'title'    => $validated['title'] ?? $request->file('file')->getClientOriginalName(),
                'source'   => 'file',
                'filename' => $request->file('file')->getClientOriginalName(),
                'bytes'    => $request->file('file')->getSize(),
            ]);

            return response()->json($payload);
        } catch (RagBackendException $e) {
            return response()->json($e->toArray(), $e->statusCode ?: 502);
        }
    }

    /**
     * @param  array{document_id?: string, chunks_indexed?: int, ...}  $payload
     * @param  array{title: string, source: string, filename?: string|null, bytes?: int|null}  $meta
     */
    private function recordDocument(array $payload, array $meta): void
    {
        $documentId = $payload['document_id'] ?? null;
        if (! is_string($documentId) || $documentId === '') {
            return;
        }

        RagDocument::updateOrCreate(
            ['document_id' => $documentId],
            [
                'user_id'        => Auth::id(),
                'title'          => $meta['title'],
                'source'         => $meta['source'],
                'filename'       => $meta['filename'] ?? null,
                'bytes'          => $meta['bytes'] ?? null,
                'chunks_indexed' => (int) ($payload['chunks_indexed'] ?? 0),
            ],
        );
    }
}
