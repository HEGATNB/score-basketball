import { useMemo, useState } from 'react';
import type { Team } from '@/shared/api/client';
import { getTeamBrand } from '@/shared/lib/teamBrand';

/**
 * Premium team mark — tries real NBA / ESPN logos first, then a gradient
 * square with the team's brand colours and the abbreviation as a fallback.
 *
 * Image sources, tried in order:
 *  1. team.logoUrl (whatever the backend / brand map provided)
 *  2. ESPN CDN at 500px scoreboard variant
 *  3. cdn.nba.com primary team logo
 *  4. Letter mark with team brand gradient
 */

interface TeamLogoProps {
  team?: Pick<Team, 'name' | 'abbrev' | 'logoUrl' | 'brandColor' | 'accentColor'> | null;
  /** Size token. Numbers also accepted for fine control */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  /** Coloured glow under the mark — for hero placements */
  showGlow?: boolean;
  /** Use a circle instead of the squircle */
  circle?: boolean;
}

const SIZE_PX: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 64,
  xl: 96,
};

// Hard-coded ESPN abbreviations for cases where our DB uses a different code
const ABBREV_ALIASES: Record<string, string> = {
  PHX: 'phx',
  BRK: 'bkn',
  CHA: 'cha',
  // most are identical, just lowercase
};

function buildLogoCandidates(team?: TeamLogoProps['team']): string[] {
  if (!team) return [];
  const list: string[] = [];

  if (team.logoUrl) list.push(team.logoUrl);

  const abbrevRaw = (team.abbrev || '').toUpperCase().trim();
  if (abbrevRaw) {
    const espnAbbrev = ABBREV_ALIASES[abbrevRaw] || abbrevRaw.toLowerCase();
    // ESPN CDN — most reliable, transparent PNG, premium quality
    list.push(`https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${espnAbbrev}.png`);
    list.push(`https://a.espncdn.com/i/teamlogos/nba/500/${espnAbbrev}.png`);
  }

  return list;
}

function getInitials(team?: TeamLogoProps['team']) {
  if (team?.abbrev) return team.abbrev.toUpperCase().slice(0, 3);
  const initials =
    team?.name
      ?.split(' ')
      .map((chunk) => chunk[0])
      .join('')
      .slice(0, 3)
      .toUpperCase() || 'NBA';
  return initials;
}

export function TeamLogo({
  team,
  size = 'md',
  className = '',
  showGlow = false,
  circle = false,
}: TeamLogoProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const brand = getTeamBrand({ abbrev: team?.abbrev, name: team?.name });
  const brandColor = team?.brandColor || brand.brandColor;
  const accentColor = team?.accentColor || brand.accentColor;

  const candidates = useMemo(() => buildLogoCandidates(team), [team]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(candidates.length === 0);

  const handleError = () => {
    if (idx + 1 < candidates.length) setIdx(idx + 1);
    else setFailed(true);
  };

  const radius = circle ? '999px' : `${Math.max(4, Math.round(px * 0.18))}px`;
  const code = getInitials(team);

  // Use container with light shadow + transparent inside for logos so the
  // alpha edges of the PNG don't pick up the gradient.
  const fontPx = Math.max(10, Math.round(px * 0.36));

  if (failed || candidates.length === 0) {
    return (
      <span
        className={`team-logo inline-flex items-center justify-center font-display ${className}`}
        style={{
          width: px,
          height: px,
          borderRadius: radius,
          background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
          color: '#0a0a0c',
          fontSize: fontPx,
          letterSpacing: '0.02em',
          boxShadow: showGlow ? `0 18px 50px -15px ${brandColor}aa` : undefined,
          flexShrink: 0,
        }}
        aria-label={team?.name || code}
      >
        {code}
      </span>
    );
  }

  return (
    <span
      className={`team-logo inline-flex items-center justify-center ${className}`}
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        background:
          'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08), rgba(20,20,28,0.6) 60%)',
        boxShadow: showGlow
          ? `0 18px 50px -15px ${brandColor}aa, inset 0 0 0 1px rgba(255,255,255,0.06)`
          : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
      aria-label={team?.name || code}
    >
      <img
        src={candidates[idx]}
        alt={team?.name || code}
        onError={handleError}
        referrerPolicy="no-referrer"
        loading="lazy"
        style={{
          width: '78%',
          height: '78%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
        }}
      />
    </span>
  );
}

export default TeamLogo;
