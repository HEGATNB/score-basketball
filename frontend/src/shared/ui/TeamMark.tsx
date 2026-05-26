import type { Team } from '@/shared/api/client';
import { TeamLogo } from './TeamLogo';

/**
 * Legacy alias for TeamLogo — kept so existing call sites keep working.
 * New code should import TeamLogo directly.
 */

interface TeamMarkProps {
  team?: Pick<Team, 'name' | 'abbrev' | 'logoUrl' | 'brandColor' | 'accentColor'> | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showGlow?: boolean;
}

export function TeamMark({ team, size = 'md', className = '', showGlow = false }: TeamMarkProps) {
  return <TeamLogo team={team} size={size} className={className} showGlow={showGlow} />;
}

export default TeamMark;
