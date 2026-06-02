import { useRef, useState, useEffect } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Search, FileText, ChevronLeft, ChevronRight,
    ExternalLink, Loader2, SlidersHorizontal, ArrowLeft, Sun, Moon,
    KeyRound, Lock, X, LogOut
} from 'lucide-react';

// ── Shared CSS ────────────────────────────────────────────────────────────────

const PAGE_CSS = `
    @keyframes cardIn  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes heroIn  { from{opacity:0;transform:translateY(-8px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
    .hg-dark  { background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:48px 48px; }
    .hg-light { background-image:linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px);background-size:48px 48px; }
    .mk-dark  mark { background:transparent;color:#e5c043;font-weight:700;border-bottom:1px solid rgba(229,192,67,.4); }
    .mk-light mark { background:transparent;color:#b45309;font-weight:700;border-bottom:1px solid rgba(180,83,9,.3); }
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#273c6b;border-radius:4px}
`;

const FILTERS = [
    { key: 'all',       label: 'Semua' },
    { key: 'catalog',   label: 'Katalog' },
    { key: 'inventory', label: 'Inventori' },
];

const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';

// ── Helpers ───────────────────────────────────────────────────────────────────

const Hl = ({ html }) => <span dangerouslySetInnerHTML={{ __html: html }} />;

