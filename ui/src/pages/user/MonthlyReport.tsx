import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileText,
  History,
  Pencil,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';
import { formatNumberVi, formatVnd } from '../../lib/format';
import { alertLevelToSync } from '../../lib/jobStatus';
import { getStoreDossierBadge, parseLatestPeriod } from '../../lib/storeDossier';
import { getComplianceSummary, getStores, reportDownloadUrl } from '../../api/client';
import type { AlertItem, AuthUser, ComplianceSummaryResponse } from '../../api/types';
import type { StoreSummary } from '../../api/types';

type MonthlyReportProps = {
  currentUser?: AuthUser | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asAlerts(value: unknown): AlertItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    return {
      code: String(record.code ?? '-'),
      level: String(record.level ?? 'INFO'),
      message: String(record.message ?? ''),
    };
  });
}

function latestRevenueValue(shop: StoreSummary): number {
  const report = shop.latest_report as Record<string, unknown> | null | undefined;
  if (!report) return 0;
  const candidates = [
    report.total_revenue,
    report.net_revenue,
    report.taxable_revenue,
    report.revenue_raw,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate ?? 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

type TrendPoint = {
  period: string;
  total_revenue: number;
  alerts_count: number;
};

function TrendChart({
  data,
  field,
  stroke,
  emptyLabel,
  highlightPeriod,
}: {
  data: TrendPoint[];
  field: 'total_revenue' | 'alerts_count';
  stroke: string;
  emptyLabel: string;
  /** Kỳ đang chọn (MM/YYYY) — tô đậm điểm trên biểu đồ */
  highlightPeriod?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-outline-variant text-sm text-outline sm:h-64">
        {emptyLabel}
      </div>
    );
  }

  const isRevenue = field === 'total_revenue';
  const yFormatter = (value: number) => {
    if (!isRevenue) return formatNumberVi(value);
    if (Math.abs(value) >= 1_000_000_000) return `${formatNumberVi(value / 1_000_000_000)} tỷ`;
    if (Math.abs(value) >= 1_000_000) return `${formatNumberVi(value / 1_000_000)} tr`;
    return formatNumberVi(value);
  };

  const activeIndex = highlightPeriod
    ? data.findIndex((p) => p.period === highlightPeriod)
    : -1;

  return (
    <div className="h-52 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="#e7e0ec" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={{ stroke: '#cac4d0' }}
            tick={{ fill: '#79747e', fontSize: 10, fontWeight: 700 }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={52}
          />
          <YAxis
            width={isRevenue ? 58 : 34}
            tickLine={false}
            axisLine={{ stroke: '#cac4d0' }}
            tick={{ fill: '#79747e', fontSize: 11, fontWeight: 700 }}
            tickFormatter={(value) => yFormatter(Number(value) || 0)}
            allowDecimals={!isRevenue}
          />
          <Tooltip
            formatter={(value) => [
              isRevenue ? formatVnd(Number(value) || 0) : `${formatNumberVi(Number(value) || 0)} cảnh báo`,
              isRevenue ? 'Doanh thu' : 'Cảnh báo',
            ]}
            labelFormatter={(label) => `Kỳ ${label}`}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e7e0ec',
              boxShadow: '0 8px 24px rgba(26, 22, 77, 0.12)',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey={field}
            stroke={stroke}
            strokeWidth={2.5}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const idx = props.index ?? -1;
              const isActive = idx === activeIndex;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={isActive ? 5 : 3.5}
                  fill={isActive ? stroke : '#fff'}
                  stroke={stroke}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              );
            }}
            activeDot={{ r: 6, fill: stroke, stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function MonthlyReport({ currentUser }: MonthlyReportProps) {
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<ComplianceSummaryResponse | null>(null);
  const [yearTrend, setYearTrend] = useState<ComplianceSummaryResponse['trend']>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setExplainOpen] = useState(false);
  const [, setExplainCode] = useState<string | null>(null);
  const [, setCorrectionOpen] = useState(false);
  const now = new Date();
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    try {
      return searchParams.get('store_id') ?? window.localStorage.getItem('scaify_active_store_id') ?? '';
    } catch {
      return searchParams.get('store_id') ?? '';
    }
  });
  const [selectedYear, setSelectedYear] = useState(() => now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => now.getMonth() + 1);
  const [periodInitialized, setPeriodInitialized] = useState(false);
  const latest = asRecord(summary?.latest_estimation);
  const detail = asRecord(latest.calculation_detail);
  const dash = asRecord(detail.dashboard);
  const alerts = asAlerts(detail.alerts);
  const risk = String(dash.risk_level ?? '').toUpperCase();
  const hasTax = Boolean(summary?.has_data && summary.latest_estimation);
  const net = Number(summary?.total_revenue ?? latest.total_revenue ?? 0) || 0;
  const totalTax = Number(summary?.payable_tax ?? latest.payable_tax ?? latest.estimated_tax ?? 0) || 0;
  const alertCount = Number(summary?.alerts_count ?? dash.alerts_count ?? alerts.length) || 0;
  const trend = useMemo(() => {
    const byPeriod = new Map<string, TrendPoint>();
    for (const point of [...(summary?.trend ?? []), ...yearTrend]) {
      if (!point?.period) continue;
      const prev = byPeriod.get(point.period);
      const revenue = Number(point.total_revenue) || 0;
      const alerts = Number(point.alerts_count) || 0;
      byPeriod.set(point.period, {
        period: point.period,
        total_revenue: Math.max(prev?.total_revenue ?? 0, revenue),
        alerts_count: Math.max(prev?.alerts_count ?? 0, alerts),
      });
    }
    return Array.from({ length: 12 }, (_, i) => {
      const period = `${String(i + 1).padStart(2, '0')}/${selectedYear}`;
      return (
        byPeriod.get(period) ?? {
          period,
          total_revenue: 0,
          alerts_count: 0,
        }
      );
    });
  }, [summary?.trend, yearTrend, selectedYear]);
  const trendHasRevenue = trend.some((p) => p.total_revenue > 0);
  const shopRows = useMemo(() => {
    return stores
      .map((shop) => {
        const report = shop.latest_report as Record<string, unknown> | null | undefined;
        const est = shop.latest_estimation as Record<string, unknown> | null | undefined;
        const detail = (est?.calculation_detail as Record<string, unknown> | null | undefined) ?? {};
        const alerts = Number((detail.dashboard as Record<string, unknown> | null | undefined)?.alerts_count ?? 0) || 0;
        const revenue = latestRevenueValue(shop) || Number(
          report?.total_revenue ?? report?.net_revenue ?? report?.taxable_revenue ?? report?.revenue_raw ?? 0
        ) || 0;
        const dossierBadge = getStoreDossierBadge(shop);
        const status = dossierBadge.label;
        return {
          id: shop.id,
          name: shop.store_name ?? shop.store_code ?? 'Shop',
          platform: shop.platform?.name ?? shop.platform?.code ?? 'Chưa có nền tảng',
          revenue,
          status,
          alerts,
          latestPeriod: shop.latest_period ?? 'Chưa có báo cáo',
          updatedAt: formatUpdatedAt(shop.updated_at),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [stores]);

  const periodKey = `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
  const trendPointForPeriod = trend.find((p) => p.period === periodKey);
  const jobId = '';

  useEffect(() => {
    const sid = searchParams.get('store_id');
    if (sid !== null && sid !== selectedStoreId) setSelectedStoreId(sid);
  }, [searchParams, selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId) return;
    try {
      window.localStorage.setItem('scaify_active_store_id', selectedStoreId);
    } catch {
      /* ignore */
    }
  }, [selectedStoreId]);

  useEffect(() => {
    let alive = true;
    void getStores(currentUser?.id)
      .then((storesData) => {
        if (!alive) return;
        const list = storesData.stores ?? [];
        setStores(list);
        if (!selectedStoreId && list.length > 0) {
          setSelectedStoreId(list[0].id);
        }
        if (!periodInitialized && list.length > 0) {
          const active = list.find((s) => s.id === (selectedStoreId || list[0].id)) ?? list[0];
          const parsed = parseLatestPeriod(active.latest_period);
          if (parsed) {
            setSelectedYear(parsed.year);
            setSelectedMonth(parsed.month);
          }
          setPeriodInitialized(true);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [currentUser?.id, periodInitialized, selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId) return;
    let alive = true;
    setLoading(true);
    void Promise.all([
      getComplianceSummary(currentUser?.id, selectedStoreId, {
        year: selectedYear,
        month: selectedMonth,
      }),
      getComplianceSummary(currentUser?.id, selectedStoreId, { year: selectedYear }),
    ])
      .then(([periodSummary, yearSummary]) => {
        if (!alive) return;
        setSummary(periodSummary);
        setYearTrend(yearSummary.trend ?? []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentUser?.id, selectedStoreId, selectedYear, selectedMonth]);

  const activeStore = stores.find((s) => s.id === selectedStoreId);
  const periodLabel = `Kỳ ${periodKey}`;
  const scopeLabel = activeStore?.store_name ?? activeStore?.store_code ?? 'Chưa chọn shop';
  const periodRevenue =
    Number(trendPointForPeriod?.total_revenue ?? 0) ||
    Number(summary?.total_revenue ?? 0) ||
    0;
  const yearOptions = useMemo(() => {
    const years = new Set<number>([selectedYear, now.getFullYear()]);
    for (const p of summary?.trend ?? []) {
      if (p.year) years.add(p.year);
    }
    return [...years].sort((a, b) => b - a);
  }, [summary?.trend, selectedYear, now]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 sm:space-y-8"
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" data-product-tour="reports-header">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface sm:text-3xl">
            Hồ sơ tháng - tổng hợp đối soát
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-outline">
            Tổng hợp số liệu từ các kỳ để rà soát trước kê khai: doanh thu, cảnh báo và trạng thái hồ sơ.
          </p>
        </div>
        <motion.div className="flex w-full flex-col gap-3 lg:min-w-[320px] lg:max-w-md">
          <motion.div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <motion.div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-outline">Cửa hàng</label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="min-h-10 rounded-xl border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
              >
                {stores.length === 0 && <option value="">Chưa có shop</option>}
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name ?? s.store_code ?? s.id}
                  </option>
                ))}
              </select>
            </motion.div>
            <motion.div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-outline">Tháng</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="min-h-10 rounded-xl border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            </motion.div>
            <motion.div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-outline">Năm</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="min-h-10 rounded-xl border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </motion.div>
          </motion.div>
          <motion.div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-on-surface">
              <span className="size-2 rounded-full bg-sky-700" />
              {periodLabel}
            </span>
            <Badge variant="outline">{scopeLabel}</Badge>
            {!loading && selectedStoreId && !summary?.has_data && (
              <span className="text-xs text-amber-800">Chưa có dữ liệu kỳ này.</span>
            )}
          </motion.div>
        </motion.div>
      </header>

      {loading && (
        <p className="text-sm text-outline">Đang tải dữ liệu thuế…</p>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-product-tour="reports-kpis">
        <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-[0_4px_20px_rgba(26,22,77,0.08)] sm:p-5">
          <div className="mb-2 flex justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-outline">
              Doanh thu kỳ đang xem
            </span>
            <FileText className="size-5 text-primary-container" />
          </div>
          <p className="font-display text-2xl font-bold tracking-tight text-primary">
            {formatVnd(periodRevenue || net)}
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs text-sky-800">
            <TrendingUp className="size-3.5" />
            {periodLabel} · {scopeLabel}
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-[0_4px_20px_rgba(26,22,77,0.08)] sm:p-5">
          <div className="mb-2 flex justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-outline">
              Tổng cảnh báo
            </span>
            <AlertTriangle className="size-5 text-red-600" />
          </div>
          <p className="font-display text-2xl font-bold tracking-tight text-primary">
            {formatNumberVi(alertCount)}
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs text-outline">
            <TrendingDown className="size-3.5 text-red-500" />
            Kiểm tra mục Tuân thủ
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-[0_4px_20px_rgba(26,22,77,0.08)] sm:p-5">
          <div className="mb-2 flex justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-outline">
              Thuế ước tính (tham khảo)
            </span>
            <FileText className="size-5 text-secondary" />
          </div>
          <p className="font-display text-2xl font-bold tracking-tight text-primary">
            {formatVnd(totalTax)}
          </p>
            <p className="mt-3 flex items-center gap-1 text-xs text-outline">
              <History className="size-3.5" />
              Không thay thế số kê khai chính thức
            </p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-[0_4px_20px_rgba(26,22,77,0.08)] sm:p-5">
          <div className="mb-2 flex justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-outline">
              Theo dõi ngưỡng tham khảo
            </span>
            <FileText className="size-5 text-sky-800" />
          </div>
          <p className="font-display text-2xl font-bold tracking-tight text-primary">
            {Math.round(Number(dash.pct_of_threshold ?? 0) || 0)}%
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs text-outline">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            So với ngưỡng tham khảo
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-[0_4px_20px_rgba(26,22,77,0.08)]">
        <div className="flex flex-col gap-2 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">Tổng quan các shop</h2>
            <p className="text-sm text-outline">
              Bảng dưới theo kỳ gần nhất từng shop; số liệu KPI phía trên theo shop và tháng bạn chọn.
            </p>
          </div>
          <Badge variant="outline">Tham chiếu nhanh</Badge>
        </div>
        {shopRows.length === 0 ? (
          <p className="p-6 text-sm text-outline">Chưa có shop nào để tổng hợp.</p>
        ) : (
          <Table bare className="min-w-[760px]">
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Tên shop</TableHeaderCell>
                <TableHeaderCell>Nền tảng</TableHeaderCell>
                <TableHeaderCell>Doanh thu</TableHeaderCell>
                <TableHeaderCell>Trạng thái hồ sơ</TableHeaderCell>
                <TableHeaderCell>Cảnh báo</TableHeaderCell>
                <TableHeaderCell>Kỳ gần nhất</TableHeaderCell>
                <TableHeaderCell>Cập nhật lần cuối</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shopRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold text-on-surface">{row.name}</TableCell>
                  <TableCell className="text-sm text-outline">{row.platform}</TableCell>
                  <TableCell className="font-semibold text-primary">{formatVnd(row.revenue)}</TableCell>
                  <TableCell className="text-sm text-on-surface">{row.status}</TableCell>
                  <TableCell className="font-mono text-xs">{formatNumberVi(row.alerts)}</TableCell>
                  <TableCell className="text-sm text-outline">{row.latestPeriod}</TableCell>
                  <TableCell className="text-sm text-outline">{row.updatedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-[0_4px_20px_rgba(26,22,77,0.08)] sm:p-5" data-product-tour="reports-revenue-trend">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-primary">
                  Xu hướng doanh thu
                </h2>
            <p className="text-sm text-outline">
              12 tháng trong năm {selectedYear} · {scopeLabel}
              {trendHasRevenue
                ? ` · điểm tô đậm = ${periodLabel} (kỳ đang chọn ở bộ lọc phía trên)`
                : ' · chưa có doanh thu — upload CSV từng tháng cho shop này'}
            </p>
              </div>
            </div>
            <TrendChart
              data={trend}
              field="total_revenue"
              stroke="#2812ad"
              highlightPeriod={periodKey}
              emptyLabel="Chưa có dữ liệu xu hướng doanh thu."
            />
          </div>

          <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-[0_4px_20px_rgba(26,22,77,0.08)] sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-primary">
                  Xu hướng cảnh báo
                </h2>
                <p className="text-sm text-outline">
                  Cảnh báo theo tháng · năm {selectedYear} · {scopeLabel}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-[11px] font-bold text-red-600">
                <span className="size-2 rounded-full bg-red-600" />
                Mức độ nghiêm trọng
              </span>
            </div>
            <TrendChart
              data={trend}
              field="alerts_count"
              stroke="#ba1a1a"
              highlightPeriod={periodKey}
              emptyLabel="Chưa có dữ liệu xu hướng cảnh báo."
            />
          </div>
        </div>

          <div className="space-y-4" data-product-tour="reports-ai-summary">
          <div className="rounded-xl border border-outline-variant border-l-4 border-l-primary-container bg-white p-4 shadow-[0_4px_20px_rgba(26,22,77,0.08)] sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-5 text-primary-container" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Phân tích AI
              </span>
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-on-surface">
              <li>
                <strong>Phát hiện:</strong>{' '}
                {hasTax ? `${formatNumberVi(alertCount)} cảnh báo/nhắc nhở trong kỳ.` : 'Chưa có dữ liệu để tổng hợp.'}
              </li>
              <li>
                <strong>Cần kiểm tra:</strong>{' '}
                {hasTax
                  ? alertCount > 0
                    ? 'Đối soát dữ liệu bán hàng với chứng cứ giao dịch, và kiểm tra các số đang dùng trong tính toán.'
                    : 'Chưa thấy cảnh báo lớn; vẫn nên rà soát nhanh dữ liệu và kỳ hiện tại.'
                  : '—'}
              </li>
              <li>
                <strong>Đề xuất xử lý:</strong>{' '}
                {hasTax
                  ? alertCount > 0
                    ? 'Mở Upload để xác nhận dữ liệu/chỉnh số, sau đó tải lại hồ sơ tháng.'
                    : 'Tiếp tục gom thêm kỳ mới hoặc tải chứng cứ nếu thiếu.'
                  : '—'}
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-[0_4px_20px_rgba(26,22,77,0.08)] sm:p-5">
            <div className="mb-3 flex justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline">
                Ngưỡng báo cáo
              </h3>
              <span className="font-mono text-sm font-bold text-primary">
                {Math.round(Number(dash.pct_of_threshold ?? 0) || 0)}%
              </span>
            </div>
            <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-surface-container">
              <div
                className="relative h-full rounded-full bg-primary-container"
                style={{
                  width: `${Math.min(100, Math.max(0, Number(dash.pct_of_threshold ?? 0)))}%`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
            </div>
            <p className="text-sm text-outline">
              Tỷ lệ theo dõi so với ngưỡng tham khảo trong luồng kiểm soát.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {jobId && (
              <a
                href={reportDownloadUrl(jobId)}
                download
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary-container py-4 text-sm font-display font-bold text-white shadow-lg shadow-primary/15 transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <FileText className="size-5" />
                Tải báo cáo tháng
              </a>
            )}
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-[0_4px_20px_rgba(26,22,77,0.08)]" data-product-tour="reports-alerts">
        <div className="flex flex-col gap-2 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="font-display text-lg font-bold text-primary">
            Cảnh báo từ phiên
          </h2>
        </div>
        {alerts.length === 0 ? (
          <p className="p-6 text-sm text-outline">Không có cảnh báo hoặc chưa có dữ liệu.</p>
        ) : (
          <Table bare className="min-w-[520px]">
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Mã</TableHeaderCell>
                <TableHeaderCell>Nội dung</TableHeaderCell>
                <TableHeaderCell>Mức độ</TableHeaderCell>
                <TableHeaderCell className="text-right">Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.map((a) => (
                <TableRow key={`${a.code}-${a.message}`}>
                  <TableCell className="font-mono text-xs">
                    <button
                      type="button"
                      className="text-left font-mono text-primary hover:underline"
                      onClick={() => {
                        setExplainCode(a.code);
                        setExplainOpen(true);
                      }}
                    >
                      {a.code}
                    </button>
                  </TableCell>
                  <TableCell className="max-w-md text-sm">
                    <button
                      type="button"
                      className="w-full text-left hover:text-primary"
                      onClick={() => {
                        setExplainCode(a.code);
                        setExplainOpen(true);
                      }}
                    >
                      {a.message}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs font-bold uppercase text-outline">
                    {a.level}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={alertLevelToSync(a.level)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

    </motion.div>
  );
}
