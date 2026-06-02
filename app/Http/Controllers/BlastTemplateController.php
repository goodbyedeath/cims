<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\BlastTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BlastTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $type = $request->input('type');

        $templates = BlastTemplate::query()
            ->when($type, fn ($q) => $q->where('type', $type))
            ->orderByDesc('updated_at')
            ->get(['id', 'name', 'type', 'subject', 'body']);

        return response()->json($templates);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:wa,email'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        $template = BlastTemplate::create([
            ...$validated,
            'user_id' => Auth::id(),
        ]);

        return response()->json($template, 201);
    }

    public function update(Request $request, BlastTemplate $blastTemplate): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        $blastTemplate->update($validated);

        return response()->json($blastTemplate);
    }

    public function destroy(BlastTemplate $blastTemplate): JsonResponse
    {
        $blastTemplate->delete();

        return response()->json(['message' => 'Template deleted.']);
    }
}
