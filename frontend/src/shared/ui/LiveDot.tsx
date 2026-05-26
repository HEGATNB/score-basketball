interface LiveDotProps {
  className?: string;
  size?: 'sm' | 'md';
  color?: 'live' | 'court' | 'gold' | 'mint';
}

const sizeClass = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
};

const colorMap = {
  live: 'var(--danger)',
  court: 'var(--accent)',
  gold: 'var(--gold)',
  mint: 'var(--ok)',
};

export const LiveDot = ({ className = '', size = 'md', color = 'live' }: LiveDotProps) => {
  return (
    <span
      className={`pulse-dot inline-block ${sizeClass[size]} ${className}`}
      style={{ background: colorMap[color] }}
    />
  );
};

export default LiveDot;
