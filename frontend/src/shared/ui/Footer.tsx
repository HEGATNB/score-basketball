import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

interface FooterSection {
  title: string;
  links: Array<{ label: string; to: string }>;
}

const SECTIONS: FooterSection[] = [
  {
    title: 'Платформа',
    links: [
      { label: 'Прогнозы', to: '/prediction/new' },
      { label: 'Матчи', to: '/matches' },
      { label: 'Команды', to: '/teams' },
      { label: 'Аналитика', to: '/analytics' },
    ],
  },
  {
    title: 'Данные',
    links: [
      { label: 'Игроки', to: '/players' },
      { label: 'Лента', to: '/news' },
      { label: 'Кабинет', to: '/history' },
    ],
  },
  {
    title: 'Навигация',
    links: [
      { label: 'Главная', to: '/' },
      { label: 'История', to: '/history' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-[var(--line)] bg-[var(--bg-2)] pb-10 pt-20">
      {/* Giant SCORE backdrop wordmark */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2"
        style={{
          fontFamily: 'var(--f-display)',
          fontSize: 'clamp(140px, 24vw, 320px)',
          color: 'transparent',
          WebkitTextStroke: '1px rgba(255,255,255,0.05)',
          letterSpacing: '0.05em',
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
      >
        SCORE
      </div>

      <div className="container-x relative z-10">
        <div className="grid gap-10 lg:grid-cols-[2fr_repeat(3,1fr)]">
          <div>
            <BrandLogo size="md" />
            <p className="mt-5 max-w-[320px] text-sm leading-relaxed text-[var(--text-3)]">
              Премиальная баскетбольная аналитика: live-данные, архив матчей,
              профили игроков и модельные прогнозы в одном интерфейсе.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h5
                className="mb-4 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                {section.title}
              </h5>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-[13px] text-[var(--text-2)] transition-colors hover:text-[var(--accent)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-[var(--line)] pt-7 font-mono text-[11px] uppercase text-[var(--text-3)] sm:flex-row"
          style={{ letterSpacing: '0.1em' }}
        >
          <span>© 2026 SCORE · Все права защищены</span>
          <span>Сделано для внимательного взгляда на игру</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
