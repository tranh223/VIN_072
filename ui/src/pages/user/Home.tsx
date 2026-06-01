import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Store,
  Upload,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import {
  getComplianceSummary,
  getDocuments,
  getHealth,
  getStores,
  getYearEndSummary,
  resolvePublicFileUrl,
} from '../../api/client';
import type {
  AuthUser,
  ComplianceSummaryResponse,
  DocumentItem,
  StoreSummary,
  YearEndSummaryResponse,
} from '../../api/types';
import ComplianceScoreChart from '../../components/charts/ComplianceScoreChart';
import { formatVnd } from '../../lib/format';
import { buildShopComplianceRows, pickRiskiestShop } from '../../lib/storeCompliance';
import TrendChart from '../../components/charts/TrendChart';
import { useJobs } from '../../hooks/useJobs';

type HomeProps = {
  onNavigate?: (id: string, search?: string) => void;
  currentUser?: AuthUser | null;
  /** Mở product tour từ card chào mừng. */
  onStartProductTour?: () => void;
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant/60 bg-white text-center">
      <Info size={28} className="text-outline/40" />
      <p className="max-w-xs text-sm text-outline">{message}</p>
    </div>
  );
}

function countDocumentBuckets(docs: DocumentItem[]) {
  let confirmed = 0;
  let review = 0;
  for (const d of docs) {
    if (d.status === 'Đã xác nhận') confirmed++;
    else if (d.status === 'Cần xem lại' || d.status === 'Thiếu thông tin') review++;
  }
  return { confirmed, review };
}

function persistActiveStore(id: string) {
  try {
    window.localStorage.setItem('scaify_active_store_id', id);
  } catch {
    /* ignore */
  }
}

function storeIdSearchParam(id: string) {
  return `store_id=${encodeURIComponent(id)}`;
}

function shopHasNoFiles(s: StoreSummary): boolean {
  const est = s.latest_estimation;
  const rep = s.latest_report;
  const hasEst = est && typeof est === 'object' && Object.keys(est).length > 0;
  const hasRep = rep && typeof rep === 'object' && Object.keys(rep).length > 0;
  return !hasEst && !hasRep;
}

