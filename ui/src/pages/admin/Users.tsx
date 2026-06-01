import { useState } from 'react';
import { CheckCircle2, Edit3, Lock, Search, Sparkles, Trash2, Users as UsersIcon } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { AdminBadge, AdminSelect, Avatar, Card, TablePanel } from './components';
import type { AdminUserRow, Totals } from './types';
import { formatDateTime, roleLabel } from './utils';

type Props = {
  totals: Totals;
  users: AdminUserRow[];
  userQuery: string;
  setUserQuery: (value: string) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
  userStatusFilter: string;
  setUserStatusFilter: (value: string) => void;
  updatingUserId: string | null;
  toggleUserLock: (userId: string) => void;
  rotateUserRole: (userId: string) => void;
  softDeleteUser: (userId: string) => void;
  loading: boolean;
};

export default function Users({
  totals,
  users,
  userQuery,
  setUserQuery,
  roleFilter,
  setRoleFilter,
  userStatusFilter,
  setUserStatusFilter,
  updatingUserId,
  toggleUserLock,
  rotateUserRole,
  softDeleteUser,
  loading,
}: Props) {
  const [openActionUserId, setOpenActionUserId] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Tổng người dùng" value={totals.totalUsers} icon={<UsersIcon size={16} />} />
        <Card label="Người dùng hoạt động" value={totals.activeUsers} icon={<CheckCircle2 size={16} />} />
        <Card label="Tài khoản bị khóa" value={totals.lockedUsers} icon={<Lock size={16} />} />
        <Card label="Người dùng mới tháng này" value={totals.newThisMonth} icon={<Sparkles size={16} />} />
      </div>
      <div className="grid gap-3 rounded-xl border border-[#DDD6EA] bg-white p-3 shadow-sm md:grid-cols-[1fr_180px_180px]">
        <Input leftIcon={<Search />} placeholder="Tìm kiếm tên/email" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} />
        <AdminSelect value={roleFilter} onChange={setRoleFilter}>
          <option value="all">Vai trò</option>
          <option value="admin">Admin</option>
          <option value="user">Người dùng</option>
        </AdminSelect>
        <AdminSelect value={userStatusFilter} onChange={setUserStatusFilter}>
          <option value="all">Trạng thái</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="locked">Bị khóa</option>
          <option value="pending">Chờ duyệt</option>
        </AdminSelect>
      </div>
      <TablePanel loading={loading && !users.length} empty={!users.length} emptyText="Chưa có người dùng phù hợp.">
        <Table bare className="min-w-[940px]">
          <TableHead>
            <TableRow className="border-b border-[#DDD6EA] bg-[#F8F7FB] hover:bg-[#F8F7FB]">
              <TableHeaderCell>Avatar</TableHeaderCell>
              <TableHeaderCell>Họ tên</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Vai trò</TableHeaderCell>
              <TableHeaderCell>Số cửa hàng</TableHeaderCell>
              <TableHeaderCell>Lần đăng nhập cuối</TableHeaderCell>
              <TableHeaderCell>Trạng thái</TableHeaderCell>
              <TableHeaderCell className="text-right">Hành động</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell><Avatar name={user.name} /></TableCell>
                <TableCell className="font-bold text-[#111827]">{user.name}</TableCell>
                <TableCell className="text-[#7C758A]">{user.email}</TableCell>
                <TableCell><Badge>{roleLabel(user.role)}</Badge></TableCell>
                <TableCell className="font-mono text-sm">{user.stores}</TableCell>
                <TableCell className="text-xs text-[#7C758A]">{formatDateTime(user.lastLogin)}</TableCell>
                <TableCell><AdminBadge status={user.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="relative flex justify-end gap-1.5">
                    <button
                      type="button"
                      title="Sửa người dùng"
                      onClick={() => setOpenActionUserId((current) => (current === user.id ? null : user.id))}
                      disabled={updatingUserId === user.id}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-[#DDD6EA] bg-white text-[#7C758A] transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      title="Xóa mềm"
                      onClick={() => softDeleteUser(user.id)}
                      disabled={updatingUserId === user.id || user.status === 'locked'}
                      className="inline-flex size-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>

                    {openActionUserId === user.id && (
                      <div className="absolute right-10 top-9 z-20 w-40 overflow-hidden rounded-xl border border-[#DDD6EA] bg-white p-1 text-left shadow-lg shadow-primary/10">
                        <button
                          type="button"
                          onClick={() => {
                            rotateUserRole(user.id);
                            setOpenActionUserId(null);
                          }}
                          disabled={updatingUserId === user.id}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#111827] hover:bg-[#FAFAFC] disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Edit3 size={13} />
                          Đổi vai trò
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            toggleUserLock(user.id);
                            setOpenActionUserId(null);
                          }}
                          disabled={updatingUserId === user.id}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#111827] hover:bg-[#FAFAFC] disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Lock size={13} />
                          {user.status === 'locked' ? 'Mở khóa' : 'Khóa tài khoản'}
                        </button>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TablePanel>
    </section>
  );
}
