import type { AdminUser, AdminUserAnalyticsResponse, RagDocument, RagDocumentPayload, UserFeedback, UserStatsResponse } from '../../api/types';
import type { AdminUserRow, GrowthRange } from './types';

export const STATUS_COLORS: Record<string, string> = {
  Active: '#4F3DD6',
  Inactive: '#94A3B8',
  'Bị khóa': '#EF4444',
  'Chờ duyệt': '#F59E0B',
  'Cần duyệt': '#F59E0B',
};

export function statusColor(name: string): string {
  return STATUS_COLORS[name] ?? '#4F3DD6';
}

export const GROWTH_RANGE_OPTIONS: Array<{ id: GrowthRange; label: string }> = [
  { id: 'day', label: 'Ngày' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
];

export const EMPTY_FORM: RagDocumentPayload = {
  title: '',
  document_type: 'FAQ',
  document_number: null,
  content: '',
  issued_date: null,
  effective_date: null,
  expired_date: null,
  file_url: null,
  status: 'active',
};

export function formatDate(value?: string | null): string {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function buildGrowthData(
  users: AdminUserRow[],
  analytics: AdminUserAnalyticsResponse | null,
  range: GrowthRange
) {
  const now = new Date();
  const createdDates = users
    .map((user) => parseDate(user.createdAt))
    .filter((date): date is Date => Boolean(date));

  if (!createdDates.length && range === 'month') {
    return (analytics?.monthly_users ?? []).map((item) => ({
      label: item.month,
      key: item.key,
      users: item.users,
    }));
  }

  if (range === 'day') {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      date.setDate(date.getDate() - (6 - index));
      return {
        label: `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`,
        key: date.toISOString().slice(0, 10),
        users: createdDates.filter((createdAt) => sameDay(createdAt, date)).length,
      };
    });
  }

  if (range === 'month') {
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        label: `T${date.getMonth() + 1}`,
        key: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`,
        users: createdDates.filter(
          (createdAt) => createdAt.getFullYear() === date.getFullYear() && createdAt.getMonth() === date.getMonth()
        ).length,
      };
    });
  }

  return Array.from({ length: 5 }, (_, index) => {
    const year = 2025 + index;
    return {
      label: String(year),
      key: String(year),
      users: createdDates.filter((createdAt) => createdAt.getFullYear() === year).length,
    };
  });
}

export function inputDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function toApiDate(value?: string | null): string | null {
  return value ? `${value}T00:00:00.000Z` : null;
}

export function documentToForm(doc: RagDocument): RagDocumentPayload {
  return {
    title: doc.title ?? '',
    document_type: doc.document_type ?? 'FAQ',
    document_number: doc.document_number ?? null,
    content: doc.content ?? '',
    issued_date: inputDate(doc.issued_date),
    effective_date: inputDate(doc.effective_date),
    expired_date: inputDate(doc.expired_date),
    file_url: doc.file_url ?? null,
    status: doc.status === 'expired' || doc.status === 'draft' ? doc.status : 'active',
  };
}

export function normalizeForm(form: RagDocumentPayload): RagDocumentPayload {
  return {
    title: form.title.trim(),
    document_type: form.document_type.trim() || 'FAQ',
    document_number: form.document_number?.trim() || null,
    content: form.content?.trim() || null,
    issued_date: toApiDate(form.issued_date),
    effective_date: toApiDate(form.effective_date),
    expired_date: toApiDate(form.expired_date),
    file_url: form.file_url?.trim() || null,
    status: form.status,
  };
}

export function userToRow(user: AdminUser): AdminUserRow {
  return {
    id: user.id,
    name: user.full_name || 'Chưa có tên',
    email: user.email || 'Chưa có email',
    role: user.role || 'user',
    stores: user.store_count ?? 0,
    lastLogin: user.updated_at || user.created_at || '',
    status: user.status || 'active',
    createdAt: user.created_at,
  };
}

export function statusLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    locked: 'Bị khóa',
    pending: 'Chờ duyệt',
    draft: 'Cần duyệt',
    expired: 'Hết hiệu lực',
    new: 'Mới',
    reviewed: 'Đang xử lý',
    resolved: 'Đã phản hồi',
    archived: 'Đã đóng',
  };
  return labels[status ?? ''] ?? status ?? 'Không rõ';
}

export function badgeClass(status?: string | null): string {
  if (status === 'active' || status === 'resolved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'inactive') return 'border-slate-200 bg-slate-50 text-slate-600';
  if (status === 'locked' || status === 'expired' || status === 'archived') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'new' || status === 'draft' || status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-primary/15 bg-primary/10 text-primary';
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Admin',
    user: 'Người dùng',
  };
  return labels[role] ?? role;
}

export function priorityFromFeedback(item: UserFeedback): 'high' | 'medium' | 'low' {
  if (item.rating != null && item.rating <= 2) return 'high';
  if (item.status === 'new') return 'medium';
  return 'low';
}

export function statusPieData(stats: UserStatsResponse | null, users: AdminUserRow[]) {
  if (stats?.status_counts && Object.keys(stats.status_counts).length) {
    return Object.entries(stats.status_counts).map(([name, value]) => ({ name: statusLabel(name), value }));
  }
  return [
    { name: 'Active', value: users.filter((user) => user.status === 'active').length },
    { name: 'Inactive', value: users.filter((user) => user.status === 'inactive').length },
    { name: 'Bị khóa', value: users.filter((user) => user.status === 'locked').length },
    { name: 'Chờ duyệt', value: users.filter((user) => user.status === 'pending').length },
  ];
}
