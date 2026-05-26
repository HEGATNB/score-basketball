import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn',
  ghost: 'btn btn-ghost',
  gold: 'btn',
};

const sizeClass: Record<Size, string> = {
  sm: 'text-xs px-3 py-2',
  md: '',
  lg: 'text-[14px] px-6 py-3.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', leadingIcon, trailingIcon, fullWidth, className = '', children, ...rest },
    ref,
  ) => {
    const gold = variant === 'gold' ? { background: 'var(--gold)', color: '#0a0a0c', borderColor: 'var(--gold)' } : undefined;
    return (
      <button
        ref={ref}
        className={`${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? 'w-full justify-center' : ''} ${className}`}
        style={gold}
        {...rest}
      >
        {leadingIcon}
        {children}
        {trailingIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';

interface LinkButtonProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

export const LinkButton = ({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  fullWidth,
  className = '',
  children,
  ...rest
}: LinkButtonProps) => {
  return (
    <Link
      className={`${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? 'w-full justify-center' : ''} ${className}`}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  );
};

export default Button;
