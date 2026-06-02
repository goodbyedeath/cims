import { cn } from '@/Lib/utils';
import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = forwardRef(({ className, label, error, peek = false, ...props }, ref) => {
    const [showPw, setShowPw] = useState(false);
    const resolvedType = peek ? (showPw ? 'text' : 'password') : props.type;

    return (
        <div className="space-y-1.5">
            {label && <label className="block text-sm font-medium text-navy-200">{label}</label>}
            <div className={peek ? 'relative' : undefined}>
                <input
                    ref={ref}
                    className={cn(
                        'w-full px-4 py-2.5 bg-navy-800/50 border rounded-lg text-white placeholder-navy-500 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50 transition-all',
                        error ? 'border-red-500/50' : 'border-white/10',
                        peek && 'pr-10',
                        className,
                    )}
                    {...props}
                    type={resolvedType}
                />
                {peek && (
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-navy-400 hover:text-white transition"
                    >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
});

Input.displayName = 'Input';
export default Input;
