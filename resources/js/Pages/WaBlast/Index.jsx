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
import { formatDate, csrfHeaders } from '@/Lib/utils';
import { Send, Eye, Trash2, MessageSquare, Users, Filter, CheckCircle, XCircle, Info, FileText, Save, Plus, X, UserCheck, Search as SearchIcon, Smartphone, AlertTriangle, Type, Image as ImageIcon, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Index({ blasts, provinces, blastDevice }) {
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

    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        message: '',
        target: 'all',
        filters: { province: '', grade: '' },
        channel_ids: [],
        drip_enabled: false,
        scheduled_at: '',
        blast_file_id: null,
        message_type: 'text',
        media_url: '',
        location_lat: '',
        location_lng: '',
    });

    const [fileExpiry, setFileExpiry] = useState(6);
    const [uploading, setUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadError, setUploadError] = useState('');

    const uploadFile = async (file) => {
        if (!file) return;
        setUploading(true); setUploadError('');
        try {
            const body = new FormData();
            body.append('file', file);
            body.append('expiry_hours', String(fileExpiry));
            const res = await fetch('/wa-blast/upload-file', {
                method: 'POST',
                headers: { Accept: 'application/json', ...csrfHeaders() },
                body,
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                setUploadError(json.errors?.file?.[0] || json.message || 'Upload gagal.');
            } else {
                setUploadedFile(json);
                setData('blast_file_id', json.id);
                if (!data.message.includes('{file}')) setData('message', (data.message ? data.message + '\n' : '') + '{file}');
            }
        } catch {
            setUploadError('Upload gagal — coba lagi.');
        }
        setUploading(false);
    };

    const removeFile = () => { setUploadedFile(null); setData('blast_file_id', null); setUploadError(''); };

    const csrfToken = typeof document !== 'undefined' ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') : '';

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/blast-templates?type=wa', { headers: { 'Accept': 'application/json' } });
            setTemplates(await res.json());
        } catch {}
    };

    const loadTemplate = (tpl) => {
        setData((prev) => ({ ...prev, message: tpl.body }));
    };

    const saveAsTemplate = async () => {
        if (!templateName.trim() || !data.message.trim()) return;
        setSavingTemplate(true);
        try {
            await fetch('/blast-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...csrfHeaders() },
                body: JSON.stringify({ name: templateName, type: 'wa', body: data.message }),
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
            headers: { 'Accept': 'application/json', ...csrfHeaders() },
        });
        fetchTemplates();
    };

    const fetchChannels = async () => {
        setLoadingChannels(true);
        try {
            const res = await fetch('/wa-blast/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...csrfHeaders() },
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
        (ch.phone && ch.phone.includes(channelSearch))
    );

    const openCompose = () => {
        reset();
        setPreview(null);
        setChannelSearch('');
        setUploadedFile(null);
        setUploadError('');
        fetchTemplates();
        setShowComposeModal(true);
    };

    const handlePreview = async () => {
        setLoadingPreview(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const res = await fetch('/wa-blast/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...csrfHeaders(),
                },
                body: JSON.stringify({
                    target: data.target,
                    filters: data.filters,
                    channel_ids: data.channel_ids,
                }),
            });
            const json = await res.json();
            setPreview(json);
        } catch (err) {
            setPreview({ count: 0, channels: [] });
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!confirm(`Kirim pesan ke ${preview?.count || '?'} channel? Proses ini tidak bisa dibatalkan.`)) return;
        post('/wa-blast/send', {
            onSuccess: () => {
                setShowComposeModal(false);
                setPreview(null);
            },
        });
    };

    const dev = blastDevice || {};
    const hasQuota = dev.quota != null && dev.quota_remaining != null;
    const quotaPct = hasQuota && dev.quota > 0
        ? Math.max(0, Math.min(100, Math.round((dev.quota_remaining / dev.quota) * 100)))
        : 0;
    const quotaColor = quotaPct > 30 ? 'bg-emerald-500' : quotaPct > 10 ? 'bg-amber-500' : 'bg-red-500';

    const statusBadge = (status) => {
        const map = {
            draft: 'bg-navy-700 text-navy-200',
            queued: 'bg-sky-500/20 text-sky-400',
            scheduled: 'bg-indigo-500/20 text-indigo-300',
            sending: 'bg-yellow-500/20 text-yellow-400',
            cancelling: 'bg-orange-500/20 text-orange-400',
            completed: 'bg-emerald-500/20 text-emerald-400',
            failed: 'bg-red-500/20 text-red-400',
            cancelled: 'bg-navy-600 text-navy-300',
        };
        return map[status] || '';
    };

    return (
        <AuthenticatedLayout title="WhatsApp Blast">
            <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-navy-400">Kirim pesan WhatsApp ke channel</p>
                <Button onClick={openCompose}>
                    <Send className="w-4 h-4" /> Compose Blast
                </Button>
            </div>

            {/* Blast device status + monthly quota (live from the gateway) */}
            {dev.configured && (
                <Card animate={false} className="mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dev.connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                <Smartphone className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">{dev.name}</p>
                                <p className={`text-xs font-medium ${dev.connected ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {dev.reachable ? (dev.connected ? 'Terhubung' : `Terputus (${dev.status})`) : 'Gateway tidak merespons'}
                                </p>
                            </div>
                        </div>
                        {hasQuota && (
                            <div className="min-w-[200px]">
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-navy-300">Kuota bulan ini</span>
                                    <span className="font-semibold text-white tabular-nums">{dev.quota_remaining} / {dev.quota}</span>
                                </div>
                                <div className="h-2 rounded-full bg-navy-800 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${quotaColor}`} style={{ width: `${quotaPct}%` }} />
                                </div>
                                {dev.quota_resets && <p className="text-[11px] text-navy-500 mt-1">Reset {dev.quota_resets}</p>}
                            </div>
                        )}
                    </div>
                    {dev.reachable && !dev.connected && (
                        <div className="flex items-start gap-2 mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-300">Device terputus — blast akan ditolak sampai tersambung. Buka <b>WA Devices</b>, scan QR, lalu ulangi.</p>
                        </div>
                    )}
                </Card>
            )}

            {/* Blast History */}
            <Card animate={false}>
                <h3 className="text-lg font-semibold text-white mb-4">Blast History</h3>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Title</Th>
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
                                <Td className="text-xs">{blast.user?.name}</Td>
                                <Td>
                                    <span className="text-white font-medium">{blast.total_recipients}</span>
                                </Td>
                                <Td>
                                    <span className="text-emerald-400 font-medium">{blast.sent_count}</span>
                                </Td>
                                <Td>
                                    <span className="text-red-400 font-medium">{blast.failed_count}</span>
                                </Td>
                                <Td>
                                    <Badge className={statusBadge(blast.status)}>{blast.status}</Badge>
                                </Td>
                                <Td className="text-xs">{formatDate(blast.created_at)}</Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => router.get(`/wa-blast/${blast.id}`)}
                                            className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('Delete this blast history?')) router.delete(`/wa-blast/${blast.id}`, { preserveScroll: true }); }}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Td>
                            </Tr>
                        )) : (
                            <Tr>
                                <Td colSpan={8} className="text-center py-8">
                                    <MessageSquare className="w-8 h-8 text-navy-600 mx-auto mb-2" />
                                    <p className="text-navy-400">No blast history yet</p>
                                </Td>
                            </Tr>
                        )}
                    </Tbody>
                </Table>
                <Pagination links={blasts.links} />
            </Card>

            {/* Compose Modal */}
            <Modal show={showComposeModal} onClose={() => setShowComposeModal(false)} title="Compose WhatsApp Blast" maxWidth="max-w-2xl">
                <form onSubmit={handleSend} className="space-y-4">
                    <Input
                        label="Blast Title"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        error={errors.title}
                        placeholder="e.g. Promo Mei 2026"
                    />

                    {/* Target Selection */}
                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Target Recipients</label>
                        <div className="flex gap-2">
                            {[
                                { value: 'all', label: 'All Channels', icon: Users },
                                { value: 'filtered', label: 'By Filter', icon: Filter },
                                { value: 'selected', label: 'Select Channels', icon: UserCheck },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        setData('target', opt.value);
                                        setPreview(null);
                                        if (opt.value === 'selected' && allChannels.length === 0) fetchChannels();
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                        data.target === opt.value
                                            ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                                            : 'bg-navy-800/50 text-navy-300 border border-white/5 hover:bg-white/5'
                                    }`}
                                >
                                    <opt.icon className="w-4 h-4" />
                                    {opt.label}
                                    {opt.value === 'selected' && (data.channel_ids || []).length > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 bg-gold-500/30 rounded text-[10px]">{(data.channel_ids || []).length}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filters (when filtered) */}
                    {data.target === 'filtered' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-navy-800/30 rounded-xl border border-white/5">
                            <Select
                                label="Province"
                                value={data.filters.province}
                                onChange={(e) => { setData('filters', { ...data.filters, province: e.target.value }); setPreview(null); }}
                                placeholder="All Provinces"
                                options={provinces.map((p) => ({ value: p, label: p }))}
                            />
                            <Select
                                label="Grade"
                                value={data.filters.grade}
                                onChange={(e) => { setData('filters', { ...data.filters, grade: e.target.value }); setPreview(null); }}
                                placeholder="All Grades"
                                options={[
                                    { value: 'platinum', label: 'Platinum' },
                                    { value: 'gold', label: 'Gold' },
                                    { value: 'silver', label: 'Silver' },
                                    { value: 'bronze', label: 'Bronze' },
                                    { value: 'risk', label: 'Risk' },
                                ]}
                            />
                        </div>
                    )}

                    {/* Channel Picker (when selected) */}
                    {data.target === 'selected' && (
                        <div className="p-4 bg-navy-800/30 rounded-xl border border-white/5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                                    <input
                                        type="text"
                                        value={channelSearch}
                                        onChange={(e) => setChannelSearch(e.target.value)}
                                        placeholder="Cari channel..."
                                        className="w-full pl-9 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                    />
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
                                            <input
                                                type="checkbox"
                                                checked={(data.channel_ids || []).includes(ch.id)}
                                                onChange={() => toggleChannel(ch.id)}
                                                className="w-4 h-4 rounded border-white/20 bg-navy-800 text-gold-500 focus:ring-gold-500/30"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white truncate">{ch.company_name}</p>
                                                <p className="text-xs text-navy-400">{ch.channel_code} - {ch.phone}</p>
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

                    {/* Message type */}
                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Jenis Pesan</label>
                        <div className="flex gap-2">
                            {[
                                { value: 'text', label: 'Teks', icon: Type },
                                { value: 'image', label: 'Gambar', icon: ImageIcon },
                                { value: 'location', label: 'Lokasi', icon: MapPin },
                            ].map((opt) => (
                                <button key={opt.value} type="button"
                                    onClick={() => setData('message_type', opt.value)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                        data.message_type === opt.value
                                            ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                                            : 'bg-navy-800/50 text-navy-300 border border-white/5 hover:bg-white/5'
                                    }`}>
                                    <opt.icon className="w-4 h-4" /> {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Image URL */}
                    {data.message_type === 'image' && (
                        <div>
                            <label className="block text-sm font-medium text-navy-200 mb-1.5">URL Gambar</label>
                            <Input value={data.media_url} onChange={(e) => setData('media_url', e.target.value)}
                                placeholder="https://…/promo.jpg" error={errors.media_url} />
                            <p className="text-[11px] text-navy-500 mt-1">Tautan gambar publik (jpg/png). Pesan di bawah jadi caption.</p>
                        </div>
                    )}

                    {/* Location */}
                    {data.message_type === 'location' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-navy-200 mb-1.5">Latitude</label>
                                <Input value={data.location_lat} onChange={(e) => setData('location_lat', e.target.value)}
                                    placeholder="-6.2088" error={errors.location_lat} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-navy-200 mb-1.5">Longitude</label>
                                <Input value={data.location_lng} onChange={(e) => setData('location_lng', e.target.value)}
                                    placeholder="106.8456" error={errors.location_lng} />
                            </div>
                            <p className="col-span-2 text-[11px] text-navy-500 -mt-1">Pesan di bawah jadi label/alamat lokasi.</p>
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

                    {/* Message */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-medium text-navy-200">
                                {data.message_type === 'image' ? 'Caption' : data.message_type === 'location' ? 'Label / Alamat' : 'Message'}
                            </label>
                            {data.message.trim() && (
                                showSaveTemplate ? (
                                    <div className="flex items-center gap-1.5">
                                        <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                                            placeholder="Nama template..." className="px-2 py-1 bg-navy-800/50 border border-white/10 rounded text-xs text-white placeholder-navy-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 w-40" />
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
                        <textarea
                            value={data.message}
                            onChange={(e) => setData('message', e.target.value)}
                            rows={5}
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder="Tulis pesan WhatsApp di sini..."
                        />
                        {errors.message && <p className="text-xs text-red-400 mt-1">{errors.message}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="text-xs text-navy-400">Placeholders:</span>
                            {['{company_name}', '{owner_name}', '{owner_title}', '{owner_greeting}', '{channel_code}', '{file}'].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setData('message', data.message + p)}
                                    className="px-2 py-0.5 bg-navy-700 rounded text-xs font-mono text-gold-400 hover:bg-navy-600 transition"
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-navy-500 mt-1.5">
                            Variasi anti-ban: tulis <code className="text-gold-400">{'{halo|hai|selamat}'}</code> — tiap penerima dapat salah satu acak.
                        </p>
                    </div>

                    {/* Preview Button */}
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="secondary" onClick={handlePreview} disabled={loadingPreview}>
                            <Eye className="w-4 h-4" />
                            {loadingPreview ? 'Loading...' : 'Preview Recipients'}
                        </Button>
                        {preview && (
                            <span className="text-sm text-navy-300">
                                <span className="text-gold-400 font-bold">{preview.count}</span> channel akan menerima pesan
                                {preview.cooldown_skipped > 0 && (
                                    <span className="text-amber-400"> · {preview.cooldown_skipped} dilewati (cooldown {preview.cooldown_days} hari)</span>
                                )}
                            </span>
                        )}
                    </div>

                    {/* Preview List */}
                    {preview && preview.channels?.length > 0 && (
                        <div className="max-h-48 overflow-y-auto border border-white/5 rounded-lg">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="text-left px-3 py-2 text-xs text-navy-400">Channel</th>
                                        <th className="text-left px-3 py-2 text-xs text-navy-400">Phone</th>
                                        <th className="text-left px-3 py-2 text-xs text-navy-400">Province</th>
                                        <th className="text-left px-3 py-2 text-xs text-navy-400">Grade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.channels.map((ch) => (
                                        <tr key={ch.id} className="border-b border-white/5">
                                            <td className="px-3 py-1.5 text-white">{ch.channel_code} - {ch.company_name}</td>
                                            <td className="px-3 py-1.5 text-navy-300 font-mono text-xs">{ch.phone}</td>
                                            <td className="px-3 py-1.5 text-navy-300 text-xs">{ch.province || '-'}</td>
                                            <td className="px-3 py-1.5 text-xs capitalize text-navy-300">{ch.channel_grade || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Attachment (tracked download link, not a WA media send) */}
                    <div className="rounded-xl border border-white/10 bg-navy-800/40 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <label className="text-sm font-semibold text-white flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-gold-400" /> Lampiran File (opsional)
                            </label>
                            <select
                                value={fileExpiry}
                                onChange={(e) => setFileExpiry(Number(e.target.value))}
                                disabled={!!uploadedFile}
                                className="text-xs bg-navy-800/60 border border-white/10 rounded-lg px-2 py-1 text-navy-200 disabled:opacity-50"
                            >
                                <option value={1}>Kedaluwarsa 1 jam</option>
                                <option value={2}>2 jam</option>
                                <option value={6}>6 jam</option>
                                <option value={12}>12 jam</option>
                                <option value={24}>1 hari</option>
                                <option value={48}>2 hari</option>
                            </select>
                        </div>
                        {uploadedFile ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="text-sm text-white truncate flex-1">{uploadedFile.name}</span>
                                <span className="text-xs text-navy-400">{uploadedFile.size}</span>
                                <button type="button" onClick={removeFile} className="text-navy-400 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <label className={`flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-white/15 rounded-lg cursor-pointer text-sm text-navy-300 hover:bg-white/5 transition ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                {uploading ? 'Mengunggah…' : 'Pilih file (PDF, gambar, dokumen, zip · maks 20 MB)'}
                                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                                    onChange={(e) => uploadFile(e.target.files?.[0])} />
                            </label>
                        )}
                        {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
                        <p className="text-[11px] text-navy-500 mt-1.5">Dikirim sebagai tautan unduh unik per penerima (bisa dilacak siapa yang membuka). Sisipkan <code className="text-gold-400">{'{file}'}</code> di pesan.</p>
                    </div>

                    {/* Sending mode: drip + optional schedule */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setData('drip_enabled', !data.drip_enabled)}
                            className={`text-left rounded-xl border p-3 transition ${
                                data.drip_enabled
                                    ? 'border-gold-500/50 bg-gold-500/10'
                                    : 'border-white/10 bg-navy-800/40 hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-white">Mode Drip (anti-ban)</span>
                                <span className={`w-9 h-5 rounded-full transition relative ${data.drip_enabled ? 'bg-gold-500' : 'bg-navy-600'}`}>
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${data.drip_enabled ? 'left-4' : 'left-0.5'}`} />
                                </span>
                            </div>
                            <p className="text-[11px] text-navy-400 mt-1">
                                Bertahap Sen–Sab 08:00–17:00 WIB, jatah harian naik seiring umur nomor (1–4 mnt/pesan). Cocok untuk daftar besar / nomor baru.
                            </p>
                        </button>
                        <div className="rounded-xl border border-white/10 bg-navy-800/40 p-3">
                            <label className="block text-sm font-semibold text-white mb-1.5">Jadwalkan (opsional)</label>
                            <input
                                type="datetime-local"
                                value={data.scheduled_at}
                                onChange={(e) => setData('scheduled_at', e.target.value)}
                                className="w-full px-3 py-2 bg-navy-800/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            />
                            <p className="text-[11px] text-navy-400 mt-1">Kosongkan untuk kirim sekarang. Waktu server (WIB).</p>
                            {errors.scheduled_at && <p className="text-[11px] text-red-400 mt-1">{errors.scheduled_at}</p>}
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="flex items-start gap-3 p-3 bg-navy-800/50 rounded-xl border border-white/5">
                        <Info className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-navy-300">
                            Blast diproses di latar belakang lewat antrean — pesan dikirim satu per satu dengan jeda acak
                            5–45 detik (anti-ban), jadi bisa ditutup dan dipantau di halaman detail. Otomatis berhenti sejenak
                            bila device terputus (lanjut saat tersambung), dan berhenti bila 10 gagal berturut-turut. Channel
                            yang baru saja diblast dilewati (cooldown), begitu pula nomor tanpa telepon.
                        </p>
                    </div>

                    {/* Send */}
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={processing || !preview || preview.count === 0}>
                            <Send className="w-4 h-4" />
                            {processing
                                ? 'Memproses...'
                                : data.scheduled_at
                                    ? `Jadwalkan ke ${preview?.count || 0} Channel`
                                    : `Kirim ke ${preview?.count || 0} Channel`}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowComposeModal(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
