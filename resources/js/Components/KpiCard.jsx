import { motion } from 'framer-motion';
import { cn } from '@/Lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KpiCard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'gold', index = 0 }) {
    const colorMap = {
        gold: 'from-gold-500/20 to-gold-600/5 border-gold-500/20',
        emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
        blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
        red: 'from-red-500/20 to-red-600/5 border-red-500/20',
        purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
        indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/20',
    };

    const iconColorMap = {
        gold: 'text-gold-400 bg-gold-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10',
        blue: 'text-blue-400 bg-blue-500/10',
        red: 'text-red-400 bg-red-500/10',
        purple: 'text-purple-400 bg-purple-500/10',
        indigo: 'text-indigo-400 bg-indigo-500/10',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={cn(
                'bg-gradient-to-br border rounded-2xl p-5',
                colorMap[color]
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 min-w-0 flex-1">
                    <p className="text-xs font-medium text-navy-400 uppercase tracking-wider leading-tight">{title}</p>
                    <p className="text-lg font-bold text-white leading-tight break-words">{value}</p>
                    {subtitle && <p className="text-xs text-navy-400">{subtitle}</p>}
                </div>
                {Icon && (
                    <div className={cn('p-2.5 rounded-xl shrink-0', iconColorMap[color])}>
                        <Icon className="w-5 h-5" />
                    </div>
                )}
            </div>
            {trend !== undefined && (
                <div className="flex items-center gap-1.5 mt-3">
                    {trend === 'up' ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    )}
                    <span className={cn('text-xs font-medium', trend === 'up' ? 'text-emerald-400' : 'text-red-400')}>
                        {trendValue}
                    </span>
                    <span className="text-xs text-navy-500">vs last month</span>
                </div>
            )}
        </motion.div>
    );
}
