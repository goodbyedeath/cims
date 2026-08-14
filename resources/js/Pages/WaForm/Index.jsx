import { useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Badge from '@/Components/ui/Badge';
import Select from '@/Components/ui/Select';
import Modal from '@/Components/ui/Modal';
import {
    ListChecks, Plus, Pencil, Trash2, Send, X, Info,
    MousePointerClick, List as ListIcon, ShoppingBag, Boxes, Workflow,
} from 'lucide-react';

const TYPES = [
    { value: 'button', label: 'Tombol', icon: MousePointerClick },
    { value: 'list', label: 'Daftar', icon: ListIcon },
    { value: 'product', label: 'Produk', icon: ShoppingBag },
    { value: 'product_list', label: 'Multi-Produk', icon: Boxes },
    { value: 'flow', label: 'Flow', icon: Workflow },
];

const TYPE_BADGE = {
    button:       ['Tombol', 'bg-gold-500/10 text-gold-300 border-gold-500/20'],
    list:         ['Daftar', 'bg-purple-500/10 text-purple-300 border-purple-500/20'],
    product:      ['Produk', 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'],
    product_list: ['Multi-Produk', 'bg-sky-500/10 text-sky-300 border-sky-500/20'],
    flow:         ['Flow', 'bg-pink-500/10 text-pink-300 border-pink-500/20'],
};

const emptyButton = () => ({ text: '' });
const emptyRow = () => ({ title: '', description: '' });
const emptySection = () => ({ title: '', rows: [emptyRow()] });
const emptyProduct = () => ({ product_retailer_id: '' });
const emptyProductSection = () => ({ title: '', products: [emptyProduct()] });

const baseForm = () => ({
    title: '', type: 'button', header: '', body: '', footer: '',
    button_label: 'Pilih', items: [emptyButton(), emptyButton()], config: {}, is_active: true,
});

const itemsForType = (type) => {
    if (type === 'button') return [emptyButton(), emptyButton()];
    if (type === 'list') return [emptySection()];
    if (type === 'product_list') return [emptyProductSection()];
    return []; // product, flow store everything in config
};

const configForType = (type) => {
    if (type === 'product') return { catalog_id: '', product_retailer_id: '' };
    if (type === 'product_list') return { catalog_id: '' };
    if (type === 'flow') return { flow_id: '', flow_cta: 'Buka', flow_action: 'navigate', flow_screen: '', flow_token: '' };
    return {};
};

export default function WaFormIndex({ forms, configured, interactive }) {
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [testFor, setTestFor] = useState(null);
    const [testPhone, setTestPhone] = useState('');

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm(baseForm());

    const openCreate = () => { reset(); clearErrors(); setData(baseForm()); setEditingId(null); setShowModal(true); };

    const openEdit = (form) => {
        clearErrors();
        setData({
            title: form.title, type: form.type, header: form.header ?? '', body: form.body,
            footer: form.footer ?? '', button_label: form.button_label ?? 'Pilih',
            items: form.items ?? itemsForType(form.type),
            config: form.config ?? configForType(form.type),
            is_active: form.is_active,
        });
        setEditingId(form.id);
        setShowModal(true);
    };

    const changeType = (type) => setData((d) => ({ ...d, type, items: itemsForType(type), config: configForType(type) }));
    const setCfg = (key, val) => setData('config', { ...data.config, [key]: val });

    // ── button helpers ──
    const setButtonText = (i, val) => setData('items', data.items.map((it, idx) => idx === i ? { ...it, text: val } : it));
    const addButton = () => data.items.length < 3 && setData('items', [...data.items, emptyButton()]);
    const removeButton = (i) => setData('items', data.items.filter((_, idx) => idx !== i));

    // ── list helpers ──
    const setSectionTitle = (s, val) => setData('items', data.items.map((sec, idx) => idx === s ? { ...sec, title: val } : sec));
    const addSection = (factory) => setData('items', [...data.items, factory()]);
    const removeSection = (s) => setData('items', data.items.filter((_, idx) => idx !== s));
    const setRow = (s, r, key, val) => setData('items', data.items.map((sec, si) => si !== s ? sec : {
        ...sec, rows: sec.rows.map((row, ri) => ri === r ? { ...row, [key]: val } : row),
    }));
    const addRow = (s) => setData('items', data.items.map((sec, si) => si === s ? { ...sec, rows: [...sec.rows, emptyRow()] } : sec));
    const removeRow = (s, r) => setData('items', data.items.map((sec, si) => si === s ? { ...sec, rows: sec.rows.filter((_, ri) => ri !== r) } : sec));

    // ── product_list helpers ──
    const setProduct = (s, p, val) => setData('items', data.items.map((sec, si) => si !== s ? sec : {
        ...sec, products: sec.products.map((pr, pi) => pi === p ? { product_retailer_id: val } : pr),
    }));
    const addProduct = (s) => setData('items', data.items.map((sec, si) => si === s ? { ...sec, products: [...sec.products, emptyProduct()] } : sec));
    const removeProduct = (s, p) => setData('items', data.items.map((sec, si) => si === s ? { ...sec, products: sec.products.filter((_, pi) => pi !== p) } : sec));

    const submit = (e) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: () => setShowModal(false) };
        if (editingId) put(`/wa-forms/${editingId}`, opts);
        else post('/wa-forms', opts);
    };

    const remove = (form) => { if (confirm(`Hapus form "${form.title}"?`)) router.delete(`/wa-forms/${form.id}`, { preserveScroll: true }); };

    const sendTest = (e) => {
        e.preventDefault();
        router.post(`/wa-forms/${testFor.id}/test`, { phone: testPhone }, {
            preserveScroll: true, onSuccess: () => { setTestFor(null); setTestPhone(''); },
        });
    };

    const itemErr = () => Object.keys(errors).find((k) => k.startsWith('items'));
    const cfgErr = (key) => errors[`config.${key}`];

    return (
        <AuthenticatedLayout title="WhatsApp Forms">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400"><ListChecks className="w-5 h-5" /></div>
                <div>
                    <h1 className="text-xl font-bold text-white">WhatsApp Forms</h1>
                    <p className="text-sm text-navy-400">Pesan interaktif: tombol, daftar, produk, multi-produk, dan flow.</p>
                </div>
                <Button onClick={openCreate} className="ml-auto"><Plus className="w-4 h-4" /> Buat Form</Button>
            </div>

            <Card className="mb-6 border-sky-500/20 bg-sky-500/5">
                <div className="flex items-start gap-2 text-xs text-navy-300">
                    <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>
                        {interactive
                            ? 'Mode interaktif aktif: dikirim sebagai pesan native WhatsApp; otomatis fallback ke menu teks bila gateway menolak.'
                            : 'Saat ini fallback menu teks (berfungsi di semua akun). Set WABLAS_INTERACTIVE=true untuk pesan native.'}
                        {' '}Produk butuh katalog WhatsApp Business; Flow butuh Flow yang dipublikasi di Meta. Balasan pelanggan dicocokkan oleh aturan di WA Chatbot.
                    </span>
                </div>
            </Card>

            {forms.length === 0 ? (
                <Card className="py-12 text-center text-navy-400 text-sm">
                    Belum ada form. Klik <strong>Buat Form</strong> untuk membuat pesan interaktif pertama.
                </Card>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {forms.map((form) => {
                        const [label, cls] = TYPE_BADGE[form.type] ?? [form.type, 'bg-navy-700/40 text-navy-300 border-white/10'];
                        return (
                            <Card key={form.id} className="flex flex-col">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="text-sm font-semibold text-white">{form.title}</h3>
                                    <Badge className={cls}>{label}</Badge>
                                </div>
                                {form.header && <p className="text-xs font-semibold text-navy-200">{form.header}</p>}
                                <p className="text-xs text-navy-400 line-clamp-3 mt-1 flex-1">{form.body}</p>
                                <div className="flex items-center gap-2 mt-3 text-[11px] text-navy-500">
                                    <Badge className={form.is_active ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-navy-700/40 text-navy-400 border-white/10'}>
                                        {form.is_active ? 'Aktif' : 'Nonaktif'}
                                    </Badge>
                                    <span>· dipakai {form.rules_count} aturan</span>
                                </div>
                                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
                                    <Button variant="secondary" size="sm" onClick={() => setTestFor(form)} disabled={!configured}><Send className="w-3.5 h-3.5" /> Test</Button>
                                    <button onClick={() => openEdit(form)} className="ml-auto p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => remove(form)} className="p-1.5 rounded-lg text-navy-400 hover:text-red-400 hover:bg-white/5 transition"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Builder modal */}
            <Modal show={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Form' : 'Buat Form'} maxWidth="max-w-2xl">
                <form onSubmit={submit} className="space-y-4">
                    <Input label="Judul (internal)" value={data.title} onChange={(e) => setData('title', e.target.value)} error={errors.title} placeholder="Menu utama" />

                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-navy-200">Tipe pesan</label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                            {TYPES.map((t) => {
                                const Icon = t.icon;
                                const active = data.type === t.value;
                                return (
                                    <button key={t.value} type="button" onClick={() => changeType(t.value)}
                                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs border transition ${active ? 'bg-gold-500/15 text-gold-300 border-gold-500/30' : 'text-navy-300 border-white/10 hover:text-white'}`}>
                                        <Icon className="w-4 h-4" /> {t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <Input label="Header (opsional)" value={data.header} onChange={(e) => setData('header', e.target.value)} error={errors.header} maxLength={60} placeholder="Selamat datang di CIMS" />

                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-navy-200">Body</label>
                        <textarea value={data.body} onChange={(e) => setData('body', e.target.value)} rows={3}
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder="Silakan pilih layanan yang Anda butuhkan:" />
                        {errors.body && <p className="text-xs text-red-400">{errors.body}</p>}
                    </div>

                    {/* ── Reply Buttons ── */}
                    {data.type === 'button' && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-navy-200">Tombol (maks 3)</label>
                            {data.items.map((btn, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs text-navy-500 w-5">{i + 1}.</span>
                                    <input value={btn.text} onChange={(e) => setButtonText(i, e.target.value)} maxLength={20}
                                        className="flex-1 px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                        placeholder={`Teks tombol ${i + 1}`} />
                                    {data.items.length > 1 && <button type="button" onClick={() => removeButton(i)} className="p-1.5 text-navy-400 hover:text-red-400"><X className="w-4 h-4" /></button>}
                                </div>
                            ))}
                            {itemErr() && <p className="text-xs text-red-400">Setiap tombol wajib diisi (maks 3).</p>}
                            {data.items.length < 3 && <button type="button" onClick={addButton} className="text-xs text-gold-400 hover:text-gold-300 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Tambah tombol</button>}
                        </div>
                    )}

                    {/* ── List ── */}
                    {data.type === 'list' && (
                        <div className="space-y-3">
                            <Input label="Label tombol pembuka daftar" value={data.button_label} onChange={(e) => setData('button_label', e.target.value)} error={errors.button_label} maxLength={24} placeholder="Lihat pilihan" />
                            {data.items.map((sec, s) => (
                                <div key={s} className="p-3 rounded-lg border border-white/10 bg-navy-800/30 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input value={sec.title} onChange={(e) => setSectionTitle(s, e.target.value)} maxLength={24}
                                            className="flex-1 px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                            placeholder={`Judul bagian ${s + 1}`} />
                                        {data.items.length > 1 && <button type="button" onClick={() => removeSection(s)} className="p-1.5 text-navy-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                                    </div>
                                    {sec.rows.map((row, r) => (
                                        <div key={r} className="flex items-center gap-2 pl-3">
                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                <input value={row.title} onChange={(e) => setRow(s, r, 'title', e.target.value)} maxLength={24}
                                                    className="px-3 py-1.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-gold-500/30" placeholder="Judul item" />
                                                <input value={row.description} onChange={(e) => setRow(s, r, 'description', e.target.value)} maxLength={72}
                                                    className="px-3 py-1.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-gold-500/30" placeholder="Deskripsi (opsional)" />
                                            </div>
                                            {sec.rows.length > 1 && <button type="button" onClick={() => removeRow(s, r)} className="p-1 text-navy-400 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => addRow(s)} className="text-[11px] text-gold-400 hover:text-gold-300 inline-flex items-center gap-1 pl-3"><Plus className="w-3 h-3" /> Tambah item</button>
                                </div>
                            ))}
                            {itemErr() && <p className="text-xs text-red-400">Lengkapi judul bagian dan minimal satu item.</p>}
                            <button type="button" onClick={() => addSection(emptySection)} className="text-xs text-gold-400 hover:text-gold-300 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Tambah bagian</button>
                        </div>
                    )}

                    {/* ── Single Product ── */}
                    {data.type === 'product' && (
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Catalog ID" value={data.config.catalog_id ?? ''} onChange={(e) => setCfg('catalog_id', e.target.value)} error={cfgErr('catalog_id')} placeholder="ID katalog WA Business" />
                            <Input label="Product Retailer ID" value={data.config.product_retailer_id ?? ''} onChange={(e) => setCfg('product_retailer_id', e.target.value)} error={cfgErr('product_retailer_id')} placeholder="SKU / retailer id" />
                            <p className="col-span-2 text-[11px] text-navy-500">ID produk diambil dari katalog WhatsApp Business Anda (Meta Commerce Manager).</p>
                        </div>
                    )}

                    {/* ── Multi-Product ── */}
                    {data.type === 'product_list' && (
                        <div className="space-y-3">
                            <Input label="Catalog ID" value={data.config.catalog_id ?? ''} onChange={(e) => setCfg('catalog_id', e.target.value)} error={cfgErr('catalog_id')} placeholder="ID katalog WA Business" />
                            {data.items.map((sec, s) => (
                                <div key={s} className="p-3 rounded-lg border border-white/10 bg-navy-800/30 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input value={sec.title} onChange={(e) => setSectionTitle(s, e.target.value)} maxLength={24}
                                            className="flex-1 px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                            placeholder={`Judul bagian ${s + 1}`} />
                                        {data.items.length > 1 && <button type="button" onClick={() => removeSection(s)} className="p-1.5 text-navy-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                                    </div>
                                    {sec.products.map((p, pi) => (
                                        <div key={pi} className="flex items-center gap-2 pl-3">
                                            <input value={p.product_retailer_id} onChange={(e) => setProduct(s, pi, e.target.value)} maxLength={100}
                                                className="flex-1 px-3 py-1.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-gold-500/30" placeholder="Product retailer id" />
                                            {sec.products.length > 1 && <button type="button" onClick={() => removeProduct(s, pi)} className="p-1 text-navy-400 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => addProduct(s)} className="text-[11px] text-gold-400 hover:text-gold-300 inline-flex items-center gap-1 pl-3"><Plus className="w-3 h-3" /> Tambah produk</button>
                                </div>
                            ))}
                            {itemErr() && <p className="text-xs text-red-400">Lengkapi judul bagian dan minimal satu produk.</p>}
                            <button type="button" onClick={() => addSection(emptyProductSection)} className="text-xs text-gold-400 hover:text-gold-300 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Tambah bagian</button>
                        </div>
                    )}

                    {/* ── Flow ── */}
                    {data.type === 'flow' && (
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Flow ID" value={data.config.flow_id ?? ''} onChange={(e) => setCfg('flow_id', e.target.value)} error={cfgErr('flow_id')} placeholder="ID Flow dari Meta" />
                            <Input label="Tombol CTA" value={data.config.flow_cta ?? ''} onChange={(e) => setCfg('flow_cta', e.target.value)} error={cfgErr('flow_cta')} maxLength={20} placeholder="Isi Formulir" />
                            <Select label="Aksi" value={data.config.flow_action ?? 'navigate'} onChange={(e) => setCfg('flow_action', e.target.value)} error={cfgErr('flow_action')}
                                options={[{ value: 'navigate', label: 'navigate (buka layar)' }, { value: 'data_exchange', label: 'data_exchange' }]} />
                            <Input label="Layar awal (opsional)" value={data.config.flow_screen ?? ''} onChange={(e) => setCfg('flow_screen', e.target.value)} error={cfgErr('flow_screen')} placeholder="WELCOME" />
                            <p className="col-span-2 text-[11px] text-navy-500">Flow harus sudah dipublikasi di Meta Flow Builder. Token dibuat otomatis bila kosong.</p>
                        </div>
                    )}

                    <Input label="Footer (opsional)" value={data.footer} onChange={(e) => setData('footer', e.target.value)} error={errors.footer} maxLength={60} placeholder="CIMS · componentsales.space" />

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} className="accent-gold-500" />
                        <span className="text-sm text-navy-200">Aktif</span>
                    </label>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Batal</Button>
                        <Button type="submit" disabled={processing}>{editingId ? 'Simpan' : 'Buat'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Send test modal */}
            <Modal show={!!testFor} onClose={() => setTestFor(null)} title={`Kirim test: ${testFor?.title ?? ''}`}>
                <form onSubmit={sendTest} className="space-y-4">
                    <Input label="Nomor WhatsApp tujuan" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="0812xxxxxxxx" />
                    <p className="text-[11px] text-navy-500">Format 08xx atau 62xx. Dikirim native bila didukung, atau sebagai menu teks.</p>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={() => setTestFor(null)}>Batal</Button>
                        <Button type="submit" disabled={!testPhone.trim()}><Send className="w-4 h-4" /> Kirim</Button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
