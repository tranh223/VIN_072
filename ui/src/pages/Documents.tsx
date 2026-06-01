import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive,
  Download,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui/Table';
import { getDocuments, getStores, resolvePublicFileUrl } from '../api/client';
import type { AuthUser, DocumentItem, StoreSummary } from '../api/types';
import {
  DOCUMENT_TYPE_OPTIONS,
  SOURCE_CHANNEL_OPTIONS,
  STATUS_OPTIONS,
} from '../lib/documentArchiveFilters';

const PAGE_SIZE = 10;

const selectClass =
  'min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5';

type DocumentsProps = {
  currentUser?: AuthUser | null;
  onNavigate?: (id: string, search?: string) => void;
};

type PreviewKind = 'csv' | 'pdf' | 'image' | 'other';

type PreviewFile = {
  doc: DocumentItem;
  url: string;
  kind: PreviewKind;
};

type CsvTable = {
  headers: string[];
  rows: string[][];
};

function timeLabel(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? '—' : d.toLocaleString('vi-VN');
}

function fileKindLabel(kind?: string | null): string {
  const k = String(kind ?? '').toLowerCase();
  if (k === 'csv') return 'CSV';
  if (k === 'pdf') return 'PDF';
  if (k === 'image') return 'Ảnh';
  return k ? k : '—';
}

function fileExtension(value?: string | null): string {
  const clean = String(value ?? '').split('?')[0].split('#')[0];
  const idx = clean.lastIndexOf('.');
  return idx >= 0 ? clean.slice(idx + 1).toLowerCase() : '';
}

function previewKindFor(doc: DocumentItem): PreviewKind {
  const kind = String(doc.file_kind ?? '').toLowerCase();
  const ext = fileExtension(doc.filename || doc.file_url);
  if (kind === 'csv' || ext === 'csv') return 'csv';
  if (kind === 'pdf' || ext === 'pdf') return 'pdf';
  if (kind === 'image' || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif'].includes(ext)) return 'image';
  return 'other';
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function detectCsvDelimiter(lines: string[]): string {
  const candidates = [',', ';', '\t'];
  const sample = lines.slice(0, 10);
  const scored = candidates.map((delimiter) => {
    const counts = sample.map((line) => parseDelimitedLine(line, delimiter).length);
    return {
      delimiter,
      max: Math.max(...counts),
      stable: counts.filter((count) => count === counts[0]).length,
    };
  });
  scored.sort((a, b) => b.max - a.max || b.stable - a.stable);
  return scored[0]?.max > 1 ? scored[0].delimiter : ',';
}

function parseCsvTable(text: string): CsvTable {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  const delimiter = detectCsvDelimiter(lines);
  const parsed = lines.map((line) => parseDelimitedLine(line, delimiter));
  const headers = parsed[0] ?? [];
  return { headers, rows: parsed.slice(1) };
}

function looksLikeIdentifierColumn(header: string): boolean {
  const normalized = header.toLowerCase();
  return /(id|code|mã|ma |số đơn|so don|order|phone|điện thoại|dien thoai|ngày|ngay|date|period|kỳ|ky|month|year|tháng|năm)/i.test(
    normalized
  );
}

function parseCsvNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || /[A-Za-zÀ-ỹ]/.test(trimmed)) return null;
  if (!/^-?\d[\d.,\s]*$/.test(trimmed)) return null;

  const compact = trimmed.replace(/\s/g, '');
  const lastDot = compact.lastIndexOf('.');
  const lastComma = compact.lastIndexOf(',');
  let normalized = compact;

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalMark = lastDot > lastComma ? '.' : ',';
    const groupMark = decimalMark === '.' ? ',' : '.';
    normalized = compact.replaceAll(groupMark, '').replace(decimalMark, '.');
  } else if (lastComma >= 0) {
    const decimalDigits = compact.length - lastComma - 1;
    normalized = decimalDigits > 0 && decimalDigits !== 3 ? compact.replace(',', '.') : compact.replaceAll(',', '');
  } else if (lastDot >= 0) {
    const decimalDigits = compact.length - lastDot - 1;
    normalized = decimalDigits > 0 && decimalDigits !== 3 ? compact : compact.replaceAll('.', '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCsvCell(value: string | undefined, header: string): string {
  if (value == null) return '';
  if (looksLikeIdentifierColumn(header)) return value;

  const parsed = parseCsvNumber(value);
  if (parsed == null) return value;

  const absolute = Math.abs(parsed);
  const hasDecimals = !Number.isInteger(parsed);
  if (absolute < 1000 && !hasDecimals) return value;

  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: hasDecimals ? 4 : 0,
  }).format(parsed);
}

