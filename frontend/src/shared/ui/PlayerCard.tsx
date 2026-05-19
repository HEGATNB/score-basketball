import { useEffect, useMemo, useState } from 'react';
import type { Player } from '@/shared/api/client';
import { getTeamBrand } from '@/shared/lib/teamBrand';
import { getPlayerImageCandidates, getPlayerInitials } from '@/shared/lib/playerImage';

interface PlayerCardProps {
  player: Player;
  delay?: number;
  onOpenDetails?: () => void;
  highlight?: boolean;
}

/**
 * Defensive coercion — every value that ends up as a React child must be a
 * primitive (string / number). If anything upstream accidentally hands us an
 * object, this turns it into a readable string instead of crashing the page
 * with React error #31.
 */
function asText(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return fallback;
}

function asNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildName(player: Player): string {
  const fn = asText((player as any).full_name);
  if (fn) return fn;
  const a = asText(player.first_name);
  const b = asText(player.last_name);
  return `${a} ${b}`.trim();
}

export function PlayerCard({ player, onOpenDetails, highlight }: PlayerCardProps) {
  const candidates = useMemo(() => getPlayerImageCandidates(player), [player]);
  const initials = useMemo(() => getPlayerInitials(player), [player]);
  const teamBrand = getTeamBrand({
    abbrev: asText(player.team?.abbrev) || asText(player.team_abbrev),
    name: asText(player.team?.name),
  });
  const brandColor = asText(player.team?.brandColor) || teamBrand.brandColor;
  const accentColor = asText(player.team?.accentColor) || teamBrand.accentColor;

  const [imgIdx, setImgIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(candidates.length === 0);

  useEffect(() => {
    setImgIdx(0);
    setAllFailed(candidates.length === 0);
  }, [candidates]);

  const handleImgError = () => {
    if (imgIdx + 1 < candidates.length) setImgIdx(imgIdx + 1);
    else setAllFailed(true);
  };

  const fullName = buildName(player);
  const teamAbbrev = asText(player.team?.abbrev) || asText(player.team_abbrev) || 'NBA';
  const teamName = asText(player.team?.name) || teamAbbrev;
  const first = asText(player.first_name) || fullName.split(' ')[0] || '';
  const last = asText(player.last_name) || fullName.split(' ').slice(1).join(' ') || fullName;
  const number = asText(player.number);
  const position = asText(player.position) || 'PRO';

  const pts = asNumber(player.points_per_game).toFixed(1);
  const ast = asNumber(player.assists_per_game).toFixed(1);
  const reb = asNumber(player.rebounds_per_game).toFixed(1);
  const eff = ((asNumber(player.points_per_game) + asNumber(player.rebounds_per_game) + asNumber(player.assists_per_game)) / 3).toFixed(0);

  const safeImg = candidates[imgIdx];

  return (
    <article
      onClick={onOpenDetails}
      className={`player-card snap-start ${onOpenDetails ? '' : 'cursor-default'} ${highlight ? '!border-[var(--accent)]' : ''}`}
      style={
        {
          '--team-from': brandColor,
          '--team-to': accentColor,
        } as React.CSSProperties
      }
    >
      <div className="court-bg" />

      {!allFailed && typeof safeImg === 'string' && safeImg.length > 0 ? (
        <div
          className="portrait"
          style={{ backgroundImage: `url(${safeImg})` }}
        >
          <img
            src={safeImg}
            alt={fullName}
            onError={handleImgError}
            referrerPolicy="no-referrer"
            className="hidden"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 z-[1] flex items-center justify-center"
          style={{ mixBlendMode: 'luminosity' }}
        >
          <span
            className="font-display"
            style={{
              fontSize: '180px',
              lineHeight: 1,
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            {initials}
          </span>
        </div>
      )}

      <div className="gradient" />

      {number ? <div className="number">{number}</div> : null}
      <div className="pos-pill">
        {position} · {teamAbbrev}
      </div>

      <div className="name-block">
        <div className="first">{first}</div>
        <div className="last">{last}</div>
        <div className="team-tag">{teamName}</div>
      </div>

      <div className="player-stats">
        <div className="player-stat">
          <div className="v">{pts}</div>
          <div className="l">PPG</div>
        </div>
        <div className="player-stat">
          <div className="v">{ast}</div>
          <div className="l">APG</div>
        </div>
        <div className="player-stat">
          <div className="v">{reb}</div>
          <div className="l">RPG</div>
        </div>
        <div className="player-stat">
          <div className="v">{eff}</div>
          <div className="l">EFF</div>
        </div>
      </div>
    </article>
  );
}

export default PlayerCard;
