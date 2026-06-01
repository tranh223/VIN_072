import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BookOpen, ChevronRight, Info, Menu, MessageSquareText, Search, Settings, Sparkles, UserPlus, X } from 'lucide-react';
import { Input } from '../components/ui/Input';
import {
  createNotification,
  getAdminRagDocuments,
  getAdminUserFeedback,
  getAdminUsers,
  getNotifications,
  markNotificationsRead,
  resolvePublicFileUrl,
} from '../api/client';
import type { AdminUser, AuthUser, NotificationItem, RagDocument, UserFeedback } from '../api/types';
import { USER_NOTIFICATION_EVENT, type UserNotificationType } from '../utils/notifications';

type AdminNotification = {
  id: string;
  title: string;
  detail: string;
  time: string;
  icon: 'feedback' | 'user' | 'rag';
};

type UserNotification = {
  id: string;
  title: string;
  detail: string;
  time: string;
  type: UserNotificationType;
  read: boolean;
};

const ADMIN_NOTIFICATION_EVENT = 'scaify.admin.notifications.refresh';

const PRODUCT_UPDATES = [
  {
    tag: 'Mới',
    tagColor: 'bg-primary text-white',
    date: '05/2026',
    title: 'Kho Hồ sơ / Chứng từ: gom file theo kỳ, shop và loại chứng từ sau upload',
  },
  {
    tag: 'Trọng tâm',
    tagColor: 'bg-sky-100 text-sky-800',
    date: '05/2026',
    title: 'Đối soát CSV doanh thu với chứng cứ (ảnh/PDF) — hỗ trợ chuẩn bị hồ sơ, không thay kê khai chính thức',
  },
  {
    tag: 'Quy trình',
    tagColor: 'bg-emerald-100 text-emerald-700',
    date: '05/2026',
    title: 'Chọn shop → chọn kỳ & loại phiên upload → theo dõi phiên tại Lịch sử và sức khỏe hồ sơ',
  },
];

function notificationTime(value?: string | null): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function buildAdminNotifications(
  feedback: UserFeedback[],
  users: AdminUser[],
  documents: RagDocument[]
): AdminNotification[] {
  return [
    ...[...feedback].sort((a, b) => notificationTime(b.created_at || b.updated_at) - notificationTime(a.created_at || a.updated_at)).slice(0, 6).map((item) => ({
      id: `feedback-${item.id}`,
      title: `Feedback mới từ ${item.user_name || 'người dùng'}`,
      detail: item.comment || item.feedback_type || 'Không có nội dung',
      time: item.created_at || item.updated_at || new Date().toISOString(),
      icon: 'feedback' as const,
    })),
    ...[...users].sort((a, b) => notificationTime(b.created_at || b.updated_at) - notificationTime(a.created_at || a.updated_at)).slice(0, 6).map((user) => ({
      id: `user-${user.id}`,
      title: `Người dùng mới: ${user.full_name || user.email || 'Chưa có tên'}`,
      detail: user.email || user.role || 'Tài khoản mới được tạo',
      time: user.created_at || user.updated_at || new Date().toISOString(),
      icon: 'user' as const,
    })),
    ...[...documents].sort((a, b) => notificationTime(b.updated_at || b.created_at) - notificationTime(a.updated_at || a.created_at)).slice(0, 6).map((doc) => ({
      id: `rag-${doc.id}`,
      title: 'Cập nhật nội dung chatbot thành công',
      detail: doc.title,
      time: doc.updated_at || doc.created_at || new Date().toISOString(),
      icon: 'rag' as const,
    })),
  ]
    .sort((a, b) => notificationTime(b.time) - notificationTime(a.time))
    .slice(0, 10);
}

function mapApiNotification(item: NotificationItem): UserNotification {
  return {
    id: item.id,
    title: item.title,
    detail: item.detail,
    time: item.created_at || new Date().toISOString(),
    type: (item.type as UserNotificationType) || 'system',
    read: item.read,
  };
}

function userAvatarUrl(user?: AuthUser | null): string {
  const storedAvatar = resolvePublicFileUrl(user?.url_avt);
  if (storedAvatar) return storedAvatar;
  const seed = encodeURIComponent(user?.email || user?.full_name || 'scaify-user');
  return `https://api.dicebear.com/8.x/initials/svg?seed=${seed}&backgroundColor=6236c2,7c3aed,0ea5e9`;
}

interface TopBarProps {
  onMenuClick?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
  currentUser?: AuthUser | null;
  activeId?: string;
  onNavigate?: (id: string, search?: string) => void;
  onStartProductTour?: (page?: string) => void;
  showProductTourGuide?: boolean;
}

