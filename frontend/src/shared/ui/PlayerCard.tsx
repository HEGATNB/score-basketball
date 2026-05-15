import { useMemo, useState } from 'react';
import type { Player } from '@/shared/api/client';
import { getTeamBrand } from '@/shared/lib/teamBrand';
import { getPlayerImageCandidates, getPlayerInitials } from '@/shared/lib/playerImage';

interface PlayerCardProps {
  player: Player;
  delay?: number;
  onOpenDetails?: () => void;
  highlight?: boolean;
}

function formatPlayerName(player: Player) {
  return player.full_name || `${player.first_name} ${player.last_name}`.trim();
}

export function PlayerCard({ player, onOpenDetails, highlight }: PlayerCardProps) {
  const candidates = useMemo(() => getPlayerImageCandidates(player), [player]);
  const initials = useMemo(() => getPlayerInitials(player), [player]);
  const teamBrand = getTeamBrand({
    abbrev: player.team?.abbrev || player.team_abbrev,
    name: player.team?.name,
  });
  const brandColor = player.team?.brandColor || teamBrand.brandColor;
  const accentColor = player.team?.accentColor || teamBrand.accentColor;

  const [imgIdx, setImgIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(candidates.length === 0);

  const handleImgError = () => {
    if (imgIdx + 1 < candidates.length) setImgIdx(imgIdx + 1);
    else setAllFailed(true);
  };

  const teamLabel = player.team?.abbrev || player.team_abbrev || 'NBA';
  const fullName = formatPlayerName(player);
  const first = player.first_name || fullName.split(' ')[0] || '';
  const last = player.last_name || fullName.split(' ').slice(1).join(' ') || fullName;
  const number = player.number || '';

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

      {!allFailed && candidates.length > 0 ? (
        <div
          className="portrait"
          style={{ backgroundImage: `url(${candidates[imgIdx]})` }}
        >
          {/* invisible <img> drives onError chain */}
          <img
            src={candidates[imgIdx]}
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

      {number && <div className="number">{number}</div>}
      <div className="pos-pill">
        {(player.position || 'PRO')} · {teamLabel}
      </div>

      <div className="name-block">
        <div className="first">{first}</div>
        <div className="last">{last}</div>
        <div className="team-tag">{player.team?.name || teamLabel}</div>
      </div>

      <div className="player-stats">
        <div className="player-stat">
          <div className="v">{Number(player.points_per_game ?? 0).toFixed(1)}</div>
          <div className="l">PPG</div>
        </div>
        <div className="player-stat">
          <div className="v">{Number(player.assists_per_game ?? 0).toFixed(1)}</div>
          <div className="l">APG</div>
        </div>
        <div className="player-stat">
          <div className="v">{Number(player.rebounds_per_game ?? 0).toFixed(1)}</div>
          <div className="l">RPG</div>
        </div>
        <div className="player-stat">
          <div className="v">
            {(
              ((Number(player.points_per_game ?? 0) +
                Number(player.rebounds_per_game ?? 0) +
                Number(player.assists_per_game ?? 0)) /
                3) || 0
            ).toFixed(0)}
          </div>
          <div className="l">EFF</div>
        </div>
      </div>
    </article>
  );
}

export default PlayerCard;
