import { Loader2, Package, Lock, MessageCircle } from 'lucide-react';
import { formatCurrency } from '@/Lib/utils';

/* ── Inventory results for the public catalog search (server-side) ── */
export default function InventoryResults({ searching, source, loading, results, term, isDark }) {
    const visible = searching && source !== 'catalog'
        && (loading || (results && results.length > 0) || source === 'inventory');
    if (!visible) return null;

    return (
        <>
                            {searching && source !== 'catalog' && (loading || (results && results.length > 0) || source === 'inventory') && (
                                <div className="mt-8">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-sky-400 to-sky-600" />
                                        <div>
                                            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hasil dari Inventori</h2>
                                            <p className={`text-xs ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                                {loading ? 'Mencari di inventori…' : `${(results || []).length} item cocok dengan "${term}"`}
                                            </p>
                                        </div>
                                        {loading && <Loader2 className={`w-4 h-4 animate-spin ml-auto ${isDark ? 'text-navy-400' : 'text-gray-400'}`} />}
                                    </div>

                                    {!loading && (!results || results.length === 0) && (
                                        <p className={`text-sm text-center py-8 ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>
                                            Tidak ada item inventori yang cocok dengan "{term}".
                                        </p>
                                    )}
                                    {!loading && results?.length > 0 && (
                                        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/6 bg-navy-900/50' : 'border-gray-200 bg-white'}`}>
                                            {results.map((item, i) => (
                                                <div key={`inv-${i}`} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? (isDark ? 'border-t border-white/5' : 'border-t border-gray-100') : ''}`}>
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-50 text-sky-500'}`}>
                                                        <Package className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</p>
                                                        {item.spec && <p className={`text-[11px] truncate ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>{item.spec}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                                                            item.available
                                                                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20'
                                                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                        }`}>
                                                            {item.available ? 'Ready' : 'Kosong'}
                                                        </span>
                                                        {item.price != null ? (
                                                            <span className={`text-sm font-black ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(item.price)}</span>
                                                        ) : (
                                                            <span className={`hidden sm:flex items-center gap-1 text-[10px] ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>
                                                                <Lock className="w-3 h-3" /> Partner
                                                            </span>
                                                        )}
                                                        <a
                                                            href={`https://wa.me/6281910002704?text=${encodeURIComponent(`Halo, saya menemukan "${item.name}" di inventori. Mohon info harga dan ketersediaannya.`)}`}
                                                            target="_blank" rel="noopener noreferrer"
                                                            title="Tanya via WhatsApp"
                                                            className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center transition"
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
        </>
    );
}
