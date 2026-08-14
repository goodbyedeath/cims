import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, ChevronDown, ChevronRight, Loader2, AlertCircle, ArrowLeft, MessageSquare, Trash2, Quote, Library, FileText, Check, Copy, Cpu } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Badge from '@/Components/ui/Badge';
import Markdown from '@/Components/ui/Markdown';
import { cn, csrfHeaders } from '@/Lib/utils';

function csrf() {
    return typeof document !== 'undefined'
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        : '';
}

function formatScore(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toFixed(3);
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text || '');
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
    };
    return (
        <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 text-[10px] text-navy-400 hover:text-gold-300 transition"
            title="Copy answer"
        >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

const EXAMPLES = [
    'Summarise the key points across all ingested documents.',
    'What are the warranty terms?',
    'List the main product specifications.',
];

// Selectable LLM providers. "ollama" is the local default; "gemini" uses cloud quota.
const PROVIDERS = [
    { value: 'ollama', label: 'Local', icon: Cpu },
    { value: 'gemini', label: 'Gemini', icon: Sparkles },
];

function providerLabel(value) {
    return PROVIDERS.find((p) => p.value === value)?.label || value;
}

// Pick the most meaningful score available, normalised to 0..1 for the bar.
function primaryScore(source) {
    const v = source.rerank_score ?? source.hybrid_score ?? source.score;
    if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
    const n = Number(v);
    return Math.max(0, Math.min(1, n)); // rerank/hybrid/cosine are already ~0..1
}

function SourceRow({ source, rank }) {
    const [open, setOpen] = useState(false);
    const hybrid = source.hybrid_score;
    const rerank = source.rerank_score;
    const score  = source.score;
    const bar = primaryScore(source);

    return (
        <div className="border-b border-white/5 last:border-0">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition group"
            >
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-navy-800/60 text-[11px] font-semibold text-navy-300 shrink-0 group-hover:text-gold-300 transition">
                    {rank}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{source.title || source.document_id || 'Untitled chunk'}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-navy-400">
                        {bar !== null && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-1 w-16 rounded-full bg-navy-800 overflow-hidden">
                                    <span className="block h-full rounded-full bg-gradient-to-r from-gold-500/70 to-gold-400" style={{ width: `${Math.round(bar * 100)}%` }} />
                                </span>
                                <span className="text-navy-300">{Math.round(bar * 100)}%</span>
                            </span>
                        )}
                        {score  !== undefined && <span>score <strong className="text-navy-200">{formatScore(score)}</strong></span>}
                        {hybrid !== undefined && <span>hybrid <strong className="text-navy-200">{formatScore(hybrid)}</strong></span>}
                        {rerank !== undefined && <span>rerank <strong className="text-navy-200">{formatScore(rerank)}</strong></span>}
                    </div>
                </div>
                {open ? <ChevronDown className="w-4 h-4 text-navy-500 shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-navy-500 shrink-0 mt-1" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-3 pl-13">
                            <pre className="text-xs text-navy-300 whitespace-pre-wrap bg-navy-950/60 border border-white/5 rounded-lg p-3 leading-relaxed max-h-64 overflow-y-auto">
                                {source.chunk || '(no content)'}
                            </pre>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function SourcesPanel({ sources }) {
    const [open, setOpen] = useState(false);   // minimised by default — keeps the answer clean
    const count = sources.length;

    return (
        <div className="mt-4 border border-white/5 rounded-xl overflow-hidden bg-navy-900/30">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-navy-800/40 hover:bg-navy-800/60 transition text-left"
            >
                <Library className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <p className="text-[11px] font-semibold text-navy-200 uppercase tracking-wider">
                    {count} source{count === 1 ? '' : 's'}
                </p>
                <span className="text-[10px] text-navy-500 font-normal normal-case tracking-normal">
                    {open ? 'click to hide' : 'click to view passages'}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-navy-500 ml-auto shrink-0 transition-transform', open && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-white/5">
                            {sources.map((s, i) => (
                                <SourceRow key={i} source={s} rank={i + 1} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function RagAsk() {
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState([]);   // [{ q, a, sources, latency_ms, provider_used, error }]
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState('ollama');  // Local by default
    const tailRef = useRef(null);

    useEffect(() => {
        tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [history, loading]);

    const run = async (raw) => {
        const q = (raw ?? query).trim();
        if (!q || loading) return;
        setLoading(true);
        const turn = { q, a: null, sources: [], latency_ms: null, provider_used: null, error: null };
        setHistory((prev) => [...prev, turn]);
        setQuery('');

        try {
            const res = await fetch('/admin/rag/ask/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...csrfHeaders(),
                    Accept: 'application/json',
                },
                body: JSON.stringify({ query: q, top_k: 5, provider }),
            });
            const json = await res.json();
            setHistory((prev) => prev.map((t, i) => {
                if (i !== prev.length - 1) return t;
                if (!res.ok) return { ...t, error: json.detail || json.error || `HTTP ${res.status}` };
                return {
                    ...t,
                    a: json.answer ?? '(empty answer)',
                    sources: Array.isArray(json.sources) ? json.sources : [],
                    latency_ms: json.latency_ms ?? null,
                    provider_used: json.provider_used ?? null,
                };
            }));
        } catch (err) {
            setHistory((prev) => prev.map((t, i) =>
                i !== prev.length - 1 ? t : { ...t, error: err.message || 'Network error' }
            ));
        } finally {
            setLoading(false);
        }
    };

    const submit = (e) => { e?.preventDefault(); run(); };

    return (
        <AuthenticatedLayout title="RAG · Ask">
            {/* ── Header ── */}
            <div className="max-w-4xl mx-auto mb-4 flex items-center gap-3 flex-wrap">
                <Link href="/admin/rag" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>
                <div className="flex items-center gap-2 ml-1">
                    <div className="p-2 rounded-lg bg-gold-500/10 text-gold-400">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">Ask</h2>
                </div>
                {history.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setHistory([])}
                        disabled={loading}
                        className="ml-auto inline-flex items-center gap-1.5 text-xs text-navy-400 hover:text-red-400 transition disabled:opacity-40"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                )}
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                {history.length === 0 && !loading && (
                    <Card className="border-gold-500/20 bg-gold-500/5">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-white">Ask a question about your ingested knowledge.</p>
                                <p className="text-xs text-navy-400 mt-1">Responses can take up to a minute on the self-hosted backend.</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {EXAMPLES.map((ex) => (
                                        <button
                                            key={ex}
                                            type="button"
                                            onClick={() => run(ex)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800/50 border border-white/10 text-xs text-navy-200 hover:text-gold-300 hover:border-gold-500/30 transition text-left"
                                        >
                                            <Quote className="w-3 h-3 text-navy-500 shrink-0" /> {ex}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {history.map((turn, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3"
                    >
                        <Card animate={false} className="border-gold-500/10">
                            <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-wider mb-1">You</p>
                            <p className="text-sm text-white whitespace-pre-wrap">{turn.q}</p>
                        </Card>

                        {turn.error ? (
                            <Card animate={false} className="border-red-500/20 bg-red-500/5">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-red-300">Backend error</p>
                                        <p className="text-xs text-red-300/80 mt-1 break-words">{turn.error}</p>
                                    </div>
                                </div>
                            </Card>
                        ) : turn.a !== null ? (
                            <Card animate={false}>
                                <div className="flex items-center gap-2 mb-2.5">
                                    <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Answer</p>
                                    <div className="ml-auto flex items-center gap-2.5">
                                        <CopyButton text={turn.a} />
                                        {turn.provider_used && (
                                            <Badge className={cn(
                                                'border',
                                                turn.provider_used === 'gemini'
                                                    ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                                                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
                                            )}>
                                                answered by {providerLabel(turn.provider_used)}
                                            </Badge>
                                        )}
                                        {turn.latency_ms !== null && (
                                            <Badge className="bg-navy-700/40 text-navy-300 border-white/5">
                                                {(turn.latency_ms / 1000).toFixed(2)}s
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <Markdown>{turn.a}</Markdown>

                                {turn.sources.length > 0 && <SourcesPanel sources={turn.sources} />}
                            </Card>
                        ) : (
                            <Card animate={false}>
                                <div className="flex items-center gap-3 text-navy-300">
                                    <Loader2 className="w-4 h-4 animate-spin text-gold-400" />
                                    <p className="text-sm">Thinking… this can take up to a minute.</p>
                                </div>
                            </Card>
                        )}
                    </motion.div>
                ))}

                <div ref={tailRef} />

                <form onSubmit={submit} className="sticky bottom-4">
                    <Card animate={false} className="p-3 border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-semibold text-navy-500 uppercase tracking-wider">Model</span>
                            <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-navy-800/60 border border-white/10">
                                {PROVIDERS.map((p) => {
                                    const Icon = p.icon;
                                    const active = provider === p.value;
                                    return (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() => setProvider(p.value)}
                                            disabled={loading}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition disabled:opacity-50',
                                                active
                                                    ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30'
                                                    : 'text-navy-300 hover:text-white border border-transparent',
                                            )}
                                        >
                                            <Icon className="w-3.5 h-3.5" /> {p.label}
                                            {p.value === 'ollama' && active && <span className="text-[9px] text-navy-400">default</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-end gap-2">
                            <textarea
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                                }}
                                placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
                                rows={2}
                                className={cn(
                                    'flex-1 resize-none px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white placeholder-navy-500 text-sm',
                                    'focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50 transition-all',
                                )}
                                disabled={loading}
                            />
                            <Button type="submit" disabled={loading || !query.trim()} size="md">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                <span className="hidden sm:inline">Send</span>
                            </Button>
                        </div>
                    </Card>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
