import { motion } from 'motion/react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileCheck,
  Download,
  Brain,
  Loader2,
  AlertTriangle,
  Pencil,
  Check,
  Calendar,
  HardDrive,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { jobStatusToSync } from '../../lib/jobStatus';
import { useJobs } from '../../hooks/useJobs';
import { useLatestCompletedTax } from '../../hooks/useLatestCompletedTax';
import ExplainTaxModal from '../../components/tax/ExplainTaxModal';
import CorrectionModal from '../../components/tax/CorrectionModal';
import UploadReviewPanel from '../../components/upload/UploadReviewPanel';
import { EVIDENCE_DOCUMENT_TYPE_OPTIONS, archiveFilterSelectClass } from '../../lib/documentArchiveFilters';
import {
  deleteJob,
  getStores,
  reportDownloadUrl,
  uploadDataFiles,
  waitForExtraction,
  getAuditLogs,
  type UploadSessionKind,
} from '../../api/client';
import type {
  AuthUser,
  StoreSummary,
  AuditLogSummary,
  CorrectionResponse,
  ECommerceEvidenceDocument,
  ExtractionResponse,
  TaxResponse,
} from '../../api/types';
import { pushUserNotification } from '../../utils/notifications';
import { formatVnd } from '../../lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';

const IMG_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif']);
type UploadMode = UploadSessionKind;

const REPORT_YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => 2020 + i);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function partitionFiles(list: FileList | null): { csvs: File[]; invoices: File[] } {
  const csvs: File[] = [];
  const invoices: File[] = [];
  if (!list?.length) return { csvs, invoices };
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const ext = extOf(f.name);
    if (ext === 'csv') csvs.push(f);
    else if (IMG_EXT.has(ext)) invoices.push(f);
  }
  return { csvs, invoices };
}

export function useAuditLogs(userId?: string | null) {
  const [logs, setLogs] = useState<AuditLogSummary[]>([]);
  const fetchLogs = useCallback(async () => {
    try {
      const res = await getAuditLogs(userId);
      setLogs(res.audit_logs);
    } catch (e) {
      // ignore silently for now
    }
  }, [userId]);
  useEffect(() => { void fetchLogs(); }, [fetchLogs]);
  return { logs, refetchLogs: fetchLogs };
}

function appendUniqueFiles(current: File[], next: File[]): File[] {
  const seen = new Set(current.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
  const merged = [...current];
  next.forEach((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(file);
    }
  });
  return merged;
}

function summaryAfterCorrection(r: CorrectionResponse): string {
  const tr = r.tax_result;
  const dash = (r.dashboard ?? {}) as Record<string, unknown>;
  const net = Number(tr?.net_revenue ?? 0);
  const totalTax = Number(tr?.total_tax_due ?? 0);
  const n = r.alerts?.length ?? 0;
  const statusText =
    typeof dash.status_text === 'string' && dash.status_text.trim()
      ? dash.status_text.trim()
      : '';
  const alertsLine =
    n === 0 ? 'Không còn cảnh báo sau lần tính lại.' : `Còn ${n} cảnh báo — nên xem phần giải thích bên dưới.`;
  return [
    'Đã tính lại xong.',
    `Doanh thu thuần ${formatVnd(net)}; thuế ước tính ${formatVnd(totalTax)}.`,
    alertsLine,
    statusText,
  ]
    .filter((s) => s.length > 0)
    .join(' ');
}

type UploadDataProps = {
  currentUser?: AuthUser | null;
  onNavigate?: (id: string, search?: string) => void;
};

