import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Menu, Search, X } from 'lucide-react';
import { useAuth } from './providers/AuthProvider';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Footer } from '@/shared/ui/Footer';
import { CookieAccept } from '@/shared/ui/CookieAccept';

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  authOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: '/', label: 'Главная', end: true },
  { to: '/matches', label: 'Матчи' },
  { to: '/players', label: 'Игроки' },
  { to: '/teams', label: 'Лиги' },
  { to: '/analytics', label: 'Аналитика' },
  { to: '/history', label: 'Кабинет', authOnly: true },
];

export const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [location.pathname, location.hash]);

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
                  {item.label}
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
                Admin
              </NavLink>
            )}
          </nav>

          {/* Right side */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <div className="hidden items-center gap-2 rounded-pill border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[13px] text-[var(--text-3)] xl:inline-flex">
              <Search className="h-3.5 w-3.5" />
              <span>Поиск</span>
              <kbd className="rounded-sm border border-[var(--line-strong)] bg-[var(--surface-3)] px-1.5 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </div>

            {user ? (
              <>
                <NavLink to="/history" className="flex items-center" aria-label="Кабинет">
                  <span className="header-avatar">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </NavLink>
                <button
                  onClick={logout}
                  className="btn btn-icon"
                  title="Выйти"
                  aria-label="Выйти"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/auth')} className="btn btn-primary">
                <LogIn className="h-4 w-4" />
                Войти
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
                    {item.label}
                  </NavLink>
                ))}
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className="rounded-md px-4 py-3 text-sm font-medium text-[var(--accent)] hover:bg-[var(--surface)]"
                >
                  Admin
                </NavLink>
              )}
              {!user ? (
                <button onClick={() => navigate('/auth')} className="btn btn-primary mt-3">
                  <LogIn className="h-4 w-4" />
                  Войти
                </button>
              ) : (
                <button onClick={logout} className="btn mt-3">
                  <LogOut className="h-4 w-4" />
                  Выйти
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <Footer />
      <CookieAccept />
    </div>
  );
};

export default Layout;
