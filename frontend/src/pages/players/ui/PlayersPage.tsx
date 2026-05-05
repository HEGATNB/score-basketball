import { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, Users, X } from 'lucide-react';
import { apiRequest, type Player } from '@/shared/api/client';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { PlayerCard } from '@/shared/ui/PlayerCard';
import { TeamMark } from '@/shared/ui/TeamMark';
import { SeasonSelector } from '@/shared/ui/SeasonSelector';
import { hexToRgba } from '@/shared/lib/teamBrand';

type PlayersView = 'cards' | 'board';

function getPlayerImageUrl(player: Player): string {
  if (player.image_url) return player.image_url;

  const firstName = player.first_name?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const lastName = player.last_name?.toLowerCase().replace(/[^a-z]/g, '') || '';

  const lastNamePart = lastName.slice(0, 5);
  const firstNamePart = firstName.slice(0, 2);

  return `https://www.basketball-reference.com/req/202503171/images/players/${lastNamePart}${firstNamePart}01.jpg`;
}

function getPlayerFallbackImage(player: Player) {
  if (player.team?.logoUrl) return player.team.logoUrl;
  return 'https://www.basketball-reference.com/req/202503171/images/league/NBA_logo.png';
}

function formatFullName(player: Player) {
  return player.full_name || `${player.first_name} ${player.last_name}`.trim();
}

function getPlayerArchetype(player: Player) {
  if (player.points_per_game >= 28 && player.assists_per_game >= 6) return 'offensive engine';
  if (player.assists_per_game >= 8) return 'lead playmaker';
  if (player.rebounds_per_game >= 10 && (player.blocks_per_game || 0) >= 1) return 'interior anchor';
  if (player.points_per_game >= 22) return 'primary scorer';
  if (player.rebounds_per_game >= 8) return 'frontcourt finisher';
  return 'rotation connector';
}

function getPlayerSummary(player: Player) {
  const name = formatFullName(player);
  const teamName = player.team?.name || 'his team';
  return `${name} profiles as a ${getPlayerArchetype(player)} for ${teamName}, bringing ${player.points_per_game.toFixed(1)} points and ${player.assists_per_game.toFixed(1)} assists per game.`;
}

