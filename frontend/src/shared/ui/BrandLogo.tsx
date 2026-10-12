interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  iconOnly?: boolean;
}

const FONT_PX: Record<NonNullable<BrandLogoProps['size']>, number> = {
  sm: 20,
  md: 26,
  lg: 40,
  xl: 60,
};

const SUB_PX: Record<NonNullable<BrandLogoProps['size']>, number> = {
  sm: 8,
  md: 9,
  lg: 10,
  xl: 11,
};

/**
 * Pure wordmark — no decorative icon. Editorial/sports-media style:
 *   - Heavy condensed display weight
 *   - Red period after the wordmark (acts as the only "icon")
 *   - Tight tracking, slightly skewed counter weight on the 'O'
 *   - Optional micro-subtitle "// BASKETBALL INDEX" (md+ sizes)
 *
 * Inspired by editorial brands (The Athletic, Pitchfork, NYT verticals).
 */
export function BrandLogo({ size = 'md', className = '', iconOnly = false }: BrandLogoProps) {
  const fontPx = FONT_PX[size];
  const subPx = SUB_PX[size];
  const showSub = size === 'lg' || size === 'xl';

  // Icon-only mode renders a square monogram chip (e.g. for favicons or
  // collapsed mobile chrome). Even here we stick to a typographic mark.
  if (iconOnly) {
    const chip = Math.round(fontPx * 1.35);
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{
          width: chip,
          height: chip,
          background: 'var(--accent)',
          color: '#fff5f5',
          fontFamily: 'var(--f-display)',
          fontWeight: 900,
          fontSize: Math.round(fontPx * 0.85),
          lineHeight: 1,
          letterSpacing: '-0.04em',
          borderRadius: 6,
          boxShadow: '0 8px 22px -8px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
        aria-label="SCORE"
      >
        S
      </span>
    );
  }

  return (
    <span
      className={`brand-mark inline-flex flex-col items-start ${className}`}
      style={{ lineHeight: 1 }}
      aria-label="SCORE"
    >
      <span
        className="font-display relative inline-flex items-baseline"
        style={{
          fontSize: fontPx,
          fontWeight: 900,
          color: 'var(--text)',
          textTransform: 'uppercase',
          lineHeight: 0.88,
          letterSpacing: '-0.025em',
        }}
      >
        SCORE
        <span
          aria-hidden
          style={{
            color: 'var(--accent)',
            marginLeft: Math.round(fontPx * 0.06),
            display: 'inline-block',
            transform: 'translateY(2%)',
          }}
        >
          .
        </span>
        {/* Tiny scoreboard-segment accent bar under the wordmark */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            bottom: -Math.max(3, Math.round(fontPx * 0.08)),
            width: Math.round(fontPx * 0.45),
            height: 2,
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent-glow)',
            borderRadius: 1,
          }}
        />
      </span>

      {showSub && (
        <span
          className="font-mono mt-2"
          style={{
            fontSize: subPx,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
          }}
        >
          // Basketball Index
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
