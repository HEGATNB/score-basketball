import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface SeasonSelectorProps {
  seasons: string[];
  currentSeason: string;
  onSeasonChange: (season: string) => Promise<void> | void;
  className?: string;
}

export function SeasonSelector({
  seasons,
  currentSeason,
  onSeasonChange,
  className = '',
}: SeasonSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const seasonsArray = Array.isArray(seasons) ? seasons : [];
  const currentIndex = seasonsArray.indexOf(currentSeason);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < seasonsArray.length - 1;

  const handleChange = async (newSeason: string) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await onSeasonChange(newSeason);
    } catch (error) {
      console.error('Failed to change season:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrev = () => {
    if (hasPrev) handleChange(seasonsArray[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) handleChange(seasonsArray[currentIndex + 1]);
  };

  if (seasonsArray.length <= 1) {
    return (
      <span className={`text-xs uppercase tracking-[0.18em] text-slate-400 ${className}`}>
        {currentSeason || 'N/A'}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 ${className}`}>
      <button
        type="button"
        onClick={handlePrev}
        disabled={!hasPrev || isLoading}
        className={`flex h-5 w-5 items-center justify-center rounded transition ${
          hasPrev && !isLoading ? 'text-orange-400 hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'
        }`}
      >
        <ChevronLeft className="h-3 w-3" />
      </button>

      <span className="min-w-[60px] text-center text-xs font-medium text-white">
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin inline" />
        ) : (
          currentSeason
        )}
      </span>

      <button
        type="button"
        onClick={handleNext}
        disabled={!hasNext || isLoading}
        className={`flex h-5 w-5 items-center justify-center rounded transition ${
          hasNext && !isLoading ? 'text-orange-400 hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'
        }`}
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}