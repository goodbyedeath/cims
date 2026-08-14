# CIMS — Channel Intelligence Management System

Laravel 13 + Inertia.js (React 19) + Tailwind v4 + Vite 6, PWA-enabled, on Hostinger
shared hosting. **This filesystem is the live production server** — file changes are
served immediately; be careful with DB writes and always run migrations with
`--path` targeting only the intended file.

## Build & conventions

- Build: `RAYON_NUM_THREADS=1 GOMAXPROCS=1 npm run build` (limits threads; the host
  kills forks under memory pressure).
- Production build hardening lives in `vite.config.js` (function form —
  everything gated on `command === 'build'`): console.log/debugger stripping
  (`console.warn/error` kept), no sourcemaps, and **pre-compressed `.br`/`.gz`
  siblings** for every asset via `vite-plugin-compression2`. Apache serves them
  when the browser supports it — see the rewrite rules in `public/.htaccess`
  (existence-guarded, so a missing variant falls through to the original).
- Security headers + CSP are set in `public/.htaccess`. CSP notes:
  `'wasm-unsafe-eval'` is for the self-hosted Tesseract.js OCR engine
  (`/tesseract/*`); `frame-src *.wablas.com` is for the WA Devices QR modal.
- `SESSION_SAME_SITE=lax` (not `strict`) — strict withholds the session cookie
  on new-tab navigations, which bounced PDF downloads to the login page.
- UI: navy/gold dark theme, shared components in `resources/js/Components/ui/`
  (Card, Button, Input, Modal, Badge, Table), `cn()` from `@/Lib/utils`,
  icons from `lucide-react`, animation via `framer-motion`.
- Admin-only routes live in the `can:manage-users` group in `routes/web.php`.
- Flash messages: `back()->with('success'|'error', …)` — rendered by
  `AuthenticatedLayout`.
- Sidebar nav is grouped into collapsible categories in
  `AuthenticatedLayout.jsx` (`NAV_CATEGORIES`); add new pages to the right
  category. Collapse state + drag-reordered item order persist in
  localStorage per role; the category containing the active route always
  renders open.
- Feature docs: `ocr.md` (OCR system), `whatsapp-chatbot.md` (WA bot),
  `architecture.md` (AI/Ollama design notes).

## PDF documents (DomPDF)

`offerings/pdf.blade.php` and `orders/pdf.blade.php` render via `barryvdh/laravel-dompdf`.
Two DomPDF gotchas are baked into both templates — **don't undo them**:

