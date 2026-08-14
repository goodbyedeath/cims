import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import KpiCard from '@/Components/KpiCard';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import ReportInsights from '@/Components/ReportInsights';
import { TrendChart, StatusBreakdown } from '@/Components/ReportCharts';
import { formatCurrency, gradeColor } from '@/Lib/utils';
import { ShoppingCart, CheckCircle, XCircle, DollarSign, TrendingUp, Download, ArrowLeft } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';

function deltaSubtitle(delta) {
    if (delta === null || delta === undefined) return 'vs last month';
    const arrow = delta >= 0 ? '▲' : '▼';
    return `${arrow} ${Math.abs(delta)}% vs last month`;
}

export default function Monthly({ report }) {
    const [Chart, setChart] = useState(null);

    useEffect(() => {
        import('react-apexcharts').then((mod) => setChart(() => mod.default));
    }, []);

    const gradeChartOptions = {
        chart: { type: 'donut', background: 'transparent', foreColor: '#8da2d1' },
        colors: ['#a855f7', '#D4AF37', '#9ca3af', '#ef4444'],
        labels: report.gradeDistribution?.map((g) => g.channel_grade) || [],
        legend: { position: 'bottom', labels: { colors: '#8da2d1' } },
        plotOptions: { pie: { donut: { size: '65%' } } },
        stroke: { show: false },
    };

    const gradeChartSeries = report.gradeDistribution?.map((g) => g.count) || [];

    return (
        <AuthenticatedLayout title="Monthly Executive Report">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link href="/reports" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition mb-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Reports
                    </Link>
                    <h2 className="text-xl font-bold text-white">
                        Monthly Report: {new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
                <a href={`/reports/monthly?format=pdf&month=${report.month}&year=${report.year}`}>
                    <Button variant="secondary">
                        <Download className="w-4 h-4" /> Download PDF
                    </Button>
                </a>
            </div>

            <ReportInsights type="monthly" month={report.month} year={report.year} />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <KpiCard title="Total Orders" value={report.totalOrders} subtitle={deltaSubtitle(report.deltas?.orders)} icon={ShoppingCart} color="blue" index={0} />
                <KpiCard title="Delivered" value={report.deliveredOrders} icon={CheckCircle} color="emerald" index={1} />
                <KpiCard title="Cancelled" value={report.cancelledOrders} icon={XCircle} color="red" index={2} />
                <KpiCard title="Revenue" value={formatCurrency(report.revenue)} subtitle={deltaSubtitle(report.deltas?.revenue)} icon={DollarSign} color="gold" index={3} />
                <KpiCard
                    title="Growth"
                    value={report.growth === null ? 'N/A' : `${report.growth >= 0 ? '+' : ''}${report.growth}%`}
                    icon={TrendingUp}
                    color={report.growth === null ? 'blue' : report.growth >= 0 ? 'emerald' : 'red'}
                    index={4}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <div className="xl:col-span-2">
                    <TrendChart data={report.trend} title="6-Month Revenue & Order Trend" />
                </div>
                <StatusBreakdown data={report.statusBreakdown} title="This Month by Status" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Grade Distribution */}
                <Card>
                    <h3 className="text-lg font-semibold text-white mb-4">Channel Grade Distribution</h3>
                    {Chart && gradeChartSeries.length > 0 && (
                        <Chart options={gradeChartOptions} series={gradeChartSeries} type="donut" height={280} />
                    )}
                </Card>

                {/* Payment Summary */}
                <Card>
                    <h3 className="text-lg font-semibold text-white mb-4">Payment Summary</h3>
                    <div className="space-y-4">
                        {report.paymentSummary?.map((p) => (
                            <div key={p.payment_status} className="flex items-center justify-between p-3 bg-navy-800/50 rounded-xl">
                                <div>
                                    <p className="text-sm font-medium text-white capitalize">{p.payment_status}</p>
                                    <p className="text-xs text-navy-400">{p.count} payments</p>
                                </div>
                                <p className="text-sm font-bold text-gold-400">{formatCurrency(p.total_debt || 0)}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Top Channels */}
                <Card>
                    <h3 className="text-lg font-semibold text-white mb-4">Top 10 Channels This Month</h3>
                    <div className="space-y-2">
                        {report.topChannels?.map((ch, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-navy-800 flex items-center justify-center text-xs text-navy-300 font-semibold">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-white">{ch.company_name}</p>
                                        <p className="text-xs text-navy-400">{ch.monthly_orders ?? 0} orders this month</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gold-400">{ch.performance_score}</p>
                                    <Badge className={gradeColor(ch.channel_grade) + ' !text-[10px]'}>{ch.channel_grade}</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
