# WhatsApp Gateway — Build Prompt for CIMS (componentsales.space)

> Hand this file to a fresh Opus 4.8 / Claude Code session running **on the KVM VPS**.
> It builds a self-hosted, Baileys-based WhatsApp gateway that is **API-compatible with
> Wablas as used by the CIMS Laravel app at https://componentsales.space** — the contract
> below was extracted from CIMS's actual code (`WhatsAppService`, `WaDeviceController`,
> `WaWebhookController`), so the Laravel side needs **zero code changes**: you just add a
> `WaDevice` in the CIMS dashboard whose `server_url` points at this new server.

---

## Before you run it

1. Replace `wa.example.org` with your real subdomain and create a DNS **A record**
   pointing at the KVM **before** the certbot step.
2. `ALLOWED_IPS` for the send/device endpoints must contain the CIMS server's outbound
   addresses: `46.202.186.22` (IPv4) and `2a02:4780:6:1964::/64` (IPv6 — Hostinger may
   egress over either).
3. Replace `{WABLAS_SECRET}` in the webhook URL with the value of `WABLAS_SECRET` from
   the CIMS `.env` (never commit it anywhere).
4. Once the server is live, in CIMS → WA Devices add a device with
   `server_url = https://wa.example.org`, the token you configured on the gateway, and
   the secret key. Leave `scan_path` blank (the default `/api/device/scan?token={token}`
   matches this server). Click "Cek Status", then open the QR modal to pair.

---

## The prompt

