import { useEffect, useMemo, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import type { Player } from '@/shared/api/client';
import { getTeamBrand } from '@/shared/lib/teamBrand';
import { getPlayerImageCandidates, getPlayerInitials } from '@/shared/lib/playerImage';

interface PlayerCardProps {
  player: Player;
  delay?: number;
  onOpenDetails?: () => void;
  highlight?: boolean;
}

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
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImgIdx(0);
    setAllFailed(candidates.length === 0);
    setImgLoaded(false);
  }, [candidates]);

  const safeImg = candidates[imgIdx];

  useEffect(() => {
    setImgLoaded(false);
  }, [safeImg]);

  useEffect(() => {
    if (!safeImg || imgLoaded || allFailed) return;
    const timer = window.setTimeout(() => {
      setImgIdx((current) => {
        const el = imgRef.current;
        if (el && el.naturalWidth > 0) {
          setImgLoaded(true);
          return current;
        }
        if (current !== imgIdx) return current;
        if (current + 1 >= candidates.length) {
          if (safeImg.includes('cdn.nba.com')) setAllFailed(true);
          return current;
        }
        return current + 1;
      });
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [allFailed, candidates.length, imgIdx, imgLoaded, safeImg]);

  const handleImgError = () => {
    if (imgIdx + 1 < candidates.length) setImgIdx(imgIdx + 1);
    else setAllFailed(true);
  };

  const fullName = buildName(player);
  const teamAbbrev = asText(player.team?.abbrev) || asText(player.team_abbrev) || 'NBA';
  const teamName = asText(player.team?.name) || teamAbbrev;
  const first = asText(player.first_name) || fullName.split(' ')[0] || '';
  const last =
    asText(player.last_name) || fullName.split(' ').slice(1).join(' ') || fullName;
  const number = asText(player.number);
  const position = asText(player.position) || 'PRO';

  const pts = asNumber(player.points_per_game);
  const ast = asNumber(player.assists_per_game);
  const reb = asNumber(player.rebounds_per_game);
  const eff = (pts + reb + ast) / 3;

  const hasPhoto = !allFailed && typeof safeImg === 'string' && safeImg.length > 0;

  return (
    <article
      onClick={onOpenDetails}
      className={`pc snap-start ${onOpenDetails ? 'cursor-pointer' : 'cursor-default'} ${
        highlight ? 'pc-highlight' : ''
      }`}
      style={
        {
          '--pc-brand': brandColor,
          '--pc-accent': accentColor,
        } as React.CSSProperties
      }
    >
      {/* Background — softer than before, photo is the hero */}
      <div className="pc-bg" />

      {hasPhoto ? (
        // Single <img> instead of background-image + hidden <img> (was
        // double-fetching every headshot). Lazy + async-decode keeps the
        // long player rails snappy as cards scroll into view.
        <div className="pc-photo">
          <img
            ref={imgRef}
            src={safeImg}
            alt={fullName}
            width={600}
            height={436}
            onError={handleImgError}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
            decoding="async"
            className="pc-photo-img"
          />
        </div>
      ) : (
        <div className="pc-fallback" aria-hidden>
          <UserRound className="pc-fallback-icon" />
          <span>{initials}</span>
        </div>
      )}

      <div className="pc-scrim" />

      {/* Top row: jersey number + position chip */}
      <div className="pc-top">
        {number && <span className="pc-jersey">#{number}</span>}
        <span className="pc-pos">
          {position} · {teamAbbrev}
        </span>
      </div>

      {/* Name block — magazine-style stacked */}
      <div className="pc-name">
        <span className="pc-first">{first}</span>
        <span className="pc-last">{last}</span>
        <span className="pc-team">{teamName}</span>
      </div>

      {/* Stats row — three big numbers + EFF chip */}
      <div className="pc-stats">
        <StatCell label="PPG" value={pts} accent />
        <StatCell label="RPG" value={reb} />
        <StatCell label="APG" value={ast} />
        <div className="pc-eff" title="Efficiency">
          <span className="pc-eff-val">{eff.toFixed(0)}</span>
          <span className="pc-eff-lbl">EFF</span>
        </div>
      </div>
    </article>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={`pc-stat ${accent ? 'pc-stat-accent' : ''}`}>
      <span className="pc-stat-v tab-num">{value.toFixed(1)}</span>
      <span className="pc-stat-l">{label}</span>
    </div>
  );
}

export default PlayerCard;
