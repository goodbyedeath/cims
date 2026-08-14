import { useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { FileUp, FileText, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Upload, X } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Badge from '@/Components/ui/Badge';
import { cn, csrfHeaders } from '@/Lib/utils';

function csrf() {
    return typeof document !== 'undefined'
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        : '';
}

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB — matches server-side validator

export default function RagIngest() {
    const [tab, setTab] = useState('file'); // 'file' | 'text'

    // file tab
    const [file, setFile] = useState(null);
    const [fileTitle, setFileTitle] = useState('');
    const [fileError, setFileError] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef(null);

    // text tab
    const [textTitle, setTextTitle] = useState('');
    const [textSource, setTextSource] = useState('paste');
    const [textBody, setTextBody] = useState('');

    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const acceptFile = (f) => {
        setFileError(null);
        if (!f) { setFile(null); return; }
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
            setFileError('Only PDF files are accepted.');
            setFile(null);
            return;
        }
        if (f.size > MAX_PDF_BYTES) {
            setFileError(`File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max ${(MAX_PDF_BYTES / 1024 / 1024)} MB.`);
            setFile(null);
            return;
        }
        setFile(f);
        if (!fileTitle) setFileTitle(f.name.replace(/\.pdf$/i, ''));
    };

    const onPickFile = (e) => acceptFile(e.target.files?.[0] || null);

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        acceptFile(e.dataTransfer.files?.[0] || null);
    };

    const clearFile = () => { setFile(null); setFileError(null); if (inputRef.current) inputRef.current.value = ''; };

    const submitFile = async (e) => {
        e.preventDefault();
        if (!file || busy) return;
        setBusy(true); setResult(null); setError(null);

        const fd = new FormData();
        fd.append('file', file);
        if (fileTitle) fd.append('title', fileTitle);

        try {
            const res = await fetch('/admin/rag/ingest/file', {
                method: 'POST',
                headers: { ...csrfHeaders(), Accept: 'application/json' },
                body: fd,
            });
            const json = await res.json();
            if (!res.ok) setError(json.detail || json.error || `HTTP ${res.status}`);
            else { setResult(json); clearFile(); setFileTitle(''); }
        } catch (err) {
            setError(err.message || 'Network error');
        } finally {
            setBusy(false);
        }
    };

    const submitText = async (e) => {
        e.preventDefault();
        if (!textTitle.trim() || !textBody.trim() || busy) return;
        setBusy(true); setResult(null); setError(null);

        try {
            const res = await fetch('/admin/rag/ingest/text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...csrfHeaders(),
                    Accept: 'application/json',
                },
                body: JSON.stringify({ title: textTitle, source: textSource || 'paste', text: textBody }),
            });
            const json = await res.json();
            if (!res.ok) setError(json.detail || json.error || `HTTP ${res.status}`);
            else { setResult(json); setTextBody(''); setTextTitle(''); }
        } catch (err) {
            setError(err.message || 'Network error');
        } finally {
            setBusy(false);
        }
    };

    const tabBtn = (id, label, Icon) => (
        <button
            type="button"
            onClick={() => { setTab(id); setError(null); setResult(null); }}
            className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border',
                tab === id
                    ? 'bg-gold-500/10 text-gold-400 border-gold-500/20'
                    : 'bg-navy-800/40 text-navy-300 border-white/5 hover:text-white hover:bg-white/5'
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <AuthenticatedLayout title="RAG · Ingest">
            {/* ── Header ── */}
            <div className="max-w-3xl mx-auto mb-4 flex items-center gap-3">
                <Link href="/admin/rag" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>
                <div className="flex items-center gap-2 ml-1">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                        <Upload className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Ingest knowledge</h2>
                        <p className="text-xs text-navy-400">Add PDFs or text to the knowledge base.</p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-2">
                    {tabBtn('file', 'PDF Upload', FileUp)}
                    {tabBtn('text', 'Paste Text', FileText)}
                </div>

                {error && (
                    <Card animate={false} className="border-red-500/20 bg-red-500/5">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-semibold text-red-300">Ingest failed</p>
                                <p className="text-xs text-red-300/80 mt-1 break-words">{error}</p>
                            </div>
                        </div>
                    </Card>
                )}

                {result && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                        <Card animate={false} className="border-emerald-500/20 bg-emerald-500/5">
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-emerald-300">Ingested successfully</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                                            {result.chunks_indexed ?? '?'} chunks
                                        </Badge>
                                        {result.document_id && (
                                            <Badge className="bg-navy-700/40 text-navy-300 border-white/5 font-mono">
                                                doc: {String(result.document_id).slice(0, 16)}…
                                            </Badge>
                                        )}
                                    </div>
                                    <Link href="/admin/rag/documents" className="inline-block text-[11px] text-emerald-300/90 hover:text-emerald-200 mt-2">
                                        View in documents →
                                    </Link>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {tab === 'file' && (
                    <Card>
                        <form onSubmit={submitFile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-navy-200 mb-1.5">PDF file</label>

                                {/* Drag & drop zone */}
                                <div
                                    onClick={() => inputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={onDrop}
                                    role="button"
                                    tabIndex={0}
                                    className={cn(
                                        'relative flex flex-col items-center justify-center text-center px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition',
                                        dragOver
                                            ? 'border-sky-500/60 bg-sky-500/5'
                                            : file
                                                ? 'border-emerald-500/40 bg-emerald-500/5'
                                                : 'border-white/15 bg-navy-800/30 hover:border-sky-500/40 hover:bg-white/5'
                                    )}
                                >
                                    <input
                                        ref={inputRef}
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        onChange={onPickFile}
                                        className="hidden"
                                    />
                                    {file ? (
                                        <>
                                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 mb-2">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <p className="text-sm text-white font-medium truncate max-w-full">{file.name}</p>
                                            <p className="text-xs text-navy-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                                                className="mt-3 inline-flex items-center gap-1 text-xs text-navy-400 hover:text-red-400 transition"
                                            >
                                                <X className="w-3.5 h-3.5" /> Remove
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 mb-2">
                                                <FileUp className="w-6 h-6" />
                                            </div>
                                            <p className="text-sm text-navy-200">
                                                <span className="text-sky-400 font-medium">Click to browse</span> or drag a PDF here
                                            </p>
                                            <p className="text-[11px] text-navy-500 mt-1">PDF only · max 20 MB</p>
                                        </>
                                    )}
                                </div>

                                {fileError && <p className="text-xs text-red-400 mt-1.5">{fileError}</p>}
                            </div>

                            <Input
                                label="Title (optional)"
                                value={fileTitle}
                                onChange={(e) => setFileTitle(e.target.value)}
                                placeholder="Leave blank to use filename"
                            />

                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] text-navy-500">
                                    Large PDFs may take a minute or more on the backend.
                                </p>
                                <Button type="submit" disabled={!file || busy}>
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                                    {busy ? 'Uploading…' : 'Ingest PDF'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                )}

                {tab === 'text' && (
                    <Card>
                        <form onSubmit={submitText} className="space-y-4">
                            <Input
                                label="Title"
                                value={textTitle}
                                onChange={(e) => setTextTitle(e.target.value)}
                                placeholder="e.g. Onboarding FAQ"
                                required
                            />
                            <Input
                                label="Source (optional)"
                                value={textSource}
                                onChange={(e) => setTextSource(e.target.value)}
                                placeholder="paste"
                            />
                            <div>
                                <label className="block text-sm font-medium text-navy-200 mb-1.5">Text</label>
                                <textarea
                                    value={textBody}
                                    onChange={(e) => setTextBody(e.target.value)}
                                    rows={12}
                                    placeholder="Paste content to ingest…"
                                    className={cn(
                                        'w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white placeholder-navy-500 text-sm',
                                        'focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50 transition-all font-mono'
                                    )}
                                    required
                                />
                                <p className="text-[11px] text-navy-500 mt-1.5">
                                    {textBody.length.toLocaleString()} characters{textBody.trim().length > 0 && textBody.trim().length < 10 ? ' · need at least 10' : ''}
                                </p>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <Button type="submit" disabled={busy || !textTitle.trim() || textBody.trim().length < 10}>
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    {busy ? 'Ingesting…' : 'Ingest text'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