export default function Home({ onNavigate, currentUser, onStartProductTour }: HomeProps) {
  const go = useCallback((id: string, search?: string) => onNavigate?.(id, search), [onNavigate]);

  const { jobs: sessionJobs, loading: sessionJobsLoading } = useJobs(12_000, currentUser?.id ?? null);

  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [summary, setSummary] = useState<ComplianceSummaryResponse | null>(null);
  const [yearEnd, setYearEnd] = useState<YearEndSummaryResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const refetchCore = useCallback(async () => {
    setLoading(true);
    void getHealth().catch(() => undefined);
    try {
      const [stRes, comp, ye] = await Promise.all([
        getStores(currentUser?.id),
        getComplianceSummary(currentUser?.id),
        getYearEndSummary(undefined, currentUser?.id),
      ]);
      setStores(stRes.stores);
      setSummary(comp);
      setYearEnd(ye);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    void refetchCore();
  }, [refetchCore]);

  useEffect(() => {
    if (!currentUser?.id || stores.length !== 1 || !stores[0]?.id) {
      setDocuments([]);
      return;
    }
    let alive = true;
    void getDocuments({
      user_id: currentUser.id,
      store_id: stores[0].id,
      limit: 400,
    }).then((d) => {
      if (alive) setDocuments(d.documents);
    });
    return () => {
      alive = false;
    };
  }, [currentUser?.id, stores]);

  const latest = summary?.latest_estimation ?? {};
  const detail =
    latest.calculation_detail && typeof latest.calculation_detail === 'object'
      ? (latest.calculation_detail as Record<string, unknown>)
      : {};
  const rawAlerts = Array.isArray(detail.alerts)
    ? (detail.alerts as Array<{ code?: string; level?: string; message?: string }>)
    : [];

  const hasRealData = Boolean(summary?.has_data) || stores.length > 0;
  const isMultiShop = stores.length >= 2;
  const isSingleShopLayout = !isMultiShop;

  const primaryStoreId = stores.length === 1 && stores[0]?.id ? stores[0].id : null;

  const trendData = useMemo(() => {
    if (!summary?.trend || summary.trend.length < 2) return null;
    return summary.trend.map((t) => ({
      period: t.period ?? '',
      revenue: Number(t.total_revenue ?? 0),
      tax: Number(t.payable_tax ?? 0),
    }));
  }, [summary]);

  const shopCompareData = useMemo(() => {
    if (stores.length < 2) return null;
    const rows = stores.map((s) => {
      const report = s.latest_report as Record<string, unknown> | null | undefined;
      const est = s.latest_estimation as Record<string, unknown> | null | undefined;
      return {
        name: s.store_name?.trim() || s.store_code || 'Shop',
        revenue: Number(
          est?.total_revenue ?? report?.net_revenue ?? report?.taxable_revenue ?? 0
        ),
        tax: Number(est?.payable_tax ?? 0),
      };
    });
    return rows.some((r) => r.revenue > 0) ? rows : null;
  }, [stores]);

  const shopScoreData = useMemo(() => {
    if (stores.length < 2) return null;
    return buildShopComplianceRows(stores);
  }, [stores]);

  const shopScoreChartData = useMemo(() => {
    if (!shopScoreData) return null;
    const rows = shopScoreData.filter((r): r is typeof r & { score: number } => r.score != null);
    return rows.length ? rows : null;
  }, [shopScoreData]);

  const riskiestShop = useMemo(
    () => (shopScoreData ? pickRiskiestShop(shopScoreData) : null),
    [shopScoreData]
  );

  const storeIdByDisplayName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stores) {
      const label = s.store_name?.trim() || s.store_code || 'Shop';
      if (s.id) m.set(label, s.id);
    }
    return m;
  }, [stores]);

  const goComplianceForShopName = useCallback(
    (name: string) => {
      const id = storeIdByDisplayName.get(name);
      if (id) {
        persistActiveStore(id);
        go('compliance', storeIdSearchParam(id));
      } else go('compliance');
    },
    [go, storeIdByDisplayName]
  );

  const handleQuickUpload = useCallback(() => {
    setQuickActionsOpen(false);
    if (stores.length === 0) go('shops');
    else if (primaryStoreId) {
      persistActiveStore(primaryStoreId);
      go('upload', storeIdSearchParam(primaryStoreId));
    } else go('upload');
  }, [go, primaryStoreId, stores.length]);

  const handleQuickReports = useCallback(() => {
    setQuickActionsOpen(false);
    go('reports', primaryStoreId ? storeIdSearchParam(primaryStoreId) : undefined);
  }, [go, primaryStoreId]);

  const handleQuickYearEnd = useCallback(() => {
    setQuickActionsOpen(false);
    go('yearend', primaryStoreId ? storeIdSearchParam(primaryStoreId) : undefined);
  }, [go, primaryStoreId]);

  const goUploadForShopName = useCallback(
    (name: string) => {
      const id = storeIdByDisplayName.get(name);
      if (id) {
        persistActiveStore(id);
        go('upload', storeIdSearchParam(id));
      } else go('upload');
    },
    [go, storeIdByDisplayName]
  );

  const latestPeriod = summary?.trend?.length
    ? summary.trend[summary.trend.length - 1]?.period
    : null;

  const docBuckets = useMemo(() => countDocumentBuckets(documents), [documents]);
  const missingChecklistItems =
    yearEnd?.checklist?.filter((r) => !r.done).length ?? null;

  const shopsTracked = stores.length;
  const shopsNeedingAction = useMemo(
    () =>
      (shopScoreData ?? []).filter((r) => (r.score != null && r.score < 70) || r.alertCount > 0).length,
    [shopScoreData]
  );

  const shopsMissingFiles = useMemo(() => stores.filter(shopHasNoFiles).length, [stores]);

  const riskiestRevenue = useMemo(() => {
    if (!riskiestShop || !shopCompareData) return null;
    return shopCompareData.find((r) => r.name === riskiestShop.name)?.revenue ?? null;
  }, [riskiestShop, shopCompareData]);

  const checklistRows = yearEnd?.checklist ?? [];

  const sessionJobsError = useMemo(
    () => sessionJobs.filter((j) => j.status === 'error'),
    [sessionJobs]
  );
  const sessionJobsProcessing = useMemo(
    () => sessionJobs.filter((j) => j.status === 'processing').slice(0, 4),
    [sessionJobs]
  );

  const openUploadForJob = useCallback(
    (jobId: string, storeId: string | null | undefined) => {
      const qs = new URLSearchParams();
      if (storeId) qs.set('store_id', storeId);
      qs.set('job_id', jobId);
      go('upload', qs.toString());
    },
    [go]
  );

  const recentDoc = useMemo(() => {
    const sorted = [...documents].sort(
      (a, b) =>
        new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime()
    );
    if (sorted[0]) return { type: 'item' as const, item: sorted[0] };
    const ld = yearEnd?.latest_document;
    if (ld && typeof ld === 'object') return { type: 'legacy' as const, item: ld as Record<string, unknown> };
    return null;
  }, [documents, yearEnd?.latest_document]);

  const recentDocTitle = (() => {
    if (!recentDoc) return null;
    if (recentDoc.type === 'item') {
      return recentDoc.item.filename?.trim() || recentDoc.item.document_type || 'Chứng từ';
    }
    const n = recentDoc.item.document_number;
    if (typeof n === 'string' && n.trim()) return n.trim();
    const url = recentDoc.item.pdf_url;
    if (typeof url === 'string' && url.trim()) {
      const last = url.split('/').pop() ?? url;
      return decodeURIComponent(last);
    }
    return 'Chứng từ gần nhất';
  })();

  const openRecentFile = () => {
    if (!recentDoc) return;
    if (recentDoc.type === 'item') {
      const u = resolvePublicFileUrl(recentDoc.item.file_url);
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
      else go('documents', primaryStoreId ? storeIdSearchParam(primaryStoreId) : undefined);
      return;
    }
    const url = recentDoc.item.pdf_url ?? recentDoc.item.file_url;
    const u = typeof url === 'string' ? resolvePublicFileUrl(url) : null;
    if (u) window.open(u, '_blank', 'noopener,noreferrer');
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex items-start gap-6 xl:gap-8"
    >
      <div className="min-w-0 flex-1 space-y-8">
        {currentUser && (
          <div
            className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-white to-sky-50/40 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
            data-product-tour="home-welcome"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/80">Chào mừng</p>
                <p className="mt-1 font-display text-lg font-bold text-on-surface">
                  Xin chào,{' '}
                  <span className="text-primary">{currentUser.full_name?.trim() || 'bạn'}</span>
                </p>
                <p className="mt-1 max-w-prose text-xs leading-relaxed text-outline">
                  Bắt đầu từ shop → upload CSV & chứng cứ → theo dõi phiên và đối soát. Bạn có thể mở lại hướng dẫn
                  nhanh bất cứ lúc nào.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
              {onStartProductTour && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="gap-2"
                  onClick={() => onStartProductTour()}
                  data-product-tour="home-guide-button"
                >
                  Hướng dẫn các bước
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => go('history')}>
                Lịch sử phiên
              </Button>
            </div>
          </div>
        )}

        {!loading && !hasRealData && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/60 bg-surface px-4 py-3">
            <div>
              <p className="text-xs font-bold text-on-surface">Chưa có dữ liệu đối soát</p>
              <p className="text-[11px] text-outline">
                Thêm cửa hàng, tải CSV và chứng cứ — KPI và checklist cập nhật sau khi có phiên xử lý.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => go('shops')}>
              Thêm shop
            </Button>
          </div>
        )}

        {/* Hero — tránh flex-row ép khối mô tả còn vài px (chữ xuống dòng từng từ) */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between xl:gap-8" data-product-tour="home-hero">
          <div className="w-full min-w-0 xl:min-w-[min(100%,22rem)] xl:flex-1 xl:max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-outline">
              {isMultiShop ? 'Đa cửa hàng' : 'Một cửa hàng'}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-balance text-on-surface sm:text-3xl">
              {isMultiShop ? 'Quản lý nhiều shop' : 'Chuẩn bị hồ sơ kỳ này'}
            </h1>
            <p className="mt-2 w-full max-w-prose text-sm leading-relaxed text-outline">
              {isMultiShop
                ? `Theo dõi ${stores.length} shop — ưu tiên shop rủi ro và bổ sung chứng từ thiếu.`
                : stores.length === 1
                  ? latestPeriod
                    ? `${stores[0].store_name ?? 'Shop'} · kỳ gần nhất ${latestPeriod}`
                    : `${stores[0].store_name ?? 'Shop'} — gom CSV, chứng cứ và đối soát cho hồ sơ kỳ này.`
                  : 'Thêm shop và tải dữ liệu để bắt đầu.'}
            </p>
          </div>
          <div className="relative w-full shrink-0 lg:mt-0.5 lg:w-auto">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full gap-2 border-2 border-transparent shadow-md shadow-primary/15 sm:w-auto"
              onClick={() => setQuickActionsOpen((open) => !open)}
              aria-expanded={quickActionsOpen}
              aria-haspopup="menu"
              data-product-tour="home-quick-actions"
            >
              <ClipboardCheck size={16} />
              Thao tác nhanh
              <ChevronDown
                size={16}
                className={`transition-transform ${quickActionsOpen ? 'rotate-180' : ''}`}
              />
            </Button>
            {quickActionsOpen && (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-2 w-full min-w-56 overflow-hidden rounded-xl border border-outline-variant bg-white p-1 shadow-xl shadow-black/10 sm:w-64"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-display text-sm font-bold text-on-surface transition-colors hover:bg-surface hover:text-primary"
                  onClick={handleQuickUpload}
                >
                  <ClipboardCheck size={16} className="text-primary" />
                  Đối soát ngay
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-display text-sm font-bold text-on-surface transition-colors hover:bg-surface hover:text-primary"
                  onClick={handleQuickReports}
                >
                  <FileText size={16} className="text-primary" />
                  Báo cáo tháng
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-display text-sm font-bold text-on-surface transition-colors hover:bg-surface hover:text-primary"
                  onClick={handleQuickYearEnd}
                >
                  <Calendar size={16} className="text-primary" />
                  Chuẩn bị hồ sơ năm
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KPI — 3 ô */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-product-tour="home-kpis">
          {isMultiShop ? (
            <>
              <KpiTile
                label="Shop đang theo dõi"
                value={String(shopsTracked)}
                note={latestPeriod ? `Kỳ gần nhất: ${latestPeriod}` : 'Đã kết nối'}
                accent={shopsTracked === 0}
                onAction={() => go('shops')}
                actionLabel="Mở danh mục shop"
              />
              <KpiTile
                label="Shop cần xử lý"
                value={shopsTracked ? String(shopsNeedingAction) : '—'}
                note="Điểm thấp hoặc có cảnh báo đối soát"
                accent={shopsNeedingAction > 0}
                onAction={() => (riskiestShop ? goComplianceForShopName(riskiestShop.name) : go('compliance'))}
                actionLabel="Xem chi tiết"
              />
              <KpiTile
                label="Shop thiếu file"
                value={shopsTracked ? String(shopsMissingFiles) : '—'}
                note="Chưa có báo cáo / ước tính từ phiên"
                accent={shopsMissingFiles > 0}
                onAction={() => go('upload')}
                actionLabel="Tải dữ liệu"
              />
            </>
          ) : (
            <>
              <KpiTile
                label="File đã xác nhận"
                value={primaryStoreId ? String(docBuckets.confirmed) : '—'}
                note="Trong kho Hồ sơ / Chứng từ"
                accent={false}
                onAction={() =>
                  go('documents', primaryStoreId ? storeIdSearchParam(primaryStoreId) : undefined)
                }
                actionLabel="Mở kho"
              />
              <KpiTile
                label="File cần xem lại"
                value={primaryStoreId ? String(docBuckets.review) : '—'}
                note="Trạng thái cần xem lại hoặc thiếu thông tin"
                accent={docBuckets.review > 0}
                onAction={() =>
                  go('documents', primaryStoreId ? storeIdSearchParam(primaryStoreId) : undefined)
                }
                actionLabel="Xem trong kho"
              />
              <KpiTile
                label="Hồ sơ còn thiếu"
                value={missingChecklistItems == null ? '—' : String(missingChecklistItems)}
                note="Mục checklist chưa đạt (tổng hợp năm)"
                accent={missingChecklistItems != null && missingChecklistItems > 0}
                onAction={() => go('yearend', primaryStoreId ? storeIdSearchParam(primaryStoreId) : undefined)}
                actionLabel="Chi tiết checklist"
              />
            </>
          )}
        </div>

        {/* ── 1 shop: checklist + chứng từ gần nhất ── */}
        {isSingleShopLayout && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <section className="lg:col-span-8">
              <div className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm" data-product-tour="home-checklist">
                <div className="flex flex-col gap-3 border-b border-outline-variant/60 bg-surface/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold text-on-surface">
                    <ClipboardCheck className="size-5 text-primary" />
                    Checklist hồ sơ
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-outline hover:border-primary/40 hover:text-primary"
                      onClick={() => setShowOnlyMissing((v) => !v)}
                    >
                      {showOnlyMissing ? 'Xem tất cả' : 'Chỉ mục còn thiếu'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
                      onClick={() => void refetchCore()}
                    >
                      <RefreshCw className="size-4" />
                      Làm mới
                    </button>
                  </div>
                </div>
                <ul className="divide-y divide-outline-variant/40">
                  {checklistRows.length === 0 && (
                    <li className="p-5 text-sm text-outline">
                      Chưa có checklist tổng hợp. Sau khi có dữ liệu phiên và báo cáo năm, các mục sẽ hiển thị tại đây.
                    </li>
                  )}
                  {(showOnlyMissing ? checklistRows.filter((r) => !r.done) : checklistRows).map((row) => (
                    <li
                      key={row.title}
                      className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                            row.done ? 'bg-emerald-100' : 'bg-slate-200'
                          }`}
                        >
                          {row.done ? (
                            <Check className="size-4 text-emerald-600" strokeWidth={3} />
                          ) : (
                            <Clock className="size-4 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{row.title}</p>
                          <p className="text-xs text-outline">{row.sub}</p>
                        </div>
                      </div>
                      {row.meta && (
                        <span className="shrink-0 font-mono text-[11px] text-outline sm:text-right">
                          {row.meta}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <aside className="lg:col-span-4" data-product-tour="home-recent-document">
              <div className="rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
                <h3 className="font-display text-base font-bold text-on-surface">Chứng từ gần nhất</h3>
                {!recentDoc || !recentDocTitle ? (
                  <p className="mt-3 text-sm text-outline">Chưa có chứng từ trong kho. Upload để thấy bản ghi mới nhất.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold text-on-surface break-words">{recentDocTitle}</p>
                    {recentDoc.type === 'item' && (
                      <ul className="space-y-1.5 text-[11px] text-outline">
                        {recentDoc.item.period && (
                          <li>
                            <span className="font-bold text-on-surface">Kỳ:</span> {recentDoc.item.period}
                          </li>
                        )}
                        <li>
                          <span className="font-bold text-on-surface">Loại:</span> {recentDoc.item.document_type}
                        </li>
                        <li>
                          <span className="font-bold text-on-surface">Trạng thái:</span> {recentDoc.item.status}
                        </li>
                      </ul>
                    )}
                    <div className="flex flex-col gap-2 pt-2">
                      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openRecentFile}>
                        <FileText size={14} />
                        Mở file
                      </Button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        onClick={() =>
                          go('documents', primaryStoreId ? storeIdSearchParam(primaryStoreId) : undefined)
                        }
                      >
                        Xem toàn bộ kho <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ── Đa shop: shop rủi ro nhất + tổng hợp theo kỳ ── */}
        {isMultiShop && shopScoreChartData && (
          <section className="mb-6" data-product-tour="home-shop-scores">
            <ComplianceScoreChart
              data={shopScoreChartData}
              onShopBarClick={goComplianceForShopName}
            />
          </section>
        )}

        {isMultiShop && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8"
          >
            <section className="lg:col-span-5" data-product-tour="home-risk-shop">
              <div className="rounded-2xl border-2 border-red-100 bg-gradient-to-b from-red-50/50 to-white p-5 shadow-sm sm:p-6">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Shop rủi ro nhất</p>
                {riskiestShop ? (
                  <>
                    <p className="mt-2 font-display text-xl font-bold text-on-surface">{riskiestShop.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-white px-2.5 py-1 font-bold text-on-surface shadow-sm">
                        Điểm: {riskiestShop.score}/100
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-800">
                        Cảnh báo: {riskiestShop.alertCount}
                      </span>
                    </div>
                    {riskiestRevenue != null && riskiestRevenue > 0 && (
                      <p className="mt-3 text-sm text-outline">
                        Doanh thu tham chiếu:{' '}
                        <span className="font-mono font-semibold text-primary">{formatVnd(riskiestRevenue)}</span>
                      </p>
                    )}
                    <p className="mt-3 text-xs text-outline">
                      Ưu tiên đối soát và bổ sung chứng cứ cho shop này trước.
                    </p>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        className="gap-2"
                        onClick={() => goComplianceForShopName(riskiestShop.name)}
                      >
                        Sức khỏe hồ sơ
                        <ArrowRight className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="gap-2"
                        onClick={() => goUploadForShopName(riskiestShop.name)}
                      >
                        <Upload size={16} />
                        Upload thêm
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-outline">
                    Chưa đủ dữ liệu để xếp hạng. Chạy đối soát cho từng shop.
                  </p>
                )}
              </div>
            </section>
            <section className="lg:col-span-7" data-product-tour="home-trend">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-on-surface">Tổng hợp theo kỳ</h2>
                {latestPeriod && (
                  <span className="rounded-full border border-outline-variant/60 px-2.5 py-0.5 text-[11px] font-medium text-outline">
                    Kỳ gần nhất: {latestPeriod}
                  </span>
                )}
              </div>
              {trendData ? (
                <TrendChart
                  data={trendData}
                  onChartClick={() => go('reports')}
                />
              ) : (
                <EmptyChart message="Chưa có đủ kỳ để vẽ xu hướng (cần ít nhất 2 kỳ có dữ liệu)." />
              )}
            </section>
          </motion.div>
        )}

        <section data-product-tour="home-alerts">
          <h2 className="mb-3 font-display text-base font-bold text-on-surface">
            Cảnh báo đối soát (ước tính gần nhất)
          </h2>
          {rawAlerts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant/70 bg-surface/40 px-4 py-3 text-sm text-outline">
              Chưa có cảnh báo từ bản ghi ước tính thuế mới nhất. Sau khi upload và chạy đối soát, các mã như lệch
              CSV/chứng từ hoặc ngưỡng doanh thu sẽ hiển thị tại đây.{' '}
              <button type="button" className="font-bold text-primary hover:underline" onClick={() => go('compliance')}>
                Mở Sức khỏe hồ sơ
              </button>
            </p>
          ) : (
            <div className="space-y-2">
              {rawAlerts.slice(0, 4).map((alert) => (
                <button
                  key={`${alert.code}-${alert.message}`}
                  type="button"
                  onClick={() => {
                    if (primaryStoreId) {
                      persistActiveStore(primaryStoreId);
                      go('compliance', storeIdSearchParam(primaryStoreId));
                    } else if (isMultiShop) go('history', 'filter=pending');
                    else go('compliance');
                  }}
                  className="flex w-full items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5 text-left transition-colors hover:border-red-200 hover:bg-red-50/90"
                >
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9px] font-bold text-red-400">{alert.code}</p>
                    <p className="text-sm font-semibold text-on-surface">
                      {alert.message ?? 'Cần kiểm tra hồ sơ'}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-primary">Mở đối soát chi tiết →</p>
                  </div>
                  <StatusBadge
                    status={alert.level === 'WARNING' ? 'error' : 'processing'}
                    label={alert.level ?? ''}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Phiên xử lý (job in-memory) — đặt dưới cảnh báo đối soát */}
        {currentUser?.id && (
          <section className="rounded-2xl border border-outline-variant/80 bg-white p-4 shadow-sm sm:p-5" data-product-tour="home-session-alerts">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-on-surface">Cảnh báo phiên xử lý</h2>
              <button
                type="button"
                className="text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
                onClick={() => go('history')}
              >
                Xem tất cả phiên →
              </button>
            </div>
            {sessionJobsLoading ? (
              <div className="flex items-center gap-2 text-sm text-outline">
                <Loader2 className="size-4 animate-spin" />
                Đang tải trạng thái phiên…
              </div>
            ) : sessionJobsError.length === 0 && sessionJobsProcessing.length === 0 ? (
              <p className="rounded-xl border border-dashed border-outline-variant/70 bg-surface/40 px-4 py-3 text-sm text-outline">
                Không có phiên lỗi hoặc đang xử lý trong phiên làm việc hiện tại. Danh sách đầy đủ nằm ở{' '}
                <button type="button" className="font-bold text-primary hover:underline" onClick={() => go('history')}>
                  Lịch sử phiên
                </button>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {sessionJobsError.map((j) => (
                  <li key={j.job_id}>
                    <button
                      type="button"
                      onClick={() => openUploadForJob(j.job_id, j.store_id)}
                      className="flex w-full items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-3 text-left transition-colors hover:border-red-300"
                    >
                      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Phiên lỗi</p>
                        <p className="mt-0.5 truncate font-mono text-xs text-outline">{j.filename ?? j.job_id}</p>
                        <p className="mt-1 text-sm font-semibold text-on-surface">
                          {j.error?.trim() || 'Pipeline không hoàn tất. Mở để xem chi tiết hoặc tải lại.'}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-primary">Mở Upload / Review →</p>
                      </div>
                      <StatusBadge status="error" label="Lỗi" />
                    </button>
                  </li>
                ))}
                {sessionJobsProcessing.map((j) => (
                  <li key={j.job_id}>
                    <button
                      type="button"
                      onClick={() => openUploadForJob(j.job_id, j.store_id)}
                      className="flex w-full items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-left transition-colors hover:border-sky-300"
                    >
                      <Clock className="mt-0.5 size-5 shrink-0 text-sky-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Đang xử lý</p>
                        <p className="mt-0.5 truncate font-mono text-xs text-outline">{j.filename ?? j.job_id}</p>
                        <p className="mt-1 text-sm text-on-surface">
                          Phiên vẫn chạy trong phiên làm việc này — mở trang Tải dữ liệu để theo dõi.
                        </p>
                      </div>
                      <StatusBadge status="processing" label="Chạy" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {stores.length === 0 && !loading && (
          <div className="space-y-5 rounded-2xl border-2 border-dashed border-outline-variant p-6 text-center" data-product-tour="home-empty-start">
            <div className="flex flex-col items-center gap-3">
              <Store size={36} className="text-outline/40" />
              <p className="font-display font-bold text-on-surface">Bắt đầu với cửa hàng đầu tiên</p>
              <p className="max-w-xl text-sm text-outline">
                Thêm shop, upload CSV và chứng cứ — checklist và kho hồ sơ sẽ cập nhật theo từng phiên.
              </p>
            </div>
            <Button type="button" variant="primary" size="md" className="gap-2" onClick={() => go('shops')}>
              <PlusCircle size={16} /> Thêm cửa hàng
            </Button>
          </div>
        )}
      </div>

    </motion.div>
  );
}

function KpiTile({
  label,
  value,
  note,
  accent,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  note: string;
  accent: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        accent ? 'border-red-200 bg-red-50' : 'border-outline-variant bg-white'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</p>
      <p
        className={`mt-2 font-display text-xl font-bold sm:text-2xl ${accent ? 'text-red-600' : 'text-primary'}`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-outline">{note}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
      >
        {actionLabel} <ChevronRight size={14} />
      </button>
    </div>
  );
}
