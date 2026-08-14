import { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { motion } from 'framer-motion';
import {
    MessageSquare, Upload, FileText, Sparkles, RefreshCw,
    Database, Layers, FileType, ClipboardType, ArrowRight, Clock, Activity,
} from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import { cn } from '@/Lib/utils';

const STATUS_META = {
    ok:           { label: 'Online',         dot: 'bg-emerald-400', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    degraded:     { label: 'Degraded',       dot: 'bg-yellow-400',  cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    offline:      { label: 'Offline',        dot: 'bg-red-400',     cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    unconfigured: { label: 'Not configured', dot: 'bg-navy-400',    cls: 'bg-navy-700/30 text-navy-300 border-white/10' },
    checking:     { label: 'Checking…',      dot: 'bg-navy-400',    cls: 'bg-navy-700/30 text-navy-300 border-white/10' },
};

const TILES = [
    {
        href: '/admin/rag/ask', title: 'Ask', icon: MessageSquare,
        desc: 'Natural-language Q&A across ingested knowledge.',
        accent: 'text-gold-400 bg-gold-500/10', ring: 'hover:border-gold-500/40',
    },
    {
        href: '/admin/rag/ingest', title: 'Ingest', icon: Upload,
        desc: 'Upload PDFs or paste text to grow the knowledge base.',
        accent: 'text-sky-400 bg-sky-500/10', ring: 'hover:border-sky-500/40',
    },
    {
        href: '/admin/rag/documents', title: 'Documents', icon: FileText,
        desc: 'Review everything your team has ingested.',
        accent: 'text-purple-400 bg-purple-500/10', ring: 'hover:border-purple-500/40',
    },
];

function relativeTime(iso) {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const diff = Math.round((Date.now() - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
}

function StatCard({ icon: Icon, label, value, accent, delay }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay }}
        >
            <Card animate={false} className="h-full">
                <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-xl shrink-0', accent)}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-2xl font-bold text-white leading-none tabular-nums">{value}</p>
                        <p className="text-xs text-navy-400 mt-1">{label}</p>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}

export default function RagIndex({ configured, stats, recent = [] }) {
    const [status, setStatus] = useState(configured ? 'checking' : 'unconfigured');
    const [details, setDetails] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showRaw, setShowRaw] = useState(false);

    const fetchHealth = async () => {
        if (!configured) return;
        setRefreshing(true);
        try {
            const res = await fetch('/admin/rag/health', { headers: { Accept: 'application/json' } });
            const json = await res.json();
            setStatus(json.configured === false ? 'unconfigured' : (json.status || 'offline'));
            setDetails(json);
        } catch {
            setStatus('offline');
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchHealth(); /* eslint-disable-next-line */ }, []);

    const meta = STATUS_META[status] || STATUS_META.offline;
    const nf = (n) => (n ?? 0).toLocaleString();

    // Flatten the backend health payload into label/value rows (skip nested objects)
    const healthRows = details?.payload && typeof details.payload === 'object'
        ? Object.entries(details.payload).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
        : [];

    return (
        <AuthenticatedLayout title="RAG">
            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-6 flex items-center gap-4 flex-wrap"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gold-500/10 text-gold-400">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-white">Retrieval-Augmented Q&A</h2>
                        <p className="text-sm text-navy-400">Server-side proxy to your self-hosted FastAPI backend.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <Badge className={cn(meta.cls)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full mr-2', meta.dot, status === 'ok' && 'animate-pulse')} />
                        {meta.label}
                    </Badge>
                    <button
                        type="button"
                        onClick={fetchHealth}
                        disabled={!configured || refreshing}
                        className="p-2 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Refresh health"
                    >
                        <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
                    </button>
                </div>
            </motion.div>

            {status === 'unconfigured' && (
                <Card className="mb-6 border-yellow-500/20 bg-yellow-500/5">
                    <p className="text-sm text-yellow-300">
                        RAG backend isn't configured yet. Set <code className="text-yellow-200">RAG_BACKEND_URL</code> and <code className="text-yellow-200">RAG_BACKEND_API_KEY</code> in <code className="text-yellow-200">.env</code> on the server, then refresh.
                    </p>
                </Card>
            )}

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard icon={Database}      label="Documents"      value={nf(stats?.documents)} accent="text-gold-400 bg-gold-500/10"     delay={0.02} />
                <StatCard icon={Layers}        label="Chunks indexed" value={nf(stats?.chunks)}    accent="text-emerald-400 bg-emerald-500/10" delay={0.06} />
                <StatCard icon={FileType}      label="PDF files"      value={nf(stats?.pdf)}       accent="text-sky-400 bg-sky-500/10"        delay={0.10} />
                <StatCard icon={ClipboardType} label="Text snippets"  value={nf(stats?.text)}      accent="text-purple-400 bg-purple-500/10"   delay={0.14} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Action tiles ── */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {TILES.map(({ href, title, desc, icon: Icon, accent, ring }, i) => (
                            <Link key={href} href={href} className="group">
                                <Card animate={false} className={cn('h-full transition-colors flex flex-col', ring)}>
                                    <motion.div
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: 0.05 * i }}
                                        className="flex flex-col h-full"
                                    >
                                        <div className={cn('p-2 rounded-lg w-fit', accent)}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-white mt-3 group-hover:text-gold-300 transition">{title}</h3>
                                        <p className="text-xs text-navy-400 mt-1 leading-relaxed flex-1">{desc}</p>
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-navy-500 group-hover:text-gold-400 transition mt-3">
                                            Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                        </span>
                                    </motion.div>
                                </Card>
                            </Link>
                        ))}
                    </div>

                    {/* ── Recent activity ── */}
                    <Card animate={false} className="p-0 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gold-400" />
                                <h3 className="text-sm font-semibold text-white">Recent ingests</h3>
                            </div>
                            <Link href="/admin/rag/documents" className="text-xs text-navy-400 hover:text-gold-400 transition inline-flex items-center gap-1">
                                View all <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                        {recent.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-navy-400">
                                <FileText className="w-8 h-8 text-navy-600 mb-2" />
                                <p className="text-sm">Nothing ingested yet.</p>
                                <Link href="/admin/rag/ingest" className="text-xs text-gold-400 hover:text-gold-300 mt-1">Ingest your first document →</Link>
                            </div>
                        ) : (
                            <ul className="divide-y divide-white/5">
                                {recent.map((d) => (
                                    <li key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition">
                                        <div className={cn('p-1.5 rounded-lg shrink-0', d.source === 'file' ? 'bg-sky-500/10 text-sky-400' : 'bg-purple-500/10 text-purple-400')}>
                                            {d.source === 'file' ? <FileType className="w-4 h-4" /> : <ClipboardType className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-white truncate">{d.title}</p>
                                            <p className="text-[11px] text-navy-500 truncate">
                                                {d.user?.name ?? '—'}
                                                {d.filename ? ` · ${d.filename}` : ''}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs font-mono text-navy-200">{nf(d.chunks_indexed)} <span className="text-navy-500">chunks</span></p>
                                            <p className="text-[10px] text-navy-500">{relativeTime(d.created_at) ?? ''}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>

                {/* ── Backend health panel ── */}
                <div className="space-y-4">
                    <Card animate={false} className="p-0 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-gold-400" />
                                <h3 className="text-sm font-semibold text-white">Backend health</h3>
                            </div>
                            <Badge className={cn('text-[10px]', meta.cls)}>{meta.label}</Badge>
                        </div>
                        <div className="p-5 space-y-3">
                            {stats?.last_ingest && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-navy-400">Last ingest</span>
                                    <span className="text-navy-200">{relativeTime(stats.last_ingest)}</span>
                                </div>
                            )}
                            {healthRows.length > 0 ? (
                                healthRows.map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between gap-3 text-xs">
                                        <span className="text-navy-400 capitalize truncate">{k.replace(/_/g, ' ')}</span>
                                        <span className="text-navy-200 font-mono truncate max-w-[55%] text-right">
                                            {typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v ?? '—')}
                                        </span>
                                    </div>
                                ))
                            ) : status !== 'unconfigured' && (
                                <p className="text-xs text-navy-500">
                                    {refreshing ? 'Checking backend…' : 'No additional health details reported.'}
                                </p>
                            )}

                            {details?.payload && (
                                <div className="pt-2 border-t border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => setShowRaw((s) => !s)}
                                        className="text-[11px] text-navy-400 hover:text-gold-400 transition"
                                    >
                                        {showRaw ? 'Hide' : 'Show'} raw response
                                    </button>
                                    {showRaw && (
                                        <pre className="mt-2 text-[11px] text-navy-400 bg-navy-950/60 border border-white/5 rounded-lg p-3 overflow-x-auto">
                                            {JSON.stringify(details.payload, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
