/**
 * TaxPreviewChart - Mode A (single shop)
 * Ước tính thuế và giá trị tham khảo trên chứng cứ (nếu có) theo kỳ.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatVnd } from '../../lib/format';

interface TaxPreviewChartProps {
  gtgt: number;
  tncn: number;
  withheldGtgt?: number;
  withheldTncn?: number;
  /** Bấm vào khối biểu đồ để điều hướng sang trang đối soát / hồ sơ */
  onChartClick?: () => void;
}

export default function TaxPreviewChart({
  gtgt,
  tncn,
  withheldGtgt = 0,
  withheldTncn = 0,
  onChartClick,
}: TaxPreviewChartProps) {
  const data = [
    {
      name: 'GTGT',
      preview: gtgt,
      confirmed: withheldGtgt,
      color: 'hsl(262 83% 58%)',
    },
    {
      name: 'TNCN',
      preview: tncn,
      confirmed: withheldTncn,
      color: 'hsl(220 70% 55%)',
    },
  ];

  const total = gtgt + tncn;
  const totalConfirmed = withheldGtgt + withheldTncn;
  const remaining = Math.max(0, total - totalConfirmed);
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
            Đối soát dữ liệu và thuế ước tính
          </p>
          <p className="mt-0.5 text-[11px] text-outline">
            Số liệu tham khảo để chuẩn bị hồ sơ theo kỳ, không thay thế kê khai chính thức.
          </p>
          <p className="mt-1 font-display text-xl font-bold text-on-surface">{formatVnd(total)}</p>
          {totalConfirmed > 0 && (
            <p className="mt-0.5 text-[11px] text-outline">
              Còn lại (ước tính − chứng cứ tham khảo):{' '}
              <span className="font-bold text-primary">{formatVnd(remaining)}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="mt-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            Ước tính
          </span>
          {clickable && (
            <span className="text-[10px] font-bold text-primary">Bấm để mở đối soát →</span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v}`)}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fontWeight: 700, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value: number) => [formatVnd(value), '']}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              fontSize: 12,
            }}
          />
          <Bar dataKey="preview" name="Ước tính" radius={[0, 6, 6, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
          {totalConfirmed > 0 && (
            <Bar
              dataKey="confirmed"
              name="Trên chứng cứ (tham khảo)"
              fill="#d1d5db"
              radius={[0, 6, 6, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
