import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Login from './pages/login/Login';
import Register from './pages/login/Register';
import ForgotPassword from './pages/login/ForgotPassword';
import ResetPassword from './pages/login/ResetPassword';
import DashboardLayout from './layout/DashboardLayout';
import PublicLayout from './layout/PublicLayout';
import LandingPage from './pages/public/LandingPage';
import NewsPage from './pages/public/NewsPage';
import AboutPage from './pages/public/AboutPage';
import ProductTour, { markProductTourDismissed, shouldAutoOpenProductTour } from './components/ProductTour';
import { getJobs, getStores } from './api/client';

import Home from './pages/user/Home';
import Shops from './pages/user/Shops';
import Upload from './pages/user/Upload';
import History from './pages/user/History';
import Compliance from './pages/user/Compliance';
import Audit from './pages/user/Audit';
import MonthlyReport from './pages/user/MonthlyReport';
import YearEnd from './pages/user/YearEnd';
import Settings from './pages/user/Settings';
import Admin from './pages/admin/Admin';
import Documents from './pages/Documents';
import type { AuthUser } from './api/types';

const AUTH_USER_KEY = 'scaify.auth.user';
const ACTIVE_PAGE_KEY = 'scaify.dashboard.activePage';
const CHAT_HISTORY_PREFIX = 'scaify.chat.history.';
const USER_PAGE_IDS = new Set([
  'home',
  'shops',
  'upload',
  'documents',
  'history',
  'compliance',
  'reports',
  'audit',
  'yearend',
  'settings',
]);
const ADMIN_PAGE_IDS = new Set(['adminHome', 'adminUsers', 'adminRag', 'adminFeedback', 'adminStats', 'settings']);
const DASHBOARD_PAGE_IDS = new Set([...USER_PAGE_IDS, ...ADMIN_PAGE_IDS]);
const PAGE_ID_TO_SLUG: Record<string, string> = {
  home: 'Home',
  shops: 'Shops',
  upload: 'Upload',
  documents: 'Documents',
  history: 'History',
  compliance: 'Compliance',
  reports: 'Reports',
  audit: 'Audit',
  yearend: 'YearEnd',
  settings: 'Settings',
  adminHome: 'AdminDashboard',
  adminUsers: 'UserManagement',
  adminRag: 'ChatbotContent',
  adminFeedback: 'FeedbackManagement',
  adminStats: 'UserStats',
};
const PAGE_SLUG_TO_ID = Object.fromEntries(
  Object.entries(PAGE_ID_TO_SLUG).map(([id, slug]) => [slug.toLowerCase(), id])
) as Record<string, string>;

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

function readStoredPage(): string {
  try {
    const page = localStorage.getItem(ACTIVE_PAGE_KEY);
    return page && DASHBOARD_PAGE_IDS.has(page) ? page : 'home';
  } catch {
    return 'home';
  }
}

