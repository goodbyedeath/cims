import { router, useForm, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Button from '@/Components/ui/Button';
import Select from '@/Components/ui/Select';
import SearchableSelect from '@/Components/ui/SearchableSelect';
import { formatCurrency, formatCompact } from '@/Lib/utils';
import { Plus, X, Trash2, Target, TrendingUp, DollarSign, Edit2, ChevronDown, ChevronUp, ShoppingCart, Package } from 'lucide-react';
import { useState } from 'react';

const STAGES = [
    { key: 'prospect',    label: 'Prospect',    color: 'bg-slate-500/20 border-slate-500/40',    dot: 'bg-slate-400',   header: 'bg-slate-800/60' },
    { key: 'qualified',   label: 'Qualified',   color: 'bg-blue-500/20 border-blue-500/40',      dot: 'bg-blue-400',    header: 'bg-blue-900/60' },
    { key: 'proposal',    label: 'Proposal',    color: 'bg-amber-500/20 border-amber-500/40',    dot: 'bg-amber-400',   header: 'bg-amber-900/60' },
    { key: 'negotiation', label: 'Negotiation', color: 'bg-orange-500/20 border-orange-500/40',  dot: 'bg-orange-400',  header: 'bg-orange-900/60' },
    { key: 'won',         label: 'Won',         color: 'bg-emerald-500/20 border-emerald-500/40', dot: 'bg-emerald-400', header: 'bg-emerald-900/60' },
    { key: 'lost',        label: 'Lost',        color: 'bg-red-500/20 border-red-500/40',        dot: 'bg-red-400',     header: 'bg-red-900/60' },
];

const PROB_BY_STAGE = { prospect: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0 };

function daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr) - new Date()) / 86400000);
}