export default function PlayersPage() {
  const { t } = useLanguage();
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<PlayersView>('cards');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [seasonDataCache, setSeasonDataCache] = useState<Record<string, Player>>({});

  useEffect(() => {
    apiRequest<Player[]>('/players?min_games=0')
      .then(setPlayers)
      .catch((error) => console.error('Failed to load players', error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPlayer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPlayer(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPlayer]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) =>
      [formatFullName(player), player.team?.name, player.position]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [players, search]);

  const loadPlayerSeasonData = async (playerName: string, season: string): Promise<Player | null> => {
    if (!playerName || playerName === 'undefined') return null;

    const cacheKey = `${playerName}_${season}`;
    if (seasonDataCache[cacheKey]) return seasonDataCache[cacheKey];

    try {
      const encodedName = encodeURIComponent(playerName);
      const url = `/players?search=${encodedName}&season=${season}&min_games=0`;
      const playersData = await apiRequest<Player[]>(url);

      const playerData = playersData.find(p => {
        const pName = p.full_name || `${p.first_name} ${p.last_name}`.trim();
        return pName === playerName;
      });

      if (playerData) {
        setSeasonDataCache(prev => ({ ...prev, [cacheKey]: playerData }));
        return playerData;
      }
      return null;
    } catch (error) {
      console.error('Failed to load player season data', error);
      return null;
    }
  };

  const handleSeasonChange = async (newSeason: string) => {
    if (!selectedPlayer) return;

    const playerName = selectedPlayer.full_name || formatFullName(selectedPlayer);
    const seasonData = await loadPlayerSeasonData(playerName, newSeason);

    if (seasonData) {
      const updatedPlayer = {
        ...selectedPlayer,
        points_per_game: seasonData.points_per_game,
        rebounds_per_game: seasonData.rebounds_per_game,
        assists_per_game: seasonData.assists_per_game,
        minutes_per_game: seasonData.minutes_per_game,
        games_played: seasonData.games_played,
        season: newSeason,
        seasons: selectedPlayer.seasons,
        true_shooting: seasonData.true_shooting,
        usage_rate: seasonData.usage_rate,
        assist_percentage: seasonData.assist_percentage,
        net_rating: seasonData.net_rating,
        offensive_rebound_pct: seasonData.offensive_rebound_pct,
        defensive_rebound_pct: seasonData.defensive_rebound_pct,
        steals_per_game: seasonData.steals_per_game,
        blocks_per_game: seasonData.blocks_per_game,
      };

      setSelectedPlayer(updatedPlayer);

      setPlayers(prevPlayers =>
        prevPlayers.map(p => {
          const pName = p.full_name || formatFullName(p);
          if (pName === playerName) {
            return {
              ...p,
              points_per_game: seasonData.points_per_game,
              rebounds_per_game: seasonData.rebounds_per_game,
              assists_per_game: seasonData.assists_per_game,
              minutes_per_game: seasonData.minutes_per_game,
              games_played: seasonData.games_played,
              season: newSeason,
              seasons: p.seasons,
            };
          }
          return p;
        })
      );
    }
  };

  const handleOpenProfile = (player: Player) => {
    const playerName = player.full_name || formatFullName(player);
    const currentPlayerData = players.find(p =>
      (p.full_name || formatFullName(p)) === playerName
    );

    if (currentPlayerData) {
      setSelectedPlayer({
        ...currentPlayerData,
        seasons: currentPlayerData.seasons || player.seasons,
      });
    } else {
      setSelectedPlayer(player);
    }
  };

  const topScorer = filteredPlayers[0];
  const topPlaymaker = [...filteredPlayers].sort((a, b) => b.assists_per_game - a.assists_per_game)[0];
  const averagePoints = filteredPlayers.length > 0
    ? filteredPlayers.reduce((sum, p) => sum + p.points_per_game, 0) / filteredPlayers.length
    : 0;

  return (
    <div className="space-y-6">
      <GlowingCard glowColor="orange" className="p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-xl text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[rgba(236,216,171,0.72)]">{t('players.title')}</p>
                <h1 className="mt-2 font-spacegrotesk text-3xl font-bold text-white sm:text-4xl">
                  {t('players.title')}
                </h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              {t('players.subtitle')}
            </p>
          </div>
          <div className="w-full max-w-[360px] space-y-5">
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('players.searchPlaceholder')}</label>
              <div className="relative mt-3">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('players.searchPlaceholder')}
                  className="field-shell py-3 pl-12 pr-4"
                  style={{ textIndent: '26px' }}
                />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('players.view')}</p>
              <div className="segmented-bar mt-3">
                {(['cards', 'board'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setView(option)}
                    className={`segmented-item ${view === option ? 'segmented-item-active' : ''}`}
                  >
                    {option === 'cards' ? t('players.cards') : t('players.board')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('players.topScorer')}</p>
            <p className="mt-2 text-base font-semibold text-white">{topScorer ? formatFullName(topScorer) : t('common.unavailable')}</p>
            <p className="mt-1 text-sm text-slate-400">{topScorer ? `${topScorer.points_per_game.toFixed(1)} PTS` : t('teams.noData')}</p>
          </div>
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('players.topPlaymaker')}</p>
            <p className="mt-2 text-base font-semibold text-white">{topPlaymaker ? formatFullName(topPlaymaker) : t('common.unavailable')}</p>
            <p className="mt-1 text-sm text-slate-400">{topPlaymaker ? `${topPlaymaker.assists_per_game.toFixed(1)} AST` : t('teams.noData')}</p>
          </div>
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('players.averageScoring')}</p>
            <p className="mt-2 text-base font-semibold text-white">{averagePoints.toFixed(1)} PPG</p>
            <p className="mt-1 text-sm text-slate-400">{t('players.acrossSet')}</p>
          </div>
          <div className="surface-muted text-sm text-slate-300">
            <Sparkles className="mr-2 inline h-4 w-4 text-[#ddb36a]" />
            {t('players.clickPrompt')}
          </div>
        </div>
      </GlowingCard>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
        </div>
      ) : view === 'cards' ? (
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPlayers.map((player, index) => (
            <PlayerCard
              key={player.id}
              player={player}
              summary={getPlayerSummary(player)}
              delay={index * 0.03}
              onOpenDetails={() => handleOpenProfile(player)}
            />
          ))}
        </section>
      ) : (
        <GlowingCard glowColor="green" className="overflow-hidden p-0">
          <div className="hidden lg:block">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col />
                <col style={{ width: '180px' }} />
                <col style={{ width: '72px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
              </colgroup>
              <thead className="bg-white/[0.02]">
                <tr className="border-b border-white/8">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('players.player')}</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('players.team')}</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('players.position')}</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">MIN</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">PTS</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">REB</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">AST</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => {
                  const playerImageUrl = getPlayerImageUrl(player);
                  const fallbackImage = getPlayerFallbackImage(player);
                  return (
                    <tr key={player.id} className="border-t border-white/6 transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-4 align-middle">
                        <div className="flex min-w-0 items-center gap-4">
                          <img
                            src={playerImageUrl}
                            alt={formatFullName(player)}
                            className="h-14 w-14 shrink-0 rounded-[12px] border border-white/8 object-cover object-top"
                            loading="lazy"
                            onError={(e) => (e.currentTarget.src = fallbackImage)}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-white">{formatFullName(player)}</p>
                            <button
                              onClick={() => handleOpenProfile(player)}
                              className="mt-1 truncate text-left text-xs uppercase tracking-[0.16em] text-slate-500 transition hover:text-white"
                            >
                              {t('players.openProfile')}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <TeamMark team={player.team} size="sm" />
                          <span className="truncate text-sm text-white">{player.team?.abbrev || player.team?.name || 'NBA'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center align-middle text-sm text-slate-300">{player.position || 'N/A'}</td>
                      <td className="px-5 py-4 text-right align-middle text-sm tabular-nums text-white">{player.minutes_per_game?.toFixed(1) || '0.0'}</td>
                      <td className="px-5 py-4 text-right align-middle text-sm font-semibold tabular-nums text-white">{player.points_per_game.toFixed(1)}</td>
                      <td className="px-5 py-4 text-right align-middle text-sm tabular-nums text-white">{player.rebounds_per_game.toFixed(1)}</td>
                      <td className="px-5 py-4 text-right align-middle text-sm tabular-nums text-white">{player.assists_per_game.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden">
            {filteredPlayers.map((player) => {
              const playerImageUrl = getPlayerImageUrl(player);
              const fallbackImage = getPlayerFallbackImage(player);
              return (
                <div key={player.id} className="border-b border-white/6 p-5 last:border-0">
                  <div className="flex min-w-0 items-center gap-4">
                    <img
                      src={playerImageUrl}
                      alt={formatFullName(player)}
                      className="h-14 w-14 shrink-0 rounded-[12px] border border-white/8 object-cover object-top"
                      onError={(e) => (e.currentTarget.src = fallbackImage)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">{formatFullName(player)}</p>
                      <button
                        onClick={() => handleOpenProfile(player)}
                        className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500 transition hover:text-white"
                      >
                        {t('players.openProfile')}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('players.team')}</span>
                    <div className="flex items-center gap-3">
                      <TeamMark team={player.team} size="sm" />
                      <span className="truncate text-sm text-white">{player.team?.abbrev || player.team?.name || 'NBA'}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('players.position')}</p>
                      <p className="mt-2 text-sm text-white">{player.position || 'N/A'}</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">MIN</p>
                      <p className="mt-2 text-sm tabular-nums text-white">{player.minutes_per_game?.toFixed(1) || '0.0'}</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">PTS</p>
                      <p className="mt-2 text-sm font-semibold tabular-nums text-white">{player.points_per_game.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">REB</p>
                      <p className="mt-2 text-sm tabular-nums text-white">{player.rebounds_per_game.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">AST</p>
                      <p className="mt-2 text-sm tabular-nums text-white">{player.assists_per_game.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlowingCard>
      )}

      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,4,6,0.85)] px-4 py-6 backdrop-blur-md"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setSelectedPlayer(null)}
        >
          <div className="h-full max-h-[90vh] w-full max-w-6xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            <GlowingCard glowColor="orange" className="overflow-hidden p-0">
              <div className="border-b border-white/8 bg-gradient-to-r from-[rgba(201,106,43,0.08)] to-transparent px-6 py-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('players.searchPlaceholder')}</label>
                  <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('players.searchPlaceholder')}
                      className="field-shell py-3 pl-4 pr-4"
                      style={{ textIndent: '26px' }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-6 p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div>
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <img
                      src={getPlayerImageUrl(selectedPlayer)}
                      alt={formatFullName(selectedPlayer)}
                      className="aspect-[3/4] w-full object-cover object-top"
                      onError={(e) => (e.currentTarget.src = getPlayerFallbackImage(selectedPlayer))}
                    />
                  </div>

                  <div className="mt-4">
                    <h3 className="text-2xl font-bold text-white">{formatFullName(selectedPlayer)}</h3>
                    <p className="mt-1 text-sm uppercase tracking-[0.18em] text-orange-400">
                      {selectedPlayer.team?.name || 'NBA roster'}
                    </p>

                    {selectedPlayer.seasons && selectedPlayer.seasons.length > 1 && (
                      <div className="mt-4">
                        <SeasonSelector
                          seasons={selectedPlayer.seasons}
                          currentSeason={selectedPlayer.season || selectedPlayer.seasons[0]}
                          onSeasonChange={handleSeasonChange}
                        />
                      </div>
                    )}

                    <p className="mt-3 text-sm text-slate-300">
                      {selectedPlayer.season || 'N/A'} season • {selectedPlayer.games_played || 0} GP • {selectedPlayer.position || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-5 gap-3">
                    <div className="surface-muted text-center">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Age</p>
                      <p className="mt-2 text-lg font-semibold text-white">{selectedPlayer.age || 'N/A'}</p>
                    </div>
                    <div className="surface-muted text-center">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Height</p>
                      <p className="mt-2 text-lg font-semibold text-white">{selectedPlayer.height || 'N/A'}</p>
                    </div>
                    <div className="surface-muted text-center">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Weight</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {selectedPlayer.weight ? `${Math.round(selectedPlayer.weight)} kg` : 'N/A'}
                      </p>
                    </div>
                    <div className="surface-muted text-center">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('players.position')}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{selectedPlayer.position || 'N/A'}</p>
                    </div>
                    <div className="surface-muted text-center">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Number</p>
                      <p className="mt-2 text-lg font-semibold text-white">#{selectedPlayer.number || '--'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-semibold text-white">Per Game Averages</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">PTS</p>
                        <p className="mt-2 text-2xl font-bold tabular-nums text-orange-400">
                          {selectedPlayer.points_per_game.toFixed(1)}
                        </p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">REB</p>
                        <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                          {selectedPlayer.rebounds_per_game.toFixed(1)}
                        </p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">AST</p>
                        <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                          {selectedPlayer.assists_per_game.toFixed(1)}
                        </p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">MIN</p>
                        <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                          {selectedPlayer.minutes_per_game?.toFixed(1) || '0.0'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-semibold text-white">Shooting Efficiency</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">TS%</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                          {selectedPlayer.true_shooting ? `${(selectedPlayer.true_shooting * 100).toFixed(1)}%` : 'N/A'}
                        </p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">USG%</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                          {selectedPlayer.usage_rate ? `${(selectedPlayer.usage_rate * 100).toFixed(1)}%` : 'N/A'}
                        </p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">AST%</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                          {selectedPlayer.assist_percentage ? `${(selectedPlayer.assist_percentage * 100).toFixed(1)}%` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-semibold text-white">Advanced</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Net RTG</p>
                        <p className="mt-2 text-lg font-semibold tabular-nums text-white">
                          {selectedPlayer.net_rating?.toFixed(1) || 'N/A'}
                        </p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">OREB%</p>
                        <p className="mt-2 text-lg font-semibold tabular-nums text-white">
                          {selectedPlayer.offensive_rebound_pct ? `${(selectedPlayer.offensive_rebound_pct * 100).toFixed(1)}%` : 'N/A'}
                        </p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">DREB%</p>
                        <p className="mt-2 text-lg font-semibold tabular-nums text-white">
                          {selectedPlayer.defensive_rebound_pct ? `${(selectedPlayer.defensive_rebound_pct * 100).toFixed(1)}%` : 'N/A'}
                        </p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">STL</p>
                        <p className="mt-2 text-lg font-semibold tabular-nums text-white">
                          {selectedPlayer.steals_per_game?.toFixed(1) || '0.0'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-semibold text-white">Background</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">College</p>
                        <p className="mt-2 text-sm font-medium text-white">{selectedPlayer.college || 'N/A'}</p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Country</p>
                        <p className="mt-2 text-sm font-medium text-white">{selectedPlayer.country || 'N/A'}</p>
                      </div>
                      <div className="surface-muted text-center">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Draft</p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {selectedPlayer.draft_year ? `${selectedPlayer.draft_year} R${selectedPlayer.draft_round || '?'}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/8 bg-white/[0.02] px-6 py-4">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-white">{formatFullName(selectedPlayer)}</span>
                  <span className="mx-2 text-slate-500">•</span>
                  <span className="uppercase">{selectedPlayer.team?.name || 'NBA'}</span>
                  <span className="mx-2 text-slate-500">•</span>
                  <span>{selectedPlayer.season || 'N/A'} season</span>
                  <span className="mx-2 text-slate-500">•</span>
                  <span className="text-orange-400">{selectedPlayer.points_per_game.toFixed(1)} PTS</span>
                  <span className="mx-2 text-slate-500">•</span>
                  <span>{selectedPlayer.rebounds_per_game.toFixed(1)} REB</span>
                  <span className="mx-2 text-slate-500">•</span>
                  <span>{selectedPlayer.assists_per_game.toFixed(1)} AST</span>
                </p>
              </div>
            </GlowingCard>
          </div>
        </div>
      )}
    </div>
  );
}