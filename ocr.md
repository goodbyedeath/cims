# OCR (Image → Text)

Admin-only OCR workspace that turns uploaded images into editable text — and can
push that text straight into the RAG knowledge base. Recognition runs **entirely
in the browser** via a **self-hosted Tesseract.js** engine, so images never leave
the device and there is **no API key, no account, and no per-use cost**.

---

## At a glance

| Capability | Where |
|---|---|
| OCR workspace (admin UI) | `OcrController`, `/ocr` |
| Recognition engine | self-hosted Tesseract.js (`/public/tesseract/*`) |
| Push extracted text to RAG | reuses `RagController@ingestText`, `POST /admin/rag/ingest/text` |

Gated by `can:manage-users`. Sidebar item: **OCR**.

### Why Tesseract.js (not a cloud OCR API)

The free Puter OCR API was considered but rejected: its "User-Pays" model forces
every end user to sign into a **Puter.com account** and uploads images to a
third-party cloud — wrong for an internal back-office tool handling business
documents. Tesseract.js is MIT-licensed, free, unlimited, runs client-side, and
keeps every image on the user's machine.

Trade-off: accuracy is strong on sharp, well-lit printed text but weaker on
handwriting and low-contrast scans.

---

## How it works

```
User drops image(s) ──► Pages/Ocr/Index.jsx
                          │  createWorker('ind+eng', 1, { self-hosted paths })
                          ▼
                   Tesseract.js worker (in-browser)
                          │  loads worker + wasm core + language model from /tesseract/*
                          │  recognises each file, reports live progress
                          ▼
                   Editable combined text
                     ├─ Copy / Download .txt
                     └─ "Ingest to RAG" ──► POST /admin/rag/ingest/text ──► RAG backend
```

Nothing is fetched from a CDN; the worker, WebAssembly core, and language models
are all served same-origin from `/public/tesseract`.

---

## Self-hosted assets (`public/tesseract/`)

> The directory is named `tesseract`, **not `ocr`, on purpose.** A physical
> `public/ocr/` directory would shadow the `/ocr` page route — Apache's front-
> controller rewrite skips existing directories (`RewriteCond %{REQUEST_FILENAME}
> !-d`), so `/ocr` would 301 to the directory instead of reaching Laravel.

| Path | What | Source |
|---|---|---|
| `worker.min.js` | Tesseract worker | `node_modules/tesseract.js/dist/worker.min.js` |
| `core/*-lstm.wasm{,.js}` | LSTM WASM cores (plain / simd / relaxedsimd) | `node_modules/tesseract.js-core/` |
| `lang-best/ind.traineddata.gz` | Indonesian model (~7.5 MB) | `github.com/tesseract-ocr/tessdata_best` |
| `lang-best/eng.traineddata.gz` | English model (~12.8 MB) | `github.com/tesseract-ocr/tessdata_best` |
| `.htaccess` | serve `.gz` raw + correct `.wasm` MIME | this repo |

The language models are the **`tessdata_best`** float LSTM models (more accurate
than the standard integer models, especially on photos / unusual fonts). Total
≈ 40 MB. Only the legacy (non-LSTM) cores were removed — the page always runs the
LSTM engine (`oem = 1`), so Tesseract only ever requests the `*-lstm` variants,
and it auto-picks plain / simd / relaxedsimd by browser capability (`corePath` is
a directory, so selection is automatic).

The engine is wired to these paths in `resources/js/Pages/Ocr/Index.jsx`:

```js
const TESS_OPTS = {
    workerPath: '/tesseract/worker.min.js',
    corePath:   '/tesseract/core/',     // trailing slash → directory; variant chosen at runtime
    langPath:   '/tesseract/lang-best', // fetches /tesseract/lang-best/{lang}.traineddata.gz
    workerBlobURL: false,               // load worker from same-origin path (CSP-friendly)
};
```