function DaysChip({ date }) {
    const d = daysUntil(date);
    if (d === null) return null;
    const cls = d < 0 ? 'text-red-400' : d <= 7 ? 'text-amber-400' : 'text-navy-400';
    const label = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d left`;
    return <span className={`text-[10px] ${cls}`}>{label}</span>;
}

function OpportunityModal({ channels, inventories, onClose, pipeline: editTarget }) {
    const editing = !!editTarget;
    const { data, setData, post, put, processing, errors } = useForm({
        title:               editTarget?.title               ?? '',
        channel_id:          editTarget?.channel_id          ?? '',
        value:               editTarget?.value               ?? '',
        probability:         editTarget?.probability          ?? 50,
        stage:               editTarget?.stage               ?? 'prospect',
        expected_close_date: editTarget?.expected_close_date ?? '',
        requested_items:     editTarget?.requested_items     ?? '',
        note:                editTarget?.note                ?? '',
        lost_reason:         editTarget?.lost_reason         ?? '',
    });

    const submit = (e) => {
        e.preventDefault();
        if (editing) {
            put(`/pipeline/${editTarget.id}`, { preserveScroll: true, onSuccess: onClose });
        } else {
            post('/pipeline', { preserveScroll: true, onSuccess: onClose });
        }
    };

    // Low-stock inventory items for awareness
    const lowStock = inventories.filter(i => i.qty !== null && i.qty <= 5);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-navy-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-navy-900 z-10">
                    <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Opportunity' : 'New Opportunity'}</h2>
                    <button onClick={onClose} className="text-navy-400 hover:text-white transition"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={submit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-navy-300 mb-1">Title *</label>
                        <input
                            value={data.title}
                            onChange={e => setData('title', e.target.value)}
                            placeholder="e.g. Q3 Supply Deal - PT ABC"
                            className="w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                        />
                        {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-navy-300 mb-1">Channel</label>
                            <SearchableSelect
                                value={data.channel_id}
                                onChange={e => setData('channel_id', e.target.value)}
                                placeholder="Search channel..."
                                options={channels.map(c => ({
                                    value: c.id,
                                    label: c.company_name,
                                    sub: c.channel_code,
                                    searchText: c.channel_code,
                                }))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-navy-300 mb-1">Stage</label>
                            <Select
                                value={data.stage}
                                onChange={e => {
                                    setData(d => ({ ...d, stage: e.target.value, probability: PROB_BY_STAGE[e.target.value] ?? d.probability }));
                                }}
                                options={STAGES.map(s => ({ value: s.key, label: s.label }))}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-navy-300 mb-1">Deal Value (IDR)</label>
                            <input
                                type="number"
                                value={data.value}
                                onChange={e => setData('value', e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-navy-300 mb-1">Win Probability ({data.probability}%)</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={data.probability}
                                onChange={e => setData('probability', parseInt(e.target.value))}
                                className="w-full mt-2 accent-gold-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-navy-300 mb-1">Expected Close Date</label>
                        <input
                            type="date"
                            value={data.expected_close_date}
                            onChange={e => setData('expected_close_date', e.target.value)}
                            className="w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                        />
                    </div>

                    {data.stage === 'lost' && (
                        <div>
                            <label className="block text-xs font-medium text-navy-300 mb-1">Lost Reason</label>
                            <input
                                value={data.lost_reason}
                                onChange={e => setData('lost_reason', e.target.value)}
                                placeholder="e.g. Budget cut, chose competitor..."
                                className="w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-navy-300 mb-1">
                            Requested Products / Items
                            <span className="ml-1 text-navy-500 font-normal">(free text — not limited to inventory)</span>
                        </label>
                        <textarea
                            value={data.requested_items}
                            onChange={e => setData('requested_items', e.target.value)}
                            rows={4}
                            placeholder={"e.g.\n3x Laptop ASUS ROG\n5x Custom Cable Assembly\n2x Product not yet in inventory"}
                            className="w-full px-3 py-3 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-600 focus:outline-none focus:ring-2 focus:ring-gold-500/30 resize-y min-h-[96px]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-navy-300 mb-1">Notes</label>
                        <textarea
                            value={data.note}
                            onChange={e => setData('note', e.target.value)}
                            rows={4}
                            placeholder="Additional context, terms, follow-up actions..."
                            className="w-full px-3 py-3 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-600 focus:outline-none focus:ring-2 focus:ring-gold-500/30 resize-y min-h-[96px]"
                        />
                    </div>

                    {/* Low stock warning */}
                    {lowStock.length > 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-xs font-medium text-amber-300">Low Stock Alert</span>
                            </div>
                            <div className="space-y-0.5">
                                {lowStock.slice(0, 3).map(i => (
                                    <p key={i.id} className="text-[10px] text-amber-200">{i.product} — {i.qty} units left</p>
                                ))}
                                {lowStock.length > 3 && <p className="text-[10px] text-amber-400">+{lowStock.length - 3} more</p>}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 pt-1">
                        <Button type="submit" disabled={processing} className="flex-1">
                            {editing ? 'Save Changes' : 'Create Opportunity'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PipelineCard({ pipeline, stageColor, onEdit, onDelete, onDragStart }) {
    const [expanded, setExpanded] = useState(false);

    const orderUrl = pipeline.channel_id
        ? `/orders/create?channel_id=${pipeline.channel_id}&pipeline_id=${pipeline.id}`
        : '/orders/create';

    const ch = pipeline.channel;

    return (
        <div
            draggable
            onDragStart={() => onDragStart(pipeline.id)}
            className={`group relative rounded-xl border ${stageColor} p-3 cursor-grab active:cursor-grabbing bg-navy-900/80 hover:bg-navy-900 transition select-none`}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-white leading-snug flex-1">{pipeline.title}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button onClick={() => onEdit(pipeline)} className="p-1 rounded hover:bg-white/10 text-navy-400 hover:text-white transition">
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(pipeline)} className="p-1 rounded hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {ch && (
                <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-navy-400 truncate">{ch.company_name}</p>
                    {/* Order stats from channel */}
                    {(ch.successful_order > 0 || ch.pending_order > 0) && (
                        <span className="text-[10px] text-navy-500 shrink-0 ml-2">
                            {ch.successful_order ?? 0}✓ {ch.pending_order ?? 0}⏳
                        </span>
                    )}
                </div>
            )}

            <div className="flex items-center gap-2 mt-2">
                {pipeline.value && (
                    <span className="text-xs font-semibold text-gold-400">{formatCompact(pipeline.value)}</span>
                )}
                <span className="text-[10px] text-navy-500 ml-auto">{pipeline.probability}%</span>
                <DaysChip date={pipeline.expected_close_date} />
            </div>

            {/* Probability bar */}
            <div className="mt-2 h-1 bg-navy-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${pipeline.stage === 'won' ? 'bg-emerald-500' : pipeline.stage === 'lost' ? 'bg-red-500' : 'bg-gold-500'}`}
                    style={{ width: `${pipeline.probability}%` }}
                />
            </div>

            {/* Create Order CTA for Won deals */}
            {pipeline.stage === 'won' && (
                <Link
                    href={orderUrl}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 hover:bg-emerald-500/20 transition"
                    onClick={e => e.stopPropagation()}
                >
                    <ShoppingCart className="w-3 h-3" /> Create Order
                </Link>
            )}

            {(pipeline.note || pipeline.lost_reason || pipeline.requested_items) && (
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="flex items-center gap-1 mt-2 text-[10px] text-navy-500 hover:text-navy-300 transition"
                >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? 'Less' : 'More'}
                </button>
            )}
            {expanded && (
                <div className="mt-2 space-y-2">
                    {pipeline.lost_reason && (
                        <p className="text-xs text-red-400 italic">Lost: {pipeline.lost_reason}</p>
                    )}
                    {pipeline.requested_items && (
                        <div>
                            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-0.5">Requested</p>
                            <p className="text-xs text-navy-300 whitespace-pre-line">{pipeline.requested_items}</p>
                        </div>
                    )}
                    {pipeline.note && (
                        <div>
                            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-0.5">Note</p>
                            <p className="text-xs text-navy-400 whitespace-pre-line">{pipeline.note}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function Index({ grouped, totalValue, weightedValue, channels, inventories }) {
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [draggingId, setDraggingId] = useState(null);
    const [dragOverStage, setDragOverStage] = useState(null);

    const handleDragStart = (id) => setDraggingId(id);
    const handleDragOver = (e, stage) => { e.preventDefault(); setDragOverStage(stage); };

    const handleDrop = (e, targetStage) => {
        e.preventDefault();
        if (!draggingId) return;
        router.put(`/pipeline/${draggingId}`, { stage: targetStage }, { preserveScroll: true });
        setDraggingId(null);
        setDragOverStage(null);
    };

    const handleDelete = (pipeline) => {
        if (!confirm(`Delete "${pipeline.title}"?`)) return;
        router.delete(`/pipeline/${pipeline.id}`, { preserveScroll: true });
    };

    const handleEdit = (pipeline) => {
        setEditTarget(pipeline);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditTarget(null);
    };

    const totalOpen = Object.entries(grouped)
        .filter(([k]) => !['won','lost'].includes(k))
        .reduce((n, [, arr]) => n + arr.length, 0);

    return (
        <AuthenticatedLayout title="Pipeline">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-navy-800/50 border border-white/5 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5 text-gold-400" />
                    </div>
                    <div>
                        <p className="text-xs text-navy-400">Total Pipeline Value</p>
                        <p className="text-lg font-bold text-gold-400">{formatCompact(totalValue)}</p>
                    </div>
                </div>
                <div className="bg-navy-800/50 border border-white/5 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs text-navy-400">Weighted Forecast</p>
                        <p className="text-lg font-bold text-emerald-400">{formatCompact(weightedValue)}</p>
                    </div>
                </div>
                <div className="bg-navy-800/50 border border-white/5 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Target className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-navy-400">Open Opportunities</p>
                        <p className="text-lg font-bold text-white">{totalOpen}</p>
                    </div>
                </div>
            </div>

            {/* Inventory low-stock banner */}
            {inventories.filter(i => i.qty !== null && i.qty <= 5 && i.qty > 0).length > 0 && (
                <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <Package className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-300">
                        <span className="font-semibold">{inventories.filter(i => i.qty !== null && i.qty <= 5 && i.qty > 0).length} products</span> are running low on stock — check inventory before closing deals.
                    </p>
                    <Link href="/inventory" className="ml-auto text-xs text-amber-400 hover:text-amber-300 transition shrink-0">View Inventory →</Link>
                </div>
            )}

            {/* Add button */}
            <div className="flex justify-end mb-4">
                <Button onClick={() => setShowModal(true)}>
                    <Plus className="w-4 h-4" /> Add Opportunity
                </Button>
            </div>

            {/* Kanban board */}
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                    {STAGES.map((stage) => {
                        const cards = grouped[stage.key] || [];
                        const isDragOver = dragOverStage === stage.key;
                        const stageTotal = cards.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);

                        return (
                            <div
                                key={stage.key}
                                className={`w-64 flex flex-col rounded-2xl border transition-all ${isDragOver ? 'border-gold-500/60 scale-[1.01]' : 'border-white/5'} bg-navy-800/30`}
                                onDragOver={(e) => handleDragOver(e, stage.key)}
                                onDrop={(e) => handleDrop(e, stage.key)}
                                onDragLeave={() => setDragOverStage(null)}
                            >
                                {/* Column header */}
                                <div className={`px-4 py-3 rounded-t-2xl flex items-center justify-between ${stage.header}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                                        <span className="text-sm font-semibold text-white">{stage.label}</span>
                                        <span className="text-xs text-navy-400 bg-navy-800/50 px-1.5 py-0.5 rounded-full">{cards.length}</span>
                                    </div>
                                    {stageTotal > 0 && (
                                        <span className="text-xs text-navy-300">{formatCompact(stageTotal)}</span>
                                    )}
                                </div>

                                {/* Cards */}
                                <div className="flex-1 p-3 space-y-2 min-h-[120px]">
                                    {cards.map((p) => (
                                        <PipelineCard
                                            key={p.id}
                                            pipeline={p}
                                            stageColor={stage.color}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            onDragStart={handleDragStart}
                                        />
                                    ))}
                                    {cards.length === 0 && (
                                        <div className="h-16 border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center">
                                            <span className="text-xs text-navy-600">Drop here</span>
                                        </div>
                                    )}
                                </div>

                                {/* Quick add */}
                                <div className="p-3 pt-0">
                                    <button
                                        onClick={() => { setEditTarget(null); setShowModal(true); }}
                                        className="w-full flex items-center gap-1 text-xs text-navy-500 hover:text-navy-300 py-1.5 rounded-lg hover:bg-white/5 transition justify-center"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {showModal && (
                <OpportunityModal
                    channels={channels}
                    inventories={inventories}
                    pipeline={editTarget}
                    onClose={closeModal}
                />
            )}
        </AuthenticatedLayout>
    );
}
