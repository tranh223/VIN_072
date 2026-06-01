import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useCallback, useState } from 'react';
import {
  ArrowRight, BarChart3, BookOpen, Bot, Brain, Check, FileSpreadsheet,
  HelpCircle, LayoutGrid, Lock, LineChart, PieChart, Shield, Sparkles,
  Store, Upload, Zap, Users, Info, Settings, Clock, CheckCircle2,
  AlertTriangle, RotateCcw, FileText, HeartHandshake, Target, CheckSquare,
  Package, Building2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

const HERO_IMG = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=2000&q=80';

type ChartPeriod = 'week' | 'month' | 'quarter' | 'year';

const SHOP_CHART_META: { id: string; label: string; color: string }[] = [
  { id: 'a', label: 'Shop A', color: 'from-primary to-primary-container' },
  { id: 'b', label: 'Shop B', color: 'from-violet-500 to-indigo-600' },
  { id: 'c', label: 'Shop C', color: 'from-teal-500 to-emerald-600' },
];

const SHOP_HEIGHTS: Record<ChartPeriod, [number, number, number]> = {
  week: [72, 55, 68],
  month: [85, 62, 78],
  quarter: [70, 88, 65],
  year: [92, 75, 82],
};

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  week: 'Tuần',
  month: 'Tháng',
  quarter: 'Quý',
  year: 'Năm',
};

const PRICING_TIERS: {
  id: string;
  name: string;
  badge?: string;
  priceLabel: string;
  priceHint: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
  icon: typeof Package;
}[] = [
    {
      id: 'starter',
      name: 'Starter',
      priceLabel: '0đ',
      priceHint: 'Freemium — không cần thẻ, không ràng buộc thời hạn',
      description:
        'Dùng thử workflow đối soát bằng dữ liệu thật: 10–20 upload/tháng, thấy lệch, hiểu cảnh báo.',
      features: [
        '1 shop',
        '10–20 lượt upload/tháng',
        'OCR cơ bản + cảnh báo cốt lõi',
        'Compliance score ngắn',
      ],
      cta: 'Bắt đầu miễn phí',
      href: '/register',
      icon: Zap,
    },
    {
      id: 'pro',
      name: 'Professional',
      badge: 'Phổ biến nhất',
      priceLabel: '299.000đ',
      priceHint: '/ tháng',
      description:
        'Gói chính cho shop chạy đều: đối soát sâu hơn, Explain Tax rõ hơn, báo cáo theo kỳ.',
      features: [
        'Nhiều shop theo gói',
        'Upload & đối soát mở rộng',
        'Explain Tax + monthly report',
        'Hỗ trợ email ưu tiên',
      ],
      cta: 'Trải nghiệm demo — ưu tiên mở gói',
      href: '/register',
      highlighted: true,
      icon: Sparkles,
    },
    {
      id: 'business',
      name: 'Business',
      priceLabel: 'Liên hệ',
      priceHint: 'Workspace + API theo khối lượng',
      description:
        'Dành cho kế toán dịch vụ hoặc đội nhiều shop: workspace, API và SLA riêng.',
      features: [
        'Nhiều workspace & phân quyền',
        'OCR/API theo SLA',
        'Tích hợp theo lộ trình',
        'Onboarding riêng',
      ],
      cta: 'Nhận báo giá & tư vấn gói',
      href: 'mailto:support.scaify.app@gmail.com?subject=%5BScaify%5D%20B%C3%A1o%20gi%C3%A1%20g%C3%B3i%20Business',
      icon: Building2,
    },
  ];

/** Hàng so sánh: diễn đạt theo “nhận thêm gì” khi nâng gói (tham chiếu roadmap). */
const PRICING_COMPARE_ROWS: { label: string; starter: string; pro: string; business: string }[] = [
  { label: 'Số shop', starter: '1 shop', pro: 'Theo gói', business: 'Nhiều workspace' },
  { label: 'Upload / tháng', starter: '10–20 lượt', pro: 'Cao hơn Starter', business: 'Theo SLA' },
  { label: 'Explain Tax & cảnh báo', starter: 'Nhìn được rủi ro sớm', pro: 'Đầy đủ — giải thích “vì sao”', business: 'Tuỳ chỉnh theo quy trình agency' },
  { label: 'Báo cáo & vết kiểm tra', starter: 'Bản ngắn', pro: 'Theo tháng + log', business: 'Xuất theo kỳ + nhiều workspace' },
  { label: 'API / tích hợp kế toán', starter: '—', pro: 'Lộ trình', business: 'MISA / Kiot / Sapo / Nhanh.vn' },
  { label: 'Đồng hành', starter: 'Tài liệu & cộng đồng', pro: 'Email ưu tiên', business: 'Dedicated + onboarding' },
];