export default function UploadData({ currentUser, onNavigate }: UploadDataProps) {
  const [searchParams] = useSearchParams();
  const { jobs, loading: jobsLoading, error: jobsError, refetch } = useJobs(8000, currentUser?.id);
  const { logs, refetchLogs } = useAuditLogs(currentUser?.id);
  const { jobId, tax, refetchTax } = useLatestCompletedTax(jobs);
  const csvRef = useRef<HTMLInputElement>(null);
  const invoiceRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainCode, setExplainCode] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [stagedCsvs, setStagedCsvs] = useState<File[]>([]);
  const [stagedInvoices, setStagedInvoices] = useState<File[]>([]);
  const [reviewFocusJobId, setReviewFocusJobId] = useState<string | null>(null);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [panelExtraction, setPanelExtraction] = useState<ExtractionResponse | null>(null);
  const [panelTax, setPanelTax] = useState<TaxResponse | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [uploadZoneCollapsed, setUploadZoneCollapsed] = useState(false);
  const lastAutoCollapsedJobIdRef = useRef<string | null>(null);
  const notifiedAlertsJobRef = useRef<string | null>(null);
  const lastErrorNotificationRef = useRef<string | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>('bundle');
  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
  const [evidenceCategory, setEvidenceCategory] = useState('chứng cứ giao dịch');

  const alertsCount = tax?.alerts?.length ?? 0;
  const panelJobId = reviewFocusJobId ?? jobId;
  const actionJobId = panelJobId;

  const pushNotification = (title: string, detail: string, type: 'upload' | 'processing' | 'alert') => {
    pushUserNotification({ title, detail, type });
  };

  useEffect(() => {
    if (!error || lastErrorNotificationRef.current === error) return;
    lastErrorNotificationRef.current = error;
    pushUserNotification({
      title: 'Upload gặp lỗi',
      detail: error,
      type: 'system',
    });
  }, [error]);

  useEffect(() => {
    const jid = searchParams.get('job_id');
    if (!jid) return;
    setReviewFocusJobId(jid);
    setUploadZoneCollapsed(true);
  }, [searchParams]);

  useEffect(() => {
    // Tự động thu gọn khu vực kéo thả khi hệ thống đã trả kết quả cho phiên đang xem.
    // Chỉ làm khi:
    // - không bận xử lý
    // - không còn file đang chọn
    // - và chưa auto-collapse cho jobId này (tránh "giật" khi poll cập nhật)
    if (!panelJobId) return;
    if (busy) return;
    if (stagedCsvs.length > 0 || stagedInvoices.length > 0) return;
    if (uploadZoneCollapsed) return;
    if (lastAutoCollapsedJobIdRef.current === panelJobId) return;

    const extractionDone = !!panelExtraction && panelExtraction.status !== 'processing';
    const taxDone = !!panelTax && panelTax.status === 'done';
    if (extractionDone && taxDone) {
      setUploadZoneCollapsed(true);
      lastAutoCollapsedJobIdRef.current = panelJobId;
    }
  }, [
    panelJobId,
    busy,
    stagedCsvs.length,
    stagedInvoices.length,
    uploadZoneCollapsed,
    panelExtraction,
    panelTax,
  ]);

  useEffect(() => {
    if (!panelJobId || notifiedAlertsJobRef.current === panelJobId) return;
    const alerts = panelTax?.alerts ?? [];
    if (alerts.length === 0) return;
    const notifiedKey = `scaify.upload.alert-notified.${currentUser?.id ?? 'anonymous'}.${panelJobId}`;
    try {
      if (window.localStorage.getItem(notifiedKey) === '1') {
        notifiedAlertsJobRef.current = panelJobId;
        return;
      }
      window.localStorage.setItem(notifiedKey, '1');
    } catch {
      // If localStorage is unavailable, fall back to the in-memory guard.
    }
    notifiedAlertsJobRef.current = panelJobId;
    pushNotification(
      'Có cảnh báo sau xử lý file',
      `${alerts.length} cảnh báo cần xem lại trong phiên ${panelJobId.slice(0, 8)}…`,
      'alert'
    );
  }, [currentUser?.id, panelJobId, panelTax?.alerts]);

  const openExplain = (code: string | null) => {
    setExplainCode(code);
    setExplainOpen(true);
  };

  const pickCsv = useCallback(() => csvRef.current?.click(), []);
  const pickInvoice = useCallback(() => invoiceRef.current?.click(), []);

  useEffect(() => {
    let alive = true;
    setStoresLoading(true);
    void getStores(currentUser?.id)
      .then((data) => {
        if (!alive) return;
        setStores(data.stores);
        setSelectedStoreId((current) => current || data.stores[0]?.id || '');
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setStoresLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const sid = searchParams.get('store_id');
    if (!sid || stores.length === 0) return;
    if (!stores.some((s) => s.id === sid)) return;
    setSelectedStoreId(sid);
    try {
      window.localStorage.setItem('scaify_active_store_id', sid);
    } catch {
      /* ignore */
    }
  }, [searchParams, stores]);

  useEffect(() => {
    if (stagedCsvs.length > 0 || stagedInvoices.length > 0) {
      setUploadZoneCollapsed(false);
    }
  }, [stagedCsvs.length, stagedInvoices.length]);

  useEffect(() => {
    setStagedCsvs([]);
    setStagedInvoices([]);
    setMessage(null);
  }, [uploadMode]);

  const uploadMeta = useMemo(
    () => ({
      periodMonth,
      periodYear,
      uploadKind: uploadMode,
      evidenceCategory:
        uploadMode === 'sales_csv' ? undefined : evidenceCategory.trim() || undefined,
    }),
    [periodMonth, periodYear, uploadMode, evidenceCategory]
  );

  const buildUploadBatches = (): { csv: File | null; invoice: File | null }[] => {
    if (uploadMode === 'sales_csv') {
      return stagedCsvs.map((csv) => ({ csv, invoice: null as File | null }));
    }
    if (uploadMode === 'evidence') {
      return stagedInvoices.map((invoice) => ({ csv: null as File | null, invoice }));
    }
    if (stagedCsvs.length === 1 && stagedInvoices.length === 1) {
      return [{ csv: stagedCsvs[0], invoice: stagedInvoices[0] }];
    }
    return [
      ...stagedCsvs.map((csv) => ({ csv, invoice: null as File | null })),
      ...stagedInvoices.map((invoice) => ({ csv: null as File | null, invoice })),
    ];
  };

  const runPipelines = async () => {
    const batches = buildUploadBatches();
    if (batches.length === 0) {
      setError('Chọn ít nhất một file dữ liệu bán hàng hoặc chứng cứ (ảnh/PDF).');
      return;
    }
    if (!currentUser?.id) {
      setError('Cần đăng nhập trước khi upload.');
      return;
    }
    if (!selectedStoreId) {
      setError('Chọn cửa hàng trước khi upload.');
      return;
    }
    if (uploadMode !== 'sales_csv' && !evidenceCategory.trim()) {
      setError('Chọn loại chứng từ cho file chứng cứ.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(`Đang tải ${batches.length} phiên lên máy chủ...`);
    try {
      const uploads = await Promise.all(
        batches.map((batch) =>
          uploadDataFiles(batch.csv, batch.invoice, {
            userId: currentUser.id,
            storeId: selectedStoreId,
            periodMonth: uploadMeta.periodMonth,
            periodYear: uploadMeta.periodYear,
            uploadKind: uploadMeta.uploadKind,
            evidenceCategory: uploadMeta.evidenceCategory ?? null,
          })
        )
      );
      setReviewFocusJobId(uploads[0]?.job_id ?? null);
      pushNotification('Upload thành công', `Đã nhận ${uploads.length} phiên và bắt đầu xử lý.`, 'upload');
      setMessage(`Đã nhận ${uploads.length} phiên. Đang chờ trích xuất & đối soát...`);
      const results = await Promise.allSettled(uploads.map((up) => waitForExtraction(up.job_id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      setMessage(
        failed > 0
          ? `Hoàn tất ${uploads.length - failed}/${uploads.length} phiên; ${failed} phiên cần kiểm tra lại.`
          : `Hoàn tất ${uploads.length} phiên: dữ liệu bán hàng → trích xuất → đối soát.`
      );
      pushNotification(
        failed > 0 ? 'Xử lý file cần kiểm tra' : 'Xử lý file thành công',
        failed > 0
          ? `${failed}/${uploads.length} phiên cần kiểm tra lại.`
          : `Hoàn tất ${uploads.length} phiên trích xuất và đối soát.`,
        'processing'
      );
      setStagedCsvs([]);
      setStagedInvoices([]);
      await refetch();
      void refetchLogs();
      if (failed === 0 && uploads.length > 0) {
        setUploadZoneCollapsed(true);
        setMessage(
          'Đã xử lý xong. Dữ liệu đã được ghi vào kho hồ sơ theo kỳ và loại bạn chọn. Xem đối soát bên dưới hoặc mở « Hồ sơ / Chứng từ ».'
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tải lên thất bại');
      setMessage(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDemoUpload = async () => {
    if (!selectedStoreId) {
      setError('Vui lòng chọn hoặc thêm cửa hàng trước.');
      return;
    }
    const dummyCsv = new File(['mock_revenue,fee\n150000000,1000000'], 'demo_doanhthu.csv', { type: 'text/csv' });
    const dummyImg = new File(['mock_image_data'], 'demo_giaodich.jpg', { type: 'image/jpeg' });
    
    setBusy(true);
    try {
        const upload = await uploadDataFiles(dummyCsv, dummyImg, {
          userId: currentUser!.id,
          storeId: selectedStoreId,
          periodMonth,
          periodYear,
          uploadKind: 'bundle',
          evidenceCategory: evidenceCategory.trim() || undefined,
        });
        setReviewFocusJobId(upload.job_id);
        await waitForExtraction(upload.job_id);
        setUploadZoneCollapsed(true);
        await refetch();
        void refetchLogs();
    } catch(e) {
        setError('Demo failed');
    } finally {
        setBusy(false);
    }
  };

  const onSubmitStaged = () => void runPipelines();

  const onCsvChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (uploadMode === 'evidence') {
      setError('Chế độ hiện tại chỉ nhận chứng cứ (ảnh/PDF). Đổi sang « CSV doanh thu » hoặc « Gói đối soát » để tải CSV.');
      e.target.value = '';
      return;
    }
    const { csvs } = partitionFiles(e.target.files);
    if (csvs.length) setStagedCsvs((current) => appendUniqueFiles(current, csvs));
    e.target.value = '';
  };

  const onInvoiceChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (uploadMode === 'sales_csv') {
      setError('Chế độ hiện tại chỉ nhận CSV doanh thu. Đổi sang « Chứng cứ » hoặc « Gói đối soát » để tải ảnh/PDF.');
      e.target.value = '';
      return;
    }
    const { invoices } = partitionFiles(e.target.files);
    if (invoices.length) setStagedInvoices((current) => appendUniqueFiles(current, invoices));
    e.target.value = '';
  };

  const removeStagedCsv = (file: File) => {
    setStagedCsvs((current) =>
      current.filter((item) => item !== file)
    );
  };

  const removeStagedInvoice = (file: File) => {
    setStagedInvoices((current) =>
      current.filter((item) => item !== file)
    );
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    let { csvs, invoices } = partitionFiles(e.dataTransfer.files);
    if (uploadMode === 'sales_csv') {
      if (invoices.length) {
        setError('Đã bỏ qua file không phải CSV — chế độ này chỉ nhận dữ liệu bán hàng (.csv).');
      }
      invoices = [];
    } else if (uploadMode === 'evidence') {
      if (csvs.length) {
        setError('Đã bỏ qua file CSV — chế độ này chỉ nhận chứng cứ (ảnh/PDF).');
      }
      csvs = [];
    }
    const n = csvs.length + invoices.length;
    if (n > 0) {
      setError(null);
      setStagedCsvs((current) => appendUniqueFiles(current, csvs));
      setStagedInvoices((current) => appendUniqueFiles(current, invoices));
      setMessage(`Đã nhận ${n} file từ kéo thả. Kiểm tra danh sách bên dưới rồi bấm Xử lý.`);
    }
  };

  const recentJobs = jobs.slice(0, 10);
  const selectionValid = useMemo(() => {
    if (!selectedStoreId) return false;
    if (uploadMode === 'sales_csv') return stagedCsvs.length > 0;
    if (uploadMode === 'evidence') return stagedInvoices.length > 0 && !!evidenceCategory.trim();
    return (stagedCsvs.length > 0 || stagedInvoices.length > 0);
  }, [
    selectedStoreId,
    uploadMode,
    stagedCsvs.length,
    stagedInvoices.length,
    evidenceCategory,
  ]);

  const dropZoneHint =
    uploadMode === 'sales_csv'
      ? 'Chỉ nhận file CSV doanh thu (.csv), gắn với kỳ và cửa hàng đã chọn phía trên.'
      : uploadMode === 'evidence'
        ? 'Chỉ nhận ảnh hoặc PDF chứng cứ. Loại chứng từ đã chọn được lưu kèm vào kho hồ sơ.'
        : 'Nhận CSV, ảnh/PDF hoặc cả hai — nhiều file sẽ tạo nhiều phiên; loại chứng từ áp dụng cho từng file chứng cứ.';

  const summaryParts: string[] = [];
  if (stagedCsvs.length) summaryParts.push(`${stagedCsvs.length} CSV`);
  if (stagedInvoices.length) summaryParts.push(`${stagedInvoices.length} chứng từ`);

  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  function pickSummarySum(summary: Record<string, unknown> | undefined, key: string): unknown {
    const block = summary?.[key];
    if (block && typeof block === 'object' && !Array.isArray(block) && 'sum' in block) {
      return (block as { sum?: unknown }).sum;
    }
    return undefined;
  }

  const panelCsv = panelExtraction?.csv_result as Record<string, unknown> | undefined;
  const panelOcr = panelExtraction?.ocr_result as (Record<string, unknown> & Partial<ECommerceEvidenceDocument>) | undefined;

  const panelCsvData = panelCsv?.data as Record<string, unknown> | undefined;
  const panelCsvSummary = panelCsvData?.summary as Record<string, unknown> | undefined;

  const panelIndustryRaw =
    typeof panelCsv?.industry === 'string' && panelCsv.industry !== 'N/A' ? panelCsv.industry : '—';
  const panelIndustry =
    panelIndustryRaw === 'goods'
      ? 'Phân phối, hàng hóa'
      : panelIndustryRaw === 'services'
        ? 'Dịch vụ, xây dựng'
        : panelIndustryRaw === 'manufacturing'
          ? 'Sản xuất, vận tải'
          : panelIndustryRaw === 'other'
            ? 'Kinh doanh khác'
            : panelIndustryRaw;

  /** API có thể trả csv_result đã làm gọn (không có data.summary) hoặc đầy đủ từ pipeline — map cả revenue / revenue_raw */
  const panelRevenueCsv = num(
    pickSummarySum(panelCsvSummary, 'revenue_raw') ??
      pickSummarySum(panelCsvSummary, 'revenue') ??
      panelCsv?.revenue_raw ??
      panelCsv?.revenue
  );
  const panelOcrNested = panelOcr?.data as Record<string, unknown> | undefined;
  const panelRevenueDoc = num(
    panelOcr?.revenue_reported ??
      panelOcrNested?.revenue_reported ??
      panelOcrNested?.revenue ??
      panelOcrNested?.subtotal
  );

  const panelIssueDate =
    typeof panelOcr?.issue_date === 'string'
      ? panelOcr.issue_date
      : typeof panelOcrNested?.issue_date === 'string'
        ? (panelOcrNested.issue_date as string)
        : '—';
  const panelMst =
    typeof panelOcr?.issuer_tax_code === 'string' && panelOcr.issuer_tax_code !== 'N/A'
      ? panelOcr.issuer_tax_code
      : typeof panelOcr?.seller_tax_code === 'string'
        ? panelOcr.seller_tax_code
        : typeof panelOcrNested?.seller_tax_code === 'string'
          ? (panelOcrNested.seller_tax_code as string)
          : '—';
  const panelWarnings =
    Array.isArray((panelOcr as { warnings?: unknown } | undefined)?.warnings)
      ? ((panelOcr as { warnings: string[] }).warnings ?? [])
      : [];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      <div className="mb-6 sm:mb-8" data-product-tour="upload-header">
        <h2 className="mb-2 font-display text-2xl font-bold sm:text-3xl">
          Bộ dữ liệu kỳ
        </h2>
        <p className="text-sm leading-relaxed text-outline sm:text-base">
          Trước khi kéo thả file, hãy chọn <strong className="text-on-surface">cửa hàng</strong>,{' '}
          <strong className="text-on-surface">kỳ báo cáo</strong> và{' '}
          <strong className="text-on-surface">loại phiên tải</strong>. Sau đó trích xuất, đối soát và lưu tự động sau khi xử lý xong.
        </p>
      </div>

      <input
        ref={csvRef}
        type="file"
        className="hidden"
        accept=".csv"
        multiple
        onChange={onCsvChange}
      />
      <input
        ref={invoiceRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif"
        multiple
        onChange={onInvoiceChange}
      />

      {(error || jobsError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Lỗi:</strong> {error || jobsError}
        </div>
      )}

      {message && !error && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {busy && <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />}
          <span>{message}</span>
        </div>
      )}

      <div className="rounded-2xl border border-outline-variant bg-white p-5 shadow-sm sm:p-6" data-product-tour="upload-classification">
        <h3 className="font-display text-base font-bold text-on-surface">Phân loại chứng từ</h3>
        <p className="mt-1 text-sm text-outline">
          
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">
              Cửa hàng
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              disabled={busy || storesLoading || stores.length === 0}
              className="min-h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-sm font-medium text-on-surface outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 disabled:bg-surface disabled:text-outline"
            >
              <option value="">
                {storesLoading ? 'Đang tải cửa hàng...' : 'Chọn cửa hàng'}
              </option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.store_name ?? store.store_code ?? store.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">
              Tháng (kỳ)
            </label>
            <select
              className={archiveFilterSelectClass + ' min-h-12 text-sm'}
              value={periodMonth}
              onChange={(e) => setPeriodMonth(Number(e.target.value))}
              disabled={busy}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">Năm</label>
            <select
              className={archiveFilterSelectClass + ' min-h-12 text-sm'}
              value={periodYear}
              onChange={(e) => setPeriodYear(Number(e.target.value))}
              disabled={busy}
            >
              {REPORT_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-outline">Loại phiên upload</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {(
              [
                ['sales_csv', 'Chỉ CSV doanh thu', 'Một hoặc nhiều file .csv'],
                ['evidence', 'Chỉ chứng cứ', 'Ảnh/PDF — chọn loại chứng từ bên dưới'],
                ['bundle', 'Gói đối soát', 'CSV và/hoặc chứng cứ (nhiều phiên nếu nhiều file)'],
              ] as const
            ).map(([id, title, sub]) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => setUploadMode(id as UploadMode)}
                className={`flex-1 rounded-xl border px-4 py-3 text-left transition-all sm:min-w-[200px] ${
                  uploadMode === id
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-outline-variant bg-white hover:border-primary/40'
                }`}
              >
                <p className="font-display text-sm font-bold text-on-surface">{title}</p>
                <p className="mt-0.5 text-xs text-outline">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {uploadMode !== 'sales_csv' && (
          <div className="mt-4 space-y-1.5">
            <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">
              Loại chứng từ (áp dụng cho file chứng cứ)
            </label>
            <select
              className={archiveFilterSelectClass + ' min-h-12 text-sm'}
              value={evidenceCategory}
              onChange={(e) => setEvidenceCategory(e.target.value)}
              disabled={busy}
            >
              {EVIDENCE_DOCUMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-outline">
              
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {uploadZoneCollapsed && stagedCsvs.length === 0 && stagedInvoices.length === 0 ? (
            <button
              type="button"
              onClick={() => setUploadZoneCollapsed(false)}
              className="flex w-full items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-white p-4 text-left shadow-sm transition-colors hover:border-primary/40 sm:p-5"
              aria-expanded={false}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <UploadCloud className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-on-surface sm:text-base">
                    Thêm dữ liệu
                  </p>
                  <p className="mt-0.5 text-xs text-outline sm:text-sm">
                    Bấm để mở rộng — kéo thả hoặc chọn dữ liệu bán hàng và chứng cứ.
                  </p>
                </div>
              </div>
              <ChevronDown className="size-5 shrink-0 text-outline" aria-hidden />
            </button>
          ) : (
            <>
              <div
                data-product-tour="upload-dropzone"
                role="button"
                tabIndex={0}
                onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && pickCsv()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-5 text-center transition-all sm:p-7 ${
                  busy ? 'pointer-events-none opacity-70' : ''
                }`}
              >
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white shadow-lg sm:size-16">
                  {busy ? (
                    <Loader2 className="size-7 animate-spin text-primary" />
                  ) : (
                    <UploadCloud size={30} className="fill-primary/10 text-primary" />
                  )}
                </div>
                <h3 className="mb-1.5 font-display text-lg font-bold text-on-surface sm:text-xl">
                  Thêm dữ liệu
                </h3>
                <p className="mx-auto mb-4 max-w-md text-xs leading-relaxed text-outline sm:text-sm">{dropZoneHint}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {uploadMode !== 'evidence' && (
                    <Button type="button" variant="outline" disabled={busy} onClick={pickCsv}>
                      <FileText className="size-4" />
                      Chọn CSV doanh thu
                    </Button>
                  )}
                  {uploadMode !== 'sales_csv' && (
                    <Button type="button" variant="outline" disabled={busy} onClick={pickInvoice}>
                      <ImageIcon className="size-4" />
                      Chọn chứng cứ (PDF/ảnh)
                    </Button>
                  )}
                  {uploadMode !== 'evidence' && (
                    <a
                      href="/sample-revenue.csv"
                      download
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary"
                    >
                      <Download size={16} />
                      Tải file mẫu CSV
                    </a>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {(uploadMode === 'sales_csv'
                    ? [{ label: 'CSV doanh thu', icon: FileText }]
                    : uploadMode === 'evidence'
                      ? [
                          { label: 'Ảnh chứng cứ', icon: ImageIcon },
                          { label: 'PDF chứng cứ', icon: FileCheck },
                        ]
                      : [
                          { label: 'CSV', icon: FileText },
                          { label: 'Ảnh/PDF', icon: ImageIcon },
                        ]
                  ).map((tag) => (
                    <div
                      key={tag.label}
                      className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-primary shadow-sm"
                    >
                      <tag.icon size={14} />
                      {tag.label}
                    </div>
                  ))}
                </div>
              </div>

              {(stagedCsvs.length > 0 || stagedInvoices.length > 0) && (
                <div className="rounded-3xl border border-outline-variant bg-white p-5 shadow-sm sm:p-6" data-product-tour="upload-selected-files">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-on-surface">File đã chọn</h3>
                      <p className="text-sm text-outline">{summaryParts.join(' · ') || '—'}</p>
                    </div>
                    <StatusBadge
                      status={selectionValid ? 'synced' : 'error'}
                      label={
                        selectionValid
                          ? 'Sẵn sàng xử lý'
                          : !selectedStoreId
                            ? 'Chọn cửa hàng'
                            : uploadMode === 'evidence'
                              ? 'Cần chứng cứ + loại'
                              : 'Thiếu file hoặc loại'
                      }
                    />
                  </div>
                  <ul className="mb-4 space-y-2 text-sm">
                    {stagedCsvs.map((file) => (
                      <li key={`${file.name}:${file.size}:${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container px-3 py-2">
                        <span className="truncate font-medium">{file.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            CSV
                          </span>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors hover:bg-red-50"
                            onClick={() => removeStagedCsv(file)}
                            disabled={busy}
                            aria-label={`Xóa ${file.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                    {stagedInvoices.map((file) => (
                      <li key={`${file.name}:${file.size}:${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container px-3 py-2">
                        <span className="truncate font-medium">{file.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
                            IMG
                          </span>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors hover:bg-red-50"
                            onClick={() => removeStagedInvoice(file)}
                            disabled={busy}
                            aria-label={`Xóa ${file.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="primary"
                    block
                    className="gap-2"
                    disabled={busy || !selectionValid}
                    onClick={onSubmitStaged}
                  >
                    <Brain size={20} />
                    Xử lý
                  </Button>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-outline transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={busy || stagedCsvs.length > 0 || stagedInvoices.length > 0}
                  title={
                    stagedCsvs.length > 0 || stagedInvoices.length > 0
                      ? 'Xóa file đang chọn hoặc xử lý xong để thu gọn'
                      : undefined
                  }
                  onClick={() => setUploadZoneCollapsed(true)}
                >
                  <ChevronUp className="size-4" />
                  Thu gọn khu vực tải
                </button>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5" data-product-tour="upload-sales-summary">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-outline">Dữ liệu bán hàng</p>
            <p className="mt-1 text-xs text-outline">
              CSV hoặc Excel tự ghi chép — gồm doanh thu, ngày giao dịch, nguồn.
            </p>
            {panelJobId && panelCsv ? (
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Ngành hàng</span>
                  <span className="font-mono">{panelIndustry}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Doanh thu (CSV)</span>
                  <span className="font-mono font-semibold text-on-surface">{formatVnd(panelRevenueCsv)}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Kỳ</span>
                  <span className="font-mono text-xs">{typeof panelCsv?.period === 'string' ? panelCsv.period : 'N/A'}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Nguồn</span>
                  <span className="font-mono text-xs">
                    {typeof panelCsv?.platform_name === 'string'
                      ? panelCsv.platform_name
                      : typeof panelCsv?.platform === 'string'
                        ? panelCsv.platform
                        : 'N/A'}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="mt-3 text-sm text-outline">
                {panelJobId ? 'Đang chờ trích xuất dữ liệu bán hàng…' : 'Hoàn tất một phiên xử lý để xem số liệu.'}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5" data-product-tour="upload-evidence-summary">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-outline">Chứng từ giao dịch</p>
            <p className="mt-1 text-xs text-outline">
              Hóa đơn bán hàng, phiếu thu, ảnh chụp giao dịch — dùng để xác nhận doanh thu.
            </p>
            {panelJobId && panelOcr ? (
              <ul className="mt-3 space-y-2 text-sm">
                {panelWarnings.length > 0 && (
                  <li className="mb-2 rounded-lg border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-xs text-amber-950">
                    <span className="font-bold">OCR/VLM: </span>
                    {panelWarnings.slice(0, 2).join(' · ')}
                  </li>
                )}
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Doanh thu trên chứng từ</span>
                  <span className="font-mono font-semibold text-on-surface">{formatVnd(panelRevenueDoc)}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Ngày giao dịch</span>
                  <span className="font-mono text-xs">{panelIssueDate}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Đối tác / khách hàng</span>
                  <span className="font-mono text-xs">
                    {typeof panelOcr?.counterparty === 'string'
                      ? panelOcr.counterparty
                      : typeof panelOcrNested?.counterparty === 'string'
                        ? (panelOcrNested.counterparty as string)
                        : 'N/A'}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Mã đơn hàng</span>
                  <span className="font-mono text-xs">
                    {typeof panelOcr?.order_id === 'string'
                      ? panelOcr.order_id
                      : typeof panelOcrNested?.order_id === 'string'
                        ? (panelOcrNested.order_id as string)
                        : 'N/A'}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">Đơn vị phát hành</span>
                  <span className="max-w-[160px] truncate font-mono text-xs">
                    {typeof panelOcr?.seller_name === 'string'
                      ? panelOcr.seller_name
                      : typeof panelOcrNested?.seller_name === 'string'
                        ? (panelOcrNested.seller_name as string)
                        : 'N/A'}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-outline">MST đơn vị trên chứng từ</span>
                  <span className="max-w-[160px] truncate font-mono text-xs">{panelMst}</span>
                </li>
              </ul>
            ) : (
              <p className="mt-3 text-sm text-outline">
                {panelJobId ? 'Đang chờ OCR/VLM…' : 'Hoàn tất một phiên xử lý để xem kết quả chứng từ.'}
              </p>
            )}
          </div>

          {panelJobId && (
            <div data-product-tour="upload-review-panel">
            <UploadReviewPanel
              jobId={panelJobId}
              busy={busy}
              onExplain={(code) => openExplain(code ?? null)}
              refreshKey={reviewRefreshKey}
              hideSourceCards
              onData={({ extraction, tax }) => {
                setPanelExtraction(extraction);
                setPanelTax(tax);
              }}
            />
            </div>
          )}
          <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5" data-product-tour="upload-history-link">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-outline">
              Lịch sử phiên
            </p>
            <p className="mt-1 text-xs text-outline">
              Danh sách tất cả phiên xử lý nằm ở Lịch sử phiên.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onNavigate?.('history')}
                disabled={!onNavigate}
              >
                Mở Lịch sử phiên
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-4">
          <div className="space-y-2.5 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5" data-product-tour="upload-file-requirements">
            <h4 className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-outline">
              Yêu cầu file
            </h4>
            <ul className="space-y-2.5 text-xs leading-relaxed text-on-surface sm:text-sm">
              <li className="flex gap-2.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <span>
                  <strong>CSV/Excel doanh thu</strong> — tự ghi chép hoặc xuất từ kênh bán (ngày, doanh thu, nguồn).
                </span>
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <span>
                  <strong>Hóa đơn / ảnh chụp giao dịch</strong> — hệ thống OCR để xác nhận dữ liệu.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <span>
                  <strong>Chứng từ giảm trừ</strong> (hoàn trả, chiết khấu, khuyến mại) — nếu có.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Calendar className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>Ngày / kỳ khớp báo cáo.</span>
              </li>
              <li className="flex gap-2.5">
                <HardDrive className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>Dung lượng hợp lệ (theo giới hạn máy chủ).</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <ExplainTaxModal
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        jobId={actionJobId}
        highlightCode={explainCode}
        onSuaDuLieu={() => setCorrectionOpen(true)}
      />
      <CorrectionModal
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        jobId={actionJobId}
        onSuccess={(result) => {
          void refetchTax();
          setReviewRefreshKey((k) => k + 1);
          setError(null);
          setMessage(summaryAfterCorrection(result));
        }}
      />
    </motion.div>
  );
}
