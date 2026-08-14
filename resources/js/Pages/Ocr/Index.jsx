import { useRef, useState, useCallback, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ScanText, Upload, Image as ImageIcon, Loader2, X, Check, Copy, Download,
    AlertCircle, FileText, Sparkles, Trash2, Play, ChevronDown, ChevronRight, Maximize2, Wand2, Contrast,
} from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Badge from '@/Components/ui/Badge';
import { cn, csrfHeaders } from '@/Lib/utils';

function csrf() {
    return typeof document !== 'undefined'
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        : '';
}

// Self-hosted Tesseract assets (see /public/tesseract) — nothing is fetched from
// a CDN and no image ever leaves the browser. The directory is deliberately NOT
// named "ocr" so it doesn't shadow the /ocr page route in Apache.
const TESS_OPTS = {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core/',
    langPath: '/tesseract/lang-best', // versioned dir = cache-bust when models change (tessdata_best)
    workerBlobURL: false, // load the worker from same-origin path (CSP-friendly)
};

const LANGS = [
    { value: 'ind+eng', label: 'Indonesian + English' },
    { value: 'ind', label: 'Indonesian' },
    { value: 'eng', label: 'English' },
];

// Page-segmentation mode (Tesseract PSM). "Auto" reads normal prose well but
// treats a table as one block and keeps only the densest cell. "Table / form"
// (sparse text, PSM 11) finds text in every cell/label regardless of layout —
// the right choice for spec sheets, tables, forms and scattered labels.
const LAYOUTS = [
    { value: '3', label: 'Auto (documents)' },
    { value: '11', label: 'Table / form / labels' },
    { value: '4', label: 'Single column' },
];

const PAGE_BREAK = '\n\n----- page break -----\n\n';

// pdf.js (self-hosted, versioned dir = cache-bust on upgrade, same pattern as
// lang-best). The library chunk is lazy-loaded only when a PDF is added.
const PDF_WORKER_SRC = '/tesseract/pdfjs-6.1.200/pdf.worker.min.mjs';
const MAX_PDF_PAGES = 30;

let pdfjsModule = null;
async function loadPdfjs() {
    if (!pdfjsModule) {
        pdfjsModule = await import('pdfjs-dist');
        pdfjsModule.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    }
    return pdfjsModule;
}

// Rebuild readable plain text from a pdf.js text layer (digital PDFs carry
// their text — no OCR needed, perfect accuracy).
function textFromContent(tc) {
    let out = '';
    for (const it of tc.items) {
        out += it.str;
        out += it.hasEOL ? '\n' : (it.str.endsWith(' ') || it.str === '' ? '' : ' ');
    }
    return out.replace(/[ \t]+\n/g, '\n').trim();
}

const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

let uid = 0;
const newId = () => `f${++uid}`;

function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const MAX_EDGE = 3000;   // downscale above this (mobile memory + iOS ~4096px canvas cap)
const MIN_EDGE = 1800;   // upscale below this so low-DPI scans/photos reach ~300 DPI

// Otsu's method: pick the grayscale threshold that best separates text from
// background, computed from the luminance histogram.
function otsuThreshold(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, max = 0, threshold = 127;
    for (let i = 0; i < 256; i++) {
        wB += hist[i];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += i * hist[i];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > max) { max = between; threshold = i; }
    }
    return threshold;
}

/**
 * Preprocess an image for OCR (all in-browser, nothing leaves the device):
 *   1. resize  — downscale huge photos (memory) and upscale tiny ones (low DPI is
 *      the #1 cause of weak Tesseract results),
 *   2. enhance — grayscale + contrast stretch (percentile-clipped) so faded text
 *      becomes crisp black-on-white,
 *   3. binarize (optional) — Otsu threshold to pure B&W, great for clean printed
 *      docs / screenshots (can hurt unevenly-lit photos, so it's opt-in).
 *
 * The <img> element applies EXIF orientation, so sideways phone photos come out
 * upright. Falls back to the raw file if anything fails.
 *
 * @param {{ highQuality?: boolean, enhance?: boolean, binarize?: boolean }} opts
 */
