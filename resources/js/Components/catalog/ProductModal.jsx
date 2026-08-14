import { useEffect, useRef, useState } from 'react';
import { X, Package, Lock, KeyRound, MessageCircle } from 'lucide-react';
import { formatCurrency } from '@/Lib/utils';

/* ─── Product detail modal ───────────────────────────────────────────────── */
export default function ProductModal({ product, onClose, priceUnlocked, isDark, onPartnerLogin, hasPartnerPin }) {
    if (!product) return null;
    const isReady = product.stock_status === 'ready';
    // WhatsApp CTA with the product pre-filled so the user doesn't have to
    // describe what they're looking at.
    const waHref = 'https://wa.me/6281910002704?text=' + encodeURIComponent(
        `Halo, saya tertarik dengan produk ${product.brand} — ${product.product_name}. Mohon info harga dan ketersediaannya.`
    );

    const [descExpanded, setDescExpanded] = useState(false);
    const [isClamped, setIsClamped]       = useState(false);
    const descRef = useRef(null);

    // Re-measure whenever the product changes (reset + check if text overflows 4 lines)
    useEffect(() => {
        setDescExpanded(false);
        setIsClamped(false);
        const id = setTimeout(() => {
            if (descRef.current) {
                setIsClamped(descRef.current.scrollHeight > descRef.current.clientHeight + 1);
            }
        }, 50); // after paint
        return () => clearTimeout(id);
        // The public payload has no `id` field — key on the name instead so the
        // clamp re-measures when a different product is shown.
    }, [product?.product_name]);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ animation: 'fadeIn 0.2s ease' }} onClick={onClose}>
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
            <div
                className={`relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[88vh] ${isDark ? 'bg-navy-900 border border-white/8' : 'bg-white border border-gray-200'}`}
                style={{ animation: 'slideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`relative aspect-[16/9] overflow-hidden shrink-0 ${isDark ? 'bg-navy-800' : 'bg-gray-100'}`}>
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.product_name} className="w-full h-full object-cover" />
                    ) : (
                        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${isDark ? 'from-navy-800 to-navy-900' : 'from-gray-100 to-gray-200'}`}>
                            <Package className={`w-14 h-14 ${isDark ? 'text-navy-600' : 'text-gray-300'}`} />
                        </div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? 'from-navy-900 via-navy-900/30 to-transparent' : 'from-black/50 via-black/10 to-transparent'}`} />
                    <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition flex items-center justify-center">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-3 left-4 flex gap-2 items-center flex-wrap">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold-500 text-navy-950 shadow-lg shadow-gold-500/30">
                            {product.brand_logo && <img src={product.brand_logo} alt={product.brand} className="w-3.5 h-3.5 object-contain" />}
                            {product.brand}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/10 backdrop-blur-sm text-white border border-white/15">{product.category}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${isReady ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                            {isReady ? '● Ready Stock' : '○ Pre-Order (Inden)'}
                        </span>
                    </div>
                </div>
                <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                    <h2 className={`text-xl font-bold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.product_name}</h2>

                    {/* Selling Points */}
                    {Array.isArray(product.selling_points) && product.selling_points.length > 0 && (
                        <div className="mt-3.5">
                            <p className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Keunggulan Produk</p>
                            <ul className="space-y-1.5">
                                {product.selling_points.map((pt, i) => (
                                    <li key={i} className={`flex items-start gap-2 text-sm ${isDark ? 'text-navy-200' : 'text-gray-700'}`}>
                                        <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-gold-500/15 text-gold-400' : 'bg-amber-100 text-amber-600'}`}>
                                            <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="currentColor"><path d="M9.3 3.3 5 7.6 2.7 5.3 1.3 6.7l3.7 3.7 5.7-5.7z"/></svg>
                                        </span>
                                        {pt}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Application Scenario */}
                    {product.application_scenario && (
                        <div className="mt-3.5">
                            <p className={`text-[10px] uppercase tracking-widest font-semibold mb-1.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Skenario Penggunaan</p>
                            <p className={`text-sm leading-relaxed ${isDark ? 'text-navy-300' : 'text-gray-600'}`}>{product.application_scenario}</p>
                        </div>
                    )}

                    {product.description && (
                        <div className="mt-3.5">
                            <p className={`text-[10px] uppercase tracking-widest font-semibold mb-1.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Deskripsi</p>
                            <p
                                ref={descRef}
                                className={`text-sm leading-relaxed whitespace-pre-line transition-all duration-300 ${!descExpanded ? 'line-clamp-4' : ''} ${isDark ? 'text-navy-300' : 'text-gray-600'}`}
                            >
                                {product.description}
                            </p>
                            {(isClamped || descExpanded) && (
                                <button
                                    onClick={() => setDescExpanded(v => !v)}
                                    className={`mt-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${isDark ? 'text-gold-400 hover:text-gold-300' : 'text-amber-600 hover:text-amber-500'}`}
                                >
                                    {descExpanded ? (
                                        <><span>Sembunyikan</span><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6"/></svg></>
                                    ) : (
                                        <><span>Lihat selengkapnya</span><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg></>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        {product.special_price != null ? (
                            <div className={`rounded-2xl p-4 border ${isDark ? 'bg-gold-500/8 border-gold-500/30' : 'bg-amber-50 border-amber-300'}`}>
                                <p className={`text-[10px] uppercase tracking-widest mb-1.5 font-bold ${isDark ? 'text-gold-500' : 'text-amber-600'}`}>✦ Harga Spesial</p>
                                <p className={`text-xs line-through leading-none ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{formatCurrency(product.best_price)}</p>
                                <p className={`text-xl font-black leading-none mt-1.5 ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(product.special_price)}</p>
                            </div>
                        ) : priceUnlocked && product.best_price !== null ? (
                            <div className={`rounded-2xl p-4 border ${isDark ? 'bg-navy-800/60 border-white/6' : 'bg-slate-50 border-gray-200'}`}>
                                <p className={`text-[10px] uppercase tracking-widest mb-1.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Harga Terbaik</p>
                                <p className={`text-xl font-black leading-none ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(product.best_price)}</p>
                            </div>
                        ) : (
                            // Locked price explains itself and (when a PIN exists) is the shortcut to unlock
                            <button
                                onClick={hasPartnerPin ? onPartnerLogin : undefined}
                                disabled={!hasPartnerPin}
                                className={`rounded-2xl p-4 border text-left transition ${isDark ? 'bg-navy-800/60 border-white/6' : 'bg-slate-50 border-gray-200'} ${hasPartnerPin ? (isDark ? 'hover:border-gold-500/40 cursor-pointer' : 'hover:border-amber-300 cursor-pointer') : 'cursor-default'}`}
                            >
                                <p className={`text-[10px] uppercase tracking-widest mb-1.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Harga Terbaik</p>
                                <div className={`flex items-center gap-1.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                    <Lock className="w-4 h-4 shrink-0" />
                                    <p className="text-xs font-medium">Khusus Partner</p>
                                </div>
                                {hasPartnerPin && (
                                    <p className={`text-[10px] mt-1.5 font-semibold ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>Punya kode akses? Login →</p>
                                )}
                            </button>
                        )}
                        <div className={`rounded-2xl p-4 border ${isDark ? 'bg-navy-800/60 border-white/6' : 'bg-slate-50 border-gray-200'}`}>
                            <p className={`text-[10px] uppercase tracking-widest mb-1 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Min. Pesanan</p>
                            <p className={`text-xl font-black leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {product.moq} <span className={`text-sm font-normal ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>pcs</span>
                            </p>
                        </div>
                    </div>
                    {/* Actions — the modal used to end with "contact your sales rep"
                        but no way to do it; now ordering is one tap away. */}
                    <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                        <a
                            href={waHref} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/25"
                        >
                            <MessageCircle className="w-4 h-4" /> Tanya / Pesan via WhatsApp
                        </a>
                        {!priceUnlocked && hasPartnerPin && (
                            <button
                                onClick={onPartnerLogin}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition ${isDark ? 'border-gold-500/25 bg-gold-500/8 text-gold-400 hover:bg-gold-500/15' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                            >
                                <KeyRound className="w-4 h-4" /> Login Partner
                            </button>
                        )}
                    </div>
                    <p className={`mt-3 text-center text-[11px] ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>
                        Sales kami akan membalas dengan harga &amp; ketersediaan terbaru.
                    </p>
                </div>
            </div>
        </div>
    );
}
