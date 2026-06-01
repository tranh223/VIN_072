import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, Download, Filter, Layers, Printer, ShieldAlert, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getAuditLogs } from '../../api/client';
import type { AuditLogSummary, AuthUser } from '../../api/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';

type AuditLogProps = {
  currentUser?: AuthUser | null;
};

export default function AuditLog({ currentUser }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    if (!currentUser?.id) {
      setLogs([]);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    void getAuditLogs(currentUser.id)
      .then((data) => {
        if (alive) setLogs(data.audit_logs);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentUser?.id]);

  const entries = logs.map((log) => {
    const oldValue = (log.old_value && typeof log.old_value === 'object') ? log.old_value : null;
    const newValue = (log.new_value && typeof log.new_value === 'object') ? log.new_value : null;
    const oldKeys = oldValue ? Object.keys(oldValue) : [];
    const newKeys = newValue ? Object.keys(newValue) : [];
    const keySet = new Set([...oldKeys, ...newKeys]);
    return {
    id: log.id,
    user: log.actor_name ?? log.actor_email ?? 'Hệ thống',
      role: log.actor_email ? 'Người dùng' : 'Hệ thống',
    action: log.action ?? 'UNKNOWN_ACTION',
    target: [log.entity_type, log.entity_id].filter(Boolean).join(': ') || 'Không rõ',
    time: log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : 'Không rõ thời gian',
    createdAt: log.created_at ? new Date(log.created_at) : null,
      changeKeys: keySet.size,
      hasBeforeAfter: Boolean(oldValue) || Boolean(newValue),
    };
  });

  const userOptions = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.user))).sort(),
    [entries]
  );
  const actionOptions = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.action))).sort(),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    const days = timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : timeFilter === '90d' ? 90 : null;
    return entries.filter((entry) => {
      if (userFilter !== 'all' && entry.user !== userFilter) return false;
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
      if (days) {
        if (!entry.createdAt || Number.isNaN(entry.createdAt.getTime())) return false;
        const minTime = now - days * 24 * 60 * 60 * 1000;
        if (entry.createdAt.getTime() < minTime) return false;
      }
      return true;
    });
  }, [actionFilter, entries, timeFilter, userFilter]);

  const hasActiveFilters = userFilter !== 'all' || actionFilter !== 'all' || timeFilter !== 'all';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <header className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end" data-product-tour="audit-header">
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-on-surface sm:text-3xl">
            Nhật ký thay đổi dữ liệu
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-outline">
            Theo dõi ai đã làm gì, với đối tượng nào và lúc nào. Dùng để truy vết thay đổi khi cần đối soát.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="relative">
            <Button
              type="button"
              variant={hasActiveFilters ? 'secondary' : 'outline'}
              size="md"
              className="gap-2 text-xs uppercase tracking-widest"
              onClick={() => setFilterOpen((value) => !value)}
            >
              <Filter size={16} />
              Bộ lọc
              <ChevronDown size={14} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </Button>
            {filterOpen && (
              <div className="absolute right-0 z-20 mt-2 w-[min(88vw,360px)] rounded-2xl border border-outline-variant bg-white p-4 text-left shadow-xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-bold text-on-surface">Bộ lọc</p>
                    <p className="text-[11px] text-outline">
                      {filteredEntries.length}/{entries.length} bản ghi
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="text-[11px] font-bold text-primary hover:underline"
                      onClick={() => {
                        setUserFilter('all');
                        setActionFilter('all');
                        setTimeFilter('all');
                      }}
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-outline">
                      <User size={13} /> Người dùng
                    </span>
                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      className="h-10 w-full rounded-xl border border-outline-variant bg-surface px-3 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/5"
                    >
                      <option value="all">Tất cả</option>
                      {userOptions.map((user) => (
                        <option key={user} value={user}>{user}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-outline">
                      <Layers size={13} /> Loại hành động
                    </span>
                    <select
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                      className="h-10 w-full rounded-xl border border-outline-variant bg-surface px-3 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/5"
                    >
                      <option value="all">Tất cả</option>
                      {actionOptions.map((action) => (
                        <option key={action} value={action}>{action}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-outline">
                      <Calendar size={13} /> Thời gian
                    </span>
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="h-10 w-full rounded-xl border border-outline-variant bg-surface px-3 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/5"
                    >
                      <option value="all">Tất cả</option>
                      <option value="7d">7 ngày qua</option>
                      <option value="30d">30 ngày qua</option>
                      <option value="90d">90 ngày qua</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
          <span className="rounded-full border border-outline-variant bg-white px-3 py-2 text-xs font-bold text-outline">
            Xuất CSV / Tạo báo cáo: sắp có
          </span>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm" data-product-tour="audit-table">
        {error && (
          <div className="m-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="p-8 text-center text-sm text-outline">
            Chưa có nhật ký thay đổi trong database.
          </div>
        )}
        {!loading && !error && entries.length > 0 && filteredEntries.length === 0 && (
          <div className="p-8 text-center text-sm text-outline">
            Không có bản ghi phù hợp với bộ lọc hiện tại.
          </div>
        )}
        {filteredEntries.length > 0 && (
          <Table bare className="min-w-[760px]">
            <TableHead>
              <TableRow className="border-b border-outline-variant bg-surface/50 hover:bg-surface/50">
                <TableHeaderCell>Người dùng</TableHeaderCell>
                <TableHeaderCell>Hành động</TableHeaderCell>
                <TableHeaderCell>Đối tượng thao tác</TableHeaderCell>
                <TableHeaderCell>Thay đổi</TableHeaderCell>
                <TableHeaderCell>Trước/Sau</TableHeaderCell>
                <TableHeaderCell className="text-right">Thời gian</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-on-surface">{entry.user}</p>
                      <p className="truncate text-[11px] font-bold uppercase tracking-wider text-outline">{entry.role}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-lg border border-primary/10 bg-primary/5 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-primary">
                      {entry.action}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate text-xs font-bold text-on-surface">
                    {entry.target}
                  </TableCell>
                  <TableCell className="text-xs text-outline">
                    {entry.changeKeys > 0 ? `${entry.changeKeys} trường` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-outline">
                    {entry.hasBeforeAfter ? 'Có' : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-outline">
                    {entry.time}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </motion.div>
  );
}
