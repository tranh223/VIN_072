import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import FloatingActions from '../features/FloatingActions';
import type { AuthUser } from '../api/types';

interface DashboardLayoutProps {
  children: ReactNode;
  activeId: string;
  onNavigate: (id: string, search?: string) => void;
  onLogout?: () => void;
  currentUser?: AuthUser | null;
  onStartProductTour?: (page?: string) => void;
  showProductTourGuide?: boolean;
}

export default function DashboardLayout({
  children,
  activeId,
  onNavigate,
  onLogout,
  currentUser,
  onStartProductTour,
  showProductTourGuide = false,
}: DashboardLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const closeMobile = () => setMobileNavOpen(false);
  const handleNav = (id: string, search?: string) => {
    onNavigate(id, search);
    closeMobile();
  };

  useEffect(() => {
    const openSidebarForTour = () => {
      setSidebarCollapsed(false);
      setMobileNavOpen(true);
    };

    window.addEventListener('scaify.productTour.openSidebar', openSidebarForTour);
    return () => window.removeEventListener('scaify.productTour.openSidebar', openSidebarForTour);
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Dong menu"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={closeMobile}
        />
      )}

      <Sidebar
        activeId={activeId}
        onNavigate={handleNav}
        onLogout={onLogout}
        currentUser={currentUser}
        mobileOpen={mobileNavOpen}
        collapsed={sidebarCollapsed}
      />

      <div
        className={`flex min-h-screen flex-col transition-[margin] duration-200 ease-out ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <TopBar
          currentUser={currentUser}
          activeId={activeId}
          onNavigate={handleNav}
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={() => setMobileNavOpen(true)}
          onSidebarToggle={() => setSidebarCollapsed((value) => !value)}
          onStartProductTour={onStartProductTour}
          showProductTourGuide={showProductTourGuide}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {currentUser?.role !== 'admin' && <FloatingActions currentUser={currentUser} />}

      <div className="pointer-events-none fixed bottom-0 right-0 -z-10 h-1/3 w-1/3 rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none fixed left-0 top-20 -z-10 h-1/4 w-1/4 rounded-full bg-primary/5 blur-[100px] lg:left-64" />
    </div>
  );
}
