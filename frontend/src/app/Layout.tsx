import { Outlet, NavLink } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  Cpu,
  History,
  Home,
  LogIn,
  LogOut,
  Shield,
  Trophy,
  Users,
} from 'lucide-react';
import { VideoBackground } from '../shared/ui/VideoBackground';
import { Footer } from '../shared/ui/Footer';
import { useAuth } from './providers/AuthProvider';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { CookieAccept } from '../shared/ui/CookieAccept';
import { LanguageToggle } from '@/shared/ui/LanguageToggle';
import { useLanguage } from './providers/LanguageProvider';

const navItems = [
  { path: '/', icon: Home, labelKey: 'nav.dashboard' },
  { path: '/teams', icon: Trophy, labelKey: 'nav.teams' },
  { path: '/players', icon: Users, labelKey: 'nav.players' },
  { path: '/matches', icon: CalendarDays, labelKey: 'nav.matches' },
  { path: '/analytics', icon: BarChart3, labelKey: 'nav.analytics' },
  { path: '/prediction/new', icon: Cpu, labelKey: 'nav.predict' },
  { path: '/history', icon: History, labelKey: 'nav.history' },
];

export const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useLanguage();
  const displayName = user?.name || user?.username || 'Guest';

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--page-bg)] text-[var(--text-main)]">
      <VideoBackground
          videoSrc="/videos/Basketball-Bg_hevc.mp4"
          fallbackSrc="/videos/basketball-bg.mp4"
          overlayOpacity={0.24}
          playbackSpeed={0.82}
      />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_top_left,rgba(232,161,67,0.12),transparent_24%),linear-gradient(180deg,rgba(9,6,4,0.28),rgba(9,6,4,0.62),rgba(9,6,4,0.92))]" />

      <div className="relative z-10 flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[rgba(10,8,6,0.78)] backdrop-blur-2xl">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <NavLink to="/" className="shrink-0">
                  <BrandLogo size="md" />
                </NavLink>
                <div className="hidden lg:block">
                  <p className="max-w-[220px] text-[10px] uppercase tracking-[0.24em] text-[var(--text-soft)]">
                    {t('header.tagline')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <LanguageToggle />

                <div className="badge-live">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_18px_rgba(232,161,67,0.36)]" />
                  {t('header.liveData')}
                </div>

                {user ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[rgba(255,246,229,0.03)] px-3 py-2">
                    <div className="brand-mark-cool flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">{user.role}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="rounded-xl border border-[var(--border-soft)] bg-[rgba(255,246,229,0.03)] p-2 text-[var(--text-muted)] transition hover:border-[rgba(232,161,67,0.22)] hover:bg-[rgba(232,161,67,0.08)] hover:text-[var(--accent-soft)]"
                      title={t('nav.logout')}
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <NavLink
                    to="/auth"
                    className="btn-secondary px-4 py-2"
                  >
                    <LogIn className="h-4 w-4" />
                    {t('nav.signIn')}
                  </NavLink>
                )}
              </div>
            </div>

            <div className="no-scrollbar overflow-x-auto">
              <nav className="flex min-w-max items-center gap-5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-2 border-b-2 px-1 pb-2 pt-1 text-sm font-semibold transition ${
                        isActive
                          ? 'border-[var(--accent)] text-white'
                          : 'border-transparent text-[var(--text-muted)] hover:border-[rgba(232,161,67,0.18)] hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </NavLink>
                ))}

                {isAdmin && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `inline-flex items-center gap-2 border-b-2 px-1 pb-2 pt-1 text-sm font-semibold transition ${
                        isActive
                          ? 'border-[var(--accent)] text-white'
                          : 'border-transparent text-[var(--text-muted)] hover:border-[rgba(232,161,67,0.18)] hover:text-white'
                      }`
                    }
                  >
                    <Shield className="h-4 w-4" />
                    {t('nav.admin')}
                  </NavLink>
                )}
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <Outlet />
        </main>

        <Footer
          copyrightText={t('footer.copyright')}
          contactEmail="hegatnb@mail.ru"
          socialLinks={{
            telegram: "https://t.me/score_website",
            vk: "https://vk.com/score_website"
          }}
        />
      </div>
      <CookieAccept />
    </div>
  );
};

export default Layout;