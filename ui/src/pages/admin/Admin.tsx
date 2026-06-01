import { motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BarChart3, Bot, MessageSquareText, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
  createAdminRagDocument,
  deleteAdminRagDocument,
  getAdminRagDocuments,
  getAdminUserAnalytics,
  getAdminUserFeedback,
  getAdminUsers,
  getAdminUserStats,
  updateAdminRagDocument,
  updateAdminUser,
  updateAdminUserFeedbackStatus,
} from '../../api/client';
import type { AdminUserAnalyticsResponse, AuthUser, RagDocument, RagDocumentPayload, UserFeedback, UserStatsResponse } from '../../api/types';
import Dashboard from './Dashboard';
import Feedback from './Feedback';
import RagContent from './RagContent';
import Stats from './Stats';
import UsersPage from './Users';
import type { AdminSection, AdminUserRow, GrowthRange } from './types';
import { EMPTY_FORM, buildGrowthData, formatDate, normalizeForm, priorityFromFeedback, userToRow } from './utils';

type AdminProps = {
  currentUser?: AuthUser | null;
  section: AdminSection;
};

const SECTION_META: Record<AdminSection, { title: string; sub: string; icon: typeof Users }> = {
  dashboard: {
    title: 'Xin chào, Admin',
    sub: 'Quản lý toàn bộ người dùng, nội dung chatbot và phản hồi hệ thống.',
    icon: ShieldCheck,
  },
  users: {
    title: 'Quản lý người dùng',
    sub: 'Theo dõi tài khoản, vai trò và trạng thái sử dụng hệ thống',
    icon: Users,
  },
  rag: {
    title: 'Quản lý nội dung Chatbot',
    sub: 'Cập nhật bộ câu hỏi, câu trả lời và nội dung tuân thủ thuế',
    icon: Bot,
  },
  feedback: {
    title: 'Quản lý Feedback',
    sub: 'Theo dõi phản hồi, lỗi chatbot và yêu cầu hỗ trợ từ người dùng',
    icon: MessageSquareText,
  },
  stats: {
    title: 'Thống kê người dùng',
    sub: 'Phân tích hành vi sử dụng, lượt truy cập và mức độ tương tác',
    icon: BarChart3,
  },
};

export type { AdminSection };

