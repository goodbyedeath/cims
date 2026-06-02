import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
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
                ],
                navigateFallback: null,
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.bunny\.net\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'cims-fonts',
                            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                        },
                    },
                    {
                        // Runtime-cache apexcharts and leaflet after first use
                        urlPattern: /\/build\/assets\/(react-apexcharts|leaflet-src|leaflet-C).*\.js$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'cims-heavy-chunks',
                            expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    // Keep heavy lazy-loaded libs in their own stable chunks
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
});
