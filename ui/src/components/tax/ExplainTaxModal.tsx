import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, Scale, Tags } from 'lucide-react';
import { Button } from '../ui/Button';
import { getExplain } from '../../api/client';
import type { ExplainResponse, ExplanationItem } from '../../api/types';

type ExplainTaxModalProps = {
  open: boolean;
  onClose: () => void;
  jobId: string | null;
  /** Ưu tiên hiển thị giải thích trùng mã cảnh báo */
  highlightCode?: string | null;
  /** Giống wireframe V1: đóng modal và mở chỉnh sửa */
  onSuaDuLieu?: () => void;
};

function ExplanationCard({ item }: { item: ExplanationItem }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low/80 p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-primary">{item.code}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
          {item.level}
        </span>
      </div>
      <p className="mb-3 text-sm font-semibold text-on-surface">{item.message}</p>
      {item.conclusion && (
        <p className="mb-2 text-sm text-on-surface">
          <span className="font-bold text-primary-container">Kết luận: </span>
          {item.conclusion}
        </p>
      )}
      {item.reason && (
        <p className="mb-3 text-sm leading-relaxed text-outline">{item.reason}</p>
      )}
      {item.recommended_action && (
        <p className="rounded-xl bg-primary/5 p-3 text-sm text-on-surface">
          <span className="font-bold text-primary">Gợi ý: </span>
          {item.recommended_action}
        </p>
      )}
      {Object.keys(item.data_used ?? {}).length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-bold text-outline">Dữ liệu tham chiếu</summary>
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-white/80 p-2 font-mono text-[11px] text-on-surface">
            {JSON.stringify(item.data_used, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function ExplainTaxModal({
  open,
  onClose,
  jobId,
  highlightCode,
  onSuaDuLieu,
}: ExplainTaxModalProps) {
  const [data, setData] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !jobId) {
      setData(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void getExplain(jobId)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Không tải được giải thích');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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

  const items = data?.alert_explanations ?? [];
  const ordered =
    highlightCode && items.length
      ? [...items].sort((a, b) => {
          if (a.code === highlightCode) return -1;
          if (b.code === highlightCode) return 1;
          return 0;
        })
      : items;

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
            aria-labelledby="explain-tax-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-outline-variant bg-white shadow-2xl shadow-primary/10"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant px-5 py-4 sm:px-6">
              <div>
                <h2 id="explain-tax-title" className="font-display text-xl font-bold text-primary">
                  Giải thích thuế &amp; cảnh báo
                </h2>
                <p className="mt-1 text-sm text-outline">
                  Phiên: <span className="font-mono text-xs">{jobId ?? '—'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-outline hover:bg-surface-container"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              {loading && (
                <p className="text-sm text-outline">Đang tải giải thích từ máy chủ…</p>
              )}
              {err && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {err}
                </p>
              )}
              {!loading && !err && data?.status === 'processing' && (
                <p className="text-sm text-outline">Phiên vẫn đang xử lý — thử lại sau.</p>
              )}
              {!loading && !err && data && data.status !== 'processing' && (
                <div className="space-y-6">
                  {data.note && !data.has_explanations && (
                    <p className="rounded-xl bg-surface-container p-4 text-sm text-outline">
                      {data.note}
                    </p>
                  )}

                  {data.confirmationMessage && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-on-surface">
                      {data.confirmationMessage}
                    </div>
                  )}

                  {!!data.legalBasis?.length && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                        <Scale className="size-4" />
                        Căn cứ tham chiếu
                      </h3>
                      <ul className="space-y-2">
                        {data.legalBasis.map((line) => (
                          <li
                            key={line}
                            className="flex gap-2 text-sm leading-relaxed text-outline"
                          >
                            <BookOpen className="mt-0.5 size-4 shrink-0 text-primary-container" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!data.dataTags?.length && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                        <Tags className="size-4" />
                        Nhãn dữ liệu
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {data.dataTags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-on-surface"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {ordered.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-on-surface">Chi tiết từng cảnh báo</h3>
                      {ordered.map((item) => (
                        <div
                          key={`${item.code}-${item.message}`}
                          className={
                            highlightCode && item.code === highlightCode
                              ? 'ring-2 ring-primary-container ring-offset-2'
                              : ''
                          }
                        >
                          <ExplanationCard item={item} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-outline-variant px-5 py-4 sm:flex-row sm:px-6">
              <Button type="button" variant="outline" block onClick={onClose}>
                Đóng
              </Button>
              {onSuaDuLieu && (
                <Button
                  type="button"
                  variant="primary"
                  block
                  onClick={() => {
                    onClose();
                    onSuaDuLieu();
                  }}
                >
                  Sửa dữ liệu
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
