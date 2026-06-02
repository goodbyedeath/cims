import { router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Modal from '@/Components/ui/Modal';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { statusColor, formatDate } from '@/Lib/utils';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function Index({ users, filters, supervisors }) {
    const [search, setSearch] = useState(filters.search || '');
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '', email: '', phone: '', password: '', role: 'downline', spv_id: '', status: 'active',
    });

    const openCreate = () => {
        reset();
        setEditUser(null);
        setShowModal(true);
    };

    const openEdit = (user) => {
        setEditUser(user);
        setData({
            name: user.name, email: user.email, phone: user.phone || '',
            password: '', role: user.role, spv_id: user.spv_id || '', status: user.status,
        });
        setShowModal(true);
    };

    const submit = (e) => {
        e.preventDefault();
        if (editUser) {
            put(`/users/${editUser.id}`, { preserveScroll: true, onSuccess: () => setShowModal(false) });
        } else {
            post('/users', { preserveScroll: true, onSuccess: () => setShowModal(false) });
        }
    };

    const handleFilter = (key, value) => {
        router.get('/users', { ...filters, [key]: value, page: 1 }, { preserveState: true });
    };

    const { sort_by, sort_dir } = filters;
    const handleSort = (field, dir) => {
        router.get('/users', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    const spvUsers = supervisors || [];

    return (
        <AuthenticatedLayout title="User Management">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <form onSubmit={(e) => { e.preventDefault(); handleFilter('search', search); }} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                        <input
                            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search users..."
                            className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-full sm:w-64"
                        />
                    </form>
                    <Select value={filters.role || ''} onChange={(e) => handleFilter('role', e.target.value)} placeholder="All Roles"
                        options={[{ value: 'admin', label: 'Admin' }, { value: 'spv', label: 'SPV' }, { value: 'downline', label: 'Downline' }]}
                    />
                </div>
                <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add User</Button>
            </div>

            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <ThSortable field="name" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Name</ThSortable>
                            <ThSortable field="email" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Email</ThSortable>
                            <ThSortable field="role" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Role</ThSortable>
                            <Th>Supervisor</Th>
                            <Th>Status</Th>
                            <Th>Last Login</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {users.data?.map((user) => (
                            <Tr key={user.id}>
                                <Td className="text-white font-medium">{user.name}</Td>
                                <Td className="text-xs">{user.email}</Td>
                                <Td><Badge className="bg-navy-700 text-navy-200 border-navy-600 capitalize">{user.role}</Badge></Td>
                                <Td className="text-xs">{user.supervisor?.name || '-'}</Td>
                                <Td><Badge className={statusColor(user.status)}>{user.status}</Badge></Td>
                                <Td className="text-xs">{formatDate(user.last_login_at)}</Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => { if(confirm('Delete this user?')) router.delete(`/users/${user.id}`, { preserveScroll: true }); }}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
                <Pagination links={users.links} />
            </Card>

            <Modal show={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Edit User' : 'Create User'}>
                <form onSubmit={submit} className="space-y-4">
                    <Input label="Name" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} />
                    <Input label="Email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
                    <Input label="Phone" value={data.phone} onChange={(e) => setData('phone', e.target.value)} error={errors.phone} />
                    <Input label={editUser ? 'Password (leave empty to keep)' : 'Password'} type="password"
                        value={data.password} onChange={(e) => setData('password', e.target.value)} error={errors.password} />
                    <Select label="Role" value={data.role} onChange={(e) => setData('role', e.target.value)}
                        options={[{ value: 'admin', label: 'Admin' }, { value: 'spv', label: 'SPV' }, { value: 'downline', label: 'Downline' }]}
                        error={errors.role} />
                    {data.role === 'downline' && (
                        <Select label="Supervisor" value={data.spv_id} onChange={(e) => setData('spv_id', e.target.value)}
                            placeholder="Select supervisor" options={spvUsers.map((u) => ({ value: u.id, label: u.name }))}
                            error={errors.spv_id} />
                    )}
                    {editUser && (
                        <Select label="Status" value={data.status} onChange={(e) => setData('status', e.target.value)}
                            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                            error={errors.status} />
                    )}
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : (editUser ? 'Update' : 'Create')}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
