import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Brain, Eye, Filter, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { auditLogFileUrl, getAuditLogs, getStores } from '../../api/client';
import type { AuditLogSummary, AuthUser, StoreSummary } from '../../api/types';
import { useJobs } from '../../hooks/useJobs';
import { formatVnd } from '../../lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';

type HistoryProps = {
  currentUser?: AuthUser | null;
  onNavigate?: (id: string, search?: string) => void;
};

const PAGE_SIZE = 10;

function sessionTypeLabel(action?: string | null): string | null {
  const a = String(action ?? '').toLowerCase();
  if (!a) return null;
  if (a.includes('upload')) return 'upload';
  if (a.includes('extract') || a.includes('ocr')) return 'extract';
  if (a.includes('tax')) return 'review';
  if (a.includes('correction') || a.includes('edit') || a.includes('recalc')) return 'correction';
  if (a.includes('report')) return 'report';
  return null;
}

function auditStatus(action?: string | null) {
  if (action === 'upload_processed') return 'synced';
  if (action?.toLowerCase().includes('error')) return 'error';
  return 'processing';
}

function jobStatusToBadge(status?: string | null) {
  if (status === 'done') return 'synced';
  if (status === 'error') return 'error';
  return 'processing';
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function timeLabel(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? '—' : d.toLocaleString('vi-VN');
}

function fileKindForLog(doc: AuditLogSummary): 'csv' | 'invoice' | null {
  const value = doc.new_value ?? {};
  if (stringValue(value.invoice_url)) return 'invoice';
  if (stringValue(value.csv_url)) return 'csv';
  return null;
}

function fileLabelForLog(doc: AuditLogSummary): string {
  const value = doc.new_value ?? {};
  const invoiceUrl = stringValue(value.invoice_url);
  if (invoiceUrl) return invoiceUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Ảnh';
  if (stringValue(value.csv_url)) return 'CSV';
  return '-';
}

function fileNameForLog(doc: AuditLogSummary): string {
  const v = recordValue(doc.new_value);
  const filename = stringValue(v.filename);
  if (filename) return filename;
  const invoiceUrl = stringValue(v.invoice_url);
  if (invoiceUrl) return decodeURIComponent(invoiceUrl.split('/').pop() ?? invoiceUrl);
  const csvUrl = stringValue(v.csv_url);
  if (csvUrl) return decodeURIComponent(csvUrl.split('/').pop() ?? csvUrl);
  return doc.action ?? '—';
}

function shopLabelForLog(doc: AuditLogSummary): string {
  const v = recordValue(doc.new_value);
  return stringValue(v.store_name) ?? stringValue(v.store_id) ?? '-';
}

function storeIdForLog(doc: AuditLogSummary): string | null {
  const v = recordValue(doc.new_value);
  return stringValue(v.store_id);
}

function isObjectIdLike(value?: string | null): boolean {
  return /^[a-f0-9]{24}$/i.test(String(value ?? '').trim());
}

/** Chỉ UUID/ job pipeline trong new_value — không dùng id của audit log (Mongo _id). */
function jobIdForLog(doc: AuditLogSummary): string | null {
  const value = doc.new_value ?? {};
  return stringValue(value.job_id);
}

function numValue(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractAlertsCount(obj: Record<string, unknown>): number | null {
  const dash = recordValue(obj.dashboard);
  const v = numValue(dash.alerts_count ?? obj.alerts_count);
  return v == null ? null : Math.max(0, v);
}

function extractDifferenceAmount(obj: Record<string, unknown>): number | null {
  const dash = recordValue(obj.dashboard);
  return numValue(dash.difference_amount ?? obj.difference_amount);
}

function extractPayableTax(obj: Record<string, unknown>): number | null {
  const taxResult = recordValue(obj.tax_result);
  const direct = numValue(taxResult.payable_tax ?? obj.payable_tax);
  if (direct != null) return direct;
  const gtgt = numValue(taxResult.gtgt_due);
  const tncn = numValue(taxResult.tncn_due);
  if (gtgt == null && tncn == null) return null;
  return (gtgt ?? 0) + (tncn ?? 0);
}

function extractMismatchFlag(obj: Record<string, unknown>): boolean | null {
  const diff = extractDifferenceAmount(obj);
  if (diff != null) return diff > 0;
  const alerts = obj.alerts;
  if (Array.isArray(alerts)) {
    const mism = alerts.filter((a) => {
      const rec = recordValue(a);
      const code = String(rec.code ?? '').toUpperCase();
      return code.includes('MISMATCH');
    });
    return mism.length > 0;
  }
  return null;
}

function uploadKindLabel(raw: unknown): string | null {
  if (raw === 'sales_csv') return 'CSV doanh thu';
  if (raw === 'evidence') return 'Chứng cứ';
  if (raw === 'bundle') return 'Gói đối soát';
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function uploadContextFromLogs(logs: AuditLogSummary[]): {
  periodLabel: string | null;
  sessionKindLabel: string | null;
} {
  const sorted = logs
    .slice()
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  for (const l of sorted) {
    const nv = recordValue(l.new_value);
    const uctx = recordValue(nv.upload_context);
    if (Object.keys(uctx).length === 0) continue;

    const pm = uctx.period_month;
    const py = uctx.period_year;
    let periodLabel: string | null = null;
    if (typeof pm === 'number' && typeof py === 'number' && pm >= 1 && pm <= 12) {
      periodLabel = `${String(pm).padStart(2, '0')}/${py}`;
    } else if (typeof py === 'number') {
      periodLabel = String(py);
    }

    const sessionKindLabel = uploadKindLabel(uctx.upload_kind);

    if (periodLabel || sessionKindLabel) {
      return { periodLabel, sessionKindLabel };
    }
  }
  return { periodLabel: null, sessionKindLabel: null };
}

type SessionRow = {
  jobId: string;
  storeId: string | null;
  storeLabel: string;
  status: 'processing' | 'synced' | 'error';
  updatedAt: string | null;
  alertsCount: number | null;
  mismatch: boolean | null;
  payableTax: number | null;
  sourceLogForFile: AuditLogSummary | null;
  periodLabel: string | null;
  sessionKindLabel: string | null;
};

export default function History({ currentUser, onNavigate }: HistoryProps) {
  const [searchParams] = useSearchParams();
  const filterStoreId = searchParams.get('store_id') ?? '';
  const filterPending = searchParams.get('filter') === 'pending';

  const [logs, setLogs] = useState<AuditLogSummary[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { jobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } = useJobs(12000, currentUser?.id);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, storesData] = await Promise.all([
        getAuditLogs(currentUser?.id),
        getStores(currentUser?.id),
      ]);
      setLogs(data.audit_logs);
      setStores(storesData.stores);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu từ database.');
    } finally {
      setLoading(false);
    }
  };

  const viewFile = (doc: AuditLogSummary) => {
    const kind = fileKindForLog(doc);
    if (!kind) {
      setError('Phiên này chưa có file dữ liệu / chứng cứ để xem.');
      return;
    }
    window.open(auditLogFileUrl(doc.id, kind, currentUser?.id), '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    void refetch();
  }, [currentUser?.id]);

  useEffect(() => {
    setPage(0);
  }, [filterStoreId, filterPending, currentUser?.id]);

  const storeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const store of stores) {
      const platformName = store.platform?.name;
      const label = [store.store_name || store.store_code || platformName, platformName]
        .filter(Boolean)
        .join(' · ');
      map.set(store.id, label || store.id);
    }
    return map;
  }, [stores]);

  const sessionRows: SessionRow[] = useMemo(() => {
    const logsByJob = new Map<string, AuditLogSummary[]>();
    for (const l of logs) {
      if (!sessionTypeLabel(l.action)) continue;
      const jid = jobIdForLog(l);
      if (!jid) continue;
      const arr = logsByJob.get(jid) ?? [];
      arr.push(l);
      logsByJob.set(jid, arr);
    }

    const jobMap = new Map(jobs.map((j) => [j.job_id, j]));

    const allJobIds = new Set<string>();
    for (const jid of logsByJob.keys()) allJobIds.add(jid);
    for (const j of jobs) allJobIds.add(j.job_id);

    const rows: SessionRow[] = [];
    for (const jid of allJobIds) {
      const relatedLogs = logsByJob.get(jid) ?? [];
      const latestLog =
        relatedLogs
          .slice()
          .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0] ?? null;

      const job = jobMap.get(jid);
      const storeId = (job?.store_id ?? null) || (latestLog ? storeIdForLog(latestLog) : null);
      const mappedStoreLabel = storeId ? storeLabelById.get(storeId) : null;
      const logStoreLabel = latestLog ? shopLabelForLog(latestLog) : null;
      const storeLabel =
        job?.store_name ??
        mappedStoreLabel ??
        (logStoreLabel && !isObjectIdLike(logStoreLabel) ? logStoreLabel : null) ??
        (storeId ? `Shop ${storeId.slice(-6).toUpperCase()}` : '-') ??
        '-';

      // Ưu tiên summary từ log mới nhất có dashboard/tax_result
      let summaryObj: Record<string, unknown> = {};
      for (const l of relatedLogs) {
        const v = recordValue(l.new_value);
        const dash = recordValue(v.dashboard);
        const taxResult = recordValue(v.tax_result);
        if (Object.keys(dash).length > 0 || Object.keys(taxResult).length > 0) summaryObj = v;
      }
      if (latestLog) summaryObj = Object.keys(summaryObj).length > 0 ? summaryObj : recordValue(latestLog.new_value);

      const updatedAt = latestLog?.created_at ?? null;
      const status = jobStatusToBadge(job?.status ?? (latestLog?.action ? auditStatus(latestLog.action) : 'processing'));

      const sourceLogForFile =
        relatedLogs.find((l) => fileKindForLog(l) != null) ?? null;

      const ctx = uploadContextFromLogs(relatedLogs);

      rows.push({
        jobId: jid,
        storeId,
        storeLabel,
        status,
        updatedAt,
        alertsCount: extractAlertsCount(summaryObj),
        mismatch: extractMismatchFlag(summaryObj),
        payableTax: extractPayableTax(summaryObj),
        sourceLogForFile,
        periodLabel: ctx.periodLabel,
        sessionKindLabel: ctx.sessionKindLabel,
      });
    }

    let out = rows;
    if (filterStoreId) out = out.filter((r) => r.storeId === filterStoreId);
    if (filterPending) out = out.filter((r) => r.status !== 'synced');

    out.sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
    return out;
  }, [logs, jobs, filterStoreId, filterPending, storeLabelById]);

  const pageCount = Math.max(1, Math.ceil(sessionRows.length / PAGE_SIZE));
  const pageIndex = Math.min(page, pageCount - 1);
  const pagedRows = sessionRows.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const loadingAny = loading || jobsLoading;
  const mergedError = error || jobsError;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 sm:space-y-8"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-product-tour="history-header">
        <div>
            <h1 className="mb-2 font-display text-2xl font-bold text-on-surface sm:text-3xl">
              Lịch sử phiên xử lý
            </h1>
            <p className="text-sm leading-relaxed text-outline">
              Mỗi dòng là một phiên xử lý. Kỳ báo cáo và loại phiên lấy từ metadata upload (khi có). Lọc theo{' '}
              <span className="font-mono">store_id</span> hoặc <span className="font-mono">filter=pending</span>.
            </p>
          </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="md"
            variant="outline"
            className="gap-2"
            onClick={() => {
              void refetch();
              void refetchJobs();
            }}
          >
            <Filter size={16} />
            Làm mới
          </Button>
        </div>
      </div>

      {mergedError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Không kết nối được API: {mergedError}. Hãy chạy backend cổng 8000 và kiểm tra proxy Vite.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm sm:rounded-3xl" data-product-tour="history-table">
        {loadingAny && sessionRows.length === 0 ? (
          <p className="p-8 text-center text-outline">Đang tải...</p>
        ) : sessionRows.length === 0 ? (
          <p className="p-8 text-center text-outline">Chưa có phiên nào. Vào Tải dữ liệu để gửi file.</p>
        ) : (
          <Table bare className="min-w-[1040px]">
            <TableHead>
              <TableRow className="border-b border-outline-variant bg-surface/50 hover:bg-surface/50">
                <TableHeaderCell>Job ID</TableHeaderCell>
                <TableHeaderCell>Shop</TableHeaderCell>
                <TableHeaderCell>Kỳ báo cáo</TableHeaderCell>
                <TableHeaderCell>Loại phiên</TableHeaderCell>
                <TableHeaderCell>Trạng thái hồ sơ</TableHeaderCell>
                <TableHeaderCell className="text-right">Alerts</TableHeaderCell>
                <TableHeaderCell className="text-right">Mismatch</TableHeaderCell>
                <TableHeaderCell className="text-right">Giá trị tham khảo</TableHeaderCell>
                <TableHeaderCell>Cập nhật</TableHeaderCell>
                <TableHeaderCell className="text-right">Thao tác</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRows.map((row, rowIndex) => (
                <TableRow key={row.jobId}>
                  <TableCell className="font-mono text-xs text-outline">
                    {pageIndex * PAGE_SIZE + rowIndex + 1}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs font-semibold text-on-surface">
                    {row.storeLabel}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-outline">
                    {row.periodLabel ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[140px] text-xs text-outline">
                    {row.sessionKindLabel ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-outline">
                    {row.alertsCount == null ? '—' : row.alertsCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.mismatch == null ? (
                      <span className="text-xs text-outline">—</span>
                    ) : row.mismatch ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Có</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Không</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-on-surface">
                    {row.payableTax == null ? '—' : formatVnd(row.payableTax)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-outline">
                    {timeLabel(row.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary transition-colors hover:text-primary/75 disabled:text-outline"
                        onClick={() => {
                          const qs = new URLSearchParams();
                          if (row.storeId) qs.set('store_id', row.storeId);
                          qs.set('job_id', row.jobId);
                          onNavigate?.('upload', qs.toString());
                        }}
                        disabled={!onNavigate}
                      >
                        <ExternalLink size={14} /> Review
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary transition-colors hover:text-primary/75 disabled:text-outline"
                        onClick={() => row.sourceLogForFile && viewFile(row.sourceLogForFile)}
                        disabled={!row.sourceLogForFile}
                      >
                        <Eye size={14} /> Xem
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="hidden">
          <span className="text-center sm:text-left">Tổng {sessionRows.length} phiên</span>
          <span className="text-center sm:text-right">Không phân trang (hiển thị theo dữ liệu hiện có)</span>
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface/30 px-4 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-outline sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
          <span className="text-center sm:text-left">
            Đang hiển thị {pagedRows.length} / {sessionRows.length} phiên · Trang {pageIndex + 1}/{pageCount}
          </span>
          <div className="flex justify-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={pageIndex <= 0 || loadingAny}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pageIndex + 1 >= pageCount || loadingAny}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            >
              Sau
            </Button>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant border-l-4 border-l-primary bg-white p-4 sm:flex-row sm:items-start sm:p-5" data-product-tour="history-hint">
        <div className="pointer-events-none absolute right-0 top-0 p-5 opacity-5 transition-all duration-700 group-hover:scale-110">
          <Brain size={82} className="text-primary" />
        </div>
        <div className="relative z-10 rounded-xl bg-primary/10 p-3 text-primary">
          <Brain size={22} />
        </div>
        <div className="relative z-10 flex-1">
          <h4 className="mb-1.5 font-display text-base font-bold text-primary">
            Gợi ý
          </h4>
          <p className="mb-3 max-w-2xl text-xs leading-relaxed text-outline sm:text-sm">
            Sau mỗi lần tải lên thành công, mở Sức khỏe hồ sơ hoặc Báo cáo Tháng để xem trạng thái từ phiên mới nhất.
          </p>
          <button
            type="button"
            className="group/btn flex items-center gap-2 font-display text-[11px] font-black uppercase tracking-[0.2em] text-primary"
            onClick={() => void refetch()}
          >
            Làm mới danh sách
            <ArrowRight
              size={16}
              className="transition-transform group-hover/btn:translate-x-2"
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
