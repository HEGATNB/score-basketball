import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Menu, Search, X } from 'lucide-react';
import { useAuth } from './providers/AuthProvider';
import { useT } from '@/shared/i18n';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { LanguageToggle } from '@/shared/ui/LanguageToggle';
import { Footer } from '@/shared/ui/Footer';
import { CookieAccept } from '@/shared/ui/CookieAccept';
import { SearchPalette } from '@/shared/ui/SearchPalette';
import { ErrorBoundary } from './ErrorBoundary';

type NavItem = {
  to: string;
  tKey: string;
  end?: boolean;
  authOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: '/', tKey: 'nav.home', end: true },
  { to: '/matches', tKey: 'nav.matches' },
  { to: '/players', tKey: 'nav.players' },
  { to: '/teams', tKey: 'nav.teams' },
  { to: '/news', tKey: 'nav.feed' },
  { to: '/analytics', tKey: 'nav.analytics' },
  { to: '/account', tKey: 'nav.account', authOnly: true },
];

export const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [location.pathname, location.hash]);

  // Global hotkey: Cmd/Ctrl + K opens the search palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const displayName = user?.name || user?.username || 'A';

  return (
    <div className="min-h-screen">
      <header className="header-wrap">
        <div className="container-x header-bar">
          {/* Logo */}
          <NavLink to="/" className="shrink-0">
            <BrandLogo size="md" />
          </NavLink>

          {/* Desktop nav */}
          <nav className="nav-list hidden lg:flex">
            {navItems
              .filter((item) => !item.authOnly || !!user)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  {t(item.tKey)}
                </NavLink>
              ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : ''}`
                }
                style={{ color: 'var(--accent)' }}
              >
                {t('nav.admin')}
              </NavLink>
            )}
          </nav>

          {/* Right side */}
          <div className="hidden items-center gap-2 lg:flex">
            <LanguageToggle />
            <button
              onClick={() => setSearchOpen(true)}
              aria-label={t('header.search')}
              title={`${t('header.search')} (⌘K)`}
              className="btn btn-icon"
            >
              <Search className="h-4 w-4" />
            </button>

            {user ? (
              <>
                <NavLink to="/account" className="flex items-center" aria-label={t('nav.account')}>
                  <span className="header-avatar">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </NavLink>
                <button
                  onClick={logout}
                  className="btn btn-icon"
                  title={t('header.signout')}
                  aria-label={t('header.signout')}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/auth')} className="btn btn-primary">
                <LogIn className="h-4 w-4" />
                {t('header.signin')}
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label="Меню"
            className="btn btn-icon lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="border-t border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur-xl lg:hidden">
            <nav className="container-x flex flex-col gap-1 py-4">
              {navItems
                .filter((item) => !item.authOnly || !!user)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `rounded-md px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[var(--surface-2)] text-[var(--text)]'
                          : 'text-[var(--text-2)] hover:bg-[var(--surface)]'
                      }`
                    }
                  >
                    {t(item.tKey)}
                  </NavLink>
                ))}
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className="rounded-md px-4 py-3 text-sm font-medium text-[var(--accent)] hover:bg-[var(--surface)]"
                >
                  {t('nav.admin')}
                </NavLink>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <LanguageToggle />
                {!user ? (
                  <button onClick={() => navigate('/auth')} className="btn btn-primary flex-1 justify-center">
                    <LogIn className="h-4 w-4" />
                    {t('header.signin')}
                  </button>
                ) : (
                  <button onClick={logout} className="btn flex-1 justify-center">
                    <LogOut className="h-4 w-4" />
                    {t('header.signout')}
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      <Footer />
      <CookieAccept />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default Layout;
