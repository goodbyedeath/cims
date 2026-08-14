<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;
use Throwable;

class RagBackendException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly ?string $errorCode = null,
        public readonly ?string $detail = null,
        public readonly int $statusCode = 0,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function toArray(): array
    {
        return [
            'error'  => $this->errorCode ?? 'rag_backend_error',
            'detail' => $this->detail ?? $this->getMessage(),
            'status' => $this->statusCode,
        ];
    }
}