```
ROLE
You are building a self-hosted WhatsApp gateway server from scratch on this KVM VPS.
It replaces a paid Wablas subscription for an EXISTING, UNCHANGEABLE Laravel app
("CIMS", https://componentsales.space). The API contract below was extracted from
CIMS's real source code — follow it EXACTLY; do not substitute the public Wablas docs
where they differ. Work in Claude Code on this VPS. Verify each step by running it.

TARGET ENVIRONMENT
- Fresh KVM VPS, Ubuntu 22.04/24.04 LTS, root access.
- CONSTRAINED RAM (assume ~1 GB, must survive on 512 MB). Hard constraints:
  * Baileys engine (WhatsApp multi-device over WebSocket). NO Puppeteer/Chromium.
  * NO Redis. NO Docker requirement. NO PostgreSQL. Tiny runtime footprint.
  * Each WhatsApp session must idle under ~150 MB. Support at least 3 concurrent sessions.
- Node.js 22 LTS.

WHAT IT MUST DO
A REST server holding up to 3+ always-on WhatsApp connections, exposing the Wablas-
compatible API below. Each WhatsApp number ("device") is identified by a TOKEN that the
Laravel app stores per device (encrypted). The server maps token -> Baileys session.
Each session also has a SERIAL: a random, unguessable string (24+ chars) generated at
session creation, stable for the session's lifetime — CIMS's QR modal keys on it.

HOW CIMS CALLS THIS SERVER (auth model — match exactly)
- POST /api/send-message           header  Authorization: {token}          (token ALONE, no secret)
- GET  /api/device/info            query   ?token={token}                  (no auth header)
- GET  /api/device/disconnect      header  Authorization: {token}.{secret}
- GET  /api/device/restart         header  Authorization: {token}.{secret}
- POST /api/device/speed           header  Authorization: {token}.{secret} (form-encoded body)
- GET  /api/device/scan            query   ?token={token}                  (opened in a BROWSER)
- GET  /api/device/reset-qr-code/{serial}/qr                               (serial is the auth)
- GET  /api/device/qr-code/{serial}
- GET  /api/device/qr-code-image/{serial}
Parse "Authorization: {token}.{secret}" by splitting on the FIRST ".". The secret is
optional — a bare token is valid when the device has no secret configured. Unknown
token -> HTTP 200 {"status":false,"message":"invalid token"}.
Additionally: ADMIN_API_KEY (env var) required ONLY for session lifecycle endpoints
(create/start/logout). Never accept the send-token for session management.

RESPONSE FORMAT (what CIMS's parser expects — follow exactly)
- Success: HTTP 200 {"status": true, ...optional detail...}
- Failure: HTTP 200 {"status": false, "message": "human readable reason"}
CIMS treats success as: HTTP 2xx AND body.status === true. On failure it shows
body.message (falls back to body.error). Non-2xx or missing status = failure.

ENDPOINT SPECS

1. POST /api/send-message
   body: { "phone": "628123...", "message": "text" }
   Send the text immediately and return the result — CIMS paces its own blasts
   (0.5 s between calls from a loop), so DO NOT queue, DO NOT add delays.
   Convert phone to JID {number}@s.whatsapp.net; numbers arrive already normalized
   to 62xxxxxxxx. Verify the number exists on WhatsApp first (Baileys onWhatsApp);
   if not: {"status":false,"message":"number not on whatsapp"}.
   CIMS only ever sends TEXT — no image/location/document endpoints are needed.

2. GET /api/device/info?token={token}
   -> { "status": true, "data": { "status": "connected" | "disconnected",
                                  "serial": "<the session's serial>" } }
   REQUIREMENTS: data.status must be exactly "connected" only when the socket is
   open AND authenticated (CIMS lowercases and compares === "connected"); anything
   else shows as not connected. data.serial is MANDATORY — CIMS caches it and uses
   it to build the QR-polling URLs below. You may add extra keys (phone, quota,
   expired) — CIMS stores and displays data.* verbatim on the Devices page.

3. QR PAIRING — pull model (CIMS polls; there is NO QR webhook in CIMS)
   CIMS's QR modal flow, which these three endpoints must support:
     a. modal opens -> CIMS calls GET /api/device/reset-qr-code/{serial}/qr ONCE
        -> (re)start a pairing session for that device and return HTTP 200.
        If the session is currently connected, log it out first so a fresh QR
        is issued. Never called during polling.
     b. CIMS polls GET /api/device/qr-code/{serial} every ~2.5 s
        -> { "message": "success", "text": "<raw QR pairing string>" }
        "text" is the raw Baileys QR payload (rotates ~every 20 s). CIMS uses
        md5(text) as a change stamp. When the pairing session has expired or was
        never started, return anything WITHOUT message=="success" (e.g.
        {"message":"expired"}) — CIMS then calls reset again.
     c. When the stamp changes, CIMS fetches GET /api/device/qr-code-image/{serial}
        -> PNG bytes with Content-Type: image/png, rendering the CURRENT "text".
        Generate the PNG server-side from the same QR string (e.g. the "qrcode"
        npm package). The image and text endpoints must stay in sync.
     d. In parallel CIMS polls /api/device/info until data.status == "connected".
   Serials are random and unguessable — that is the only auth on these three
   endpoints (same as real Wablas). Do not put them behind the IP allowlist
   exemption; they are called server-side by Laravel, so the allowlist applies.

4. GET /api/device/scan?token={token}
   A self-contained HTML page that runs the same reset -> poll -> render QR loop in
   the browser and shows "connected" when pairing completes. NOT optional: CIMS has
   a "open QR page" fallback button that redirects the admin's BROWSER here. Because
   it's browser-opened, this one route (and any assets it needs) must be EXEMPT from
   the IP allowlist — the token in the query string is its auth.

5. GET /api/device/disconnect   (Authorization: {token}.{secret})
   Log the WhatsApp session out (Baileys logout, wipe creds) -> {"status":true}.
   A new QR will be needed to reconnect.

6. GET /api/device/restart      (Authorization: {token}.{secret})
   Close and reopen the socket reusing saved creds -> {"status":true}.

7. POST /api/device/speed       (Authorization: {token}.{secret}, form-encoded)
   body: delay=10..120. Store it per device and return {"status":true}. You do not
   need to enforce it — CIMS paces sends itself — it just must not error, because
   the dashboard has a speed button.

8. POST /api/v2/send-interactive   (Authorization: {token}.{secret})
   body: { "data": [ { "phone": "...", "interactive": { ...WhatsApp Cloud-API
   interactive object... } } ] }
   WhatsApp restricts interactive messages for unofficial clients. Return
   {"status":false,"message":"interactive not supported"} — CIMS automatically
   falls back to a plain-text numbered menu when this fails, so nothing breaks.
   (Implementing a real best-effort render is optional, never required.)

INBOUND MESSAGE WEBHOOK TO LARAVEL (REQUIRED — CIMS runs a keyword chatbot on it)
- Config: LARAVEL_WEBHOOK_URL = https://componentsales.space/wa/webhook/{WABLAS_SECRET}
  (one shared URL for all devices; the secret in the path is the auth — keep it in .env).
- On every incoming message on any session, POST JSON:
    { "data": { "phone": "628xxxxxxxxx",      // sender, digits only, 62-prefixed
                "message": "<plain text of the message>",
                "fromMe": false,
                "isGroup": false } }
  Set fromMe/isGroup truthfully — Laravel skips own echoes and group chatter itself,
  but send direct personal messages always. For non-text messages (images, stickers,
  reactions) either skip them or send an empty message string; Laravel ignores empties.
  Expect HTTP 200 {"ok":true}. Fire-and-forget with a short timeout and 1 retry;
  never block or crash a session on webhook failure.
- There is NO QR webhook and NO status webhook — CIMS polls for both. Do not build them.

SESSION LIFECYCLE & PERSISTENCE
- Persist Baileys auth state to disk per session (multi-file auth state) under a data
  dir, so sessions survive restarts and reboots WITHOUT re-scanning the QR.
- Persist the device registry (name, token, secret, serial, speed) as a small JSON or
  SQLite file, so serials and tokens survive reboots.
- Auto-reconnect on disconnect. On logout/401 from WhatsApp, clear that session's creds
  and mark it disconnected; CIMS's info-poll will show it and the admin re-pairs via QR.
- Session management endpoints (ADMIN_API_KEY protected):
  POST /sessions            { name, token, secret?, phone? } -> register a device, returns its serial
  POST /sessions/{token}/start                               -> boot the socket
  POST /sessions/{token}/logout                              -> kill + wipe creds
  GET  /sessions                                             -> list sessions + status (admin only)
- On server boot, auto-start every persisted session.

EXPLICIT NON-GOALS (do NOT build these — CIMS already owns them)
- No message throttling/queueing/scheduling — CIMS paces its own blasts (0.5 s loop)
  and sends synchronously; your server sends immediately and returns the result.
- No send-image / send-location / send-list endpoints — CIMS never calls them.
- No admin dashboard/UI beyond the /api/device/scan page.
- No contact DB, no campaign logic, no analytics.

SECURITY / HARDENING
- Bind the app to 127.0.0.1; nginx in front as HTTPS reverse proxy.
- nginx + certbot (Let's Encrypt) on the subdomain (wa.example.org).
- ufw: allow 22, 80, 443 only. App port never public.
- IP allowlist middleware on ALL /api/* routes EXCEPT /api/device/scan (browser-opened):
  ALLOWED_IPS env, comma-separated, must support IPv4 + IPv6 CIDR.
  Values for CIMS's server: 46.202.186.22, 2a02:4780:6:1964::/64
  Reject others with 403. /sessions* additionally requires ADMIN_API_KEY.
- Rate-limit per token as a safety net (generous ceiling — a blast is ~2 msgs/s).
- Secrets (ADMIN_API_KEY, device tokens/secrets, webhook URL with its secret) only in
  .env / the persisted registry file with 0600 perms; never committed, never logged.
- Structured logging (pino) to stdout; systemd captures it. Log sends, failures,
  reconnects, webhook pushes, rejected requests. Never log message bodies at info level.

PROCESS MANAGEMENT
- systemd unit with Restart=always, auto-start on boot, MemoryMax sized to the VPS.
- /health endpoint (allowlisted) returning per-session status + process memory.

TECH STACK (keep it minimal)
- Node.js 22, TypeScript.
- @whiskeysockets/baileys (WhatsApp engine)
- fastify (or express) for HTTP
- qrcode (npm) for the QR PNG endpoint
- pino for logging
- Baileys multi-file auth state for persistence; SQLite optional for the registry.
- Nothing heavier unless justified against the RAM budget.

DELIVERABLES
- Full project in /opt/wa-gateway: src/, package.json, tsconfig, .env.example.
- README: install steps, .env reference, registering the 3 devices, nginx config,
  certbot command, systemd unit, and how to point a CIMS WaDevice at this server
  (server_url = https://wa.example.org, token/secret = what you set here,
  scan_path left blank).
- The nginx server block and the systemd unit as files in the repo.

BUILD ORDER (in sequence, verifying each)
1. Provision: apt update, Node 22 (nodesource), git, nginx, certbot, ufw. Set up ufw.
2. Scaffold TS project + fastify + /health. Run it, curl /health.
3. Integrate Baileys: one session, persist auth, print QR to terminal, log in with a
   real phone, confirm it survives a process restart without re-scanning.
4. Implement send-message with the exact auth + response contract; send a real text
   to your own number and confirm delivery.
5. Implement device/info (with serial), the three QR-poll endpoints, and the scan page;
   verify the full reset -> poll text -> poll image -> connected cycle in a browser.
6. Multi-session (token -> session map), disconnect/restart/speed, session lifecycle
   endpoints, boot auto-start.
7. Wire the inbound-message webhook to the Laravel URL; send a WhatsApp message TO the
   paired number from another phone and confirm Laravel's bot replies.
8. Auth hardening (token.secret parsing, ADMIN_API_KEY), IP allowlist (with the scan-
   page exemption), rate limit.
9. nginx reverse proxy + certbot HTTPS. Lock ufw.
10. systemd unit with Restart=always + MemoryMax; enable on boot; kill the process and
    verify auto-restart + all sessions reconnect.

ACCEPTANCE CRITERIA (tested against the real CIMS app)
- In CIMS -> WA Devices, adding a device with server_url=<this server> + token + secret,
  clicking "Cek Status" shows connected/disconnected correctly (this also proves
  data.serial is being returned and cached).
- Opening the CIMS QR modal shows a rotating QR (polled ~2.5 s) and pairing with a real
  phone flips the modal to connected without a page reload.
- The "open QR page" fallback works from a normal browser (scan page exempt from allowlist).
- A CIMS test send ("Test pesan dari CIMS...") and a real blast deliver, parsed as success.
- Replying to the paired number from another phone triggers CIMS's chatbot auto-reply
  (proves the inbound webhook works end-to-end).
- Disconnect / restart / speed buttons in CIMS all succeed.
- Rebooting the VPS brings all sessions back online automatically with no re-scan.
- Idle RAM for 3 sessions stays within budget (report the actual figure).
- Send endpoints reject non-allowlisted IPs and invalid tokens.

Start by confirming the OS, RAM, and Node availability, then proceed through the build order.
```

