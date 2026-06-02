import { router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Modal from '@/Components/ui/Modal';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { formatCurrency } from '@/Lib/utils';
import { Plus, Search, Edit, Trash2, Package, Upload, FileSpreadsheet, AlertTriangle, RefreshCw, Wand2, Zap, Copy, Check } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeSrp(m1, formula) {
    const v = parseFloat(formula.value) || 0;
    switch (formula.type) {
        case 'subtract_percent': return m1 * (1 - v / 100);
        case 'add_percent':      return m1 * (1 + v / 100);
        case 'multiply':         return m1 * v;
        case 'divide':           return v !== 0 ? m1 / v : m1;
        case 'subtract_fixed':   return Math.max(0, m1 - v);
        default:                 return m1 * (1 - v / 100);
    }
}

function formulaLabel(type, value) {
    switch (type) {
        case 'subtract_percent': return `M1 − ${value}%`;
        case 'add_percent':      return `M1 + ${value}%`;
        case 'multiply':         return `M1 × ${value}`;
        case 'divide':           return `M1 ÷ ${value}`;
        case 'subtract_fixed':   return `M1 − Rp ${Number(value).toLocaleString('id-ID')}`;
        default:                 return `M1 − ${value}%`;
    }
}

function formulaDescription(type) {
    switch (type) {
        case 'subtract_percent': return 'Reduce M1 by a percentage — e.g. SRP = M1 − 20.5%';
        case 'add_percent':      return 'Mark up M1 by a percentage — e.g. SRP = M1 + 10%';
        case 'multiply':         return 'Multiply M1 by a factor — e.g. SRP = M1 × 0.795';
        case 'divide':           return 'Divide M1 by a factor — e.g. SRP = M1 ÷ 1.258';
        case 'subtract_fixed':   return 'Subtract a fixed Rupiah amount — e.g. SRP = M1 − 50,000';
        default:                 return '';
    }
}

function ExpandableText({ text, color = 'text-navy-200' }) {
    const [expanded, setExpanded] = useState(false);
    if (!text) return <span className="text-navy-600">-</span>;
    const isLong = text.length > 80;
    return (
        <div className={`text-xs ${color}`}>
            <span style={!expanded && isLong ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}}>
                {text}
            </span>
            {isLong && (
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="block mt-0.5 text-gold-500 hover:text-gold-400 transition font-medium"
                >
                    {expanded ? 'Less ↑' : 'More ↓'}
                </button>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Index({ inventories, filters, hasGoogleSheet, srpFormula }) {
    const { sort_by, sort_dir } = filters;
    const [search, setSearch] = useState(filters.search || '');

    const handleSort = (field, dir) => {
        router.get('/inventory', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    // ── Modal states ──────────────────────────────────────────────────────────
    const [showModal, setShowModal]             = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);
    const [showFormulaModal, setShowFormulaModal]     = useState(false);
    const [editItem, setEditItem]               = useState(null);
    const [importFile, setImportFile]           = useState(null);
    const [importing, setImporting]             = useState(false);
    const [removingAll, setRemovingAll]         = useState(false);
    const [syncing, setSyncing]                 = useState(false);
    const [savingFormula, setSavingFormula]     = useState(false);
    const fileInputRef = useRef(null);
    const [copiedId, setCopiedId] = useState(null);

    const copyTemplate = useCallback((item) => {
        const m1Formatted = 'Rp.' + Math.round(parseFloat(item.m1)).toLocaleString('id-ID');
        const parts = [item.kode_barang, item.spesifikasi].filter(Boolean);
        const text = `${parts.join(' ')} @${m1Formatted}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(item.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    }, []);

    // ── Formula local state ───────────────────────────────────────────────────
    const [formula, setFormula] = useState({ ...srpFormula });

    // ── Item form ─────────────────────────────────────────────────────────────
    const { data, setData, post, put, processing, errors, reset } = useForm({
        sku_no:      '',
        product:     '',
        kode_barang: '',
        spesifikasi: '',
        notes:       '',
        qty:         '',
        srp:         '',
        m1:          '',
    });

    // Track if SRP was auto-computed so we can show the "Auto" badge
    const [srpIsAuto, setSrpIsAuto] = useState(false);

    const handleM1Change = useCallback((raw) => {
        if (raw === '' || raw === undefined) {
            setData(prev => ({ ...prev, m1: '', srp: '' }));
            setSrpIsAuto(false);
            return;
        }
        const m1 = parseFloat(raw) || 0;
        const srp = Math.round(computeSrp(m1, srpFormula));
        setData(prev => ({ ...prev, m1: raw, srp: srp > 0 ? String(srp) : '' }));
        setSrpIsAuto(srp > 0);
    }, [srpFormula]);

    const handleSrpChange = useCallback((raw) => {
        setData('srp', raw);
        setSrpIsAuto(false);
    }, []);

    const openCreate = () => {
        reset();
        setSrpIsAuto(false);
        setEditItem(null);
        setShowModal(true);
    };

    const openEdit = (item) => {
        setEditItem(item);
        setSrpIsAuto(false);
        setData({
            sku_no:      item.sku_no,
            product:     item.product,
            kode_barang: item.kode_barang,
            spesifikasi: item.spesifikasi || '',
            notes:       item.notes || '',
            qty:         item.qty ?? '',
            srp:         String(Math.round(parseFloat(item.srp) || 0)),
            m1:          String(Math.round(parseFloat(item.m1) || 0)),
        });
        setShowModal(true);
    };

    const submit = (e) => {
        e.preventDefault();
        const payload = {
            ...data,
            qty: data.qty === '' ? null : parseInt(data.qty, 10),
            srp: parseInt(data.srp, 10) || 0,
            m1:  parseInt(data.m1,  10) || 0,
        };
        if (editItem) {
            put(`/inventory/${editItem.id}`, { data: payload, onSuccess: () => setShowModal(false) });
        } else {
            post('/inventory', { data: payload, onSuccess: () => setShowModal(false) });
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        router.get('/inventory', { search }, { preserveState: true });
    };

    const handleImport = (e) => {
        e.preventDefault();
        if (!importFile) return;
        const formData = new FormData();
        formData.append('file', importFile);
        setImporting(true);
        router.post('/inventory/import', formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { setShowImportModal(false); setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; },
            onFinish: () => setImporting(false),
        });
    };

    const handleRemoveAll = () => {
        setRemovingAll(true);
        router.delete('/inventory', {
            preserveScroll: true,
            onSuccess: () => setShowRemoveAllModal(false),
            onFinish: () => setRemovingAll(false),
        });
    };

    const handleSaveFormula = (e) => {
        e.preventDefault();
        setSavingFormula(true);
        router.post('/inventory/srp-formula', formula, {
            preserveScroll: true,
            onSuccess: () => setShowFormulaModal(false),
            onFinish: () => setSavingFormula(false),
        });
    };

    // Preview SRP for the formula modal — IDR: round to nearest integer
    const previewM1  = 1_000_000;
    const previewSrp = Math.round(computeSrp(previewM1, formula));

    return (
        <AuthenticatedLayout title="Inventory">
            {/* ── Toolbar ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search SKU, product, kode barang..."
                        className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-full sm:w-80"
                    />
                </form>
                <div className="flex items-center gap-2 flex-wrap">
                    {inventories.data?.length > 0 && (
                        <Button variant="secondary" onClick={() => setShowRemoveAllModal(true)} className="!text-red-400 hover:!bg-red-500/10">
                            <Trash2 className="w-4 h-4" /> Remove All
                        </Button>
                    )}
                    {hasGoogleSheet && (
                        <Button
                            variant="secondary"
                            disabled={syncing}
                            onClick={() => {
                                setSyncing(true);
                                router.post('/inventory/sync-google-sheet', {}, {
                                    preserveScroll: true,
                                    onFinish: () => setSyncing(false),
                                });
                            }}
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Syncing...' : 'Sync Google Sheet'}
                        </Button>
                    )}
                    {/* Formula settings button */}
                    <Button variant="secondary" onClick={() => { setFormula({ ...srpFormula }); setShowFormulaModal(true); }}>
                        <Wand2 className="w-4 h-4 text-gold-400" />
                        <span className="hidden sm:inline">SRP Formula</span>
                        <span className="inline sm:hidden">Formula</span>
                    </Button>
                    <Button variant="secondary" onClick={() => setShowImportModal(true)}>
                        <Upload className="w-4 h-4" /> Import XLSX
                    </Button>
                    <Button onClick={openCreate}>
                        <Plus className="w-4 h-4" /> Add Item
                    </Button>
                </div>
            </div>

            {/* ── Active formula info strip ── */}
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-navy-800/40 border border-white/5 rounded-xl text-xs">
                <Zap className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span className="text-navy-400">Auto SRP formula:</span>
                <span className="text-gold-300 font-semibold font-mono">{formulaLabel(srpFormula.type, srpFormula.value)}</span>
                <span className="text-navy-500">— applied when M1 is entered and on import if SRP is blank</span>
            </div>

            {/* ── Table ── */}
            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <ThSortable field="sku_no"      sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>SKU NO</ThSortable>
                            <ThSortable field="product"     sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Product</ThSortable>
                            <ThSortable field="kode_barang" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Kode Barang</ThSortable>
                            <Th>Spesifikasi</Th>
                            <Th>Notes</Th>
                            <ThSortable field="qty" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>QTY</ThSortable>
                            <ThSortable field="srp" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>SRP</ThSortable>
                            <ThSortable field="m1"  sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>M1 (Harga)</ThSortable>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {inventories.data?.length > 0 ? inventories.data.map((item) => (
                            <Tr key={item.id}>
                                <Td className="font-mono text-xs text-gold-400">{item.sku_no}</Td>
                                <Td className="text-white font-medium">{item.product}</Td>
                                <Td className="font-mono text-xs">{item.kode_barang}</Td>
                                <Td className="max-w-xs"><ExpandableText text={item.spesifikasi} color="text-navy-200" /></Td>
                                <Td className="max-w-xs"><ExpandableText text={item.notes} color="text-navy-300" /></Td>
                                <Td className="font-medium text-white">
                                    {item.qty === null ? <span className="text-emerald-400 text-xs">Infinite</span> : item.qty}
                                </Td>
                                <Td className="font-medium text-emerald-400">{formatCurrency(item.srp)}</Td>
                                <Td className="font-semibold text-gold-400">{formatCurrency(item.m1)}</Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => copyTemplate(item)}
                                            title={`Copy: ${[item.kode_barang, item.spesifikasi].filter(Boolean).join(' ')} @Rp.${Math.round(parseFloat(item.m1)).toLocaleString('id-ID')}`}
                                            className={`p-1.5 rounded-lg transition ${
                                                copiedId === item.id
                                                    ? 'text-emerald-400 bg-emerald-500/10'
                                                    : 'text-navy-400 hover:text-sky-400 hover:bg-sky-500/10'
                                            }`}
                                        >
                                            {copiedId === item.id
                                                ? <Check className="w-4 h-4" />
                                                : <Copy className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => openEdit(item)}
                                            className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('Delete this item?')) router.delete(`/inventory/${item.id}`, { preserveScroll: true }); }}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Td>
                            </Tr>
                        )) : (
                            <Tr>
                                <Td colSpan={9} className="text-center py-8">
                                    <Package className="w-8 h-8 text-navy-600 mx-auto mb-2" />
                                    <p className="text-navy-400">No inventory items yet</p>
                                </Td>
                            </Tr>
                        )}
                    </Tbody>
                </Table>
                <Pagination links={inventories.links} />
            </Card>

            {/* ── Add / Edit item modal ── */}
            <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Inventory Item' : 'Add Inventory Item'} maxWidth="max-w-xl">
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input label="SKU NO"       value={data.sku_no}      onChange={(e) => setData('sku_no', e.target.value)}      error={errors.sku_no}      placeholder="SKU-001" />
                        <Input label="Kode Barang"  value={data.kode_barang} onChange={(e) => setData('kode_barang', e.target.value)} error={errors.kode_barang} placeholder="KB-001" />
                    </div>
                    <Input label="Product" value={data.product} onChange={(e) => setData('product', e.target.value)} error={errors.product} placeholder="Product name" />
                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Spesifikasi</label>
                        <textarea
                            value={data.spesifikasi}
                            onChange={(e) => setData('spesifikasi', e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder="Product specifications..."
                        />
                        {errors.spesifikasi && <p className="text-xs text-red-400 mt-1">{errors.spesifikasi}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Notes</label>
                        <textarea
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder="Additional notes..."
                        />
                        {errors.notes && <p className="text-xs text-red-400 mt-1">{errors.notes}</p>}
                    </div>

                    {/* QTY / SRP / M1 row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input
                            label="QTY (empty = infinite)"
                            type="number" min={0}
                            value={data.qty}
                            onChange={(e) => setData('qty', e.target.value)}
                            error={errors.qty}
                            placeholder="∞"
                        />

                        {/* M1 — changing this auto-fills SRP */}
                        <div>
                            <label className="block text-sm font-medium text-navy-200 mb-1.5">M1 Harga (Rp)</label>
                            <input
                                type="number"
                                step="1"
                                min="0"
                                value={data.m1}
                                onChange={(e) => handleM1Change(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="e.g. 1500000"
                                className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-600 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            />
                            {errors.m1 && <p className="text-xs text-red-400 mt-1">{errors.m1}</p>}
                        </div>

                        {/* SRP — shows Auto badge when auto-filled */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-sm font-medium text-navy-200">SRP (Rp)</label>
                                {srpIsAuto && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gold-500/15 text-gold-400 border border-gold-500/30">
                                        <Zap className="w-2.5 h-2.5" /> Auto
                                    </span>
                                )}
                            </div>
                            <input
                                type="number"
                                step="1"
                                min="0"
                                value={data.srp}
                                onChange={(e) => handleSrpChange(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="e.g. 1192500"
                                className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-600 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            />
                            {errors.srp && <p className="text-xs text-red-400 mt-1">{errors.srp}</p>}
                            {srpIsAuto && (
                                <p className="text-[10px] text-navy-500 mt-1">
                                    Formula: {formulaLabel(srpFormula.type, srpFormula.value)}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : (editItem ? 'Update' : 'Create')}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* ── SRP Formula settings modal ── */}
            <Modal show={showFormulaModal} onClose={() => setShowFormulaModal(false)} title="SRP Formula Settings" maxWidth="max-w-md">
                <form onSubmit={handleSaveFormula} className="space-y-5">
                    {/* Formula type */}
                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-2">Formula Type</label>
                        <div className="space-y-2">
                            {[
                                { value: 'subtract_percent', label: 'Subtract Percentage', example: 'SRP = M1 − X%' },
                                { value: 'add_percent',      label: 'Add Percentage',      example: 'SRP = M1 + X%' },
                                { value: 'multiply',         label: 'Multiply by Factor',  example: 'SRP = M1 × factor' },
                                { value: 'divide',           label: 'Divide by Factor',    example: 'SRP = M1 ÷ factor' },
                                { value: 'subtract_fixed',   label: 'Subtract Fixed (Rp)', example: 'SRP = M1 − fixed amount' },
                            ].map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                        formula.type === opt.value
                                            ? 'border-gold-500/50 bg-gold-500/8'
                                            : 'border-white/8 hover:border-white/15'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="formula_type"
                                        value={opt.value}
                                        checked={formula.type === opt.value}
                                        onChange={() => setFormula(f => ({ ...f, type: opt.value }))}
                                        className="mt-0.5 accent-gold-500"
                                    />
                                    <div>
                                        <p className="text-sm text-white font-medium">{opt.label}</p>
                                        <p className="text-xs text-navy-400 font-mono mt-0.5">{opt.example}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Formula value */}
                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">
                            {['subtract_percent', 'add_percent'].includes(formula.type) ? 'Percentage (%)' :
                             formula.type === 'subtract_fixed' ? 'Fixed Amount (Rp)' : 'Factor'}
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formula.value}
                            onChange={(e) => setFormula(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder={['subtract_percent', 'add_percent'].includes(formula.type) ? '20.5' : '0.795'}
                        />
                        <p className="text-xs text-navy-500 mt-1">{formulaDescription(formula.type)}</p>
                    </div>

                    {/* Live preview */}
                    <div className="p-4 bg-navy-800/40 border border-white/5 rounded-xl">
                        <p className="text-xs text-navy-400 mb-2 font-medium uppercase tracking-wider">Live Preview</p>
                        <div className="flex items-center justify-between">
                            <div className="text-center">
                                <p className="text-xs text-navy-500 mb-1">M1</p>
                                <p className="text-sm font-semibold text-gold-400">{formatCurrency(previewM1)}</p>
                            </div>
                            <div className="text-gold-500 font-bold text-lg">→</div>
                            <div className="text-center">
                                <p className="text-xs text-navy-500 mb-1">SRP</p>
                                <p className="text-sm font-semibold text-emerald-400">{formatCurrency(previewSrp)}</p>
                            </div>
                        </div>
                        <p className="text-center text-xs text-navy-500 mt-2 font-mono">{formulaLabel(formula.type, formula.value)}</p>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <Button type="submit" disabled={savingFormula}>
                            <Wand2 className="w-4 h-4" />
                            {savingFormula ? 'Saving...' : 'Save Formula'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowFormulaModal(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* ── Import XLSX modal ── */}
            <Modal show={showImportModal} onClose={() => setShowImportModal(false)} title="Import Inventory from XLSX" maxWidth="max-w-md">
                <form onSubmit={handleImport} className="space-y-4">
                    <div className="p-4 bg-navy-800/50 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                            <p className="text-sm text-white font-medium">Excel File Format</p>
                        </div>
                        <p className="text-xs text-navy-300 mb-2">
                            Your XLSX file should have these column headers:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {['sku_no', 'product', 'kode_barang', 'spesifikasi', 'notes', 'qty', 'srp', 'm1'].map((col) => (
                                <span key={col} className="px-2 py-0.5 bg-navy-700 rounded text-xs font-mono text-gold-400">{col}</span>
                            ))}
                        </div>
                        <p className="text-xs text-navy-400 mt-2">
                            Existing items (matched by SKU NO) will be updated. Leave QTY empty for infinite stock.
                        </p>
                        {/* Formula reminder in import modal */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                            <Zap className="w-3 h-3 text-gold-400 shrink-0" />
                            <p className="text-[11px] text-navy-400">
                                If <span className="font-mono text-gold-400">srp</span> is blank or 0, it will be auto-calculated using the current formula: <span className="text-gold-300 font-semibold">{formulaLabel(srpFormula.type, srpFormula.value)}</span>
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Select File</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => setImportFile(e.target.files[0] || null)}
                            className="w-full text-sm text-navy-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gold-500/10 file:text-gold-400 hover:file:bg-gold-500/20 file:cursor-pointer"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={importing || !importFile}>
                            <Upload className="w-4 h-4" />
                            {importing ? 'Importing...' : 'Import'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowImportModal(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* ── Remove All modal ── */}
            <Modal show={showRemoveAllModal} onClose={() => setShowRemoveAllModal(false)} title="Remove All Inventory" maxWidth="max-w-sm">
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-red-300 font-medium">This action cannot be undone.</p>
                            <p className="text-xs text-red-400/70 mt-1">
                                All {inventories.total ?? inventories.data?.length ?? 0} inventory items will be permanently deleted.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button onClick={handleRemoveAll} disabled={removingAll} className="!bg-red-600 hover:!bg-red-700">
                            <Trash2 className="w-4 h-4" />
                            {removingAll ? 'Removing...' : 'Yes, Remove All'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowRemoveAllModal(false)}>Cancel</Button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