function clearChatHistoryStorage(userId?: string | null) {
  const exactKey = userId ? `${CHAT_HISTORY_PREFIX}${userId}` : null;
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith(CHAT_HISTORY_PREFIX) || key === exactKey) {
      sessionStorage.removeItem(key);
    }
  });
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  const [activePage, setActivePage] = useState(() => readStoredPage());
  const isLoggedIn = Boolean(currentUser);
  const location = useLocation();
  const navigate = useNavigate();

  const [showProductTour, setShowProductTour] = useState(false);
  const [tourPage, setTourPage] = useState('home');
  const [tourMode, setTourMode] = useState<'page' | 'menu'>('page');
  const [accountActivity, setAccountActivity] = useState<'checking' | 'empty' | 'active'>('checking');
  const [newRegistrationTourEnabled, setNewRegistrationTourEnabled] = useState(false);
  const isAdmin = currentUser?.role === 'admin';
  const defaultPage = isAdmin ? 'adminHome' : 'home';
  const dashboardSlugMatch = location.pathname.match(/^\/app\/([^/]+)/i);
  const dashboardPageFromPath = dashboardSlugMatch
    ? PAGE_SLUG_TO_ID[decodeURIComponent(dashboardSlugMatch[1]).toLowerCase()]
    : null;
  const displayedPage = dashboardPageFromPath ?? activePage;

  useEffect(() => {
    localStorage.setItem(ACTIVE_PAGE_KEY, activePage);
  }, [activePage]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [location.pathname]);

  useEffect(() => {
    if (dashboardPageFromPath && dashboardPageFromPath !== activePage) {
      setActivePage(dashboardPageFromPath);
    }
  }, [activePage, dashboardPageFromPath]);

  const startProductTour = (page = displayedPage, mode: 'page' | 'menu' = 'page') => {
    setTourPage(page);
    setTourMode(mode);
    setShowProductTour(true);
  };

  useEffect(() => {
    if (!currentUser?.id || isAdmin) {
      setAccountActivity('active');
      return;
    }

    let cancelled = false;
    setAccountActivity('checking');
    Promise.all([getStores(currentUser.id), getJobs(currentUser.id)])
      .then(([storesResponse, jobsResponse]) => {
        if (cancelled) return;
        const hasStores = (storesResponse.stores?.length ?? 0) > 0;
        const hasJobs = (jobsResponse.jobs?.length ?? 0) > 0;
        setAccountActivity(hasStores || hasJobs ? 'active' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setAccountActivity('active');
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, isAdmin]);

  useEffect(() => {
    if (isAdmin || showProductTour || !currentUser?.id) return;
    if (!newRegistrationTourEnabled) return;
    if (accountActivity !== 'empty') return;
    if (!shouldAutoOpenProductTour(currentUser.id)) return;
    setTourPage('home');
    setTourMode('page');
    setShowProductTour(true);
  }, [accountActivity, currentUser?.id, isAdmin, newRegistrationTourEnabled, showProductTour]);

  const dashboardPath = (page: string) => `/app/${PAGE_ID_TO_SLUG[page] ?? PAGE_ID_TO_SLUG.home}`;
  const defaultDashboardPath = () => dashboardPath(defaultPage);

  const handleLogin = (user: AuthUser) => {
    const nextPage = user.role === 'admin' ? 'adminHome' : 'home';
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(ACTIVE_PAGE_KEY, nextPage);
    setNewRegistrationTourEnabled(false);
    setCurrentUser(user);
    setActivePage(nextPage);
    navigate(dashboardPath(nextPage));
  };

  const handleRegistered = (user: AuthUser) => {
    const nextPage = user.role === 'admin' ? 'adminHome' : 'home';
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(ACTIVE_PAGE_KEY, nextPage);
    setNewRegistrationTourEnabled(user.role !== 'admin');
    setCurrentUser(user);
    setActivePage(nextPage);
    navigate(dashboardPath(nextPage));
  };

  const handleUserUpdated = (user: AuthUser) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    clearChatHistoryStorage(currentUser?.id ?? null);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(ACTIVE_PAGE_KEY);
    setCurrentUser(null);
    setActivePage('home');
    setShowProductTour(false);
    setAccountActivity('checking');
    setNewRegistrationTourEnabled(false);
    navigate('/intro');
  };

  const handleDashboardNavigate = (page: string, search?: string) => {
    if (!DASHBOARD_PAGE_IDS.has(page)) return;
    if (isAdmin && !ADMIN_PAGE_IDS.has(page)) return;
    if (!isAdmin && !USER_PAGE_IDS.has(page)) return;
    const shouldStartPageTour =
      newRegistrationTourEnabled && !isAdmin && accountActivity === 'empty' && page !== activePage && !showProductTour;
    setActivePage(page);
    const path = dashboardPath(page);
    const q = search?.replace(/^\?/, '').trim();
    navigate(q ? `${path}?${q}` : path);
    if (shouldStartPageTour) {
      window.setTimeout(() => {
        setTourPage(page);
        setTourMode('page');
        setShowProductTour(true);
      }, 240);
    }
  };

  const renderDashboardContent = () => {
    switch (displayedPage) {
      case 'home':
        return (
          <Home
            onNavigate={handleDashboardNavigate}
            currentUser={currentUser}
            onStartProductTour={() => startProductTour('home')}
          />
        );
      case 'shops':
        return <Shops currentUser={currentUser} onNavigate={handleDashboardNavigate} />;
      case 'upload':
        return <Upload currentUser={currentUser} onNavigate={handleDashboardNavigate} />;
      case 'documents':
        return <Documents currentUser={currentUser} onNavigate={handleDashboardNavigate} />;
      case 'history':
        return <History currentUser={currentUser} onNavigate={handleDashboardNavigate} />;
      case 'compliance':
        return <Compliance currentUser={currentUser} onNavigate={handleDashboardNavigate} />;
      case 'reports':
        return <MonthlyReport currentUser={currentUser} />;
      case 'audit':
        return <Audit currentUser={currentUser} />;
      case 'yearend':
        return <YearEnd currentUser={currentUser} onNavigate={handleDashboardNavigate} />;
      case 'settings':
        return <Settings currentUser={currentUser} onUserUpdated={handleUserUpdated} />;
      case 'adminHome':
        return <Admin key="adminHome" currentUser={currentUser} section="dashboard" />;
      case 'adminUsers':
        return <Admin key="adminUsers" currentUser={currentUser} section="users" />;
      case 'adminRag':
        return <Admin key="adminRag" currentUser={currentUser} section="rag" />;
      case 'adminFeedback':
        return <Admin key="adminFeedback" currentUser={currentUser} section="feedback" />;
      case 'adminStats':
        return <Admin key="adminStats" currentUser={currentUser} section="stats" />;
      default:
        return (
          <div className="flex h-full flex-col items-center justify-center py-20 text-center">
            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-dashed border-primary/20 bg-primary/5 text-4xl text-primary/30">
              ?
            </div>
            <h2 className="mb-2 font-display text-2xl font-bold tracking-tighter text-outline">
              Đang phát triển
            </h2>
            <p className="text-sm italic text-outline/60">
              Trang <strong className="uppercase text-primary/60">{activePage}</strong> sẽ sớm ra mắt.
            </p>
            <button
              type="button"
              onClick={() => handleDashboardNavigate('home')}
              className="mt-10 rounded-xl bg-primary/10 px-8 py-3 text-xs font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-white"
            >
              Quay về trang chủ
            </button>
          </div>
        );
    }
  };

  const hasInvalidDashboardSlug = Boolean(dashboardSlugMatch && !dashboardPageFromPath);

  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Navigate to="/intro" replace />} />
        <Route path="intro" element={<LandingPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>

      <Route
        path="/login"
        element={<Login onLogin={handleLogin} />}
      />
      
      <Route
        path="/register"
        element={<Register onRegistered={handleRegistered} />}
      />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/app"
        element={<Navigate to={isLoggedIn ? defaultDashboardPath() : "/login"} replace />}
      />

      <Route
        path="/app/:pageSlug"
        element={
          !isLoggedIn ? (
            <Navigate to="/login" replace />
          ) : hasInvalidDashboardSlug ? (
            <Navigate to={defaultDashboardPath()} replace />
          ) : isAdmin && dashboardPageFromPath && !ADMIN_PAGE_IDS.has(dashboardPageFromPath) ? (
            <Navigate to={defaultDashboardPath()} replace />
          ) : !isAdmin && dashboardPageFromPath && !USER_PAGE_IDS.has(dashboardPageFromPath) ? (
            <Navigate to={defaultDashboardPath()} replace />
          ) : (
            <>
              <DashboardLayout
                activeId={displayedPage}
                onNavigate={handleDashboardNavigate}
                currentUser={currentUser}
                onLogout={handleLogout}
                onStartProductTour={(page) => startProductTour(page ?? displayedPage)}
                showProductTourGuide={!isAdmin}
              >
                {renderDashboardContent()}
              </DashboardLayout>
              <ProductTour
                isOpen={showProductTour}
                activePage={displayedPage}
                page={tourPage}
                mode={tourMode}
                onComplete={() => {
                  if (tourMode === 'page' && tourPage === 'home') {
                    window.setTimeout(() => {
                      setTourPage('home');
                      setTourMode('menu');
                      setShowProductTour(true);
                    }, 120);
                  }
                }}
                onClose={() => {
                  markProductTourDismissed(currentUser?.id);
                  setShowProductTour(false);
                }}
              />
            </>
          )
        }
      />

      <Route path="*" element={<Navigate to="/intro" replace />} />
    </Routes>
  );
}
