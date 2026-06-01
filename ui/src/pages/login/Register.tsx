import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { registerUser } from '../../api/client';
import type { AuthUser } from '../../api/types';

type RegisterProps = {
  onRegistered: (user: AuthUser) => void;
};

const GMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@gmail\.com$/;
const PHONE_PATTERN = /^\d{10}$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_REQUIREMENT_MESSAGE =
  'M\u1eadt kh\u1ea9u ph\u1ea3i c\u00f3 8 k\u00ed t\u1ef1 tr\u1edf l\u00ean, g\u1ed3m:\n' +
  '- K\u00ed t\u1ef1 in hoa\n' +
  '- K\u00ed t\u1ef1 in th\u01b0\u1eddng\n' +
  '- K\u00ed t\u1ef1 \u0111\u1eb7c bi\u1ec7t\n' +
  '- S\u1ed1';

export default function Register({ onRegistered }: RegisterProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!GMAIL_PATTERN.test(normalizedEmail)) {
      setError('Email phải là Gmail hợp lệ, ví dụ name@gmail.com.');
      return;
    }
    if (!PHONE_PATTERN.test(normalizedPhone)) {
      setError('Số điện thoại phải gồm đúng 10 chữ số.');
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
      const user = await registerUser({
        full_name: fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        password,
      });
      onRegistered(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng ký tài khoản.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen">
      <section className="relative hidden w-[40%] flex-col justify-between overflow-hidden bg-primary p-12 lg:flex">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80"
            alt=""
            className="h-full w-full object-cover opacity-20 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-secondary/40" />
        </div>
        <div className="relative z-10 flex h-full flex-col items-center justify-between py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Logo className="h-20 w-auto max-w-[min(100%,240px)] drop-shadow-md lg:h-24" />
            <div>
              <h1 className="font-display text-3xl font-black tracking-tighter text-white lg:text-4xl">
                Scaify
              </h1>
              <p className="mt-2 font-display text-xs uppercase tracking-[0.22em] text-white/75">
                Trợ lý thuế AI
              </p>
            </div>
          </div>
          <div className="flex max-w-sm flex-col items-center">
            <div className="mb-8 h-1 w-12 bg-white" />
            <h2 className="mb-4 font-display text-3xl font-bold leading-tight text-white">
              Bắt đầu quản trị thuế rõ ràng hơn
            </h2>
            <p className="text-sm leading-relaxed text-white/60">
              Tạo tài khoản để lưu hồ sơ cửa hàng, theo dõi doanh thu và lịch sử tuân thủ.
            </p>
          </div>
          <div className="font-display text-[10px] tracking-widest text-white/40">
            © 2026 Scaify AI Intelligence
          </div>
        </div>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center bg-surface px-6 py-12 lg:px-24">
        <div className="w-full max-w-[440px]">
          <header className="mb-8 text-center">
            <div className="mb-6 flex flex-col items-center justify-center gap-3 lg:hidden">
              <Logo className="mx-auto h-16 w-auto max-w-[200px]" />
            </div>
            <h2 className="mb-3 font-display text-3xl font-bold text-primary">
              Tạo tài khoản
            </h2>
            <p className="text-sm text-outline">
              Dữ liệu đăng ký sẽ được lưu vào collection users.
            </p>
          </header>

          <form className="space-y-5" onSubmit={submit}>
            <Input
              label="Họ và tên"
              name="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên"
              leftIcon={<User />}
              size="lg"
              required
            />
            <Input
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              leftIcon={<Mail />}
              size="lg"
              required
            />
            <Input
              label="Số điện thoại"
              type="tel"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Nhập số điện thoại"
              leftIcon={<Phone />}
              size="lg"
              required
            />
            <div className="space-y-1.5">
              <label className="ml-1 font-display text-[10px] font-bold uppercase tracking-widest text-outline">
                Mật khẩu
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
                  onInvalid={(e) => e.currentTarget.setCustomValidity(PASSWORD_REQUIREMENT_MESSAGE)}
                  onInput={(e) => e.currentTarget.setCustomValidity('')}
                  onChange={(e) => setPassword(e.target.value)}
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
              <p className="hidden">
                {PASSWORD_REQUIREMENT_MESSAGE}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 font-display text-[10px] font-bold uppercase tracking-widest text-outline">
                Nhập lại mật khẩu
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className="size-full rounded-xl bg-transparent py-2 pl-11 pr-12 text-sm text-on-surface outline-none placeholder:text-outline/60"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" block size="lg" disabled={submitting} className="gap-2 shadow-xl shadow-primary/20">
              {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Button>
          </form>

          <footer className="mt-8 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              <ArrowLeft size={16} />
              Quay lại đăng nhập
            </Link>
          </footer>
        </div>
      </section>
    </main>
  );
}
