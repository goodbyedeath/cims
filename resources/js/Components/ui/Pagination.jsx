import { Link } from '@inertiajs/react';
import { cn } from '@/Lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ links }) {
    if (!links || links.length <= 3) return null;

    return (
        <div className="flex items-center justify-center gap-1 mt-6">
            {links.map((link, i) => {
                if (i === 0) {
                    return link.url ? (
                        <Link key={i} href={link.url} className="p-2 rounded-lg transition text-navy-300 hover:text-white hover:bg-white/5" preserveScroll>
                            <ChevronLeft className="w-4 h-4" />
                        </Link>
                    ) : (
                        <span key={i} className="p-2 rounded-lg text-navy-600 cursor-not-allowed">
                            <ChevronLeft className="w-4 h-4" />
                        </span>
                    );
                }
                if (i === links.length - 1) {
                    return link.url ? (
                        <Link key={i} href={link.url} className="p-2 rounded-lg transition text-navy-300 hover:text-white hover:bg-white/5" preserveScroll>
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    ) : (
                        <span key={i} className="p-2 rounded-lg text-navy-600 cursor-not-allowed">
                            <ChevronRight className="w-4 h-4" />
                        </span>
                    );
                }
                return link.url ? (
                    <Link
                        key={i}
                        href={link.url}
                        className={cn(
                            'min-w-[36px] h-9 flex items-center justify-center rounded-lg text-sm font-medium transition',
                            link.active
                                ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                                : 'text-navy-300 hover:text-white hover:bg-white/5'
                        )}
                        preserveScroll
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ) : (
                    <span
                        key={i}
                        className="min-w-[36px] h-9 flex items-center justify-center rounded-lg text-sm font-medium text-navy-600"
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                );
            })}
        </div>
    );
}
