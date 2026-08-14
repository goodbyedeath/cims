import { router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Modal from '@/Components/ui/Modal';
import Pagination from '@/Components/ui/Pagination';
import Badge from '@/Components/ui/Badge';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { formatCurrency, statusColor } from '@/Lib/utils';
import {
    Plus, Search, Edit, Trash2, Package, ExternalLink, Image as ImageIcon,
    Upload, Tag, X, Camera, KeyRound, RefreshCw, Copy, Check, ShieldOff,
    Download, Sheet,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function ExpandableText({ text, color = 'text-navy-300' }) {
    const [expanded, setExpanded] = useState(false);
    if (!text) return <span className="text-navy-600">-</span>;
    const isLong = text.length > 80;
    return (
        <div className={`text-xs ${color}`}>
            <span style={!expanded && isLong ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}}>
                {text}
            </span>
            {isLong && (
                <button onClick={() => setExpanded(v => !v)} className="block mt-0.5 text-gold-500 hover:text-gold-400 transition font-medium">
                    {expanded ? 'Less' : 'More'}
                </button>
            )}
        </div>
    );
}

/* ─── Brand logo row inside the Brands modal ──────────────────────────────── */
function BrandRow({ brand, onLogoSaved, onLogoRemoved }) {
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [localLogo, setLocalLogo] = useState(brand.logo_url);

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fd = new FormData();
        fd.append('name', brand.name);
        fd.append('logo', file);

        setUploading(true);
        router.post('/catalog/brands/logo', fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                const url = URL.createObjectURL(file);
                setLocalLogo(url);
                onLogoSaved(brand.name, url);
            },
            onFinish: () => {
                setUploading(false);
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    };

    const handleRemove = () => {
        if (!confirm(`Remove logo for "${brand.name}"?`)) return;
        setRemoving(true);
        router.delete('/catalog/brands/logo', {
            data: { name: brand.name },
            preserveScroll: true,
            onSuccess: () => { setLocalLogo(null); onLogoRemoved(brand.name); },
            onFinish: () => setRemoving(false),
        });
    };

    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
            {/* Logo preview */}
            <div className="w-12 h-12 rounded-xl border border-white/10 bg-navy-800/60 flex items-center justify-center shrink-0 overflow-hidden">
                {localLogo
                    ? <img src={localLogo} alt={brand.name} className="w-full h-full object-contain p-1" />
                    : <Tag className="w-5 h-5 text-navy-600" />
                }
            </div>

            {/* Name */}
            <span className="flex-1 text-sm font-medium text-white truncate">{brand.name}</span>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleFile} className="hidden" />
                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs font-medium hover:bg-gold-500/20 transition disabled:opacity-50"
                >
                    {uploading
                        ? <span className="w-3 h-3 border border-gold-400 border-t-transparent rounded-full animate-spin" />
                        : <Camera className="w-3.5 h-3.5" />
                    }
                    {localLogo ? 'Change' : 'Upload'}
                </button>
                {localLogo && (
                    <button
                        onClick={handleRemove}
                        disabled={removing}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-500 hover:text-red-400 transition disabled:opacity-50"
                        title="Remove logo"
                    >
                        {removing
                            ? <span className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin block" />
                            : <X className="w-3.5 h-3.5" />
                        }
                    </button>
                )}
            </div>
        </div>
    );
}

const blankForm = { brand: '', category: '', product_name: '', description: '', selling_points: '', application_scenario: '', best_price: '', special_discount_pct: '', moq: 1, status: 'active', stock_status: 'ready', sort_order: 0, is_featured: 0 };

