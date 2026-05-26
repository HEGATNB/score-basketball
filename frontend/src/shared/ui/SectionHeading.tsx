import type { ReactNode } from 'react';

interface SectionHeadingProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  trailing?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const titleSize = {
  sm: 'text-3xl sm:text-4xl',
  md: 'text-4xl sm:text-5xl',
  lg: 'text-5xl sm:text-6xl',
};

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  trailing,
  align = 'left',
  size = 'md',
  className = '',
}: SectionHeadingProps) => {
  return (
    <div className={`section-head ${align === 'center' ? 'lg:justify-center' : ''} ${className}`}>
      <div className="flex flex-col gap-3">
        {eyebrow && <div className="eyebrow"><span className="dot" />{eyebrow}</div>}
        <h2 className={`display-h ${titleSize[size]}`}>{title}</h2>
        {description && <p className="lead">{description}</p>}
      </div>
      {trailing && <div className="actions">{trailing}</div>}
    </div>
  );
};

export default SectionHeading;
