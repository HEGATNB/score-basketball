import type { HTMLAttributes, ReactNode } from 'react';

type ChipVariant = 'default' | 'court' | 'gold' | 'live' | 'mint' | 'info' | 'hot';

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClass: Record<ChipVariant, string> = {
  default: 'tag',
  court: 'tag tag-hot',
  hot: 'tag tag-hot',
  gold: 'tag tag-gold',
  live: 'tag tag-live',
  mint: 'tag',
  info: 'tag tag-info',
};

export const Chip = ({ variant = 'default', icon, className = '', children, ...rest }: ChipProps) => {
  return (
    <span className={`${variantClass[variant]} ${className}`} {...rest}>
      {icon}
      {children}
    </span>
  );
};

export default Chip;
