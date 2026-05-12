// shared/ui/TeamMark.tsx
import { useEffect, useState, type CSSProperties } from 'react';
import type { Team } from '@/shared/api/client';
import { getTeamBrand, hexToRgba } from '@/shared/lib/teamBrand';

interface TeamMarkProps {
  team?: Pick<Team, 'name' | 'abbrev' | 'logoUrl' | 'brandColor' | 'accentColor'> | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_STYLES = {
  sm: 'h-10 w-10 rounded-[12px] text-[11px]',
  md: 'h-14 w-14 rounded-[14px] text-sm',
  lg: 'h-20 w-20 rounded-[18px] text-lg',
};

function getFallbackCode(team?: Pick<Team, 'name' | 'abbrev'> | null) {
  if (team?.abbrev) {
    return team.abbrev;
  }

  const initials =
    team?.name
      ?.split(' ')
      .map((chunk) => chunk[0])
      .join('')
      .slice(0, 3)
      .toUpperCase() || 'NBA';

  return initials;
}

// Функция для получения ссылки на логотип команды с basketball-reference.com
function getTeamLogoUrl(team?: Pick<Team, 'abbrev'> | null): string | null {
  if (!team?.abbrev) return null;
  
  // Basketball-reference использует трехбуквенные аббревиатуры
  const abbrev = team.abbrev.toUpperCase();
  return `https://www.basketball-reference.com/req/202503171/images/teams/${abbrev}.jpg`;
}

export function TeamMark({ team, size = 'md', className = '' }: TeamMarkProps) {
  const [broken, setBroken] = useState(false);
  const brand = getTeamBrand({ abbrev: team?.abbrev, name: team?.name });
  const brandColor = team?.brandColor || brand.brandColor;
  const accentColor = team?.accentColor || brand.accentColor;
  const logoUrl = team?.logoUrl || getTeamLogoUrl(team) || brand.logoUrl;
  
  const style: CSSProperties = {
    borderColor: hexToRgba(brandColor, 0.28),
    background: `linear-gradient(145deg, ${hexToRgba(brandColor, 0.18)}, ${hexToRgba(accentColor, 0.12)})`,
  };

  useEffect(() => {
    setBroken(false);
  }, [logoUrl]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border ${SIZE_STYLES[size]} ${className}`}
      style={style}
    >
      {!broken && logoUrl ? (
        <img
          src={logoUrl}
          alt={`${team?.name || brand.name} logo`}
          className="h-[100%] w-[100%] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="font-spacegrotesk font-bold tracking-[0.12em] text-white">{getFallbackCode(team)}</span>
      )}
    </div>
  );
}
