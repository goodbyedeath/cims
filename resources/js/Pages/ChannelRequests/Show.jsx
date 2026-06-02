import { router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Badge from '@/Components/ui/Badge';
import { formatDate } from '@/Lib/utils';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const statusBadge = (status) => ({
    pending: 'bg-yellow-500/20 text-yellow-400',
    done: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-red-500/20 text-red-400',
}[status] || '');

const statusIcon = (status) => ({
    pending: AlertCircle,
    done: CheckCircle,
    cancelled: XCircle,
}[status] || AlertCircle);

export default function Show({ channelRequest }) {
    const { data, setData, post, processing, errors } = useForm({
        status: '',
        note: '',
    });

    const handleUpdateStatus = (newStatus) => {
        setData('status', newStatus);
        post(`/channel-requests/${channelRequest.id}/status`, {
            preserveScroll: true,
            onSuccess: () => setData('note', ''),
        });
    };

    return (
        <AuthenticatedLayout title="Request Detail">
            <button
                onClick={() => router.get('/channel-requests')}
                className="flex items-center gap-2 text-sm text-navy-400 hover:text-white transition mb-4"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Requests
            </button>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <Card>
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{channelRequest.channel?.company_name}</h3>
                                <p className="text-xs text-navy-400 font-mono">{channelRequest.channel?.channel_code}</p>
                            </div>
                            <Badge className={statusBadge(channelRequest.status) + ' text-sm px-3 py-1'}>
                                {channelRequest.status}
                            </Badge>
                        </div>

                        <div className="p-4 bg-navy-800/30 rounded-xl border border-white/5 mb-4">
                            <p className="text-sm text-navy-200 whitespace-pre-wrap">{channelRequest.request}</p>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-navy-400">
                            <span>By: <span className="text-white">{channelRequest.user?.name}</span></span>
                            <span>Created: <span className="text-navy-300">{formatDate(channelRequest.created_at)}</span></span>
                            <span>Updated: <span className="text-navy-300">{formatDate(channelRequest.updated_at)}</span></span>
                        </div>
                    </Card>

                    {/* Update Status */}
                    <Card>
                        <h3 className="text-sm font-semibold text-white mb-3">Update Status</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-navy-300 mb-1.5">Note (optional)</label>
                                <textarea
                                    value={data.note}
                                    onChange={(e) => setData('note', e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                    placeholder="Add a note about this status change..."
                                />
                            </div>
                            <div className="flex gap-2">
                                {channelRequest.status !== 'done' && (
                                    <Button
                                        onClick={() => handleUpdateStatus('done')}
                                        disabled={processing}
                                        className="!bg-emerald-600 hover:!bg-emerald-700"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Mark as Done
                                    </Button>
                                )}
                                {channelRequest.status !== 'pending' && (
                                    <Button
                                        onClick={() => handleUpdateStatus('pending')}
                                        disabled={processing}
                                        variant="secondary"
                                    >
                                        <AlertCircle className="w-4 h-4" /> Set Pending
                                    </Button>
                                )}
                                {channelRequest.status !== 'cancelled' && (
                                    <Button
                                        onClick={() => handleUpdateStatus('cancelled')}
                                        disabled={processing}
                                        className="!bg-red-600 hover:!bg-red-700"
                                    >
                                        <XCircle className="w-4 h-4" /> Cancel
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Timeline */}
                <Card>
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gold-400" /> Status Timeline
                    </h3>
                    <div className="space-y-0">
                        {channelRequest.logs?.map((log, i) => {
                            const Icon = statusIcon(log.to_status);
                            return (
                                <div key={log.id} className="relative flex gap-3 pb-6 last:pb-0">
                                    {i < channelRequest.logs.length - 1 && (
                                        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-white/10" />
                                    )}
                                    <div className={`mt-0.5 p-1 rounded-full shrink-0 ${
                                        log.to_status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                                        log.to_status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Badge className={statusBadge(log.to_status) + ' !text-[10px] !px-1.5'}>
                                                {log.to_status}
                                            </Badge>
                                            {log.from_status && (
                                                <span className="text-[10px] text-navy-500">from {log.from_status}</span>
                                            )}
                                        </div>
                                        {log.note && (
                                            <p className="text-xs text-navy-300 mt-1">{log.note}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-navy-500">{log.user?.name}</span>
                                            <span className="text-[10px] text-navy-500">{formatDate(log.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {(!channelRequest.logs || channelRequest.logs.length === 0) && (
                            <p className="text-sm text-navy-400 text-center py-4">No status changes yet</p>
                        )}
                    </div>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
