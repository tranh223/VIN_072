import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, Camera, CheckCircle2, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { changePassword, resolvePublicFileUrl, uploadUserAvatar } from '../../api/client';
import type { AuthUser } from '../../api/types';
import { pushUserNotification } from '../../utils/notifications';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

type SettingsProps = {
  currentUser?: AuthUser | null;
  onUserUpdated?: (user: AuthUser) => void;
};

function fallbackAvatar(user?: AuthUser | null): string {
  const storedAvatar = resolvePublicFileUrl(user?.url_avt);
  if (storedAvatar) return storedAvatar;
  const seed = encodeURIComponent(user?.email || user?.full_name || 'scaify-user');
  return `https://api.dicebear.com/8.x/initials/svg?seed=${seed}&backgroundColor=6236c2,7c3aed,0ea5e9`;
}

export default function Settings({ currentUser, onUserUpdated }: SettingsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastNotifiedToastRef = useRef<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const avatarUrl = useMemo(() => fallbackAvatar(currentUser), [currentUser]);
  const toastText = error || message;
  const toastIsError = Boolean(error);

  useEffect(() => {
    if (!toastText) return;
    const notificationKey = `${toastIsError ? 'error' : 'message'}:${toastText}`;
    if (lastNotifiedToastRef.current !== notificationKey) {
      lastNotifiedToastRef.current = notificationKey;
      pushUserNotification({
        title: toastIsError ? 'Cài đặt gặp lỗi' : 'Cài đặt đã cập nhật',
        detail: toastText,
        type: 'settings',
      });
    }
    const timer = window.setTimeout(() => {
      setError(null);
      setMessage(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [toastIsError, toastText]);

  const submitPasswordChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!currentUser?.id) {
      setError('Không tìm thấy tài khoản đang đăng nhập.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      setError('Mật khẩu mới cần có chữ hoa, chữ thường, số, ký tự đặc biệt và ít nhất 8 ký tự.');
      return;
    }

    setPasswordSaving(true);
    void changePassword({
      user_id: currentUser.id,
      current_password: currentPassword,
      new_password: newPassword,
    })
      .then((res) => {
        setMessage(res.message);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordFormOpen(false);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setPasswordSaving(false));
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setError(null);
    setMessage(null);
    if (!file || !currentUser?.id) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh hợp lệ.');
      return;
    }

    setAvatarSaving(true);
    void uploadUserAvatar(currentUser.id, file)
      .then((user) => {
        onUserUpdated?.(user);
        setMessage('Ảnh đại diện đã được cập nhật.');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setAvatarSaving(false));
  };

  return (
    <div className="w-full max-w-4xl px-4 py-5 sm:px-6 lg:px-7">
      <div className="border-b border-outline-variant pb-4" data-product-tour="settings-header">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-on-surface">Cài đặt tài khoản</h1>
        <p className="mt-2 text-sm text-outline">Quản lý thông tin đăng nhập, ảnh đại diện và bảo mật tài khoản.</p>
      </div>

      <div className="grid gap-5 py-4 lg:grid-cols-[minmax(0,520px)_1fr]">
        <div className="min-w-0 space-y-5">
          <section className="space-y-3" data-product-tour="settings-profile">
            <div>
              <h2 className="font-display text-lg font-bold text-on-surface">Thông tin cá nhân</h2>
              <p className="mt-1 text-sm text-outline">Các thông tin này dùng để nhận diện tài khoản trong hệ thống.</p>
            </div>

            <label className="block max-w-xl">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-on-surface">
                <User className="size-4 text-primary" /> Tên
              </span>
              <input
                value={currentUser?.full_name || ''}
                readOnly
                className="h-10 w-full rounded-lg border border-outline-variant bg-surface/50 px-3 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="block max-w-xl">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-on-surface">
                <Mail className="size-4 text-primary" /> Gmail
              </span>
              <input
                value={currentUser?.email || ''}
                readOnly
                className="h-10 w-full rounded-lg border border-outline-variant bg-surface/50 px-3 text-sm text-on-surface outline-none"
              />
            </label>
          </section>

          <section className="space-y-3 border-t border-outline-variant pt-5" data-product-tour="settings-password">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-on-surface">Mật khẩu</h2>
                <p className="mt-1 text-sm text-outline">Đổi mật khẩu định kỳ để giữ tài khoản an toàn.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPasswordFormOpen((open) => !open);
                  setError(null);
                  setMessage(null);
                }}
                className="inline-flex items-center justify-center gap-2 text-sm font-bold text-primary transition-colors hover:text-primary/75"
              >
                {passwordFormOpen ? 'Hủy' : 'Đổi mật khẩu'}
              </button>
            </div>

            {passwordFormOpen && (
            <form className="max-w-xl space-y-3" onSubmit={submitPasswordChange}>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-on-surface">
                  <Lock className="size-4 text-primary" /> Mật khẩu hiện tại
                </span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="h-10 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 text-sm font-bold text-on-surface">Mật khẩu mới</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-10 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 text-sm font-bold text-on-surface">Nhập lại mật khẩu mới</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-10 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white shadow-lg shadow-primary/15 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="size-4" />
                {passwordSaving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </form>
            )}
          </section>
        </div>

        <aside className="text-center lg:justify-self-end" data-product-tour="settings-avatar">
          <h2 className="mb-4 font-display text-lg font-bold text-on-surface">Ảnh đại diện</h2>
          <div className="relative inline-block">
            <img
              src={avatarUrl}
              alt=""
              className="size-44 rounded-full border border-outline-variant bg-surface object-cover shadow-sm"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarSaving}
              className="absolute bottom-2 left-3 inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 text-sm font-semibold text-on-surface shadow-sm transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Camera className="size-4" />
              {avatarSaving ? 'Đang tải...' : 'Đổi ảnh'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div> 
        </aside>
      </div>

      {toastText && (
        <div
          className={`fixed right-5 top-20 z-50 flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-2xl shadow-black/10 ${
            toastIsError ? 'border-red-200 text-red-700' : 'border-emerald-200 text-emerald-700'
          }`}
        >
          {toastIsError ? (
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          )}
          <p className="font-semibold leading-relaxed">{toastText}</p>
        </div>
      )}
    </div>
  );
}
