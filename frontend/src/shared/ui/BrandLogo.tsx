interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  iconOnly?: boolean;
}

const FONT_PX: Record<NonNullable<BrandLogoProps['size']>, number> = {
  sm: 18,
  md: 25,
  lg: 38,
  xl: 56,
};

const MARK_SIZE: Record<NonNullable<BrandLogoProps['size']>, { width: number; height: number }> = {
  sm: { width: 16, height: 18 },
  md: { width: 22, height: 24 },
  lg: { width: 30, height: 34 },
  xl: { width: 42, height: 46 },
};

export function BrandLogo({ size = 'md', className = '', iconOnly = false }: BrandLogoProps) {
  const fontPx = FONT_PX[size];
  const markSize = MARK_SIZE[size];

  const mark = (
    <span
      className="relative inline-flex shrink-0 items-center"
      style={{
        width: markSize.width,
        height: markSize.height,
      }}
      aria-hidden
    >
      <span
        className="absolute left-0 top-0"
        style={{
          width: 1,
          height: markSize.height,
          background: 'var(--accent)',
        }}
      />
      <span
        className="absolute bottom-0 left-0"
        style={{
          width: Math.round(markSize.width * 0.82),
          height: 1,
          background: 'var(--accent)',
        }}
      />
      <span
        className="absolute bottom-0 right-0 rounded-full"
        style={{
          width: Math.max(4, Math.round(markSize.width * 0.22)),
          height: Math.max(4, Math.round(markSize.width * 0.22)),
          background: 'var(--accent)',
          transform: 'translate(45%, 45%)',
        }}
      />
    </span>
  );

  if (iconOnly) {
    return (
      <span className={`inline-flex items-center ${className}`} style={{ lineHeight: 1 }} aria-label="SCORE">
        {mark}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-3 ${className}`}
      style={{ lineHeight: 1 }}
      aria-label="SCORE"
    >
      {mark}
      <span
        className="font-display"
        style={{
          fontSize: fontPx,
          fontWeight: 900,
          color: 'var(--text)',
          textTransform: 'uppercase',
          lineHeight: 0.9,
          letterSpacing: '0.005em',
        }}
      >
        SCORE<span style={{ color: 'var(--accent)', marginLeft: 1 }}>.</span>
      </span>
    </span>
  );
}

export default BrandLogo;
