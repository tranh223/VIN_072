import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { getExtraction, getTax, postCorrection } from '../../api/client';
import type { CorrectionPayload, CorrectionResponse } from '../../api/types';
import { formatVnd } from '../../lib/format';

type CorrectionModalProps = {
  open: boolean;
  onClose: () => void;
  jobId: string | null;
  onSuccess: (result: CorrectionResponse) => void;
};

type FormState = {
  revenue_raw: string;
  industry: string;
  period: string;
  total_amount: string;
  issue_date: string;
};

const emptyForm = (): FormState => ({
  revenue_raw: '',
  industry: 'other',
  period: '',
  total_amount: '',
  issue_date: '',
});

function parseNum(s: string): number | undefined {
  const t = s.replace(/,/g, '').trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function diffPayload(initial: FormState, current: FormState): CorrectionPayload {
  const out: CorrectionPayload = {};
  const changed = (a: string, b: string) => parseNum(a) !== parseNum(b);
  if (changed(current.revenue_raw, initial.revenue_raw)) {
    const v = parseNum(current.revenue_raw);
    if (v !== undefined) out.revenue_raw = v;
  }
  if (current.industry !== initial.industry) out.industry = current.industry;
  if (current.period.trim() !== initial.period.trim()) {
    const p = current.period.trim();
    if (p) out.period = p;
  }
  if (changed(current.total_amount, initial.total_amount)) {
    const v = parseNum(current.total_amount);
    if (v !== undefined) out.total_amount = v;
  }
  if (current.issue_date.trim() !== initial.issue_date.trim()) {
    const d = current.issue_date.trim();
    if (d) out.issue_date = d;
  }
  return out;
}

export default function CorrectionModal({
  open,
  onClose,
  jobId,
  onSuccess,
}: CorrectionModalProps) {
  const [initial, setInitial] = useState<FormState>(emptyForm());
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !jobId) {
      setErr(null);
      setOkMsg(null);
      return;
    }
    let cancelled = false;
    setLoadingData(true);
    setErr(null);
    setOkMsg(null);
    void Promise.all([getExtraction(jobId), getTax(jobId)])
      .then(([ex, tx]) => {
        if (cancelled) return;
        const csv = ex.csv_result as Record<string, unknown> | undefined;
        const ocr = ex.ocr_result as Record<string, unknown> | undefined;
        const tr = tx.tax_result as Record<string, unknown> | undefined;

        const csvData = csv?.data as Record<string, unknown> | undefined;
        const csvSummary = csvData?.summary as Record<string, any> | undefined;
        const ocrData = ocr?.data as Record<string, unknown> | undefined;

        const rev = csvSummary?.revenue_raw?.sum ?? csv?.revenue_raw;
        const ocrTotal = ocrData?.total ?? ocr?.total;
        const ocrDate = ocrData?.issue_date ?? ocr?.issue_date;

        const next: FormState = {
          revenue_raw: rev != null ? String(rev) : '',
          industry:
            typeof csv?.industry === 'string' && csv.industry !== 'N/A'
              ? csv.industry
              : 'other',
          period: typeof csv?.period === 'string' && csv.period !== 'N/A' ? csv.period : '',
          total_amount: ocrTotal != null ? String(ocrTotal) : '',
          issue_date:
            typeof ocrDate === 'string' && ocrDate !== 'N/A'
              ? ocrDate
              : '',
        };
        setForm(next);
        setInitial({ ...next });
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Không tải được dữ liệu phiên');
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, jobId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const update = (key: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setOkMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!jobId) return;
    const payload = diffPayload(initial, form);
    const keys = Object.keys(payload).filter((k) => payload[k as keyof CorrectionPayload] !== undefined);
    if (keys.length === 0) {
      setErr('Chưa có thay đổi nào so với dữ liệu hiện tại.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    setOkMsg(null);
    try {
      const result = await postCorrection(jobId, payload);
      setOkMsg('Đã cập nhật dữ liệu và tính lại kết quả thành công.');
      onSuccess(result);
      const snap = { ...form };
      setInitial(snap);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Gửi chỉnh sửa thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            aria-label="Đóng"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="correction-title"
            className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-outline-variant bg-white shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant px-5 py-4">
              <div>
                <h2 id="correction-title" className="font-display text-xl font-bold text-primary">
                  Điều chỉnh &amp; tính lại
                </h2>
                <p className="mt-1 text-sm text-outline">
                  Sửa số liệu CSV / VLM; máy chủ tính lại thuế và cảnh báo ngay.
                </p>
                <p className="mt-1 font-mono text-[11px] text-outline">job_id: {jobId ?? '—'}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-outline hover:bg-surface-container"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {loadingData && (
                  <p className="text-sm text-outline">Đang tải số liệu phiên…</p>
                )}
                {err && (
                  <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {err}
                  </p>
                )}
                {okMsg && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    {okMsg}
                  </p>
                )}

                {!loadingData && (
                  <>
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Cột chứng cứ giao dịch */}
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-outline-variant bg-primary/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                            Giá trị chứng cứ giao dịch hiện tại
                          </p>
                          <p className="mt-1 font-display text-xl font-bold text-primary">
                            {formatVnd(parseNum(initial.total_amount) ?? 0)}
                          </p>
                          <p className="mt-2 text-[11px] text-outline">
                            Kiểm tra với chứng từ gốc; sửa ô bên dưới nếu VLM trích sai.
                          </p>
                        </div>
                        
                        <p className="text-[11px] font-bold uppercase tracking-wider text-outline border-b border-outline-variant pb-1">
                          Chứng từ / ảnh / PDF
                        </p>
                        <Input
                          label="Ngày chứng từ (YYYY-MM-DD)"
                          name="issue_date"
                          value={form.issue_date}
                          onChange={(e) => update('issue_date', e.target.value)}
                        />
                        <Input
                          label="Tổng tiền trên chứng cứ (VND)"
                          name="total_amount"
                          inputMode="decimal"
                          value={form.total_amount}
                          onChange={(e) => update('total_amount', e.target.value)}
                        />
                      </div>

                      {/* Cột dữ liệu bán hàng */}
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-primary/20 bg-surface-container-low/90 p-4 text-sm">
                          <p className="font-bold text-primary">⚡ Tự động tính lại</p>
                          <p className="mt-1 leading-relaxed text-[11px] text-outline">
                            Sau khi Lưu, hệ thống tính lại doanh thu, đối soát chứng cứ và cập nhật bảng tổng hợp ngay.
                          </p>
                        </div>
                        
                        <p className="text-[11px] font-bold uppercase tracking-wider text-outline border-b border-outline-variant pb-1">
                          Dữ liệu bán hàng (CSV)
                        </p>
                        <Input
                          label="Doanh thu (VND)"
                          name="revenue_raw"
                          inputMode="decimal"
                          value={form.revenue_raw}
                          onChange={(e) => update('revenue_raw', e.target.value)}
                        />

                        <div className="space-y-1.5">
                          <label className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">
                            Nhóm Ngành
                          </label>
                          <select
                            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/5"
                            value={form.industry}
                            onChange={(e) => update('industry', e.target.value)}
                          >
                            <option value="goods">Phân phối, hàng hóa</option>
                            <option value="services">Dịch vụ, xây dựng</option>
                            <option value="manufacturing">Sản xuất, vận tải</option>
                            <option value="other">Kinh doanh khác</option>
                          </select>
                        </div>

                        <Input
                          label="Kỳ (VD: 2026-01)"
                          name="period"
                          value={form.period}
                          onChange={(e) => update('period', e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 border-t border-outline-variant px-5 py-4">
                <Button type="button" variant="outline" block onClick={onClose}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  block
                  disabled={loadingData || submitting || !jobId}
                  className="gap-2"
                >
                  <RefreshCcw className={`size-4 ${submitting ? 'animate-spin' : ''}`} />
                  {submitting ? 'Đang tính lại…' : 'Tính lại thuế'}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
