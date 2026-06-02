import { router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Modal from '@/Components/ui/Modal';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatDate } from '@/Lib/utils';
import { Send, Eye, Trash2, Mail, Users, Filter, Info, FileText, Save, X, UserCheck, Search as SearchIcon, Layout } from 'lucide-react';
import { useState, useRef } from 'react';

export default function Index({ blasts, provinces }) {
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [allChannels, setAllChannels] = useState([]);
    const [channelSearch, setChannelSearch] = useState('');
    const [loadingChannels, setLoadingChannels] = useState(false);
    const [showEmailPreview, setShowEmailPreview] = useState(false);
    const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
    const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);
    const iframeRef = useRef(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        subject: '',
        body: '',
        sender_name: '',
        target: 'all',
        filters: { province: '', grade: '' },
        channel_ids: [],
    });

    const csrfToken = typeof document !== 'undefined' ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') : '';

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/blast-templates?type=email', { headers: { 'Accept': 'application/json' } });
            setTemplates(await res.json());
        } catch {}
    };

    const loadTemplate = (tpl) => {
        setData((prev) => ({ ...prev, subject: tpl.subject || prev.subject, body: tpl.body }));
    };

    const saveAsTemplate = async () => {
        if (!templateName.trim() || !data.body.trim()) return;
        setSavingTemplate(true);
        try {
            await fetch('/blast-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                body: JSON.stringify({ name: templateName, type: 'email', subject: data.subject, body: data.body }),
            });
            setShowSaveTemplate(false);
            setTemplateName('');
            fetchTemplates();
        } catch {}
        setSavingTemplate(false);
    };

    const deleteTemplate = async (id) => {
        await fetch(`/blast-templates/${id}`, {
            method: 'DELETE',
            headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
        });
        fetchTemplates();
    };

    const fetchChannels = async () => {
        setLoadingChannels(true);
        try {
            const res = await fetch('/email-blast/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                body: JSON.stringify({ target: 'all' }),
            });
            const json = await res.json();
            setAllChannels(json.channels || []);
        } catch {}
        setLoadingChannels(false);
    };

    const toggleChannel = (id) => {
        setData((prev) => {
            const ids = prev.channel_ids || [];
            return { ...prev, channel_ids: ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id] };
        });
        setPreview(null);
    };

    const toggleAll = () => {
        const filtered = filteredChannels;
        const allSelected = filtered.every((ch) => (data.channel_ids || []).includes(ch.id));
        setData((prev) => ({
            ...prev,
            channel_ids: allSelected
                ? (prev.channel_ids || []).filter((id) => !filtered.find((ch) => ch.id === id))
                : [...new Set([...(prev.channel_ids || []), ...filtered.map((ch) => ch.id)])],
        }));
        setPreview(null);
    };

    const filteredChannels = allChannels.filter((ch) =>
        !channelSearch || ch.company_name.toLowerCase().includes(channelSearch.toLowerCase()) ||
        ch.channel_code.toLowerCase().includes(channelSearch.toLowerCase()) ||
        (ch.email && ch.email.toLowerCase().includes(channelSearch.toLowerCase()))
    );

    const openCompose = () => {
        reset();
        setPreview(null);
        setChannelSearch('');
        fetchTemplates();
        setShowComposeModal(true);
    };

    const handlePreview = async () => {
        setLoadingPreview(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const res = await fetch('/email-blast/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                body: JSON.stringify({ target: data.target, filters: data.filters, channel_ids: data.channel_ids }),
            });
            setPreview(await res.json());
        } catch {
            setPreview({ count: 0, channels: [] });
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleEmailPreview = async () => {
        if (!data.body.trim()) return;
        setLoadingEmailPreview(true);
        try {
            const res = await fetch('/email-blast/render-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                body: JSON.stringify({ body: data.body }),
            });
            const json = await res.json();
            setEmailPreviewHtml(json.html || '');
            setShowEmailPreview(true);
        } catch {}
        setLoadingEmailPreview(false);
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!confirm(`Kirim email ke ${preview?.count || '?'} channel?`)) return;
        post('/email-blast/send', {
            onSuccess: () => { setShowComposeModal(false); setPreview(null); },
        });
    };

    const statusBadge = (status) => ({
        draft: 'bg-navy-700 text-navy-200',
        sending: 'bg-yellow-500/20 text-yellow-400',
        completed: 'bg-emerald-500/20 text-emerald-400',
        failed: 'bg-red-500/20 text-red-400',
    }[status] || '');

    return (
        <AuthenticatedLayout title="Email Blast">
            <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-navy-400">Kirim email ke channel</p>
                <Button onClick={openCompose}>
                    <Mail className="w-4 h-4" /> Compose Email
                </Button>
            </div>

            <Card animate={false}>
                <h3 className="text-lg font-semibold text-white mb-4">Email History</h3>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Title</Th>
                            <Th>Subject</Th>
                            <Th>Sent By</Th>
                            <Th>Recipients</Th>
                            <Th>Sent</Th>
                            <Th>Failed</Th>
                            <Th>Status</Th>
                            <Th>Date</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {blasts.data?.length > 0 ? blasts.data.map((blast) => (
                            <Tr key={blast.id}>
                                <Td className="text-white font-medium">{blast.title}</Td>
                                <Td className="text-xs text-navy-300 max-w-xs truncate">{blast.subject}</Td>
                                <Td className="text-xs">{blast.user?.name}</Td>
                                <Td><span className="text-white font-medium">{blast.total_recipients}</span></Td>
                                <Td><span className="text-emerald-400 font-medium">{blast.sent_count}</span></Td>
                                <Td><span className="text-red-400 font-medium">{blast.failed_count}</span></Td>
                                <Td><Badge className={statusBadge(blast.status)}>{blast.status}</Badge></Td>
                                <Td className="text-xs">{formatDate(blast.created_at)}</Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => router.get(`/email-blast/${blast.id}`)}
                                            className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => { if (confirm('Delete?')) router.delete(`/email-blast/${blast.id}`, { preserveScroll: true }); }}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Td>
                            </Tr>
                        )) : (
                            <Tr>
                                <Td colSpan={9} className="text-center py-8">
                                    <Mail className="w-8 h-8 text-navy-600 mx-auto mb-2" />
                                    <p className="text-navy-400">No email blast history yet</p>
                                </Td>
                            </Tr>
                        )}
                    </Tbody>
                </Table>
                <Pagination links={blasts.links} />
            </Card>

            <Modal show={showComposeModal} onClose={() => setShowComposeModal(false)} title="Compose Email Blast" maxWidth="max-w-2xl">
                <form onSubmit={handleSend} className="space-y-4">
                    <Input label="Blast Title (internal)" value={data.title} onChange={(e) => setData('title', e.target.value)} error={errors.title} placeholder="e.g. Promo Mei 2026" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Sender Name" value={data.sender_name} onChange={(e) => setData('sender_name', e.target.value)} error={errors.sender_name} placeholder="e.g. PT Maju Jaya (default: CIMS)" />
                        <Input label="Email Subject" value={data.subject} onChange={(e) => setData('subject', e.target.value)} error={errors.subject} placeholder="e.g. Penawaran Spesial" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Target</label>
                        <div className="flex gap-2">
                            {[
                                { value: 'all', label: 'All Channels', icon: Users },
                                { value: 'filtered', label: 'By Filter', icon: Filter },
                                { value: 'selected', label: 'Select Channels', icon: UserCheck },
                            ].map((opt) => (
                                <button key={opt.value} type="button"
                                    onClick={() => {
                                        setData('target', opt.value);
                                        setPreview(null);
                                        if (opt.value === 'selected' && allChannels.length === 0) fetchChannels();
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                        data.target === opt.value
                                            ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                                            : 'bg-navy-800/50 text-navy-300 border border-white/5 hover:bg-white/5'
                                    }`}>
                                    <opt.icon className="w-4 h-4" />{opt.label}
                                    {opt.value === 'selected' && (data.channel_ids || []).length > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 bg-gold-500/30 rounded text-[10px]">{(data.channel_ids || []).length}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {data.target === 'filtered' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-navy-800/30 rounded-xl border border-white/5">
                            <Select label="Province" value={data.filters.province}
                                onChange={(e) => { setData('filters', { ...data.filters, province: e.target.value }); setPreview(null); }}
                                placeholder="All Provinces" options={provinces.map((p) => ({ value: p, label: p }))} />
                            <Select label="Grade" value={data.filters.grade}
                                onChange={(e) => { setData('filters', { ...data.filters, grade: e.target.value }); setPreview(null); }}
                                placeholder="All Grades" options={[
                                    { value: 'platinum', label: 'Platinum' }, { value: 'gold', label: 'Gold' },
                                    { value: 'silver', label: 'Silver' }, { value: 'risk', label: 'Risk' },
                                    { value: 'risk', label: 'Risk' },
                                ]} />
                        </div>
                    )}

                    {data.target === 'selected' && (
                        <div className="p-4 bg-navy-800/30 rounded-xl border border-white/5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                                    <input type="text" value={channelSearch} onChange={(e) => setChannelSearch(e.target.value)}
                                        placeholder="Cari channel..."
                                        className="w-full pl-9 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30" />
                                </div>
                                <button type="button" onClick={toggleAll}
                                    className="px-3 py-2 text-xs font-medium text-navy-300 bg-navy-800/50 border border-white/10 rounded-lg hover:bg-white/5 transition">
                                    {filteredChannels.length > 0 && filteredChannels.every((ch) => (data.channel_ids || []).includes(ch.id)) ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            {loadingChannels ? (
                                <p className="text-sm text-navy-400 text-center py-4">Loading channels...</p>
                            ) : (
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {filteredChannels.map((ch) => (
                                        <label key={ch.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition">
                                            <input type="checkbox" checked={(data.channel_ids || []).includes(ch.id)} onChange={() => toggleChannel(ch.id)}
                                                className="w-4 h-4 rounded border-white/20 bg-navy-800 text-gold-500 focus:ring-gold-500/30" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white truncate">{ch.company_name}</p>
                                                <p className="text-xs text-navy-400">{ch.channel_code} - {ch.email}</p>
                                            </div>
                                            <span className="text-xs text-navy-500 capitalize">{ch.channel_grade}</span>
                                        </label>
                                    ))}
                                    {filteredChannels.length === 0 && (
                                        <p className="text-sm text-navy-400 text-center py-4">Tidak ada channel ditemukan</p>
                                    )}
                                </div>
                            )}
                            {(data.channel_ids || []).length > 0 && (
                                <p className="text-xs text-gold-400">{(data.channel_ids || []).length} channel dipilih</p>
                            )}
                        </div>
                    )}

                    {/* Templates */}
                    {templates.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-navy-200 mb-1.5">Templates</label>
                            <div className="flex flex-wrap gap-2">
                                {templates.map((tpl) => (
                                    <div key={tpl.id} className="flex items-center gap-1 bg-navy-800/50 border border-white/10 rounded-lg overflow-hidden">
                                        <button type="button" onClick={() => loadTemplate(tpl)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy-200 hover:text-gold-400 hover:bg-white/5 transition">
                                            <FileText className="w-3.5 h-3.5" /> {tpl.name}
                                        </button>
                                        <button type="button" onClick={() => deleteTemplate(tpl.id)}
                                            className="px-1.5 py-1.5 text-navy-500 hover:text-red-400 hover:bg-red-500/10 transition">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        {/* Body label row */}
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-navy-200">Isi Email</label>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700 text-navy-400 font-medium">plain text</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Preview email template button */}
                                {data.body.trim() && (
                                    <button type="button" onClick={handleEmailPreview} disabled={loadingEmailPreview}
                                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition disabled:opacity-50">
                                        <Layout className="w-3.5 h-3.5" />
                                        {loadingEmailPreview ? 'Loading...' : 'Preview Template'}
                                    </button>
                                )}
                                {data.body.trim() && (
                                    showSaveTemplate ? (
                                        <div className="flex items-center gap-1.5">
                                            <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                                                placeholder="Nama template..." className="px-2 py-1 bg-navy-800/50 border border-white/10 rounded text-xs text-white placeholder-navy-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 w-36" />
                                            <button type="button" onClick={saveAsTemplate} disabled={savingTemplate}
                                                className="px-2 py-1 text-xs font-medium text-gold-400 bg-gold-500/10 rounded hover:bg-gold-500/20 transition disabled:opacity-50">
                                                {savingTemplate ? '...' : 'Save'}
                                            </button>
                                            <button type="button" onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}
                                                className="px-1.5 py-1 text-xs text-navy-400 hover:text-white transition">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={() => setShowSaveTemplate(true)}
                                            className="inline-flex items-center gap-1 text-xs text-navy-400 hover:text-gold-400 transition">
                                            <Save className="w-3.5 h-3.5" /> Save as Template
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Template info strip */}
                        <div className="flex items-start gap-2 mb-2 px-3 py-2 bg-sky-500/8 border border-sky-500/20 rounded-lg">
                            <Layout className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-sky-300/80">
                                Header (logo + nama perusahaan) dan footer (kontak + disclaimer) <strong>otomatis ditambahkan</strong>. Tulis hanya isi pesan.
                            </p>
                        </div>

                        <textarea value={data.body} onChange={(e) => setData('body', e.target.value)} rows={9}
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder={"Selamat siang {owner_title},\n\nKami dari {company_name} ingin menyampaikan penawaran terbaru kami...\n\nSilakan hubungi kami untuk info lebih lanjut.\n\nTerima kasih."} />
                        {errors.body && <p className="text-xs text-red-400 mt-1">{errors.body}</p>}

                        {/* Placeholder chips */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="text-xs text-navy-400">Placeholder:</span>
                            {['{company_name}', '{owner_name}', '{owner_title}', '{owner_greeting}', '{channel_code}'].map((p) => (
                                <button key={p} type="button" onClick={() => setData('body', data.body + p)}
                                    className="px-2 py-0.5 bg-navy-700 rounded text-xs font-mono text-gold-400 hover:bg-navy-600 transition">{p}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button type="button" variant="secondary" onClick={handlePreview} disabled={loadingPreview}>
                            <Eye className="w-4 h-4" />{loadingPreview ? 'Loading...' : 'Preview Recipients'}
                        </Button>
                        {preview && (
                            <span className="text-sm text-navy-300">
                                <span className="text-gold-400 font-bold">{preview.count}</span> channel akan menerima email
                            </span>
                        )}
                    </div>

                    {preview && preview.channels?.length > 0 && (
                        <div className="max-h-40 overflow-y-auto border border-white/5 rounded-lg">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-white/5">
                                    <th className="text-left px-3 py-2 text-xs text-navy-400">Channel</th>
                                    <th className="text-left px-3 py-2 text-xs text-navy-400">Email</th>
                                    <th className="text-left px-3 py-2 text-xs text-navy-400">Province</th>
                                </tr></thead>
                                <tbody>{preview.channels.map((ch) => (
                                    <tr key={ch.id} className="border-b border-white/5">
                                        <td className="px-3 py-1.5 text-white">{ch.channel_code} - {ch.company_name}</td>
                                        <td className="px-3 py-1.5 text-navy-300 text-xs">{ch.email}</td>
                                        <td className="px-3 py-1.5 text-navy-300 text-xs">{ch.province || '-'}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex items-start gap-3 p-3 bg-navy-800/50 rounded-xl border border-white/5">
                        <Info className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-navy-300">
                            Email dikirim via SMTP. Header &amp; footer template otomatis ditambahkan saat pengiriman.
                            Tulis isi pesan dalam plain text — baris baru tetap dipertahankan.
                            Channel tanpa email akan dilewati.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={processing || !preview || preview.count === 0}>
                            <Send className="w-4 h-4" />
                            {processing ? 'Mengirim...' : `Kirim ke ${preview?.count || 0} Channel`}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowComposeModal(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>
            {/* ── Email Template Preview modal ── */}
            {showEmailPreview && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => setShowEmailPreview(false)} />
                    <div className="relative z-10 w-full max-w-2xl bg-navy-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-2">
                                <Layout className="w-4 h-4 text-sky-400" />
                                <h3 className="text-sm font-semibold text-white">Preview Template Email</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <p className="text-xs text-navy-400">Contoh dengan penerima: <span className="text-navy-200">PT Contoh Mitra Jaya</span></p>
                                <button onClick={() => setShowEmailPreview(false)}
                                    className="p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden rounded-b-2xl">
                            <iframe
                                ref={iframeRef}
                                srcDoc={emailPreviewHtml}
                                title="Email Preview"
                                className="w-full h-full border-0"
                                style={{ minHeight: '520px' }}
                                sandbox="allow-same-origin"
                            />
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
