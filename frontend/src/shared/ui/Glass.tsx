import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type GlassVariant = 'default' | 'strong' | 'light' | 'court';

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  rounded?: 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  children?: ReactNode;
}

const roundedClass = {
  lg: 'rounded-md',
  xl: 'rounded-md',
  '2xl': 'rounded-lg',
  '3xl': 'rounded-lg',
  full: 'rounded-pill',
};

export const Glass = forwardRef<HTMLDivElement, GlassProps>(
  ({ variant = 'default', rounded = '2xl', className = '', children, ...rest }, ref) => {
    const baseClass = variant === 'court'
      ? 'card border border-[rgba(255,90,31,0.25)] bg-[rgba(255,90,31,0.06)]'
      : 'card';
    return (
      <div ref={ref} className={`${baseClass} ${roundedClass[rounded]} ${className}`} {...rest}>
        {children}
      </div>
    );
  },
);
Glass.displayName = 'Glass';

interface MotionGlassProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  rounded?: keyof typeof roundedClass;
  children?: ReactNode;
  delay?: number;
}

export const MotionGlass = ({
  variant = 'default',
  rounded = '2xl',
  className = '',
  children,
  delay: _delay,
  ...rest
}: MotionGlassProps) => {
  void _delay;
  const baseClass = variant === 'court'
    ? 'card border border-[rgba(255,90,31,0.25)] bg-[rgba(255,90,31,0.06)]'
    : 'card';
  return (
    <div className={`${baseClass} ${roundedClass[rounded]} ${className}`} {...rest}>
      {children}
    </div>
  );
};

export default Glass;
