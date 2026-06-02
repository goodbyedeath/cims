import { router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { gradeColor } from '@/Lib/utils';
import { Brain, RefreshCw, Search, Minus } from 'lucide-react';
import { useState } from 'react';

function ScoreBar({ value, color }) {
    const pct = Math.min(100, Math.max(0, Number(value) || 0));
    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-medium text-navy-200 w-8 tabular-nums">{pct}</span>
        </div>
    );
}

function Recommendation({ text }) {
    if (!text) return <span className="text-navy-600 flex items-center gap-1"><Minus className="w-3 h-3" /> Not scored</span>;
    const idx = text.indexOf('|'); const title = idx < 0 ? text : text.slice(0, idx); const detail = idx < 0 ? null : text.slice(idx + 1);
    return (
        <div className="space-y-0.5 min-w-[180px]">
            <p className="text-xs font-semibold text-white leading-snug">{title}</p>
            {detail && <p className="text-xs text-navy-400 leading-snug">{detail}</p>}
        </div>
    );
}

export default function AiScores({ channels, filters }) {
    const [search, setSearch] = useState(filters.search || '');
    const [recalculating, setRecalculating] = useState(false);

    const handleFilter = (key, value) => {
        router.get('/ai-scores', { ...filters, [key]: value, page: 1 }, { preserveState: true });
    };

    const handleRecalculate = () => {
        setRecalculating(true);
        router.post('/ai-scores/recalculate', {}, {
            onFinish: () => setRecalculating(false),
        });
    };

    return (
        <AuthenticatedLayout title="AI Intelligence Scores">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <form onSubmit={(e) => { e.preventDefault(); handleFilter('search', search); }} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search channels..."
                            className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-full sm:w-64"
                        />
                    </form>
                    <Select
                        value={filters.grade || ''}
                        onChange={(e) => handleFilter('grade', e.target.value)}
                        placeholder="All Grades"
                        options={[
                            { value: 'platinum', label: 'Platinum' },
                            { value: 'gold', label: 'Gold' },
                            { value: 'silver', label: 'Silver' },
                            { value: 'risk', label: 'Risk' },
                        ]}
                    />
                </div>
                <Button onClick={handleRecalculate} disabled={recalculating} variant="secondary">
                    <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
                    {recalculating ? 'Recalculating...' : 'Recalculate All'}
                </Button>
            </div>

            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Channel</Th>
                            <Th>Grade</Th>
                            <Th>Score</Th>
                            <Th>Repeat Prob.</Th>
                            <Th>Churn Risk</Th>
                            <Th>Payment Risk</Th>
                            <Th>Growth</Th>
                            <Th>Recommendation</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {channels.data?.length === 0 && (
                            <Tr><Td colSpan={8} className="text-center py-10 text-navy-500">No channels found.</Td></Tr>
                        )}
                        {channels.data?.map((ch) => {
                            const noActivity = !ch.performance_score || Number(ch.performance_score) === 0;
                            return (
                                <Tr key={ch.id}>
                                    <Td>
                                        <p className="font-medium text-white">{ch.company_name}</p>
                                        <p className="text-xs text-navy-400 font-mono">{ch.channel_code}</p>
                                    </Td>
                                    <Td><Badge className={gradeColor(ch.channel_grade)}>{ch.channel_grade}</Badge></Td>
                                    <Td>
                                        {noActivity
                                            ? <span className="text-xs text-navy-500 italic">no data</span>
                                            : <span className="font-bold text-gold-400 tabular-nums">{ch.performance_score}</span>
                                        }
                                    </Td>
                                    <Td><ScoreBar value={ch.ai_score?.repeat_probability ?? 0} color="bg-emerald-500" /></Td>
                                    <Td><ScoreBar value={ch.ai_score?.risk_churn_score ?? 0} color="bg-red-500" /></Td>
                                    <Td><ScoreBar value={ch.ai_score?.payment_risk_score ?? 0} color="bg-yellow-500" /></Td>
                                    <Td><ScoreBar value={ch.ai_score?.growth_score ?? 0} color="bg-indigo-500" /></Td>
                                    <Td>
                                        <Recommendation text={ch.ai_score?.recommended_action} />
                                    </Td>
                                </Tr>
                            );
                        })}
                    </Tbody>
                </Table>
                <Pagination links={channels.links} />
            </Card>
        </AuthenticatedLayout>
    );
}
