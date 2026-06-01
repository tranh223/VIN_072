import { motion } from 'motion/react';
import { CheckCircle2, Shield, Clock, Target, Eye, Database, Lock, Users, Briefcase, TrendingUp, CheckSquare, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

const sectionMotion = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.65, ease: 'easeOut' },
} as const;

export default function AboutPage() {
  return (
    <div className="intro-page bg-white text-on-surface">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-[#1a1535] py-20 sm:py-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=2000&q=80')] opacity-20 mix-blend-overlay bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1a1535]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="font-display text-xs font-bold uppercase tracking-[0.2em] text-violet-300"
          >
            Về Scaify
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.12, ease: 'easeOut' }}
            className="mt-4 font-display text-4xl font-black tracking-tight text-white md:text-5xl lg:text-6xl"
          >
            Trợ lý đối soát và thuế cho <br className="hidden md:block"/> HKD nền tảng không thanh toán
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.24, ease: 'easeOut' }}
            className="mt-8 mx-auto max-w-3xl text-lg text-white/80 leading-relaxed"
          >
            Scaify được xây dựng chuyên biệt cho người bán trên Facebook, Zalo, Website, TikTok... những nền tảng không có báo cáo settlement tự động. Chúng tôi giúp bạn đối soát sổ tự ghi với chứng cứ thực tế và chuẩn bị hồ sơ thuế an toàn.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.36, ease: 'easeOut' }}
            className="mt-4 mx-auto max-w-3xl text-lg text-white/90 font-medium"
          >
            Chúng tôi tin rằng người bán không chỉ cần một con số thuế, mà cần một hệ thống giúp họ hiểu dữ liệu của mình đang ở đâu, lệch ở đâu, và cần làm gì tiếp theo.
          </motion.p>
        </div>
      </section>

      {/* 1.5. Scaify tập trung vào 4 điều cốt lõi */}
      <section className="py-16 sm:py-20 bg-[#f7f6fb] border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <h2 className="font-display text-3xl font-black tracking-tight text-on-surface md:text-4xl">
              4 điều Scaify <span className="text-primary">tập trung</span> làm tốt
            </h2>
            <p className="mt-4 text-lg text-outline">Scaify là lớp kiểm soát và chuẩn bị dữ liệu trước khi kế toán chốt số.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '01', title: 'Đối soát đa nguồn', desc: 'Gom dữ liệu từ CSV, ảnh hóa đơn, biên nhận, screenshot — đối soát tự động, phát hiện lệch sớm.' },
              { icon: '02', title: 'Cảnh báo thông minh', desc: 'Phát hiện chênh lệch ≥5% hoặc ≥5 triệu, theo dõi ngưỡng 1 tỷ, nhắc trước khi quá muộn.' },
              { icon: '03', title: 'Giải thích minh bạch', desc: 'Mọi cảnh báo đều có nguyên nhân, mọi con số thuế đều có căn cứ pháp lý đi kèm.' },
              { icon: '04', title: 'Chuẩn bị hồ sơ', desc: 'Lưu trữ chứng từ theo kỳ, phân loại rõ ràng, sẵn sàng cho kế toán hoặc tự kê khai.' }
            ].map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 border border-primary/10 hover:border-primary/30 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black font-display text-lg mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold font-display mb-2">{item.title}</h3>
                <p className="text-sm text-outline leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-base text-outline">
              <strong className="text-primary"></strong><br className="sm:hidden"/>
              <span className="hidden sm:inline"> · </span>
              Scaify tập trung vào đối soát, cảnh báo, giải thích và chuẩn bị hồ sơ — phần cốt lõi nhất cho shop TMĐT.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Chúng tôi phục vụ ai & Mang lại gì */}
      <motion.section {...sectionMotion} className="py-20 sm:py-24 bg-white border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
            <div className="intro-lift rounded-3xl border border-outline-variant/30 bg-white p-8 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl mb-6">
                <Users className="size-6" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-4">Chúng tôi phục vụ ai?</h2>
              <p className="text-lg text-outline leading-relaxed">
                Chủ hộ kinh doanh bán hàng trên các nền tảng <strong className="text-primary">không có chức năng thanh toán</strong> (Facebook, Zalo, Website, TikTok tiếp thị).
              </p>
              <p className="mt-4 text-lg text-outline leading-relaxed">
                Đây là những người thường xuyên phải tự ghi chép doanh thu thủ công, thiếu chứng từ đối soát tự động từ sàn và dễ bị hoang mang khi đối mặt với ngưỡng chịu thuế 1 tỷ VND/năm.
              </p>
            </div>
            <div className="intro-lift rounded-3xl border border-outline-variant/30 bg-white p-8 shadow-sm">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 flex items-center justify-center rounded-xl mb-6">
                <TrendingUp className="size-6" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-4">Chúng tôi mang lại</h2>
              <ul className="space-y-4">
                {[
                  'Đối soát tự động giữa dữ liệu bán hàng và chứng cứ',
                  'Minh bạch dòng tiền, kiểm soát doanh thu thực nhận',
                  'Phát hiện cảnh báo và giải thích nguyên nhân rõ ràng',
                  'Lưu trữ hồ sơ có hệ thống, sẵn sàng cho quyết toán'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-lg font-medium text-on-surface">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3. Sứ mệnh & Tầm nhìn */}
      <motion.section {...sectionMotion} className="py-20 sm:py-28 bg-[#f7f6fb] border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-3xl font-black tracking-tight text-on-surface md:text-4xl">
              Kim chỉ nam của Scaify
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="intro-lift bg-white rounded-3xl p-10 border border-outline-variant/40 shadow-sm">
              <h3 className="font-display text-2xl font-bold mb-4 text-primary">Sứ mệnh</h3>
              <p className="text-xl font-medium mb-6">
                Giúp chủ shop TMĐT kiểm soát dữ liệu, giảm sai sót và chủ động tuân thủ.
              </p>
              <p className="text-outline leading-relaxed text-lg mb-4">
                Biến các dữ liệu rời rạc thành một hệ thống xuyên suốt giúp lưu trữ, đối soát, giải thích, cảnh báo và chuẩn bị hồ sơ sẵn sàng.
              </p>
            </div>
            <div className="intro-lift bg-white rounded-3xl p-10 border border-outline-variant/40 shadow-sm">
              <h3 className="font-display text-2xl font-bold mb-4 text-primary">Tầm nhìn</h3>
              <p className="text-xl font-medium mb-6">
                Trở thành nền tảng đối soát và chuẩn bị hồ sơ số 1 cho shop TMĐT tại Việt Nam.
              </p>
              <p className="text-outline leading-relaxed text-lg mb-4">
                Không chỉ là công cụ xử lý dữ liệu, Scaify xây dựng hệ thống giúp người bán theo dõi trạng thái hồ sơ theo tháng, có báo cáo rõ ràng và lưu lịch sử đầy đủ.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 4. Giá trị cốt lõi */}
      <motion.section {...sectionMotion} className="py-20 sm:py-28 bg-white border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-3xl font-black tracking-tight text-on-surface md:text-4xl">
              5 Giá trị cốt lõi
            </h2>
            <p className="mt-4 text-lg text-outline">Nền tảng vững chắc cho mọi tính năng và cam kết của Scaify.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
            {[
              { icon: Eye, title: 'Rõ ràng', desc: 'Mọi cảnh báo và con số đều phải giải thích được nguyên nhân.' },
              { icon: Shield, title: 'Chủ động', desc: 'Người dùng biết mình đang ở đâu trước khi sự cố xảy ra.' },
              { icon: Clock, title: 'Tiết kiệm', desc: 'Giảm tối đa thao tác thủ công và việc đối soát lặp đi lặp lại.' },
              { icon: Lock, title: 'Tin cậy', desc: 'Lưu lịch sử, có audit log, kiểm tra lại bất cứ lúc nào.' },
              { icon: Database, title: 'Mở rộng', desc: 'Từ MVP hiện tại, mở rộng thành hệ thống quản lý hồ sơ dài hạn.' },
            ].map((v) => (
              <div key={v.title} className="intro-lift bg-surface rounded-2xl p-6 border border-outline-variant/50">
                <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center text-primary mb-5">
                  <v.icon className="size-6" />
                </div>
                <h3 className="font-display text-lg font-bold mb-3">{v.title}</h3>
                <p className="text-sm text-outline leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 5. Vì sao chọn Scaify (The Gap We Fill) */}
      <motion.section {...sectionMotion} className="py-20 sm:py-28 bg-[#f7f6fb] border-b border-outline-variant/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-display text-3xl font-black tracking-tight md:text-4xl mb-6">
                Vì sao chúng tôi xây dựng Scaify?
              </h2>
              <p className="text-lg leading-relaxed text-outline mb-6">
                Người bán không thiếu công cụ bán hàng. KiotViet, Sapo lo quản lý kho, MISA AMIS lo phần kế toán. Nhưng có một <strong className="text-primary">khoảng trống lớn</strong>: khâu đối soát doanh thu tự ghi và chứng cứ giao dịch.
              </p>
              <p className="text-lg leading-relaxed text-outline mb-8">
                Đặc biệt với hộ kinh doanh không có settlement từ sàn, việc gom dữ liệu từ nhiều nguồn cực kỳ mất thời gian và dễ dẫn đến sai lệch thuế, phạt truy thu.
              </p>
              <ul className="space-y-4">
                {[
                  { title: 'Không cạnh tranh với phần mềm kế toán', desc: 'Scaify đóng vai trò bổ trợ, làm sạch và đối soát dữ liệu trước khi bạn giao cho kế toán kê khai.' },
                  { title: 'Đọc dữ liệu bằng AI', desc: 'Sử dụng OCR và VLM trích xuất hóa đơn, ảnh chuyển khoản tự động.' },
                  { title: 'Tránh rủi ro phạt thuế', desc: 'Cảnh báo sớm khi bạn gần chạm mốc 1 tỷ VND/năm (Nghị định 1-41/2026).' }
                ].map((item, i) => (
                  <li key={i} className="intro-lift flex items-start gap-4 p-4 rounded-xl bg-white border border-outline-variant/40 shadow-sm">
                    <div className="mt-1 bg-primary/10 text-primary p-2 rounded-lg"><Zap size={20} /></div>
                    <div>
                      <h4 className="font-bold font-display text-lg">{item.title}</h4>
                      <p className="text-sm text-outline mt-1">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="intro-lift relative rounded-2xl overflow-hidden shadow-2xl h-full min-h-[400px]">
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80" alt="Data dashboard" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1535]/80 to-transparent flex items-end p-8">
                <p className="text-2xl font-display font-bold text-white max-w-sm">
                  "Giải quyết đúng khoảng trống đối soát giữa sàn và thực tế."
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 6. Lời kết (Final CTA) */}
      <motion.section {...sectionMotion} className="py-20 sm:py-28 bg-primary text-white text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl mb-6">
            Bắt đầu hành trình minh bạch hóa
          </h2>
          <p className="text-xl text-white/80 leading-relaxed mb-10">
            Scaify được tạo ra với mục tiêu đơn giản: <br className="hidden sm:block"/>
            <strong className="text-white">giúp shop TMĐT nhìn rõ dữ liệu của mình, kiểm soát rủi ro, và chủ động tuân thủ một cách dễ hiểu hơn.</strong>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto">
              <button type="button" className="inline-flex w-full sm:w-auto items-center justify-center rounded-2xl bg-white px-10 py-5 font-display text-lg font-bold text-primary shadow-xl transition-all hover:bg-violet-50">
                Bắt đầu với Scaify
              </button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <button type="button" className="inline-flex w-full sm:w-auto items-center justify-center rounded-2xl border-2 border-white/50 bg-white/10 px-10 py-5 font-display text-lg font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20">
                Trải nghiệm Dashboard
              </button>
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
