import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { useT } from '@/shared/i18n';

interface FooterSection {
  titleKey: string;
  links: Array<{ labelKey: string; to: string }>;
}

const SECTIONS: FooterSection[] = [
  {
    titleKey: 'footer.platform',
    links: [
      { labelKey: 'footer.predictions', to: '/prediction/new' },
      { labelKey: 'nav.matches', to: '/matches' },
      { labelKey: 'nav.teams', to: '/teams' },
      { labelKey: 'nav.analytics', to: '/analytics' },
    ],
  },
  {
    titleKey: 'footer.data',
    links: [
      { labelKey: 'nav.players', to: '/players' },
      { labelKey: 'nav.feed', to: '/news' },
      { labelKey: 'nav.account', to: '/account' },
    ],
  },
  {
    titleKey: 'footer.nav',
    links: [
      { labelKey: 'nav.home', to: '/' },
      { labelKey: 'footer.history', to: '/history' },
    ],
  },
];

export function Footer() {
  const t = useT();
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-[var(--line)] bg-[var(--bg-2)] pb-10 pt-20">
      {/* Accent top line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--accent) 50%, transparent)',
          opacity: 0.45,
        }}
      />
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
              {t('footer.tagline')}
            </p>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.titleKey}>
              <h5
                className="mb-4 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                {t(section.titleKey)}
              </h5>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      to={link.to}
                      className="text-[13px] text-[var(--text-2)] transition-colors hover:text-[var(--accent)]"
                    >
                      {t(link.labelKey)}
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
          <span>{t('footer.rights')}</span>
          <span>{t('footer.madeFor')}</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