function ScoreBadge({ score }) {
    const pct   = Math.round(score * 100);
    const color = pct >= 60 ? 'text-emerald-400' : pct >= 30 ? 'text-amber-400' : 'text-slate-500';
    return <span className={`text-[10px] font-mono tabular-nums ${color}`}>{pct}%</span>;
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ result, isDark }) {
    return (
        <div className={`group rounded-2xl border p-4 transition-all duration-200 ${
            isDark
                ? 'bg-navy-800/50 border-white/8 hover:border-gold-500/25 hover:bg-navy-800/80'
                : 'bg-white border-gray-200 hover:border-amber-300/60 shadow-sm hover:shadow-md'
        }`} style={{ animation: 'cardIn .3s ease both' }}>
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center ${isDark ? 'border-white/8 bg-white/4' : 'border-gray-200 bg-gray-50'}`}>
                    <FileText size={14} className={isDark ? 'text-navy-500' : 'text-gray-400'} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <a href={result.url} className={`text-sm font-semibold leading-snug transition-colors ${isDark ? 'text-white hover:text-gold-400' : 'text-gray-900 hover:text-amber-600'}`}>
                            <Hl html={result.title} />
                        </a>
                        <div className="flex items-center gap-2 shrink-0">
                            <ScoreBadge score={result.score} />
                            <a href={result.url} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-navy-500 hover:text-white' : 'text-gray-300 hover:text-gray-600'}`} title="Buka">
                                <ExternalLink size={12} />
                            </a>
                        </div>
                    </div>
                    {result.subtitle && <p className={`mt-0.5 text-xs truncate ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{result.subtitle}</p>}
                    {result.snippet && <p className={`mt-2 text-xs leading-relaxed line-clamp-2 ${isDark ? 'text-navy-400' : 'text-gray-500'}`}><Hl html={result.snippet} /></p>}
                    {result.meta?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                            {result.meta.map((m) => (
                                <span key={m.label} className={`text-[11px] ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                    {m.label}:{' '}
                                    {m.locked ? (
                                        <span className={`inline-flex items-center gap-0.5 ${isDark ? 'text-navy-600' : 'text-gray-300'}`}>
                                            <Lock size={9} />
                                            <span className="text-[10px] font-medium">Harga Partner</span>
                                        </span>
                                    ) : m.empty ? (
                                        <span className="text-red-400 font-semibold">{m.value}</span>
                                    ) : (
                                        <span className={isDark ? 'text-navy-300' : 'text-gray-700'}>{m.value}</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ currentPage, lastPage, onPage, isDark }) {
    if (lastPage <= 1) return null;
    const pages = [];
    const s = Math.max(1, currentPage - 2), e = Math.min(lastPage, currentPage + 2);
    for (let i = s; i <= e; i++) pages.push(i);
    const base = 'w-8 h-8 flex items-center justify-center rounded-xl text-xs font-medium transition-colors';
    const act  = isDark ? 'bg-gold-500 text-navy-950'            : 'bg-amber-500 text-white';
    const inact = isDark ? 'text-navy-400 hover:bg-navy-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900';
    const dis  = isDark ? 'text-navy-700 cursor-not-allowed'     : 'text-gray-200 cursor-not-allowed';
    const dot  = isDark ? 'text-navy-600' : 'text-gray-300';
    return (
        <div className="flex items-center justify-center gap-1 mt-8">
            <button onClick={() => onPage(currentPage - 1)} disabled={currentPage === 1} className={`${base} ${currentPage === 1 ? dis : inact}`}><ChevronLeft size={14} /></button>
            {s > 1 && <><button onClick={() => onPage(1)} className={`${base} ${inact}`}>1</button>{s > 2 && <span className={`text-xs px-1 ${dot}`}>…</span>}</>}
            {pages.map((p) => <button key={p} onClick={() => onPage(p)} className={`${base} ${p === currentPage ? act : inact}`}>{p}</button>)}
            {e < lastPage && <>{e < lastPage - 1 && <span className={`text-xs px-1 ${dot}`}>…</span>}<button onClick={() => onPage(lastPage)} className={`${base} ${inact}`}>{lastPage}</button></>}
            <button onClick={() => onPage(currentPage + 1)} disabled={currentPage === lastPage} className={`${base} ${currentPage === lastPage ? dis : inact}`}><ChevronRight size={14} /></button>
        </div>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ query, isDark }) {
    if (!query) return (
        <div className="text-center py-24" style={{ animation: 'fadeIn .4s ease both' }}>
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl border mb-5 ${isDark ? 'bg-navy-800/60 border-white/8' : 'bg-white border-gray-200 shadow-sm'}`}>
                <Search size={26} className={isDark ? 'text-navy-600' : 'text-gray-300'} />
            </div>
            <p className={`font-semibold text-base ${isDark ? 'text-navy-300' : 'text-gray-700'}`}>Ketik untuk mulai mencari</p>
            <p className={`text-sm mt-1.5 ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>Cari di seluruh inventori dan katalog produk</p>
        </div>
    );
    return (
        <div className="text-center py-20" style={{ animation: 'fadeIn .3s ease both' }}>
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl border mb-4 ${isDark ? 'bg-navy-800/60 border-white/8' : 'bg-white border-gray-200 shadow-sm'}`}>
                <Search size={22} className={isDark ? 'text-navy-600' : 'text-gray-300'} />
            </div>
            <p className={`font-semibold ${isDark ? 'text-navy-300' : 'text-gray-700'}`}>Tidak ada hasil untuk &ldquo;{query}&rdquo;</p>
            <p className={`text-sm mt-1.5 ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>Coba kata kunci lain atau periksa ejaan</p>
        </div>
    );
}

// ── Partner PIN modal ─────────────────────────────────────────────────────────

function PinModal({ onClose, error, isDark }) {
    const [digits, setDigits] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [shake, setShake]     = useState(false);
    const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];
    const pin  = digits.join('');

    useEffect(() => { refs[0].current?.focus(); }, []);
    useEffect(() => {
        if (error) {
            setShake(true);
            setDigits(['', '', '', '']);
            setTimeout(() => { setShake(false); refs[0].current?.focus(); }, 500);
        }
    }, [error]);

    const submit = (value) => {
        setLoading(true);
        router.post('/search/verify-pin', { pin: value }, {
            preserveScroll: true,
            onFinish: () => setLoading(false),
            onSuccess: () => { if (!error) onClose(); },
        });
    };

    const handleChange = (i, val) => {
        const digit = val.replace(/\D/g, '').slice(-1);
        const next  = [...digits]; next[i] = digit; setDigits(next);
        if (digit && i < 3) refs[i + 1].current?.focus();
        if (digit && i === 3) { const full = next.join(''); if (full.length === 4) submit(full); }
    };

    const handleKeyDown = (i, e) => {
        if (e.key === 'Backspace') {
            if (digits[i]) { const n = [...digits]; n[i] = ''; setDigits(n); }
            else if (i > 0) refs[i - 1].current?.focus();
        } else if (e.key === 'ArrowLeft' && i > 0) { refs[i - 1].current?.focus(); }
        else if (e.key === 'ArrowRight' && i < 3) { refs[i + 1].current?.focus(); }
        else if (e.key === 'Enter' && pin.length === 4) submit(pin);
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
        if (!pasted) return;
        const next = ['', '', '', '']; pasted.split('').forEach((d, i) => { next[i] = d; });
        setDigits(next);
        refs[Math.min(pasted.length, 3)].current?.focus();
        if (pasted.length === 4) submit(pasted);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ animation: 'fadeIn .2s ease' }} onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <div
                className={`relative z-10 w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-navy-900 border border-white/10' : 'bg-white border border-gray-200 shadow-xl'}`}
                style={{ animation: 'cardIn .25s cubic-bezier(0.34,1.4,0.64,1)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-1 w-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
                <div className="p-6">
                    <div className="flex items-start justify-between gap-3 mb-5">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-gold-500/10 border border-gold-500/25' : 'bg-amber-50 border border-amber-200'}`}>
                                <KeyRound className={`w-5 h-5 ${isDark ? 'text-gold-400' : 'text-amber-600'}`} />
                            </div>
                            <div>
                                <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Akses Partner</h2>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Masukkan 4-digit kode akses</p>
                            </div>
                        </div>
                        <button onClick={onClose} className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition ${isDark ? 'text-navy-500 hover:text-white hover:bg-white/8' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                            <X className="w-3.5 h-3.5 shrink-0" />{error}
                        </div>
                    )}

                    <div className={`flex justify-center gap-2.5 mb-5 ${shake ? 'animate-[shake_.45s_ease]' : ''}`}>
                        {digits.map((d, i) => (
                            <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1} value={d}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                onPaste={handlePaste}
                                onFocus={(e) => e.target.select()}
                                className={`w-13 h-14 rounded-2xl text-center text-2xl font-black border-2 focus:outline-none transition-all select-none ${
                                    d ? isDark
                                        ? 'bg-gold-500/10 border-gold-500 text-gold-400 shadow-lg shadow-gold-500/15'
                                        : 'bg-amber-50 border-amber-400 text-amber-700'
                                      : isDark
                                        ? 'bg-navy-800/60 border-white/10 text-white focus:border-gold-500/60'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-amber-400'
                                }`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => pin.length === 4 && !loading && submit(pin)}
                        disabled={pin.length < 4 || loading}
                        className="w-full py-3 rounded-xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Memverifikasi…' : 'Masuk sebagai Partner'}
                    </button>
                    <p className={`mt-3 text-center text-[10px] ${isDark ? 'text-navy-700' : 'text-gray-300'}`}>
                        Kode diberikan oleh sales representative Anda.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Hero section (shared by both public and admin views) ──────────────────────

function SearchHero({ company, isDark, toggleTheme, isGuest, priceUnlocked, partnerPin, onOpenPin, children }) {
    const name    = company?.name     || 'Component Sales';
    const tagline = company?.tagline  || 'Sistem Integrator';
    const logo    = company?.logo_url || null;

    return (
        <div className={`relative ${isDark ? 'bg-gradient-to-b from-navy-900 via-navy-900/80 to-navy-950' : 'bg-gradient-to-b from-white via-slate-50 to-slate-100'}`}
            style={{ animation: 'heroIn .4s ease both' }}>
            {/* Grid pattern */}
            <div className={`${isDark ? 'hg-dark' : 'hg-light'} absolute inset-0 pointer-events-none`} />
            {/* Blobs */}
            <div className={`absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl pointer-events-none ${isDark ? 'bg-gold-500/8' : 'bg-amber-400/12'}`} />
            <div className={`absolute -top-16 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none ${isDark ? 'bg-blue-500/5' : 'bg-blue-400/5'}`} />
            {/* Bottom rule */}
            <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent ${isDark ? 'via-gold-500/20' : 'via-amber-400/30'}`} />

            <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-8">
                {/* Title row */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        {/* Company badge */}
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center overflow-hidden shadow-lg shadow-gold-500/30 shrink-0">
                                {logo
                                    ? <img src={logo} alt={name} className="w-full h-full object-contain" />
                                    : <span className="font-black text-navy-950 text-sm">{name[0]?.toUpperCase()}</span>}
                            </div>
                            <div>
                                <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-gold-500/80' : 'text-amber-600'}`}>{name}</p>
                                <p className={`text-[10px] tracking-wide ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>{tagline}</p>
                            </div>
                        </div>

                        <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight">
                            <span className={isDark ? 'text-white' : 'text-gray-900'}>Cari</span>{' '}
                            <span className="bg-gradient-to-r from-gold-400 to-gold-300 bg-clip-text text-transparent">Produk</span>
                        </h1>
                        <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>
                            Pencarian penuh di katalog dan inventori kami.
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="shrink-0 flex flex-col items-end gap-2 mt-1">
                        <button onClick={toggleTheme} title={isDark ? 'Mode Terang' : 'Mode Gelap'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${isDark ? 'border-white/10 bg-white/3 text-navy-400 hover:text-white hover:border-white/25 hover:bg-white/6' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm'}`}>
                            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{isDark ? 'Terang' : 'Gelap'}</span>
                        </button>
                        {isGuest && (
                            <a href="/catalog/public"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${isDark ? 'border-white/10 bg-white/3 text-navy-400 hover:text-white hover:border-white/25 hover:bg-white/6' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm'}`}>
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Katalog</span>
                            </a>
                        )}

                        {/* Partner access */}
                        {priceUnlocked ? (
                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Harga Aktif
                                </div>
                                <button
                                    onClick={() => router.post('/search/signout', {}, { preserveScroll: true })}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] transition ${isDark ? 'text-navy-600 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                                >
                                    <LogOut size={10} />
                                    <span>Keluar</span>
                                </button>
                            </div>
                        ) : partnerPin ? (
                            <button
                                onClick={onOpenPin}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${isDark ? 'border-gold-500/25 bg-gold-500/8 text-gold-400 hover:bg-gold-500/15 hover:border-gold-500/40' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 shadow-sm'}`}
                            >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Login Partner</span>
                                <span className="sm:hidden">Partner</span>
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* Search bar + filters */}
                {children}
            </div>
        </div>
    );
}

// ── Search bar + filters (stateful) ──────────────────────────────────────────

function SearchBar({ query, filter, total, isDark, onNavigate, loading, inputRef }) {
    const [inputValue, setInputValue] = useState(query);
    const debounceRef = useRef(null);

    useEffect(() => { setInputValue(query); }, [query]);

    const handleInput = (val) => {
        setInputValue(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onNavigate(val, filter, 1), 350);
    };

    return (
        <>
            {/* Input */}
            <div className="relative mt-6">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    {loading
                        ? <Loader2 size={17} className="text-gold-400 animate-spin" />
                        : <Search size={17} className={isDark ? 'text-navy-500' : 'text-gray-400'} />}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => handleInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter')  { clearTimeout(debounceRef.current); onNavigate(inputValue, filter, 1); }
                        if (e.key === 'Escape') { setInputValue(''); onNavigate('', filter, 1); }
                    }}
                    placeholder="Cari produk, merek, kategori, inventori…"
                    className={`w-full rounded-2xl pl-11 pr-10 py-3.5 text-sm font-medium border focus:outline-none focus:ring-2 transition-all ${
                        isDark
                            ? 'bg-navy-800/70 border-white/10 text-white placeholder-navy-600 focus:border-gold-500/40 focus:ring-gold-500/15'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:ring-amber-400/20 shadow-sm'
                    }`}
                />
                {inputValue && (
                    <button onClick={() => { setInputValue(''); onNavigate('', filter, 1); }}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 text-xl leading-none transition-colors ${isDark ? 'text-navy-600 hover:text-white' : 'text-gray-300 hover:text-gray-700'}`}>
                        ×
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1.5 mt-4">
                <SlidersHorizontal size={12} className={`mr-0.5 ${isDark ? 'text-navy-600' : 'text-gray-400'}`} />
                {FILTERS.map((f) => (
                    <button key={f.key} onClick={() => onNavigate(inputValue, f.key, 1)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            filter === f.key
                                ? isDark
                                    ? 'bg-gold-500/10 border border-gold-500/20 text-gold-400'
                                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                                : isDark
                                    ? 'text-navy-500 hover:text-white hover:bg-white/5 border border-transparent'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                        }`}>
                        {f.label}
                    </button>
                ))}
                {query && total > 0 && (
                    <span className={`ml-auto text-xs ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>{total} hasil</span>
                )}
            </div>
        </>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function Index({ company, query, filter, results, total, perPage, currentPage, lastPage, priceUnlocked, partnerPin, pinError }) {
    const { auth } = usePage().props;
    const isGuest  = !auth?.user;

    const [theme, setTheme] = useState(() =>
        (typeof window !== 'undefined' && localStorage.getItem('catalog-theme')) || 'dark'
    );
    const isDark = theme === 'dark';
    const toggleTheme = () => {
        const next = isDark ? 'light' : 'dark';
        setTheme(next);
        if (typeof window !== 'undefined') localStorage.setItem('catalog-theme', next);
    };

    const [showPin, setShowPin] = useState(!!pinError);

    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const navigate = (q, f, p = 1) => {
        setLoading(true);
        router.get('/search', { q, filter: f, page: p }, {
            preserveState: true,
            replace: true,
            onFinish: () => setLoading(false),
        });
    };

    const searchBar = (
        <SearchBar
            query={query}
            filter={filter}
            total={total}
            isDark={isDark}
            onNavigate={navigate}
            loading={loading}
            inputRef={inputRef}
        />
    );

    const resultsList = (
        <div className={`max-w-3xl mx-auto px-4 sm:px-6 pb-12 ${isDark ? 'mk-dark' : 'mk-light'}`}>
            {results.length > 0 ? (
                <>
                    <div className="space-y-2.5 mt-5">
                        {results.map((r) => <ResultCard key={`${r.type}-${r.id}`} result={r} isDark={isDark} />)}
                    </div>
                    <Pagination currentPage={currentPage} lastPage={lastPage}
                        onPage={(p) => { navigate(query, filter, p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        isDark={isDark} />
                </>
            ) : (
                <EmptyState query={query} isDark={isDark} />
            )}
        </div>
    );

    const hero = (
        <SearchHero
            company={company}
            isDark={isDark}
            toggleTheme={toggleTheme}
            isGuest={isGuest}
            priceUnlocked={priceUnlocked}
            partnerPin={partnerPin}
            onOpenPin={() => setShowPin(true)}
        >
            {searchBar}
        </SearchHero>
    );

    return (
        <>
            <style>{PAGE_CSS}</style>

            {isGuest ? (
                /* ── Public full-page layout ── */
                <>
                    <Head title="Cari Produk" />
                    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'bg-navy-950' : 'bg-slate-100'}`}>
                        {hero}
                        <main className="flex-1">{resultsList}</main>
                    </div>
                </>
            ) : (
                /* ── Admin: same hero inside sidebar layout ── */
                <AuthenticatedLayout title="Search">
                    {hero}
                    {resultsList}
                </AuthenticatedLayout>
            )}

            {/* ── Partner PIN modal ── */}
            {showPin && (
                <PinModal
                    isDark={isDark}
                    error={pinError}
                    onClose={() => setShowPin(false)}
                />
            )}

            {/* ── Floating WhatsApp (always) ── */}
            <a href="https://wa.me/6281910002704" target="_blank" rel="noopener noreferrer"
                aria-label="Chat WhatsApp"
                className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-xl shadow-emerald-500/40 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-emerald-500/50"
                style={{ animation: 'cardIn .5s ease .5s both' }}>
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d={WA_PATH} />
                </svg>
            </a>
        </>
    );
}
