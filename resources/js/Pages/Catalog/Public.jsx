import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Package, Search, X, LogOut, Tag, ShoppingBag, Layers,
    ChevronRight, Phone, MessageCircle, ArrowLeft, Sparkles,
    KeyRound, Sun, Moon, UserPlus,
} from 'lucide-react';
import PartnerModal from '@/Components/catalog/PartnerModal';
import RegisterModal from '@/Components/catalog/RegisterModal';
import ProductModal from '@/Components/catalog/ProductModal';
import InventoryResults from '@/Components/catalog/InventoryResults';
import { BrandCard, ProductCard, HeroProductCard } from '@/Components/catalog/cards';

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function Public({ products, categories, brands, priceUnlocked, registeredUnlocked, partnerPin, pinError, company, featured }) {
    // Prices are visible for partner-PIN sessions AND registered channels;
    // registered channels additionally get special_price on each product.
    const anyUnlocked = priceUnlocked || registeredUnlocked;
    const companyName    = company?.name     || 'Component Sales';
    const companyTagline = company?.tagline  || 'Sistem Integrator';
    const companyLogoUrl = company?.logo_url || null;
    const [view, setView]                       = useState('brands');
    const [activeBrand, setActiveBrand]         = useState(null);
    const [searchTerm, setSearchTerm]           = useState('');
    const [activeCategory, setActiveCategory]   = useState('all');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showPinModal, setShowPinModal]       = useState(!!pinError);
    const [regModal, setRegModal]               = useState(null); // null | 'register' | 'login'
    const [theme, setTheme] = useState(() =>
        (typeof window !== 'undefined' && localStorage.getItem('catalog-theme')) || 'dark'
    );

    useEffect(() => { if (priceUnlocked) setShowPinModal(false); }, [priceUnlocked]);

    const isDark = theme === 'dark';
    const toggleTheme = () => {
        const next = isDark ? 'light' : 'dark';
        setTheme(next);
        if (typeof window !== 'undefined') localStorage.setItem('catalog-theme', next);
    };

    const searchInputRef = useRef(null);

    const handleBrandClick = (brandName) => { setActiveBrand(brandName); setActiveCategory('all'); setSearchTerm(''); setView('products'); };
    const handleBrowseAll  = () => { setActiveBrand(null); setActiveCategory('all'); setSearchTerm(''); setView('products'); };
    const handleBack       = () => { setView('brands'); setActiveBrand(null); setSearchTerm(''); setActiveCategory('all'); };
    // Hero "Cari" jumps straight into the catalog with the search box focused,
    // instead of navigating away from the page.
    const handleSearchClick = () => {
        handleBrowseAll();
        setTimeout(() => searchInputRef.current?.focus(), 350); // after view transition
    };

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

    // ── Inventory search (server-side, debounced) ─────────────────────────
    // The catalog grid filters client-side; the same search box also queries
    // the inventory DB so items not in the catalog are still findable.
    const [invResults, setInvResults] = useState(null); // null = idle
    const [invLoading, setInvLoading] = useState(false);
    // Search-source filter (only meaningful while a search term is active):
    // 'all' | 'catalog' | 'inventory'.
    const [searchSource, setSearchSource] = useState('all');
    const searching = searchTerm.trim().length >= 2;
    const source = searching ? searchSource : 'all';

    useEffect(() => {
        const term = searchTerm.trim();
        if (view !== 'products' || term.length < 2) { setInvResults(null); return undefined; }
        const t = setTimeout(async () => {
            setInvLoading(true);
            try {
                const res = await fetch(`/catalog/public/inventory-search?q=${encodeURIComponent(term)}`, {
                    headers: { Accept: 'application/json' },
                });
                const json = await res.json().catch(() => ({}));
                setInvResults(res.ok ? (json.items || []) : []);
            } catch {
                setInvResults([]);
            }
            setInvLoading(false);
        }, 400);
        return () => clearTimeout(t);
    }, [searchTerm, view]);

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
                                {/* Search — jumps into the catalog with search focused */}
                                <button
                                    onClick={handleSearchClick}
                                    title="Cari produk di katalog"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${isDark ? 'border-white/10 bg-white/3 text-navy-400 hover:text-white hover:border-white/25 hover:bg-white/6' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm'}`}
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Cari</span>
                                </button>

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

                                {/* Channel self-registration / registered status */}
                                {registeredUnlocked ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold-500/10 border border-gold-500/25 text-[10px] font-semibold text-gold-400">
                                        <Sparkles className="w-3 h-3" />
                                        Harga Spesial Aktif
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setRegModal('register')}
                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gold-500 text-navy-950 text-xs font-bold hover:bg-gold-400 transition shadow-lg shadow-gold-500/25"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Daftar Channel</span>
                                            <span className="sm:hidden">Daftar</span>
                                        </button>
                                        <button
                                            onClick={() => setRegModal('login')}
                                            className={`text-[10px] font-medium transition ${isDark ? 'text-navy-500 hover:text-gold-400' : 'text-gray-400 hover:text-amber-600'}`}
                                        >
                                            Sudah terdaftar? Aktifkan harga spesial
                                        </button>
                                    </>
                                )}
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

                        {/* How it works — 3 langkah agar alur katalog langsung jelas */}
                        <div className="grid sm:grid-cols-3 gap-3 mb-12">
                            {[
                                {
                                    icon: ShoppingBag,
                                    title: 'Jelajahi Produk',
                                    desc: 'Pilih merek di bawah, atau tekan "Semua Produk" untuk melihat seluruh katalog.',
                                },
                                {
                                    icon: KeyRound,
                                    title: priceUnlocked ? 'Harga Partner Aktif ✓' : 'Lihat Harga (Partner)',
                                    desc: priceUnlocked
                                        ? 'Anda sudah masuk sebagai partner — semua harga terbaik ditampilkan.'
                                        : 'Punya kode akses dari sales kami? Masuk untuk melihat harga khusus partner.',
                                    action: !priceUnlocked && partnerPin ? () => setShowPinModal(true) : null,
                                    done: priceUnlocked,
                                },
                                {
                                    icon: MessageCircle,
                                    title: 'Pesan via WhatsApp',
                                    desc: 'Buka produk yang diminati lalu hubungi sales kami langsung dari halaman ini.',
                                },
                            ].map(({ icon: Icon, title, desc, action, done }, i) => {
                                const Wrapper = action ? 'button' : 'div';
                                return (
                                    <Wrapper
                                        key={title}
                                        onClick={action ?? undefined}
                                        className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition ${
                                            done
                                                ? 'bg-emerald-500/8 border-emerald-500/25'
                                                : isDark ? 'bg-white/3 border-white/7' : 'bg-white border-gray-200 shadow-sm'
                                        } ${action ? (isDark ? 'hover:border-gold-500/40 hover:bg-gold-500/5 cursor-pointer' : 'hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer') : ''}`}
                                        style={{ animation: 'cardIn 0.4s ease both', animationDelay: `${i * 90}ms` }}
                                    >
                                        <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                            done ? 'bg-emerald-500/15 text-emerald-400'
                                                : isDark ? 'bg-gold-500/10 text-gold-400' : 'bg-amber-50 text-amber-600'
                                        }`}>
                                            <Icon className="w-4 h-4" />
                                            <span className={`absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                                                done ? 'bg-emerald-500 text-white' : 'bg-gold-500 text-navy-950'
                                            }`}>{i + 1}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-bold ${done ? 'text-emerald-400' : isDark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
                                            <p className={`text-[11px] mt-1 leading-relaxed ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>{desc}</p>
                                            {action && (
                                                <span className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>
                                                    Masukkan kode <ChevronRight className="w-3 h-3" />
                                                </span>
                                            )}
                                        </div>
                                    </Wrapper>
                                );
                            })}
                        </div>

                        {/* Featured / Hero Products */}
                        {featured?.length > 0 && (
                            <div className="mb-12">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-gold-400 to-gold-600" />
                                        <div>
                                            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Produk Unggulan</h2>
                                            <p className={`text-xs ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Pilihan terbaik untuk Anda</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>{featured.length} produk</span>
                                </div>
                                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:overflow-visible">
                                    {featured.map((p, i) => (
                                        <HeroProductCard key={`feat-${p.product_name}-${i}`} product={p} index={i} onClick={setSelectedProduct} priceUnlocked={anyUnlocked} isDark={isDark} />
                                    ))}
                                </div>
                            </div>
                        )}

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
                                        <ArrowLeft className="w-3.5 h-3.5" /> Kembali
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
                                        ref={searchInputRef}
                                        type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={activeBrand ? `Cari di ${activeBrand}…` : 'Cari nama produk, merek, atau kategori…'}
                                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-gold-500/30 transition ${isDark ? 'bg-navy-800/60 border-white/8 text-white placeholder-navy-600 focus:border-gold-500/35' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400'}`}
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className={`absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg transition flex items-center justify-center ${isDark ? 'text-navy-500 hover:text-white hover:bg-white/8' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Source filter — pick where to search while a term is active */}
                                {searching && (
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Sumber</span>
                                        {[
                                            { key: 'all', label: 'Semua' },
                                            { key: 'catalog', label: 'Katalog' },
                                            { key: 'inventory', label: 'Inventori' },
                                        ].map(({ key, label }) => (
                                            <button
                                                key={key}
                                                onClick={() => setSearchSource(key)}
                                                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                                                    source === key
                                                        ? key === 'inventory'
                                                            ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/25'
                                                            : 'bg-gold-500 text-navy-950 border-gold-500 shadow-md shadow-gold-500/25'
                                                        : isDark
                                                            ? 'bg-transparent text-navy-400 border-white/10 hover:text-white hover:border-white/25'
                                                            : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {source !== 'inventory' && visibleCategories.length > 0 && (
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
                                    {source === 'inventory' ? (
                                        <>
                                            <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{invResults?.length ?? 0}</span>
                                            {' item inventori'}
                                        </>
                                    ) : (
                                        <>
                                            <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{filtered.length}</span>
                                            {activeBrand ? ` produk di ${activeBrand}` : ' produk'}
                                        </>
                                    )}
                                </p>
                                {(searchTerm || activeCategory !== 'all') && (
                                    <button onClick={() => { setSearchTerm(''); setActiveCategory('all'); }} className={`text-xs transition font-medium flex items-center gap-1 ${isDark ? 'text-gold-400 hover:text-gold-300' : 'text-amber-600 hover:text-amber-700'}`}>
                                        <X className="w-3 h-3" /> Hapus filter
                                    </button>
                                )}
                            </div>

                            {source === 'inventory' ? null : filtered.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                                    {filtered.map((p, i) => (
                                        <ProductCard key={`${p.brand}-${p.product_name}-${i}`} product={p} index={i} onClick={setSelectedProduct} priceUnlocked={anyUnlocked} isDark={isDark} />
                                    ))}
                                </div>
                            ) : (source !== 'catalog' && (invLoading || (invResults && invResults.length > 0))) ? (
                                <p className={`text-sm text-center py-6 ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>
                                    Tidak ada di katalog — lihat hasil inventori di bawah.
                                </p>
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

                            {/* ── Inventory results (extracted component) ── */}
                            <InventoryResults
                                searching={searching}
                                source={source}
                                loading={invLoading}
                                results={invResults}
                                term={searchTerm.trim()}
                                isDark={isDark}
                            />
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
                                        <button onClick={() => setRegModal('register')} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition shadow-lg shadow-gold-500/25">
                                            <UserPlus className="w-4 h-4" /> Daftar Channel
                                        </button>
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

            {selectedProduct && (
                <ProductModal
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    priceUnlocked={anyUnlocked}
                    isDark={isDark}
                    hasPartnerPin={!!partnerPin}
                    onPartnerLogin={() => { setSelectedProduct(null); setShowPinModal(true); }}
                />
            )}
            {showPinModal && <PartnerModal onClose={() => setShowPinModal(false)} error={pinError} isDark={isDark} />}
            {regModal && <RegisterModal onClose={() => setRegModal(null)} isDark={isDark} initialMode={regModal} />}

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
