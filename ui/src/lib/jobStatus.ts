import type { SyncStatus } from '../types/status';

export function jobStatusToSync(status: string): SyncStatus {
  if (status === 'done') return 'synced';
  if (status === 'error') return 'error';
  return 'processing';
}

export function alertLevelToSync(level: string): SyncStatus {
  const u = level.toUpperCase();
  if (u === 'WARNING') return 'error';
  if (u === 'CONFIRM') return 'processing';
  return 'synced';
}