/* ─── Partner PIN modal ──────────────────────────────────────────────────── */
function PinModal({ currentPin, specialDiscountPct, onClose }) {
    const [copied, setCopied] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [pct, setPct] = useState(specialDiscountPct ?? 0);
    const [savingPct, setSavingPct] = useState(false);

    const savePct = () => {
        setSavingPct(true);
        router.post('/catalog/special-discount', { pct: Number(pct) || 0 }, {
            preserveScroll: true,
            onFinish: () => setSavingPct(false),
        });
    };

    const handleCopy = () => {
        if (!currentPin) return;
        navigator.clipboard.writeText(currentPin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleGenerate = () => {
        setGenerating(true);
        router.post('/catalog/partner-pin/generate', {}, {
            preserveScroll: true,
            onFinish: () => setGenerating(false),
        });
    };

    const handleClear = () => {
        if (!confirm('Hapus PIN? Harga akan terkunci dan tidak ada yang bisa melihatnya.')) return;
        setClearing(true);
        router.post('/catalog/partner-pin/clear', {}, {
            preserveScroll: true,
            onFinish: () => setClearing(false),
        });
    };

    return (
        <Modal show onClose={onClose} title="Partner PIN" maxWidth="max-w-sm">
            <div className="space-y-5">
                <p className="text-xs text-navy-400 leading-relaxed">
                    Bagikan PIN 4-digit ini kepada partner terpilih. Mereka memasukkan PIN di halaman katalog publik untuk melihat harga.
                </p>

                {currentPin ? (
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-navy-300 uppercase tracking-widest">PIN Aktif</p>
                        <div className="flex items-center gap-3">
                            {/* PIN digits */}
                            <div className="flex gap-2">
                                {currentPin.split('').map((digit, i) => (
                                    <div key={i} className="w-12 h-14 rounded-xl bg-navy-800/60 border border-white/10 flex items-center justify-center text-2xl font-black text-gold-400 tracking-widest select-all">
                                        {digit}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={handleCopy}
                                title="Copy PIN"
                                className="w-10 h-10 rounded-xl border border-white/10 bg-white/3 hover:bg-white/8 flex items-center justify-center transition text-navy-400 hover:text-white"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        {copied && <p className="text-xs text-emerald-400">PIN disalin!</p>}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-white/5 bg-navy-800/30">
                        <ShieldOff className="w-8 h-8 text-navy-600" />
                        <p className="text-sm text-navy-400 font-medium">Belum ada PIN</p>
                        <p className="text-xs text-navy-600 text-center">Harga terkunci tapi tidak ada yang bisa membukanya. Generate PIN untuk mulai.</p>
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <Button onClick={handleGenerate} disabled={generating} className="flex-1">
                        <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                        {currentPin ? 'Generate Baru' : 'Generate PIN'}
                    </Button>
                    {currentPin && (
                        <Button variant="secondary" onClick={handleClear} disabled={clearing}>
                            {clearing ? <span className="w-4 h-4 border border-white/30 border-t-transparent rounded-full animate-spin" /> : <X className="w-4 h-4" />}
                            Hapus
                        </Button>
                    )}
                </div>

                {/* Special price for registered channels */}
                <div className="pt-4 border-t border-white/5 space-y-2.5">
                    <p className="text-xs font-medium text-navy-300 uppercase tracking-widest">Harga Spesial — Channel Terdaftar</p>
                    <p className="text-xs text-navy-400 leading-relaxed">
                        Diskon (%) dari harga terbaik, tampil sebagai harga coret untuk pengunjung yang
                        sudah mendaftar / verifikasi sebagai channel di katalog publik. Isi 0 untuk menonaktifkan.
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="relative w-28">
                            <input
                                type="number" min="0" max="90" step="0.5"
                                value={pct}
                                onChange={(e) => setPct(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 rounded-lg bg-navy-800/60 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/40"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-navy-500">%</span>
                        </div>
                        <Button size="sm" onClick={savePct} disabled={savingPct}>
                            {savingPct ? <span className="w-3.5 h-3.5 border border-navy-950/40 border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Simpan
                        </Button>
                        <span className={`text-xs ${Number(specialDiscountPct) > 0 ? 'text-emerald-400' : 'text-navy-500'}`}>
                            {Number(specialDiscountPct) > 0 ? `Aktif: −${specialDiscountPct}%` : 'Nonaktif'}
                        </span>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default function Index({ catalogs, filters, categories, brands: initialBrands, brandsMap: initialBrandsMap, partnerPin: initialPartnerPin, specialDiscountPct, hasGoogleSheet }) {
    const { errors } = usePage().props;

    const { sort_by, sort_dir } = filters;
    const [search, setSearch] = useState(filters.search || '');
    const [category, setCategory] = useState(filters.category || '');
    const [status, setStatus] = useState(filters.status || '');

    const handleSort = (field, dir) => {
        router.get('/catalog', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    const [showModal, setShowModal] = useState(false);
    const [showBrandsModal, setShowBrandsModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [data, setDataState] = useState(blankForm);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const fileInputRef = useRef(null);

    // Local brand logo state so the table updates without full page reload
    const [brandsMap, setBrandsMap] = useState(initialBrandsMap || {});
    const [brands, setBrands] = useState(initialBrands || []);

    const setField = (k, v) => setDataState((prev) => ({ ...prev, [k]: v }));

    useEffect(() => {
        if (!imageFile) { setImagePreview(null); return; }
        const url = URL.createObjectURL(imageFile);
        setImagePreview(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    const openCreate = () => {
        setEditItem(null);
        setDataState(blankForm);
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowModal(true);
    };

    const openEdit = (item) => {
        setEditItem(item);
        setDataState({
            brand: item.brand || '',
            category: item.category || '',
            product_name: item.product_name || '',
            description: item.description || '',
            selling_points: Array.isArray(item.selling_points) ? item.selling_points.join('\n') : (item.selling_points || ''),
            application_scenario: item.application_scenario || '',
            best_price: item.best_price ?? '',
            special_discount_pct: item.special_discount_pct ?? '',
            moq: item.moq ?? 1,
            status: item.status || 'active',
            stock_status: item.stock_status || 'ready',
            sort_order: item.sort_order ?? 0,
            is_featured: item.is_featured ? 1 : 0,
        });
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowModal(true);
    };

    const submit = (e) => {
        e.preventDefault();
        const fd = new FormData();
        Object.entries(data).forEach(([k, v]) => fd.append(k, String(v ?? '')));
        if (imageFile) fd.append('image', imageFile);

        setProcessing(true);
        const opts = {
            forceFormData: true, preserveScroll: true,
            onSuccess: () => { setShowModal(false); setImageFile(null); setDataState(blankForm); },
            onFinish: () => setProcessing(false),
        };

        if (editItem) { fd.append('_method', 'PUT'); router.post(`/catalog/${editItem.id}`, fd, opts); }
        else router.post('/catalog', fd, opts);
    };

    const applyFilters = (overrides = {}) => {
        const next = {
            search:   overrides.search   !== undefined ? overrides.search   : search,
            category: overrides.category !== undefined ? overrides.category : category,
            status:   overrides.status   !== undefined ? overrides.status   : status,
        };
        const params = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== ''));
        router.get('/catalog', params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = (item) => {
        if (!confirm(`Delete "${item.product_name}"? This will also remove its image file.`)) return;
        router.delete(`/catalog/${item.id}`, { preserveScroll: true });
    };

    const handleLogoSaved = (name, url) => {
        setBrandsMap((prev) => ({ ...prev, [name]: url }));
        setBrands((prev) => prev.map((b) => b.name === name ? { ...b, logo_url: url } : b));
    };

    const handleLogoRemoved = (name) => {
        setBrandsMap((prev) => { const next = { ...prev }; delete next[name]; return next; });
        setBrands((prev) => prev.map((b) => b.name === name ? { ...b, logo_url: null } : b));
    };

    const handleSyncGoogleSheet = () => {
        setSyncing(true);
        router.post('/catalog/sync-google-sheet', {}, {
            preserveScroll: true,
            onFinish: () => setSyncing(false),
        });
    };

    const total = catalogs.total ?? catalogs.data?.length ?? 0;

    return (
        <AuthenticatedLayout title="Product Catalog">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <form onSubmit={(e) => { e.preventDefault(); applyFilters({ search }); }} className="relative w-full lg:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search brand, category, product..."
                            className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-full"
                        />
                    </form>
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href="/catalog/public" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-navy-800/50 border border-white/10 text-navy-200 hover:text-white hover:border-gold-500/40 transition"
                        >
                            <ExternalLink className="w-4 h-4" /> Public Page
                        </a>
                        <Button variant="secondary" onClick={() => setShowBrandsModal(true)}>
                            <Tag className="w-4 h-4" /> Brand Logos
                        </Button>
                        <button
                            onClick={() => setShowPinModal(true)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
                                initialPartnerPin
                                    ? 'bg-gold-500/10 border-gold-500/30 text-gold-400 hover:bg-gold-500/20'
                                    : 'bg-navy-800/50 border-white/10 text-navy-400 hover:text-white hover:border-white/25'
                            }`}
                        >
                            <KeyRound className="w-4 h-4" />
                            Partner PIN {initialPartnerPin ? <span className="px-1.5 py-0.5 rounded-md bg-gold-500/20 text-gold-300 text-[10px] font-bold">AKTIF</span> : null}
                        </button>
                        {/* Google Sheet Sync */}
                        {hasGoogleSheet && (
                            <button
                                onClick={handleSyncGoogleSheet}
                                disabled={syncing}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                            >
                                {syncing
                                    ? <span className="w-4 h-4 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                    : <Sheet className="w-4 h-4" />
                                }
                                {syncing ? 'Syncing...' : 'Sync Google Sheet'}
                            </button>
                        )}
                        {/* Export */}
                        <a
                            href="/catalog/export"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-navy-800/50 border border-white/10 text-navy-200 hover:text-white hover:border-white/25 transition"
                        >
                            <Download className="w-4 h-4" /> Export XLSX
                        </a>
                        <Button onClick={openCreate}>
                            <Plus className="w-4 h-4" /> Add Product
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select value={category} onChange={(e) => { setCategory(e.target.value); applyFilters({ category: e.target.value }); }}
                        className="px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30">
                        <option value="">All categories</option>
                        {categories?.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={status} onChange={(e) => { setStatus(e.target.value); applyFilters({ status: e.target.value }); }}
                        className="px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30">
                        <option value="">All status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <span className="text-xs text-navy-400">{total} product{total === 1 ? '' : 's'}</span>
                </div>
            </div>

            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Image</Th>
                            <ThSortable field="brand" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Brand</ThSortable>
                            <ThSortable field="category" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Category</ThSortable>
                            <ThSortable field="product_name" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Product Name</ThSortable>
                            <Th>Description</Th>
                            <ThSortable field="best_price" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Best Price</ThSortable>
                            <ThSortable field="moq" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>MOQ</ThSortable>
                            <Th>Status</Th>
                            <Th>Stock</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {catalogs.data?.length > 0 ? catalogs.data.map((item) => (
                            <Tr key={item.id}>
                                <Td>
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.product_name} className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-navy-800/70 border border-white/5 flex items-center justify-center">
                                            <Package className="w-5 h-5 text-navy-500" />
                                        </div>
                                    )}
                                </Td>
                                <Td>
                                    <div className="flex items-center gap-2">
                                        {brandsMap[item.brand] && (
                                            <img src={brandsMap[item.brand]} alt={item.brand} className="w-6 h-6 object-contain rounded" />
                                        )}
                                        <span className="text-white font-medium text-sm">{item.brand}</span>
                                    </div>
                                </Td>
                                <Td>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-navy-800/70 text-navy-200 border border-white/5">
                                        {item.category}
                                    </span>
                                </Td>
                                <Td>
                                    <span className="text-white font-medium">{item.product_name}</span>
                                    {item.uid && (
                                        <p className="text-[10px] text-navy-600 font-mono mt-0.5 select-all">{item.uid}</p>
                                    )}
                                </Td>
                                <Td className="max-w-xs"><ExpandableText text={item.description} /></Td>
                                <Td className="font-semibold text-gold-400">
                                    {formatCurrency(item.best_price)}
                                    {item.special_discount_pct != null && (
                                        <span className={`block text-[10px] font-bold ${Number(item.special_discount_pct) > 0 ? 'text-emerald-400' : 'text-navy-500'}`}>
                                            {Number(item.special_discount_pct) > 0 ? `Spesial −${Number(item.special_discount_pct)}%` : 'Tanpa spesial'}
                                        </span>
                                    )}
                                </Td>
                                <Td className="text-navy-200">{item.moq}</Td>
                                <Td><Badge className={statusColor(item.status)}>{item.status}</Badge></Td>
                                <Td>
                                    <Badge className={item.stock_status === 'ready'
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'}>
                                        {item.stock_status === 'ready' ? 'Ready' : 'Indent'}
                                    </Badge>
                                </Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </Td>
                            </Tr>
                        )) : (
                            <Tr>
                                <Td colSpan={10} className="text-center py-12">
                                    <Package className="w-8 h-8 text-navy-600 mx-auto mb-2" />
                                    <p className="text-navy-400">No products yet</p>
                                    <p className="text-navy-500 text-xs mt-1">Click "Add Product" to create your first catalog entry.</p>
                                </Td>
                            </Tr>
                        )}
                    </Tbody>
                </Table>
                <Pagination links={catalogs.links} />
            </Card>

            {/* ── Product modal ────────────────────────────────────────── */}
            <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Product' : 'Add Product'} maxWidth="max-w-2xl">
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-navy-200">Brand</label>
                            <input type="text" list="catalog-brands" value={data.brand} onChange={(e) => setField('brand', e.target.value)} placeholder="e.g. Samsung"
                                className={`w-full px-4 py-2.5 bg-navy-800/50 border rounded-lg text-white placeholder-navy-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30 ${errors?.brand ? 'border-red-500/50' : 'border-white/10'}`} />
                            <datalist id="catalog-brands">{brands.map((b) => <option key={b.name} value={b.name} />)}</datalist>
                            {errors?.brand && <p className="text-xs text-red-400">{errors.brand}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-navy-200">Category</label>
                            <input type="text" list="catalog-categories" value={data.category} onChange={(e) => setField('category', e.target.value)} placeholder="e.g. Electronics"
                                className={`w-full px-4 py-2.5 bg-navy-800/50 border rounded-lg text-white placeholder-navy-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30 ${errors?.category ? 'border-red-500/50' : 'border-white/10'}`} />
                            <datalist id="catalog-categories">{categories?.map((c) => <option key={c} value={c} />)}</datalist>
                            {errors?.category && <p className="text-xs text-red-400">{errors.category}</p>}
                        </div>
                    </div>

                    <Input label="Product Name" value={data.product_name} onChange={(e) => setField('product_name', e.target.value)} error={errors?.product_name} placeholder="Full product name" />

                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Description</label>
                        <textarea value={data.description} onChange={(e) => setField('description', e.target.value)} rows={4} placeholder="Optional product description..."
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30" />
                        {errors?.description && <p className="text-xs text-red-400 mt-1">{errors.description}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">
                            Selling Points <span className="text-navy-500 font-normal text-xs">(optional · one per line)</span>
                        </label>
                        <textarea value={data.selling_points} onChange={(e) => setField('selling_points', e.target.value)} rows={3}
                            placeholder={"Efisiensi tinggi 98%\nGaransi 2 tahun\nIP65 rated"}
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 font-mono" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">
                            Application Scenario <span className="text-navy-500 font-normal text-xs">(optional)</span>
                        </label>
                        <textarea value={data.application_scenario} onChange={(e) => setField('application_scenario', e.target.value)} rows={2}
                            placeholder="e.g. Cocok untuk industri manufaktur, data center, dan bangunan komersial."
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <Input label="Best Price (Rp)" type="number" step="1" min={0} value={data.best_price} onChange={(e) => setField('best_price', e.target.value)} error={errors?.best_price} placeholder="e.g. 150000" />
                        <div className="space-y-1.5">
                            <Input label="Diskon Spesial (%)" type="number" step="0.5" min={0} max={90} value={data.special_discount_pct} onChange={(e) => setField('special_discount_pct', e.target.value)} error={errors?.special_discount_pct} placeholder={`Global: ${specialDiscountPct || 0}%`} />
                            <p className="text-[10px] text-navy-500 leading-tight">Kosong = ikut diskon global. 0 = tanpa harga spesial.</p>
                        </div>
                        <Input label="MOQ" type="number" min={1} value={data.moq} onChange={(e) => setField('moq', parseInt(e.target.value, 10) || 1)} error={errors?.moq} />
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-navy-200">Status</label>
                            <select value={data.status} onChange={(e) => setField('status', e.target.value)}
                                className={`w-full px-4 py-2.5 bg-navy-800/50 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30 ${errors?.status ? 'border-red-500/50' : 'border-white/10'}`}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-navy-200">Stock Status</label>
                            <select value={data.stock_status} onChange={(e) => setField('stock_status', e.target.value)}
                                className={`w-full px-4 py-2.5 bg-navy-800/50 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30 ${errors?.stock_status ? 'border-red-500/50' : 'border-white/10'}`}>
                                <option value="ready">Ready</option>
                                <option value="indent">Indent</option>
                            </select>
                            {errors?.stock_status && <p className="text-xs text-red-400">{errors.stock_status}</p>}
                        </div>
                    </div>

                    <Input label="Sort Order (lower = first)" type="number" min={0} value={data.sort_order} onChange={(e) => setField('sort_order', parseInt(e.target.value, 10) || 0)} error={errors?.sort_order} />

                    <button
                        type="button"
                        onClick={() => setField('is_featured', data.is_featured ? 0 : 1)}
                        className="flex items-center gap-3 w-full text-left py-1"
                    >
                        <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${data.is_featured ? 'bg-gold-500' : 'bg-navy-700'}`}>
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${data.is_featured ? 'translate-x-4' : 'translate-x-0'}`} />
                        </span>
                        <div>
                            <span className="text-sm font-medium text-navy-200">Featured — tampil di Hero Section</span>
                            <p className="text-xs text-navy-500 mt-0.5">Produk ditampilkan menonjol di bagian atas katalog publik</p>
                        </div>
                    </button>

                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Product Image</label>
                        <div className="flex items-start gap-3">
                            {/* Tappable preview — clicking opens the file picker */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="relative shrink-0 w-28 h-28 rounded-xl border-2 border-dashed border-white/15 hover:border-gold-500/40 bg-navy-800/40 overflow-hidden transition-colors group"
                            >
                                {(imagePreview || editItem?.image_url) ? (
                                    <>
                                        <img
                                            src={imagePreview || editItem.image_url}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                            <Camera className="w-6 h-6 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                                        <Camera className="w-7 h-7 text-navy-500" />
                                        <span className="text-[10px] text-navy-500 font-medium">Tap to add</span>
                                    </div>
                                )}
                            </button>

                            <div className="flex-1 min-w-0 flex flex-col gap-2">
                                {/* Explicit button — easier to tap on mobile than native file::: */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-navy-200 hover:text-white hover:border-white/25 transition"
                                >
                                    <Camera className="w-4 h-4" />
                                    {imageFile ? 'Change Image' : editItem?.image_url ? 'Replace Image' : 'Choose Image'}
                                </button>
                                <p className="text-xs text-navy-500 leading-relaxed">
                                    JPG, PNG or WEBP · Max 5 MB
                                    {editItem?.image_url && !imageFile && <><br />Leave empty to keep current</>}
                                </p>
                                {imageFile && (
                                    <p className="text-xs text-emerald-400 truncate">✓ {imageFile.name}</p>
                                )}
                                {errors?.image && <p className="text-xs text-red-400">{errors.image}</p>}
                            </div>
                        </div>

                        {/* Hidden file input — accept="image/*" is more permissive for mobile cameras */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={processing}>
                            <Upload className="w-4 h-4" />
                            {processing ? 'Saving...' : (editItem ? 'Update' : 'Create')}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* ── Brand Logos modal ────────────────────────────────────── */}
            <Modal show={showBrandsModal} onClose={() => setShowBrandsModal(false)} title="Brand Logos" maxWidth="max-w-md">
                <p className="text-xs text-navy-400 mb-4">
                    Upload a logo for each brand. Logos appear on product cards in the public catalog.
                    Supported: JPG, PNG, WEBP, SVG · Max 2 MB.
                </p>
                {brands.length === 0 ? (
                    <div className="text-center py-8 text-navy-500 text-sm">
                        <Tag className="w-8 h-8 mx-auto mb-2 text-navy-700" />
                        No brands found. Add products first.
                    </div>
                ) : (
                    <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
                        {brands.map((b) => (
                            <BrandRow
                                key={b.name}
                                brand={b}
                                onLogoSaved={handleLogoSaved}
                                onLogoRemoved={handleLogoRemoved}
                            />
                        ))}
                    </div>
                )}
            </Modal>

            {showPinModal && (
                <PinModal currentPin={initialPartnerPin} specialDiscountPct={specialDiscountPct} onClose={() => setShowPinModal(false)} />
            )}
        </AuthenticatedLayout>
    );
}
