# WhatsApp Chatbot & Forms

Keyword auto-reply chatbot plus a builder for native WhatsApp interactive messages
("forms"), layered on top of the existing outbound WhatsApp Blast. Additive — the
blast feature is untouched.

Messages flow through the **Wablas** gateway (`config/services.php → wablas`).

---

## At a glance

| Capability | Where |
|---|---|
| Outbound blast (existing) | `WaBlastController`, `/wa-blast` |
| Inbound webhook (Wablas → app) | `WaWebhookController`, `POST /wa/webhook/{secret}` |
| Keyword auto-reply engine | `WaBotService` |
| Chatbot rules + inbox (admin UI) | `WaBotController`, `/wa-bot` |
| Interactive form builder (admin UI) | `WaFormController`, `/wa-forms` |
| Send (text + interactive + fallback) | `WhatsAppService` |

Admin pages are gated by `can:manage-users`. The webhook is public, secret-verified,
and CSRF-exempt.

---

## Architecture

```
Customer ── WhatsApp ──> Wablas ──(incoming webhook)──> POST /wa/webhook/{secret}
                                                              │  verify secret (hash_equals)
                                                              ▼
                                                        WaWebhookController
                                                              │  extract text (incl. button/list/order/flow)
                                                              ▼
                                                          WaBotService
                                                       ┌──────┴───────┐
                                                 match rule       log inbound
                                                       │           (wa_inbound_messages)
                                                       ▼
                                                  WhatsAppService
                                              ┌────────┴─────────┐
                                        text reply          form reply
                                                            (native or text-menu fallback)
                                                       │
                                                       ▼
                                              Wablas ──> Customer
```

---

## Data model

Three tables (`2026_06_23_000001_create_wa_bot_tables`,
`2026_06_23_000002_extend_wa_forms_for_interactive_types`):

### `wa_forms` — interactive message templates
| Column | Notes |
|---|---|
| `type` | `button` \| `list` \| `product` \| `product_list` \| `flow` |
| `header`, `body`, `footer` | text; `body` required |
| `button_label` | list only — the row-opener label |
| `items` (json, nullable) | buttons / list sections / product_list sections |
| `config` (json, nullable) | type scalars: `catalog_id`, `product_retailer_id`, `flow_id`, `flow_cta`, `flow_action`, `flow_screen`, `flow_token` |
| `is_active` | |

### `wa_bot_rules` — keyword auto-reply rules
| Column | Notes |
|---|---|
| `match_type` | `exact` \| `contains` \| `starts_with` \| `default` (catch-all) |
| `keyword` | comma-separated; null for `default` |
| `reply_type` | `text` \| `form` |
| `reply_message` / `wa_form_id` | one is used per `reply_type` |
| `priority` | higher checked first |
| `is_active`, `hit_count`, `last_hit_at` | |

### `wa_inbound_messages` — inbox / audit log
`phone`, `channel_id` (best-effort match), `message`, `matched_rule_id`,
`reply_sent`, `reply_text`, `reply_error`, `raw` (full payload).
Only messages that **matched a rule** are stored — unmatched chatter on the
paired number is dropped without a record (privacy).

---

## Configuration

`.env`:
```
WABLAS_URL=https://jkt.wablas.com
WABLAS_TOKEN=<your token>
WABLAS_SECRET=<your secret>          # also used to verify the inbound webhook
WABLAS_INTERACTIVE=false             # true = attempt native interactive messages
WABLAS_INTERACTIVE_ENDPOINT=/api/v2/send-interactive   # adjust to your Wablas plan
```

`config/services.php → wablas` exposes all five keys. When `WABLAS_INTERACTIVE=false`
(default) forms always send as a numbered **text menu** — works on every account.

### Webhook setup (required for the chatbot)
In the Wablas dashboard → **Incoming Webhook**, set:
```
https://<your-domain>/wa/webhook/<WABLAS_SECRET>
```
The route verifies the path secret with `hash_equals`, ignores `fromMe`/group
echoes, is rate-limited (`throttle:120,1`), CSRF-exempt (`bootstrap/app.php`), and
always returns `200` so Wablas won't hammer retries.

---

## Chatbot rules engine (`WaBotService`)

1. Pick a rule: active rules by `priority` desc; the first matching **keyword** rule
   wins. If none match, the `default` rule (if any) is used; otherwise the bot stays
   silent and the message is **not logged**.
2. Log the matched inbound message; best-effort link to a `Channel` by the last 9 phone digits.
3. Reply with the rule's text or linked form; increment `hit_count`.

Matching is case-insensitive (`WaBotRule::matches()`), keywords split on commas.

### Inbound interactive capture
When a reply has no plain text (a button tap, list pick, product order, or flow
submission), `WaWebhookController::extractInteractive()` derives a matchable string:

| Inbound | Becomes |
|---|---|
| Reply Button tap | the button title (e.g. `Katalog`) |
| List selection | the row title |
| Product order | `ORDER: <retailer_id>, …` |
| Flow submission (`nfm_reply`) | `FLOW: <response_json>` |

