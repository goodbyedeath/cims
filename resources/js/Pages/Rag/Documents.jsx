import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import { FileText, Upload, FileType, FileX2, ArrowLeft, Search as SearchIcon, Plus } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';

function formatBytes(n) {
    if (n === null || n === undefined) return '—';
    const num = Number(n);
    if (Number.isNaN(num) || num <= 0) return '—';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / 1024 / 1024).toFixed(2)} MB`;
}

export default function RagDocuments({ documents }) {
    const items = documents?.data || [];
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter((d) =>
            (d.title || '').toLowerCase().includes(q) ||
            (d.filename || '').toLowerCase().includes(q) ||
            (d.user?.name || '').toLowerCase().includes(q)
        );
    }, [items, search]);

    const pageChunks = items.reduce((sum, d) => sum + (Number(d.chunks_indexed) || 0), 0);

    return (
        <AuthenticatedLayout title="RAG · Documents">
            {/* ── Header ── */}
            <div className="mb-4 flex items-center gap-3 flex-wrap">
                <Link href="/admin/rag" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>
                <div className="flex items-center gap-2 ml-1">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                        <FileText className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">Documents</h2>
                </div>
                <Link
                    href="/admin/rag/ingest"
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/10 text-gold-400 border border-gold-500/20 text-sm font-medium hover:bg-gold-500/20 transition"
                >
                    <Plus className="w-4 h-4" /> Ingest
                </Link>
            </div>

            <Card className="overflow-hidden p-0">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5 flex-wrap">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gold-400" />
                        <h2 className="text-sm font-semibold text-white">Ingested documents</h2>
                        <Badge className="bg-navy-700/40 text-navy-300 border-white/5">{documents?.total ?? 0} total</Badge>
                    </div>
                    {items.length > 0 && (
                        <div className="relative w-full sm:w-64">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter this page…"
                                className="w-full pl-9 pr-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            />
                        </div>
                    )}
                </div>

                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-navy-400">
                        <FileX2 className="w-10 h-10 text-navy-600 mb-3" />
                        <p className="text-sm">No documents yet.</p>
                        <Link href="/admin/rag/ingest" className="text-xs text-gold-400 hover:text-gold-300 mt-1">Ingest your first document →</Link>
                    </div>
                ) : (
                    <>
                        <Table>
                            <Thead>
                                <Tr>
                                    <Th>Title</Th>
                                    <Th>Type</Th>
                                    <Th>Chunks</Th>
                                    <Th>Size</Th>
                                    <Th>Ingested by</Th>
                                    <Th>When</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {filtered.map((d) => (
                                    <Tr key={d.id}>
                                        <Td>
                                            <p className="text-sm font-medium text-white">{d.title}</p>
                                            {d.filename && <p className="text-[11px] text-navy-500 mt-0.5 font-mono">{d.filename}</p>}
                                            <p className="text-[10px] text-navy-600 mt-0.5 font-mono">
                                                doc: {String(d.document_id).slice(0, 24)}{String(d.document_id).length > 24 ? '…' : ''}
                                            </p>
                                        </Td>
                                        <Td>
                                            {d.source === 'file' ? (
                                                <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20">
                                                    <FileType className="w-3 h-3 mr-1" /> PDF
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20">
                                                    <Upload className="w-3 h-3 mr-1" /> Text
                                                </Badge>
                                            )}
                                        </Td>
                                        <Td>
                                            <span className="font-mono text-navy-200">{d.chunks_indexed}</span>
                                        </Td>
                                        <Td className="text-navy-300">{formatBytes(d.bytes)}</Td>
                                        <Td className="text-navy-300">{d.user?.name ?? '—'}</Td>
                                        <Td className="text-navy-400 text-xs">{d.created_at?.replace('T', ' ').slice(0, 16) ?? ''}</Td>
                                    </Tr>
                                ))}
                                {filtered.length === 0 && (
                                    <Tr>
                                        <Td colSpan={6} className="text-center py-10 text-navy-400 text-sm">
                                            No documents match “{search}” on this page.
                                        </Td>
                                    </Tr>
                                )}
                            </Tbody>
                        </Table>
                        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/5 flex-wrap">
                            <p className="text-[11px] text-navy-500">
                                Showing {filtered.length} of {items.length} on this page · {pageChunks.toLocaleString()} chunks
                            </p>
                            <Pagination links={documents.links} />
                        </div>
                    </>
                )}
            </Card>
        </AuthenticatedLayout>
    );
}
