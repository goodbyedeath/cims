import { Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatDate } from '@/Lib/utils';
import { ArrowLeft, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';

export default function Show({ blast }) {
    const statusBadge = (status) => {
        const map = {
            pending: 'bg-navy-700 text-navy-200',
            sent: 'bg-emerald-500/20 text-emerald-400',
            failed: 'bg-red-500/20 text-red-400',
        };
        return map[status] || '';
    };

    const blastStatusBadge = (status) => {
        const map = {
            draft: 'bg-navy-700 text-navy-200',
            sending: 'bg-yellow-500/20 text-yellow-400',
            completed: 'bg-emerald-500/20 text-emerald-400',
            failed: 'bg-red-500/20 text-red-400',
        };
        return map[status] || '';
    };

    return (
        <AuthenticatedLayout title={`Blast: ${blast.title}`}>
            <div className="mb-6">
                <Link href="/wa-blast" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back to WA Blast
                </Link>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Blast Info */}
                <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <MessageSquare className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-white">Blast Info</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-navy-400">Title</span>
                            <span className="text-white font-medium">{blast.title}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Sent By</span>
                            <span className="text-white">{blast.user?.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-navy-400">Status</span>
                            <Badge className={blastStatusBadge(blast.status)}>{blast.status}</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Date</span>
                            <span className="text-white">{formatDate(blast.created_at)}</span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5 min-w-0">
                        <div className="text-center p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Total</p>
                            <p className="text-lg font-bold text-white">{blast.total_recipients}</p>
                        </div>
                        <div className="text-center p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Sent</p>
                            <p className="text-lg font-bold text-emerald-400">{blast.sent_count}</p>
                        </div>
                        <div className="text-center p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Failed</p>
                            <p className="text-lg font-bold text-red-400">{blast.failed_count}</p>
                        </div>
                    </div>
                </Card>

                {/* Message */}
                <Card className="xl:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4">Message Content</h3>
                    <div className="p-4 bg-navy-800/50 rounded-xl border border-white/5">
                        <p className="text-sm text-navy-200 whitespace-pre-wrap">{blast.message}</p>
                    </div>
                </Card>
            </div>

            {/* Recipients */}
            <Card animate={false}>
                <h3 className="text-lg font-semibold text-white mb-4">Recipients ({blast.recipients?.length || 0})</h3>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>#</Th>
                            <Th>Channel</Th>
                            <Th>Phone</Th>
                            <Th>Status</Th>
                            <Th>Sent At</Th>
                            <Th>Error</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {blast.recipients?.map((r, i) => (
                            <Tr key={r.id}>
                                <Td className="text-navy-400">{i + 1}</Td>
                                <Td className="text-white font-medium">
                                    {r.channel ? `${r.channel.channel_code} - ${r.channel.company_name}` : '-'}
                                </Td>
                                <Td className="font-mono text-xs">{r.phone}</Td>
                                <Td>
                                    <Badge className={statusBadge(r.status)}>
                                        <span className="flex items-center gap-1">
                                            {r.status === 'sent' && <CheckCircle className="w-3 h-3" />}
                                            {r.status === 'failed' && <XCircle className="w-3 h-3" />}
                                            {r.status === 'pending' && <Clock className="w-3 h-3" />}
                                            {r.status}
                                        </span>
                                    </Badge>
                                </Td>
                                <Td className="text-xs">{formatDate(r.sent_at)}</Td>
                                <Td className="text-xs text-red-400 max-w-xs truncate">{r.error || '-'}</Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </Card>
        </AuthenticatedLayout>
    );
}
