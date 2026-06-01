import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, RefreshCw, Lightbulb } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useJobs } from '../../hooks/useJobs';
import { useLatestCompletedTax } from '../../hooks/useLatestCompletedTax';
import { formatVnd } from '../../lib/format';
import { getComplianceSummary, getStores, getYearEndSummary, reportDownloadUrl } from '../../api/client';
import type { AuthUser, ComplianceSummaryResponse, StoreSummary, YearEndSummaryResponse } from '../../api/types';

function scoreLabel(score: number): string {
  if (score >= 85) return 'Sẵn sàng kê khai';
  if (score >= 70) return 'Cần kiểm tra';
  return 'Rủi ro dữ liệu';
}

function scoreTone(score: number) {
  if (score < 70) {
    return {
      stroke: 'stroke-red-500',
      text: 'text-red-600',
      badge: 'bg-red-100 text-red-700',
    };
  }
  if (score < 85) {
    return {
      stroke: 'stroke-amber-500',
      text: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-800',
    };
  }
  return {
    stroke: 'stroke-emerald-500',
    text: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800',
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numValue(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

type ComplianceScoreProps = {
  currentUser?: AuthUser | null;
  onNavigate?: (id: string, search?: string) => void;
};

export default function ComplianceScore({ currentUser, onNavigate }: ComplianceScoreProps) {
  const [searchParams] = useSearchParams();
  const { jobs, refetch } = useJobs(12000, currentUser?.id);
  const { tax, loading: taxLoading } = useLatestCompletedTax(jobs);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ComplianceSummaryResponse | null>(null);
  const [yearEnd, setYearEnd] = useState<YearEndSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    try {
      return searchParams.get('store_id') ?? window.localStorage.getItem('scaify_active_store_id') ?? '';
    } catch {
      return searchParams.get('store_id') ?? '';
    }
  });

  const reloadSummary = () => {
    setSummaryLoading(true);
    setSummaryError(null);
    return Promise.all([
      getComplianceSummary(currentUser?.id, selectedStoreId || undefined),
      getYearEndSummary(undefined, currentUser?.id, selectedStoreId || undefined),
    ])
      .then(([summaryData, yearEndData]) => {
        setSummary(summaryData);
        setYearEnd(yearEndData);
      })
      .catch((err: Error) => {
        setSummaryError(err.message);
      })
      .finally(() => {
        setSummaryLoading(false);
      });
  };

  useEffect(() => {
    let alive = true;
    setSummaryLoading(true);
    setSummaryError(null);
    void Promise.all([
      getComplianceSummary(currentUser?.id, selectedStoreId || undefined),
      getYearEndSummary(undefined, currentUser?.id, selectedStoreId || undefined),
    ])
      .then(([summaryData, yearEndData]) => {
        if (!alive) return;
        setSummary(summaryData);
        setYearEnd(yearEndData);
      })
      .catch((err: Error) => {
        if (alive) setSummaryError(err.message);
      })
      .finally(() => {
        if (alive) setSummaryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentUser?.id, selectedStoreId]);

  useEffect(() => {
    let alive = true;
    setStoresLoading(true);
    setStoresError(null);
    void getStores(currentUser?.id)
      .then((data) => {
        if (!alive) return;
        setStores(data.stores);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setStoresError(err.message);
      })
      .finally(() => {
        if (!alive) return;
        setStoresLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const sid = searchParams.get('store_id');
    if (sid && sid !== selectedStoreId) setSelectedStoreId(sid);
  }, [searchParams, selectedStoreId]);

  useEffect(() => {
    const sid = searchParams.get('store_id');
    if (!sid) return;
    try {
      window.localStorage.setItem('scaify_active_store_id', sid);
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  useEffect(() => {
    if (storesLoading) return;
    if (stores.length === 0) return;
    if (selectedStoreId && stores.some((s) => s.id === selectedStoreId)) return;

    let sid = '';
    try {
      sid = window.localStorage.getItem('scaify_active_store_id') ?? '';
    } catch {
      sid = '';
    }
    const next = stores.some((s) => s.id === sid) ? sid : stores[0]?.id ?? '';
    if (next && next !== selectedStoreId) {
      setSelectedStoreId(next);
      try {
        window.localStorage.setItem('scaify_active_store_id', next);
      } catch {
        /* ignore */
      }
      onNavigate?.('compliance', `store_id=${encodeURIComponent(next)}`);
    }
  }, [storesLoading, stores, selectedStoreId, onNavigate]);

  const selectedStore = useMemo(
    () => (selectedStoreId ? stores.find((s) => s.id === selectedStoreId) ?? null : null),
    [stores, selectedStoreId]
  );

  const selectedEst = recordValue(selectedStore?.latest_estimation);
  const selectedCalc = recordValue(selectedEst.calculation_detail);
  const selectedDash = recordValue(selectedCalc.dashboard);

  const dash = Object.keys(selectedDash).length > 0 ? selectedDash : (tax?.dashboard ?? {});
  const hasJobDone = jobs.some((j) => j.status === 'done');
  const hasTaxSession = Boolean(tax) || hasJobDone;
  const hasStoreScopedData = Boolean(selectedStore?.latest_estimation) || Boolean(selectedStore?.latest_report);
  const hasData = hasStoreScopedData || hasTaxSession || Boolean(summary?.has_data);

  const risk = String(dash.risk_level ?? 'OK').toUpperCase();
  const scoreFromRisk =
    risk === 'WARNING' ? 42 : risk === 'CONFIRM' ? 65 : 88;
  const scoreFromStore = numValue(selectedDash.compliance_score ?? selectedEst.score) ?? null;
  const score = scoreFromStore ?? (hasTaxSession ? scoreFromRisk : summary?.score ?? 0);
  const tone = scoreTone(score);
  const badgeText = hasData ? summary?.label ?? scoreLabel(score) : 'Chưa có dữ liệu';

  const pct = Number(dash.pct_of_threshold ?? 0) || 0;
  const alerts = Number(dash.alerts_count ?? selectedCalc.alerts_count ?? tax?.alerts?.length ?? 0) || 0;
  const trendCumulative = useMemo(() => {
    const rows = summary?.trend ?? [];
    return {
      revenue: rows.reduce((s, p) => s + (Number(p.total_revenue) || 0), 0),
      tax: rows.reduce((s, p) => s + (Number(p.payable_tax) || 0), 0),
    };
  }, [summary?.trend]);

  const referenceRevenue =
    Number(yearEnd?.total_revenue ?? 0) > 0 ? Number(yearEnd?.total_revenue) : trendCumulative.revenue;
  const referenceTax =
    Number(yearEnd?.payable_tax ?? 0) > 0
      ? Number(yearEnd?.payable_tax)
      : trendCumulative.tax > 0
        ? trendCumulative.tax
        : Number(summary?.payable_tax ?? 0);

  const metrics = hasTaxSession
    ? [
        {
          label: 'Mức so với ngưỡng tham khảo',
          value: Math.min(100, Math.max(0, Math.round(pct))),
        },
        {
          label: 'Mức nhắc nhở tổng hợp (%)',
          value: Math.min(100, Math.round(alerts * 14)),
        },
        {
          label: 'Độ ổn định ước lượng (%)',
          value: Math.max(35, Math.min(100, 95 - alerts * 6)),
        },
        {
          label: 'Tiến độ hoàn tất phiên gần nhất (%)',
          value: jobs.some((j) => j.status === 'done') ? 100 : 0,
        },
      ]
    : summary?.metrics ?? [];

  const groupedMetrics = (() => {
    const list = metrics ?? [];
    const norm = (s: string) => s.toLowerCase();
    const findValue = (pred: (l: string) => boolean) => {
      const hit = list.find((m) => pred(norm(m.label ?? '')));
      return hit ? Number(hit.value ?? 0) : 0;
    };
    return [
      { label: 'Thiếu dữ liệu', value: findValue((l) => l.includes('thiếu') || l.includes('chưa cập nhật') || l.includes('dữ liệu thiếu')), to: 'upload' },
      { label: 'Lệch dữ liệu', value: findValue((l) => l.includes('lệch') || l.includes('chênh lệch')), to: 'audit' },
      { label: 'Gần ngưỡng', value: findValue((l) => l.includes('ngưỡng')), to: 'yearend' },
      { label: 'Cần xác nhận', value: findValue((l) => l.includes('xác nhận') || l.includes('cần xem lại') || l.includes('confirm')), to: 'reports' },
    ] as Array<{ label: string; value: number; to: string }>;
  })();

  const insightCards = [
    {
      title: 'Gợi ý từ hệ thống',
      lead: 'Tổng hợp tháng để rà soát trước kê khai',
      body: hasData
        ? `Hiện có ${alerts} cảnh báo/nhắc nhở. Trạng thái: ${scoreLabel(score)}.`
        : 'Khi bạn tải dữ liệu và xử lý xong, phần này sẽ tóm tắt nhanh tình trạng kiểm soát.',
      btn: 'Mở Upload',
      accent: 'border-l-primary',
    },
    {
      title: 'Mức doanh thu cần lưu ý',
      lead: 'So với ngưỡng tham khảo',
      body: hasData
        ? `Khoảng ${Math.round(pct)}% so với ngưỡng tham khảo (chỉ mang tính minh họa, không thay thế tư vấn chuyên môn).`
        : 'Chưa có số liệu để hiển thị.',
      btn: 'Xem cuối năm',
      accent: 'border-l-secondary',
    },
    {
      title: 'Tải về',
      lead: 'Báo cáo tổng hợp',
      body: 'Trong mục Lịch sử hoặc Tải dữ liệu, bạn có thể tải file sau khi xử lý xong.',
      btn: 'Mở Báo cáo tháng',
      accent: 'border-l-primary-container',
    },
  ];

  function isPercentMetricRow(label: string): boolean {
    const L = label.toLowerCase();
    return (
      L.includes('tiến độ') ||
      L.includes('theo dõi ngưỡng') ||
      L.includes('mức lệch') ||
      L.includes('mức chênh lệch') ||
      L.includes('tỷ lệ') ||
      L.includes('(%)') ||
      L.includes('so với ngưỡng tham khảo') ||
      (L.includes('%') && !L.includes('điểm'))
    );
  }

  function targetPageForMetricReason(label: string): string {
    const L = label.toLowerCase();
    if (L.includes('gần ngưỡng') || L.includes('so với ngưỡng tham khảo')) return 'yearend';
    if (L.includes('chưa cập nhật') || L.includes('dữ liệu thiếu')) return 'upload';
    if (L.includes('dữ liệu lệch') || L.includes('chênh lệch')) return 'audit';
    if (L.includes('sửa nhiều lần')) return 'history';
    return 'history';
  }

  function targetPageForMetricImprove(label: string): string {
    const L = label.toLowerCase();
    if (L.includes('gần ngưỡng') || L.includes('so với ngưỡng tham khảo')) return 'yearend';
    if (L.includes('chưa cập nhật') || L.includes('dữ liệu thiếu')) return 'upload';
    if (L.includes('dữ liệu lệch') || L.includes('chênh lệch')) return 'history';
    if (L.includes('sửa nhiều lần')) return 'history';
    return 'upload';
  }

  const prioritizedMetrics = groupedMetrics;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end" data-product-tour="compliance-header">
        <div>
          <h1 className="mb-2 font-display text-2xl font-bold text-on-surface sm:text-3xl">
            Mức sẵn sàng hồ sơ
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-outline">
            Đánh giá mức độ sẵn sàng về dữ liệu và hồ sơ cho việc tự kê khai. Dựa trên rà soát: thiếu dữ liệu, lệch dữ liệu, gần ngưỡng, và các mục cần xác nhận.
          </p>
          {storesError && (
            <p className="mt-2 text-xs text-red-600">{storesError}</p>
          )}
          {stores.length >= 2 && (
            <div className="mt-3 max-w-md">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-outline">
                Chọn cửa hàng
              </p>
              <select
                value={selectedStoreId}
                onChange={(e) => {
                  const sid = e.target.value;
                  setSelectedStoreId(sid);
                  try {
                    window.localStorage.setItem('scaify_active_store_id', sid);
                  } catch {
                    /* ignore */
                  }
                  onNavigate?.('compliance', `store_id=${encodeURIComponent(sid)}`);
                }}
                disabled={storesLoading || stores.length === 0}
                className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-sm font-medium text-on-surface outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 disabled:bg-surface disabled:text-outline"
              >
                <option value="">{storesLoading ? 'Đang tải cửa hàng...' : 'Chọn cửa hàng'}</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name ?? s.store_code ?? s.id}
                  </option>
                ))}
              </select>
              {selectedStore && (
                <p className="mt-1 text-xs text-outline">
                  Đang xem theo shop: <span className="font-semibold text-on-surface">{selectedStore.store_name ?? selectedStore.store_code ?? selectedStore.id}</span>
                </p>
              )}
            </div>
          )}
          {taxLoading && (
            <p className="mt-2 text-xs text-outline">Đang tải kết quả thuế…</p>
          )}
          {summaryLoading && (
            <p className="mt-2 text-xs text-outline">Đang tải dữ liệu…</p>
          )}
          {summaryError && (
            <p className="mt-2 text-xs text-red-600">{summaryError}</p>
          )}
          {summary?.missing_supporting_evidence && (
            <p className="mt-2 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Hồ sơ <strong>chưa đủ</strong>: đã có doanh thu CSV nhưng thiếu chứng từ PDF/ảnh — điểm tuân thủ bị trừ tối đa 20 điểm.
            </p>
          )}
          {!summaryLoading && !hasData && !summaryError && (
            <p className="mt-2 text-xs text-outline">Chưa có đủ dữ liệu để tính điểm. Hãy tải và xử lý dữ liệu trước.</p>
          )}
          {hasData && (referenceRevenue > 0 || referenceTax > 0) && (
            <div className="mt-3 max-w-md text-sm text-outline">
              <p className="font-semibold text-on-surface">Số liệu tham khảo</p>
              {referenceRevenue > 0 && (
                <p className="mt-1">
                  Tổng doanh thu:{' '}
                  <strong className="text-on-surface">{formatVnd(referenceRevenue)}</strong>
                </p>
              )}
              {referenceTax > 0 && (
                <p className="mt-0.5">
                  Thuế ước tính GTGT + TNCN:{' '}
                  <strong className="text-on-surface">{formatVnd(referenceTax)}</strong>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            size="md"
            className="gap-2 text-xs uppercase tracking-widest text-white shadow-lg shadow-primary/20"
            onClick={() => {
              void reloadSummary();
              void refetch();
            }}
          >
            <RefreshCw size={16} /> Làm mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="relative col-span-12 flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5 lg:col-span-7 lg:min-h-[380px] lg:p-6" data-product-tour="compliance-score">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#4136C3_0%,transparent_50%)] opacity-10" />

          <div className="relative z-10 text-center">
            <h3 className="mb-5 font-display text-xl font-bold text-primary lg:mb-6">
              Điểm tổng quát
            </h3>

            <div className="relative mx-auto flex h-52 w-52 items-center justify-center sm:h-64 sm:w-64">
              <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="fill-none stroke-white/30"
                  strokeWidth="10"
                  pathLength={100}
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  className={`fill-none ${tone.stroke}`}
                  strokeWidth="10"
                  strokeLinecap="round"
                  pathLength={100}
                  initial={{ strokeDasharray: '0 100' }}
                  animate={{ strokeDasharray: `${score} ${100 - score}` }}
                  transition={{ duration: 1.6, ease: 'easeOut' }}
                />
              </svg>
              <div className="text-center">
                <p className={`font-black leading-none tracking-tighter ${tone.text} text-5xl sm:text-7xl`}>
                  {hasData ? score : '--'}
                </p>
                <div className={`mt-3 inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tone.badge}`}>
                  {badgeText}
                </div>
                {hasData && (
                  <p className="mt-2 text-xs text-outline">
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-4 lg:mt-8 lg:gap-6">
              {[
                { label: 'Rủi ro dữ liệu 0–69', color: 'bg-red-500' },
                { label: 'Cần kiểm tra 70–84', color: 'bg-amber-500' },
                { label: 'Sẵn sàng kê khai 85–100', color: 'bg-emerald-500' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`size-3 rounded-full ${l.color}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-outline">
                    {l.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 flex flex-col rounded-2xl border border-outline-variant bg-white p-5 shadow-sm lg:col-span-5 lg:p-6" data-product-tour="compliance-details">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-on-surface">Chi tiết</h3>
            <span className="rounded-lg border border-primary/10 bg-primary/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              Phiên mới nhất
            </span>
          </div>

          <div className="flex-grow space-y-6">
            {prioritizedMetrics.length === 0 && (
              <div className="rounded-2xl border border-dashed border-outline-variant p-6 text-sm text-outline">
                Chưa có chi tiết điểm để hiển thị.
              </div>
            )}
            {prioritizedMetrics.map((m, i) => {
              const isPercent = isPercentMetricRow(m.label) || m.label.toLowerCase().includes('ngưỡng');
              const barW = isPercent ? Math.min(100, m.value) : Math.min(100, m.value * 20);
              return (
              <div key={`${m.label}-${i}`} className="space-y-3">
                <div className="flex items-end justify-between gap-2">
                  <label className="text-xs font-bold text-on-surface/80">{m.label}</label>
                  <span className="shrink-0 font-mono text-base font-bold text-primary">
                    {isPercent ? `${Math.round(m.value)}%` : `${Math.round(m.value)} mục`}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barW}%` }}
                    transition={{ duration: 1.5, delay: i * 0.15 }}
                    className="relative h-full rounded-full bg-primary-container"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                  </motion.div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] font-semibold tracking-wide text-on-surface/60 transition-colors hover:text-primary hover:underline"
                    onClick={() => onNavigate?.((m as any).to ?? targetPageForMetricReason(m.label))}
                  >
                    Đi tới màn xử lý
                  </button>
                  <button
                    type="button"
                    className="text-[10px] font-semibold tracking-wide text-on-surface/60 transition-colors hover:text-primary hover:underline"
                    onClick={() => onNavigate?.((m as any).to ?? targetPageForMetricImprove(m.label))}
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
              );
            })}
          </div>

          <div className="mt-7 rounded-xl border-l-4 border-primary bg-primary/5 p-4">
            <div className="flex gap-3">
              <Lightbulb size={20} className="shrink-0 text-primary" />
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-on-surface">
                  {hasData
                    ? `Trạng thái hồ sơ: ${risk === 'OK' ? 'ổn định' : risk === 'CONFIRM' ? 'nên xem lại vài hạng mục' : 'có hạng mức cần quan tâm'}. Bạn có thể làm mới sau khi cập nhật dữ liệu.`
                    : 'Hãy tải dữ liệu ở mục Tải dữ liệu, chờ xử lý xong rồi quay lại đây.'}
                </p>
                {hasData && alerts > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('upload')}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Mở giải thích cảnh báo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {insightCards.map((c) => (
          <div
            key={c.title}
            className={`group col-span-12 flex flex-col justify-between rounded-2xl border border-outline-variant bg-white p-5 shadow-sm transition-all hover:shadow-md lg:col-span-4 border-l-4 ${c.accent}`}
          >
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                {c.title}
              </h4>
              <p className="text-base font-bold leading-tight text-on-surface">{c.lead}</p>
              <p className="text-xs leading-relaxed text-outline">{c.body}</p>
            </div>
            <button
              type="button"
              className="mt-5 h-10 w-full rounded-lg border border-outline-variant bg-white text-[11px] font-bold uppercase tracking-widest text-on-surface transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
              onClick={() => {
                if (c.btn === 'Mở Upload') onNavigate?.('upload');
                else if (c.btn === 'Xem cuối năm') onNavigate?.('yearend');
                else if (c.btn === 'Mở Báo cáo tháng') onNavigate?.('reports');
              }}
            >
              {c.btn}
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
