import { Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatCurrency, formatDate, gradeColor, statusColor } from '@/Lib/utils';
import { ArrowLeft, Edit, MapPin, Phone, Mail, User, Activity, ShieldBan } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Show({ channel }) {
    const [Chart, setChart] = useState(null);

    useEffect(() => {
        import('react-apexcharts').then((mod) => setChart(() => mod.default));
    }, []);

    const aiScore = channel.ai_score;

    const gaugeOptions = (label, color) => ({
        chart: { type: 'radialBar', background: 'transparent' },
        plotOptions: {
            radialBar: {
                hollow: { size: '60%' },
                dataLabels: {
                    name: { show: true, fontSize: '11px', color: '#8da2d1', offsetY: -10 },
                    value: { show: true, fontSize: '20px', color: '#fff', fontWeight: 'bold', offsetY: 5 },
                },
                track: { background: 'rgba(255,255,255,0.05)' },
            },
        },
        colors: [color],
        labels: [label],
    });

    return (
        <AuthenticatedLayout title={`Channel: ${channel.company_name}`}>
            <div className="mb-6 flex items-center justify-between">
                <Link href="/channels" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back to Channels
                </Link>
                <Link href={`/channels/${channel.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500/10 text-gold-400 rounded-lg hover:bg-gold-500/20 transition text-sm font-medium">
                    <Edit className="w-4 h-4" /> Edit
                </Link>
            </div>

            {channel.status === 'blacklist' && (
                <div className="mb-6 flex items-start gap-3 px-5 py-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <ShieldBan className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-300">Channel Diblacklist</p>
                        {channel.blacklist_reason
                            ? <p className="text-sm text-red-400/80 mt-0.5">{channel.blacklist_reason}</p>
                            : <p className="text-sm text-red-400/60 mt-0.5 italic">Tidak ada alasan yang dicatat.</p>
                        }
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Profile Card */}
                <Card>
                    <div className="text-center mb-4">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 font-bold text-xl mb-3">
                            {channel.company_name.charAt(0)}
                        </div>
                        <h2 className="text-xl font-bold text-white">{channel.company_name}</h2>
                        <p className="text-sm text-navy-400 font-mono">{channel.channel_code}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <Badge className={statusColor(channel.status)}>{channel.status}</Badge>
                            <Badge className={gradeColor(channel.channel_grade)}>{channel.channel_grade}</Badge>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-3 text-sm">
                            <User className="w-4 h-4 text-navy-400" />
                            <span className="text-navy-300">{channel.gender === 'female' ? 'Bu' : 'Pak'} {channel.owner_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Phone className="w-4 h-4 text-navy-400" />
                            <span className="text-navy-300">{channel.phone}</span>
                        </div>
                        {channel.email && (
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="w-4 h-4 text-navy-400" />
                                <span className="text-navy-300">{channel.email}</span>
                            </div>
                        )}
                        <div className="flex items-start gap-3 text-sm">
                            <MapPin className="w-4 h-4 text-navy-400 mt-0.5" />
                            <span className="text-navy-300">{channel.address}, {channel.city}, {channel.province}</span>
                        </div>
                        {channel.assigned_user && (
                            <div className="flex items-center gap-3 text-sm">
                                <Activity className="w-4 h-4 text-navy-400" />
                                <span className="text-navy-300">Sales: {channel.assigned_user.name}</span>
                            </div>
                        )}
                    </div>

                    {/* Performance */}
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-3">
                            <div>
                                <p className="text-lg font-bold text-emerald-400">{channel.successful_order}</p>
                                <p className="text-xs text-navy-400">Delivered</p>
                            </div>
                            <div>
                                <p className="text-lg font-bold text-yellow-400">{channel.pending_order}</p>
                                <p className="text-xs text-navy-400">Pending</p>
                            </div>
                            <div>
                                <p className="text-lg font-bold text-red-400">{channel.cancelation_order}</p>
                                <p className="text-xs text-navy-400">Cancelled</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* AI Scores */}
                <Card className="xl:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4">AI Intelligence Scores</h3>
                    {aiScore ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Chart && (
                                    <>
                                        <div>
                                            <Chart options={gaugeOptions('Repeat', '#10b981')} series={[aiScore.repeat_probability]} type="radialBar" height={160} />
                                        </div>
                                        <div>
                                            <Chart options={gaugeOptions('Churn Risk', '#ef4444')} series={[aiScore.risk_churn_score]} type="radialBar" height={160} />
                                        </div>
                                        <div>
                                            <Chart options={gaugeOptions('Payment Risk', '#f59e0b')} series={[aiScore.payment_risk_score]} type="radialBar" height={160} />
                                        </div>
                                        <div>
                                            <Chart options={gaugeOptions('Growth', '#6366f1')} series={[aiScore.growth_score]} type="radialBar" height={160} />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="mt-4 p-4 bg-navy-800/50 rounded-xl border border-white/5">
                                <p className="text-xs font-semibold text-navy-400 uppercase mb-1">AI Recommendation</p>
                                <p className="text-sm text-white">{aiScore.recommended_action}</p>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-navy-400 text-center py-8">No AI scores generated yet</p>
                    )}
                </Card>
            </div>

            {/* Orders History */}
            <Card animate={false} className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Order History</h3>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Order No</Th>
                            <Th>Date</Th>
                            <Th>Amount</Th>
                            <Th>Payment</Th>
                            <Th>Status</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {channel.orders?.map((order) => (
                            <Tr key={order.id}>
                                <Td>
                                    <Link href={`/orders/${order.id}`} className="text-gold-400 hover:text-gold-300 font-mono text-xs">
                                        {order.order_no}
                                    </Link>
                                </Td>
                                <Td>{formatDate(order.order_date)}</Td>
                                <Td className="font-medium">{formatCurrency(order.grand_total)}</Td>
                                <Td>
                                    {order.payment && (
                                        <Badge className={statusColor(order.payment.payment_status)}>
                                            {order.payment.payment_status}
                                        </Badge>
                                    )}
                                </Td>
                                <Td><Badge className={statusColor(order.status)}>{order.status}</Badge></Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </Card>

            {/* Activity Logs */}
            <Card animate={false}>
                <h3 className="text-lg font-semibold text-white mb-4">Activity Log</h3>
                <div className="space-y-3">
                    {channel.logs?.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 bg-navy-800/30 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs text-navy-300 font-semibold shrink-0">
                                {log.user?.name?.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm text-white">{log.activity}</p>
                                <p className="text-xs text-navy-400">
                                    {log.user?.name} - {formatDate(log.created_at)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </AuthenticatedLayout>
    );
}
