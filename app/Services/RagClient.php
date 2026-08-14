<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\RagBackendException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

class RagClient
{
    private string $baseUrl;
    private string $apiKey;
    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('rag.backend_url', ''), '/');
        $this->apiKey  = (string) config('rag.api_key', '');
        $this->timeout = (int) config('rag.http_timeout', 120);
    }

    public function isConfigured(): bool
    {
        return $this->baseUrl !== '' && $this->apiKey !== '';
    }

    public function health(): array
    {
        return $this->request('get', '/health', expectKey: false);
    }

    public function ask(string $query, int $topK = 5, ?string $provider = null): array
    {
        $payload = ['query' => $query, 'top_k' => $topK];

        // Forward the optional provider server-side; omit it to let the backend
        // default to the local model. The API key never leaves the server.
        if ($provider !== null && $provider !== '') {
            $payload['provider'] = $provider;
        }

        return $this->request('post', '/ask', [
            'json' => $payload,
        ]);
    }

    public function ingestText(string $title, string $source, string $text): array
    {
        return $this->request('post', '/ingest/text', [
            'json' => ['title' => $title, 'source' => $source, 'text' => $text],
        ]);
    }

    public function ingestFile(UploadedFile $file, ?string $title = null): array
    {
        $client = $this->client();
        $client = $client->attach(
            'file',
            file_get_contents($file->getRealPath()),
            $file->getClientOriginalName(),
        );

        if ($title !== null && $title !== '') {
            $client = $client->attach('title', $title);
        }

        return $this->send($client, 'post', '/ingest/file');
    }

    /**
     * @param  array{json?: array<string,mixed>}  $options
     */
    private function request(string $method, string $path, array $options = [], bool $expectKey = true): array
    {
        if ($expectKey && ! $this->isConfigured()) {
            throw new RagBackendException(
                'RAG backend is not configured. Set RAG_BACKEND_URL and RAG_BACKEND_API_KEY.',
                errorCode: 'rag_not_configured',
            );
        }

        $client = $this->client();

        if (isset($options['json'])) {
            $client = $client->asJson();
            return $this->send($client, $method, $path, $options['json']);
        }

        return $this->send($client, $method, $path);
    }

    private function client(): PendingRequest
    {
        $request = Http::baseUrl($this->baseUrl)
            ->timeout($this->timeout)
            ->connectTimeout(10)
            ->acceptJson();

        if ($this->apiKey !== '') {
            $request = $request->withHeaders(['X-API-Key' => $this->apiKey]);
        }

        return $request;
    }

    private function send(PendingRequest $client, string $method, string $path, mixed $body = null): array
    {
        try {
            $response = $body === null
                ? $client->{$method}($path)
                : $client->{$method}($path, $body);
        } catch (ConnectionException $e) {
            throw new RagBackendException(
                'RAG backend is unreachable.',
                errorCode: 'rag_unreachable',
                detail: $e->getMessage(),
                previous: $e,
            );
        }

        return $this->handle($response);
    }

    private function handle(Response $response): array
    {
        if ($response->successful()) {
            $data = $response->json();
            return is_array($data) ? $data : ['raw' => $response->body()];
        }

        $payload = $response->json();
        $error   = is_array($payload) ? ($payload['error'] ?? null) : null;
        $detail  = is_array($payload) ? ($payload['detail'] ?? null) : $response->body();

        throw new RagBackendException(
            'RAG backend returned an error.',
            errorCode: is_string($error) ? $error : 'rag_backend_error',
            detail: is_string($detail) ? $detail : json_encode($detail),
            statusCode: $response->status(),
        );
    }
}
