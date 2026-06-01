import { useState, useId } from 'react';
import { motion } from 'motion/react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, Mail, Menu, Phone, X } from 'lucide-react';
import Logo from '../components/Logo';
import { Button } from '../components/ui/Button';

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: 'Trang chủ', href: '/intro' },
    { label: 'Tin tức', href: '/news' },
    { label: 'Về chúng tôi', href: '/about' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f6fb] text-on-surface">
      {/* Top strip */}
      <div className="border-b border-outline-variant/30 bg-gradient-to-r from-primary/90 via-primary to-secondary/90 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-2 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
          <p className="font-display text-[11px] font-semibold tracking-wide sm:text-xs">
            Gom và đối chiếu doanh thu với chứng từ — gọn gàng trước khi kê khai hoặc gửi kế toán.
          </p>
          <Link
            to="/register"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            Dùng thử
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-outline-variant/25 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/intro" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <Logo className="h-9 w-auto max-w-[140px]" />
            <div className="hidden leading-tight sm:block">
              <span className="font-display text-base font-black tracking-tight text-primary">Scaify</span>
              <p className="font-display whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.1em] text-outline">
                Đối soát & Kiểm soát thuế
              </p>
            </div>
          </Link>

          <nav className="hidden items-stretch gap-2 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`flex h-[4.25rem] items-center gap-1 px-4 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                  location.pathname === link.href ? 'text-primary border-b-2 border-primary' : 'text-outline hover:text-primary'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="hidden sm:block">
              <Button variant="outline" size="sm" type="button" className="border-2">
                Đăng nhập
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" type="button" className="shadow-lg shadow-primary/20">
                Bắt đầu miễn phí
              </Button>
            </Link>
            <button
              type="button"
              className="inline-flex rounded-xl border border-outline-variant/50 p-2 text-on-surface lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/40 p-4">
                <span className="font-display text-sm font-bold">Menu</span>
                <button type="button" className="rounded-lg p-2 hover:bg-surface" onClick={() => setMobileOpen(false)}>
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-lg px-3 py-3 text-sm font-medium ${
                      location.pathname === link.href ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="space-y-2 border-t border-outline-variant/40 p-4">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block w-full">
                  <Button variant="outline" block type="button">
                    Đăng nhập
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block w-full">
                  <Button block type="button">
                    Đăng ký miễn phí
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/30 bg-gradient-to-b from-[#1a1535] to-[#121026] text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 backdrop-blur-md md:p-12">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h2 className="font-display text-2xl font-bold md:text-3xl">Sẵn sàng làm rõ con số của bạn?</h2>
                <p className="mt-3 max-w-xl text-white/75">
                  Đăng ký → onboarding ngay — hoặc đăng nhập nếu team đã cấp tài khoản.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/register">
                    <button type="button" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-display text-sm font-bold text-primary transition-all hover:bg-violet-50 hover:opacity-90 active:scale-[0.98]">
                      Bắt đầu miễn phí
                      <ArrowRight size={18} />
                    </button>
                  </Link>
                  <Link to="/login">
                    <button
                      type="button"
                      className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-white/40 px-6 font-display text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
                    >
                      Đăng nhập
                    </button>
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <p className="font-display text-xs font-bold uppercase tracking-wider text-white/50">Liên hệ</p>
                <a href="tel:02839303279" className="mt-4 flex items-center gap-2 font-semibold hover:text-violet-200">
                  <Phone className="size-4" />
                  (028) 3930 3279
                </a>
                <a href="mailto:support.scaify.app@gmail.com" className="mt-3 flex items-center gap-2 font-semibold hover:text-violet-200">
                  <Mail className="size-4" />
                  support.scaify.app@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-10 border-t border-white/10 pt-10 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-wider text-white/45">Điều hướng</p>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                <li><Link to="/intro" className="hover:text-white">Trang chủ</Link></li>
                <li><Link to="/news" className="hover:text-white">Tin tức</Link></li>
                <li><Link to="/about" className="hover:text-white">Về chúng tôi</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-wider text-white/45">Tài khoản</p>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                <li><Link to="/login" className="hover:text-white">Đăng nhập</Link></li>
                <li><Link to="/register" className="hover:text-white">Tạo tài khoản</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-wider text-white/45">Pháp lý</p>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                <li><span className="cursor-default">Chính sách bảo mật</span></li>
                <li><span className="cursor-default">Điều khoản sử dụng</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center text-xs text-white/45 sm:flex-row sm:text-left">
            <div className="flex items-center gap-2">
              <Logo className="h-8 w-auto opacity-90" />
              <span>© {new Date().getFullYear()} Scaify AI Intelligence</span>

            </div>
            <p className="text-center sm:text-right">
              Scaify — Gom và đối chiếu doanh thu với chứng từ; không thay kế toán hay đại lý thuế.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