So your keyword rules react to taps and orders just like typed text.

---

## WhatsApp Forms (5 interactive types)

`WaForm::toInteractivePayload()` builds the WhatsApp **Cloud-API `interactive`
object** (which gateways proxy); `WaForm::toTextMenu()` renders the plain-text
fallback. `WhatsAppService::sendForm()` ties them together:

```
sendForm():
  if WABLAS_INTERACTIVE: POST interactive object to WABLAS_INTERACTIVE_ENDPOINT
      success → mode "native"
      failure → fall through ↓
  send numbered text menu via /api/send-message → mode "fallback"
```

| Type | Builder fields | Native requires |
|---|---|---|
| `button` (Reply Buttons) | up to 3 button texts | — |
| `list` (List Messages) | sections → rows (title/description) + opener label | — |
| `product` (Single Product) | `catalog_id`, `product_retailer_id` | WhatsApp Business catalog (Meta Commerce Manager) |
| `product_list` (Multi-Product) | `catalog_id` + sections → products | WhatsApp Business catalog |
| `flow` (Interactive Flow) | `flow_id`, `flow_cta`, `flow_action`, `flow_screen` | published Flow in Meta Flow Builder |

The builder captures the IDs but does not create catalogs/flows — set those up in
Meta. Forms are reused as a rule's reply (`reply_type = form`) or sent ad-hoc via
**Send test** on `/wa-forms`.

---

## Routes

Public:
```
POST /wa/webhook/{secret}   wa.webhook
```
Admin (`can:manage-users`):
```
GET    /wa-bot                       wa-bot.index
POST   /wa-bot/rules                 wa-bot.rules.store
PUT    /wa-bot/rules/{waBotRule}     wa-bot.rules.update
DELETE /wa-bot/rules/{waBotRule}     wa-bot.rules.destroy

GET    /wa-forms                     wa-forms.index
POST   /wa-forms                     wa-forms.store
PUT    /wa-forms/{waForm}            wa-forms.update
DELETE /wa-forms/{waForm}            wa-forms.destroy
POST   /wa-forms/{waForm}/test       wa-forms.test
```
Sidebar: **WA Chatbot** and **WA Forms** (admin-only).

---

## Files

| File | Purpose |
|---|---|
| `database/migrations/2026_06_23_000001_create_wa_bot_tables.php` | forms / rules / inbox tables |
| `database/migrations/2026_06_23_000002_extend_wa_forms_for_interactive_types.php` | +product/flow types, `config` |
| `app/Models/WaForm.php` | `toInteractivePayload()`, `toTextMenu()` |
| `app/Models/WaBotRule.php` | `matches()`, `keywordList()` |
| `app/Models/WaInboundMessage.php` | inbox row |
| `app/Services/WhatsAppService.php` | `send()`, `sendForm()`, `sendInteractive()` |
| `app/Services/WaBotService.php` | rule matching + auto-reply |
| `app/Http/Controllers/WaWebhookController.php` | inbound webhook + interactive extraction |
| `app/Http/Controllers/WaBotController.php` | rules CRUD + inbox |
| `app/Http/Controllers/WaFormController.php` | forms CRUD + send test |
| `resources/js/Pages/WaBot/Index.jsx` | chatbot admin UI |
| `resources/js/Pages/WaForm/Index.jsx` | form builder UI |
| `routes/web.php`, `bootstrap/app.php`, `config/services.php` | routes, CSRF exempt, config |

---

## Deployment checklist

```bash
# 1. migrate
php artisan migrate --force

# 2. set .env (token/secret + optional interactive flag), then:
php artisan config:cache   # only if you cache config

# 3. in Wablas dashboard, set incoming webhook to:
#    https://<domain>/wa/webhook/<WABLAS_SECRET>

# 4. (optional) native interactive:
#    WABLAS_INTERACTIVE=true  + confirm WABLAS_INTERACTIVE_ENDPOINT for your plan
```

---

## Caveats

- **Subscription required.** All sends (native and text) need an active Wablas
  subscription; nothing delivers while it's expired.
- **Native interactive is gateway-dependent.** `WABLAS_INTERACTIVE` defaults to
  `false`. If enabled and the plan's endpoint differs from
  `WABLAS_INTERACTIVE_ENDPOINT`, every form send makes one failed request before
  falling back to text — confirm the route, or leave it off.
- **Products/Flows** need Meta-side setup (catalog / published flow) to render.
- **STOP/unsubscribe** is not yet auto-suppressing future blasts — a `STOP` keyword
  rule can reply, but true suppression would need a `wa_unsubscribed` column on
  `channels` + a blast-query filter.
- **Tests** (`tests/Feature/WaBotTest.php`) run under MySQL; they skip on the
  in-memory sqlite test DB, which can't build this app's MySQL-only migrations.
