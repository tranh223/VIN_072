/**
 * MultiShopCompareChart — Mode B (multi-shop)
 * Trả lời câu hỏi: "Shop nào có doanh thu cao hơn?"
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatVnd } from '../../lib/format';

export interface ShopComparePoint {
  name: string;
  revenue: number;
  tax: number;
}

interface MultiShopCompareChartProps {
  data: ShopComparePoint[];
  period?: string;
  /** Bấm để mở danh mục shop hoặc tổng hợp */
  onChartClick?: () => void;
}

export default function MultiShopCompareChart({
  data,
  period,
  onChartClick,
}: MultiShopCompareChartProps) {
  const topShop = [...data].sort((a, b) => b.revenue - a.revenue)[0];
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
      <div className="mb-4 flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            So sánh doanh thu các shop
          </p>
          {period && (
            <p className="mt-0.5 text-xs text-outline">Kỳ: {period}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {topShop && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              🏆 {topShop.name} dẫn đầu
            </span>
          )}
          {clickable && (
            <span className="text-[10px] font-bold text-primary">Bấm để mở danh mục shop →</span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          barCategoryGap="30%"
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
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
          <Tooltip
            formatter={(value: number, name: string) => [
              formatVnd(value),
              name === 'revenue' ? 'Doanh thu' : 'Thuế',
            ]}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(value) =>
              value === 'revenue' ? 'Doanh thu' : 'Thuế (tham chiếu)'
            }
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar
            dataKey="revenue"
            fill="hsl(262 83% 58%)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
          <Bar
            dataKey="tax"
            fill="hsl(220 70% 72%)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
