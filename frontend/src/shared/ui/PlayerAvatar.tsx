import { useEffect, useMemo, useState } from 'react';
import type { Player } from '@/shared/api/client';
import { getTeamBrand } from '@/shared/lib/teamBrand';
import { getPlayerImageCandidates, getPlayerInitials } from '@/shared/lib/playerImage';

interface PlayerAvatarProps {
  player: Player;
  variant?: 'card' | 'row';
  className?: string;
}

export const PlayerAvatar = ({ player, variant = 'card', className = '' }: PlayerAvatarProps) => {
  const candidates = useMemo(() => getPlayerImageCandidates(player), [player]);
  const initials = useMemo(() => getPlayerInitials(player), [player]);
  const teamBrand = getTeamBrand({
    abbrev: player.team?.abbrev || player.team_abbrev,
    name: player.team?.name,
  });
  const brandColor = player.team?.brandColor || teamBrand.brandColor;
  const accentColor = player.team?.accentColor || teamBrand.accentColor;

  const [idx, setIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(candidates.length === 0);

  useEffect(() => {
    setIdx(0);
    setAllFailed(candidates.length === 0);
  }, [candidates]);

  const handleError = () => {
    if (idx + 1 < candidates.length) setIdx(idx + 1);
    else setAllFailed(true);
  };

  const tint: React.CSSProperties = {
    background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
  };

  if (variant === 'row') {
    return (
      <div
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--line)] ${className}`}
        style={tint}
      >
        {!allFailed ? (
          <img
            src={candidates[idx]}
            alt={player.full_name || `${player.first_name} ${player.last_name}`}
            className="h-full w-full object-cover object-top"
            style={{ mixBlendMode: 'luminosity' }}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={handleError}
          />
        ) : (
          <span
            className="font-display text-sm font-semibold"
            style={{ color: '#0a0a0c', textShadow: '0 1px 2px rgba(255,255,255,0.25)' }}
          >
            {initials}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden ${className}`} style={tint}>
      {!allFailed ? (
        <img
          src={candidates[idx]}
          alt={player.full_name || `${player.first_name} ${player.last_name}`}
          className="absolute inset-0 h-full w-full object-cover object-top"
          style={{ mixBlendMode: 'luminosity', filter: 'contrast(1.1)' }}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleError}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-display text-7xl"
            style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 4px 24px rgba(0,0,0,0.55)' }}
          >
            {initials}
          </span>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.85) 100%)',
        }}
      />
    </div>
  );
};

export default PlayerAvatar;
