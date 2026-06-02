import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Package, Search, X, LogOut, Tag, ShoppingBag, Layers,
    ChevronRight, Phone, MessageCircle, ArrowLeft, Sparkles,
    KeyRound, Lock, Sun, Moon,
} from 'lucide-react';
import { formatCurrency } from '@/Lib/utils';

/* ─── Partner PIN modal ──────────────────────────────────────────────────── */
function PartnerModal({ onClose, error, isDark }) {
    const [digits, setDigits] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [shake, setShake]   = useState(false);
    const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];

    const pin = digits.join('');
    const complete = pin.length === 4;

    useEffect(() => { refs[0].current?.focus(); }, []);

    useEffect(() => {
        if (error) { setShake(true); setDigits(['', '', '', '']); setTimeout(() => { setShake(false); refs[0].current?.focus(); }, 500); }
    }, [error]);

    const submit = (value) => {
        setLoading(true);
        router.post('/catalog/public/verify', { pin: value }, {
            onFinish: () => setLoading(false),
            onSuccess: onClose,
            preserveScroll: true,
        });
    };

    const handleChange = (i, val) => {
        const digit = val.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[i] = digit;
        setDigits(next);
        if (digit && i < 3) refs[i + 1].current?.focus();
        if (digit && i === 3) {
            const full = next.join('');
            if (full.length === 4) submit(full);
        }
    };

    const handleKeyDown = (i, e) => {
        if (e.key === 'Backspace') {
            if (digits[i]) {
                const next = [...digits]; next[i] = ''; setDigits(next);
            } else if (i > 0) {
                refs[i - 1].current?.focus();
            }
        } else if (e.key === 'ArrowLeft' && i > 0) {
            refs[i - 1].current?.focus();
        } else if (e.key === 'ArrowRight' && i < 3) {
            refs[i + 1].current?.focus();
        } else if (e.key === 'Enter' && complete) {
            submit(pin);
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
        if (!pasted) return;
        const next = ['', '', '', ''];
        pasted.split('').forEach((d, i) => { next[i] = d; });
        setDigits(next);
        const focusIdx = Math.min(pasted.length, 3);
        refs[focusIdx].current?.focus();
        if (pasted.length === 4) submit(pasted);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.2s ease' }} onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <div
                className={`relative z-10 w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-navy-900 border border-white/10' : 'bg-white border border-gray-200 shadow-xl'}`}
                style={{ animation: 'slideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-1 w-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-gold-500/10 border border-gold-500/25' : 'bg-amber-50 border border-amber-200'}`}>
                                <KeyRound className={`w-5 h-5 ${isDark ? 'text-gold-400' : 'text-amber-600'}`} />
                            </div>
                            <div>
                                <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Akses Partner</h2>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Masukkan 4-digit kode akses</p>
                            </div>
                        </div>
                        <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 ${isDark ? 'text-navy-500 hover:text-white hover:bg-white/8' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                            <X className="w-3.5 h-3.5 shrink-0" />{error}
                        </div>
                    )}

                    {/* OTP boxes */}
                    <div className={`flex justify-center gap-3 mb-6 ${shake ? 'animate-[shake_0.45s_ease]' : ''}`}>
                        {digits.map((d, i) => (
                            <input
                                key={i}
                                ref={refs[i]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={d}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                onPaste={handlePaste}
                                onFocus={(e) => e.target.select()}
                                className={`w-14 h-16 rounded-2xl text-center text-2xl font-black border-2 focus:outline-none transition-all duration-150 select-none ${
                                    d
                                        ? isDark
                                            ? 'bg-gold-500/10 border-gold-500 text-gold-400 shadow-lg shadow-gold-500/15'
                                            : 'bg-amber-50 border-amber-400 text-amber-700 shadow-lg shadow-amber-500/15'
                                        : isDark
                                            ? 'bg-navy-800/60 border-white/10 text-white focus:border-gold-500/60 focus:bg-navy-800'
                                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-amber-400 focus:bg-white'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Submit */}
                    <button
                        onClick={() => complete && !loading && submit(pin)}
                        disabled={!complete || loading}
                        className="w-full px-4 py-3 rounded-xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                Memverifikasi…
                            </span>
                        ) : 'Masuk sebagai Partner'}
                    </button>

                    <p className={`mt-4 text-center text-[10px] ${isDark ? 'text-navy-700' : 'text-gray-300'}`}>Kode diberikan oleh sales representative Anda.</p>
                </div>
            </div>
        </div>
    );
}

