import { useState, useEffect } from 'react';
import Card from '@/Components/ui/Card';
import { formatCurrency, formatCompact, cn } from '@/Lib/utils';

/** Lazy-load apexcharts so it stays out of the main bundle (matches Monthly.jsx). */
function useApexChart() {
    const [Chart, setChart] = useState(null);
    useEffect(() => {
        let alive = true;
        import('react-apexcharts').then((mod) => alive && setChart(() => mod.default));
        return () => { alive = false; };
    }, []);
    return Chart;
}

/**
 * Delivered-revenue trend with order volume on a secondary axis.
 * @param {Array<{label:string,revenue:number,orders:number}>} data
 */
export function TrendChart({ data = [], title = 'Revenue Trend' }) {
    const Chart = useApexChart();
    const labels = data.map((d) => d.label);
    const hasData = data.some((d) => d.revenue > 0 || d.orders > 0);

    const options = {
        chart: { type: 'line', background: 'transparent', foreColor: '#8da2d1', toolbar: { show: false }, fontFamily: 'inherit' },
        colors: ['#D4AF37', '#60a5fa'],
        stroke: { width: [0, 2.5], curve: 'smooth' },
        fill: {
            type: ['gradient', 'solid'],
            gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 100] },
        },
        plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
        dataLabels: { enabled: false },
        grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
        xaxis: { categories: labels, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: [
            { labels: { formatter: (v) => formatCompact(v), style: { colors: '#8da2d1' } } },
            { opposite: true, labels: { formatter: (v) => Math.round(v), style: { colors: '#60a5fa' } } },
        ],
        legend: { labels: { colors: '#8da2d1' }, markers: { radius: 4 } },
        tooltip: {
            theme: 'dark',
            y: [
                { formatter: (v) => formatCurrency(v) },
                { formatter: (v) => `${v} orders` },
            ],
        },
    };

    const series = [
        { name: 'Revenue', type: 'area', data: data.map((d) => Math.round(d.revenue)) },
        { name: 'Orders', type: 'line', data: data.map((d) => d.orders) },
    ];

    return (
        <Card>
            <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
            {!hasData ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-navy-400">
                    No delivered revenue in this window yet.
                </div>
            ) : Chart ? (
                <Chart options={options} series={series} type="line" height={280} />
            ) : (
                <div className="h-[260px] animate-pulse rounded-xl bg-white/[0.02]" />
            )}
        </Card>
    );
}

const STATUS_STYLE = {
    delivered: { label: 'Delivered', bar: 'bg-emerald-400', text: 'text-emerald-300' },
    process:   { label: 'Processing', bar: 'bg-blue-400', text: 'text-blue-300' },
    confirmed: { label: 'Confirmed', bar: 'bg-indigo-400', text: 'text-indigo-300' },
    pending:   { label: 'Pending', bar: 'bg-amber-400', text: 'text-amber-300' },
    cancel:    { label: 'Cancelled', bar: 'bg-red-400', text: 'text-red-300' },
};

/**
 * Horizontal proportion bars for order statuses.
 * @param {Array<{status:string,count:number}>} data
 */
export function StatusBreakdown({ data = [], title = 'Order Status Breakdown' }) {
    const total = data.reduce((sum, d) => sum + (d.count || 0), 0);

    return (
        <Card>
            <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
            {total === 0 ? (
                <div className="py-8 text-center text-sm text-navy-400">No orders in this period.</div>
            ) : (
                <div className="space-y-3">
                    {data.map((d) => {
                        const style = STATUS_STYLE[d.status] || { label: d.status, bar: 'bg-navy-400', text: 'text-navy-200' };
                        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                        return (
                            <div key={d.status}>
                                <div className="flex items-center justify-between mb-1 text-xs">
                                    <span className={cn('font-medium', style.text)}>{style.label}</span>
                                    <span className="text-navy-400">
                                        <strong className="text-white">{d.count}</strong> · {pct}%
                                    </span>
                                </div>
                                <div className="h-2 rounded-full bg-navy-800 overflow-hidden">
                                    <div className={cn('h-full rounded-full transition-all', style.bar)} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
