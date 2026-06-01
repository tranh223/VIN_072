import { useCallback, useEffect, useState } from 'react';
import { getJobs } from '../api/client';
import type { JobSummary } from '../api/types';

export function useJobs(pollMs = 10000, userId?: string | null) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const r = await getJobs(userId);
      setJobs(r.jobs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách phiên');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refetch();
    const id = setInterval(() => void refetch(), pollMs);
    return () => clearInterval(id);
  }, [refetch, pollMs]);

  return { jobs, loading, error, refetch };
}
