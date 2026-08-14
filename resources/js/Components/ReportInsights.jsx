import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Cpu, Loader2, AlertCircle, Check, Copy, Wand2, RefreshCw } from 'lucide-react';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Markdown from '@/Components/ui/Markdown';
import { cn, csrfHeaders } from '@/Lib/utils';

function csrf() {
    return typeof document !== 'undefined'
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        : '';
}

// Same selectable providers as the RAG Ask page: local model vs cloud Gemini.
const PROVIDERS = [
    { value: 'ollama', label: 'Local', icon: Cpu },
    { value: 'gemini', label: 'Gemini', icon: Sparkles },
];

function providerLabel(value) {
    return PROVIDERS.find((p) => p.value === value)?.label || value;
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
            title="Copy summary"
        >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

/**
 * AI executive summary for a report period. Recomputes nothing client-side —
 * it posts the report identity (type + period) to /reports/insights, which
 * rebuilds the figures server-side and asks the chosen LLM to narrate them.
 */
export default function ReportInsights({ type, month, year }) {
    const [provider, setProvider] = useState('ollama');
    const [loading, setLoading] = useState(false);
    const [insight, setInsight] = useState(null);
    const [providerUsed, setProviderUsed] = useState(null);
    const [error, setError] = useState(null);

    const generate = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/reports/insights', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...csrfHeaders(),
                    Accept: 'application/json',
                },
                body: JSON.stringify({ type, month, year, provider }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.detail || json.error || `HTTP ${res.status}`);
            } else {
                setInsight(json.insight || '(empty summary)');
                setProviderUsed(json.provider_used || null);
            }
        } catch (err) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-gold-500/20 bg-gradient-to-br from-gold-500/[0.04] to-transparent mb-6">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gold-500/10 text-gold-400">
                        <Wand2 className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white leading-tight">AI Executive Summary</h3>
                        <p className="text-[11px] text-navy-400">Narrated from this period's figures.</p>
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
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
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={generate}
                        disabled={loading}
                        className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                            'bg-gold-500/15 text-gold-200 border border-gold-500/30 hover:bg-gold-500/25 disabled:opacity-50',
                        )}
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : insight ? <RefreshCw className="w-3.5 h-3.5" />
                            : <Sparkles className="w-3.5 h-3.5" />}
                        {loading ? 'Generating…' : insight ? 'Regenerate' : 'Generate'}
                    </button>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {(loading || insight || error) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-4 pt-4 border-t border-white/10">
                            {error ? (
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-red-300">Could not generate summary</p>
                                        <p className="text-xs text-red-300/80 mt-1 break-words">{error}</p>
                                    </div>
                                </div>
                            ) : insight ? (
                                <>
                                    <div className="flex items-center gap-2.5 mb-2">
                                        <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Summary</p>
                                        <div className="ml-auto flex items-center gap-2.5">
                                            <CopyButton text={insight} />
                                            {providerUsed && (
                                                <Badge className={cn(
                                                    'border',
                                                    providerUsed === 'gemini'
                                                        ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
                                                )}>
                                                    by {providerLabel(providerUsed)}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Markdown>{insight}</Markdown>
                                </>
                            ) : (
                                <div className="flex items-center gap-3 text-navy-300">
                                    <Loader2 className="w-4 h-4 animate-spin text-gold-400" />
                                    <p className="text-sm">Analysing the figures… this can take up to a minute.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
