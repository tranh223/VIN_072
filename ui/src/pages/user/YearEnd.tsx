import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Clock,
  FileDown,
  FileText,
  Mail,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
  Gavel,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { getStores, getYearEndSummary } from '../../api/client';
import type { StoreSummary } from '../../api/types';
import type { AuthUser, YearEndSummaryResponse } from '../../api/types';
import { formatVnd } from '../../lib/format';

const glass =
  'rounded-xl border border-outline-variant/80 bg-white/70 shadow-[0_4px_20px_rgba(26,22,77,0.06)] backdrop-blur-md';

type YearEndProps = {
  currentUser?: AuthUser | null;
  onNavigate?: (id: string, search?: string) => void;
};

export default function YearEnd({ currentUser, onNavigate }: YearEndProps) {
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<YearEndSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(() => {
    try {
      return searchParams.get('store_id') ?? window.localStorage.getItem('scaify_active_store_id') ?? '';
    } catch {
      return searchParams.get('store_id') ?? '';
    }
  });
  const activeStore = stores.find((s) => s.id === selectedStoreId);
  const scopeLabel = selectedStoreId
    ? activeStore?.store_name ?? 'Shop đã chọn'
    : 'Tổng hợp toàn bộ shop';

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    const data = await getYearEndSummary(undefined, currentUser?.id, selectedStoreId || undefined);
    setSummary(data);
    setLoading(false);
  };

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
      .then((data) => {
        if (alive) setStores(data.stores ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void getYearEndSummary(undefined, currentUser?.id, selectedStoreId || undefined)
      .then((data) => {
        if (alive) setSummary(data);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentUser?.id, selectedStoreId]);

  const readiness = summary?.readiness_score ?? 0;
  const checklist = summary?.checklist ?? [];
  const checklistDone = checklist.filter((r) => r.done).length;
  const checklistAllDone = summary?.is_ready ?? (checklist.length > 0 && checklistDone === checklist.length);
  const readinessLabel =
    summary?.readiness_label_vi ??
    (checklistAllDone ? 'Sẵn sàng chốt năm' : 'Chưa sẵn sàng quyết toán');
  const latestDocument = summary?.latest_document;
  const latestDocumentPdfUrl = typeof latestDocument?.pdf_url === 'string' ? latestDocument.pdf_url : '';
  const latestDocumentName = (() => {
    const n = latestDocument?.document_number;
    if (typeof n === 'string' && n.trim()) return n.trim();
    const url = latestDocumentPdfUrl;
    if (typeof url === 'string' && url.trim()) {
      const last = url.split('/').pop() ?? url;
      return decodeURIComponent(last);
    }
    return 'Chưa có chứng từ';
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1200px] space-y-8"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-product-tour="yearend-header">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface sm:text-3xl">
            Chuẩn bị hồ sơ cuối năm
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-outline">
            Checklist là trung tâm. Hoàn thiện các mục còn thiếu để sẵn sàng chốt năm và xuất bộ hồ sơ.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          {stores.length > 0 && (
            <div className="flex min-w-[220px] flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-outline">
                Cửa hàng
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="min-h-10 rounded-xl border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Tất cả shop</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name ?? s.store_code ?? s.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Badge>{summary?.year ? `${scopeLabel} • Năm ${summary.year}` : 'Chưa có dữ liệu'}</Badge>
        </div>
      </header>
      {loading && <p className="text-sm text-outline">Đang tải dữ liệu…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && summary?.has_data && !checklistAllDone && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <strong>Hồ sơ chưa hoàn tất.</strong> Checklist cuối năm: {checklistDone}/{checklist.length} mục.
          Các mục chưa xong thường là thiếu kỳ doanh thu hoặc chưa upload chứng từ — xem chi tiết bên dưới
          (cùng tiêu chí với cột « Còn thiếu » ở trang Cửa hàng).
        </motion.div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6" data-product-tour="yearend-kpis">
        <div className={`${glass} flex flex-col justify-between p-5 sm:p-6`}>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
              Tổng doanh thu
            </p>
            <p className="font-display text-2xl font-bold text-on-surface sm:text-3xl">
              {formatVnd(summary?.total_revenue ?? 0)}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
              <TrendingUp className="size-3.5 shrink-0" />
              Tổng hợp từ các kỳ đã có dữ liệu
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <Wallet className="size-6" />
            </div>
          </div>
        </div>

        <div className={`${glass} flex flex-col justify-between p-5 sm:p-6`}>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
              Giá trị đã ghi nhận
            </p>
            <p className="font-display text-2xl font-bold text-on-surface sm:text-3xl">
              {formatVnd(summary?.deducted_tax_amount ?? 0)}
            </p>
            <p className="mt-2 text-xs text-outline">Tổng giá trị đã ghi nhận trong hồ sơ</p>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="rounded-lg bg-sky-100 p-3 text-sky-800">
              <Wallet className="size-6" />
            </div>
          </div>
        </div>

        <div
          className={`${glass} flex flex-col justify-between border-l-4 border-l-emerald-500 p-5 sm:p-6`}
        >
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
              Checklist cuối năm
            </p>
            <p className="font-display text-2xl font-bold text-on-surface sm:text-3xl">
              {checklistDone}/{checklist.length || summary?.total_reports || 3}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
              <Check className="size-3.5 shrink-0" />
              {readiness}% · {readinessLabel}
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.('documents')}
              disabled={!onNavigate}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-bold text-emerald-900 transition-colors hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hồ sơ / Chứng từ
              <ArrowRight className="size-3.5 shrink-0" />
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="rounded-lg bg-emerald-100 p-3 text-emerald-800">
              <Gavel className="size-6" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-8">
          <div id="yearend-checklist" className={`${glass} overflow-hidden`} data-product-tour="yearend-checklist">
            <div className="flex flex-col gap-3 border-b border-outline-variant/60 bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
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
                  {showOnlyMissing ? 'Xem tất cả' : 'Xem mục còn thiếu'}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
                  onClick={() => void fetchSummary()}
                >
                  <RefreshCw className="size-4" />
                  Làm mới
                </button>
              </div>
            </div>
            <ul className="divide-y divide-outline-variant/40">
              {checklist.length === 0 && (
                <li className="p-5 text-sm text-outline">
                  Chưa có dữ liệu hồ sơ cuối năm để hiển thị.
                </li>
              )}
              {(showOnlyMissing ? checklist.filter((r) => !r.done) : checklist).map((row) => (
                <li
                  key={row.title}
                  className="flex flex-col gap-2 p-4 transition-colors hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between sm:p-5"
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
                      <p className="text-sm font-semibold text-on-surface">
                        {row.title}
                      </p>
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

          <div className="ai-border rounded-xl bg-gradient-to-r from-indigo-50/80 to-transparent p-5 sm:p-6">
            <div className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="mb-2 font-display text-base font-bold text-on-surface">
                  Thông tin hiệu quả từ AI
                </h3>
                <p className="text-sm leading-relaxed text-outline">
                  {summary?.has_data
                    ? checklistAllDone
                      ? `Đủ ${checklist.length} mục checklist cho năm ${summary.year} (doanh thu 12 kỳ, ước tính thuế, chứng từ).`
                      : `Còn ${checklist.length - checklistDone} mục chưa xong. Xem checklist — mỗi dòng ghi rõ thiếu gì (tháng, chứng từ…).`
                    : 'Chưa có đủ dữ liệu để tổng hợp hồ sơ cuối năm.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className={`${glass} flex flex-col items-center p-6 text-center sm:p-8`} data-product-tour="yearend-readiness">
            <p className="mb-6 text-[11px] font-bold uppercase tracking-widest text-secondary">
              Tình trạng hoàn thành
            </p>
            <div className="relative mb-8 flex size-40 items-center justify-center sm:size-48">
              <svg className="absolute size-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  className="text-slate-100"
                  stroke="currentColor"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  className="text-primary-container"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(readiness / 100) * 2 * Math.PI * 44} ${2 * Math.PI * 44}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="relative">
                <p className="text-4xl font-black text-on-surface">{readiness}%</p>
                <p className={`text-xs font-medium ${checklistAllDone ? 'text-outline' : 'text-amber-800'}`}>
                  {checklistAllDone ? 'Sẵn sàng chốt năm' : 'Chưa sẵn sàng quyết toán'}
                </p>
              </div>
            </div>
            <div className="w-full space-y-2">
              <Button
                type="button"
                variant="primary"
                block
                className="justify-center gap-2"
                onClick={() => {
                  const el = document.getElementById('yearend-checklist');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <ClipboardCheck className="size-4" />
                Hoàn thiện hồ sơ
              </Button>
              <Button
                type="button"
                variant="outline"
                block
                className="justify-center gap-2"
                onClick={() => setShowOnlyMissing(true)}
              >
                <Clock className="size-4" />
                Xem mục còn thiếu
              </Button>
              <Button
                type="button"
                variant="outline"
                block
                className="justify-center gap-2"
                disabled={!latestDocumentPdfUrl}
                onClick={() => {
                  if (latestDocumentPdfUrl) window.open(latestDocumentPdfUrl, '_blank', 'noopener,noreferrer');
                }}
                title={!latestDocumentPdfUrl ? 'Chưa có bộ hồ sơ/PDF để xuất' : undefined}
              >
                <FileDown className="size-4" />
                Xuất bộ hồ sơ năm
              </Button>
            </div>
            <div className="mt-8 w-full border-t border-outline-variant/50 pt-6">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-outline">Trạng thái hồ sơ</span>
                <span className={`font-bold ${checklistAllDone ? 'text-emerald-600' : 'text-amber-800'}`}>
                  {readinessLabel}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${readiness}%` }} />
              </div>
            </div>
          </div>

          <div className={`${glass} p-4 sm:p-5`}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-outline">
              Chứng từ gần nhất
            </p>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-on-surface">
                  Số CT: {latestDocumentName}
                </p>
                <p className="text-[10px] text-outline">
                  {latestDocumentPdfUrl ? 'Có file chứng từ/PDF đính kèm' : latestDocument ? 'Đã ghi nhận chứng từ' : 'Chưa có chứng từ gần đây'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