function processImage(file, { highQuality = false, enhance = true, binarize = false } = {}) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const w = img.naturalWidth, h = img.naturalHeight;
                const longest = Math.max(w, h) || 1;

                let scale = 1;
                if (!highQuality && longest > MAX_EDGE) scale = MAX_EDGE / longest;
                else if (longest < MIN_EDGE) scale = Math.min(MIN_EDGE / longest, 3); // cap upscale at 3×

                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(w * scale));
                canvas.height = Math.max(1, Math.round(h * scale));
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);

                if (enhance || binarize) {
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imgData.data;
                    const n = d.length;

                    // luminance histogram
                    const hist = new Uint32Array(256);
                    const lum = new Uint8ClampedArray(n / 4);
                    for (let i = 0, p = 0; i < n; i += 4, p++) {
                        const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
                        lum[p] = g; hist[g]++;
                    }
                    const px = n / 4;

                    // contrast stretch: map the 1st–99th percentile to 0–255
                    let lo = 0, hi = 255, acc = 0;
                    const clip = px * 0.01;
                    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > clip) { lo = i; break; } }
                    acc = 0;
                    for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > clip) { hi = i; break; } }
                    const range = Math.max(1, hi - lo);

                    // Otsu threshold is computed in original-luminance space; map it
                    // through the same linear stretch so the comparison is consistent.
                    const threshStretched = binarize
                        ? (otsuThreshold(hist, px) - lo) * 255 / range
                        : 0;
                    for (let i = 0, p = 0; i < n; i += 4, p++) {
                        let v = ((lum[p] - lo) * 255 / range);
                        v = v < 0 ? 0 : v > 255 ? 255 : v;
                        if (binarize) v = v >= threshStretched ? 255 : 0;
                        d[i] = d[i + 1] = d[i + 2] = v;
                    }
                    ctx.putImageData(imgData, 0, 0);
                }

                canvas.toBlob((blob) => resolve(blob || file), 'image/png');
            } catch {
                URL.revokeObjectURL(url);
                resolve(file); // never block OCR on a preprocessing hiccup
            }
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

