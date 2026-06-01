import { X, Play, MessageSquare, Users, Headset, Store, UploadCloud, PieChart, ShieldCheck, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AuthUser } from '../api/types';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onNavigate?: (page: string, search?: string) => void;
}

export default function WelcomeModal({ isOpen, onClose, user, onNavigate }: WelcomeModalProps) {
  if (!isOpen) return null;

  const steps = [
    {
      id: 'shops',
      title: 'Bước 1: Khai báo cửa hàng',
      icon: Store,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      id: 'upload',
      title: 'Bước 2: Tải lên dữ liệu sàn & chứng từ',
      icon: UploadCloud,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      id: 'home',
      title: 'Bước 3: Xem báo cáo đối soát',
      icon: PieChart,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      id: 'compliance',
      title: 'Bước 4: Kiểm tra trạng thái tuân thủ',
      icon: ShieldCheck,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      id: 'history',
      title: 'Bước 5: Chỉnh sửa & cập nhật dữ liệu',
      icon: Edit3,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  const handleStepClick = (id: string) => {
    if (onNavigate) {
      onNavigate(id);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full p-2 text-outline-variant hover:bg-surface hover:text-on-surface transition-colors"
          >
            <X className="size-6" />
          </button>

          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center border-b border-outline-variant/30">
            <h2 className="font-display text-2xl md:text-3xl font-medium text-on-surface">
              Chào <strong className="font-bold text-primary">{user?.full_name || 'bạn'}</strong>,
            </h2>
            <p className="mt-3 text-lg font-medium text-outline">
              Để bắt đầu sử dụng Scaify, bạn vui lòng thực hiện theo các bước sau
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-8 bg-surface">
            <div className="bg-primary/5 rounded-2xl p-6 border-t-4 border-primary shadow-sm">
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleStepClick(step.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-primary/20 group text-left"
                  >
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${step.bg} ${step.color} group-hover:scale-110 transition-transform`}>
                      <step.icon className="size-6" />
                    </div>
                    <span className="font-display text-[15px] font-bold text-on-surface group-hover:text-primary transition-colors">
                      {step.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
