import type { Player } from '@/shared/api/client';
import { ArrowUpRight } from 'lucide-react';
import { getTeamBrand, hexToRgba } from '@/shared/lib/teamBrand';
import { GlowingCard } from './GlowingCard';
import { TeamMark } from './TeamMark';

interface PlayerCardProps {
  player: Player;
  delay?: number;
  onOpenDetails?: () => void;
}

function formatPlayerName(player: Player) {
  return player.full_name || `${player.first_name} ${player.last_name}`.trim();
}

function formatPlayerGames(games?: number) {
  return games?.toString() || 'N/A';
}

function formatPlayerWeight(weight?: number | string) {
  if (!weight) return 'N/A';
  const num = typeof weight === 'string' ? parseFloat(weight) : weight;
  return isNaN(num) ? 'N/A' : `${Math.round(num)} kg`;
}

function getPlayerImageUrl(player: Player) {
  if (player.image_url) return player.image_url;

  const firstName = player.first_name?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const lastName = player.last_name?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const lastNamePart = lastName.slice(0, 5);
  const firstNamePart = firstName.slice(0, 2);

  return `https://www.basketball-reference.com/req/202503171/images/players/${lastNamePart}${firstNamePart}01.jpg`;
}

function getPlayerFallbackImage(player: Player) {
  if (player.team?.logoUrl) return player.team.logoUrl;
  return getTeamBrand({ abbrev: player.team?.abbrev || player.team_abbrev }).logoUrl;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[32px] items-center justify-between gap-3 border-b border-white/6 pb-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium text-white">{value}</span>
    </div>
  );
}

export function PlayerCard({ player, delay = 0, onOpenDetails }: PlayerCardProps) {
  const teamBrand = getTeamBrand({ abbrev: player.team?.abbrev || player.team_abbrev, name: player.team?.name });
  const accentColor = player.team?.brandColor || teamBrand.brandColor;
  const fallbackImage = getPlayerFallbackImage(player);
  const playerImageUrl = getPlayerImageUrl(player);
  const teamLabel = player.team?.abbrev || player.team?.name || player.team_abbrev || 'NBA';
  const teamName = player.team?.name || player.team_abbrev || 'NBA roster';
  const topGlow = {
    background: `linear-gradient(180deg, rgba(255,246,229,0.02), rgba(255,246,229,0.01)), radial-gradient(circle at top right, ${hexToRgba(accentColor, 0.12)}, transparent 36%)`,
  };

  return (
    <GlowingCard
      glowColor="blue"
      delay={delay}
      className={`h-full overflow-hidden p-0 ${onOpenDetails ? 'cursor-pointer' : ''}`}
      onClick={onOpenDetails}
    >
      <div className="h-full p-5" style={topGlow}>
        <div
          className="mb-5 h-px w-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${hexToRgba(accentColor, 0.82)}, transparent 78%)` }}
        />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              {player.position || 'Player'} {player.number ? `/ #${player.number}` : ''}
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">{formatPlayerName(player)}</h3>
            {/* Блок с командой и сезоном */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{
                  color: hexToRgba(accentColor, 1),
                  borderColor: hexToRgba(accentColor, 0.24),
                  background: hexToRgba(accentColor, 0.1),
                }}
              >
                {teamLabel}
              </span>

              {/* Только текущий сезон, без переключателя */}
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                {player.season || 'Season n/a'}
              </span>
            </div>
          </div>
          <TeamMark team={player.team} size="sm" />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[104px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.02)]">
            <img
              src={playerImageUrl}
              alt={formatPlayerName(player)}
              className="h-[150px] w-full object-cover object-top"
              loading="lazy"
              decoding="async"
              onError={(event) => {
                (event.target as HTMLImageElement).src = fallbackImage;
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Season" value={player.season || 'N/A'} />
            <InfoTile label="Games" value={formatPlayerGames(player.games_played)} />
            <InfoTile label="Age" value={player.age ? String(player.age) : 'N/A'} />
            <InfoTile label="Country" value={player.country || 'N/A'} />
          </div>
        </div>

        <div className="mt-5 stat-grid grid-cols-3">
          <div className="stat-grid-cell">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">PTS</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{player.points_per_game.toFixed(1)}</p>
          </div>
          <div className="stat-grid-cell">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">REB</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{player.rebounds_per_game.toFixed(1)}</p>
          </div>
          <div className="stat-grid-cell">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AST</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{player.assists_per_game.toFixed(1)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <DetailRow label="Team" value={teamName} />
          <DetailRow label="Height" value={player.height || player.player_height || 'N/A'} />
          <DetailRow label="Weight" value={formatPlayerWeight(player.weight || player.player_weight)} />
          <DetailRow label="College" value={player.college || 'N/A'} />
        </div>

        {onOpenDetails && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails();
            }}
            className="btn-secondary mt-5 w-full justify-between"
          >
            Open player profile
            <ArrowUpRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </GlowingCard>
  );
}

export default PlayerCard;