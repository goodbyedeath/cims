import { useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Modal from '@/Components/ui/Modal';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatDate } from '@/Lib/utils';
import {
    Bot, Plus, Pencil, Trash2, MessageSquare, Inbox, Zap, CheckCircle,
    Copy, Check, AlertTriangle, Link2, ListChecks,
} from 'lucide-react';

const MATCH_LABELS = {
    exact: 'Exact match',
    contains: 'Contains',
    starts_with: 'Starts with',
    default: 'Catch-all (default)',
};

function StatCard({ icon: Icon, label, value, tone }) {
    return (
        <Card className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${tone}`}><Icon className="w-5 h-5" /></div>
            <div>
                <p className="text-xl font-bold text-white leading-none">{value}</p>
                <p className="text-xs text-navy-400 mt-1">{label}</p>
            </div>
        </Card>
    );
}

const EMPTY = {
    name: '', match_type: 'contains', keyword: '', reply_type: 'text',
    reply_message: '', wa_form_id: '', priority: 0, is_active: true,
};

export default function WaBotIndex({ rules, inbound, forms, configured, webhook_url, has_secret, stats }) {
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [copied, setCopied] = useState(false);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({ ...EMPTY });

    const openCreate = () => {
        reset(); clearErrors(); setData({ ...EMPTY }); setEditingId(null); setShowModal(true);
    };

    const openEdit = (rule) => {
        clearErrors();
        setData({
            name: rule.name,
            match_type: rule.match_type,
            keyword: rule.keyword ?? '',
            reply_type: rule.reply_type,
            reply_message: rule.reply_message ?? '',
            wa_form_id: rule.wa_form_id ?? '',
            priority: rule.priority,
            is_active: rule.is_active,
        });
        setEditingId(rule.id);
        setShowModal(true);
    };

    const submit = (e) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: () => setShowModal(false) };
        if (editingId) put(`/wa-bot/rules/${editingId}`, opts);
        else post('/wa-bot/rules', opts);
    };

    const remove = (rule) => {
        if (confirm(`Hapus aturan "${rule.name}"?`)) {
            router.delete(`/wa-bot/rules/${rule.id}`, { preserveScroll: true });
        }
    };

    const toggleActive = (rule) => {
        router.put(`/wa-bot/rules/${rule.id}`, {
            name: rule.name, match_type: rule.match_type, keyword: rule.keyword,
            reply_type: rule.reply_type, reply_message: rule.reply_message,
            wa_form_id: rule.wa_form_id, priority: rule.priority, is_active: !rule.is_active,
        }, { preserveScroll: true });
    };

    const copyWebhook = async () => {
        try { await navigator.clipboard.writeText(webhook_url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
    };

    return (
        <AuthenticatedLayout title="WhatsApp Chatbot">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><Bot className="w-5 h-5" /></div>
                <div>
                    <h1 className="text-xl font-bold text-white">WhatsApp Chatbot</h1>
                    <p className="text-sm text-navy-400">Auto-reply ke pesan masuk berdasarkan kata kunci.</p>
                </div>
                <Button onClick={openCreate} className="ml-auto"><Plus className="w-4 h-4" /> Tambah Aturan</Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <StatCard icon={ListChecks} label="Total aturan" value={stats.rules} tone="bg-gold-500/10 text-gold-400" />
                <StatCard icon={Zap} label="Aturan aktif" value={stats.active_rules} tone="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={Inbox} label="Pesan masuk" value={stats.inbound} tone="bg-sky-500/10 text-sky-400" />
                <StatCard icon={CheckCircle} label="Auto-replied" value={stats.replied} tone="bg-purple-500/10 text-purple-400" />
            </div>

            {/* Webhook setup */}
            <Card className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Link2 className="w-4 h-4 text-gold-400" />
                    <h2 className="text-sm font-semibold text-white">Webhook setup</h2>
                </div>
                {!configured && (
                    <div className="flex items-start gap-2 mb-3 text-amber-300 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Wablas token belum dikonfigurasi (WABLAS_TOKEN). Bot tidak bisa membalas sampai diisi.</span>
                    </div>
                )}
                {has_secret ? (
                    <>
                        <p className="text-xs text-navy-400 mb-2">
                            Tempel URL ini ke menu <strong className="text-navy-200">Incoming Webhook</strong> di dashboard Wablas:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 rounded-lg bg-navy-950/70 border border-white/10 text-xs text-emerald-300 font-mono break-all">
                                {webhook_url}
                            </code>
                            <Button variant="secondary" size="sm" onClick={copyWebhook}>
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Tersalin' : 'Salin'}
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex items-start gap-2 text-amber-300 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>WABLAS_SECRET belum diisi. Webhook butuh secret untuk verifikasi keamanan.</span>
                    </div>
                )}
            </Card>

            {/* Rules table */}
            <Card className="p-0 overflow-hidden mb-6">
                <div className="px-5 py-4 border-b border-white/5">
                    <h2 className="text-sm font-semibold text-white">Aturan auto-reply</h2>
                </div>
                {rules.length === 0 ? (
                    <div className="py-12 text-center text-navy-400 text-sm">
                        Belum ada aturan. Klik <strong>Tambah Aturan</strong> untuk membuat balasan otomatis.
                    </div>
                ) : (
                    <Table>
                        <Thead>
                            <Tr><Th>Nama</Th><Th>Pencocokan</Th><Th>Balasan</Th><Th>Prioritas</Th><Th>Hits</Th><Th>Status</Th><Th></Th></Tr>
                        </Thead>
                        <Tbody>
                            {rules.map((rule) => (
                                <Tr key={rule.id}>
                                    <Td className="font-medium text-white">{rule.name}</Td>
                                    <Td>
                                        <Badge className="bg-navy-700/40 text-navy-200 border-white/10">{MATCH_LABELS[rule.match_type]}</Badge>
                                        {rule.match_type !== 'default' && rule.keyword && (
                                            <p className="text-[11px] text-navy-400 mt-1 font-mono">{rule.keyword}</p>
                                        )}
                                    </Td>
                                    <Td>
                                        {rule.reply_type === 'form' ? (
                                            <Badge className="bg-sky-500/10 text-sky-300 border-sky-500/20">
                                                <ListChecks className="w-3 h-3 mr-1" /> Form: {rule.form?.title ?? '—'}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-navy-300 line-clamp-2 max-w-xs">{rule.reply_message}</span>
                                        )}
                                    </Td>
                                    <Td className="text-navy-300">{rule.priority}</Td>
                                    <Td className="text-navy-300">{rule.hit_count}</Td>
                                    <Td>
                                        <button onClick={() => toggleActive(rule)} className="cursor-pointer">
                                            <Badge className={rule.is_active
                                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                                : 'bg-navy-700/40 text-navy-400 border-white/10'}>
                                                {rule.is_active ? 'Aktif' : 'Nonaktif'}
                                            </Badge>
                                        </button>
                                    </Td>
                                    <Td>
                                        <div className="flex items-center gap-1 justify-end">
                                            <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => remove(rule)} className="p-1.5 rounded-lg text-navy-400 hover:text-red-400 hover:bg-white/5 transition"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </Card>

            {/* Inbox */}
            <Card className="p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-sky-400" />
                    <h2 className="text-sm font-semibold text-white">Pesan masuk terbaru</h2>
                </div>
                {inbound.length === 0 ? (
                    <div className="py-12 text-center text-navy-400 text-sm">Belum ada pesan masuk.</div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {inbound.map((msg) => (
                            <div key={msg.id} className="px-5 py-3 flex items-start gap-3">
                                <MessageSquare className="w-4 h-4 text-navy-500 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-white">{msg.channel?.company_name ?? msg.phone}</span>
                                        <span className="text-[11px] text-navy-500 font-mono">{msg.phone}</span>
                                        {msg.rule ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">→ {msg.rule.name}</Badge>
                                        ) : (
                                            <Badge className="bg-navy-700/40 text-navy-400 border-white/10">tidak cocok</Badge>
                                        )}
                                        {msg.reply_sent ? (
                                            <Badge className="bg-sky-500/10 text-sky-300 border-sky-500/20">terbalas</Badge>
                                        ) : msg.matched_rule_id ? (
                                            <Badge className="bg-red-500/10 text-red-300 border-red-500/20">gagal balas</Badge>
                                        ) : null}
                                    </div>
                                    <p className="text-sm text-navy-300 mt-0.5 break-words">{msg.message}</p>
                                    {msg.reply_error && <p className="text-[11px] text-red-400 mt-0.5">err: {msg.reply_error}</p>}
                                </div>
                                <span className="text-[11px] text-navy-500 shrink-0">{formatDate(msg.created_at)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Create / edit modal */}
            <Modal show={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Aturan' : 'Tambah Aturan'}>
                <form onSubmit={submit} className="space-y-4">
                    <Input label="Nama aturan" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} placeholder="mis. Tanya harga" />

                    <Select
                        label="Tipe pencocokan"
                        value={data.match_type}
                        onChange={(e) => setData('match_type', e.target.value)}
                        error={errors.match_type}
                        options={Object.entries(MATCH_LABELS).map(([value, label]) => ({ value, label }))}
                    />

                    {data.match_type !== 'default' && (
                        <Input
                            label="Kata kunci (pisahkan dengan koma)"
                            value={data.keyword}
                            onChange={(e) => setData('keyword', e.target.value)}
                            error={errors.keyword}
                            placeholder="harga, price, berapa"
                        />
                    )}

                    <Select
                        label="Jenis balasan"
                        value={data.reply_type}
                        onChange={(e) => setData('reply_type', e.target.value)}
                        error={errors.reply_type}
                        options={[{ value: 'text', label: 'Teks' }, { value: 'form', label: 'WhatsApp Form' }]}
                    />

                    {data.reply_type === 'text' ? (
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-navy-200">Pesan balasan</label>
                            <textarea
                                value={data.reply_message}
                                onChange={(e) => setData('reply_message', e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                placeholder="Halo {company_name}, terima kasih sudah menghubungi kami…"
                            />
                            {errors.reply_message && <p className="text-xs text-red-400">{errors.reply_message}</p>}
                            <p className="text-[11px] text-navy-500">Placeholder: {'{company_name}'}, {'{owner_name}'}</p>
                        </div>
                    ) : (
                        <Select
                            label="Pilih form"
                            value={data.wa_form_id}
                            onChange={(e) => setData('wa_form_id', e.target.value)}
                            error={errors.wa_form_id}
                            placeholder={forms.length ? 'Pilih form…' : 'Belum ada form aktif'}
                            options={forms.map((f) => ({ value: f.id, label: `${f.title} (${f.type})` }))}
                        />
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Prioritas" type="number" min={0} max={1000} value={data.priority} onChange={(e) => setData('priority', e.target.value)} error={errors.priority} />
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-navy-200">Status</label>
                            <label className="flex items-center gap-2 px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg cursor-pointer">
                                <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} className="accent-gold-500" />
                                <span className="text-sm text-navy-200">{data.is_active ? 'Aktif' : 'Nonaktif'}</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Batal</Button>
                        <Button type="submit" disabled={processing}>{editingId ? 'Simpan' : 'Tambah'}</Button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
