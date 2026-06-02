import { cn } from '@/Lib/utils';
import { motion } from 'framer-motion';

export default function Card({ className, children, animate = true, ...props }) {
    const Comp = animate ? motion.div : 'div';
    const animateProps = animate ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 },
    } : {};

    return (
        <Comp
            className={cn(
                'bg-navy-900 border border-white/8 rounded-2xl p-6',
                className,
            )}
            {...animateProps}
            {...props}
        >
            {children}
        </Comp>
    );
}