> **Why `lang-best`, not `lang`?** The `.htaccess` long-caches these assets as
> `immutable`, and Cloudflare honours that. The model **file names are stable**
> (`eng.traineddata.gz`), so replacing a model's *contents* at the same URL leaves
> the old version stuck in the edge cache for up to a year. The fix is to bump the
> **directory** name (cache-busting by path, like Vite's hashed assets): when you
> swap models, put them in `lang-best2/` (etc.) and update `langPath`. The previous
> `lang/` directory was removed.

### `public/tesseract/.htaccess` (important)

Tesseract downloads the `*.traineddata.gz` models and **gunzips them itself**.
Apache must therefore **not** advertise `Content-Encoding: gzip` on these files,
or the browser would auto-decompress and the engine's own gunzip would fail.
The scoped `.htaccess` handles this (`RemoveEncoding .gz`), forces
`application/wasm` for `.wasm`, stops `mod_deflate` from re-compressing them, and
long-caches the immutable assets. This makes the setup robust across Hostinger's
global config. (See the cache-busting note above — `immutable` + a stable filename
means content changes need a new *path*.)

---

## CSP change

WebAssembly compilation requires one addition to the policy in `public/.htaccess`:

```
script-src ... 'wasm-unsafe-eval' ...
```

`'wasm-unsafe-eval'` is the **narrow** directive — it permits WebAssembly
compilation only, not general `eval()`. All OCR assets are same-origin, so no
`connect-src` / `worker-src` changes were needed (the worker is loaded from a
real path, not a `blob:`).

---

## Using it

1. Open **OCR** in the sidebar (`/ocr`).
2. Drop or browse one or more images (PNG / JPG / WebP / BMP). Multiple files are
   concatenated into multi-page text.
3. Pick a language: **Indonesian + English** (default), Indonesian, or English.
4. Pick a **Layout** — `Auto` for normal documents, **`Table / form / labels`**
   for spec sheets / tables / forms (see below).
5. (Optional) Toggle **Enhance** (on by default), **B&W**, or **High quality** —
   see "Preprocessing" below.
6. **Run OCR** — watch per-file progress; the first run caches the language model.
7. Edit the extracted text, then **Copy**, **Download .txt**, or **Ingest to RAG**
   (give it a title; it posts to the existing text-ingest endpoint).

PDFs are not supported (images only). For best results use sharp, straight,
well-lit images.

### Layout / page-segmentation mode (tables & forms)

Tesseract's **page-segmentation mode (PSM)** decides how the image is carved into
text regions. The **Layout** dropdown exposes three (set via
`worker.setParameters({ tessedit_pageseg_mode })` in `Pages/Ocr/Index.jsx`):

| Layout label | PSM | Best for |
|---|---|---|
| `Auto (documents)` *(default)* | `3` | normal prose / paragraphs |
| `Table / form / labels` | `11` | **spec sheets, tables, forms, scattered labels** |
| `Single column` | `4` | one tall column of text |

Why it matters: in **Auto** mode Tesseract treats a table as a single block and
keeps only the **densest cell**, silently dropping the other rows — e.g. a spec
table came out as **174 chars (one cell)** in Auto but the **full table** in
`Table / form` mode. So if a table/form returns only part of its text, switch the
Layout to **Table / form / labels**.

Caveat: sparse mode extracts **all** the text but lists cells **top-to-bottom as
separate lines** — it does *not* rebuild the table grid (rows aren't kept aligned
across columns). That's ideal for copying or RAG ingest; true table-structure
reconstruction is out of scope.

### Preprocessing (resolution, Enhance, B&W, High quality)

Recognition happens in the browser, so every image is run through `processImage()`
(`Pages/Ocr/Index.jsx`) before OCR — all client-side, nothing leaves the device.
The pipeline:

1. **Resize** — *downscale* huge photos (12 MP+ exhaust mobile memory and exceed
   iOS Safari's ~4096 px canvas cap) to a 3000 px longest edge, and *upscale* small
   images up to ~1800 px (capped at 3×). Low DPI is the #1 cause of weak Tesseract
   results — a 982 px table reads at only ~184 DPI; upscaling pushes it toward 300.
2. **Enhance** — grayscale + contrast stretch (1st–99th percentile) so faded text
   becomes crisp.
3. **Binarize** (optional) — Otsu threshold to pure black & white.

The toggles next to the Layout selector:

| Toggle | Default | Does | Best for |
|---|---|---|---|
| **Enhance** | **on** | grayscale + contrast + smart resize | almost everything; turn off only if it hurts a specific image |
| **B&W** | off | Otsu binarization (pure black/white) | clean printed docs & screenshots; can hurt unevenly-lit photos |
| **High quality** | off | skip downscaling (full resolution) | dense small-text pages on **desktop**; heavy on memory — large phone photos may fail (amber warning shown) |

- **There is no character limit** — Tesseract returns all the text it recognises.
  "Partial" output is always a *recognition* problem (text too small/blurry to
  read), never truncation.
- **What moves the needle most:** the **Layout** mode for tables/forms, then enough
  **resolution** (Enhance's upscaling, or High quality), then the **B&W** toggle for
  clean docs. The `tessdata_best` models help on photos / unusual fonts.
- **Long document?** Take two photos (top half / bottom half) and drop both in —
  multiple images are stitched into one combined text with page breaks. Two sharp
  half-page shots beat one tiny full-page shot.

In-browser Tesseract has a ceiling below cloud OCR on messy photos / handwriting.
If that's needed, the next step is a self-hosted **PaddleOCR** endpoint on the RAG
backend (stronger on photos/tables, stays on your own infra) — not yet built.

### First-run model download & prefetch

The first OCR run per browser must download the language model(s) — ~13 MB for
English, ~20 MB for the default **Indonesian + English** (`tessdata_best`). On a
cold cache that download is slow and can *look* like a failure ("upload → nothing,
wait a bit → works"); the retry succeeds because the model is now cached.

To avoid that, the page **prefetches** the worker + selected language model(s) as
soon as it opens, and again whenever the language changes (`useEffect` on `lang`
in `Pages/Ocr/Index.jsx`). A status line shows **"Preparing OCR engine…"** then
**"OCR engine ready."** The prefetch failing is non-fatal — Tesseract just
downloads on demand at run time.

Two layers of caching make this a one-time cost:
- **Browser cache** — the models are served `immutable`, so after the first visit
  they load instantly from disk (the prefetch returns from cache, no network).
- **Cloudflare edge** — once any visitor (or a server-side warm) fetches a model,
  the edge serves it `HIT` to everyone else. After a model swap (new `lang-best*`
  dir), warm the edge once so the first real user isn't the one paying the cold
  origin fetch:
  ```bash
  for f in eng ind; do curl -s -o /dev/null https://<domain>/tesseract/lang-best/$f.traineddata.gz; done
  ```

### PDF support

PDFs are accepted alongside images (drop zone / file picker). Processing is
still 100 % in-browser via **pdf.js** (`pdfjs-dist`, self-hosted — the library
chunk `vendor-pdfjs` is lazy-loaded only when a PDF is added, and its module
worker is served from `public/tesseract/pdfjs-<version>/pdf.worker.min.mjs`;
the versioned directory is the same cache-busting pattern as `lang-best`).

Per page, the pipeline picks the cheapest correct path:

1. **Text-layer pages** (digital PDFs — exports from Word, DomPDF, invoices):
   text is read directly from the PDF's embedded text layer via
   `getTextContent()` — instant, exact, no OCR, no model download. A page
   counts as "digital" when its embedded text has ≥ 32 non-whitespace chars.
2. **Scanned pages** (image-only): the page is rasterized to a canvas at
   ~300 DPI (longest edge ~2200 px, or `MAX_EDGE` in High-quality mode), run
   through the same Enhance/B&W preprocessing as images, then OCR'd.

Notes:
- The Tesseract worker is now created **lazily** — a fully digital PDF never
  loads the OCR engine or models at all.
- Pages are joined with the standard `----- page break -----` separator; the
  file row shows a breakdown like `6 pages (4 text-layer, 2 OCR)`.
- Page cap: first **30 pages** per PDF (`MAX_PDF_PAGES`); a skip notice is
  appended to the result if the document is longer.
- pdf.js v6 gotchas: cleanup is `loadingTask.destroy()` (the document proxy no
  longer has `destroy()`), and `.mjs` needs a real JS MIME type — added
  `AddType text/javascript .mjs` to `public/tesseract/.htaccess` because
  module workers hard-fail on `application/octet-stream`.
- CJK-encoded PDFs may need pdf.js *cMaps* (not shipped); Latin-script
  documents (Indonesian/English) don't.

---

## Files

| File | Purpose |
|---|---|
| `app/Http/Controllers/OcrController.php` | renders the page; passes `ragConfigured` |
| `resources/js/Pages/Ocr/Index.jsx` | upload, in-browser OCR, result editor, RAG ingest |
| `public/tesseract/` | self-hosted worker / cores / language models / `.htaccess` |
| `routes/web.php` | `GET /ocr` (`ocr.index`, `can:manage-users`) |
| `resources/js/Layouts/AuthenticatedLayout.jsx` | **OCR** sidebar item |
| `public/.htaccess` | CSP `'wasm-unsafe-eval'` |
| `package.json` | `tesseract.js` dependency |

---

## Deployment checklist

```bash
# 1. build assets
cd cims && RAYON_NUM_THREADS=1 GOMAXPROCS=1 npm run build

# 2. deploy these to production:
#    - public/build/         (new JS chunks)
#    - public/tesseract/     (~40 MB: worker + cores + lang-best models + .htaccess)
#                            NB: delete the old public/tesseract/lang/ on the server
#    - public/.htaccess      (CSP with 'wasm-unsafe-eval')
#    - app/Http/Controllers/OcrController.php
#    - resources/js/...      (already compiled into public/build)
#    - routes/web.php
```

After deploy, **smoke-test**: open `/ocr`, drop an image, **Run OCR**. If the
worker fails to load, it is almost always the `.gz` content-encoding — confirm
`public/tesseract/.htaccess` is in place and that `*.traineddata.gz` is served **without**
a `Content-Encoding: gzip` response header. If a model swap doesn't seem to take
effect, it's the Cloudflare `immutable` cache — bump the `lang-best` directory name
(see the cache-busting note under "Self-hosted assets").

---

## Caveats

- **Images only** — no PDF rasterisation (would need pdf.js).
- **Accuracy** depends on image quality; handwriting/low-contrast scans are weak.
- **First run per language** downloads the model from the app (~7–13 MB,
  `tessdata_best`) and caches it in the browser; the page prefetches it on open so
  the first run doesn't stall (see "First-run model download & prefetch").
- **Asset size** — `public/tesseract/` is ~40 MB; include it in deploys/backups.
- The `tesseract.js` install surfaced npm-audit warnings, but they are all in
  pre-existing **dev** dependencies (`vite`, `@babel/core`, `shell-quote` via
  `concurrently`) — not tesseract.js, and not shipped to the browser.
