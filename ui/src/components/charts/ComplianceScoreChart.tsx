/**
 * ComplianceScoreChart - Mode B (multi-shop)
 * Hiển thị mức sẵn sàng hồ sơ theo shop.
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

export interface ShopScorePoint {
  name: string;
  score: number;
  alertCount: number;
}

interface ComplianceScoreChartProps {
  data: ShopScorePoint[];
  /** Click vào cột của một shop */
  onShopBarClick?: (shopName: string) => void;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'hsl(142 71% 45%)';
  if (score >= 60) return 'hsl(38 92% 50%)';
  return 'hsl(0 84% 60%)';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Sẵn sàng hơn';
  if (score >= 60) return 'Cần kiểm tra';
  return 'Cần xử lý trước';
}

export default function ComplianceScoreChart({ data, onShopBarClick }: ComplianceScoreChartProps) {
  const riskiest = [...data].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            Mức sẵn sàng hồ sơ theo shop
          </p>
          <p className="mt-0.5 text-xs text-outline">
            Điểm thấp hơn nghĩa là cần kiểm tra dữ liệu trước khi chốt kỳ.
          </p>
        </div>
        {riskiest && riskiest.score < 80 && (
          <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-600">
            ⚠ {riskiest.name} cần xem trước
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 52)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
          barCategoryGap="35%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickCount={6}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fontWeight: 600, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value: number, _name: string, props) => {
              const item = props.payload as ShopScorePoint;
              return [
                `${value}/100 — ${scoreLabel(value)} (${item?.alertCount ?? 0} cảnh báo)`,
                'Mức sẵn sàng',
              ];
            }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="score"
            radius={[0, 6, 6, 0]}
            maxBarSize={28}
            cursor={onShopBarClick ? 'pointer' : 'default'}
            onClick={
              onShopBarClick
                ? (payload: unknown) => {
                    const name = (payload as { name?: string } | undefined)?.name;
                    if (name) onShopBarClick(name);
                  }
                : undefined
            }
          >
            {data.map((d) => (
              <Cell key={d.name} fill={scoreColor(d.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-outline-variant/30 pt-3">
        {[
          { color: 'bg-emerald-500', label: '≥ 80 — Sẵn sàng hơn' },
          { color: 'bg-amber-400', label: '60–79 — Cần kiểm tra' },
          { color: 'bg-red-500', label: '< 60 — Cần xử lý trước' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-outline">
            <span className={`size-2.5 rounded-full ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
