import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import KpiCard from '@/Components/KpiCard';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import ReportInsights from '@/Components/ReportInsights';
import { TrendChart, StatusBreakdown } from '@/Components/ReportCharts';
import { formatCurrency, gradeColor } from '@/Lib/utils';
import { ShoppingCart, CheckCircle, XCircle, Clock, DollarSign, Building2, Download, ArrowLeft } from 'lucide-react';
import { Link } from '@inertiajs/react';

function deltaSubtitle(delta, unit = 'week') {
    if (delta === null || delta === undefined) return `vs last ${unit}`;
    const arrow = delta >= 0 ? '▲' : '▼';
    return `${arrow} ${Math.abs(delta)}% vs last ${unit}`;
}

export default function Weekly({ report }) {
    const od = report.deltas?.orders;
    const rd = report.deltas?.revenue;

    return (
        <AuthenticatedLayout title="Weekly Report">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link href="/reports" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition mb-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Reports
                    </Link>
                    <h2 className="text-xl font-bold text-white">Weekly Report: {report.period}</h2>
                </div>
                <a href={`/reports/weekly?format=pdf`}>
                    <Button variant="secondary">
                        <Download className="w-4 h-4" /> Download PDF
                    </Button>
                </a>
            </div>

            <ReportInsights type="weekly" />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <KpiCard title="Total Orders" value={report.totalOrders} subtitle={deltaSubtitle(od)} icon={ShoppingCart} color="blue" index={0} />
                <KpiCard title="Delivered" value={report.deliveredOrders} icon={CheckCircle} color="emerald" index={1} />
                <KpiCard title="Cancelled" value={report.cancelledOrders} icon={XCircle} color="red" index={2} />
                <KpiCard title="Pending" value={report.pendingOrders} icon={Clock} color="purple" index={3} />
                <KpiCard title="Revenue" value={formatCurrency(report.revenue)} subtitle={deltaSubtitle(rd)} icon={DollarSign} color="gold" index={4} />
                <KpiCard title="New Channels" value={report.newChannels} icon={Building2} color="indigo" index={5} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <div className="xl:col-span-2">
                    <TrendChart data={report.trend} title="8-Week Revenue & Order Trend" />
                </div>
                <StatusBreakdown data={report.statusBreakdown} title="This Week by Status" />
            </div>

            <Card>
                <h3 className="text-lg font-semibold text-white mb-4">Top Performing Channels</h3>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Company</Th>
                            <Th>Score</Th>
                            <Th>Grade</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {report.topChannels?.map((ch, i) => (
                            <Tr key={i}>
                                <Td className="text-white font-medium">{ch.company_name}</Td>
                                <Td className="text-gold-400 font-bold">{ch.performance_score}</Td>
                                <Td><Badge className={gradeColor(ch.channel_grade)}>{ch.channel_grade}</Badge></Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </Card>
        </AuthenticatedLayout>
    );
}
