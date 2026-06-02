import { cn } from '@/Lib/utils';
import { forwardRef } from 'react';

const variants = {
    primary: 'bg-gradient-to-r from-gold-500 to-gold-600 text-navy-950 hover:from-gold-400 hover:to-gold-500 shadow-lg shadow-gold-500/20',
    secondary: 'bg-white/5 text-white hover:bg-white/10 border border-white/10',
    danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20',
    ghost: 'text-navy-300 hover:text-white hover:bg-white/5',
};

const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
};

const Button = forwardRef(({ className, variant = 'primary', size = 'md', disabled, children, ...props }, ref) => (
    <button
        ref={ref}
        className={cn(
            'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
            variants[variant],
            sizes[size],
            className,
        )}
        disabled={disabled}
        {...props}
    >
        {children}
    </button>
));

Button.displayName = 'Button';
export default Button;