/* ─── Product detail modal ───────────────────────────────────────────────── */
function ProductModal({ product, onClose, priceUnlocked, isDark }) {
    if (!product) return null;
    const isReady = product.stock_status === 'ready';

    const [descExpanded, setDescExpanded] = useState(false);
    const [isClamped, setIsClamped]       = useState(false);
    const descRef = useRef(null);

    // Re-measure whenever the product changes (reset + check if text overflows 4 lines)
    useEffect(() => {
        setDescExpanded(false);
        setIsClamped(false);
        const id = setTimeout(() => {
            if (descRef.current) {
                setIsClamped(descRef.current.scrollHeight > descRef.current.clientHeight + 1);
            }
        }, 50); // after paint
        return () => clearTimeout(id);
    }, [product?.id]);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ animation: 'fadeIn 0.2s ease' }} onClick={onClose}>
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
            <div
                className={`relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[88vh] ${isDark ? 'bg-navy-900 border border-white/8' : 'bg-white border border-gray-200'}`}
                style={{ animation: 'slideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`relative aspect-[16/9] overflow-hidden shrink-0 ${isDark ? 'bg-navy-800' : 'bg-gray-100'}`}>
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.product_name} className="w-full h-full object-cover" />
                    ) : (
                        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${isDark ? 'from-navy-800 to-navy-900' : 'from-gray-100 to-gray-200'}`}>
                            <Package className={`w-14 h-14 ${isDark ? 'text-navy-600' : 'text-gray-300'}`} />
                        </div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? 'from-navy-900 via-navy-900/30 to-transparent' : 'from-black/50 via-black/10 to-transparent'}`} />
                    <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition flex items-center justify-center">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-3 left-4 flex gap-2 items-center flex-wrap">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold-500 text-navy-950 shadow-lg shadow-gold-500/30">
                            {product.brand_logo && <img src={product.brand_logo} alt={product.brand} className="w-3.5 h-3.5 object-contain" />}
                            {product.brand}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/10 backdrop-blur-sm text-white border border-white/15">{product.category}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${isReady ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                            {isReady ? '● Ready Stock' : '○ Inden'}
                        </span>
                    </div>
                </div>
                <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                    <h2 className={`text-xl font-bold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.product_name}</h2>
                    {product.description && (
                        <div className="mt-2.5">
                            <p
                                ref={descRef}
                                className={`text-sm leading-relaxed whitespace-pre-line transition-all duration-300 ${!descExpanded ? 'line-clamp-4' : ''} ${isDark ? 'text-navy-300' : 'text-gray-600'}`}
                            >
                                {product.description}
                            </p>
                            {(isClamped || descExpanded) && (
                                <button
                                    onClick={() => setDescExpanded(v => !v)}
                                    className={`mt-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${isDark ? 'text-gold-400 hover:text-gold-300' : 'text-amber-600 hover:text-amber-500'}`}
                                >
                                    {descExpanded ? (
                                        <><span>Sembunyikan</span><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6"/></svg></>
                                    ) : (
                                        <><span>Lihat selengkapnya</span><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg></>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className={`rounded-2xl p-4 border ${isDark ? 'bg-navy-800/60 border-white/6' : 'bg-slate-50 border-gray-200'}`}>
                            <p className={`text-[10px] uppercase tracking-widest mb-1.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Harga Terbaik</p>
                            {priceUnlocked && product.best_price !== null ? (
                                <p className={`text-xl font-black leading-none ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(product.best_price)}</p>
                            ) : (
                                <div className={`flex items-center gap-1.5 ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>
                                    <Lock className="w-4 h-4" />
                                    <p className="text-xs font-medium">Partner Only</p>
                                </div>
                            )}
                        </div>
                        <div className={`rounded-2xl p-4 border ${isDark ? 'bg-navy-800/60 border-white/6' : 'bg-slate-50 border-gray-200'}`}>
                            <p className={`text-[10px] uppercase tracking-widest mb-1 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Min. Pesanan</p>
                            <p className={`text-xl font-black leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {product.moq} <span className={`text-sm font-normal ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>pcs</span>
                            </p>
                        </div>
                    </div>
                    <p className={`mt-4 text-center text-xs ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>Hubungi sales representative Anda untuk melakukan pemesanan.</p>
                </div>
            </div>
        </div>
    );
}

/* ─── Brand card ─────────────────────────────────────────────────────────── */
function BrandCard({ brand, index, onClick, isDark }) {
    const initials = brand.name.substring(0, 2).toUpperCase();
    return (
        <button
            onClick={() => onClick(brand.name)}
            className={`group relative flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${isDark ? 'bg-navy-900/60 border border-white/6 hover:border-gold-500/60 hover:shadow-2xl hover:shadow-gold-500/10' : 'bg-white border border-gray-200 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/10'}`}
            style={{ animation: 'cardIn 0.4s ease both', animationDelay: `${Math.min(index * 70, 560)}ms` }}
        >
            <div className={`relative w-full aspect-square overflow-hidden flex items-center justify-center p-5 bg-gradient-to-br ${isDark ? 'from-navy-800/80 to-navy-900' : 'from-gray-50 to-white'}`}>
                <div className={`w-full h-full rounded-xl sm:rounded-2xl flex items-center justify-center p-4 transition-colors duration-300 ${isDark ? 'bg-white/4 border border-white/6 group-hover:bg-white/7' : 'bg-white border border-gray-100 group-hover:bg-gray-50 shadow-sm'}`}>
                    {brand.logo ? (
                        <img src={brand.logo} alt={brand.name} loading="lazy" className="w-full h-full object-contain transition-transform duration-400 group-hover:scale-110 drop-shadow-lg" />
                    ) : (
                        <span className={`text-3xl sm:text-4xl font-black bg-clip-text text-transparent select-none ${isDark ? 'bg-gradient-to-br from-navy-500 to-navy-700' : 'bg-gradient-to-br from-gray-300 to-gray-500'}`}>{initials}</span>
                    )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-gold-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
            <div className={`px-3 py-3 sm:px-4 sm:py-3.5 border-t transition-colors duration-300 ${isDark ? 'bg-gradient-to-b from-navy-900/0 to-navy-900/80 border-white/5 group-hover:border-gold-500/20' : 'bg-white border-gray-100 group-hover:border-amber-200'}`}>
                <p className={`text-sm font-bold text-center truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{brand.name}</p>
                <p className={`text-[10px] text-center mt-0.5 transition-colors ${isDark ? 'text-navy-500 group-hover:text-navy-400' : 'text-gray-400'}`}>{brand.count} produk</p>
            </div>
            <div className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100 ${isDark ? 'bg-navy-950/80' : 'bg-white shadow-sm'}`}>
                <ChevronRight className={`w-3 h-3 ${isDark ? 'text-gold-400' : 'text-amber-500'}`} />
            </div>
        </button>
    );
}

/* ─── Product card ───────────────────────────────────────────────────────── */
function ProductCard({ product, index, onClick, priceUnlocked, isDark }) {
    const isReady = product.stock_status === 'ready';
    return (
        <button
            onClick={() => onClick(product)}
            className={`group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 flex flex-col ${isDark ? 'bg-navy-900/60 border border-white/6 hover:border-gold-500/50 hover:shadow-xl hover:shadow-gold-500/8' : 'bg-white border border-gray-200 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/10'}`}
            style={{ animation: 'cardIn 0.35s ease both', animationDelay: `${Math.min(index * 45, 450)}ms` }}
        >
            <div className={`relative aspect-[4/3] overflow-hidden shrink-0 bg-gradient-to-br ${isDark ? 'from-navy-800 to-navy-900' : 'from-gray-100 to-gray-200'}`}>
                {product.image_url ? (
                    <img src={product.image_url} alt={product.product_name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Package className={`w-10 h-10 ${isDark ? 'text-navy-700' : 'text-gray-300'}`} />
                    </div>
                )}
                <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? 'from-navy-950/70 via-transparent to-transparent' : 'from-black/20 via-transparent to-transparent'}`} />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-250">
                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold-500 text-navy-950 text-[11px] font-bold uppercase tracking-wide shadow-xl shadow-gold-500/40 translate-y-1 group-hover:translate-y-0 transition-transform duration-250">
                        Lihat Detail <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                </div>
                <span className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full backdrop-blur-sm ${isReady ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25' : 'bg-amber-500/20 text-amber-300 border border-amber-500/25'}`}>
                    {isReady ? 'Ready' : 'Inden'}
                </span>
            </div>
            <div className="p-3 sm:p-4 flex-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>
                        {product.brand_logo && <img src={product.brand_logo} alt={product.brand} className="w-3 h-3 object-contain" />}
                        {product.brand}
                    </span>
                    <span className={isDark ? 'text-navy-700' : 'text-gray-300'}>·</span>
                    <span className={`text-[9px] uppercase tracking-widest font-semibold ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{product.category}</span>
                </div>
                <h3 className={`text-sm font-semibold leading-snug flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {product.product_name}
                </h3>
                <div className={`flex items-end justify-between gap-1 pt-1.5 border-t mt-auto ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                    {priceUnlocked && product.best_price !== null ? (
                        <p className={`text-base font-black leading-none ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(product.best_price)}</p>
                    ) : (
                        <div className={`flex items-center gap-1 ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>
                            <Lock className="w-3 h-3" />
                            <span className="text-[10px] font-medium">Harga Partner</span>
                        </div>
                    )}
                    <p className={`text-[10px] ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>min {product.moq} pcs</p>
                </div>
            </div>
        </button>
    );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function Public({ products, categories, brands, priceUnlocked, partnerPin, pinError, company }) {
    const companyName    = company?.name     || 'Component Sales';
    const companyTagline = company?.tagline  || 'Sistem Integrator';
    const companyLogoUrl = company?.logo_url || null;
    const [view, setView]                       = useState('brands');
    const [activeBrand, setActiveBrand]         = useState(null);
    const [searchTerm, setSearchTerm]           = useState('');
    const [activeCategory, setActiveCategory]   = useState('all');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showPinModal, setShowPinModal]       = useState(!!pinError);
    const [heroSearch, setHeroSearch]           = useState('');
    const [theme, setTheme] = useState(() =>
        (typeof window !== 'undefined' && localStorage.getItem('catalog-theme')) || 'dark'
    );

    const handleHeroSearch = (e) => {
        e.preventDefault();
        const q = heroSearch.trim();
        if (q) window.location.href = '/search?q=' + encodeURIComponent(q);
    };

    useEffect(() => { if (priceUnlocked) setShowPinModal(false); }, [priceUnlocked]);

    const isDark = theme === 'dark';
    const toggleTheme = () => {
        const next = isDark ? 'light' : 'dark';
        setTheme(next);
        if (typeof window !== 'undefined') localStorage.setItem('catalog-theme', next);
    };

    const handleBrandClick = (brandName) => { setActiveBrand(brandName); setActiveCategory('all'); setSearchTerm(''); setView('products'); };
    const handleBrowseAll  = () => { setActiveBrand(null); setActiveCategory('all'); setSearchTerm(''); setView('products'); };
    const handleBack       = () => { setView('brands'); setActiveBrand(null); setSearchTerm(''); setActiveCategory('all'); };

    const activeBrandObj = useMemo(() => (brands || []).find((b) => b.name === activeBrand), [brands, activeBrand]);
    const brandBaseProducts = useMemo(
        () => activeBrand ? (products || []).filter((p) => p.brand === activeBrand) : (products || []),
        [products, activeBrand],
    );
    const visibleCategories = useMemo(
        () => [...new Set(brandBaseProducts.map((p) => p.category))].filter(Boolean).sort(),
        [brandBaseProducts],
    );
    const categoryCounts = useMemo(() => {
        const map = {};
        brandBaseProducts.forEach((p) => { map[p.category] = (map[p.category] || 0) + 1; });
        return map;
    }, [brandBaseProducts]);
    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return brandBaseProducts.filter((p) => {
            if (activeCategory !== 'all' && p.category !== activeCategory) return false;
            if (!term) return true;
            return p.product_name?.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term) || p.category?.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term);
        });
    }, [brandBaseProducts, activeCategory, searchTerm]);

    const totalProducts   = products?.length || 0;
    const totalCategories = categories?.length || 0;
    const totalBrands     = brands?.length || 0;

    return (
        <>
            <Head title="Katalog Produk" />
            <style>{`
                @keyframes cardIn   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
                @keyframes heroIn   { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
                @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
                @keyframes slideUp  { from{opacity:0;transform:translateY(48px)} to{opacity:1;transform:translateY(0)} }
                @keyframes viewIn   { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
                @keyframes viewBack { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
                @keyframes pulse-gold { 0%,100%{opacity:.4} 50%{opacity:.8} }
                @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
                .hg-dark {
                    background-image: linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);
                    background-size: 48px 48px;
                }
                .hg-light {
                    background-image: linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px), linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px);
                    background-size: 48px 48px;
                }
                .line-clamp-4 { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden }
                ::-webkit-scrollbar{height:4px;width:4px}
                ::-webkit-scrollbar-track{background:transparent}
                ::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
            `}</style>

            <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'bg-navy-950' : 'bg-slate-100'}`}>

                {/* ── Hero ─────────────────────────────────────────────── */}
                <header className={`relative overflow-hidden ${isDark ? 'bg-gradient-to-b from-navy-900 via-navy-900/80 to-navy-950' : 'bg-gradient-to-b from-white via-slate-50 to-slate-100'}`} style={{ animation: 'heroIn 0.45s ease both' }}>
                    <div className={`${isDark ? 'hg-dark' : 'hg-light'} absolute inset-0 pointer-events-none`} />
                    <div className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none ${isDark ? 'bg-gold-500/8' : 'bg-amber-400/12'}`} />
                    <div className={`absolute -top-20 right-0 w-[30rem] h-[30rem] rounded-full blur-3xl pointer-events-none ${isDark ? 'bg-blue-500/5' : 'bg-blue-400/5'}`} />
                    <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent to-transparent ${isDark ? 'via-gold-500/20' : 'via-amber-400/30'}`} />

                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center overflow-hidden shadow-xl shadow-gold-500/30 shrink-0">
                                        {companyLogoUrl
                                            ? <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain" />
                                            : <span className="font-black text-navy-950 text-base">{companyName[0]?.toUpperCase() || 'C'}</span>
                                        }
                                    </div>
                                    <div>
                                        <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-gold-500/80' : 'text-amber-600'}`}>{companyName}</p>
                                        <p className={`text-[10px] tracking-wide ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>{companyTagline}</p>
                                    </div>
                                </div>
                                <h1 className="text-4xl sm:text-5xl font-black leading-none tracking-tight">
                                    <span className={isDark ? 'text-white' : 'text-gray-900'}>Katalog</span>
                                    <br />
                                    <span className="bg-gradient-to-r from-gold-400 to-gold-300 bg-clip-text text-transparent">Produk</span>
                                </h1>
                                <p className={`mt-3 text-sm max-w-sm leading-relaxed ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>
                                    Jelajahi semua produk kami. Hubungi sales representative untuk pemesanan dan penawaran harga spesial.
                                </p>
                            </div>

                            {/* Right controls */}
                            <div className="shrink-0 flex flex-col items-end gap-2 mt-1">
                                {/* Theme toggle */}
                                <button
                                    onClick={toggleTheme}
                                    title={isDark ? 'Mode Terang' : 'Mode Gelap'}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${isDark ? 'border-white/10 bg-white/3 text-navy-400 hover:text-white hover:border-white/25 hover:bg-white/6' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm'}`}
                                >
                                    {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                                    <span className="hidden sm:inline">{isDark ? 'Terang' : 'Gelap'}</span>
                                </button>

                                {/* Partner access */}
                                {priceUnlocked ? (
                                    <>
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-500">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            Harga Aktif
                                        </div>
                                        <button
                                            onClick={() => router.post('/catalog/public/signout')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] transition ${isDark ? 'border-white/10 bg-white/3 text-navy-500 hover:text-white hover:border-white/25' : 'border-gray-200 bg-white text-gray-400 hover:text-gray-700 shadow-sm'}`}
                                        >
                                            <LogOut className="w-3 h-3" />
                                            Keluar Partner
                                        </button>
                                    </>
                                ) : partnerPin ? (
                                    <button
                                        onClick={() => setShowPinModal(true)}
                                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${isDark ? 'border-gold-500/25 bg-gold-500/8 text-gold-400 hover:bg-gold-500/15 hover:border-gold-500/40' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 shadow-sm'}`}
                                    >
                                        <KeyRound className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Login Partner</span>
                                        <span className="sm:hidden">Partner</span>
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* ── Welcome greeting + Hybrid search bar ── */}
                        <div className="mt-8 mb-2">
                            <div className={`relative rounded-3xl overflow-hidden px-6 py-7 border ${isDark ? 'bg-gradient-to-br from-gold-500/8 via-navy-900/40 to-blue-900/20 border-gold-500/15' : 'bg-gradient-to-br from-amber-50 via-white to-blue-50 border-amber-200/60 shadow-sm'}`}>
                                {/* subtle glow */}
                                <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl pointer-events-none ${isDark ? 'bg-gold-500/10' : 'bg-amber-400/15'}`} />

                                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-gold-500/60' : 'text-amber-500/80'}`}>Pencarian Produk</p>

                                <h2 className={`text-xl sm:text-2xl font-black leading-tight mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Hallo, selamat datang di{' '}
                                    <span className="bg-gradient-to-r from-gold-400 to-amber-300 bg-clip-text text-transparent">
                                        {companyName}
                                    </span>
                                </h2>
                                <p className={`text-sm font-medium mb-5 ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>
                                    cari produk apa?&nbsp;✨
                                </p>

                                {/* Search bar */}
                                <form onSubmit={handleHeroSearch} className="relative max-w-xl">
                                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 pointer-events-none ${isDark ? 'text-navy-500' : 'text-gray-400'}`} />
                                    <input
                                        type="text"
                                        value={heroSearch}
                                        onChange={(e) => setHeroSearch(e.target.value)}
                                        placeholder="Cari nama produk, merek, kategori…"
                                        className={`w-full pl-11 pr-32 py-3.5 rounded-2xl text-sm font-medium border focus:outline-none transition-all
                                            ${isDark
                                                ? 'bg-navy-800/70 border-white/10 text-white placeholder-navy-600 focus:border-gold-500/40 focus:ring-2 focus:ring-gold-500/15'
                                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 shadow-sm'
                                            }`}
                                    />
                                    <button
                                        type="submit"
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                            heroSearch.trim()
                                                ? 'bg-gold-500 text-navy-950 hover:bg-gold-400 shadow-lg shadow-gold-500/25'
                                                : isDark
                                                    ? 'bg-white/6 text-navy-500 cursor-default'
                                                    : 'bg-gray-100 text-gray-400 cursor-default'
                                        }`}
                                    >
                                        Cari
                                    </button>
                                </form>

                                <p className={`mt-3 text-[11px] ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>
                                    Pencarian penuh ·{' '}
                                    <a href="/search" className={`hover:underline ${isDark ? 'text-gold-500/50 hover:text-gold-400' : 'text-amber-500 hover:text-amber-600'}`}>
                                        Buka halaman pencarian →
                                    </a>
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 mt-6 flex-wrap">
                            {[
                                { icon: ShoppingBag, label: 'Produk',   value: totalProducts,   color: 'text-gold-400' },
                                { icon: Tag,         label: 'Merek',    value: totalBrands,     color: 'text-blue-400' },
                                { icon: Layers,      label: 'Kategori', value: totalCategories, color: 'text-purple-400' },
                            ].map(({ icon: Icon, label, value, color }, i) => (
                                <div key={label}
                                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl backdrop-blur-sm ${isDark ? 'bg-white/3 border border-white/7' : 'bg-white border border-gray-200 shadow-sm'}`}
                                    style={{ animation: 'cardIn 0.4s ease both', animationDelay: `${i * 80 + 200}ms` }}
                                >
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                                    </div>
                                    <div>
                                        <p className={`text-base font-black leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                                        <p className={`text-[10px] uppercase tracking-widest ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </header>

                {/* ── BRAND VIEW ───────────────────────────────────────── */}
                {view === 'brands' && (
                    <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10" style={{ animation: 'viewBack 0.3s ease both' }}>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-gold-400 to-gold-600" />
                                <div>
                                    <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Pilih Merek</h2>
                                    <p className={`text-xs ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Pilih merek untuk melihat produknya</p>
                                </div>
                            </div>
                            <button
                                onClick={handleBrowseAll}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${isDark ? 'bg-gold-500/10 border border-gold-500/20 text-gold-400 hover:bg-gold-500/20 hover:border-gold-500/35' : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'}`}
                            >
                                <Sparkles className="w-3.5 h-3.5" /> Semua Produk
                            </button>
                        </div>

                        {(brands?.length || 0) > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
                                {brands.map((brand, i) => <BrandCard key={brand.name} brand={brand} index={i} onClick={handleBrandClick} isDark={isDark} />)}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-28 text-center">
                                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-xl ${isDark ? 'bg-navy-900/60 border border-white/5' : 'bg-white border border-gray-200'}`}>
                                    <Tag className={`w-10 h-10 ${isDark ? 'text-navy-700' : 'text-gray-300'}`} />
                                </div>
                                <p className={`font-bold text-xl ${isDark ? 'text-navy-200' : 'text-gray-700'}`}>Belum ada merek</p>
                                <p className={`text-sm mt-2 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Katalog masih kosong.</p>
                            </div>
                        )}
                    </main>
                )}

                {/* ── PRODUCT VIEW ─────────────────────────────────────── */}
                {view === 'products' && (
                    <>
                        <div className={`sticky top-0 z-30 backdrop-blur-2xl border-b shadow-xl ${isDark ? 'bg-navy-950/92 border-white/6 shadow-black/30' : 'bg-white/95 border-gray-200 shadow-gray-200/50'}`}>
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                                <div className="flex items-center gap-3 mb-3">
                                    <button
                                        onClick={handleBack}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${isDark ? 'bg-white/5 border border-white/10 text-navy-300 hover:text-white hover:border-white/25 hover:bg-white/8' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Merek
                                    </button>
                                    {activeBrand ? (
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {activeBrandObj?.logo && <img src={activeBrandObj.logo} alt={activeBrand} className="h-5 w-auto max-w-[52px] object-contain shrink-0 opacity-90" />}
                                            <span className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{activeBrand}</span>
                                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-white/6 border border-white/10 text-navy-400' : 'bg-gray-100 border border-gray-200 text-gray-500'}`}>{brandBaseProducts.length} produk</span>
                                        </div>
                                    ) : (
                                        <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Semua Produk</span>
                                    )}
                                </div>

                                <div className="relative mb-3">
                                    <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-navy-500' : 'text-gray-400'}`} />
                                    <input
                                        type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={activeBrand ? `Cari di ${activeBrand}…` : 'Cari produk…'}
                                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-gold-500/30 transition ${isDark ? 'bg-navy-800/60 border-white/8 text-white placeholder-navy-600 focus:border-gold-500/35' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400'}`}
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className={`absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg transition flex items-center justify-center ${isDark ? 'text-navy-500 hover:text-white hover:bg-white/8' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {visibleCategories.length > 0 && (
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                                        {[{ label: 'Semua', key: 'all', count: brandBaseProducts.length }, ...visibleCategories.map((c) => ({ label: c, key: c, count: categoryCounts[c] || 0 }))].map(({ label, key, count }) => (
                                            <button
                                                key={key}
                                                onClick={() => setActiveCategory(key)}
                                                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                                                    activeCategory === key
                                                        ? 'bg-gold-500 text-navy-950 border-gold-500 shadow-md shadow-gold-500/25'
                                                        : isDark
                                                            ? 'bg-transparent text-navy-400 border-white/10 hover:text-white hover:border-white/25'
                                                            : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                                                }`}
                                            >
                                                {label}
                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeCategory === key ? 'bg-navy-950/20' : isDark ? 'bg-white/8' : 'bg-gray-100'}`}>{count}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-7" style={{ animation: 'viewIn 0.3s ease both' }}>
                            <div className="flex items-center justify-between mb-5">
                                <p className={`text-xs ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                    <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{filtered.length}</span>
                                    {activeBrand ? ` produk di ${activeBrand}` : ' produk'}
                                </p>
                                {(searchTerm || activeCategory !== 'all') && (
                                    <button onClick={() => { setSearchTerm(''); setActiveCategory('all'); }} className={`text-xs transition font-medium flex items-center gap-1 ${isDark ? 'text-gold-400 hover:text-gold-300' : 'text-amber-600 hover:text-amber-700'}`}>
                                        <X className="w-3 h-3" /> Hapus filter
                                    </button>
                                )}
                            </div>

                            {filtered.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                                    {filtered.map((p, i) => (
                                        <ProductCard key={`${p.brand}-${p.product_name}-${i}`} product={p} index={i} onClick={setSelectedProduct} priceUnlocked={priceUnlocked} isDark={isDark} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-28 text-center">
                                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-xl ${isDark ? 'bg-navy-900/60 border border-white/5' : 'bg-white border border-gray-200'}`}>
                                        <Package className={`w-10 h-10 ${isDark ? 'text-navy-700' : 'text-gray-300'}`} />
                                    </div>
                                    <p className={`font-bold text-xl ${isDark ? 'text-navy-200' : 'text-gray-700'}`}>Produk tidak ditemukan</p>
                                    <p className={`text-sm mt-2 max-w-xs ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                        {searchTerm || activeCategory !== 'all' ? 'Coba kata kunci lain atau pilih kategori yang berbeda.' : 'Belum ada produk untuk merek ini.'}
                                    </p>
                                    {(searchTerm || activeCategory !== 'all') && (
                                        <button onClick={() => { setSearchTerm(''); setActiveCategory('all'); }} className={`mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${isDark ? 'bg-gold-500/10 border border-gold-500/25 text-gold-400 hover:bg-gold-500/20' : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
                                            Tampilkan semua produk
                                        </button>
                                    )}
                                </div>
                            )}
                        </main>

                        {filtered.length > 0 && (
                            <section className={`relative overflow-hidden border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
                                <div className={`absolute inset-0 pointer-events-none ${isDark ? 'bg-gradient-to-br from-gold-500/5 via-navy-900/60 to-navy-950' : 'bg-gradient-to-br from-amber-50/80 via-white to-slate-50'}`} />
                                <div className={`absolute inset-0 opacity-50 pointer-events-none ${isDark ? 'hg-dark' : 'hg-light'}`} />
                                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className={`w-4 h-4 ${isDark ? 'text-gold-400' : 'text-amber-500'}`} />
                                            <span className={`text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-gold-500/70' : 'text-amber-600'}`}>Tertarik?</span>
                                        </div>
                                        <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Tertarik dengan produk kami?</h3>
                                        <p className={`text-sm mt-1.5 max-w-sm ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>Hubungi sales representative kami untuk harga dan ketersediaan produk.</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <a href="https://wa.me/6281910002704" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-sm font-semibold hover:bg-emerald-500/20 hover:border-emerald-500/40 transition">
                                            <MessageCircle className="w-4 h-4" /> WhatsApp
                                        </a>
                                        <a href="tel:+6281910002704" className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition ${isDark ? 'bg-white/5 border border-white/10 text-navy-200 hover:bg-white/10 hover:text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm'}`}>
                                            <Phone className="w-4 h-4" /> Hubungi Kami
                                        </a>
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}

                {/* ── Footer ───────────────────────────────────────────── */}
                <footer className={`border-t ${isDark ? 'border-white/5 bg-navy-950' : 'border-gray-200 bg-white'}`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center font-black text-navy-950 text-[10px] shadow-md shadow-gold-500/20">C</div>
                            <p className={`text-xs ${isDark ? 'text-navy-500' : 'text-gray-500'}`}>Katalog ini khusus <span className={`font-semibold ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{companyTagline || 'Sistem Integrator'}</span></p>
                        </div>
                        <p className={`text-[10px] ${isDark ? 'text-navy-700' : 'text-gray-400'}`}>Harga dan ketersediaan produk dapat berubah sewaktu-waktu tanpa pemberitahuan.</p>
                    </div>
                </footer>
            </div>

            {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} priceUnlocked={priceUnlocked} isDark={isDark} />}
            {showPinModal && <PartnerModal onClose={() => setShowPinModal(false)} error={pinError} isDark={isDark} />}

            <a
                href="https://wa.me/6281910002704" target="_blank" rel="noopener noreferrer"
                className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-xl shadow-emerald-500/40 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-emerald-500/50"
                style={{ animation: 'cardIn 0.5s ease 0.8s both' }} aria-label="Chat WhatsApp"
            >
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
            </a>
        </>
    );
}
