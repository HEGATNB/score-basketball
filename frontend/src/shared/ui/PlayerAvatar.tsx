import { useEffect, useMemo, useState } from 'react';
import type { Player } from '@/shared/api/client';
import { getTeamBrand } from '@/shared/lib/teamBrand';
import { getPlayerImageCandidates, getPlayerInitials } from '@/shared/lib/playerImage';

interface PlayerAvatarProps {
  player: Player;
  variant?: 'card' | 'row';
  className?: string;
}

function asText(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return fallback;
}

export const PlayerAvatar = ({ player, variant = 'card', className = '' }: PlayerAvatarProps) => {
  // Row avatars are tiny (56px) → fetch the light thumbnail; the larger
  // card variant gets the high-res headshot.
  const candidates = useMemo(
    () => getPlayerImageCandidates(player, { thumb: variant === 'row' }),
    [player, variant],
  );
  const initials = useMemo(() => getPlayerInitials(player), [player]);
  const teamBrand = getTeamBrand({
    abbrev: asText(player.team?.abbrev) || asText(player.team_abbrev),
    name: asText(player.team?.name),
  });
  const brandColor = asText(player.team?.brandColor) || teamBrand.brandColor;
  const accentColor = asText(player.team?.accentColor) || teamBrand.accentColor;

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

  const altText =
    asText((player as any).full_name) ||
    `${asText(player.first_name)} ${asText(player.last_name)}`.trim() ||
    'Player';

  const tint: React.CSSProperties = {
    background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
  };

  const safeSrc = candidates[idx];

  if (variant === 'row') {
    return (
      <div
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--line)] ${className}`}
        style={tint}
      >
        {!allFailed && typeof safeSrc === 'string' && safeSrc ? (
          <img
            src={safeSrc}
            alt={altText}
            width={56}
            height={56}
            className="h-full w-full object-cover object-top"
            loading="lazy"
            decoding="async"
            onError={handleError}
          />
        ) : (
          <span
            className="font-display text-sm font-semibold"
            style={{ color: '#fff5f5', textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}
          >
            {initials}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden ${className}`} style={tint}>
      {/* Faint court pattern as backdrop when photo loads */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 12px, transparent 12px 24px)',
        }}
      />
      {!allFailed && typeof safeSrc === 'string' && safeSrc ? (
        <img
          src={safeSrc}
          alt={altText}
          width={600}
          height={436}
          className="absolute inset-0 h-full w-full object-cover object-top"
          style={{ filter: 'saturate(1.04) contrast(1.03)' }}
          loading="lazy"
          decoding="async"
          onError={handleError}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-display"
            style={{
              fontSize: 110,
              lineHeight: 1,
              color: 'rgba(255,255,255,0.85)',
              textShadow: '0 6px 30px rgba(0,0,0,0.6)',
              WebkitTextStroke: '2px rgba(0,0,0,0.18)',
            }}
          >
            {initials}
          </span>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.42) 60%, rgba(0,0,0,0.88) 100%)',
        }}
      />
    </div>
  );
};

export default PlayerAvatar;