---

## CIMS contract reference (extracted from the app's source — why this is drop-in)

| CIMS code | Calls | Notes |
|---|---|---|
| `WhatsAppService::send()` / `sendVia()` | `POST /api/send-message` `{phone,message}`, `Authorization: {token}` | success = 2xx AND `status===true`; error from `message`/`error` |
| `WhatsAppService::deviceInfo()` | `GET /api/device/info?token=` | reads `data.status` (must equal `connected`) and `data.serial` |
| `WaDeviceController::qrStart()` | `GET /api/device/reset-qr-code/{serial}/qr` | called once when the QR modal opens |
| `WaDeviceController::qrFrame()` | `GET /api/device/qr-code/{serial}` then `GET /api/device/qr-code-image/{serial}` | needs `{message:"success", text:...}` + matching PNG |
| `WaDeviceController::qr()` | redirects browser to `GET /api/device/scan?token=` | default `scan_path` — must be a public HTML page |
| disconnect / restart / speed | `GET /api/device/disconnect`, `GET /api/device/restart`, `POST /api/device/speed` | `Authorization: {token}.{secret}` |
| `WhatsAppService::sendInteractive()` | `POST /api/v2/send-interactive` | may return `status:false` — CIMS falls back to a text menu |
| `WaWebhookController::handle()` | ← gateway POSTs `https://componentsales.space/wa/webhook/{WABLAS_SECRET}` | `{data:{phone,message,fromMe,isGroup}}`; powers the keyword chatbot |

Not used by CIMS (skip): `send-image`, `send-location`, `send-list`, batch sends, QR/status push webhooks.
