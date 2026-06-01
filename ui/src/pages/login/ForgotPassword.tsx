import { ArrowLeft, ArrowRight, KeyRound, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { forgotPassword, verifyResetCode } from '../../api/client';

const GMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@gmail\.com$/;
const AUTH_BG_IMG = '/thue.jpg';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!GMAIL_PATTERN.test(normalizedEmail)) {
      setError('Email phải là Gmail hợp lệ, ví dụ name@gmail.com.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await forgotPassword({ email: normalizedEmail });
      setMessage(res.message);
      setEmail(normalizedEmail);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi mã đặt lại mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '');
    if (!GMAIL_PATTERN.test(normalizedEmail)) {
      setError('Email phải là Gmail hợp lệ, ví dụ name@gmail.com.');
      return;
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError('Mã xác nhận phải gồm đúng 6 chữ số.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await verifyResetCode({ email: normalizedEmail, code: normalizedCode });
      navigate(`/reset-password?token=${encodeURIComponent(res.token)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xác minh mã đặt lại mật khẩu.');
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
          <h1 className="mt-5 font-display text-3xl font-bold text-primary">Lấy lại mật khẩu</h1>
          <p className="mt-3 text-sm leading-relaxed text-outline">
            {step === 'email'
              ? 'Nhập Gmail đã đăng ký. Scaify sẽ gửi mã xác nhận đặt lại mật khẩu.'
              : 'Nhập mã 6 số đã được gửi tới Gmail của bạn để tiếp tục.'}
          </p>
        </div>

        <form className="space-y-5" onSubmit={step === 'email' ? submit : verifyCode}>
          {step === 'email' ? (
            <Input
              label="Gmail"
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@gmail.com"
              leftIcon={<Mail />}
              size="lg"
              required
            />
          ) : (
            <>
              <Input
                label="Gmail"
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@gmail.com"
                leftIcon={<Mail />}
                size="lg"
                required
              />
              <Input
                label="Mã xác nhận"
                type="text"
                inputMode="numeric"
                name="code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                leftIcon={<KeyRound />}
                size="lg"
                required
              />
            </>
          )}

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

          <Button type="submit" block size="lg" disabled={submitting} className="gap-2 shadow-xl shadow-primary/20">
            {submitting
              ? step === 'email'
                ? 'Đang gửi...'
                : 'Đang xác minh...'
              : step === 'email'
                ? 'Gửi mã xác nhận'
                : 'Xác nhận mã'}
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
