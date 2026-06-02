import { useForm, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Input from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';
import { User, Lock, Shield, Clock, Camera, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function formatDateTime(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

const roleLabel = { admin: 'Administrator', spv: 'Supervisor', downline: 'Sales' };
const roleBadge = {
    admin:    'bg-purple-500/20 text-purple-400',
    spv:      'bg-blue-500/20 text-blue-400',
    downline: 'bg-emerald-500/20 text-emerald-400',
};

export default function Edit({ user }) {
    const fileInputRef = useRef(null);
    const [preview, setPreview] = useState(user.avatar_url || null);
    const [uploading, setUploading] = useState(false);
    const [lightbox, setLightbox] = useState(false);

    const profileForm = useForm({
        name:  user.name  || '',
        email: user.email || '',
        phone: user.phone || '',
    });

    const passwordForm = useForm({
        current_password:      '',
        password:              '',
        password_confirmation: '',
    });

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Live preview
        const url = URL.createObjectURL(file);
        setPreview(url);

        // Upload immediately
        const form = new FormData();
        form.append('avatar', file);
        form.append('_method', 'POST');

        setUploading(true);
        router.post('/profile/avatar', form, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => setUploading(false),
        });
    };

    const handleRemoveAvatar = () => {
        if (!confirm('Remove profile picture?')) return;
        setPreview(null);
        router.delete('/profile/avatar', { preserveScroll: true });
    };

    const submitProfile = (e) => {
        e.preventDefault();
        profileForm.put('/profile', { preserveScroll: true });
    };

    const submitPassword = (e) => {
        e.preventDefault();
        passwordForm.put('/profile/password', {
            preserveScroll: true,
            onSuccess: () => passwordForm.reset(),
        });
    };

    return (
        <AuthenticatedLayout title="My Profile">
            <div className="max-w-2xl space-y-6">

                {/* Avatar + info banner */}
                <Card animate={false}>
                    <div className="flex items-center gap-5">
                        {/* Avatar with upload overlay */}
                        <div className="relative shrink-0 group">
                            <div
                                className={`w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-gold-400 to-gold-600 transition-transform duration-150 ${preview ? 'cursor-zoom-in hover:scale-105' : ''}`}
                                onClick={() => preview && setLightbox(true)}
                            >
                                {preview
                                    ? <img src={preview} alt={user.name} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-navy-950 font-bold text-3xl">
                                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                      </div>
                                }
                            </div>

                            {/* Hover overlay — pointer-events-none when hidden so clicks reach the image */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity"
                            >
                                <Camera className="w-5 h-5 text-white" />
                            </button>

                            {uploading && (
                                <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleAvatarChange}
                                className="hidden"
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-xl font-bold text-white truncate">{user.name}</p>
                            <p className="text-sm text-navy-400 truncate">{user.email}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge[user.role] || 'bg-navy-700 text-navy-300'}`}>
                                    <Shield className="w-3 h-3" />
                                    {roleLabel[user.role] || user.role}
                                </span>
                                {user.last_login_at && (
                                    <span className="flex items-center gap-1 text-xs text-navy-500">
                                        <Clock className="w-3 h-3" />
                                        Last login: {formatDateTime(user.last_login_at)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs text-gold-400 hover:text-gold-300 transition flex items-center gap-1"
                                >
                                    <Camera className="w-3.5 h-3.5" />
                                    {preview ? 'Change photo' : 'Upload photo'}
                                </button>
                                {preview && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveAvatar}
                                        className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Profile info */}
                <Card animate={false}>
                    <div className="flex items-center gap-3 mb-5">
                        <User className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-white">Profile Information</h3>
                    </div>
                    <form onSubmit={submitProfile} className="space-y-4">
                        <Input
                            label="Full Name"
                            value={profileForm.data.name}
                            onChange={(e) => profileForm.setData('name', e.target.value)}
                            error={profileForm.errors.name}
                        />
                        <Input
                            label="Email Address"
                            type="email"
                            value={profileForm.data.email}
                            onChange={(e) => profileForm.setData('email', e.target.value)}
                            error={profileForm.errors.email}
                        />
                        <Input
                            label="Phone"
                            value={profileForm.data.phone}
                            onChange={(e) => profileForm.setData('phone', e.target.value)}
                            error={profileForm.errors.phone}
                            placeholder="e.g. 6281234567890"
                        />
                        <div className="pt-2">
                            <Button type="submit" disabled={profileForm.processing}>
                                {profileForm.processing ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Change password */}
                <Card animate={false}>
                    <div className="flex items-center gap-3 mb-5">
                        <Lock className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-white">Change Password</h3>
                    </div>
                    <form onSubmit={submitPassword} className="space-y-4">
                        <Input
                            label="Current Password"
                            type="password"
                            peek
                            value={passwordForm.data.current_password}
                            onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                            error={passwordForm.errors.current_password}
                        />
                        <Input
                            label="New Password"
                            type="password"
                            peek
                            value={passwordForm.data.password}
                            onChange={(e) => passwordForm.setData('password', e.target.value)}
                            error={passwordForm.errors.password}
                        />
                        <Input
                            label="Confirm New Password"
                            type="password"
                            peek
                            value={passwordForm.data.password_confirmation}
                            onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                            error={passwordForm.errors.password_confirmation}
                        />
                        <div className="pt-2">
                            <Button type="submit" disabled={passwordForm.processing}>
                                {passwordForm.processing ? 'Updating...' : 'Update Password'}
                            </Button>
                        </div>
                    </form>
                </Card>

            </div>
            {lightbox && preview && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    style={{ animation: 'fadeIn 0.15s ease' }}
                    onClick={() => setLightbox(false)}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

                    {/* Close button */}
                    <button
                        type="button"
                        onClick={() => setLightbox(false)}
                        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Image */}
                    <img
                        src={preview}
                        alt={user.name}
                        className="relative z-10 max-w-sm w-full max-h-[80vh] rounded-3xl object-contain shadow-2xl ring-1 ring-white/10"
                        style={{ animation: 'zoomIn 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Name label */}
                    <div
                        className="absolute bottom-8 left-0 right-0 z-10 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-white font-semibold text-base">{user.name}</p>
                        <p className="text-white/50 text-xs mt-0.5">Tap outside to close</p>
                    </div>

                    <style>{`
                        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes zoomIn  { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
                    `}</style>
                </div>,
                document.body
            )}
        </AuthenticatedLayout>
    );
}