function FileRow({ item, onRemove, disabled }) {
    const [open, setOpen] = useState(false);
    const done = item.status === 'done';
    const failed = item.status === 'error';

    return (
        <div className="border-b border-white/5 last:border-0">
            <div className="flex items-center gap-3 px-3 py-2.5">
                {item.url ? (
                    <img src={item.url} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />
                ) : (
                    <div className="w-10 h-10 rounded-lg border border-white/10 bg-red-500/10 text-red-300 flex items-center justify-center shrink-0">
                        <FileText className="w-4.5 h-4.5" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.name}</p>
                    <p className="text-[11px] text-navy-400">
                        {humanSize(item.size)}
                        {item.status === 'running' && ` · ${item.statusText || 'working'}… ${Math.round((item.progress || 0) * 100)}%`}
                        {done && ` · ${item.text?.length || 0} chars`}
                        {done && item.meta && ` · ${item.meta}`}
                        {failed && ` · failed`}
                    </p>
                    {item.status === 'running' && (
                        <div className="h-1 mt-1.5 rounded-full bg-navy-800 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-gold-500/70 to-gold-400 transition-all"
                                 style={{ width: `${Math.round((item.progress || 0) * 100)}%` }} />
                        </div>
                    )}
                </div>
                {done && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                {failed && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" title={item.error} />}
                {item.status === 'running' && <Loader2 className="w-4 h-4 text-gold-400 animate-spin shrink-0" />}
                {done && (
                    <button type="button" onClick={() => setOpen((o) => !o)} className="text-navy-400 hover:text-white shrink-0" title="Preview text">
                        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                )}
                {!disabled && (
                    <button type="button" onClick={() => onRemove(item.id)} className="text-navy-500 hover:text-red-400 shrink-0" title="Remove">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
            <AnimatePresence initial={false}>
                {open && done && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <pre className="mx-3 mb-3 text-xs text-navy-300 whitespace-pre-wrap bg-navy-950/60 border border-white/5 rounded-lg p-3 leading-relaxed max-h-56 overflow-y-auto">
                            {item.text || '(no text found)'}
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function OcrIndex({ ragConfigured = false }) {
    const [files, setFiles] = useState([]);          // [{id,file,name,size,url,status,progress,statusText,text,error}]
    const [lang, setLang] = useState('ind+eng');
    const [psm, setPsm] = useState('3'); // page-segmentation mode; '11' = sparse/table
    const [highQuality, setHighQuality] = useState(false); // skip downscaling (sharper, but heavier — risky on mobile)
    const [enhance, setEnhance] = useState(true);   // grayscale + contrast + smart resize (helps most images)
    const [binarize, setBinarize] = useState(false); // pure B&W — great for clean printed docs / screenshots
    const [running, setRunning] = useState(false);
    const [warm, setWarm] = useState('loading'); // 'loading' | 'ready' | 'idle' — engine/model prefetch state
    const [result, setResult] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef(null);
    const currentId = useRef(null);   // id of the file currently being recognised (for the logger)

    // RAG ingest panel
    const [ragTitle, setRagTitle] = useState('');
    const [ragBusy, setRagBusy] = useState(false);
    const [ragMsg, setRagMsg] = useState(null);      // { ok, text }

    useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []); // cleanup object URLs on unmount

    // Prefetch the worker + language model(s) as soon as the page opens (and when
    // the language changes), so the first OCR run doesn't stall/fail on a cold
    // download. The first run otherwise has to pull ~13–20 MB of tessdata_best
    // models from the server; once cached, every run is instant. Failure here is
    // non-fatal — Tesseract will just download on demand at run time.
    useEffect(() => {
        let cancelled = false;
        const ctrl = new AbortController();
        setWarm('loading');
        const urls = [
            '/tesseract/worker.min.js',
            ...lang.split('+').map((l) => `/tesseract/lang-best/${l}.traineddata.gz`),
        ];
        Promise.all(urls.map((u) =>
            fetch(u, { signal: ctrl.signal }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(u))))
        ))
            .then(() => { if (!cancelled) setWarm('ready'); })
            .catch(() => { if (!cancelled) setWarm('idle'); });
        return () => { cancelled = true; ctrl.abort(); };
    }, [lang]);

    const addFiles = useCallback((list) => {
        const accepted = Array.from(list).filter((f) => f.type.startsWith('image/') || isPdf(f));
        if (accepted.length === 0) return;
        setFiles((prev) => [
            ...prev,
            ...accepted.map((file) => ({
                id: newId(), file, name: file.name, size: file.size,
                kind: isPdf(file) ? 'pdf' : 'image',
                url: isPdf(file) ? null : URL.createObjectURL(file),
                status: 'queued', progress: 0, statusText: '', text: '', meta: '', error: null,
            })),
        ]);
        if (!ragTitle) setRagTitle(`OCR — ${accepted[0].name.replace(/\.[^.]+$/, '')}`);
    }, [ragTitle]);

    const onDrop = (e) => {
        e.preventDefault(); setDragOver(false);
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    };

    const removeFile = (id) => setFiles((prev) => {
        const f = prev.find((x) => x.id === id);
        if (f) URL.revokeObjectURL(f.url);
        return prev.filter((x) => x.id !== id);
    });

    const clearAll = () => {
        files.forEach((f) => URL.revokeObjectURL(f.url));
        setFiles([]); setResult(''); setRagMsg(null);
    };

    const patch = (id, data) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)));

    /**
     * OCR a PDF: pages that carry an embedded text layer are read directly
     * (digital PDFs — instant, perfect accuracy); pages without one (scans)
     * are rasterized to a canvas at ~300 DPI and sent through Tesseract.
     */
    const ocrPdf = async (item, getWorker) => {
        const pdfjs = await loadPdfjs();
        // pdf.js v6: cleanup lives on the loading task, not the document proxy.
        const task = pdfjs.getDocument({ data: await item.file.arrayBuffer() });
        const doc = await task.promise;
        try {
            const total = Math.min(doc.numPages, MAX_PDF_PAGES);
            const parts = [];
            let textPages = 0, ocrPages = 0;

            for (let p = 1; p <= total; p++) {
                patch(item.id, { statusText: `page ${p}/${total}`, progress: (p - 1) / total });
                const page = await doc.getPage(p);

                const embedded = textFromContent(await page.getTextContent());
                if (embedded.replace(/\s+/g, '').length >= 32) {
                    parts.push(embedded);
                    textPages++;
                    page.cleanup();
                    continue;
                }

                // Scanned page — rasterize. Target the same size band the image
                // pipeline aims for (MIN_EDGE..MAX_EDGE ≈ 300 DPI on A4).
                const base = page.getViewport({ scale: 1 });
                const longest = Math.max(base.width, base.height) || 1;
                const viewport = page.getViewport({
                    scale: Math.min((highQuality ? MAX_EDGE : 2200) / longest, 4),
                });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                await page.render({ canvas, viewport }).promise;
                page.cleanup();

                const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
                const input = await processImage(blob, { highQuality: true, enhance, binarize });

                patch(item.id, { statusText: `page ${p}/${total} · recognizing`, progress: (p - 0.5) / total });
                const { data } = await (await getWorker()).recognize(input);
                parts.push((data.text || '').trim());
                ocrPages++;
            }

            const skipped = doc.numPages > total
                ? `${PAGE_BREAK}[${doc.numPages - total} more page(s) skipped — limit is ${MAX_PDF_PAGES}]`
                : '';

            return {
                text: parts.join(PAGE_BREAK) + skipped,
                meta: `${total} pages (${textPages} text-layer, ${ocrPages} OCR)`,
            };
        } finally {
            await task.destroy();
        }
    };

    const runOcr = async () => {
        const queue = files.filter((f) => f.status !== 'done');
        if (running || queue.length === 0) return;
        setRunning(true);
        setRagMsg(null);

        // Lazily spin up Tesseract — digital PDFs (text layer on every page)
        // never need the engine or the model download at all.
        let worker = null;
        const getWorker = async () => {
            if (!worker) {
                worker = await createWorker(lang, 1, {
                    ...TESS_OPTS,
                    logger: (m) => {
                        if (m.status && typeof m.progress === 'number' && currentId.current) {
                            patch(currentId.current, { statusText: m.status, progress: m.progress });
                        }
                    },
                });
                // Page-segmentation mode: '11' (sparse) reads every cell of a
                // table/form; '3' (auto) is best for normal prose.
                await worker.setParameters({ tessedit_pageseg_mode: psm });
            }
            return worker;
        };

        try {
            for (const item of queue) {
                patch(item.id, { status: 'running', progress: 0, statusText: 'starting' });
                try {
                    if (item.kind === 'pdf') {
                        currentId.current = null; // PDFs report page-level progress themselves
                        const { text, meta } = await ocrPdf(item, getWorker);
                        patch(item.id, { status: 'done', progress: 1, text: text.trim(), meta });
                    } else {
                        currentId.current = item.id;
                        // Preprocess in-browser (resize / contrast / optional B&W) for accuracy.
                        const input = await processImage(item.file, { highQuality, enhance, binarize });
                        const { data } = await (await getWorker()).recognize(input);
                        patch(item.id, { status: 'done', progress: 1, text: (data.text || '').trim() });
                    }
                } catch (err) {
                    patch(item.id, { status: 'error', error: err?.message || 'recognition failed' });
                }
            }
        } catch (err) {
            // Engine failed to spin up (asset/CSP issue) — mark everything queued as errored.
            setFiles((prev) => prev.map((f) => (f.status === 'running' || f.status === 'queued')
                ? { ...f, status: 'error', error: err?.message || 'OCR engine failed to load' } : f));
        } finally {
            currentId.current = null;
            if (worker) await worker.terminate();
            setRunning(false);
        }
    };

    // Rebuild the combined result whenever recognitions finish.
    useEffect(() => {
        if (running) return;
        const done = files.filter((f) => f.status === 'done' && f.text);
        if (done.length === 0) return;
        setResult(done.map((f) => f.text).join(PAGE_BREAK));
    }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

    const copyResult = async () => {
        try { await navigator.clipboard.writeText(result); } catch { /* unavailable */ }
    };

    const downloadTxt = () => {
        const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(ragTitle || 'ocr').replace(/[^\w.-]+/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const ingestToRag = async () => {
        if (ragBusy || result.trim().length < 10) return;
        setRagBusy(true); setRagMsg(null);
        try {
            const res = await fetch('/admin/rag/ingest/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...csrfHeaders(), Accept: 'application/json' },
                body: JSON.stringify({
                    title: ragTitle.trim() || 'OCR document',
                    source: 'ocr',
                    text: result.trim(),
                }),
            });
            const json = await res.json();
            if (!res.ok) setRagMsg({ ok: false, text: json.detail || json.error || `HTTP ${res.status}` });
            else setRagMsg({ ok: true, text: 'Ingested into the RAG knowledge base.' });
        } catch (err) {
            setRagMsg({ ok: false, text: err.message || 'Network error' });
        } finally {
            setRagBusy(false);
        }
    };

    const doneCount = files.filter((f) => f.status === 'done').length;
    const canIngest = ragConfigured && result.trim().length >= 10;

    return (
        <AuthenticatedLayout title="OCR">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gold-500/10 text-gold-400">
                        <ScanText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Image &amp; PDF to Text (OCR)</h2>
                        <p className="text-xs text-navy-400">Runs entirely in your browser — files never leave this device.</p>
                    </div>
                </div>

                {/* Upload + controls */}
                <Card>
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        onClick={() => inputRef.current?.click()}
                        className={cn(
                            'flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed cursor-pointer transition',
                            dragOver ? 'border-gold-500/60 bg-gold-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]',
                        )}
                    >
                        <Upload className="w-7 h-7 text-navy-400" />
                        <p className="text-sm text-navy-200">Drop images or PDFs here or <span className="text-gold-400 font-medium">browse</span></p>
                        <p className="text-[11px] text-navy-500">PNG, JPG, WebP, BMP, PDF · multiple files become multi-page text</p>
                        <input ref={inputRef} type="file" accept="image/*,application/pdf,.pdf" multiple className="hidden"
                               onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-navy-500 uppercase tracking-wider">Language</span>
                            <select
                                value={lang}
                                onChange={(e) => setLang(e.target.value)}
                                disabled={running}
                                className="px-2.5 py-1.5 rounded-lg bg-navy-800/60 border border-white/10 text-xs text-navy-100 focus:outline-none focus:ring-2 focus:ring-gold-500/30 disabled:opacity-50"
                            >
                                {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-navy-500 uppercase tracking-wider">Layout</span>
                            <select
                                value={psm}
                                onChange={(e) => setPsm(e.target.value)}
                                disabled={running}
                                title="How the page is segmented. Use 'Table / form' for spec sheets, tables and forms — it reads every cell."
                                className="px-2.5 py-1.5 rounded-lg bg-navy-800/60 border border-white/10 text-xs text-navy-100 focus:outline-none focus:ring-2 focus:ring-gold-500/30 disabled:opacity-50"
                            >
                                {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => setEnhance((v) => !v)}
                            disabled={running}
                            title="Auto-clean the image before OCR: grayscale, contrast boost, and upscale low-resolution scans. Recommended for most images."
                            className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition disabled:opacity-50',
                                enhance
                                    ? 'bg-gold-500/15 text-gold-300 border-gold-500/30'
                                    : 'bg-navy-800/60 text-navy-300 border-white/10 hover:text-white',
                            )}
                        >
                            {enhance ? <Check className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
                            Enhance
                        </button>

                        <button
                            type="button"
                            onClick={() => setBinarize((v) => !v)}
                            disabled={running}
                            title="Convert to pure black & white (Otsu threshold). Best for clean printed documents and screenshots; can hurt unevenly-lit photos."
                            className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition disabled:opacity-50',
                                binarize
                                    ? 'bg-gold-500/15 text-gold-300 border-gold-500/30'
                                    : 'bg-navy-800/60 text-navy-300 border-white/10 hover:text-white',
                            )}
                        >
                            {binarize ? <Check className="w-3.5 h-3.5" /> : <Contrast className="w-3.5 h-3.5" />}
                            B&amp;W
                        </button>

                        <button
                            type="button"
                            onClick={() => setHighQuality((v) => !v)}
                            disabled={running}
                            title="Send images to the engine at full resolution instead of downscaling. Sharper on dense pages, but uses much more memory — may fail on phones."
                            className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition disabled:opacity-50',
                                highQuality
                                    ? 'bg-gold-500/15 text-gold-300 border-gold-500/30'
                                    : 'bg-navy-800/60 text-navy-300 border-white/10 hover:text-white',
                            )}
                        >
                            {highQuality ? <Check className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                            High quality
                        </button>

                        <div className="ml-auto flex items-center gap-2">
                            {files.length > 0 && !running && (
                                <button type="button" onClick={clearAll}
                                        className="inline-flex items-center gap-1.5 text-xs text-navy-400 hover:text-red-400 transition">
                                    <Trash2 className="w-3.5 h-3.5" /> Clear
                                </button>
                            )}
                            <Button onClick={runOcr} disabled={running || files.every((f) => f.status === 'done')}>
                                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                {running ? 'Reading…' : `Run OCR${files.length ? ` (${files.filter((f) => f.status !== 'done').length})` : ''}`}
                            </Button>
                        </div>
                    </div>

                    {warm === 'loading' && (
                        <p className="mt-2 text-[11px] text-navy-400 flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-gold-400" />
                            Preparing OCR engine — downloading the language model (one-time, then cached). You can upload now; OCR will start once it's ready.
                        </p>
                    )}
                    {warm === 'ready' && (
                        <p className="mt-2 text-[11px] text-emerald-300/70 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 shrink-0" /> OCR engine ready.
                        </p>
                    )}

                    {highQuality && (
                        <p className="mt-2 text-[11px] text-amber-300/80 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Full-resolution mode — best on desktop. Large phone photos may run out of memory and fail.
                        </p>
                    )}

                    {files.length > 0 && (
                        <div className="mt-4 border border-white/5 rounded-xl overflow-hidden bg-navy-900/30">
                            {files.map((item) => (
                                <FileRow key={item.id} item={item} onRemove={removeFile} disabled={running} />
                            ))}
                        </div>
                    )}
                </Card>

                {/* First-run hint */}
                {files.length === 0 && (
                    <Card animate={false} className="border-gold-500/15 bg-gold-500/[0.03]">
                        <div className="flex items-start gap-3">
                            <ImageIcon className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-navy-300 space-y-1">
                                <p className="text-white text-sm font-medium">Tip</p>
                                <p>The first run downloads the language model (~4–11 MB, served from this app) and caches it — later runs are faster.</p>
                                <p>For best accuracy use sharp, well-lit, straight images. Handwriting and low-contrast scans are less reliable.</p>
                                <p>PDFs: pages with digital text are read directly (instant, exact); scanned pages go through OCR page by page (first {MAX_PDF_PAGES} pages).</p>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Result */}
                {(result || doneCount > 0) && (
                    <Card>
                        <div className="flex items-center gap-2 mb-2.5">
                            <FileText className="w-3.5 h-3.5 text-gold-400" />
                            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Extracted text</p>
                            <Badge className="bg-navy-700/40 text-navy-300 border-white/5">{result.length} chars</Badge>
                            <div className="ml-auto flex items-center gap-3">
                                <button type="button" onClick={copyResult} className="inline-flex items-center gap-1 text-[11px] text-navy-400 hover:text-gold-300 transition">
                                    <Copy className="w-3.5 h-3.5" /> Copy
                                </button>
                                <button type="button" onClick={downloadTxt} className="inline-flex items-center gap-1 text-[11px] text-navy-400 hover:text-gold-300 transition">
                                    <Download className="w-3.5 h-3.5" /> .txt
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={result}
                            onChange={(e) => setResult(e.target.value)}
                            rows={12}
                            placeholder="Recognised text will appear here. You can edit it before copying or ingesting."
                            className="w-full resize-y px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white placeholder-navy-500 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50"
                        />

                        {/* RAG ingest */}
                        <div className="mt-4 pt-4 border-t border-white/10">
                            {!ragConfigured ? (
                                <p className="text-xs text-navy-500">RAG backend not configured — add <code className="text-navy-300">RAG_BACKEND_URL</code> to enable knowledge-base ingest.</p>
                            ) : (
                                <div className="flex flex-wrap items-end gap-3">
                                    <div className="flex-1 min-w-[200px]">
                                        <label className="block text-[10px] font-semibold text-navy-500 uppercase tracking-wider mb-1">Ingest into RAG as</label>
                                        <input
                                            value={ragTitle}
                                            onChange={(e) => setRagTitle(e.target.value)}
                                            placeholder="Document title"
                                            className="w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white placeholder-navy-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                        />
                                    </div>
                                    <Button variant="secondary" onClick={ingestToRag} disabled={!canIngest || ragBusy}>
                                        {ragBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        Ingest to RAG
                                    </Button>
                                </div>
                            )}
                            {ragMsg && (
                                <p className={cn('mt-2 text-xs flex items-center gap-1.5', ragMsg.ok ? 'text-emerald-300' : 'text-red-300')}>
                                    {ragMsg.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                    {ragMsg.text}
                                </p>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