- **Page margins come from `@page { margin }` — and a `*`/`html` margin reset
  silently kills it.** DomPDF's page/root frame is matched by `* { margin: 0 }`
  *and* by `html { margin: 0 }`; either one zeroes the `@page` margin no matter
  the rule order, so continuation pages jam against the paper edge and blocks get
  clipped at the break. The reset therefore sets `padding` via `*` but lists
  elements (`body, div, table, …`) for `margin`, never `*` or `html`. Keep
  `body { margin: 0 }` too, or it stacks on top of the `@page` margin.
  (A padded `.page` wrapper is *not* a fix either — it only pads page 1's top and
  the last page's bottom.) With `@page` working, `@page :first`, named pages
  (`page: name`) and `:left`/`:right` are all available if ever needed.
- **Page-break protection:** `.items-table thead { display: table-header-group }`
  repeats the column header on each page, `tbody tr { page-break-inside: avoid }`
  stops a row splitting across the break, and the info/totals/notes/important/
  signature boxes carry `page-break-inside: avoid` so they move whole to the next page.

To verify a change, render to a file and rasterize (`gs` and Imagick are available on
this host): check every page's first ink sits at the margin (~26 px at 80 dpi), never 0.

## Channels

`channels.map_url` (text) stores a pasted Google Maps link; the channel form
(`Channels/Form.jsx`) auto-extracts lat/lng from it into the Coordinates
fields client-side (`extractCoords`: `@lat,lng` → `!3d…!4d…` pin → `?q=lat,lng`
fallbacks, range-validated). Show page renders a "Buka di Maps" link from
`map_url`, falling back to a `google.com/maps?q=lat,lng` URL built from stored
coordinates.

## RAG / AI

Laravel proxies to a self-hosted FastAPI backend over a Cloudflare Tunnel
(`rag.componentsales.space`) via `App\Services\RagClient` — API key stays
server-side (`RAG_BACKEND_URL` / `RAG_BACKEND_API_KEY` in `.env`), all RAG
routes are admin-gated. `ask($query, $topK, $provider)` (providers: ollama,
gemini), `ingestText(...)`, `isConfigured()`. The sidebar RAG link is
health-gated (polls `/admin/rag/health`, disabled while offline).
Reports (`/reports`) reuse this: `POST /reports/insights` recomputes weekly/
monthly metrics server-side and asks the RAG backend for an executive summary;
charts are apexcharts (`ReportCharts.jsx`), insights UI in
`ReportInsights.jsx`.

## OCR

Fully client-side Tesseract.js under `/ocr` (admin). Engine assets are
self-hosted at `public/tesseract/` (worker, LSTM cores, `lang-best/`
tessdata_best models as `.traineddata.gz`, `pdfjs-<version>/` pdf.js module
worker). Cloudflare caches them as immutable — **cache-bust by versioned
directory name** (e.g. `lang-best`) when replacing assets, never in place.
PDFs are supported via lazy-loaded pdf.js: text-layer pages are extracted
directly (no OCR), scanned pages are rasterized ~300 DPI and OCR'd, capped at
30 pages. Details in `ocr.md`.

## WhatsApp devices (`/wa-devices`, admin)

Wablas gateway devices managed in DB (`wa_devices`): token & secret encrypted,
per-device server URL. Each device has a **purpose** (`general` | `otp` |
`blast`) — one *active* device per purpose (activation deactivates same-purpose
rows only). `WhatsAppService::send($phone, $msg, $purpose)` resolves:
active device with that purpose → active `general` → any active → `.env`
fallback. Traffic tags: registration OTPs = `otp`, WA Blast = `blast`,
chatbot/forms = `general`. Device ops (info/QR/disconnect/restart/speed) hit
the documented Wablas endpoints; management endpoints authenticate with
`token.secret_key`. The pairing QR renders in a modal iframe via the
`/wa-devices/{id}/qr` redirect (token never in page markup); the scan path is
customizable per device (`scan_path`, `{token}` placeholder). WA blast history
lives in `wa_blasts`/`wa_blast_recipients`.

The self-hosted gateway (Baileys, see `docs/wa-gateway-build-prompt.md`) returns
per-device monthly **quota** on `/api/device/info` (`quota`, `quota_used`,
`quota_remaining`, `quota_resets`). `WhatsAppService::deviceFor($purpose)`
resolves the actual `WaDevice` a purpose uses; the WA Blast page shows a live
status/quota panel from it.

### WA Blast — queue engine (Phase 1)

Blasts are **queue-driven and Baileys-only** (always the self-hosted gateway,
independent of the WA_DRIVER switch — anti-ban is number-specific). Requires the
per-minute cron (`* * * * * php artisan schedule:run`), which runs
`queue:work --stop-when-empty --max-time=55` + `blasts:dispatch-scheduled` +
`blasts:recover-stuck` (routes/console.php). `WaBlastController::send()` binds a
device (`resolveBlastDevice`: active blast→general→any), materialises all
recipients as `pending` (cooldown-filtered via `Channel::scopeBlastable`), sets
status `queued`, and dispatches **`SendWaBlastJob`** — which sends **one message
per invocation** then re-dispatches itself with a random 5–45 s delay (break
every 30 sends). Never sleeps in the job (shared hosting kills long workers).
`WithoutOverlapping('wa-blast-{id}')` is the hard stop against concurrent sends.
Handles: cancel (`status=cancelling` → job finalises; queued/scheduled cancel
directly), disconnect-pause (park as `scheduled`+5 min, anchored to the offline
spell, give up after `blast_disconnect_giveup_hours`=12), persisted circuit
breaker (`consecutive_fail` ≥ 10 ⇒ number blocked ⇒ stop), blacklist skip
(`wa_blacklists`), and cooldown stamping (`channels.last_blasted_at` on success;
`blast_cooldown_days`=14, 0 disables). Sends via `WhatsAppService::sendVia($device,…)`.
Show page polls `/wa-blast/{id}/progress`; retry reopens failed/cancelled → pending.
Status enum: draft/queued/scheduled/sending/completed/failed/cancelling/cancelled.

**Drip mode (Phase 2, opt-in per blast — `drip_enabled`):** sends only Mon–Sat
inside the WIB window `[blast_drip_hour_start(8), blast_drip_hour_end(17))`,
paced 1–4 min/msg. A per-day budget (`daily_target`) is rolled once/day by
`ensureDripDay`, ramping from small to the full `blast_drip_daily_min(12)`–
`blast_drip_daily_max(35)` over `blast_drip_warmup_days(3)` based on the device's
`warmup_started_at` (set on its first drip send — fresh numbers start small).
When the day's budget is spent / outside the window, `scheduleNextDripDay` parks
it (`status=scheduled`, next non-Sunday day, ~`blast_drip_rest_pct(25)`% chance of
an extra rest day, random time in-window). `blasts:dispatch-scheduled` only
promotes 08:00–21:00 WIB. The compose modal has a drip toggle + an optional
`scheduled_at` (send later). All knobs (plus `blast_cooldown_days`,
`blast_disconnect_giveup_hours`) live in `CatalogSetting`, edited from the **WA
Devices page** "Pengaturan Blast" card (`POST /wa-devices/blast-settings`).
NB: `now()` is mutable here but write Carbon chains with reassignment anyway.

**Attachments (Phase 3) — tracked links, not WA media sends.** Upload via
`POST /wa-blast/upload-file` (`BlastFileController`, mimes pdf/office/img/zip
≤20 MB + `expiry_hours` 1–48) stores privately on the `local` disk and creates a
`BlastFile` (`expires_at`). The blast's optional `blast_file_id` + a `{file}`
placeholder: the job's `resolveFileLink()` (runs **before** personalisation/spintax)
`firstOrCreate`s a `BlastFileLink` per `(blast, file, phone)` with a 32-char token
and swaps `{file}` → `url('/file/{token}')` (or '' if no attachment; retry reuses
the link). Public, no-auth: `GET /file/{token}` = branded landing Blade with
OpenGraph tags (the WA preview crawler hits this, not the download, so previews
don't inflate counts) → `resources/views/files/landing.blade.php`; `GET
/file/{token}/download` records first-open + counts and streams via
`Storage::disk('local')`. Unknown/expired → `files/gone` (404/410); token route
constrained to `[A-Za-z0-9]{32}`. `blast-files:purge-expired` (hourly) deletes
the bytes past expiry (`file_purged_at`; link rows kept for history). Show page
gets `fileTracking` (opened/not-opened openers list).

**Message types + spintax (Phase 4).** `message_type` (text/image/location):
image = `media_url` (gateway downloads it) + `message` as caption; location =
`location_lat`/`location_lng` + `message` as label. Job `sendOne()` dispatches to
`WhatsAppService::sendImageVia`/`sendLocationVia`/`sendVia`. Text is built in
strict order — `{file}` → placeholders (`personalize`) → **spintax**
(`SpintaxParser::parse`, `{a|b|c}` random pick, must be last). Per-device blast
lock: `send()` refuses a new blast when that device already has a
queued/scheduled/sending/cancelling one. `blasts:cleanup --days=60` (monthly)
prunes old finished blasts. (`consumeDailyQuota` device cap intentionally skipped
— one device/one blast; drip `daily_target` already bounds volume. Native list
type skipped — WhatsApp restricts it; use text.)

## WA provider switch (Baileys ⇄ Meta Cloud API)

Selects the outbound WhatsApp provider: `baileys` (self-hosted gateway, default)
or `meta` (official Cloud API). **Toggled live from the WA Devices page** (segmented
card at the top → `POST /wa-devices/driver`); the choice persists in the
`wa_driver` `CatalogSetting`, with `WA_DRIVER` in `.env` as the fallback default.
`WhatsAppService::driver()` resolves it (setting → env), instance-cached so a blast
loop doesn't re-query per message.
`WhatsAppService::send()` branches on it — under `meta` it delegates to
`MetaCloudService::sendText()` (POST `graph.facebook.com/{phone_number_id}/messages`,
Bearer `META_ACCESS_TOKEN`); both return the same `['success','error','detail']`
shape so every caller (OTP, blast, bot, forms' text fallback) is provider-blind.
`isConfigured()` and `deviceFor()` are driver-aware: under `meta`, `deviceFor()`
returns null (no devices/QR), so the WA Blast device/quota guard is skipped and
blasts just send via Meta. `sendVia()` (per-device test) stays Baileys-only.
Meta send needs `META_PHONE_NUMBER_ID` + `META_ACCESS_TOKEN` (+ optional
`META_GRAPH_VERSION`, default v21.0).

### Meta Cloud API webhook

`MetaWhatsAppWebhookController` at `/webhooks/whatsapp` (CSRF-exempt in
`bootstrap/app.php`): **GET** verifies (`hub.mode`/`hub.challenge`/`hub.verify_token`
— PHP rewrites the dots to underscores, so read `hub_mode` etc.) and echoes the
challenge as plain text when the token matches `WHATSAPP_CLOUD_VERIFY_TOKEN`;
**POST** validates `X-Hub-Signature-256` (`sha256=` + HMAC-SHA256 of the **raw**
body keyed by `META_APP_SECRET` — never re-encode the JSON before hashing) and
returns 200. Blank `META_APP_SECRET` = test mode: accepts POSTs unsigned (logged
warning) — set it for production. Inbound text messages route to `WaBotService`
**only when `WA_DRIVER=meta`** (otherwise the bot's reply would leave via the
Baileys number). The Baileys inbound webhook (`WaWebhookController`, `/wa/webhook/{secret}`)
still runs independently — point only the active driver's provider at its webhook.

## Email blast

Client-driven batches: `send` creates the blast + pending recipient rows, then
the browser drives `POST /email-blast/{id}/process` (25/batch) until done — the
Show page has the same driver, so interrupted blasts ("N tertunda — lanjutkan")
can be resumed and failed recipients re-queued via `POST …/{id}/retry`.
Open tracking: each sent email embeds a **signed** 1×1 pixel
(`GET /email-blast/open/{recipient}`, public + signed middleware) that sets
`email_blast_recipients.opened_at` on first hit; open counts surface in the
history table and Show stats (image-blocking clients undercount — treat as a
floor). `POST /email-blast/test` sends the draft to one inbox with a dummy
recipient and `[TEST]` subject prefix, no attachments.

Multi-account sending: `email_accounts` (SMTP creds, password encrypted;
`user_id NULL` = shared account, set = personal — `visibleTo()` scope) managed
via the "Akun Email" modal (JSON CRUD at `/email-accounts`, + `/test` for a
real SMTP round-trip). Compose has a "Kirim Dari" select; the blast stores
`email_account_id` (NULL = `.env` mailer) and `processBatch`/`testSend` build
the mailer at runtime with `Mail::build($account->mailerConfig())`. From
address = account email (SMTP servers reject mismatched senders), sender name
falls back blast → account `from_name` → config. Non-admins can only manage
their own accounts; only admins create shared ones.

## Store leads (`/leads`, admin — "Find Prospect")

Store search proxied through `GooglePlacesService` — two providers behind one
Places-API-shaped response: **google** (`GOOGLE_MAPS_API_KEY`, official, needs
billing) and **serpapi** (`SERPAPI_KEY`, free plan ~250 searches/month,
pageToken = numeric start offset). Google wins when both keys are set; keys
never reach the browser; the page shows a config banner when neither is set
and, on serpapi, a live quota meter (`quota()` — free Account API, cached
5 min, cache busted after every live search; also returned in the
`/leads/search` response so the meter updates as the team searches). Keyword + region → `POST /leads/search` (throttled
20/min — Google calls are billable Enterprise SKU, SerpApi quota is tiny;
identical query pages are cached 24 h per provider, Google allows ≤30 days
caching). Results are matched
against existing channels by phone (badge "Sudah channel CH-xxxx"); pagination
via `nextPageToken` ("Muat lebih banyak", 60-result Google cap per query).
`POST /leads/import` creates an `inactive` prospect Channel (dedup by phone
628/08 variants, city/province parsed from the formatted-address tail,
`owner_name` = "-"). Phones are normalized to international 62… including
landlines (`toIntl` — WhatsAppService::normalizePhone only handles 08 mobiles).

## Inventory sheet sync

`/inventory` "Sync Google Sheet" (`InventoryController@syncGoogleSheet`) reads
the **first tab** of the sheet in `GOOGLE_SHEET_INVENTORY_ID` as public CSV.
That sheet is only a **mirror**: row 1 is a static header row typed by hand,
A2 holds a `QUERY(IMPORTRANGE(...))` pulling from the boss's private source
spreadsheet (tab `FILTERED`), and the `Harga` column is an `ARRAYFORMULA`
that expands shorthand m1 (150 → 150000; the import prefers `Harga` over `m1`
when non-empty). Structure changes happen in the private source — fix the
mirror's QUERY column selection + header row to match, never the app's URL.

`InventoryImport` semantics: sheet is source of truth (sync overwrites
qty/prices, erasing order-time stock deductions since the last sheet update);
rows removed from the sheet are never deleted. `qty` = a single `qty` column
(legacy) **or the sum of every `qty_*` column** (per-location stock split);
all blank/`infinite` → NULL = untracked (no stock checks, no deductions).
SRP auto-calculates from m1 via the `srp_formula_*` CatalogSettings when
missing.

Two surfaces share the `product_catalogs` table (`ProductCatalog` model, synced
from a Google Sheet via `ProductCatalogController@syncGoogleSheet`):

- **Admin manager** — `/catalog` (auth): CRUD, brand logos, featured flag,
  sort order, Google Sheet sync, export. Page: `resources/js/Pages/Catalog/Index.jsx`.
- **Public catalog** — `/catalog/public` (no auth, throttled `catalog-public`):
  `ProductCatalogController@publicView` → `resources/js/Pages/Catalog/Public.jsx`
  (page shell/state only; the modals, cards, and inventory-results section live
  in `resources/js/Components/catalog/` — deliberately NOT under `Pages/`,
  where Inertia's `import.meta.glob` would register them as phantom pages).

### Public catalog behavior

- **Payload is sanitized**: products are mapped without `id`; `best_price` is
  `null` for anonymous visitors (revealed by the partner-PIN or
  registered-channel session flags below). React keys and the modal's clamp
  re-measure use `product_name`, not `id`.
- **Partner PIN gate**: 4-digit PIN (stored in `CatalogSetting` key
  `partner_pin`, env fallback `CATALOG_PUBLIC_PIN`), verified at
  `POST /catalog/public/verify` (throttle `catalog-pin`). Unlocking reveals
  prices; `POST /catalog/public/signout` clears it.
- **Page structure** (`Public.jsx`, self-contained — no AuthenticatedLayout,
  has its own dark/light theme toggle persisted as `catalog-theme` in
  localStorage; every element styles both modes via `isDark`):
  1. Hero — company branding, stats, theme toggle, partner login/status,
     "Daftar Channel" / "Harga Spesial Aktif" state. The "Cari" button does
     **not** navigate away: it switches to the product view and focuses the
     in-catalog search input.
  2. "Cara Pemesanan" 3-step guide (landing only): browse → partner login
     (clickable, opens PIN modal; turns green when unlocked) → order via
     WhatsApp.
  3. Featured strip (`is_featured`) — cards show selling points, falling back
     to a 3-line description when a product has none.
  4. Brand grid → product view with sticky filter bar (back button "Kembali",
     search, category chips with counts).
  5. Product cards show a 2-line description snippet under the name.
- **Product detail modal** has labeled sections — Keunggulan Produk (selling
  points), Skenario Penggunaan, and **Deskripsi** (4-line clamp with
  "Lihat selengkapnya" expander). Locked price tile is clickable and opens the
  PIN modal. Footer CTA: WhatsApp button with the product name prefilled in the
  message, plus a "Login Partner" button while prices are locked.
- **Inventory search**: the product-view search box also queries the
  `inventories` table server-side (`GET /catalog/public/inventory-search?q=`,
  debounced 400 ms, FULLTEXT + LIKE fallback, limit 20). Payload is sanitized:
  name, spec snippet, Ready/Kosong flag only — `m1` price requires the
  partner/registered unlock, exact quantities are never exposed. Results render
  as a "Hasil dari Inventori" list under the catalog grid with per-item
  WhatsApp ask buttons. (NB: the separate `/search` page shows inventory `m1`
  to everyone — intentional or not, the catalog endpoint is stricter.)
- **WhatsApp number is hardcoded** in `Public.jsx` in **four** places (product
  modal CTA, bottom CTA section, floating button, inventory-result ask button):
  `wa.me/6281910002704` — update all together if the sales number changes.

### Public channel self-registration ("Daftar Channel")

- Entry: gold "Daftar Channel" buttons (hero + bottom CTA) →
  `RegisterModal` in `Public.jsx`. Five fields only: owner name, company name,
  WhatsApp phone, email, full address (same `parseFullAddress` + Nominatim
  geocode as the internal `Channels/Form.jsx` — **keep the two copies in sync**).
  Address parse: comma-separated, **minimum `Alamat, Kota, Provinsi`** (Kecamatan/
  district optional); tolerates a trailing "Indonesia" and a postcode (own segment
  or appended to province). Only `city` + `province` are required to proceed.
- Phone must be WhatsApp-registered, enforced by a **6-digit OTP sent via the
  active otp-purpose Wablas device** (`ChannelRegistrationController`): OTP
  cached 10 min per normalized phone, 60 s per-phone resend cooldown, per-IP
  throttles `catalog-otp` (3/min) and `catalog-register` (5/min) in
  `AppServiceProvider`. Wablas' dedicated `phone.wablas.com/check-phone-number`
  service is dead (404) — don't use it.
- Success creates a `Channel` with generated `CH-xxxx` code and
  **status `inactive`** (pending team review — activate from `/channels`),
  dedup-checked against existing phone (both `628…`/`08…` variants) and email,
  then notifies all staff via `NewChannelNotification` and WhatsApps a
  confirmation to the registrant.
- Endpoints are JSON (fetch + `X-CSRF-TOKEN` from the meta tag), not Inertia:
  `POST /catalog/public/register/otp`, `POST /catalog/public/register`.

### Special price for registered channels

- Discount % resolves per product: `product_catalogs.special_discount_pct`
  (nullable decimal) **overrides** the global `CatalogSetting`
  `special_discount_pct` (0 = disabled; product value 0 = "no special price
  for this product"; NULL = follow global). Global % is managed from the admin
  catalog's **Partner PIN modal** (`POST /catalog/special-discount`); the
  per-product % is a field in the product form ("Diskon Spesial (%)").
  `special_price = round(best_price × (100 − pct) / 100)`, computed
  server-side in `publicView`.
- Visibility gates (session flags): `catalog_partner_auth` (PIN) shows plain
  `best_price`; `catalog_registered_auth` shows `best_price` struck through +
  highlighted `special_price`. The registered flag is set on successful
  registration AND via the returning-channel WA-OTP login
  (`POST /catalog/public/login/otp` + `/catalog/public/login` — same
  `RegisterModal`, `mode: 'login'`, phone must already exist as a channel).
- Anonymous payloads have both prices `null` — never compute special price
  client-side.
