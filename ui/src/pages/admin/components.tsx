import type { ReactNode } from 'react';
import { Badge } from '../../components/ui/Badge';
import { badgeClass, statusLabel } from './utils';
import type { SelectProps } from './types';

export function Card({ label, value, icon, hint }: { label: string; value: string | number; icon: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#DDD6EA] bg-white p-3 shadow-sm shadow-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7C758A]">{label}</p>
          <p className="mt-1.5 font-display text-xl font-black text-[#111827]">{value}</p>
        </div>
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      </div>
      {hint && <p className="mt-2 text-[11px] font-medium text-[#7C758A]">{hint}</p>}
    </div>
  );
}

export function AdminSelect({ label, value, onChange, children }: SelectProps) {
  return (
    <label className="block w-full space-y-1.5">
      {label && <span className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">{label}</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-[#DDD6EA] bg-white px-3 text-xs font-bold text-[#111827] outline-none focus:border-primary focus:ring-4 focus:ring-primary/5"
      >
        {children}
      </select>
    </label>
  );
}

export function AdminBadge({ status }: { status?: string | null }) {
  return <Badge className={badgeClass(status)}>{statusLabel(status)}</Badge>;
}

export function ChartPanel({
  title,
  actions,
  chartClassName = 'h-40 sm:h-44',
  children,
}: {
  title: string;
  actions?: ReactNode;
  chartClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#DDD6EA] bg-white p-3 shadow-sm shadow-primary/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xs font-bold text-[#111827]">{title}</h2>
        {actions}
      </div>
      <div className={chartClassName}>{children}</div>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(-2)
    .join('')
    .toUpperCase();
  return <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary">{initials}</div>;
}

export function ListPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#DDD6EA] bg-white p-3 shadow-sm shadow-primary/5">
      <h2 className="mb-3 font-display text-xs font-bold text-[#111827]">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export function TablePanel({ loading, empty, emptyText, className = '', flush = false, children }: { loading: boolean; empty: boolean; emptyText: string; className?: string; flush?: boolean; children: ReactNode }) {
  const frameClass = flush ? '' : 'rounded-xl border border-[#DDD6EA] shadow-sm shadow-primary/5';

  return (
    <div className={`overflow-hidden bg-white text-xs [&_td]:px-3 [&_td]:py-2.5 [&_td]:first:pl-4 [&_td]:last:pr-4 [&_th]:px-3 [&_th]:py-2.5 [&_th]:first:pl-4 [&_th]:last:pr-4 [&_thead]:text-[9px] [&_table]:text-xs ${frameClass} ${className}`}>
      {loading ? <div className="p-5 text-center text-xs text-[#7C758A]">Đang tải dữ liệu...</div> : empty ? <div className="p-5 text-center text-xs text-[#7C758A]">{emptyText}</div> : children}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const labels = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
  const classes = {
    high: 'border-red-200 bg-red-50 text-red-700',
    medium: 'border-amber-200 bg-amber-50 text-amber-700',
    low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return <Badge className={classes[priority]}>{labels[priority]}</Badge>;
}
