import { useRef, type HTMLAttributes, type ReactNode } from 'react';

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Diameter of the spotlight glow in px. Defaults to 360. */
  glow?: number;
  /** Tint color (rgba). Defaults to court orange. */
  tint?: string;
}

/**
 * A card wrapper that follows the user's cursor with a subtle radial spotlight.
 * Falls back gracefully on touch devices (no hover, no listeners fired).
 */
export const SpotlightCard = ({
  children,
  className = '',
  glow = 360,
  tint = 'rgba(238, 126, 42, 0.12)',
  onMouseMove,
  onMouseLeave,
  style,
  ...rest
}: SpotlightCardProps) => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
          el.style.setProperty('--my', `${e.clientY - rect.top}px`);
          el.style.setProperty('--spot-opacity', '1');
        }
        onMouseMove?.(e);
      }}
      onMouseLeave={(e) => {
        const el = ref.current;
        if (el) el.style.setProperty('--spot-opacity', '0');
        onMouseLeave?.(e);
      }}
      className={`relative overflow-hidden ${className}`}
      style={
        {
          ...style,
          '--spot-glow': `${glow}px`,
          '--spot-tint': tint,
        } as React.CSSProperties
      }
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(var(--spot-glow) circle at var(--mx, 50%) var(--my, 50%), var(--spot-tint), transparent 45%)',
          opacity: 'var(--spot-opacity, 0)',
          zIndex: 1,
        }}
      />
      <div className="relative z-[2]">{children}</div>
    </div>
  );
};

export default SpotlightCard;
