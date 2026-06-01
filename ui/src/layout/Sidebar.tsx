import {
  BarChart3,
  Bot,
  BookOpen,
  ChevronDown,
  FileText,
  History,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MessageSquareText,
  Package,
  ShieldCheck,
  Store,
  UploadCloud,
  FolderOpen,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import Logo from '../components/Logo';
import type { AuthUser } from '../api/types';

type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

type NavSection =
  | NavItem
  | {
      label: string;
      icon: ComponentType<{ size?: number; className?: string }>;
      children: NavItem[];
    };

export const NAV_ITEMS = [
  { id: 'home', label: 'Trang chủ', icon: LayoutDashboard },
  {
    label: 'Quản lý cửa hàng',
    icon: Store,
    children: [
      { id: 'shops', label: 'Cửa hàng', icon: Store },
      { id: 'documents', label: 'Hồ sơ / Chứng từ', icon: FolderOpen },
      { id: 'upload', label: 'Tải lên', icon: UploadCloud },
    ],
  },
  {
    label: 'Báo cáo',
    icon: FileText,
    children: [
      { id: 'reports', label: 'Báo cáo tháng', icon: FileText },
      { id: 'yearend', label: 'Hồ sơ cuối năm', icon: Package },
    ],
  },
  { id: 'compliance', label: 'Điểm tuân thủ', icon: ShieldCheck },
  {
    label: 'Lịch sử',
    icon: History,
    children: [
      { id: 'audit', label: 'Nhật ký kiểm toán', icon: ListOrdered },
      { id: 'history', label: 'Lịch sử phiên', icon: History },
    ],
  },
] satisfies NavSection[];

export const ADMIN_NAV_ITEMS = [
  { id: 'adminHome', label: 'Admin Dashboard', icon: LayoutDashboard },
  { id: 'adminUsers', label: 'Quản lý người dùng', icon: Users },
  { id: 'adminRag', label: 'Nội dung Chatbot', icon: BookOpen },
  { id: 'adminFeedback', label: 'Quản lý Feedback', icon: MessageSquareText },
  { id: 'adminStats', label: 'Thống kê người dùng', icon: BarChart3 },
];

const NAV_LABELS: Record<string, string> = {
  home: 'Trang chủ',
  shops: 'Cửa hàng',
  documents: 'Hồ sơ / Chứng từ',
  upload: 'Tải lên',
  reports: 'Báo cáo tháng',
  yearend: 'Hồ sơ cuối năm',
  compliance: 'Điểm tuân thủ',
  audit: 'Nhật ký kiểm toán',
  history: 'Lịch sử phiên',
  adminHome: 'Admin Dashboard',
  adminUsers: 'Quản lý người dùng',
  adminRag: 'Nội dung Chatbot',
  adminFeedback: 'Quản lý Feedback',
  adminStats: 'Thống kê người dùng',
};

function navLabel(item: NavItem) {
  return NAV_LABELS[item.id] ?? item.label;
}

function sectionLabel(section: Extract<NavSection, { children: NavItem[] }>) {
  const childIds = section.children.map((child) => child.id).join(',');
  if (childIds === 'shops,documents,upload') return 'Quản lý cửa hàng';
  if (childIds === 'reports,yearend') return 'Báo cáo';
  if (childIds === 'audit,history') return 'Lịch sử';
  return section.label;
}

interface SidebarProps {
  activeId: string;
  onNavigate: (id: string, search?: string) => void;
  onLogout?: () => void;
  currentUser?: AuthUser | null;
  mobileOpen?: boolean;
  collapsed?: boolean;
}

export default function Sidebar({
  activeId,
  onNavigate,
  onLogout,
  currentUser,
  mobileOpen,
  collapsed = false,
}: SidebarProps) {
  const isAdmin = currentUser?.role === 'admin';
  const navItems: NavSection[] = isAdmin ? ADMIN_NAV_ITEMS : NAV_ITEMS;
  const homeId = isAdmin ? 'adminHome' : 'home';
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [collapsedFlyout, setCollapsedFlyout] = useState<{ label: string; top: number } | null>(null);

  useEffect(() => {
    const openAllSections = () => {
      const nextOpenSections = navItems.reduce<Record<string, boolean>>((acc, item) => {
        if ('children' in item) acc[item.label] = true;
        return acc;
      }, {});
      setOpenSections(nextOpenSections);
      setCollapsedFlyout(null);
    };

    window.addEventListener('scaify.productTour.openSidebar', openAllSections);
    return () => window.removeEventListener('scaify.productTour.openSidebar', openAllSections);
  }, [navItems]);

  const navButton = (item: NavItem, nested = false, showIcon = true) => {
    const Icon = item.icon;
    const isActive = activeId === item.id;
    const label = navLabel(item);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          setCollapsedFlyout(null);
          onNavigate(item.id);
        }}
        title={collapsed ? label : undefined}
        data-product-tour={`sidebar-${item.id}`}
        className={`flex w-full items-center gap-3 rounded-lg py-2.5 text-left font-display text-[13px] tracking-wide transition-all ${
          collapsed ? 'justify-center px-0' : nested ? 'px-3 pl-11' : 'px-3'
        } ${
          isActive
            ? 'border-r-4 border-primary bg-white font-bold text-primary shadow-sm'
            : 'text-outline hover:translate-x-0.5 hover:bg-white hover:text-primary'
        }`}
      >
        {showIcon && <Icon size={18} className={isActive ? 'text-primary' : 'text-outline'} />}
        <span className={collapsed ? 'hidden' : ''}>{label}</span>
      </button>
    );
  };

  const navChildButton = (item: NavItem) => {
    const isActive = activeId === item.id;
    const label = navLabel(item);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          setCollapsedFlyout(null);
          onNavigate(item.id);
        }}
        data-product-tour={`sidebar-${item.id}`}
        className={`block w-full rounded-lg px-3 py-2 text-left font-display text-[13px] transition-colors ${
          isActive
            ? 'bg-primary/10 font-bold text-primary'
            : 'text-outline hover:bg-primary/5 hover:text-primary'
        }`}
      >
        {label}
      </button>
    );
  };

  const openSupportAction = (eventName: string) => {
    setCollapsedFlyout(null);
    window.dispatchEvent(new Event(eventName));
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex -translate-x-full flex-col gap-2 border-r border-outline-variant bg-white/80 py-6 backdrop-blur-lg transition-[transform,width,padding] duration-200 ease-out ${
        collapsed ? 'w-20 px-3 lg:translate-x-0' : 'w-64 px-4 lg:translate-x-0'
      } ${mobileOpen ? 'translate-x-0' : ''}`}
    >
      <div
        className={`mb-6 flex cursor-pointer items-center gap-3 px-2 ${collapsed ? 'justify-center' : ''}`}
        onClick={() => onNavigate(homeId)}
        onKeyDown={(event) => event.key === 'Enter' && onNavigate(homeId)}
        role="button"
        tabIndex={0}
      >
        <Logo className={`${collapsed ? 'h-9 max-w-[44px]' : 'h-10 max-w-[72px]'} w-auto shrink-0`} />
        <div className={`min-w-0 ${collapsed ? 'hidden' : ''}`}>
          <h1 className="font-display text-lg font-black leading-tight tracking-tight text-primary">
            Scaify
          </h1>
          <p className="mt-0.5 font-display whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.1em] text-outline">
            Đối soát & Kiểm soát thuế
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => {
            if ('children' in item) {
              const Icon = item.icon;
              const label = sectionLabel(item);
              const sectionActive = item.children.some((child) => child.id === activeId);
              const isOpen = openSections[item.label] ?? sectionActive;
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      if (collapsed) {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setCollapsedFlyout((current) =>
                          current?.label === item.label ? null : { label: item.label, top: rect.top }
                        );
                        return;
                      }
                      setOpenSections((current) => ({ ...current, [item.label]: !isOpen }));
                    }}
                    title={collapsed ? label : undefined}
                    data-product-tour={item.children.some((child) => child.id === 'shops') ? 'sidebar-shops' : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg py-2.5 text-left font-display text-[13px] tracking-wide transition-all ${
                      collapsed ? 'justify-center px-0' : 'px-3'
                    } ${
                      sectionActive
                        ? 'bg-white font-bold text-primary shadow-sm'
                        : 'text-outline hover:translate-x-0.5 hover:bg-white hover:text-primary'
                    }`}
                  >
                    <Icon size={18} className={sectionActive ? 'text-primary' : 'text-outline'} />
                    <span className={collapsed ? 'hidden' : ''}>{label}</span>
                    {!collapsed && (
                      <ChevronDown
                        size={15}
                        className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>
                  {!collapsed && isOpen && (
                    <div
                      className="ml-5 space-y-1 border-l border-outline-variant/70 pl-1"
                    >
                      {item.children.map((child) => navButton(child, true, false))}
                    </div>
                  )}
                </div>
              );
            }
            return navButton(item);
          })}
        </div>
      </nav>

      {collapsed && collapsedFlyout && (() => {
        const section = navItems.find((item) => 'children' in item && item.label === collapsedFlyout.label);
        if (!section) return null;
        if (!('children' in section)) return null;
        const label = sectionLabel(section);
        return (
          <div
            className="fixed left-20 z-[90] ml-3 w-56 rounded-2xl border border-outline-variant bg-white p-2 shadow-xl shadow-primary/10"
            style={{ top: Math.min(collapsedFlyout.top, window.innerHeight - 220) }}
          >
            <p className="px-3 pb-2 pt-1 font-display text-[11px] font-black uppercase tracking-[0.14em] text-outline">
              {label}
            </p>
            <div className="space-y-1">
              {section.children.map((child) => navChildButton(child))}
            </div>
          </div>
        );
      })()}

      <div className="mt-auto space-y-1 border-t border-outline-variant pt-6">
        {!isAdmin && (
          <button
            type="button"
            onClick={() => openSupportAction('scaify.floatingSupport.openChat')}
            title={collapsed ? 'Kaify Bot' : undefined}
            data-product-tour="sidebar-kaify-bot"
            className={`flex w-full items-center gap-3 rounded-lg py-2 font-display text-[13px] text-outline transition-colors hover:bg-primary/5 hover:text-primary ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <Bot size={18} />
            <span className={collapsed ? 'hidden' : ''}>Kaify Bot</span>
          </button>
        )}
        {!isAdmin && (
          <button
            type="button"
            onClick={() => openSupportAction('scaify.floatingSupport.openFeedback')}
            title={collapsed ? 'Góp ý' : undefined}
            data-product-tour="sidebar-feedback"
            className={`flex w-full items-center gap-3 rounded-lg py-2 font-display text-[13px] text-outline transition-colors hover:bg-primary/5 hover:text-primary ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <MessageSquareText size={18} />
            <span className={collapsed ? 'hidden' : ''}>Góp ý</span>
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Đăng xuất' : undefined}
          className={`flex w-full items-center gap-3 py-2 font-display text-[13px] text-outline transition-colors hover:text-red-500 ${
            collapsed ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <LogOut size={18} />
          <span className={collapsed ? 'hidden' : ''}>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
