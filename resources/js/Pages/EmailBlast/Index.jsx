import { router, useForm, usePage } from '@inertiajs/react';
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
import { Send, Eye, Trash2, Mail, Users, Filter, Info, FileText, Save, X, UserCheck, Search as SearchIcon, Layout, Paperclip, MailOpen, CopyPlus, FlaskConical, AtSign, Plus, Pencil, Loader2, Globe } from 'lucide-react';
import { useState, useRef } from 'react';

const BLANK_ACCOUNT = {
    name: '', email: '', from_name: '', smtp_host: 'smtp.hostinger.com',
    smtp_port: 465, encryption: 'ssl', password: '', shared: false,
};

/* ── SMTP account manager ("Kelola Akun") ─────────────────────────────────── */
function AccountsModal({ show, onClose, isAdmin, onChanged }) {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(null);      // null = list view, object = form view
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState(null);
    const [message, setMessage] = useState(null); // { ok, text }

    const csrf = typeof document !== 'undefined'
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') : '';

    const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json', ...csrfHeaders() };

    const refresh = async () => {
        setLoading(true);
        try {
            const res = await fetch('/email-accounts', { headers: { Accept: 'application/json' } });
            setAccounts(await res.json());
        } catch {}
        setLoading(false);
    };

    // Load the list every time the modal opens.
    const wasShown = useRef(false);
    if (show && !wasShown.current) { wasShown.current = true; refresh(); }
    if (!show && wasShown.current) { wasShown.current = false; }

    const openCreate = () => { setForm({ ...BLANK_ACCOUNT }); setEditingId(null); setMessage(null); };
    const openEdit = (a) => {
        setForm({
            name: a.name, email: a.email, from_name: a.from_name || '',
            smtp_host: a.smtp_host, smtp_port: a.smtp_port, encryption: a.encryption,
            password: '', shared: a.user_id === null,
        });
        setEditingId(a.id);
        setMessage(null);
    };

    const save = async () => {
        setSaving(true); setMessage(null);
        try {
            const res = await fetch(editingId ? `/email-accounts/${editingId}` : '/email-accounts', {
                method: editingId ? 'PUT' : 'POST',
                headers: jsonHeaders,
                body: JSON.stringify(form),
            });
            const json = await res.json().catch(() => ({}));
            const firstError = json.errors ? Object.values(json.errors)[0]?.[0] : null;
            if (res.ok) {
                setForm(null); setEditingId(null);
                setMessage({ ok: true, text: json.message });
                refresh(); onChanged();
            } else {
                setMessage({ ok: false, text: firstError || json.message || 'Gagal menyimpan akun.' });
            }
        } catch {
            setMessage({ ok: false, text: 'Kesalahan jaringan.' });
        }
        setSaving(false);
    };

    const remove = async (a) => {
        if (!confirm(`Hapus akun "${a.name}"? Riwayat blast tetap tersimpan.`)) return;
        await fetch(`/email-accounts/${a.id}`, { method: 'DELETE', headers: jsonHeaders });
        refresh(); onChanged();
    };

    const test = async (a) => {
        setTestingId(a.id); setMessage(null);
        try {
            const res = await fetch(`/email-accounts/${a.id}/test`, { method: 'POST', headers: jsonHeaders, body: '{}' });
            const json = await res.json().catch(() => ({}));
            setMessage({ ok: res.ok, text: json.message || 'Gagal menguji akun.' });
        } catch {
            setMessage({ ok: false, text: 'Kesalahan jaringan.' });
        }
        setTestingId(null);
    };

    const inputCls = 'w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30';
    const labelCls = 'block text-xs font-medium text-navy-300 mb-1';

    return (
        <Modal show={show} onClose={onClose} title="Akun Email Pengirim" maxWidth="max-w-xl">
            <div className="space-y-4">
                <p className="text-xs text-navy-400 leading-relaxed">
                    Setiap user dapat menambahkan akun SMTP miliknya sendiri; admin dapat membuat akun
                    bersama yang bisa dipakai semua user. Password disimpan terenkripsi dan tidak pernah
                    dikirim kembali ke halaman ini.
                </p>

                {message && (
                    <div className={`px-3 py-2 rounded-lg text-xs border ${message.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}

                {form ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>Label</label>
                                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='mis. "Sales Utama"' /></div>
                            <div><label className={labelCls}>Nama Pengirim (default)</label>
                                <input className={inputCls} value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} placeholder="mis. PT Maju Jaya" /></div>
                        </div>
                        <div><label className={labelCls}>Alamat Email (login SMTP)</label>
                            <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="sales@perusahaan.com" /></div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1"><label className={labelCls}>SMTP Host</label>
                                <input className={inputCls} value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} /></div>
                            <div><label className={labelCls}>Port</label>
                                <input className={inputCls} type="number" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: e.target.value })} /></div>
                            <div><label className={labelCls}>Enkripsi</label>
                                <select className={inputCls} value={form.encryption} onChange={(e) => setForm({ ...form, encryption: e.target.value })}>
                                    <option value="ssl">SSL (465)</option>
                                    <option value="tls">TLS (587)</option>
                                </select></div>
                        </div>
                        <div><label className={labelCls}>{editingId ? 'Password (kosongkan jika tidak diganti)' : 'Password'}</label>
                            <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></div>
                        {isAdmin && (
                            <label className="flex items-center gap-2 text-xs text-navy-200 cursor-pointer">
                                <input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })}
                                    className="rounded border-white/20 bg-navy-800 text-gold-500 focus:ring-gold-500/30" />
                                Akun bersama — semua user dapat mengirim dari akun ini
                            </label>
                        )}
                        <div className="flex justify-end gap-2 pt-1">
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setForm(null); setEditingId(null); }}>Batal</Button>
                            <Button type="button" size="sm" onClick={save} disabled={saving}>
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {editingId ? 'Simpan' : 'Tambah Akun'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {loading ? (
                            <p className="text-sm text-navy-400 text-center py-6">Memuat akun...</p>
                        ) : accounts.length === 0 ? (
                            <div className="text-center py-6">
                                <AtSign className="w-8 h-8 text-navy-600 mx-auto mb-2" />
                                <p className="text-sm text-navy-400">Belum ada akun — blast memakai email default sistem.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {accounts.map((a) => (
                                    <div key={a.id} className="flex items-center gap-3 p-3 bg-navy-800/40 border border-white/5 rounded-xl">
                                        <div className="w-8 h-8 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center shrink-0">
                                            <AtSign className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                                                {a.user_id === null ? (
                                                    <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20"><Globe className="w-3 h-3 mr-1" />Bersama</Badge>
                                                ) : (
                                                    <Badge className="bg-white/5 text-navy-300 border-white/10">{a.owner}</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-navy-400 truncate">{a.email} · {a.smtp_host}:{a.smtp_port}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => test(a)} disabled={testingId !== null} title="Kirim email test via akun ini"
                                                className="p-1.5 rounded-lg text-navy-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-40">
                                                {testingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                                            </button>
                                            {a.editable && (
                                                <>
                                                    <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => remove(a)} className="p-1.5 rounded-lg text-navy-400 hover:text-red-400 hover:bg-red-500/10 transition">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Button type="button" size="sm" variant="secondary" onClick={openCreate}>
                            <Plus className="w-3.5 h-3.5" /> Tambah Akun
                        </Button>
                    </>
                )}
            </div>
        </Modal>
    );
}

export default function Index({ blasts, provinces, emailAccounts, defaultFrom }) {
    const { auth } = usePage().props;
    const isAdmin = auth?.user?.role === 'admin';
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [showAccountsModal, setShowAccountsModal] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
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

    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState(null); // { sent, failed, remaining, total }

    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        subject: '',
        body: '',
        sender_name: '',
        email_account_id: '',
        target: 'all',
        filters: { province: '', grade: '' },
        channel_ids: [],
        attachments: [],
    });

    const fileInputRef = useRef(null);

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleFilesSelected = (e) => {
        const newFiles = Array.from(e.target.files || []);
        if (newFiles.length === 0) return;
        setData('attachments', [...(data.attachments || []), ...newFiles].slice(0, 3));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index) => {
        setData('attachments', (data.attachments || []).filter((_, i) => i !== index));
    };

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
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...csrfHeaders() },
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
            headers: { 'Accept': 'application/json', ...csrfHeaders() },
        });
        fetchTemplates();
    };

    const fetchChannels = async () => {
        setLoadingChannels(true);
        try {
            const res = await fetch('/email-blast/preview', {
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
        (ch.email && ch.email.toLowerCase().includes(channelSearch.toLowerCase()))
    );

    const openCompose = () => {
        reset();
        setPreview(null);
        setChannelSearch('');
        fetchTemplates();
        setShowComposeModal(true);
    };

    // Prefill the compose form from a past blast ("use again"). Attachments
    // aren't carried over — files must be re-selected.
    const reuseBlast = (blast) => {
        reset();
        setPreview(null);
        setChannelSearch('');
        fetchTemplates();
        setData((prev) => ({
            ...prev,
            title: blast.title,
            subject: blast.subject,
            body: blast.body || '',
            sender_name: blast.sender_name || '',
            // Carry the account over only if it still exists and is visible.
            email_account_id: (emailAccounts || []).some((a) => a.id === blast.email_account_id)
                ? blast.email_account_id
                : '',
        }));
        setShowComposeModal(true);
    };

    // Send the current draft to one inbox (default: your own) to check the
    // real rendering before blasting everyone.
    const handleTestSend = async () => {
        const email = prompt('Kirim email test ke:', auth?.user?.email || '');
        if (!email) return;
        setSendingTest(true);
        try {
            const res = await fetch('/email-blast/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...csrfHeaders() },
                body: JSON.stringify({ email, subject: data.subject, body: data.body, sender_name: data.sender_name, email_account_id: data.email_account_id || null }),
            });
            const json = await res.json().catch(() => ({}));
            const firstError = json.errors ? Object.values(json.errors)[0]?.[0] : null;
            alert(res.ok ? json.message : (firstError || json.message || 'Gagal mengirim email test.'));
        } catch {
            alert('Kesalahan jaringan saat mengirim email test.');
        }
        setSendingTest(false);
    };

    const handlePreview = async () => {
        setLoadingPreview(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const res = await fetch('/email-blast/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...csrfHeaders() },
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
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...csrfHeaders() },
                body: JSON.stringify({ body: data.body }),
            });
            const json = await res.json();
            setEmailPreviewHtml(json.html || '');
            setShowEmailPreview(true);
        } catch {}
        setLoadingEmailPreview(false);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!confirm(`Kirim email ke ${preview?.count || '?'} channel?`)) return;

        setSending(true);
        setProgress(null);

        try {
            // Step 1 — prepare the blast (stores attachments + pending recipients)
            const fd = new FormData();
            fd.append('title', data.title);
            fd.append('subject', data.subject);
            fd.append('body', data.body);
            fd.append('sender_name', data.sender_name || '');
            fd.append('email_account_id', data.email_account_id || '');
            fd.append('target', data.target);
            fd.append('filters[province]', data.filters.province || '');
            fd.append('filters[grade]', data.filters.grade || '');
            (data.channel_ids || []).forEach((id) => fd.append('channel_ids[]', id));
            (data.attachments || []).forEach((file) => fd.append('attachments[]', file));

            const res = await fetch('/email-blast/send', {
                method: 'POST',
                headers: { ...csrfHeaders(), Accept: 'application/json' },
                body: fd,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const firstError = err.errors ? Object.values(err.errors)[0]?.[0] : null;
                alert(firstError || err.message || 'Gagal memulai email blast.');
                setSending(false);
                return;
            }

            const { blast_id, total } = await res.json();
            setProgress({ sent: 0, failed: 0, remaining: total, total });

            // Step 2 — process batches until none remain
            let done = false;
            while (!done) {
                const bres = await fetch(`/email-blast/${blast_id}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...csrfHeaders(), Accept: 'application/json' },
                    body: JSON.stringify({ size: 25 }),
                });

                if (!bres.ok) {
                    alert('Sebagian batch gagal diproses. Blast dihentikan — sisa penerima belum terkirim.');
                    break;
                }

                const p = await bres.json();
                setProgress({ sent: p.sent, failed: p.failed, remaining: p.remaining, total: p.total });
                done = p.done;
            }

            setSending(false);
            setShowComposeModal(false);
            setProgress(null);
            setPreview(null);
            reset();
            router.reload();
        } catch {
            alert('Terjadi kesalahan jaringan saat mengirim. Cek riwayat blast untuk status terkini.');
            setSending(false);
        }
    };

    const statusBadge = (status) => ({
        draft: 'bg-navy-700 text-navy-200',
        sending: 'bg-yellow-500/20 text-yellow-400',
        completed: 'bg-emerald-500/20 text-emerald-400',
        failed: 'bg-red-500/20 text-red-400',
    }[status] || '');

    return (
        <AuthenticatedLayout title="Email Blast">
            <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
                <p className="text-sm text-navy-400">Kirim email ke channel</p>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setShowAccountsModal(true)}>
                        <AtSign className="w-4 h-4" /> Akun Email
                        {(emailAccounts || []).length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-gold-500/20 text-gold-300 text-[10px] font-bold">{emailAccounts.length}</span>
                        )}
                    </Button>
                    <Button onClick={openCompose}>
                        <Mail className="w-4 h-4" /> Compose Email
                    </Button>
                </div>
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
                            <Th>Dibuka</Th>
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
                                <Td className="text-xs">
                                    {blast.user?.name}
                                    {blast.email_account && (
                                        <span className="block text-[10px] text-navy-500">via {blast.email_account.email}</span>
                                    )}
                                </Td>
                                <Td><span className="text-white font-medium">{blast.total_recipients}</span></Td>
                                <Td><span className="text-emerald-400 font-medium">{blast.sent_count}</span></Td>
                                <Td><span className="text-red-400 font-medium">{blast.failed_count}</span></Td>
                                <Td>
                                    <span className="flex items-center gap-1 text-sky-400 font-medium">
                                        <MailOpen className="w-3 h-3" />
                                        {blast.opened_count ?? 0}
                                        {blast.sent_count > 0 && (
                                            <span className="text-[10px] text-navy-500">({Math.round(((blast.opened_count ?? 0) / blast.sent_count) * 100)}%)</span>
                                        )}
                                    </span>
                                </Td>
                                <Td>
                                    <Badge className={statusBadge(blast.status)}>{blast.status}</Badge>
                                    {blast.pending_count > 0 && (
                                        <button onClick={() => router.get(`/email-blast/${blast.id}`)}
                                            className="block mt-1 text-[10px] text-gold-400 hover:text-gold-300 transition">
                                            {blast.pending_count} tertunda — lanjutkan →
                                        </button>
                                    )}
                                </Td>
                                <Td className="text-xs">{formatDate(blast.created_at)}</Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => router.get(`/email-blast/${blast.id}`)}
                                            className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => reuseBlast(blast)} title="Gunakan lagi sebagai draft baru"
                                            className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-gold-400 transition">
                                            <CopyPlus className="w-4 h-4" />
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
                                <Td colSpan={10} className="text-center py-8">
                                    <Mail className="w-8 h-8 text-navy-600 mx-auto mb-2" />
                                    <p className="text-navy-400">No email blast history yet</p>
                                </Td>
                            </Tr>
                        )}
                    </Tbody>
                </Table>
                <Pagination links={blasts.links} />
            </Card>

            <AccountsModal
                show={showAccountsModal}
                onClose={() => setShowAccountsModal(false)}
                isAdmin={isAdmin}
                onChanged={() => router.reload({ only: ['emailAccounts'] })}
            />

            <Modal show={showComposeModal} onClose={() => setShowComposeModal(false)} title="Compose Email Blast" maxWidth="max-w-2xl">
                <form onSubmit={handleSend} className="space-y-4">
                    <Input label="Blast Title (internal)" value={data.title} onChange={(e) => setData('title', e.target.value)} error={errors.title} placeholder="e.g. Promo Mei 2026" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Kirim Dari"
                            value={data.email_account_id}
                            onChange={(e) => setData('email_account_id', e.target.value)}
                            options={[
                                { value: '', label: `Default sistem (${defaultFrom})` },
                                ...(emailAccounts || []).map((a) => ({ value: a.id, label: `${a.name} — ${a.email}` })),
                            ]}
                        />
                        <Input label="Sender Name" value={data.sender_name} onChange={(e) => setData('sender_name', e.target.value)} error={errors.sender_name} placeholder="Default: nama akun pengirim" />
                    </div>
                    <Input label="Email Subject" value={data.subject} onChange={(e) => setData('subject', e.target.value)} error={errors.subject} placeholder="e.g. Penawaran Spesial" />

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
                                {data.body.trim() && data.subject.trim() && (
                                    <button type="button" onClick={handleTestSend} disabled={sendingTest}
                                        title="Kirim draft ini ke satu alamat (tanpa lampiran) untuk cek tampilan asli di inbox"
                                        className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition disabled:opacity-50">
                                        <FlaskConical className="w-3.5 h-3.5" />
                                        {sendingTest ? 'Mengirim...' : 'Kirim Test'}
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

                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Lampiran (opsional)</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {(data.attachments || []).map((file, i) => (
                                <div key={i} className="flex items-center gap-2 bg-navy-800/50 border border-white/10 rounded-lg pl-3 pr-1.5 py-1.5">
                                    <Paperclip className="w-3.5 h-3.5 text-navy-400 shrink-0" />
                                    <span className="text-xs text-navy-200 truncate max-w-[160px]">{file.name}</span>
                                    <span className="text-[10px] text-navy-500 shrink-0">{formatFileSize(file.size)}</span>
                                    <button type="button" onClick={() => removeAttachment(i)}
                                        className="p-1 text-navy-500 hover:text-red-400 hover:bg-red-500/10 rounded transition">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {(data.attachments || []).length < 3 && (
                            <label className="inline-flex items-center gap-2 px-3 py-2 bg-navy-800/50 border border-dashed border-white/15 rounded-lg text-xs text-navy-300 hover:bg-white/5 hover:border-gold-500/30 cursor-pointer transition">
                                <Paperclip className="w-3.5 h-3.5" />
                                Tambah File
                                <input ref={fileInputRef} type="file" multiple className="hidden"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip,.csv,.txt"
                                    onChange={handleFilesSelected} />
                            </label>
                        )}
                        <p className="text-[11px] text-navy-500 mt-1">Maks. 3 file, masing-masing 5 MB. Dilampirkan ke setiap email.</p>
                        {errors.attachments && <p className="text-xs text-red-400 mt-1">{errors.attachments}</p>}
                        {errors['attachments.0'] && <p className="text-xs text-red-400 mt-1">{errors['attachments.0']}</p>}
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

                    {progress && (
                        <div className="p-3 bg-navy-800/50 rounded-xl border border-white/5 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-navy-300">
                                    Mengirim... <span className="text-emerald-400 font-medium">{progress.sent} terkirim</span>
                                    {progress.failed > 0 && <span className="text-red-400 font-medium"> · {progress.failed} gagal</span>}
                                </span>
                                <span className="text-navy-400">{progress.sent + progress.failed} / {progress.total}</span>
                            </div>
                            <div className="h-2 w-full bg-navy-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gold-500 transition-all duration-300"
                                    style={{ width: `${progress.total ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0}%` }} />
                            </div>
                            <p className="text-[11px] text-navy-500">Jangan tutup jendela ini sampai pengiriman selesai.</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={sending || !preview || preview.count === 0}>
                            <Send className="w-4 h-4" />
                            {sending
                                ? (progress ? `Mengirim ${progress.sent + progress.failed}/${progress.total}...` : 'Menyiapkan...')
                                : `Kirim ke ${preview?.count || 0} Channel`}
                        </Button>
                        <Button type="button" variant="secondary" disabled={sending} onClick={() => setShowComposeModal(false)}>Cancel</Button>
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
