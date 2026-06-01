import { useCallback, useEffect, useState } from 'react';
import { getTax } from '../api/client';
import type { JobSummary, TaxResponse } from '../api/types';

/** Lấy kết quả thuế của phiên `done` mới nhất trong danh sách. */
export function useLatestCompletedTax(jobs: JobSummary[]) {
  const [tax, setTax] = useState<TaxResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestId = jobs.find((j) => j.status === 'done')?.job_id;

  const loadTax = useCallback(async (jobId: string) => {
    const t = await getTax(jobId);
    setTax(t.status === 'done' ? t : null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!latestId) {
      setTax(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadTax(latestId)
      .catch((e) => {
        if (!cancelled) {
          setTax(null);
          setError(e instanceof Error ? e.message : 'Lỗi tải thuế');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [latestId, loadTax]);

  const refetchTax = useCallback(async () => {
    const id = jobs.find((j) => j.status === 'done')?.job_id;
    if (!id) return;
    setLoading(true);
    try {
      await loadTax(id);
    } catch (e) {
      setTax(null);
      setError(e instanceof Error ? e.message : 'Lỗi tải thuế');
    } finally {
      setLoading(false);
    }
  }, [jobs, loadTax]);

  return { tax, loading, error, jobId: latestId ?? null, refetchTax };
}
