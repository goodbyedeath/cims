<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\RagClient;
use Inertia\Inertia;
use Inertia\Response;

class OcrController extends Controller
{
    /**
     * OCR workspace. All recognition happens client-side in the browser via
     * the self-hosted Tesseract.js engine (assets under /public/tesseract) — no image
     * ever leaves the app. We only tell the page whether the RAG backend is
     * available so it can offer to ingest the extracted text.
     */
    public function index(RagClient $rag): Response
    {
        return Inertia::render('Ocr/Index', [
            'ragConfigured' => $rag->isConfigured(),
        ]);
    }
}
