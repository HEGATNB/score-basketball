import type { Team } from '@/shared/api/client';
import { getTeamBrand } from '@/shared/lib/teamBrand';

interface TeamMarkProps {
  team?: Pick<Team, 'name' | 'abbrev' | 'logoUrl' | 'brandColor' | 'accentColor'> | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showGlow?: boolean;
}

const SIZE_CLASS = {
  xs: 'h-7 w-7 rounded-md text-[10px]',
  sm: 'h-8 w-8 rounded-md text-[11px]',
  md: 'h-12 w-12 rounded-lg text-[15px]',
  lg: 'h-16 w-16 rounded-[14px] text-[22px]',
  xl: 'h-24 w-24 rounded-[20px] text-[34px]',
};

function getCode(team?: Pick<Team, 'name' | 'abbrev'> | null) {
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

export function TeamMark({ team, size = 'md', className = '', showGlow = false }: TeamMarkProps) {
  const brand = getTeamBrand({ abbrev: team?.abbrev, name: team?.name });
  const brandColor = team?.brandColor || brand.brandColor;
  const accentColor = team?.accentColor || brand.accentColor;
  const code = getCode(team);

  return (
    <span
      className={`team-sq inline-flex items-center justify-center font-display ${SIZE_CLASS[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
        boxShadow: showGlow ? `0 20px 50px -15px ${brandColor}99` : undefined,
        color: '#0a0a0c',
        letterSpacing: '0.02em',
      }}
      aria-label={team?.name || code}
    >
      {code}
    </span>
  );
}

export default TeamMark;