async function readCsvPreviewText(res: Response): Promise<string> {
  const text = await res.text();
  if (res.ok) return text;

  let detail = text.trim();
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    if (typeof body.detail === 'string' && body.detail.trim()) detail = body.detail.trim();
  } catch {
    // Keep the plain response text when the backend did not return JSON.
  }
  throw new Error(detail || `Không đọc được nội dung CSV (HTTP ${res.status}).`);
}

export default function Documents({ currentUser, onNavigate }: DocumentsProps) {
  const [searchParams] = useSearchParams();
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [rows, setRows] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState('');
  const [storeId, setStoreId] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [status, setStatus] = useState('');
  const [sourceChannel, setSourceChannel] = useState('');
  const [offset, setOffset] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvTable | null>(null);
  const [csvPreviewLoading, setCsvPreviewLoading] = useState(false);
  const [csvPreviewError, setCsvPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const p = searchParams.get('period');
    const sid = searchParams.get('store_id');
    const dt = searchParams.get('document_type');
    const st = searchParams.get('status');
    const sc = searchParams.get('source_channel');
    if (p !== null) setPeriod(p);
    if (sid !== null) setStoreId(sid);
    if (dt !== null) setDocumentType(dt);
    if (st !== null) setStatus(st);
    if (sc !== null) setSourceChannel(sc);
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    void getStores(currentUser?.id)
      .then((data) => {
        if (alive) setStores(data.stores);
      })
      .catch(() => {
        if (alive) setStores([]);
      });
    return () => {
      alive = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    setOffset(0);
  }, [period, storeId, documentType, status, sourceChannel]);

  useEffect(() => {
    if (!currentUser?.id) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    void getDocuments({
      user_id: currentUser.id,
      store_id: storeId || undefined,
      period: period.trim() || undefined,
      document_type: documentType || undefined,
      status: status || undefined,
      source_channel: sourceChannel || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((data) => {
        if (!alive) return;
        const scopedDocuments = storeId
          ? data.documents.filter((doc) => doc.store_id === storeId)
          : data.documents;
        setRows(scopedDocuments);
        setTotal(scopedDocuments.length);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err.message);
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [
    currentUser?.id,
    storeId,
    period,
    documentType,
    status,
    sourceChannel,
    offset,
    refreshNonce,
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageIndex = Math.floor(offset / PAGE_SIZE) + 1;
  const visibleCount = rows.length;

  const resetFilters = () => {
    setPeriod('');
    setStoreId('');
    setDocumentType('');
    setStatus('');
    setSourceChannel('');
  };

  const openFile = (doc: DocumentItem) => {
    const qs = new URLSearchParams();
    if (currentUser?.id) qs.set('user_id', currentUser.id);
    qs.set('kind', previewKindFor(doc) === 'csv' ? 'csv' : 'invoice');
    const url = resolvePublicFileUrl(`/api/documents/${encodeURIComponent(doc.id)}/file?${qs.toString()}`);
    if (url) setPreviewFile({ doc, url, kind: previewKindFor(doc) });
  };

  const downloadFile = (doc: DocumentItem) => {
    const qs = new URLSearchParams();
    if (currentUser?.id) qs.set('user_id', currentUser.id);
    qs.set('kind', previewKindFor(doc) === 'csv' ? 'csv' : 'invoice');
    const url = resolvePublicFileUrl(`/api/documents/${encodeURIComponent(doc.id)}/file?${qs.toString()}`);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.filename || 'document';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  useEffect(() => {
    if (!previewFile || previewFile.kind !== 'csv') {
      setCsvPreview(null);
      setCsvPreviewLoading(false);
      setCsvPreviewError(null);
      return;
    }
    let alive = true;
    setCsvPreview(null);
    setCsvPreviewError(null);
    setCsvPreviewLoading(true);
    void fetch(previewFile.url)
      .then(readCsvPreviewText)
      .then((text) => {
        if (alive) setCsvPreview(parseCsvTable(text));
      })
      .catch((err: Error) => {
        if (alive) setCsvPreviewError(err.message);
      })
      .finally(() => {
        if (alive) setCsvPreviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [previewFile]);

  useEffect(() => {
    if (!previewFile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewFile(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewFile]);

  const emptyHint = useMemo(() => {
    if (!currentUser?.id) return 'Đăng nhập để xem hồ sơ.';
    return 'Chưa có chứng từ trong kỳ lọc này. Thử đổi bộ lọc hoặc tải dữ liệu mới.';
  }, [currentUser?.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-4 border-b border-outline-variant pb-6 lg:flex-row lg:items-end lg:justify-between" data-product-tour="documents-header">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FolderOpen size={28} strokeWidth={2} />
          </div>
          <div>
            <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-outline">
              Kho lưu trữ
            </p>
            <h1 className="font-display text-2xl font-black tracking-tight text-on-surface md:text-3xl">
              Hồ sơ / Chứng từ
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-outline">
              Các file đã upload, đã đối soát và đã xác nhận — lọc theo kỳ, shop, loại và trạng thái. Đây không thay thế
              trang <strong className="text-on-surface">Tải dữ liệu</strong> (chỉ dùng để gửi file mới).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => setRefreshNonce((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </Button>
          <Button type="button" variant="primary" className="gap-2" onClick={() => onNavigate?.('upload')}>
            <UploadCloud size={16} />
            Tải dữ liệu
          </Button>
        </div>
      </header>

      <section className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-6" data-product-tour="documents-filters">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Archive size={18} className="text-primary" />
          <h2 className="font-display text-sm font-bold text-on-surface">Bộ lọc</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Input
            label="Kỳ"
            name="period"
            placeholder="VD: 04/2026 hoặc 2026"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">
              Shop
            </label>
            <select
              className={selectClass}
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              <option value="">Tất cả cửa hàng</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.store_name || s.store_code || s.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">
              Loại chứng từ
            </label>
            <select
              className={selectClass}
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              {DOCUMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">
              Trạng thái
            </label>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">
              Nguồn
            </label>
            <select
              className={selectClass}
              value={sourceChannel}
              onChange={(e) => setSourceChannel(e.target.value)}
            >
              {SOURCE_CHANNEL_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="secondary" block onClick={resetFilters}>
              Xóa lọc
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm" data-product-tour="documents-table">
        {loading && rows.length === 0 ? (
          <p className="p-10 text-center text-outline">Đang tải hồ sơ…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-outline/40">
              <Archive size={32} />
            </div>
            <div>
              <p className="font-display text-base font-bold text-on-surface">Chưa có dữ liệu</p>
              <p className="mt-1 max-w-md text-sm text-outline">{emptyHint}</p>
            </div>
            <Button type="button" variant="primary" className="gap-2" onClick={() => onNavigate?.('upload')}>
              <UploadCloud size={16} />
              Đến Tải dữ liệu
            </Button>
          </div>
        ) : (
          <Table bare className="min-w-[960px]">
            <TableHead>
              <TableRow className="border-b border-outline-variant bg-surface/50 hover:bg-surface/50">
                <TableHeaderCell>Tên file</TableHeaderCell>
                <TableHeaderCell>Shop</TableHeaderCell>
                <TableHeaderCell>Kỳ</TableHeaderCell>
                <TableHeaderCell>Loại</TableHeaderCell>
                <TableHeaderCell>Nguồn</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
                <TableHeaderCell>Định dạng</TableHeaderCell>
                <TableHeaderCell>Upload</TableHeaderCell>
                <TableHeaderCell>Xác nhận</TableHeaderCell>
                <TableHeaderCell className="text-right">Thao tác</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="max-w-[220px]">
                    <span className="line-clamp-2 text-xs font-semibold text-on-surface">
                      {doc.filename ?? doc.id}
                    </span>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {doc.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="font-mono text-[9px] normal-case">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-xs">
                    {doc.store_name || doc.store_id || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-outline">{doc.period ?? '—'}</TableCell>
                  <TableCell className="max-w-[160px] text-xs">{doc.document_type}</TableCell>
                  <TableCell className="text-xs text-outline">{doc.source_channel}</TableCell>
                  <TableCell>
                    <Badge variant="default" className="normal-case">
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fileKindLabel(doc.file_kind)}</TableCell>
                  <TableCell className="font-mono text-[11px] text-outline">{timeLabel(doc.uploaded_at)}</TableCell>
                  <TableCell className="font-mono text-[11px] text-outline">{timeLabel(doc.confirmed_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary disabled:text-outline"
                        onClick={() => openFile(doc)}
                        disabled={!resolvePublicFileUrl(doc.file_url)}
                        title={!resolvePublicFileUrl(doc.file_url) ? 'Chưa có URL file' : 'Mở file'}
                      >
                        <ExternalLink size={14} />
                        Mở
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary disabled:text-outline"
                        onClick={() => downloadFile(doc)}
                        disabled={!resolvePublicFileUrl(doc.file_url)}
                      >
                        <Download size={14} />
                        Tải
                      </button>
                      {doc.job_id ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-outline hover:text-primary"
                          onClick={() => {
                            const qs = new URLSearchParams();
                            if (doc.store_id) qs.set('store_id', doc.store_id);
                            qs.set('job_id', doc.job_id!);
                            onNavigate?.('upload', qs.toString());
                          }}
                        >
                          Phiên
                        </button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > 0 && (
          <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span className="text-center text-[11px] font-bold uppercase tracking-widest text-outline sm:text-left">
              Hiển thị {visibleCount} / {total} chứng từ · Trang {pageIndex}/{pageCount}
            </span>
            <div className="flex justify-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={offset <= 0 || loading}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Trước
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-outline-variant border-l-4 border-l-primary bg-white p-4 text-sm text-outline" data-product-tour="documents-hint">
        <p className="font-display font-bold text-on-surface">Gợi ý</p>
        <p className="mt-1 leading-relaxed">
          Cần xem dòng thời gian phiên xử lý? Mở{' '}
          <button
            type="button"
            className="font-bold text-primary underline decoration-primary/30 underline-offset-2 hover:text-primary/80"
            onClick={() => onNavigate?.('history')}
          >
            Lịch sử phiên
          </button>
          . Checklist cuối năm:{' '}
          <button
            type="button"
            className="font-bold text-primary underline decoration-primary/30 underline-offset-2 hover:text-primary/80"
            onClick={() => onNavigate?.('yearend')}
          >
            Tổng quan thuế cuối năm
          </button>
          .
        </p>
      </div>
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            aria-label="Đóng xem trước"
            onClick={() => setPreviewFile(null)}
          />
          <div className="relative flex h-[min(82vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-center justify-between gap-4 border-b border-outline-variant px-4 py-3">
              <div className="min-w-0">
                <p className="line-clamp-1 font-display text-base font-bold text-on-surface">
                  {previewFile.doc.filename || previewFile.doc.id}
                </p>
                <p className="mt-0.5 text-xs text-outline">
                  {fileKindLabel(previewFile.doc.file_kind)} · {previewFile.doc.document_type || 'Chứng từ'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
                  onClick={() => downloadFile(previewFile.doc)}
                >
                  <Download size={14} />
                  Tải
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
                  onClick={() => window.open(previewFile.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink size={14} />
                  Tab mới
                </button>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface hover:text-primary"
                  aria-label="Đóng"
                  onClick={() => setPreviewFile(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 bg-surface/40 p-3">
              {previewFile.kind === 'csv' ? (
                <div className="h-full overflow-auto rounded-xl bg-white p-4">
                  {csvPreviewLoading ? (
                    <p className="text-sm text-outline">Đang đọc CSV...</p>
                  ) : csvPreviewError ? (
                    <p className="text-sm font-semibold text-red-700">{csvPreviewError}</p>
                  ) : csvPreview && csvPreview.headers.length > 0 ? (
                    <table className="min-w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-surface">
                        <tr>
                          {csvPreview.headers.map((header, index) => (
                            <th
                              key={`${header}-${index}`}
                              className="whitespace-nowrap border border-outline-variant px-3 py-2 font-bold text-on-surface"
                            >
                              {header || `Cột ${index + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="odd:bg-white even:bg-surface/40">
                            {csvPreview.headers.map((header, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="whitespace-nowrap border border-outline-variant px-3 py-2 font-mono text-outline"
                              >
                                {formatCsvCell(row[cellIndex], header)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-outline">CSV trống.</p>
                  )}
                </div>
              ) : (
                <object
                  title={previewFile.doc.filename || previewFile.doc.id}
                  data={previewFile.url}
                  className="h-full w-full rounded-xl border border-outline-variant bg-white"
                >
                  <iframe
                    title={previewFile.doc.filename || previewFile.doc.id}
                    src={previewFile.url}
                    className="h-full w-full rounded-xl border-0 bg-white"
                  />
                </object>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
