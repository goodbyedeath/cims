# CIMS — Channel Intelligence Management System

Enterprise platform for managing business channels (partners, distributors,
resellers) end-to-end: CRM, product catalog & inventory, quotations and orders
with installments, WhatsApp/email marketing, lead prospecting, and AI-assisted
reporting. Runs in production at **componentsales.space**.

> Deep architecture notes for contributors live in [`CLAUDE.md`](CLAUDE.md);
> per-feature docs in `whatsapp-chatbot.md`, `ocr.md`, `architecture.md`, and
> `docs/`.

## Stack

- **Backend:** Laravel 13 (PHP 8.3), MySQL, database queue
- **Frontend:** Inertia.js + React 19, Tailwind CSS v4, Vite 6, PWA
- **Hosting:** Hostinger shared hosting behind Cloudflare
- **Jobs:** database queue driven by a per-minute `schedule:run` cron (no daemon)

## Modules

| Area | What it does |
|---|---|
| **Channels** | Partner CRM — profiles, grading, geo-coordinates (Google Maps URL auto-parse), status workflow, public self-registration with WhatsApp-OTP |
| **Catalog** | Admin product manager + sanitized public catalog (`/catalog/public`) with partner-PIN pricing and special-discount tiers |
| **Inventory** | Google-Sheet-synced stock (multi-location qty), full-text search |
| **Offerings & Orders** | Quotations → orders, installment payments, branded PDF export, WhatsApp/spreadsheet exports (with PPN & grand total) |
| **WhatsApp Blast** | Queue-driven anti-ban campaign engine — see below |
| **WhatsApp Devices** | Multi-provider gateway management (self-hosted Baileys ⇄ Meta Cloud API), QR pairing, per-device quota |
| **Find Prospect** | Google Places / SerpApi store-lead search with live quota meter, one-click import to channels |
| **Email Blast** | Multi-account SMTP campaigns, batched + resumable, open tracking |
| **OCR** | Fully client-side Tesseract.js document OCR (self-hosted engine + PDF support) |
| **RAG / Reports** | Executive summaries via a self-hosted RAG backend over Cloudflare Tunnel |

## WhatsApp Blast engine

A queue-driven, anti-ban blast system (one message per job invocation, so shared
hosting never kills a worker mid-batch):

- **Pacing in the queue, not `sleep()`** — each `SendWaBlastJob` sends one
  message then re-dispatches itself with a delay; a `WithoutOverlapping` lock is
  the hard stop against concurrent sends.
- **Drip mode** — Mon–Sat WIB window, per-number warm-up ramp, randomized daily
  budget, auto-scheduled across days.
- **Resilience** — disconnect-pause + auto-resume, persisted circuit breaker,
  channel cooldown, phone blacklist, cancel/retry, live progress.
- **Message types** — text, image, location; **spintax** `{halo|hai}` variation;
  per-recipient **tracked file links** (`{file}`) with open-tracking (not WA
  media sends).
- **Providers** — `WA_DRIVER` selects the self-hosted Baileys gateway or the
  official Meta WhatsApp Cloud API; toggled live from the WA Devices page.

## Local setup

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm run dev            # or: npm run build
```

Configure `.env` (DB, `WABLAS_*` / `WA_DRIVER`, `SERPAPI_KEY`, `META_*`,
`GOOGLE_SHEET_INVENTORY_ID`, mail, `RAG_BACKEND_*`) — see `.env.example` for the
full list. **Never commit `.env`.**

### Production build

```bash
RAYON_NUM_THREADS=1 GOMAXPROCS=1 npm run build
```

### The one required cron (drives all background work)

The database queue and every scheduled task (blast pacing, drip continuation,
stuck-job recovery, file purge, backups) run only if `schedule:run` fires every
minute. Add in **hPanel → Cron Jobs**, *every minute*:

```
* * * * * /usr/bin/php /path/to/cims/artisan schedule:run >> /dev/null 2>&1
```

Without it, queued jobs sit unprocessed — it's a deploy step, not a code bug.

## Notes

- This repository **is** the production codebase; `.env`, secrets, `vendor/`,
  `node_modules/`, and `public/build/` are gitignored.
- Admin-only routes are gated by the `can:manage-users` policy.
