import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import KpiCard from '@/Components/KpiCard';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatCurrency, formatCompact, formatDate, gradeColor, statusColor } from '@/Lib/utils';
import {
    Building2, Activity, DollarSign, AlertTriangle,
    ShoppingCart, TrendingUp, ClipboardList, Eye, Kanban, Target
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { router, Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

const STAGE_META = {
    prospect:    { label: 'Prospect',    color: 'bg-slate-400' },
    qualified:   { label: 'Qualified',   color: 'bg-blue-400' },
    proposal:    { label: 'Proposal',    color: 'bg-amber-400' },
    negotiation: { label: 'Negotiation', color: 'bg-orange-400' },
    won:         { label: 'Won',         color: 'bg-emerald-400' },
    lost:        { label: 'Lost',        color: 'bg-red-400' },
};

const requestStatusBadge = (status) => ({
    pending: 'bg-yellow-500/20 text-yellow-400',
    done: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-red-500/20 text-red-400',
}[status] || '');

function daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr) - new Date()) / 86400000);
}

export default function Dashboard({ stats, revenueChart, topChannels, recentOrders, aiAlerts, overdueInstallments, chartMonths, channelRequests, pendingRequests, pipelineStats, upcomingDeals }) {
    const [Chart, setChart] = useState(null);
    const [activeMonths, setActiveMonths] = useState(chartMonths || 12);

    useEffect(() => {
        import('react-apexcharts').then((mod) => setChart(() => mod.default));
    }, []);

    const revenueChartOptions = {
        chart: { type: 'area', toolbar: { show: false }, background: 'transparent', foreColor: '#8da2d1' },
        colors: ['#D4AF37'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
        stroke: { curve: 'smooth', width: 2 },
        dataLabels: { enabled: false },
        xaxis: {
            categories: revenueChart?.map((r) => r.month) || [],
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            labels: { formatter: (v) => formatCurrency(v) },
        },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
        tooltip: { theme: 'dark' },
    };

    const revenueChartSeries = [
        { name: 'Revenue', data: revenueChart?.map((r) => parseFloat(r.total)) || [] },
    ];

    const byStage = pipelineStats?.byStage || {};
    const maxStageCount = Math.max(1, ...Object.values(byStage).map(Number));

    return (
        <AuthenticatedLayout title="Executive Dashboard">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                <KpiCard title="Total Channels" value={stats.totalChannels} icon={Building2} color="blue" index={0} />
                <KpiCard title="Active Channels" value={stats.activeChannels} icon={Activity} color="emerald" index={1} />
                <KpiCard
                    title="Monthly Revenue"
                    value={formatCurrency(stats.monthlyRevenue)}
                    icon={DollarSign}
                    color="gold"
                    trend={stats.revenueGrowth >= 0 ? 'up' : 'down'}
                    trendValue={`${Math.abs(stats.revenueGrowth)}%`}
                    index={2}
                />
                <KpiCard title="Outstanding Debt" value={formatCurrency(stats.outstandingDebt)} icon={AlertTriangle} color="red" index={3} />
                <KpiCard title="Pending Orders" value={stats.pendingOrders} icon={ShoppingCart} color="purple" index={4} />
                <KpiCard
                    title="Growth Rate"
                    value={`${stats.revenueGrowth >= 0 ? '+' : ''}${stats.revenueGrowth}%`}
                    icon={TrendingUp}
                    color={stats.revenueGrowth >= 0 ? 'emerald' : 'red'}
                    index={5}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Revenue Chart */}
                <Card className="xl:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Revenue Trend ({activeMonths} Months)</h3>
                        <div className="flex gap-1">
                            {[3, 6, 12].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => {
                                        setActiveMonths(m);
                                        router.get('/dashboard', { months: m }, { preserveState: true, preserveScroll: true });
                                    }}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                                        activeMonths === m
                                            ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                                            : 'bg-navy-800/50 text-navy-400 border border-white/5 hover:bg-white/5'
                                    }`}
                                >
                                    {m}M
                                </button>
                            ))}
                        </div>
                    </div>
                    {Chart && (
                        <Chart options={revenueChartOptions} series={revenueChartSeries} type="area" height={300} />
                    )}
                </Card>

                {/* AI Alerts */}
                <Card>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        AI Risk Alerts
                    </h3>
                    <div className="space-y-3">
                        {aiAlerts?.length > 0 ? aiAlerts.map((alert) => (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-xl"
                            >
                                <div>
                                    <p className="text-sm font-medium text-white">{alert.company_name}</p>
                                    <p className="text-xs text-navy-400">{alert.channel_code}</p>
                                </div>
                                <Badge className={gradeColor(alert.channel_grade)}>
                                    {alert.channel_grade}
                                </Badge>
                            </motion.div>
                        )) : (
                            <p className="text-sm text-navy-400 text-center py-4">No high-risk alerts</p>
                        )}
                    </div>
                </Card>
            </div>

            {/* ── Pipeline Overview ─────────────────────────────────── */}
            <Card animate={false} className="mb-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Kanban className="w-5 h-5 text-gold-400" />
                        Sales Pipeline
                    </h3>
                    <Link href="/pipeline" className="text-xs text-gold-400 hover:text-gold-300 transition">
                        Open Kanban →
                    </Link>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* KPI mini-row */}
                    <div className="xl:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Pipeline Value</p>
                            <p className="text-base font-bold text-gold-400">{formatCompact(pipelineStats?.totalValue ?? 0)}</p>
                        </div>
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Weighted Forecast</p>
                            <p className="text-base font-bold text-emerald-400">{formatCompact(pipelineStats?.weightedValue ?? 0)}</p>
                        </div>
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Win Rate</p>
                            <p className="text-base font-bold text-white">
                                {pipelineStats?.winRate !== null && pipelineStats?.winRate !== undefined ? `${pipelineStats.winRate}%` : 'N/A'}
                            </p>
                        </div>
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Open Deals</p>
                            <p className="text-base font-bold text-white">{pipelineStats?.openCount ?? 0}</p>
                        </div>
                    </div>

                    {/* Stage funnel */}
                    <div className="xl:col-span-2">
                        <p className="text-xs font-medium text-navy-400 mb-3 uppercase tracking-wide">Stage Breakdown</p>
                        <div className="space-y-2">
                            {Object.entries(STAGE_META).map(([key, meta]) => {
                                const count = Number(byStage[key] ?? 0);
                                const pct = Math.round((count / maxStageCount) * 100);
                                return (
                                    <div key={key} className="flex items-center gap-3">
                                        <span className="text-xs text-navy-400 w-20 shrink-0">{meta.label}</span>
                                        <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${meta.color} transition-all`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-white w-4 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Upcoming deals */}
                    <div>
                        <p className="text-xs font-medium text-navy-400 mb-3 uppercase tracking-wide">Closing Soon</p>
                        <div className="space-y-2">
                            {upcomingDeals?.length > 0 ? upcomingDeals.map((deal) => {
                                const d = daysUntil(deal.expected_close_date);
                                const dCls = d !== null && d < 0 ? 'text-red-400' : d !== null && d <= 7 ? 'text-amber-400' : 'text-navy-400';
                                return (
                                    <div key={deal.id} className="flex items-start justify-between gap-2 p-2.5 bg-navy-800/40 rounded-lg">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-white truncate">{deal.title}</p>
                                            {deal.channel && <p className="text-[10px] text-navy-500 truncate">{deal.channel.company_name}</p>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            {deal.value && <p className="text-xs font-semibold text-gold-400">{formatCompact(deal.value)}</p>}
                                            <p className={`text-[10px] ${dCls}`}>
                                                {d !== null ? (d < 0 ? `${Math.abs(d)}d late` : d === 0 ? 'Today' : `${d}d`) : '—'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <p className="text-xs text-navy-500 text-center py-3">No upcoming deals</p>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Channel Requests */}
            <Card className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-gold-400" />
                        Channel Requests
                        {pendingRequests > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-bold">
                                {pendingRequests} pending
                            </span>
                        )}
                    </h3>
                    <button
                        onClick={() => router.get('/channel-requests')}
                        className="text-xs text-gold-400 hover:text-gold-300 transition"
                    >
                        View All
                    </button>
                </div>
                {channelRequests?.length > 0 ? (
                    <Table>
                        <Thead>
                            <Tr>
                                <Th>Channel</Th>
                                <Th>Request</Th>
                                <Th>Status</Th>
                                <Th>By</Th>
                                <Th>Date</Th>
                                <Th></Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {channelRequests.map((req) => (
                                <Tr key={req.id}>
                                    <Td>
                                        <p className="text-sm font-medium text-white">{req.channel?.company_name}</p>
                                        <p className="text-xs text-navy-400">{req.channel?.channel_code}</p>
                                    </Td>
                                    <Td className="max-w-xs">
                                        <p className="text-xs text-navy-200 truncate">{req.request}</p>
                                    </Td>
                                    <Td>
                                        <Badge className={requestStatusBadge(req.status)}>{req.status}</Badge>
                                    </Td>
                                    <Td className="text-xs text-navy-300">{req.user?.name}</Td>
                                    <Td className="text-xs text-navy-400">{formatDate(req.created_at)}</Td>
                                    <Td>
                                        <button
                                            onClick={() => router.get(`/channel-requests/${req.id}`)}
                                            className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                ) : (
                    <p className="text-sm text-navy-400 text-center py-4">No channel requests yet</p>
                )}
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Top Channels */}
                <Card>
                    <h3 className="text-lg font-semibold text-white mb-4">Top Performing Channels</h3>
                    <Table>
                        <Thead>
                            <Tr>
                                <Th>Channel</Th>
                                <Th>Score</Th>
                                <Th>Grade</Th>
                                <Th>Orders</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {topChannels?.map((ch) => (
                                <Tr key={ch.id}>
                                    <Td>
                                        <div>
                                            <p className="font-medium text-white">{ch.company_name}</p>
                                            <p className="text-xs text-navy-400">{ch.channel_code}</p>
                                        </div>
                                    </Td>
                                    <Td>
                                        <span className="font-semibold text-gold-400">{ch.performance_score}</span>
                                    </Td>
                                    <Td>
                                        <Badge className={gradeColor(ch.channel_grade)}>{ch.channel_grade}</Badge>
                                    </Td>
                                    <Td>{ch.successful_order}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </Card>

                {/* Recent Orders */}
                <Card>
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Orders</h3>
                    <Table>
                        <Thead>
                            <Tr>
                                <Th>Order</Th>
                                <Th>Channel</Th>
                                <Th>Amount</Th>
                                <Th>Status</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {recentOrders?.map((order) => (
                                <Tr key={order.id}>
                                    <Td>
                                        <p className="font-medium text-white">{order.order_no}</p>
                                        <p className="text-xs text-navy-400">{formatDate(order.order_date)}</p>
                                    </Td>
                                    <Td>{order.channel?.company_name}</Td>
                                    <Td className="font-medium text-gold-400">{formatCurrency(order.grand_total)}</Td>
                                    <Td>
                                        <Badge className={statusColor(order.status)}>{order.status}</Badge>
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
