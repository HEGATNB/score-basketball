import type { HTMLAttributes, ReactNode } from 'react';

interface StatBlockProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: 'court' | 'gold' | 'mint' | 'ice' | 'none';
  delay?: number;
}

const accentColor: Record<NonNullable<StatBlockProps['accent']>, string> = {
  court: 'var(--accent)',
  gold: 'var(--gold)',
  mint: 'var(--ok)',
  ice: 'var(--info)',
  none: 'var(--text)',
};

export const StatBlock = ({
  label,
  value,
  hint,
  icon,
  accent = 'none',
  delay: _delay,
  className = '',
  ...rest
}: StatBlockProps) => {
  void _delay;
  return (
    <div
      className={`card rounded-md p-5 ${className}`}
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.18em' }}
        >
          {label}
        </span>
        {icon && (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-2)]"
            style={{ color: accentColor[accent] }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className="mt-3 font-display text-4xl leading-none"
        style={{ color: accentColor[accent] }}
      >
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-[var(--text-3)]">{hint}</div>}
    </div>
  );
};

export default StatBlock;
