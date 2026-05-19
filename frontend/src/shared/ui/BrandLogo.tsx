interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Hide the wordmark, leave just the icon. Useful for tiny avatars. */
  iconOnly?: boolean;
}

const ICON_PX: Record<NonNullable<BrandLogoProps['size']>, number> = {
  sm: 22,
  md: 30,
  lg: 42,
  xl: 64,
};

const FONT_PX: Record<NonNullable<BrandLogoProps['size']>, number> = {
  sm: 18,
  md: 26,
  lg: 38,
  xl: 56,
};

/**
 * SCORE brand mark.
 *
 *   ▣  SCORE.
 *
 * The mark is a basketball seam-line glyph inside a hot-orange tile —
 * recognisable at any size, works mono or coloured. The wordmark sits
 * to the right in Barlow Condensed Black with a court-orange period.
 */
export function BrandLogo({ size = 'md', className = '', iconOnly = false }: BrandLogoProps) {
  const iconPx = ICON_PX[size];
  const fontPx = FONT_PX[size];

  return (
    <span
      className={`brand-mark inline-flex items-center gap-2.5 ${className}`}
      style={{ lineHeight: 1 }}
      aria-label="SCORE"
    >
      <svg
        width={iconPx}
        height={iconPx}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          flexShrink: 0,
          filter: 'drop-shadow(0 4px 14px rgba(255,90,31,0.45))',
        }}
        aria-hidden
      >
        <defs>
          <linearGradient id="score-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff7a3f" />
            <stop offset="55%" stopColor="#ff5a1f" />
            <stop offset="100%" stopColor="#c43c0c" />
          </linearGradient>
          <linearGradient id="score-shine" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Squircle tile */}
        <rect x="2" y="2" width="44" height="44" rx="11" fill="url(#score-grad)" />
        {/* Highlight gloss */}
        <rect x="2" y="2" width="44" height="22" rx="11" fill="url(#score-shine)" />

        {/* Basketball seam lines — abstract, kept simple */}
        <g stroke="#0a0a0c" strokeWidth="2.6" strokeLinecap="round" fill="none">
          {/* vertical seam */}
          <path d="M24 6.5 V41.5" />
          {/* horizontal seam */}
          <path d="M6.5 24 H41.5" />
          {/* curved seams on each side */}
          <path d="M10 9.5 Q24 24 10 38.5" />
          <path d="M38 9.5 Q24 24 38 38.5" />
        </g>

        {/* Inner border for crispness */}
        <rect x="2.5" y="2.5" width="43" height="43" rx="10.5" stroke="rgba(0,0,0,0.4)" strokeWidth="1" fill="none" />
      </svg>

      {!iconOnly && (
        <span
          className="font-display"
          style={{
            fontSize: fontPx,
            fontWeight: 900,
            letterSpacing: '0.005em',
            color: 'var(--text)',
            textTransform: 'uppercase',
            lineHeight: 0.9,
          }}
        >
          SCORE
          <span style={{ color: 'var(--accent)', marginLeft: 1 }}>.</span>
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