const sectionMotion = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.65, ease: 'easeOut' },
} as const;

const CHATBOT_HIGHLIGHTS = [
  {
    title: 'Hỏi luật thuế bằng tiếng Việt thường ngày',
    desc: 'Không cần tra từ khóa pháp lý — đặt câu hỏi như bạn nhắn kế toán.',
    icon: HelpCircle,
  },
  {
    title: 'Căn cứ từ văn bản chính thức',
    desc: 'Câu trả lời kèm trích dẫn Nghị định, Thông tư — biết “vì sao” chứ không chỉ nghe kết luận.',
    icon: BookOpen,
  },
  {
    title: 'Gắn với cảnh báo trong app',
    desc: 'Khi có alert lệch dữ liệu, bot giúp giải thích ý nghĩa và hướng xử lý an toàn.',
    icon: Shield,
  },
] as const;

const CHATBOT_DEMO = {
  userQuestion: 'Shop bán trên Facebook, nhận chuyển khoản — cần lưu loại chứng từ nào?',
  assistantAnswer:
    'Với hình thức bán không qua sàn thanh toán tích hợp, bạn nên lưu đủ chứng cứ giao dịch theo kỳ: file doanh thu (CSV/Excel), ảnh/PDF chuyển khoản, biên nhận COD nếu có. Scaify đối soát các nguồn này để phát hiện thiếu hoặc lệch trước kỳ kê khai.',
  citations: ['NĐ 141/2026/NĐ-CP', 'TT 152/2025/TT-BTC'],
} as const;

function ChatbotMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-md lg:max-w-none"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-4 -top-4 hidden h-24 w-24 rounded-full bg-secondary/20 blur-2xl lg:block"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/50 bg-white shadow-[0_28px_70px_-28px_rgba(65,54,195,0.35)]">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="flex items-center gap-3 border-b border-outline-variant/40 bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-white"
        >
          <motion.div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <Bot className="size-5" aria-hidden />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25, duration: 0.45 }}
          >
            <p className="font-display text-sm font-bold">Kaify Bot</p>
            <p className="text-[11px] text-white/80">Trợ lý pháp lý thuế · có trích dẫn</p>
          </motion.div>
          <span className="ml-auto rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
            Online
          </span>
        </motion.div>
        <div className="space-y-4 p-4 sm:p-5">
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35, duration: 0.45 }}
            className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md bg-primary/10 px-4 py-3 text-sm text-on-surface"
          >
            {CHATBOT_DEMO.userQuestion}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.45 }}
            className="max-w-[95%] rounded-2xl rounded-tl-md border border-outline-variant/30 bg-surface-container-low/80 px-4 py-3 text-sm leading-relaxed text-on-surface"
          >
            {CHATBOT_DEMO.assistantAnswer}
            <div className="mt-3 flex flex-wrap gap-2">
              {CHATBOT_DEMO.citations.map((cite) => (
                <span
                  key={cite}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary"
                >
                  <BookOpen className="size-3 shrink-0" aria-hidden />
                  {cite}
                </span>
              ))}
            </div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.65, duration: 0.4 }}
            className="text-center text-[10px] text-outline"
          >
            Minh họa giao diện — sau đăng nhập bạn hỏi trực tiếp trong app.
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

