import { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  FileImage,
  GitCompare,
  Loader2,
  Sparkles,
  ArrowRight,
  Calculator,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { getExtraction, getTax } from '../../api/client';
import type { ECommerceEvidenceDocument, ExtractionResponse, TaxResponse } from '../../api/types';
import { formatVnd } from '../../lib/format';

type Props = {
  jobId: string | null;
  busy?: boolean;
  onExplain: (code?: string | null) => void;
  refreshKey?: number;
  /** Nếu true: ẩn 2 card nguồn (CSV/OCR) để tránh trùng khi Upload.tsx đã hiển thị ở phía trên */
  hideSourceCards?: boolean;
  /** Callback để Upload.tsx lấy dữ liệu hiển thị vào các khối phía trên */
  onData?: (payload: { extraction: ExtractionResponse | null; tax: TaxResponse | null; loading: boolean; error: string | null }) => void;
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickSummarySum(summary: Record<string, unknown> | undefined, key: string): unknown {
  const block = summary?.[key];
  if (block && typeof block === 'object' && !Array.isArray(block) && 'sum' in block) {
    return (block as { sum?: unknown }).sum;
  }
  return undefined;
}

export default function UploadReviewPanel({
  jobId,
  busy,
  onExplain,
  refreshKey = 0,
  hideSourceCards = false,
  onData,
}: Props) {
  const [ex, setEx] = useState<ExtractionResponse | null>(null);
  const [tx, setTx] = useState<TaxResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onData?.({ extraction: ex, tax: tx, loading, error: loadError });
  }, [ex, tx, loading, loadError, onData]);

  useEffect(() => {
    if (!jobId) {
      setEx(null);
      setTx(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const [e, t] = await Promise.all([getExtraction(jobId), getTax(jobId)]);
        if (cancelled) return;

        const extractionDone = e.status !== 'processing';
        const taxDone = t.status === 'done';

        setEx(extractionDone ? e : null);
        // Giữ lại phần thuế ước tính (dashboard/tax_result) ngay cả khi đang processing,
        // để UI có thể hiển thị phần "Tạm tính" thay vì trống hoàn toàn.
        setTx(t);
        setLoadError(null);

        if (!extractionDone || !taxDone) {
          timer = setTimeout(() => {
            void poll();
          }, 2000);
        }
      } catch (error) {
        if (cancelled) return;
        setEx(null);
        setTx(null);
        setLoadError(error instanceof Error ? error.message : 'Không tải được kết quả từ máy chủ.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, refreshKey]);

  if (!jobId) return null;

  const csv = ex?.csv_result as Record<string, unknown> | undefined;
  const ocr = ex?.ocr_result as (Record<string, unknown> & Partial<ECommerceEvidenceDocument>) | undefined;

  const csvData = csv?.data as Record<string, unknown> | undefined;
  const csvSummary = csvData?.summary as Record<string, unknown> | undefined;

  const rawIndustry = typeof csv?.industry === 'string' && csv.industry !== 'N/A' ? csv.industry : '—';
  let industry = rawIndustry;
  if (rawIndustry === 'goods') industry = 'Phân phối, hàng hóa';
  if (rawIndustry === 'services') industry = 'Dịch vụ, xây dựng';
  if (rawIndustry === 'manufacturing') industry = 'Sản xuất, vận tải';
  if (rawIndustry === 'other') industry = 'Kinh doanh khác';

  const revenueCsv = num(
    pickSummarySum(csvSummary, 'revenue_raw') ??
      pickSummarySum(csvSummary, 'revenue') ??
      csv?.revenue_raw ??
      csv?.revenue
  );

  const ocrNested = ocr?.data as Record<string, unknown> | undefined;
  const revenueDoc = num(
    ocr?.revenue_reported ??
      ocrNested?.revenue_reported ??
      ocrNested?.revenue ??
      ocrNested?.subtotal
  );

  const issueDate =
    typeof ocr?.issue_date === 'string'
      ? ocr.issue_date
      : typeof ocrNested?.issue_date === 'string'
        ? ocrNested.issue_date
        : '—';
  const mst =
    typeof ocr?.issuer_tax_code === 'string' && ocr.issuer_tax_code !== 'N/A'
      ? ocr.issuer_tax_code
      : typeof ocr?.seller_tax_code === 'string'
        ? ocr.seller_tax_code
        : typeof ocrNested?.seller_tax_code === 'string'
          ? ocrNested.seller_tax_code
          : '—';
  const sellerName =
    typeof ocr?.seller_name === 'string' && ocr.seller_name !== 'N/A'
      ? ocr.seller_name
      : typeof ocrNested?.seller_name === 'string'
        ? ocrNested.seller_name
        : '—';
  const counterparty =
    typeof ocr?.counterparty === 'string' && ocr.counterparty !== 'N/A'
      ? ocr.counterparty
      : typeof ocrNested?.counterparty === 'string'
        ? ocrNested.counterparty
        : '—';
  const orderId =
    typeof ocr?.order_id === 'string' && ocr.order_id !== 'N/A'
      ? ocr.order_id
      : typeof ocrNested?.order_id === 'string'
        ? ocrNested.order_id
        : '—';
  const documentType =
    typeof ocr?.document_type === 'string' && ocr.document_type !== 'N/A'
      ? ocr.document_type
      : typeof ocrNested?.document_type === 'string'
        ? ocrNested.document_type
        : '—';

  const tr = tx?.tax_result as Record<string, unknown> | undefined;
  const annualized = num(tr?.annualized_revenue);
  const gtgt = num(tr?.gtgt_due);
  const tncn = num(tr?.tncn_due);
  const payableTax = num(tr?.total_tax_due);
  const hasCalculatedTax = annualized > 0 || payableTax > 0 || gtgt > 0;
  const taxDone = (tx as { status?: unknown } | null)?.status === 'done';

  const deltaRevenue =
    revenueCsv > 0 && revenueDoc > 0 ? Math.abs(revenueCsv - revenueDoc) : 0;
  const ratioRev = revenueCsv > 0 ? deltaRevenue / revenueCsv : 0;
  const revenueMismatch =
    revenueCsv > 0 && revenueDoc > 0 && (deltaRevenue >= 5_000_000 || ratioRev >= 0.05);
  const explainCode = revenueMismatch ? 'CSV_VLM_MISMATCH' : null;

  const alertCount = tx?.alerts?.length ?? 0;
  const extractDone = !!ex && ex.status !== 'processing';

  const hasAInputs = revenueCsv > 0 && revenueDoc > 0;
  // Chỉ "xanh" khi dữ liệu doanh thu khớp và có đủ dữ liệu để so sánh.
  const allNormal = hasAInputs && !revenueMismatch;
  const abnormal = !allNormal;
  const pct = num(tx?.dashboard?.pct_of_threshold);

  return (
    <div className="space-y-6 rounded-3xl border border-outline-variant bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold text-primary">Trích xuất & đối soát hồ sơ</h3>
            <Badge variant="outline" className="text-[10px] uppercase">
              OCR + Dữ liệu bán hàng
            </Badge>
          </div>
          <p className="text-sm text-outline">
            Xem nhanh kết quả đối chiếu dữ liệu trước khi quay về Trang chủ.
          </p>
        </div>
        {busy && <Loader2 className="size-6 shrink-0 animate-spin text-primary" />}
      </div>

      {loading && !ex && (
        <p className="text-sm text-outline">Đang tải kết quả trích xuất…</p>
      )}
      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {loadError}
        </p>
      )}

      {ex?.errors && ex.errors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-semibold">Pipeline báo lỗi (kiểm tra OCR / file):</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {ex.errors.slice(0, 5).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={`grid gap-4 ${hideSourceCards ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
        {!hideSourceCards && (
          <div className="rounded-2xl border border-outline-variant/80 bg-surface-container-low/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-outline">
              <FileSpreadsheet className="size-4 text-primary" />
              Dữ liệu bán hàng
            </div>
            {csv ? (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Ngành hàng</span>
                  <span className="font-mono">{industry}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Doanh thu (CSV)</span>
                  <span className="font-mono font-semibold text-on-surface">{formatVnd(revenueCsv)}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Kỳ</span>
                  <span className="font-mono text-xs">{String(csv?.period ?? 'N/A')}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Nguồn</span>
                  <span className="font-mono text-xs">{String(csv?.platform_name ?? csv?.platform ?? 'N/A')}</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-outline">Chưa có dữ liệu bán hàng trong phiên hoặc đang xử lý.</p>
            )}
          </div>
        )}

        {!hideSourceCards && (
          <div className="rounded-2xl border border-outline-variant/80 bg-surface-container-low/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-outline">
              <FileImage className="size-4 text-primary" />
              Chứng cứ giao dịch
            </div>
            {ocr ? (
              <ul className="space-y-2 text-sm">
                {Array.isArray((ocr as { warnings?: unknown }).warnings) &&
                  ((ocr as { warnings: string[] }).warnings?.length ?? 0) > 0 && (
                    <li className="mb-2 rounded-lg border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-xs text-amber-950">
                      <span className="font-bold">OCR/VLM: </span>
                      {(ocr as { warnings: string[] }).warnings.slice(0, 3).join(' · ')}
                    </li>
                  )}
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Doanh thu trên chứng từ</span>
                  <span className="font-mono font-semibold text-on-surface">{formatVnd(revenueDoc)}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Loại chứng từ</span>
                  <span className="font-mono text-xs">{documentType}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Ngày giao dịch</span>
                  <span className="font-mono text-xs">{issueDate}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Đối tác / khách hàng</span>
                  <span className="font-mono text-xs">{counterparty}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Mã đơn hàng</span>
                  <span className="font-mono text-xs">{orderId}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Đơn vị phát hành</span>
                  <span className="max-w-[140px] truncate font-mono text-xs">{sellerName}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">MST đơn vị trên chứng từ</span>
                  <span className="max-w-[140px] truncate font-mono text-xs">{mst}</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-outline">Chưa có chứng từ hoặc đang xử lý.</p>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl border p-4 ${
            abnormal ? 'border-red-200 bg-red-50/70' : 'border-emerald-200 bg-emerald-50/60'
          }`}
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-outline">
            <GitCompare className="size-4 text-primary" />
            Đối soát dữ liệu bán hàng với chứng cứ giao dịch
          </div>
          {csv && ocr ? (
            <>
              <div className="space-y-3 text-sm text-on-surface">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-outline">A. Đối soát doanh thu</p>
                  <p className="mt-1">
                    Dữ liệu bán hàng <span className="font-mono">{formatVnd(revenueCsv)}</span> · Chứng cứ{' '}
                    <span className="font-mono">{formatVnd(revenueDoc)}</span>
                    {revenueCsv > 0 && revenueDoc > 0 ? (
                      <>
                        {' '}
                        — chênh <span className="font-mono font-bold">{formatVnd(deltaRevenue)}</span>
                      </>
                    ) : null}
                  </p>
                  <p className={`mt-1 text-xs font-semibold ${revenueMismatch ? 'text-red-700' : hasAInputs ? 'text-emerald-800' : 'text-red-700'}`}>
                    {revenueCsv > 0 && revenueDoc > 0
                      ? revenueMismatch
                        ? 'Lệch doanh thu giữa dữ liệu bán hàng và chứng cứ.'
                        : 'Không phát hiện lệch doanh thu (theo ngưỡng hiện tại).'
                      : 'Thiếu một trong hai số doanh thu để đối soát A.'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-outline">B. Thuế ước tính theo hệ thống</p>
                  <p className="mt-1">
                    GTGT <span className="font-mono">{formatVnd(gtgt)}</span> · TNCN{' '}
                    <span className="font-mono">{formatVnd(tncn)}</span> · Tổng thuế{' '}
                    <span className="font-mono font-bold">{formatVnd(payableTax)}</span>
                  </p>
                  <p className={`mt-1 text-xs font-semibold ${hasCalculatedTax ? 'text-emerald-800' : 'text-red-700'}`}>
                    {taxDone
                      ? 'Hệ thống đã tính thuế ước tính theo doanh thu và ngành.'
                      : 'Đang chờ tính thuế để hiển thị kết quả ước tính.'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-on-surface">
                {allNormal ? (
                  <span className="text-emerald-900">Tất cả đối soát đều bình thường.</span>
                ) : (
                  <span className="text-red-800">Có bất thường hoặc thiếu dữ liệu — xem giải thích để xử lý.</span>
                )}
              </p>
            </>
          ) : (
              <p className="text-sm text-outline">Cần đủ dữ liệu bán hàng và chứng cứ để đối soát đầy đủ.</p>
          )}
          <Button
            type="button"
            variant="outline"
            block
            className="mt-4 gap-2 border-primary/30 py-3 text-primary"
            onClick={() => onExplain(explainCode)}
          >
            <Sparkles className="size-4" />
            Xem giải thích
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tax Preview Section */}
      {!!tx && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Revenue & Threshold */}
          <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm relative">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-outline">
                <TrendingUp className="size-4 text-primary" />
                Doanh thu quy đổi
              </div>
              <Badge variant="outline" className="text-[9px] bg-surface-container-low">
                {taxDone ? 'Đã tính' : 'Tạm tính'}
              </Badge>
            </div>
            {!hasCalculatedTax ? (
               <p className="text-sm text-outline mt-4">Chưa có số liệu tính toán. Hãy nhấn Sửa dữ liệu & Tính lại.</p>
            ) : (
              <>
                <div className="mb-3 flex items-end gap-2">
                  <span className="font-display text-2xl font-bold text-on-surface">
                    {formatVnd(annualized)}
                  </span>
                  <span className="mb-1 text-xs text-outline">/ năm</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-outline">Tiến độ ngưỡng 1 tỷ</span>
                    <span className={pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600'}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-outline">
                    {pct >= 100 ? 'Đã vượt ngưỡng, cần kê khai.' : 'Dưới ngưỡng, chưa phát sinh nghĩa vụ thuế bắt buộc.'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Tax Breakdown */}
          <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm relative">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-outline">
                <Calculator className="size-4 text-primary" />
                Thuế ước tính
              </div>
              <Badge variant="outline" className="text-[9px] bg-surface-container-low">
                {taxDone ? 'Đã tính' : 'Tạm tính'}
              </Badge>
            </div>
            {!hasCalculatedTax ? (
               <p className="text-sm text-outline mt-4">Hệ thống đang chờ đối soát để tính thuế chính xác.</p>
            ) : (
              <ul className="mb-3 space-y-2 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Thuế GTGT</span>
                  <span className="font-mono">{formatVnd(gtgt)}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Thuế TNCN</span>
                  <span className="font-mono">{formatVnd(tncn)}</span>
                </li>
                <li className="flex justify-between gap-2 border-b border-dashed border-outline-variant pb-2">
                  <span className="text-outline">Doanh thu trên chứng từ (tham khảo)</span>
                  <span className="font-mono text-amber-700">{formatVnd(revenueDoc)}</span>
                </li>
                <li className="flex justify-between gap-2 pt-1 font-bold">
                  <span className="text-on-surface">Thuế còn phải nộp</span>
                  <span className="font-mono text-primary text-base">{formatVnd(payableTax)}</span>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container/40 px-4 py-3">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-outline">
          Tiến trình (phiên {jobId.slice(0, 8)}…)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Upload', done: true },
            { label: 'OCR + Dữ liệu bán hàng', done: extractDone },
            { label: 'Đối soát & tính thuế', done: taxDone },
          ].map((s, i, arr) => (
            <div key={s.label} className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  s.done ? 'bg-primary text-white' : 'bg-surface-container text-outline'
                }`}
              >
                {s.label}
              </span>
              {i < arr.length - 1 && <span className="text-outline">→</span>}
            </div>
          ))}
        </div>
        {tx?.dashboard && (
          <p className="mt-3 text-xs text-outline">
            Hồ sơ theo kỳ: ngưỡng ~{Math.round(pct)}% · {alertCount} cảnh báo
          </p>
        )}
      </div>
    </div>
  );
}