export default function TopBar({
  onMenuClick,
  onSidebarToggle,
  sidebarCollapsed = false,
  currentUser,
  activeId = 'home',
  onNavigate,
  onStartProductTour,
  showProductTourGuide = false,
}: TopBarProps) {
  const isAdmin = currentUser?.role === 'admin';
  const notificationStorageKey = `scaify.admin.notifications.read.${currentUser?.id ?? 'anonymous'}`;
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [supportInfoOpen, setSupportInfoOpen] = useState(false);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const sentClientNotificationKeys = useRef<Set<string>>(new Set());
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(notificationStorageKey) || '[]') as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      setReadNotificationIds(JSON.parse(localStorage.getItem(notificationStorageKey) || '[]') as string[]);
    } catch {
      setReadNotificationIds([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (isAdmin || !currentUser?.id) {
      setUserNotifications([]);
      return;
    }
    let alive = true;
    setUserNotifications([]);
    const loadUserNotifications = () => {
      getNotifications(currentUser.id)
        .then((data) => {
          if (alive) setUserNotifications(data.notifications.map(mapApiNotification));
        })
        .catch(() => {
          if (alive) setUserNotifications([]);
        });
    };
    loadUserNotifications();
    const interval = window.setInterval(loadUserNotifications, 60000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [currentUser?.id, isAdmin]);

  useEffect(() => {
    if (isAdmin || !currentUser?.id) return;
    const onUserNotification = (event: Event) => {
      const detail = (event as CustomEvent<Partial<UserNotification>>).detail ?? {};
      const nextItem: UserNotification = {
        id: detail.id || `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: detail.title || 'Thông báo mới',
        detail: detail.detail || '',
        time: detail.time || new Date().toISOString(),
        type: detail.type || 'system',
        read: false,
      };
      const dedupeKey = detail.id || `${nextItem.type}:${nextItem.title}:${nextItem.detail}`;
      if (sentClientNotificationKeys.current.has(dedupeKey)) return;
      sentClientNotificationKeys.current.add(dedupeKey);
      createNotification({
        user_id: currentUser.id,
        title: nextItem.title,
        detail: nextItem.detail,
        type: nextItem.type,
        source: 'client_event',
      })
        .then(({ notification }) => {
          setUserNotifications((current) => {
            const next = mapApiNotification(notification);
            return [next, ...current.filter((item) => item.id !== next.id)].slice(0, 30);
          });
        })
        .catch(() => undefined);
    };
    window.addEventListener(USER_NOTIFICATION_EVENT, onUserNotification);
    return () => window.removeEventListener(USER_NOTIFICATION_EVENT, onUserNotification);
  }, [currentUser?.id, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !currentUser?.id) {
      setNotifications([]);
      return;
    }

    let alive = true;
    const loadNotifications = () => {
      Promise.all([
        getAdminUserFeedback(currentUser.id, 'all').then((data) => data.feedback).catch(() => []),
        getAdminUsers(currentUser.id).then((data) => data.users).catch(() => []),
        getAdminRagDocuments(currentUser.id).then((data) => data.documents).catch(() => []),
      ]).then(([feedback, users, documents]) => {
        if (!alive) return;
        setNotifications(buildAdminNotifications(feedback, users, documents));
      });
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    window.addEventListener(ADMIN_NOTIFICATION_EVENT, loadNotifications);
    return () => {
      alive = false;
      window.clearInterval(interval);
      window.removeEventListener(ADMIN_NOTIFICATION_EVENT, loadNotifications);
    };
  }, [currentUser?.id, isAdmin]);

  useEffect(() => {
    const openSupportInfo = () => setSupportInfoOpen(true);
    window.addEventListener('scaify.supportInfo.open', openSupportInfo);
    return () => window.removeEventListener('scaify.supportInfo.open', openSupportInfo);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readNotificationIds.includes(item.id)).length,
    [notifications, readNotificationIds]
  );
  const userUnreadCount = useMemo(
    () => userNotifications.filter((item) => !item.read).length,
    [userNotifications]
  );

  const openNotifications = () => {
    setNotificationsOpen((value) => {
      const nextOpen = !value;
      if (nextOpen && !isAdmin) {
        setUserNotifications((current) => {
          const next = current.map((item) => ({ ...item, read: true }));
          if (currentUser?.id) void markNotificationsRead(currentUser.id, { all: true }).catch(() => undefined);
          return next;
        });
      }
      return nextOpen;
    });
  };

  const markNotificationRead = (id: string) => {
    if (readNotificationIds.includes(id)) return;
    const nextIds = [...readNotificationIds, id];
    setReadNotificationIds(nextIds);
    try {
      localStorage.setItem(notificationStorageKey, JSON.stringify(nextIds));
    } catch {
      // Ignore localStorage failures in private browsing.
    }
  };

  const NotificationIcon = ({ type }: { type: AdminNotification['icon'] }) => {
    if (type === 'feedback') return <MessageSquareText className="size-4" />;
    if (type === 'user') return <UserPlus className="size-4" />;
    return <BookOpen className="size-4" />;
  };

  const supportInfoContent = (
    <>
      {showProductTourGuide && onStartProductTour && (
        <button
          type="button"
          data-product-tour="support-guide-button"
          onClick={() => {
            setSupportInfoOpen(false);
            onStartProductTour(activeId);
          }}
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-left font-display text-sm font-bold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-container"
        >
          <span>Hướng dẫn</span>
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/5 to-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles size={18} />
          </div>
          <h3 className="font-display text-sm font-bold text-on-surface">Gợi ý từ Scaify</h3>
        </div>
        <div className="space-y-2.5 text-[11px] leading-relaxed text-on-surface">
          <p>
            <span className="font-bold text-primary">File đã xác nhận</span> là chứng từ đã vào kho với trạng thái phù
            hợp; <span className="font-bold text-primary">cần xem lại</span> gồm mục thiếu thông tin hoặc cần kiểm tra.
          </p>
          <p>
            Checklist lấy từ tổng hợp năm (API); có thể mở Chi tiết checklist để xem trang Chuẩn bị hồ sơ cuối năm.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-on-surface">Scaify Update</h3>
          <ChevronRight size={14} className="text-outline" />
        </div>
        <div className="space-y-3">
          {PRODUCT_UPDATES.map((u) => (
            <div key={u.title} className="rounded-xl p-2">
              <div className="mb-1 flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${u.tagColor}`}>{u.tag}</span>
                <span className="text-[10px] text-outline">{u.date}</span>
              </div>
              <p className="text-xs font-semibold leading-snug text-on-surface">{u.title}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-on-surface">Đi nhanh</h3>
          <ChevronRight size={14} className="text-outline" />
        </div>
        <div className="space-y-2">
          {[
            { title: 'Hồ sơ / Chứng từ', sub: 'Kho file theo kỳ và shop', page: 'documents' as const },
            { title: 'Tải dữ liệu', sub: 'CSV, chứng cứ, chọn ngữ cảnh kỳ', page: 'upload' as const },
            { title: 'Lịch sử phiên', sub: 'Theo dõi job đã xử lý', page: 'history' as const },
          ].map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => {
                setSupportInfoOpen(false);
                onNavigate?.(item.page);
              }}
              className="block w-full rounded-xl border border-transparent p-2.5 text-left transition-colors hover:border-primary/25 hover:bg-primary/5"
            >
              <p className="text-xs font-semibold text-on-surface">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-outline">{item.sub}</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
    <header className="sticky top-0 z-30 flex w-full items-center justify-between gap-3 border-b border-outline-variant bg-white/80 px-3 py-3 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="shrink-0 rounded-lg p-2 text-outline hover:bg-surface lg:hidden"
          aria-label="Mở menu"
        >
          <Menu className="size-5" />
        </button>
        <button
          type="button"
          onClick={onSidebarToggle}
          className={`hidden shrink-0 rounded-lg p-2 text-outline transition-all duration-300 ease-out hover:bg-surface hover:text-primary active:scale-95 lg:inline-flex ${
            sidebarCollapsed ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10' : ''
          }`}
          aria-label={sidebarCollapsed ? 'Hiện sidebar' : 'Ẩn sidebar'}
          title={sidebarCollapsed ? 'Hiện sidebar' : 'Ẩn sidebar'}
        >
          <Menu className={`size-5 transition-transform duration-300 ease-out ${sidebarCollapsed ? 'rotate-180 scale-95' : 'rotate-0 scale-100'}`} />
        </button>
        <div className="hidden min-w-0 flex-1 sm:block sm:max-w-md lg:max-w-sm xl:max-w-md">
          <Input
            type="search"
            placeholder="Tìm kiếm (sắp có)…"
            leftIcon={<Search />}
            disabled
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {!isAdmin && (
          <button
            type="button"
            className="rounded-full p-2 text-outline transition-colors hover:bg-surface hover:text-primary"
            title="Thông tin phụ trợ cho hồ sơ"
            aria-label="Mở thông tin phụ trợ cho hồ sơ"
            onClick={() => setSupportInfoOpen(true)}
            data-product-tour="topbar-support"
          >
            <Info className="size-5" />
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            className={`relative rounded-full p-2 text-outline transition-colors hover:bg-surface hover:text-primary ${
              notificationsOpen ? 'bg-primary/10 text-primary' : ''
            }`}
            title="Thông báo"
            onClick={openNotifications}
            data-product-tour="topbar-notifications"
          >
            <Bell className="size-5" />
            {((isAdmin && unreadCount > 0) || (!isAdmin && userUnreadCount > 0)) && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-4 text-white">
                {(isAdmin ? unreadCount : userUnreadCount) > 9 ? '9+' : isAdmin ? unreadCount : userUnreadCount}
              </span>
            )}
          </button>
          {isAdmin && notificationsOpen && (
            <div className="absolute right-0 top-11 z-50 w-[320px] overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-xl shadow-primary/10">
              <div className="flex items-center justify-between border-b border-outline-variant bg-slate-50 px-4 py-3">
                <p className="text-sm font-black text-on-surface">Thông báo</p>
                <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{notifications.length} mục</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-2">
                {notifications.length ? (
                  notifications.map((item) => {
                    const isUnread = !readNotificationIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => markNotificationRead(item.id)}
                        className={`flex w-full gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50 ${
                          isUnread ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <NotificationIcon type={item.icon} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-red-500" />}
                            <p className="line-clamp-1 text-xs font-bold text-on-surface">{item.title}</p>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-outline">{item.detail}</p>
                          <p className="mt-1 text-[10px] font-medium text-outline/80">
                            {formatNotificationTime(item.time)} · {isUnread ? 'Chưa đọc' : 'Đã đọc'}
                          </p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-xs font-medium text-outline">Chưa có thông báo mới.</div>
                )}
              </div>
            </div>
          )}
          {!isAdmin && notificationsOpen && (
            <div className="absolute right-0 top-11 z-50 w-[320px] overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-xl shadow-primary/10">
              <div className="flex items-center justify-between border-b border-outline-variant bg-slate-50 px-4 py-3">
                <p className="text-sm font-black text-on-surface">Thông báo</p>
                <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{userNotifications.length} mục</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-2">
                {userNotifications.length ? (
                  userNotifications.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {item.type === 'chatbot' || item.type === 'feedback' ? (
                          <MessageSquareText className="size-4" />
                        ) : item.type === 'alert' ? (
                          <Bell className="size-4" />
                        ) : item.type === 'settings' ? (
                          <Settings className="size-4" />
                        ) : (
                          <BookOpen className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {!item.read && <span className="size-1.5 shrink-0 rounded-full bg-red-500" />}
                          <p className="line-clamp-1 text-xs font-bold text-on-surface">{item.title}</p>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-outline">{item.detail}</p>
                        <p className="mt-1 text-[10px] font-medium text-outline/80">{formatNotificationTime(item.time)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-xs font-medium text-outline">Chưa có thông báo mới.</div>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="hidden rounded-full p-2 text-outline transition-colors hover:bg-surface sm:block"
          title="Cài đặt"
          onClick={() => onNavigate?.('settings')}
          data-product-tour="topbar-settings"
        >
          <Settings className="size-5" />
        </button>
        <div className="mx-1 hidden h-8 w-px bg-outline-variant sm:block" />
        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-bold text-on-surface">
              {currentUser?.full_name ?? 'Người dùng'}
            </p>
            <p className="text-[10px] text-outline">
              {currentUser?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
            </p>
          </div>
          <div className="size-8 shrink-0 overflow-hidden rounded-full border border-outline-variant">
            <img
              src={userAvatarUrl(currentUser)}
              alt=""
              className="size-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
    <AnimatePresence>
      {supportInfoOpen && (
        <div className="fixed inset-0 z-40">
          <motion.button
            type="button"
            className="absolute inset-0 bg-white/45 backdrop-blur-[2px]"
            aria-label="Đóng thông tin phụ trợ"
            onClick={() => setSupportInfoOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
          <motion.aside
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-outline-variant bg-white p-5 shadow-2xl sm:p-6"
            initial={{ x: 32, opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 32, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-outline-variant pb-4">
              <div>
                <p className="font-display text-lg font-bold text-primary">Thông tin phụ trợ cho hồ sơ</p>
                <p className="mt-1 text-sm text-outline">Gợi ý, cập nhật và lối tắt thao tác hồ sơ.</p>
              </div>
              <button
                type="button"
                onClick={() => setSupportInfoOpen(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface hover:text-primary"
                aria-label="Đóng"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto">{supportInfoContent}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
