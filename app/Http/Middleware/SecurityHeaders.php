<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Clickjacking — deny all framing (stricter than SAMEORIGIN for an admin app)
        $response->headers->set('X-Frame-Options', 'DENY');

        // MIME-type sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Legacy XSS filter (still respected by some old browsers)
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Don't leak the full referrer URL to third parties
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Disable unused browser features
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

        // HSTS — force HTTPS for 1 year, including sub-domains
        // Only send on HTTPS responses to avoid locking out HTTP during dev
        if ($request->secure()) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains'
            );
        }

        return $response;
    }
}
