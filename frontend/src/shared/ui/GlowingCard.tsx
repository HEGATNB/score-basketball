import type { HTMLAttributes, ReactNode } from 'react';

interface GlowingCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glowColor?: 'orange' | 'blue' | 'green' | 'purple' | 'gold';
  delay?: number;
  variant?: 'default' | 'strong' | 'court';
}

export function GlowingCard({
  children,
  className = '',
  glowColor: _g,
  delay: _d,
  variant: _v,
  ...rest
}: GlowingCardProps) {
  void _g;
  void _d;
  void _v;
  return (
    <div className={`card rounded-lg ${className}`} {...rest}>
      {children}
    </div>
  );
}

export default GlowingCard;
