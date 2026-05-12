import logoImage from '../../assets/logo.png';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  align?: 'left' | 'center';
  className?: string;
}

const sizeStyles = {
  sm: {
    root: 'gap-1.5',
    width: 80,
    height: 45,
    tagline: 'text-[9px]',
  },
  md: {
    root: 'gap-2',
    width: 250,
    height: 68,
    tagline: 'text-[10px]',
  },
  lg: {
    root: 'gap-2.5',
    width: 180,
    height: 101,
    tagline: 'text-[11px]',
  },
};

export function BrandLogo({
  size = 'md',
  showTagline = false,
  align = 'left',
  className = '',
}: BrandLogoProps) {
  const config = sizeStyles[size];
  const alignment = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <div className={`inline-flex flex-col ${alignment} ${className}`}>
      <div className={`inline-flex items-center ${config.root}`}>
        <img
          src={logoImage}
          alt="ScoreCore Logo"
          width={config.width}
          height={config.height}
          className="object-contain"
          style={{ width: `${config.width}px`, height: 'auto' }}
        />
      </div>

      {showTagline && (
        <p className={`mt-1 uppercase tracking-[0.32em] text-[var(--text-soft)] ${config.tagline}`}>
          Basketball Intelligence
        </p>
      )}
    </div>
  );
}

export default BrandLogo;