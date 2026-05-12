interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeClass = {
  sm: 'h-7 w-7',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

export const LoadingSpinner = ({ fullScreen = false, size = 'md', label }: LoadingSpinnerProps) => {
  const spinner = (
    <div className="flex flex-col items-center gap-4">
      <div className={`relative ${sizeClass[size]}`}>
        <div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: 'rgba(255,90,31,0.18)' }}
        />
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: 'var(--accent)', animationDuration: '1.4s' }}
        />
        <div
          className="absolute inset-2 animate-pulse rounded-full"
          style={{ background: 'rgba(255,90,31,0.18)' }}
        />
        <div
          className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}
        />
      </div>
      {label && (
        <p
          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.28em' }}
        >
          {label}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/85 backdrop-blur-md">
        {spinner}
      </div>
    );
  }
  return spinner;
};

export default LoadingSpinner;