function DashboardMock() {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
  const heights = SHOP_HEIGHTS[chartPeriod];

  return (
    <div className="relative mx-auto w-full max-w-lg hidden lg:block">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/25 via-white/40 to-secondary/15 blur-2xl" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-[0_32px_90px_-24px_rgba(65,54,195,0.35)] backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 border-b border-outline-variant/50 bg-gradient-to-r from-surface-container-low to-white px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400/90" />
            <span className="size-2.5 rounded-full bg-amber-400/90" />
            <span className="size-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <p className="ml-2 font-display text-[10px] font-bold uppercase tracking-widest text-outline">
            Scaify · Bảng điều khiển
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-[88px_1fr]">
          <div className="hidden flex-col gap-2 border-r border-outline-variant/40 bg-surface-container-low/90 p-3 md:flex">
            <div className="rounded-lg bg-primary/12 p-2 text-primary shadow-sm">
              <PieChart className="mx-auto size-5" />
            </div>
            <div className="rounded-lg p-2 text-outline transition-colors hover:bg-white">
              <Upload className="mx-auto size-5" />
            </div>
            <div className="rounded-lg p-2 text-outline transition-colors hover:bg-white">
              <Store className="mx-auto size-5" />
            </div>
          </div>
          <div className="space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-xs font-bold text-outline">Báo cáo tháng 05/2026</p>
                <p className="text-lg font-bold tracking-tight text-on-surface">Compliance Score: 85/100</p>
              </div>
              <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Đã đồng bộ
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/8 to-white p-4 shadow-sm">
                <p className="font-display text-[10px] font-bold uppercase tracking-wider text-primary">
                  Doanh thu thuần
                </p>
                <p className="mt-1 text-[10px] text-outline">Sau khi trừ chi phí / hoàn</p>
                <p className="mt-2 font-display text-2xl font-black tabular-nums tracking-tight text-on-surface">
                  128,4 tr
                </p>
              </div>
              <div className="rounded-xl border-2 border-secondary/25 bg-gradient-to-br from-secondary/8 to-white p-4 shadow-sm">
                <p className="font-display text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Lệch dữ liệu
                </p>
                <p className="mt-1 text-[10px] text-outline">Dữ liệu bán hàng vs Chứng cứ</p>
                <p className="mt-2 font-display text-2xl font-black tabular-nums tracking-tight text-red-600">
                  2 Cảnh báo
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-amber-400/50 bg-amber-500/[0.06] p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Phát hiện bất thường
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-outline">
                    Dữ liệu tháng này đang lệch giữa nguồn bán hàng và chứng cứ giao dịch. Cần tải lại file liên quan để tính toán lại.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low/80 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-on-surface">Trạng thái theo shop</span>
                </div>
                <BarChart3 className="size-4 shrink-0 text-primary" />
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                {(Object.keys(PERIOD_LABELS) as ChartPeriod[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className={`rounded-lg px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${chartPeriod === p
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-outline hover:bg-primary/10 hover:text-primary'
                      }`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
              <div className="flex h-[7rem] items-end justify-center gap-3 sm:gap-4 px-1 pt-1">
                {SHOP_CHART_META.map((shop, i) => {
                  const barPx = Math.max(28, Math.round((heights[i] / 100) * 104));
                  return (
                    <div key={shop.id} className="flex max-w-[4rem] flex-1 flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t-lg bg-gradient-to-t shadow-inner ${shop.color}`}
                        style={{ height: `${barPx}px` }}
                      />
                      <span className="text-center font-display text-[9px] font-bold uppercase tracking-wide text-outline">
                        {shop.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  const scrollToFlow = useCallback(() => {
    document.getElementById('flow')?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  const scrollToPricing = useCallback(() => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="intro-page bg-[#f7f6fb] text-on-surface overflow-hidden">
      {/* 1. Hero section */}
      <section id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="" className="size-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a1535]/95 via-[#2d265c]/95 to-primary/80" />
        </div>
        <div className="relative mx-auto grid max-w-[85rem] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
          <div className="text-white">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.16em] backdrop-blur-sm"
            >
              <Sparkles className="size-4 text-amber-200" />
              Hỗ trợ các chủ shop TMĐT trên nền tảng phi thanh toán
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.12, ease: 'easeOut' }}
              className="flex flex-col font-display text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl md:text-[2.75rem] lg:text-5xl xl:text-6xl"
            >
              <span>Scaify</span>
              <span className="whitespace-nowrap">Đối soát thông minh</span>
              <span className="whitespace-nowrap bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                Quyết toán nhẹ tênh
              </span>
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.24, ease: 'easeOut' }}
              className="mt-8 max-w-xl"
            >
              <p className="text-lg font-medium text-white/90 mb-4">Scaify giúp shop TMĐT:</p>
              <ul className="space-y-3">
                {[
                  'Gom dữ liệu từ nhiều nguồn (CSV, ảnh, PDF)',
                  'Đối soát chứng cứ giao dịch với doanh thu',
                  'Phát hiện lệch và thiếu dữ liệu theo kỳ',
                  'Theo dõi trạng thái hồ sơ theo tháng và theo kỳ',
                  'Sửa dữ liệu và kiểm tra nhanh trước khi kê khai',
                  'Chuẩn bị hồ sơ để tự khai hoặc bàn giao',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-white/80">
                    <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                    <span className="text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.36, ease: 'easeOut' }}
              className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap"
            >
              <Link to="/register" className="w-full sm:w-auto">
                <button type="button" className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 font-display text-base font-bold text-primary shadow-xl transition-all hover:bg-violet-50 hover:opacity-90">
                  Dùng thử demo
                  <ArrowRight size={20} />
                </button>
              </Link>
              <button type="button" onClick={scrollToFlow} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border-2 border-white/50 bg-white/5 px-8 py-4 font-display text-base font-bold text-white backdrop-blur-sm transition-all hover:bg-white/15">
                Xem cách hoạt động
              </button>
              <button type="button" onClick={scrollToPricing} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border-2 border-amber-200/40 bg-amber-400/15 px-8 py-4 font-display text-base font-bold text-amber-100 backdrop-blur-sm transition-all hover:bg-amber-400/25">
                Xem bảng giá
              </button>
            </motion.div>
          </div>
          <DashboardMock />
        </div>
      </section>

      {/* 2. Vấn đề của người bán */}
      <motion.section {...sectionMotion} className="py-16 sm:py-20 bg-white border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-2xl font-black tracking-tight text-on-surface md:text-3xl">
              Dữ liệu đang rải rác, rủi ro khó nhìn thấy
            </h2>
          </div>
          <div className="grid items-stretch gap-12 lg:grid-cols-2">
            <div className="h-full">
              <div className="intro-lift flex h-full flex-col justify-center rounded-2xl border border-outline-variant/50 bg-surface p-8">
                <h3 className="font-display text-lg font-bold mb-4 text-primary">Người bán TMĐT thường phải xử lý nhiều nguồn dữ liệu cùng lúc:</h3>
                <ul className="space-y-4">
                  {[
                    { icon: FileSpreadsheet, text: 'CSV/Excel từ website, Facebook, Zalo hoặc sàn nhỏ' },
                    { icon: Upload, text: 'Ảnh / PDF chứng cứ giao dịch' },
                    { icon: FileText, text: 'File báo cáo rời rạc từ các bộ phận' },
                    { icon: Clock, text: 'Lịch sử chỉnh sửa không được lưu lại' }
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg text-primary"><item.icon size={20} /></div>
                      <span className="text-outline font-medium">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="h-full">
              <div className="intro-lift flex h-full flex-col justify-center rounded-2xl border border-red-100 bg-red-50 p-8">
                <h3 className="font-display text-lg font-bold mb-6 text-red-700">Kết quả là bạn sẽ:</h3>
                <ul className="space-y-5">
                  {[
                    'Khó biết dữ liệu nào đúng',
                    'Khó biết đang lệch ở đâu',
                    'Khó theo dõi hồ sơ theo tháng',
                    'Khó chuẩn bị báo cáo cuối năm'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <AlertTriangle className="size-6 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-red-900 text-base font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3. Scaify giải quyết gì & 8. Định vị sản phẩm */}
      <motion.section {...sectionMotion} className="py-16 sm:py-20 bg-[#f7f6fb] border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4">Không chỉ là máy tính thuế</p>
            <h2 className="font-display text-2xl font-black tracking-tight text-on-surface md:text-3xl">
              Một nơi để hiểu toàn bộ dữ liệu <br className="hidden md:block" /> tài chính của shop
            </h2>
            <p className="mt-5 text-base text-outline leading-relaxed">
              Scaify không chỉ tính thuế. Scaify là <strong className="text-primary">Compliance Copilot</strong> & <strong className="text-primary">Data Room</strong> cho shop TMĐT.
            </p>
          </div>

          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Thu thập dữ liệu', desc: 'Thu thập dữ liệu từ nhiều nguồn và chuẩn bị thành hồ sơ sẵn sàng cho cuối năm.' },
              { title: 'Đối soát tự động', desc: 'Đối soát dữ liệu bán hàng với chứng cứ giao dịch để tìm ra khác biệt.' },
              { title: 'Cảnh báo sớm', desc: 'Cảnh báo dữ liệu bất thường sớm và giải thích vì sao bị cảnh báo.' },
              { title: 'Chuẩn bị hồ sơ', desc: 'Cho phép người dùng sửa dữ liệu sai, tính lại ngay và chuẩn bị hồ sơ sẵn sàng cho kỳ kê khai.' }
            ].map((feature, i) => (
              <div key={i} className="intro-lift rounded-2xl border border-outline-variant/40 bg-white p-6 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black font-display mb-4">
                  {i + 1}
                </div>
                <h3 className="text-base font-bold font-display mb-2">{feature.title}</h3>
                <p className="text-sm text-outline leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 4. Tính năng chính */}
      <motion.section {...sectionMotion} className="py-16 sm:py-20 bg-white border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-2xl font-black tracking-tight text-on-surface md:text-3xl">
              Những gì Scaify làm được
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[
              { title: '1. Upload dữ liệu', desc: 'Upload dữ liệu bán hàng và chứng cứ giao dịch trong một luồng.', icon: Upload },
              { title: '2. Đối soát tự động', desc: 'Hệ thống so sánh dữ liệu giữa nguồn bán hàng và chứng cứ để phát hiện lệch.', icon: CheckSquare },
              { title: '3. Thuế tham khảo', desc: 'Hiển thị doanh thu thuần, doanh thu quy đổi năm, GTGT, TNCN tham khảo và phần thuế đã ghi nhận.', icon: PieChart },
              { title: '4. Explain warnings', desc: 'Mỗi cảnh báo đều có giải thích ngắn gọn, dễ hiểu, có dữ liệu làm căn cứ.', icon: HelpCircle },
              { title: '5. Correction + recalculate', desc: 'Người dùng sửa dữ liệu sai, hệ thống tính lại ngay và cập nhật dashboard.', icon: RotateCcw },
              { title: '6. Monthly report', desc: 'Có báo cáo theo tháng để user quay lại theo dõi thường xuyên.', icon: BarChart3 },
              { title: '7. Mức sẵn sàng', desc: 'Cho biết hồ sơ đang ổn hay còn nhiều rủi ro cần xử lý.', icon: Shield },
              { title: '8. Audit log', desc: 'Lưu lại mọi thay đổi để dễ kiểm tra và đối chiếu.', icon: Lock },
            ].map((feat, idx) => (
              <div key={idx} className="intro-lift rounded-2xl border border-outline-variant/50 bg-surface p-6">
                <feat.icon className="size-8 text-primary mb-4" />
                <h3 className="font-display text-base font-bold mb-2">{feat.title}</h3>
                <p className="text-sm text-outline leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 5. Flow sử dụng */}
      <motion.section {...sectionMotion} id="flow" className="py-16 sm:py-20 bg-[#1a1535] text-white border-b border-outline-variant/30 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-2xl font-black tracking-tight md:text-3xl">
              Cách Scaify hoạt động
            </h2>
            <p className="mt-4 text-base text-white/70">Một quy trình chuẩn mực, tự động hóa toàn bộ công sức thủ công.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:p-12">
            <ol className="relative border-l-2 border-white/20 ml-4 md:ml-6 space-y-8">
              {[
                'Đăng nhập và Chọn shop',
                'Upload dữ liệu bán hàng và chứng cứ',
                'Hệ thống lưu lại dữ liệu & Đối soát',
                'Hệ thống báo rủi ro (Explain warnings)',
                'Người dùng sửa dữ liệu nếu cần',
                'Hệ thống tính lại tự động (Recalculate)',
                'Xem Monthly Report và Compliance Score',
                'Cuối năm xuất bộ hồ sơ tổng hợp'
              ].map((step, idx) => (
                <li key={idx} className="intro-flow-step relative ml-8 rounded-2xl px-3 py-2 md:ml-12">
                  <span className="absolute -left-[2.85rem] md:-left-[3.85rem] flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-[#1a1535] rounded-full ring-4 ring-primary text-white font-black font-display text-sm md:text-base transition-all duration-200 ease-out">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm md:text-base font-display font-bold pt-1 md:pt-2">{step}</h3>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </motion.section>

      {/* 6. Lợi ích */}
      <motion.section {...sectionMotion} className="py-16 sm:py-20 bg-white border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-2xl font-black tracking-tight text-on-surface md:text-3xl">
              Scaify giúp bạn làm gì tốt hơn?
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              'Tiết kiệm thời gian đối soát thủ công',
              'Giảm lỗi nhập liệu',
              'Dễ hiểu dữ liệu và cảnh báo',
              'Có lịch sử để xem lại bất cứ lúc nào',
              'Có báo cáo rõ ràng để làm việc với kế toán',
              'Có hồ sơ hoàn chỉnh để chuẩn bị cuối năm'
            ].map((benefit, idx) => (
              <div key={idx} className="intro-lift flex items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface p-6">
                <div className="bg-emerald-100 text-emerald-600 p-2 rounded-full shrink-0">
                  <Check className="size-6" />
                </div>
                <span className="font-medium text-on-surface text-base">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 7. Kaify Bot — Siêu trợ lý cá nhân hóa */}
      <motion.section
        {...sectionMotion}
        id="chatbot"
        className="relative overflow-hidden border-b border-black/[0.06] bg-[#0A051E] py-20 sm:py-32"
      >
        {/* Nền dark mode premium */}
        <div className="absolute inset-0">
          <div className="absolute -left-[20%] top-0 size-[40rem] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute -right-[10%] bottom-0 size-[35rem] rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
        </div>

        <div className="relative mx-auto max-w-[85rem] px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            {/* Nội dung bên trái */}
            <div className="order-2 lg:order-1">
              <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.15em] text-violet-300 backdrop-blur-sm">
                <Bot className="size-4" />
                Kaify Bot
              </div>

              <h2 className="mb-6 font-display text-4xl font-black leading-[1.1] tracking-tight text-white md:text-5xl lg:text-[3.5rem]">
                Không chỉ là AI.<br />
                Đây là{' '}
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
                  trợ lý kế toán riêng
                </span>{' '}
                của bạn.
              </h2>

              <p className="mb-8 text-lg leading-relaxed text-indigo-100/80">
                Kaify Bot vượt xa các công cụ hỏi đáp thông thường. Nó <strong className="text-white">hiểu sâu sắc bối cảnh</strong> của bạn: từ shop bạn đang quản lý, kỳ kế toán, đến từng chứng từ và cảnh báo cụ thể. Sự cá nhân hóa tuyệt đối giúp nâng tầm giá trị sản phẩm.
              </p>

              <div className="space-y-6">
                {[
                  {
                    icon: Brain,
                    title: 'Trí tuệ thấu hiểu bối cảnh',
                    desc: 'Bot phân tích đúng hồ sơ đang mở, kết hợp với RAG pháp lý để đưa ra tư vấn chính xác, sát thực tế, không chung chung.'
                  },
                  {
                    icon: HeartHandshake,
                    title: 'Cá nhân hóa như kế toán chuyên trách',
                    desc: 'Nhớ lịch sử, gợi ý xử lý chứng từ thiếu, và hướng dẫn từng bước chuẩn bị trước khi kê khai dựa trên thực trạng shop của bạn.'
                  },
                  {
                    icon: Target,
                    title: 'Ra quyết định điềm tĩnh, có căn cứ',
                    desc: 'Mọi tư vấn đều trích dẫn rõ ràng từ dữ liệu thực tế và quy định hiện hành, mang lại sự an tâm tuyệt đối.'
                  }
                ].map((feat, idx) => (
                  <div key={idx} className="group relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all hover:bg-white/10">
                    <div className="flex gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
                        <feat.icon className="size-6" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-bold text-white mb-1.5">{feat.title}</h3>
                        <p className="text-indigo-100/70 leading-relaxed text-sm">{feat.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link to="/register">
                  <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-4 font-display text-base font-bold text-white shadow-xl shadow-violet-500/30 transition-all hover:opacity-90 hover:scale-[1.02]">
                    Dùng thử demo — mở Kaify Bot
                    <ArrowRight className="size-5" />
                  </span>
                </Link>
              </div>

              <p className="mt-6 text-xs text-indigo-300/50 max-w-md">
                Nội dung bot mang tính tham khảo từ văn bản pháp luật trong hệ thống; luôn đối chiếu với cơ quan thuế hoặc chuyên gia khi ra quyết định.
              </p>
            </div>

            {/* Hình minh họa bên phải */}
            <div className="order-1 lg:order-2 relative">
              <div className="relative rounded-[2rem] border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-xl">
                <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-indigo-500 opacity-20 blur-xl" />
                <div className="relative overflow-hidden rounded-3xl bg-[#0f0d1f] aspect-square lg:aspect-auto lg:h-[600px]">
                  <img
                    src="/kaify_bot.png"
                    alt="Kaify Bot - Trợ lý AI cá nhân hóa"
                    className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                  />
                  {/* Overlay chat UI ảo */}
                  <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl">
                    <div className="flex gap-3 mb-4">
                      <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
                        <Bot size={16} />
                      </div>
                      <div className="rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm leading-relaxed text-white/95 shadow-sm border border-white/10 backdrop-blur-md">
                        <p>Dữ liệu Shop A kỳ 05/2026 có mức độ hoàn thiện 86/100. Tôi đã rà soát và thấy thiếu 3 chứng từ doanh thu. Bạn có muốn xem danh sách chi tiết để xử lý không?</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-11 flex-1 rounded-xl bg-white/5 border border-white/10 px-4 flex items-center transition-colors hover:bg-white/10">
                        <span className="text-white/40 text-sm">Nhập yêu cầu cho Kaify...</span>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/30 transition-transform hover:scale-105 cursor-pointer">
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 8. Bảng giá */}
      <motion.section {...sectionMotion} id="pricing" className="py-16 sm:py-20 bg-white border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 inline-flex items-center justify-center gap-2">
              <Package className="size-4" aria-hidden />
              Gói giá
            </p>
            <h2 className="font-display text-2xl font-black tracking-tight text-on-surface md:text-3xl">
              Bắt đầu miễn phí. Nâng gói khi bạn thấy giá trị rõ ràng.
            </h2>
            <p className="mt-4 text-base text-outline leading-relaxed">
              Thử miễn phí để xem Scaify có khớp workflow của bạn không. Khi shop chạy đều, lên gói Professional để có đối soát sâu hơn, Explain Tax rõ hơn và hỗ trợ nhanh hơn.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {PRICING_TIERS.map((tier) => {
              const Icon = tier.icon;
              const inner = (
                <>
                  {tier.highlighted && (
                    <span className="absolute -top-3 left-1/2 max-w-[min(100%,20rem)] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-primary-container px-3 py-1.5 text-center font-display text-[11px] font-bold leading-snug tracking-wide text-white shadow-md">
                      {tier.badge ?? 'Phổ biến'}
                    </span>
                  )}
                  <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${tier.highlighted ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-primary/10 text-primary'}`}>
                    <Icon className="size-6" aria-hidden />
                  </div>
                  <h3 className="font-display text-lg font-bold text-on-surface">{tier.name}</h3>
                  <div className="mt-4">
                    <p className="font-display text-3xl font-black tracking-tight text-on-surface md:text-4xl">{tier.priceLabel}</p>
                    <p className="mt-1 text-sm text-outline">{tier.priceHint}</p>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-outline">{tier.description}</p>
                  <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-outline-variant/40 pt-6">
                    {tier.features.map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-on-surface">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {tier.href.startsWith('mailto:') ? (
                    <a href={tier.href} className="mt-8 block">
                      <span className="inline-flex w-full items-center justify-center rounded-2xl border-2 border-primary/25 bg-surface px-6 py-3.5 font-display text-sm font-bold text-primary transition-colors hover:bg-primary/5">
                        {tier.cta}
                      </span>
                    </a>
                  ) : (
                    <Link to={tier.href} className="mt-8 block">
                      <span
                        className={`inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 font-display text-sm font-bold transition-all ${tier.highlighted
                          ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:opacity-95'
                          : 'border-2 border-outline-variant/60 bg-white text-on-surface hover:border-primary/40 hover:text-primary'
                          }`}
                      >
                        {tier.cta}
                      </span>
                    </Link>
                  )}
                </>
              );
              return (
                <div
                  key={tier.id}
                  className={`intro-lift relative flex flex-col rounded-3xl border p-8 shadow-sm ${tier.highlighted
                    ? 'border-primary/40 bg-gradient-to-b from-primary/[0.06] to-white ring-2 ring-primary/20 lg:scale-[1.02] lg:z-[1]'
                    : 'border-outline-variant/40 bg-surface'
                    }`}
                >
                  {inner}
                </div>
              );
            })}
          </div>

          <div className="mt-14">
            <h3 className="mb-6 text-center font-display text-sm font-bold uppercase tracking-wider text-primary">
              So sánh nhanh
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-outline-variant/50 shadow-sm">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/50 bg-surface-container-low/90">
                    <th className="px-4 py-3 font-display font-bold text-on-surface">Tiêu chí</th>
                    <th className="px-4 py-3 font-display font-bold text-on-surface">Starter</th>
                    <th className="px-4 py-3 font-display font-bold text-primary">Professional</th>
                    <th className="px-4 py-3 font-display font-bold text-on-surface">Business</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING_COMPARE_ROWS.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-b border-outline-variant/25 last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-surface/60'}`}
                    >
                      <td className="px-4 py-3 font-medium text-on-surface">{row.label}</td>
                      <td className="px-4 py-3 text-outline">{row.starter}</td>
                      <td className="bg-primary/[0.04] px-4 py-3 font-medium text-on-surface">{row.pro}</td>
                      <td className="px-4 py-3 text-outline">{row.business}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs text-outline">
              Gợi ý: giá và ưu đãi theo năm sẽ công bố khi mở bán chính thức.
            </p>
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-outline">
            Giá và giới hạn có thể thay đổi theo giai đoạn triển khai. Nội dung mang tính tham khảo, không thay thế tư vấn thuế.
          </p>
        </div>
      </motion.section>

      {/* 9. Dành cho ai */}
      <motion.section {...sectionMotion} className="py-16 sm:py-20 bg-[#f7f6fb]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-2xl font-black tracking-tight text-on-surface md:text-3xl">
              Scaify phù hợp với ai?
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Chủ shop TMĐT', desc: 'Bán hàng trên nền tảng phi thanh toán (website, Facebook, Zalo...).', icon: Store },
              { title: 'Người quản lý', desc: 'Cần theo dõi dữ liệu tài chính hàng tháng chặt chẽ.', icon: LineChart },
              { title: 'Nhà bán hàng', desc: 'Cần hồ sơ rõ ràng, minh bạch để chủ động tuân thủ thuế.', icon: Target },
              { title: 'Kế toán / Dịch vụ thuế', desc: 'Cần dữ liệu sạch để xử lý và khai báo nhanh hơn.', icon: HeartHandshake }
            ].map((audience, idx) => (
              <div key={idx} className="intro-lift rounded-3xl border border-outline-variant/30 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                  <audience.icon className="size-8" />
                </div>
                <h3 className="font-display text-lg font-bold mb-3">{audience.title}</h3>
                <p className="text-sm text-outline">{audience.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 10. Final CTA (đăng ký) */}
      <motion.section {...sectionMotion} className="py-16 sm:py-24 bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554224154-26032ffc0d04?auto=format&fit=crop&w=2000&q=80')] opacity-10 mix-blend-overlay bg-cover bg-center" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl font-black tracking-tight md:text-4xl lg:text-5xl mb-6">
            Bắt đầu với Scaify ngay hôm nay
          </h2>
          <p className="text-base text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
            Upload dữ liệu, xem cảnh báo, sửa sai và theo dõi hồ sơ của bạn theo từng tháng.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link to="/register" className="w-full sm:w-auto">
              <button type="button" className="inline-flex w-full sm:w-auto items-center justify-center rounded-2xl bg-white px-10 py-5 font-display text-lg font-bold text-primary shadow-xl transition-all hover:bg-violet-50">
                Dùng thử demo
              </button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <button type="button" className="inline-flex w-full sm:w-auto items-center justify-center rounded-2xl border-2 border-white/50 bg-white/10 px-10 py-5 font-display text-lg font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20">
                Xem cách hoạt động
              </button>
            </Link>
            <a href="mailto:support.scaify.app@gmail.com" className="w-full sm:w-auto text-white/70 hover:text-white font-medium px-4 py-4 underline underline-offset-4 text-center">
              Liên hệ team
            </a>
          </div>
          <p className="mt-8 text-center">
            <button
              type="button"
              onClick={scrollToPricing}
              className="text-sm font-medium text-white/75 underline decoration-white/40 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
            >
              Xem lại bảng giá và so sánh gói
            </button>
          </p>
        </div>
      </motion.section>
    </div>
  );
}