export default function Admin({ currentUser, section }: AdminProps) {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [analytics, setAnalytics] = useState<AdminUserAnalyticsResponse | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState('all');
  const [contentTab, setContentTab] = useState('Tất cả');
  const [userQuery, setUserQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [feedbackQuery, setFeedbackQuery] = useState('');
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [growthRange, setGrowthRange] = useState<GrowthRange>('day');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RagDocumentPayload>(EMPTY_FORM);

  const isAdmin = currentUser?.role === 'admin';
  const adminId = currentUser?.id ?? '';
  const meta = SECTION_META[section];
  const Icon = meta.icon;

  const loadData = () => {
    if (!isAdmin || !adminId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    Promise.all([
      getAdminRagDocuments(adminId).then((data) => setDocuments(data.documents)).catch(() => setDocuments([])),
      getAdminUsers(adminId).then((data) => setUsers(data.users.map(userToRow))).catch(() => setUsers([])),
      getAdminUserFeedback(adminId, feedbackStatus).then((data) => setFeedback(data.feedback)).catch(() => setFeedback([])),
      getAdminUserStats(adminId).then((data) => setStats(data)).catch(() => setStats(null)),
      getAdminUserAnalytics(adminId).then((data) => setAnalytics(data)).catch(() => setAnalytics(null)),
    ])
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, [adminId, feedbackStatus, isAdmin]);

  useEffect(() => {
    if (!error && !notice) return undefined;
    const timer = window.setTimeout(() => {
      setError(null);
      setNotice(null);
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  const totals = useMemo(() => {
    const totalUsers = stats?.totals.total_users ?? users.length;
    const activeUsers = stats?.totals.active_users ?? users.filter((user) => user.status === 'active').length;
    const lockedUsers = users.filter((user) => user.status === 'locked').length;
    const now = new Date();
    const newThisMonth = users.filter((user) => {
      if (!user.createdAt) return false;
      const date = new Date(user.createdAt);
      return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    const pendingContent = documents.filter((doc) => doc.status === 'draft').length;
    const activeContent = documents.filter((doc) => doc.status === 'active').length;
    const newFeedback = feedback.filter((item) => item.status === 'new').length;
    const processingFeedback = feedback.filter((item) => item.status === 'reviewed').length;
    const resolvedFeedback = feedback.filter((item) => item.status === 'resolved' || item.status === 'archived').length;
    return {
      totalUsers,
      activeUsers,
      lockedUsers,
      newThisMonth,
      totalContent: stats?.totals.rag_documents ?? documents.length,
      activeContent,
      pendingContent,
      lastUpdated: documents[0]?.updated_at ? formatDate(documents[0].updated_at) : 'Hôm nay',
      totalFeedback: stats?.totals.feedback ?? feedback.length,
      newFeedback,
      processingFeedback,
      resolvedFeedback,
    };
  }, [documents, feedback, stats, users]);

  const filteredUsers = useMemo(() => {
    const roleRank: Record<string, number> = { admin: 0, user: 1 };
    return users
      .filter((user) => {
        const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(userQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesStatus = userStatusFilter === 'all' || user.status === userStatusFilter;
        return matchesQuery && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        const byRole = (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9);
        if (byRole !== 0) return byRole;
        return a.name.localeCompare(b.name, 'vi');
      });
  }, [roleFilter, userQuery, userStatusFilter, users]);

  const filteredDocuments = documents.filter((doc) => {
    if (contentTab === 'Tất cả') return true;
    const type = doc.document_type.toLowerCase();
    if (contentTab === 'FAQ') return type.includes('faq');
    if (contentTab === 'Luật thuế') return type.includes('law') || type.includes('thuế');
    if (contentTab === 'Kịch bản trả lời') return type.includes('script') || type.includes('kịch bản');
    if (contentTab === 'Từ khóa bị chặn') return type.includes('blocked') || type.includes('từ khóa');
    return true;
  });

  const filteredFeedback = feedback.filter((item) => {
    const matchesQuery = `${item.user_name ?? ''} ${item.user_email ?? ''} ${item.comment ?? ''}`.toLowerCase().includes(feedbackQuery.toLowerCase());
    const matchesType = feedbackTypeFilter === 'all' || item.feedback_type === feedbackTypeFilter;
    const matchesStatus = feedbackStatus === 'all' || item.status === feedbackStatus;
    const matchesPriority = priorityFilter === 'all' || priorityFromFeedback(item) === priorityFilter;
    return matchesQuery && matchesType && matchesStatus && matchesPriority;
  });

  const recentAdminActivity = useMemo(
    () =>
      [
        ...documents.map((doc) => ({
          id: `doc-${doc.id}`,
          title: doc.title,
          type: doc.document_type,
          time: doc.updated_at || doc.created_at || null,
        })),
        ...feedback.map((item) => ({
          id: `feedback-${item.id}`,
          title: item.comment || item.feedback_type || 'Feedback',
          type: item.status,
          time: item.updated_at || item.created_at || null,
        })),
      ]
        .filter((item) => item.time)
        .sort((a, b) => new Date(b.time ?? '').getTime() - new Date(a.time ?? '').getTime())
        .slice(0, 4),
    [documents, feedback]
  );

  const growthData = useMemo(
    () => buildGrowthData(users, analytics, growthRange),
    [analytics, growthRange, users]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submitDocument = (event: FormEvent) => {
    event.preventDefault();
    if (!adminId || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = normalizeForm(form);
    const request = editingId
      ? updateAdminRagDocument(adminId, editingId, payload)
      : createAdminRagDocument(adminId, payload);
    request
      .then(({ document }) => {
        setDocuments((prev) => {
          if (!editingId) return [document, ...prev];
          return prev.map((item) => (item.id === document.id ? document : item));
        });
        window.dispatchEvent(new Event('scaify.admin.notifications.refresh'));
        setNotice(editingId ? 'Đã cập nhật nội dung chatbot.' : 'Đã thêm nội dung chatbot.');
        resetForm();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const removeDocument = (documentId: string) => {
    if (!adminId) return;
    const target = documents.find((item) => item.id === documentId);
    setSaving(true);
    setError(null);
    setNotice(null);
    deleteAdminRagDocument(adminId, documentId)
      .then(() => getAdminRagDocuments(adminId))
      .then((data) => {
        if (data.documents.some((item) => item.id === documentId)) {
          throw new Error('Chưa xác nhận được nội dung đã bị xóa khỏi MongoDB.');
        }
        setDocuments(data.documents);
        window.dispatchEvent(new Event('scaify.admin.notifications.refresh'));
        setNotice(`Đã xóa hẳn "${target?.title ?? 'nội dung'}" khỏi MongoDB.`);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setSaving(false));
  };

  const changeFeedbackStatus = (feedbackId: string, nextStatus: 'new' | 'reviewed' | 'resolved' | 'archived') => {
    if (!adminId) return;
    updateAdminUserFeedbackStatus(adminId, feedbackId, nextStatus)
      .then(({ feedback: updated }) => {
        setFeedback((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      })
      .catch((err: Error) => setError(err.message));
  };

  const updateUser = (userId: string, payload: { role?: 'admin' | 'user'; status?: 'active' | 'inactive' | 'locked' | 'pending' }) => {
    setUpdatingUserId(userId);
    setError(null);
    setNotice(null);
    updateAdminUser(adminId, userId, payload)
      .then(({ user }) => {
        setUsers((prev) => prev.map((item) => (item.id === user.id ? userToRow(user) : item)));
        return getAdminUserStats(adminId).then(setStats);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUpdatingUserId(null));
  };

  const toggleUserLock = (userId: string) => {
    const user = users.find((item) => item.id === userId);
    if (!adminId || !user || updatingUserId) return;
    updateUser(userId, { status: user.status === 'locked' ? 'active' : 'locked' });
  };

  const rotateUserRole = (userId: string) => {
    const user = users.find((item) => item.id === userId);
    if (!adminId || !user || updatingUserId) return;
    const nextRole: 'user' | 'admin' = user.role === 'admin' ? 'user' : 'admin';
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn đổi vai trò của "${user.name}" thành ${nextRole === 'admin' ? 'Admin' : 'Người dùng'} không?`
    );
    if (!confirmed) return;
    updateUser(userId, { role: nextRole });
  };

  const softDeleteUser = (userId: string) => {
    if (!adminId || updatingUserId) return;
    updateUser(userId, { status: 'locked' });
  };

  const renderSection = () => {
    switch (section) {
      case 'dashboard':
        return (
          <Dashboard
            totals={totals}
            feedback={feedback}
            documents={documents}
            recentAdminActivity={recentAdminActivity}
            growthData={growthData}
            growthRange={growthRange}
            setGrowthRange={setGrowthRange}
          />
        );
      case 'users':
        return (
          <UsersPage
            totals={totals}
            users={filteredUsers}
            userQuery={userQuery}
            setUserQuery={setUserQuery}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            userStatusFilter={userStatusFilter}
            setUserStatusFilter={setUserStatusFilter}
            updatingUserId={updatingUserId}
            toggleUserLock={toggleUserLock}
            rotateUserRole={rotateUserRole}
            softDeleteUser={softDeleteUser}
            loading={loading}
          />
        );
      case 'rag':
        return (
          <RagContent
            totals={totals}
            contentTab={contentTab}
            setContentTab={setContentTab}
            form={form}
            setForm={setForm}
            editingId={editingId}
            resetForm={resetForm}
            submitDocument={submitDocument}
            saving={saving}
            loading={loading}
            documents={filteredDocuments}
            setEditingId={setEditingId}
            removeDocument={removeDocument}
          />
        );
      case 'feedback':
        return (
          <Feedback
            totals={totals}
            feedback={filteredFeedback}
            feedbackQuery={feedbackQuery}
            setFeedbackQuery={setFeedbackQuery}
            feedbackTypeFilter={feedbackTypeFilter}
            setFeedbackTypeFilter={setFeedbackTypeFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            feedbackStatus={feedbackStatus}
            setFeedbackStatus={setFeedbackStatus}
            loading={loading}
            changeFeedbackStatus={changeFeedbackStatus}
          />
        );
      case 'stats':
        return (
          <Stats
            totals={totals}
            analytics={analytics}
            stats={stats}
            users={users}
            growthData={growthData}
            growthRange={growthRange}
            setGrowthRange={setGrowthRange}
          />
        );
      default:
        return null;
    }
  };

  if (!isAdmin) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 bg-[#FAFAFC]">
      <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={18} />
          </div>
          <div>
            <h1 className="font-display text-xl font-black text-[#111827] sm:text-2xl">{meta.title}</h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-[#7C758A] sm:text-sm">{meta.sub}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} /> Làm mới
        </Button>
      </header>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}

      {renderSection()}
    </motion.div>
  );
}
