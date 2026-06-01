/**
 * TrendChart — Mode A (single shop)
 * Trả lời câu hỏi: "Doanh thu đang tăng hay giảm?"
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatVnd } from '../../lib/format';

interface TrendPoint {
  period: string;
  revenue: number;
  tax: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  /** Bấm vào khối biểu đồ để điều hướng (vd. Hồ sơ tháng) */
  onChartClick?: () => void;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-outline-variant bg-white px-3 py-2.5 shadow-lg text-xs">
      <p className="mb-1.5 font-bold text-on-surface">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-outline">
          <span className="font-semibold text-primary">{formatVnd(p.value)}</span>
          {' '}doanh thu
        </p>
      ))}
    </div>
  );
}

export default function TrendChart({ data, onChartClick }: TrendChartProps) {
  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const delta =
    prev && prev.revenue > 0
      ? ((latest.revenue - prev.revenue) / prev.revenue) * 100
      : null;

  const clickable = Boolean(onChartClick);

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onChartClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChartClick?.();
              }
            }
          : undefined
      }
      className={`rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5 ${
        clickable ? 'cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/[0.02]' : ''
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            Xu hướng doanh thu
          </p>
          <p className="mt-1 font-display text-xl font-bold text-on-surface">
            {formatVnd(latest?.revenue ?? 0)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {delta !== null && (
            <span
              className={`mt-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                delta >= 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% so kỳ trước
            </span>
          )}
          {clickable && (
            <span className="text-[10px] font-bold text-primary">Bấm để mở hồ sơ tháng →</span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(262 83% 58%)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="hsl(262 83% 58%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) =>
              v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v}`
            }
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="hsl(262 83% 58%)"
            strokeWidth={2}
            fill="url(#revenueGrad)"
            dot={{ r: 3, fill: 'hsl(262 83% 58%)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
