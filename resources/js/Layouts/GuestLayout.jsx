import { motion } from 'framer-motion';

export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 mb-4">
                        <span className="font-bold text-xl text-navy-950">CI</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white">CIMS</h1>
                    <p className="text-navy-400 text-sm mt-1">Channel Intelligence Management System</p>
                </div>
                <div className="bg-navy-900 border border-white/8 rounded-2xl p-8">
                    {children}
                </div>
            </motion.div>
        </div>
    );
}
