import { Link, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Select from '@/Components/ui/Select';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatCurrency, formatDate, statusColor } from '@/Lib/utils';
import { ArrowLeft, FileText, MessageSquare, FileSpreadsheet, Copy, Check, FileDown, ShoppingCart, Save, Pencil } from 'lucide-react';
import { useState } from 'react';

function CopyBox({ label, icon: Icon, content, iconColor }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                    <span className="text-sm font-medium text-white">{label}</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800/50 border border-white/10 text-xs text-navy-300 hover:text-white hover:bg-white/5 transition"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <textarea
                readOnly
                value={content}
                rows={content.split('\n').length + 1}
                className="w-full px-4 py-3 bg-navy-950/60 border border-white/5 rounded-xl text-sm text-navy-200 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-gold-500/20 leading-relaxed"
                onClick={(e) => e.target.select()}
            />
        </div>
    );
}

export default function Show({ offering }) {
    const { data, setData, put, processing } = useForm({
        status: offering.status,
        valid_until: offering.valid_until || '',
        note: offering.note || '',
    });

    const updateStatus = (e) => {
        e.preventDefault();
        put(`/offerings/${offering.id}`, { preserveScroll: true });
    };

    const convertToOrder = () => {
        if (!confirm('Buat order baru dari penawaran ini?')) return;
        router.post(`/offerings/${offering.id}/convert`);
    };

    // ── Report generation ──────────────────────────────────────────

    const noRef = offering.ref_no || '—';

    const channelName    = offering.channel?.company_name || '';
    const channelAddress = [
        offering.channel?.address,
        offering.channel?.district,
        offering.channel?.city,
        offering.channel?.province,
    ].filter(Boolean).join(', ');

    const validUntilStr = offering.valid_until ? formatDate(offering.valid_until) : '—';

    // Tax rate derived from the stored amounts (same as the PDF does).
    const taxPct = Number(offering.subtotal) > 0
        ? Math.round((Number(offering.tax) / Number(offering.subtotal)) * 100)
        : 0;
    const hasDiscount = Number(offering.discount) > 0;

    // WA message — penawaran format: header once, then items, then totals.
    const waItems = offering.items?.map((item, i) => {
        const spec = item.inventory?.spesifikasi || item.inventory?.product || item.inventory?.kode_barang || '-';
        return `${i + 1}. ${spec}\n   ${item.qty} unit x ${formatCurrency(item.price)}\n   Total: ${formatCurrency(item.total)}`;
    }) || [];
    const waText = [
        `*Penawaran untuk ${channelName}*`,
        `No. Ref: ${noRef}`,
        '',
        waItems.join('\n\n'),
        '',
        `Subtotal: ${formatCurrency(offering.subtotal)}`,
        ...(hasDiscount ? [`Diskon: -${formatCurrency(offering.discount)}`] : []),
        `PPN (${taxPct}%): ${formatCurrency(offering.tax)}`,
        `*Grand Total: ${formatCurrency(offering.grand_total)}*`,
        '',
        `Berlaku hingga: ${validUntilStr}`,
        ...(offering.note ? ['', offering.note] : []),
    ].join('\n');

    // Spreadsheet — tab-separated rows, then a totals block under the Total
    // column. Values stay raw (unformatted) so Excel/Sheets treats them as numbers.
    const sheetHeader = ['No. Ref', 'Dealer Name', 'Alamat', 'Produk', 'Price', 'QTY', 'Total', 'Valid Until'].join('\t');
    const sheetRows = offering.items?.map((item) => {
        const spec = item.inventory?.spesifikasi || item.inventory?.product || '-';
        return [noRef, channelName, channelAddress, spec, item.price, item.qty, item.total, validUntilStr].join('\t');
    }) || [];
    const sheetSummary = [
        ['', '', '', '', '', 'Subtotal', offering.subtotal].join('\t'),
        ...(hasDiscount ? [['', '', '', '', '', 'Diskon', -Number(offering.discount)].join('\t')] : []),
        ['', '', '', '', '', `PPN (${taxPct}%)`, offering.tax].join('\t'),
        ['', '', '', '', '', 'Grand Total', offering.grand_total].join('\t'),
    ];
    const sheetText = [sheetHeader, ...sheetRows, '', ...sheetSummary].join('\n');

    // ──────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout title={`Offering ${offering.ref_no || offering.offering_no}`}>
            <div className="mb-6 flex items-center justify-between">
                <Link href="/offerings" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back to Offerings
                </Link>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/offerings/${offering.id}/edit`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-400 text-sm font-semibold hover:bg-blue-500/20 hover:border-blue-500/40 transition"
                    >
                        <Pencil className="w-4 h-4" />
                        Edit Offering
                    </Link>
                    <a
                        href={`/offerings/${offering.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500/10 border border-gold-500/25 text-gold-400 text-sm font-semibold hover:bg-gold-500/20 hover:border-gold-500/40 transition"
                    >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Offering Info */}
                <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <FileText className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-white">Offering Info</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-navy-400">Ref No</span>
                            <span className="text-gold-400 font-mono font-bold">{noRef}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Offering No</span>
                            <span className="text-navy-300 font-mono text-xs">{offering.offering_no}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Channel</span>
                            <Link href={`/channels/${offering.channel?.id}`} className="text-white hover:text-gold-400 transition">
                                {offering.channel?.company_name}
                            </Link>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Sales</span>
                            <span className="text-white">{offering.sales?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Offering Date</span>
                            <span className="text-white">{formatDate(offering.offering_date)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Valid Until</span>
                            <span className="text-white">{validUntilStr}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-navy-400">Status</span>
                            <Badge className={statusColor(offering.status)}>{offering.status}</Badge>
                        </div>
                    </div>

                    <form onSubmit={updateStatus} className="mt-4 pt-4 border-t border-white/5 space-y-3">
                        <Select
                            label="Update Status"
                            value={data.status}
                            onChange={(e) => setData('status', e.target.value)}
                            options={[
                                { value: 'draft', label: 'Draft' },
                                { value: 'sent', label: 'Sent' },
                                { value: 'accepted', label: 'Accepted' },
                                { value: 'rejected', label: 'Rejected' },
                                { value: 'expired', label: 'Expired' },
                            ]}
                        />
                        <Button type="submit" size="sm" disabled={processing} className="w-full">
                            <Save className="w-4 h-4" /> Update Status
                        </Button>
                    </form>
                </Card>

                {/* Items */}
                <Card className="xl:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4">Offering Items</h3>
                    <Table>
                        <Thead>
                            <Tr>
                                <Th>Product</Th>
                                <Th>SKU</Th>
                                <Th>Qty</Th>
                                <Th>Price</Th>
                                <Th>Total</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {offering.items?.map((item) => (
                                <Tr key={item.id}>
                                    <Td>
                                        <p className="text-white font-medium">{item.inventory?.product}</p>
                                        {item.inventory?.spesifikasi && (
                                            <p className="text-xs text-navy-400 mt-0.5 max-w-xs truncate">{item.inventory.spesifikasi}</p>
                                        )}
                                    </Td>
                                    <Td className="font-mono text-xs">{item.inventory?.sku_no}</Td>
                                    <Td>{item.qty}</Td>
                                    <Td>{formatCurrency(item.price)}</Td>
                                    <Td className="text-gold-400 font-medium">{formatCurrency(item.total)}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>

                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-navy-400">Subtotal</span><span>{formatCurrency(offering.subtotal)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-navy-400">Discount</span><span className="text-red-400">-{formatCurrency(offering.discount)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-navy-400">Tax</span><span>{formatCurrency(offering.tax)}</span></div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/5">
                            <span>Grand Total</span><span className="text-gold-400">{formatCurrency(offering.grand_total)}</span>
                        </div>
                    </div>

                    {offering.status === 'accepted' && (
                        <div className="mt-5 pt-4 border-t border-white/5">
                            <button
                                onClick={convertToOrder}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold-500/15 border border-gold-500/30 text-gold-300 font-semibold text-sm hover:bg-gold-500/25 hover:border-gold-500/50 transition"
                            >
                                <ShoppingCart className="w-4 h-4" />
                                Convert to Order
                            </button>
                            <p className="text-xs text-navy-500 text-center mt-2">
                                Akan diarahkan ke halaman pembuatan order baru untuk channel ini.
                            </p>
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Report Boxes ─────────────────────────────────── */}
            <Card animate={false} className="mb-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-gold-500/10 flex items-center justify-center">
                        <FileSpreadsheet className="w-4 h-4 text-gold-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Offering Report</h3>
                        <p className="text-xs text-navy-400">Ref: <span className="font-mono text-gold-400">{noRef}</span></p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <CopyBox
                        label="WA Message (Penawaran)"
                        icon={MessageSquare}
                        iconColor="text-emerald-400"
                        content={waText}
                    />
                    <CopyBox
                        label="Spreadsheet (paste into Excel / Google Sheets)"
                        icon={FileSpreadsheet}
                        iconColor="text-blue-400"
                        content={sheetText}
                    />
                </div>
            </Card>
        </AuthenticatedLayout>
    );
}
