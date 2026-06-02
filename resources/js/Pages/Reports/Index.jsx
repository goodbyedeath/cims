import { Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import { FileText, Calendar, BarChart3, Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Index() {
    const reports = [
        {
            title: 'Weekly Report',
            description: 'Overview of this week\'s orders, revenue, and channel activity.',
            icon: Calendar,
            href: '/reports/weekly',
            color: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
            iconColor: 'text-blue-400 bg-blue-500/10',
        },
        {
            title: 'Monthly Report',
            description: 'Comprehensive monthly executive report with KPIs, trends, and channel grading.',
            icon: BarChart3,
            href: '/reports/monthly',
            color: 'from-gold-500/20 to-gold-600/5 border-gold-500/20',
            iconColor: 'text-gold-400 bg-gold-500/10',
        },
    ];

    return (
        <AuthenticatedLayout title="Reports">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                {reports.map((report, index) => (
                    <motion.div
                        key={report.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Link href={report.href}>
                            <div className={`bg-gradient-to-br border rounded-2xl p-6 hover:scale-[1.02] transition-transform cursor-pointer ${report.color}`}>
                                <div className={`inline-flex p-3 rounded-xl mb-4 ${report.iconColor}`}>
                                    <report.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">{report.title}</h3>
                                <p className="text-sm text-navy-300">{report.description}</p>
                                <div className="flex items-center gap-2 mt-4 text-xs text-navy-400">
                                    <Download className="w-3.5 h-3.5" />
                                    <span>PDF export available</span>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </AuthenticatedLayout>
    );
}
