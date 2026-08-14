import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatDate, csrfHeaders } from '@/Lib/utils';
import {
    ArrowLeft, CheckCircle, XCircle, Clock, Mail, Paperclip, Download,
    MailOpen, Play, RotateCcw, Loader2,
} from 'lucide-react';

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Show({ blast }) {
    const [driving, setDriving] = useState(false);
    const [progress, setProgress] = useState(null);

    const csrfToken = typeof document !== 'undefined'
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') : '';

    const pendingCount = blast.recipients?.filter((r) => r.status === 'pending' || r.status === 'processing').length || 0;
    const openedCount = blast.recipients?.filter((r) => r.opened_at).length || 0;
    const openRate = blast.sent_count > 0 ? Math.round((openedCount / blast.sent_count) * 100) : 0;

    // Drive processBatch until done — same loop the compose modal uses. Lets a
    // blast interrupted mid-send (closed tab, network drop) be finished here.
    const driveBatches = async () => {
        setDriving(true);
        try {
            let done = false;
            while (!done) {
                const res = await fetch(`/email-blast/${blast.id}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...csrfHeaders(), Accept: 'application/json' },
                    body: JSON.stringify({ size: 25 }),
                });
                if (!res.ok) {
                    alert('Batch gagal diproses — coba lagi.');
                    break;
                }
                const p = await res.json();
                setProgress(p);
                done = p.done;
            }
        } catch {
            alert('Kesalahan jaringan saat memproses batch.');
        }
        setDriving(false);
        setProgress(null);
        router.reload();
    };

    const retryFailed = async () => {
        if (!confirm(`Kirim ulang ke ${blast.failed_count} penerima yang gagal?`)) return;
        setDriving(true);
        try {
            const res = await fetch(`/email-blast/${blast.id}/retry`, {
                method: 'POST',
                headers: { ...csrfHeaders(), Accept: 'application/json' },
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(json.message || 'Gagal mengulang penerima.');
                setDriving(false);
                return;
            }
        } catch {
            setDriving(false);
            return;
        }
        await driveBatches();
    };

    const statusBadge = (s) => ({
        pending: 'bg-navy-700 text-navy-200', processing: 'bg-yellow-500/20 text-yellow-400',
        sent: 'bg-emerald-500/20 text-emerald-400', failed: 'bg-red-500/20 text-red-400',
    }[s] || '');

    const blastBadge = (s) => ({
        draft: 'bg-navy-700 text-navy-200', sending: 'bg-yellow-500/20 text-yellow-400',
        completed: 'bg-emerald-500/20 text-emerald-400', failed: 'bg-red-500/20 text-red-400',
    }[s] || '');

    return (
        <AuthenticatedLayout title={`Email: ${blast.title}`}>
            <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                <Link href="/email-blast" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back to Email Blast
                </Link>
                <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                        <Button size="sm" onClick={driveBatches} disabled={driving}>
                            {driving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Lanjutkan Pengiriman ({pendingCount} tersisa)
                        </Button>
                    )}
                    {pendingCount === 0 && blast.failed_count > 0 && (
                        <Button size="sm" variant="secondary" onClick={retryFailed} disabled={driving}>
                            {driving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            Coba Ulang {blast.failed_count} Gagal
                        </Button>
                    )}
                </div>
            </div>

            {progress && (
                <Card animate={false} className="mb-6">
                    <div className="flex items-center justify-between text-xs mb-2">
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
                    <p className="text-[11px] text-navy-500 mt-2">Jangan tutup halaman ini sampai selesai.</p>
                </Card>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <Mail className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-white">Blast Info</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-navy-400">Title</span><span className="text-white font-medium">{blast.title}</span></div>
                        <div className="flex justify-between"><span className="text-navy-400">Subject</span><span className="text-white text-xs">{blast.subject}</span></div>
                        <div className="flex justify-between"><span className="text-navy-400">Sent By</span><span className="text-white">{blast.user?.name}</span></div>
                        <div className="flex justify-between"><span className="text-navy-400">From</span><span className="text-white text-xs">{blast.email_account ? `${blast.email_account.name} (${blast.email_account.email})` : 'Default sistem'}</span></div>
                        <div className="flex justify-between items-center"><span className="text-navy-400">Status</span><Badge className={blastBadge(blast.status)}>{blast.status}</Badge></div>
                        <div className="flex justify-between"><span className="text-navy-400">Date</span><span className="text-white">{formatDate(blast.created_at)}</span></div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/5 min-w-0">
                        <div className="text-center p-2.5 bg-navy-800/50 rounded-xl"><p className="text-[11px] text-navy-400">Total</p><p className="text-lg font-bold text-white">{blast.total_recipients}</p></div>
                        <div className="text-center p-2.5 bg-navy-800/50 rounded-xl"><p className="text-[11px] text-navy-400">Sent</p><p className="text-lg font-bold text-emerald-400">{blast.sent_count}</p></div>
                        <div className="text-center p-2.5 bg-navy-800/50 rounded-xl"><p className="text-[11px] text-navy-400">Failed</p><p className="text-lg font-bold text-red-400">{blast.failed_count}</p></div>
                        <div className="text-center p-2.5 bg-navy-800/50 rounded-xl" title="Berdasarkan tracking pixel — beberapa email client memblokir gambar, jadi angka sebenarnya bisa lebih tinggi">
                            <p className="text-[11px] text-navy-400">Opened</p>
                            <p className="text-lg font-bold text-sky-400">{openedCount}</p>
                            {blast.sent_count > 0 && <p className="text-[10px] text-navy-500">{openRate}%</p>}
                        </div>
                    </div>
                </Card>

                <Card className="xl:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4">Email Body</h3>
                    <div className="p-4 bg-white rounded-xl text-navy-900 text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: blast.body }} />

                    {blast.attachments?.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <p className="text-sm font-medium text-navy-200 mb-2">Lampiran ({blast.attachments.length})</p>
                            <div className="flex flex-wrap gap-2">
                                {blast.attachments.map((att, i) => (
                                    <a key={i} href={`/email-blast/${blast.id}/attachments/${i}`}
                                        className="flex items-center gap-2 bg-navy-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-navy-200 hover:bg-white/5 hover:border-gold-500/30 transition">
                                        <Paperclip className="w-3.5 h-3.5 text-navy-400 shrink-0" />
                                        <span className="truncate max-w-[200px]">{att.name}</span>
                                        <span className="text-navy-500 shrink-0">{formatFileSize(att.size)}</span>
                                        <Download className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            <Card animate={false}>
                <h3 className="text-lg font-semibold text-white mb-4">Recipients ({blast.recipients?.length || 0})</h3>
                <Table>
                    <Thead><Tr><Th>#</Th><Th>Channel</Th><Th>Email</Th><Th>Status</Th><Th>Sent At</Th><Th>Opened</Th><Th>Error</Th></Tr></Thead>
                    <Tbody>
                        {blast.recipients?.map((r, i) => (
                            <Tr key={r.id}>
                                <Td className="text-navy-400">{i + 1}</Td>
                                <Td className="text-white font-medium">{r.channel ? `${r.channel.channel_code} - ${r.channel.company_name}` : '-'}</Td>
                                <Td className="text-xs">{r.email}</Td>
                                <Td><Badge className={statusBadge(r.status)}>
                                    <span className="flex items-center gap-1">
                                        {r.status === 'sent' && <CheckCircle className="w-3 h-3" />}
                                        {r.status === 'failed' && <XCircle className="w-3 h-3" />}
                                        {r.status === 'pending' && <Clock className="w-3 h-3" />}
                                        {r.status}
                                    </span>
                                </Badge></Td>
                                <Td className="text-xs">{formatDate(r.sent_at)}</Td>
                                <Td className="text-xs">
                                    {r.opened_at ? (
                                        <span className="flex items-center gap-1 text-sky-400">
                                            <MailOpen className="w-3 h-3" /> {formatDate(r.opened_at)}
                                        </span>
                                    ) : (
                                        <span className="text-navy-600">—</span>
                                    )}
                                </Td>
                                <Td className="text-xs text-red-400 max-w-xs truncate">{r.error || '-'}</Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </Card>
        </AuthenticatedLayout>
    );
}
