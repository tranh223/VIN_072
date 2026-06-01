import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { resetPassword } from '../../api/client';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_REQUIREMENT_MESSAGE =
  'M\u1eadt kh\u1ea9u ph\u1ea3i c\u00f3 8 k\u00ed t\u1ef1 tr\u1edf l\u00ean, g\u1ed3m:\n' +
  '- K\u00ed t\u1ef1 in hoa\n' +
  '- K\u00ed t\u1ef1 in th\u01b0\u1eddng\n' +
  '- K\u00ed t\u1ef1 \u0111\u1eb7c bi\u1ec7t\n' +
  '- S\u1ed1';
const AUTH_BG_IMG = '/thue.jpg';

export default function ResetPassword() {
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') ?? '', [location.search]);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!token) {
      setError('Phiên đặt lại mật khẩu không hợp lệ hoặc thiếu mã xác minh.');
      return;
    }
    if (!PASSWORD_PATTERN.test(password)) {
      setError('Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetPassword({ token, password });
      setMessage(res.message);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#181335] px-6 py-12">
      <div className="absolute inset-0" aria-hidden>
        <img src={AUTH_BG_IMG} alt="" className="size-full scale-110 object-cover object-center opacity-45 blur-[5px] saturate-75" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#17112f]/78 via-[#2a2456]/72 to-primary/62" />
        <div className="absolute inset-0 bg-white/8" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.10),transparent_38%),radial-gradient(circle_at_75%_65%,rgba(98,54,194,0.16),transparent_34%)]" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
      </div>
      <section className="relative z-10 w-full max-w-[430px] rounded-3xl border border-white/60 bg-white/94 p-8 shadow-[0_28px_90px_-38px_rgba(0,0,0,0.72)] backdrop-blur-xl">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-16 w-auto max-w-[200px]" />
          <h1 className="mt-5 font-display text-3xl font-bold text-primary">Đặt lại mật khẩu</h1>
          <p className="mt-3 text-sm leading-relaxed text-outline">
            Tạo mật khẩu mới đủ mạnh để bảo vệ tài khoản Scaify của bạn.
          </p>
        </div>

        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-1.5">
            <label className="ml-1 font-display text-[10px] font-bold uppercase tracking-widest text-outline">
              Mật khẩu mới
            </label>
            <div className="relative flex min-h-14 w-full items-center rounded-xl border border-outline-variant bg-white transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/5">
              <span className="pointer-events-none absolute left-3.5 text-outline">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                minLength={8}
                pattern={PASSWORD_PATTERN.source}
                onInvalid={(event) => event.currentTarget.setCustomValidity(PASSWORD_REQUIREMENT_MESSAGE)}
                onInput={(event) => event.currentTarget.setCustomValidity('')}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Chữ hoa, chữ thường, số, ký tự đặc biệt"
                className="size-full rounded-xl bg-transparent py-2 pl-11 pr-12 text-sm text-on-surface outline-none placeholder:text-outline/60"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-primary"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <p className="hidden">
              Ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.
            </p>
            <p className="ml-1 whitespace-pre-line text-[11px] leading-relaxed text-outline">
              {PASSWORD_REQUIREMENT_MESSAGE}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 font-display text-[10px] font-bold uppercase tracking-widest text-outline">
              Nhập lại mật khẩu mới
            </label>
            <div className="relative flex min-h-14 w-full items-center rounded-xl border border-outline-variant bg-white transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/5">
              <span className="pointer-events-none absolute left-3.5 text-outline">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirm_password"
                value={confirmPassword}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="size-full rounded-xl bg-transparent py-2 pl-11 pr-4 text-sm text-on-surface outline-none placeholder:text-outline/60"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          <Button type="submit" block size="lg" disabled={submitting || !token} className="gap-2 shadow-xl shadow-primary/20">
            {submitting ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            <ArrowRight size={18} />
          </Button>
        </form>

        <footer className="mt-8 text-center">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
            <ArrowLeft size={16} />
            Quay lại đăng nhập
          </Link>
        </footer>
      </section>
    </main>
  );
}
