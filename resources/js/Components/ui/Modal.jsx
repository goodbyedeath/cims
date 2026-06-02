import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ show, onClose, title, children, maxWidth = 'max-w-lg' }) {
    return (
        <AnimatePresence>
            {show && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className={`${maxWidth} w-full max-h-[90vh] bg-navy-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col`}
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                                <h3 className="text-lg font-semibold text-white">{title}</h3>
                                <button onClick={onClose} className="p-1 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto">{children}</div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
