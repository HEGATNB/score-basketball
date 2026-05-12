interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const fontSize: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: '20px',
  md: '30px',
  lg: '42px',
};
const bulletSize: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: '8px',
  md: '12px',
  lg: '16px',
};

export function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  return (
    <span className={`logo-mark ${className}`} style={{ fontSize: fontSize[size] }}>
      <span
        className="bullet"
        style={{ width: bulletSize[size], height: bulletSize[size] }}
        aria-hidden
      />
      <span>SCORE</span>
    </span>
  );
}

export default BrandLogo;
