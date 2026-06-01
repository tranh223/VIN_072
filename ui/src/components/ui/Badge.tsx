import type { ReactNode } from 'react';
import type { SyncStatus } from '../../types/status';

const STATUS_LABEL: Record<SyncStatus, string> = {
  synced: 'Đã đồng bộ',
  error: 'Lỗi',
  processing: 'Đang xử lý',
};

const STATUS_CLASS: Record<SyncStatus, string> = {
  synced:
    'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  error: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/20',
  processing:
    'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/25',
};

const DOT_CLASS: Record<SyncStatus, string> = {
  synced: 'bg-emerald-500',
  error: 'bg-red-500',
  processing: 'bg-amber-500',
};

type BadgeProps = {
  status: SyncStatus;
  /** Ghi đè nhãn mặc định (vẫn giữ màu theo status) */
  label?: string;
  showDot?: boolean;
  className?: string;
};

export function StatusBadge({
  status,
  label,
  showDot = true,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLASS[status]} ${className}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[status]}`}
          aria-hidden
        />
      )}
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

type NeutralBadgeProps = {
  children: ReactNode;
  variant?: 'default' | 'outline';
  className?: string;
};

/** Badge phụ (nhãn KPI, phiên bản…) — không phải trạng thái đồng bộ */
export function Badge({
  children,
  variant = 'default',
  className = '',
}: NeutralBadgeProps) {
  const base =
    variant === 'outline'
      ? 'border border-outline-variant bg-white text-outline'
      : 'bg-primary/10 text-primary border border-primary/15';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${base} ${className}`}
    >
      {children}
    </span>
  );
}
