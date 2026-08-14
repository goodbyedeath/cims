import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { compression } from 'vite-plugin-compression2';

// `command` is 'serve' during `npm run dev` and 'build' during `npm run build`.
// Everything gated behind `isBuild` is production-only; dev keeps readable code,
// HMR, console output and source maps exactly as before.
export default defineConfig(({ command }) => {
    const isBuild = command === 'build';

    return {
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
        // Pre-compress the built assets to .gz (gzip) and .br (Brotli) at build
        // time. Apache serves the pre-built file when the browser advertises
        // support (see public/.htaccess), so we ship Brotli — which mod_deflate
        // cannot produce on the fly — and skip per-request CPU. Originals are
        // kept for clients/proxies that don't accept the encodings.
        isBuild && compression({ algorithms: ['gzip'], threshold: 1024, deleteOriginalAssets: false }),
        isBuild && compression({ algorithms: ['brotliCompress'], exclude: [/\.(br)$/, /\.(gz)$/], threshold: 1024, deleteOriginalAssets: false }),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: null,  // handled manually in app.blade.php so scope can be '/'
            scope: '/',
            workbox: {
                globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
                // Exclude heavy lazy-loaded chunks from precache — they'll be runtime-cached on first use
                globIgnores: [
                    '**/react-apexcharts*',
                    '**/leaflet-src*',
                    '**/leaflet-C*',
                    // pdf.js is only loaded when a PDF is dropped on the OCR page
                    '**/vendor-pdfjs*',
                    // Markdown/KaTeX stack is admin-only (RAG Ask + Reports insights) — don't burden every user
                    '**/Ask-*',
                    '**/Markdown-*',
                    '**/KaTeX_*',
                ],
                navigateFallback: null,
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.bunny\.net\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'cims-fonts',
                            networkTimeoutSeconds: 5,
                            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                    {
                        // Runtime-cache apexcharts and leaflet after first use
                        urlPattern: /\/build\/assets\/(react-apexcharts|leaflet-src|leaflet-C|vendor-pdfjs).*\.js$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'cims-heavy-chunks',
                            expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                    {
                        // Runtime-cache the RAG Ask / Markdown chunks + KaTeX fonts after first use
                        urlPattern: /\/build\/assets\/(Ask-|Markdown-|KaTeX_).*\.(js|css|woff2?|ttf)$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'cims-rag-chunks',
                            expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                ],
            },
            manifest: {
                name: 'CIMS — Channel Intelligence',
                short_name: 'CIMS',
                description: 'Channel Intelligence Management System',
                theme_color: '#1a2744',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/dashboard',
                scope: '/',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
        }),
    ],
    resolve: {
        alias: { '@': '/resources/js' },
    },
    // esbuild handles JS/JSX minification + identifier mangling. In production
    // we additionally strip dead developer code; in dev this block is a no-op so
    // logs and `debugger` stay put.
    esbuild: {
        // Remove console.log/info/debug calls whose return value is unused
        // (tree-shaken as side-effect-free). console.warn/error are kept so
        // genuine production errors still surface.
        pure: isBuild ? ['console.log', 'console.info', 'console.debug'] : [],
        // Strip `debugger` statements and license/comment noise from the bundle.
        drop: isBuild ? ['debugger'] : [],
        legalComments: 'none',
    },
    build: {
        // No source maps in production: smaller deploy, and the original source
        // isn't published alongside the app. Dev/HMR keeps full source maps.
        sourcemap: false,
        // Explicit (these are Vite defaults, pinned so the behaviour is intentional).
        minify: 'esbuild',     // minify JS: whitespace, mangle locals, dead-code
        cssMinify: 'esbuild',  // minify CSS
        cssCodeSplit: true,    // per-route CSS, loaded only with its chunk
        // Inline assets smaller than 4 KB as data URIs to save requests.
        assetsInlineLimit: 4096,
        rollupOptions: {
            output: {
                // Hashed, cache-bustable filenames for every emitted asset.
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                manualChunks(id) {
                    // Keep heavy lazy-loaded libs in their own stable chunks
                    if (id.includes('node_modules/pdfjs-dist')) return 'vendor-pdfjs';
                    if (id.includes('node_modules/framer-motion')) return 'vendor-framer';
                    if (id.includes('node_modules/react-dom')) return 'vendor-react-dom';
                    if (id.includes('node_modules/react/')) return 'vendor-react';
                    if (id.includes('node_modules/@inertiajs')) return 'vendor-inertia';
                    if (id.includes('node_modules/lucide-react')) return 'vendor-lucide';
                },
            },
        },
        // Raise limit to suppress noise — heavy libs are already lazy
        chunkSizeWarningLimit: 600,
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
    },
    };
});
