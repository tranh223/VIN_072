import { ArrowRight, BookOpen, CheckSquare, FileSearch, FileText, ShieldAlert, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const NEWS_IMAGE_FALLBACK = '/thue.jpg';

const NEWS_GOALS = [
  {
    icon: FileSearch,
    title: 'Đối soát dữ liệu đúng hơn',
    desc: 'CSV, chứng từ và sổ tự ghi — biết cần kiểm tra gì trước khi kê khai.',
  },
  {
    icon: ShieldAlert,
    title: 'Đọc cảnh báo đúng hơn',
    desc: 'Hiểu cảnh báo dữ liệu, đối soát và ngưỡng doanh thu trong Scaify.',
  },
  {
    icon: CheckSquare,
    title: 'Chuẩn bị hồ sơ đúng hơn',
    desc: 'Checklist chứng từ và hướng dẫn gửi kế toán đầy đủ, đúng kỳ.',
  },
] as const;

const ARTICLES = [
  {
    tag: 'Kiến thức',
    title: 'Cảnh báo: Khi nào doanh thu chạm ngưỡng 1 tỷ VND/năm? (NĐ 1-41/2026)',
    desc: 'Hiểu rõ các mốc doanh thu chịu thuế và tại sao bạn cần theo dõi sát sao nếu bán hàng trên nền tảng không thanh toán.',
    icon: ShieldAlert,
    href: '/about',
    date: '10/05/2026',
    image: '/news/article-1.jpg',
  },
  {
    tag: 'Hướng dẫn',
    title: 'Cách Scaify dùng AI (OCR/VLM) đọc ảnh chuyển khoản và hóa đơn',
    desc: 'Khám phá công nghệ trích xuất dữ liệu tự động, giúp bạn không cần phải nhập tay từng con số.',
    icon: FileText,
    href: '/about',
    date: '08/05/2026',
    image: '/news/article-2.jpg',
  },
  {
    tag: 'Sản phẩm',
    title: 'Explain Tax: Hiểu rõ từng đồng thuế phải nộp',
    desc: 'Tính năng giải thích chi tiết tại sao bạn bị áp mức thuế này, trích dẫn luật và lý do không có bù trừ (non-payment scope).',
    icon: TrendingUp,
    href: '/about',
    date: '05/05/2026',
    image: '/news/article-3.jpg',
  },
  {
    tag: 'Checklist',
    title: 'Làm sao để đối soát khi không có settlement từ sàn?',
    desc: 'Quy trình 3 bước thu thập, đối soát sổ tự ghi và xử lý cảnh báo thiếu chứng từ một cách hiệu quả.',
    icon: CheckSquare,
    href: '/about',
    date: '01/05/2026',
    image: '/news/article-4.jpg',
  },
  {
    tag: 'Cảnh báo',
    title: 'Hệ thống cảnh báo 3 tầng: Dữ liệu, Đối soát và Ngưỡng doanh thu',
    desc: 'Tìm hiểu cách Scaify phát hiện dữ liệu thiếu, lệch số giữa CSV và chứng từ (từ 5 triệu), cùng cảnh báo ngưỡng 800tr - 1 tỷ.',
    icon: ShieldAlert,
    href: '/about',
    date: '28/04/2026',
    image: '/news/article-5.jpg',
  },
  {
    tag: 'Kiến thức',
    title: 'Scaify khác gì phần mềm kế toán (MISA, KiotViet)?',
    desc: 'Điền vào khoảng trống: chúng tôi tập trung đối soát doanh thu tự ghi và chuẩn bị hồ sơ trước khi giao cho kế toán.',
    icon: BookOpen,
    href: '/about',
    date: '20/04/2026',
    image: '/news/article-6.jpg',
  },
];

function NewsArticleImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = '1';
        img.src = NEWS_IMAGE_FALLBACK;
      }}
    />
  );
}

export default function NewsPage() {
  return (
    <div className="bg-[#f7f6fb] py-16 sm:py-24 text-on-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-primary">Tin tức & Góc nhìn</p>
          <h1 className="mt-4 font-display text-4xl font-black leading-[1.18] tracking-tight text-on-surface md:text-5xl">
            Cập nhật thị trường và <br /> chính sách thuế mới nhất
          </h1>
          <p className="mt-6 text-lg text-outline leading-relaxed">
            Tài nguyên này tập trung vào đối soát dữ liệu giao dịch, checklist hồ sơ và cách hiểu các cảnh báo
            trong Scaify. Mục tiêu là giúp bạn biết nên kiểm tra gì trước khi kê khai hoặc gửi cho kế toán.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((item) => (
            <Link
              key={item.title}
              to={item.href}
              className="group relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-outline-variant/30 bg-on-surface shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20"
            >
              <div className="relative h-52 overflow-hidden">
                <NewsArticleImage
                  src={item.image}
                  alt={item.title}
                  className="transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#17142f] via-[#17142f]/25 to-transparent" />
                <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 backdrop-blur-md">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-300" />
                  <span className="font-display text-[10px] font-bold uppercase tracking-wider text-white">
                    {item.tag}
                  </span>
                </div>
                <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3 text-white">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/75">{item.date}</span>
                  <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/12 text-white/90 backdrop-blur-sm">
                    <item.icon className="size-6" />
                  </div>
                </div>
              </div>

              <div className="relative flex flex-1 flex-col justify-between p-6 text-white">
                <div>
                  <h3 className="font-display text-2xl font-bold leading-tight transition-colors group-hover:text-amber-200">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/80">{item.desc}</p>
                </div>

                <span className="mt-6 inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-amber-200">
                  Xem hướng dẫn
                  <ArrowRight className="size-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 overflow-hidden rounded-3xl border border-outline-variant/40 bg-white shadow-sm">
          <div className="grid items-stretch gap-8 p-8 lg:grid-cols-2 lg:gap-10 lg:p-10">
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Vì sao có mục này?
              </p>
              <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-on-surface md:text-3xl">
                Scaify không chỉ là dashboard, mà còn là nơi giải thích cách vận hành
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-outline">
                Mỗi bài viết ở đây nên giúp người dùng hiểu một trong ba việc. Nếu nội dung nào không phục vụ một
                trong ba mục tiêu đó, nên bỏ hoặc gộp lại.
              </p>
              <ul className="mt-8 space-y-4">
                {NEWS_GOALS.map((goal) => (
                  <li
                    key={goal.title}
                    className="flex items-start gap-4 rounded-2xl border border-outline-variant/30 bg-[#f7f6fb] p-4"
                  >
                    <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <goal.icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-on-surface">{goal.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-outline">{goal.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative min-h-[280px] overflow-hidden rounded-2xl lg:min-h-[420px]">
              <NewsArticleImage src="/news/article-3.jpg" alt="Dashboard và đối soát dữ liệu trên Scaify" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#17142f]/90 via-[#17142f]/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <p className="font-display text-xl font-bold leading-snug text-white md:text-2xl">
                  Tin tức ở đây phục vụ vận hành thực tế — không phải marketing chung chung.
                </p>
                <Link
                  to="/about"
                  className="mt-4 inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-amber-200 transition-colors hover:text-white"
                >
                  Tìm hiểu về Scaify
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
