import { Package, Lock, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/Lib/utils';

/* ─── Brand card ─────────────────────────────────────────────────────────── */
export function BrandCard({ brand, index, onClick, isDark }) {
    const initials = brand.name.substring(0, 2).toUpperCase();
    return (
        <button
            onClick={() => onClick(brand.name)}
            className={`group relative flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${isDark ? 'bg-navy-900/60 border border-white/6 hover:border-gold-500/60 hover:shadow-2xl hover:shadow-gold-500/10' : 'bg-white border border-gray-200 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/10'}`}
            style={{ animation: 'cardIn 0.4s ease both', animationDelay: `${Math.min(index * 70, 560)}ms` }}
        >
            <div className={`relative w-full aspect-square overflow-hidden flex items-center justify-center p-5 bg-gradient-to-br ${isDark ? 'from-navy-800/80 to-navy-900' : 'from-gray-50 to-white'}`}>
                <div className={`w-full h-full rounded-xl sm:rounded-2xl flex items-center justify-center p-4 transition-colors duration-300 ${isDark ? 'bg-white/4 border border-white/6 group-hover:bg-white/7' : 'bg-white border border-gray-100 group-hover:bg-gray-50 shadow-sm'}`}>
                    {brand.logo ? (
                        <img src={brand.logo} alt={brand.name} loading="lazy" className="w-full h-full object-contain transition-transform duration-400 group-hover:scale-110 drop-shadow-lg" />
                    ) : (
                        <span className={`text-3xl sm:text-4xl font-black bg-clip-text text-transparent select-none ${isDark ? 'bg-gradient-to-br from-navy-500 to-navy-700' : 'bg-gradient-to-br from-gray-300 to-gray-500'}`}>{initials}</span>
                    )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-gold-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
            <div className={`px-3 py-3 sm:px-4 sm:py-3.5 border-t transition-colors duration-300 ${isDark ? 'bg-gradient-to-b from-navy-900/0 to-navy-900/80 border-white/5 group-hover:border-gold-500/20' : 'bg-white border-gray-100 group-hover:border-amber-200'}`}>
                <p className={`text-sm font-bold text-center truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{brand.name}</p>
                <p className={`text-[10px] text-center mt-0.5 transition-colors ${isDark ? 'text-navy-500 group-hover:text-navy-400' : 'text-gray-400'}`}>{brand.count} produk</p>
            </div>
            <div className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100 ${isDark ? 'bg-navy-950/80' : 'bg-white shadow-sm'}`}>
                <ChevronRight className={`w-3 h-3 ${isDark ? 'text-gold-400' : 'text-amber-500'}`} />
            </div>
        </button>
    );
}

/* ─── Product card ───────────────────────────────────────────────────────── */
export function ProductCard({ product, index, onClick, priceUnlocked, isDark }) {
    const isReady = product.stock_status === 'ready';
    return (
        <button
            onClick={() => onClick(product)}
            className={`group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 flex flex-col ${isDark ? 'bg-navy-900/60 border border-white/6 hover:border-gold-500/50 hover:shadow-xl hover:shadow-gold-500/8' : 'bg-white border border-gray-200 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/10'}`}
            style={{ animation: 'cardIn 0.35s ease both', animationDelay: `${Math.min(index * 45, 450)}ms` }}
        >
            <div className={`relative aspect-[4/3] overflow-hidden shrink-0 bg-gradient-to-br ${isDark ? 'from-navy-800 to-navy-900' : 'from-gray-100 to-gray-200'}`}>
                {product.image_url ? (
                    <img src={product.image_url} alt={product.product_name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Package className={`w-10 h-10 ${isDark ? 'text-navy-700' : 'text-gray-300'}`} />
                    </div>
                )}
                <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? 'from-navy-950/70 via-transparent to-transparent' : 'from-black/20 via-transparent to-transparent'}`} />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-250">
                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold-500 text-navy-950 text-[11px] font-bold uppercase tracking-wide shadow-xl shadow-gold-500/40 translate-y-1 group-hover:translate-y-0 transition-transform duration-250">
                        Lihat Detail <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                </div>
                <span className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full backdrop-blur-sm ${isReady ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25' : 'bg-amber-500/20 text-amber-300 border border-amber-500/25'}`}>
                    {isReady ? 'Ready' : 'Inden'}
                </span>
            </div>
            <div className="p-3 sm:p-4 flex-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>
                        {product.brand_logo && <img src={product.brand_logo} alt={product.brand} className="w-3 h-3 object-contain" />}
                        {product.brand}
                    </span>
                    <span className={isDark ? 'text-navy-700' : 'text-gray-300'}>·</span>
                    <span className={`text-[9px] uppercase tracking-widest font-semibold ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{product.category}</span>
                </div>
                <h3 className={`text-sm font-semibold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {product.product_name}
                </h3>
                {product.description && (
                    <p
                        className={`text-[11px] leading-snug flex-1 ${isDark ? 'text-navy-400' : 'text-gray-500'}`}
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                        {product.description}
                    </p>
                )}
                <div className={`flex items-end justify-between gap-1 pt-1.5 border-t mt-auto ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                    {product.special_price != null ? (
                        <div>
                            <p className={`text-[10px] line-through leading-none ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{formatCurrency(product.best_price)}</p>
                            <p className={`text-base font-black leading-none mt-1 ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(product.special_price)}</p>
                        </div>
                    ) : priceUnlocked && product.best_price !== null ? (
                        <p className={`text-base font-black leading-none ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(product.best_price)}</p>
                    ) : (
                        <div className={`flex items-center gap-1 ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>
                            <Lock className="w-3 h-3" />
                            <span className="text-[10px] font-medium">Harga Partner</span>
                        </div>
                    )}
                    <p className={`text-[10px] ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>min {product.moq} pcs</p>
                </div>
            </div>
        </button>
    );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
/* ─── Hero product card ──────────────────────────────────────────────────── */
export function HeroProductCard({ product, index, onClick, priceUnlocked, isDark }) {
    const isReady = product.stock_status === 'ready';
    const points  = Array.isArray(product.selling_points) ? product.selling_points.slice(0, 5) : [];

    return (
        <button
            onClick={() => onClick(product)}
            className={`group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 flex flex-col shrink-0 w-64 sm:w-auto ${isDark ? 'bg-navy-900/70 border border-white/8 hover:border-gold-500/50 hover:shadow-xl hover:shadow-gold-500/10' : 'bg-white border border-gray-200 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/10'}`}
            style={{ animation: 'cardIn 0.35s ease both', animationDelay: `${Math.min(index * 70, 420)}ms` }}
        >
            <div className={`relative aspect-video overflow-hidden shrink-0 ${isDark ? 'bg-navy-800' : 'bg-gray-100'}`}>
                {product.image_url ? (
                    <img src={product.image_url} alt={product.product_name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Package className={`w-10 h-10 ${isDark ? 'text-navy-700' : 'text-gray-300'}`} />
                    </div>
                )}
                <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? 'from-navy-950/80 via-transparent to-transparent' : 'from-black/30 via-transparent to-transparent'}`} />
                <div className="absolute bottom-2.5 left-3 flex gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-gold-500 text-navy-950 shadow shadow-gold-500/30">
                        {product.brand_logo && <img src={product.brand_logo} alt={product.brand} className="w-3 h-3 object-contain" />}
                        {product.brand}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${isReady ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {isReady ? '● Ready' : '○ Inden'}
                    </span>
                </div>
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-gold-500/25 border border-gold-500/35 text-[9px] font-bold uppercase tracking-widest text-gold-300 backdrop-blur-sm">
                    Unggulan
                </div>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-2.5">
                <div>
                    <span className={`text-[9px] uppercase tracking-widest font-semibold ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{product.category}</span>
                    <h3 className={`text-sm font-bold leading-snug mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {product.product_name}
                    </h3>
                </div>
                {points.length > 0 ? (
                    <ul className="space-y-1">
                        {points.map((pt, i) => (
                            <li key={i} className={`flex items-start gap-1.5 text-[11px] leading-snug ${isDark ? 'text-navy-300' : 'text-gray-600'}`}>
                                <span className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-gold-500/15 text-gold-400' : 'bg-amber-100 text-amber-600'}`}>
                                    <svg className="w-2 h-2" viewBox="0 0 12 12" fill="currentColor"><path d="M9.3 3.3 5 7.6 2.7 5.3 1.3 6.7l3.7 3.7 5.7-5.7z"/></svg>
                                </span>
                                {pt}
                            </li>
                        ))}
                    </ul>
                ) : product.description && (
                    <p
                        className={`text-[11px] leading-snug ${isDark ? 'text-navy-300' : 'text-gray-600'}`}
                        style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                        {product.description}
                    </p>
                )}
                <div className={`flex items-center justify-between pt-2.5 mt-auto border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                    {product.special_price != null ? (
                        <div>
                            <p className={`text-[10px] line-through leading-none ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{formatCurrency(product.best_price)}</p>
                            <p className={`text-base font-black leading-none mt-1 ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(product.special_price)}</p>
                        </div>
                    ) : priceUnlocked && product.best_price !== null ? (
                        <p className={`text-base font-black leading-none ${isDark ? 'text-gold-400' : 'text-amber-600'}`}>{formatCurrency(product.best_price)}</p>
                    ) : (
                        <div className={`flex items-center gap-1 ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>
                            <Lock className="w-3 h-3" />
                            <span className="text-[10px] font-medium">Harga Partner</span>
                        </div>
                    )}
                    <span className={`text-[10px] ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>min {product.moq} pcs</span>
                </div>
            </div>
        </button>
    );
}
