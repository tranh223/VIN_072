import { Lock, Eye, EyeOff, ArrowRight, Phone, Store, LineChart, ListChecks } from 'lucide-react';
import { useState } from 'react';
import Logo from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { loginUser } from '../../api/client';
import type { AuthUser } from '../../api/types';
import { Link, useNavigate } from 'react-router-dom';

const GMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@gmail\.com$/;
const PHONE_PATTERN = /^\d{10}$/;

export default function Login({
  onLogin,
}: {
  onLogin: (user: AuthUser) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen">
      <section className="relative hidden min-h-screen w-[40%] flex-col overflow-hidden bg-primary lg:flex">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80"
            alt=""
            className="h-full w-full object-cover opacity-20 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-secondary/40" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col px-12 pb-8 pt-12">
          <div className="shrink-0 text-center">
            <div className="flex flex-col items-center gap-4">
              <Logo className="h-20 w-auto max-w-[min(100%,240px)] drop-shadow-md lg:h-24" />
              <div>
                <h1 className="text-3xl font-display font-black tracking-tighter text-white lg:text-4xl">
                  Scaify
                </h1>
                <p className="mt-2 text-xs font-display uppercase tracking-[0.22em] text-white/75">
                  Trợ lý thuế AI
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-10">
            <div className="flex w-full max-w-sm flex-col items-center">
              <div className="mb-8 h-1 w-12 bg-white" />
              <h2 className="mb-4 text-center text-3xl font-display font-bold leading-tight text-white">
                Nâng tầm quản trị thuế TMĐT với AI
              </h2>
              <p className="text-center text-sm leading-relaxed text-white/60">
                Đơn giản hóa việc đối soát dữ liệu và báo cáo tuân thủ hàng tháng cho shop TMĐT của bạn
              </p>
              <ul className="mt-8 w-full space-y-4 text-left text-sm text-white/85">
                <li className="flex gap-3">
                  <Store className="mt-0.5 size-5 shrink-0 text-white/70" aria-hidden />
                  <span>
                    <strong className="text-white">Shop đang quản lý</strong>
                    <span className="block text-white/65">Ngay sau đăng nhập bạn thấy shop nào đang gắn với tài khoản.</span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <LineChart className="mt-0.5 size-5 shrink-0 text-white/70" aria-hidden />
                  <span>
                    <strong className="text-white">Trạng thái dữ liệu</strong>
                    <span className="block text-white/65">Doanh thu, thuế ước tính, điểm tuân thủ và cảnh báo trên trang chủ.</span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <ListChecks className="mt-0.5 size-5 shrink-0 text-white/70" aria-hidden />
                  <span>
                    <strong className="text-white">Việc cần làm tiếp theo</strong>
                    <span className="block text-white/65">Gợi ý rõ: tải dữ liệu, đối soát, xử lý cảnh báo, lưu báo cáo tháng.</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-auto shrink-0 pt-6 text-center text-[10px] font-display tracking-widest text-white/40">
            © 2026 Scaify AI Intelligence
          </div>
        </div>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center bg-surface px-6 py-12 lg:px-24">
        <div className="w-full max-w-[400px]">
            <div className="mb-6">
              <Link
                to="/"
                className="font-display text-xs font-bold tracking-widest text-outline transition-colors hover:text-primary"
              >
                ← Về trang giới thiệu
              </Link>
            </div>
          <header className="mb-10 text-center lg:text-left">
            <div className="mb-8 flex flex-col items-center justify-center gap-3 lg:hidden">
              <Logo className="mx-auto h-16 w-auto max-w-[200px]" />
              <div className="text-center">
                <p className="font-display text-2xl font-black tracking-tight text-primary">Scaify</p>
                <p className="mt-1 text-[10px] font-display uppercase tracking-[0.22em] text-outline">
                  Trợ lý thuế AI
                </p>
              </div>
            </div>
            <div className="text-center mb-8"> 
              <h2 className="text-3xl font-display font-bold text-primary mb-3">Chào mừng quay trở lại!</h2>
              <p className="text-sm text-outline">Thật tuyệt khi được gặp lại bạn</p>
            </div>
          </header>

          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              const normalizedIdentifier = identifier.trim().toLowerCase();
              const loginIdentifier = normalizedIdentifier.includes('@')
                ? normalizedIdentifier
                : normalizedIdentifier.replace(/\D/g, '');
              if (normalizedIdentifier.includes('@') && !GMAIL_PATTERN.test(normalizedIdentifier)) {
                setError('Email đăng nhập phải là Gmail hợp lệ.');
                return;
              }
              if (!normalizedIdentifier.includes('@') && !PHONE_PATTERN.test(loginIdentifier)) {
                setError('Số điện thoại đăng nhập phải gồm đúng 10 chữ số.');
                return;
              }
              setSubmitting(true);
              try {
                const user = await loginUser({ identifier: loginIdentifier, password });
                onLogin(user);
                navigate('/app/Home');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Không thể đăng nhập.');
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Input
              label="Email hoặc số điện thoại"
              type="text"
              name="phone"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@gmail.com hoặc 10 chữ số"
              leftIcon={<Phone />}
              size="lg"
              required
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-outline">
                  Mật khẩu
                </span>
                <Link
                  to="/forgot-password"
                  className="text-[10px] font-display font-bold tracking-widest text-primary hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative flex w-full items-center rounded-xl border border-outline-variant bg-white transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/5">
                <span className="pointer-events-none absolute left-3.5 text-outline">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 w-full rounded-xl bg-transparent pl-11 pr-12 text-sm text-on-surface outline-none placeholder:text-outline/60"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-primary"
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            <div className="ml-1 flex items-center">
              <input
                type="checkbox"
                id="remember"
                className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
              />
              <label htmlFor="remember" className="ml-2 text-xs font-medium text-outline">
                Ghi nhớ đăng nhập
              </label>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" block size="lg" disabled={submitting} className="gap-2 shadow-xl shadow-primary/20">
              {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Button>
          </form>

          <div className="mt-8 flex flex-col items-center space-y-6">
            <div className="flex w-full items-center gap-4">
              <div className="h-px flex-1 bg-outline-variant/30" />
              <span className="font-display text-[10px] font-bold uppercase tracking-widest text-outline">
                Hoặc tiếp tục với
              </span>
              <div className="h-px flex-1 bg-outline-variant/30" />
            </div>

            <div className="grid w-full grid-cols-2 gap-4">
              {/* Google */}
              <button className="flex items-center justify-center gap-3 h-12 rounded-xl border border-outline-variant bg-white text-sm font-medium hover:bg-gray-50 transition-colors">
                <img 
                  src="https://www.google.com/favicon.ico" 
                  className="w-5 h-5 object-contain" 
                  alt="Google" 
                />
                <span className="leading-none">Google</span>
              </button>

              {/* Zalo */}
              <button className="flex items-center justify-center gap-3 h-12 rounded-xl border border-outline-variant bg-white text-sm font-medium hover:bg-gray-50 transition-colors">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" 
                  className="w-5 h-5 object-contain" 
                  alt="Zalo" 
                />
                <span className="leading-none">Zalo</span>
              </button>
            </div>
          </div>

          <footer className="mt-12 text-center">
            <p className="text-sm text-outline">
              Chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="font-bold text-primary hover:underline"
              >
                Đăng ký ngay
              </Link>
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
