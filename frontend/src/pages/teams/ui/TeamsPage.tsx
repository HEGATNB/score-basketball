import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Trophy } from 'lucide-react';
import { apiRequest, type Team } from '@/shared/api/client';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { TeamMark } from '@/shared/ui/TeamMark';
import { hexToRgba } from '@/shared/lib/teamBrand';

type TeamView = 'standings' | 'cards';
type ConferenceFilter = 'all' | 'Eastern' | 'Western';

function getWinRate(team: Team) {
  const totalGames = team.wins + team.losses;
  return totalGames > 0 ? (team.wins / totalGames) * 100 : 0;
}

function getDifferential(team: Team) {
  return team.avgPointsFor - team.avgPointsAgainst;
}

function formatRecord(team: Team) {
  return `${team.wins}-${team.losses}`;
}

export const TeamsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<TeamView>('standings');
  const [conference, setConference] = useState<ConferenceFilter>('all');

  useEffect(() => {
    apiRequest<Team[]>('/teams')
      .then((data) => setTeams(data.sort((left, right) => right.wins - left.wins)))
      .catch(() => setError('Could not load teams right now.'))
      .finally(() => setLoading(false));
  }, []);

  const formatTeamMeta = (team: Team) => {
    return `${team.city || 'Unknown city'} / ${team.division?.name || t('teams.division')}`;
  };

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();

    return teams.filter((team) => {
      const teamConference = team.conference?.name || '';
      const matchesConference = conference === 'all' || teamConference === conference;
      if (!matchesConference) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [team.name, team.city, team.abbrev, team.division?.name, team.conference?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [conference, search, teams]);

  const leagueAverageOffense = useMemo(() => {
    if (!teams.length) {
      return 0;
    }

    return teams.reduce((sum, team) => sum + team.avgPointsFor, 0) / teams.length;
  }, [teams]);

  const strongestDifferential = useMemo(() => {
    if (!teams.length) {
      return null;
    }

    return [...teams].sort((left, right) => getDifferential(right) - getDifferential(left))[0];
  }, [teams]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <GlowingCard glowColor="orange" className="p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="data-chip">
                <Trophy className="h-3.5 w-3.5" />
                {t('teams.board')}
              </span>
              <span className="data-chip">{t('teams.clubsLoaded', { count: teams.length })}</span>
            </div>

            <h1 className="mt-4 max-w-3xl font-spacegrotesk text-3xl font-bold text-white sm:text-4xl">
              {t('teams.title')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {t('teams.subtitle')}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('teams.searchTeams')}</label>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('teams.searchPlaceholder')}
                  className="field-shell py-3 pl-12 pr-4"
                  style={{ textIndent: '26px' }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('teams.view')}</p>
                <div className="segmented-bar mt-3">
                  {([
                    ['standings', t('teams.standings')],
                    ['cards', t('teams.cards')],
                  ] as Array<[TeamView, string]>).map(([option, label]) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setView(option)}
                      className={`segmented-item ${view === option ? 'segmented-item-active' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('teams.conference')}</p>
                <div className="segmented-bar mt-3">
                  {([
                    ['all', t('teams.all')],
                    ['Eastern', t('teams.east')],
                    ['Western', t('teams.west')],
                  ] as Array<[ConferenceFilter, string]>).map(([option, label]) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setConference(option)}
                      className={`segmented-item ${conference === option ? 'segmented-item-active' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('teams.topRecord')}</p>
            <p className="mt-2 text-base font-semibold text-white">{teams[0]?.name || t('common.unavailable')}</p>
            <p className="mt-1 text-sm text-slate-400">{teams[0] ? `${teams[0].wins}-${teams[0].losses}` : t('teams.noData')}</p>
          </div>
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('teams.leagueOffense')}</p>
            <p className="mt-2 text-base font-semibold text-white">{leagueAverageOffense.toFixed(1)} PPG</p>
            <p className="mt-1 text-sm text-slate-400">{t('teams.averageAcross')}</p>
          </div>
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('teams.bestDifferential')}</p>
            <p className="mt-2 text-base font-semibold text-white">{strongestDifferential?.abbrev || '--'}</p>
            <p className="mt-1 text-sm text-slate-400">
              {strongestDifferential ? t('teams.netPoints', { value: getDifferential(strongestDifferential).toFixed(1) }) : t('teams.noData')}
            </p>
          </div>
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('teams.visibleTeams')}</p>
            <p className="mt-2 text-base font-semibold text-white">{filteredTeams.length}</p>
            <p className="mt-1 text-sm text-slate-400">{t('teams.withinView')}</p>
          </div>
        </div>
      </GlowingCard>

      {view === 'standings' ? (
        <GlowingCard glowColor="green" className="overflow-hidden p-0">
          <div className="hidden lg:block">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: '72px' }} />
                <col />
                <col style={{ width: '110px' }} />
                <col style={{ width: '96px' }} />
                <col style={{ width: '96px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '96px' }} />
              </colgroup>
              <thead className="bg-white/[0.02]">
                <tr className="border-b border-white/8">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('teams.rank')}
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('teams.team')}
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('teams.record')}
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('teams.winRate')}
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('teams.for')}
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('teams.allowed')}
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('teams.net')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team, index) => {
                  const differential = getDifferential(team);

                  return (
                    <tr
                      key={team.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/teams/${team.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/teams/${team.id}`);
                        }
                      }}
                      className="cursor-pointer border-t border-white/6 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:outline-none"
                    >
                      <td className="relative px-5 py-4 align-middle">
                        <span
                          className="absolute bottom-4 left-0 top-4 w-[2px] rounded-full"
                          style={{ backgroundColor: hexToRgba(team.brandColor || '#c96a2b', 0.45) }}
                        />
                        <span className="text-sm font-semibold text-slate-500">#{index + 1}</span>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex min-w-0 items-center gap-4">
                          <TeamMark team={team} size="md" />
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-white">{team.name}</p>
                            <p className="truncate text-sm text-slate-400">{formatTeamMeta(team)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right align-middle text-sm font-semibold tabular-nums text-white">
                        {formatRecord(team)}
                      </td>
                      <td className="px-5 py-4 text-right align-middle text-sm tabular-nums text-slate-300">
                        {getWinRate(team).toFixed(1)}%
                      </td>
                      <td className="px-5 py-4 text-right align-middle text-sm tabular-nums text-slate-300">
                        {team.avgPointsFor.toFixed(1)}
                      </td>
                      <td className="px-5 py-4 text-right align-middle text-sm tabular-nums text-slate-300">
                        {team.avgPointsAgainst.toFixed(1)}
                      </td>
                      <td
                        className={`px-5 py-4 text-right align-middle text-sm font-semibold tabular-nums ${
                          differential >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {differential >= 0 ? '+' : ''}
                        {differential.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden">
            {filteredTeams.map((team, index) => {
              const differential = getDifferential(team);

              return (
                <Link
                  key={team.id}
                  to={`/teams/${team.id}`}
                  className="table-row block border-l-2 border-l-transparent px-5 py-4"
                  style={{ borderLeftColor: hexToRgba(team.brandColor || '#c96a2b', 0.45) }}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-1 text-sm font-semibold text-slate-500">#{index + 1}</div>
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <TeamMark team={team} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">{team.name}</p>
                        <p className="truncate text-sm text-slate-400">{formatTeamMeta(team)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('teams.record')}</p>
                      <p className="mt-2 text-sm font-semibold tabular-nums text-white">{formatRecord(team)}</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('teams.winRate')}</p>
                      <p className="mt-2 text-sm tabular-nums text-white">{getWinRate(team).toFixed(1)}%</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('teams.for')}</p>
                      <p className="mt-2 text-sm tabular-nums text-white">{team.avgPointsFor.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('teams.allowed')}</p>
                      <p className="mt-2 text-sm tabular-nums text-white">{team.avgPointsAgainst.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('teams.net')}</p>
                      <p className={`mt-2 text-sm font-semibold tabular-nums ${differential >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {differential >= 0 ? '+' : ''}
                        {differential.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </GlowingCard>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTeams.map((team) => (
            <Link key={team.id} to={`/teams/${team.id}`}>
              <GlowingCard glowColor={getDifferential(team) >= 0 ? 'green' : 'purple'} className="h-full p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {team.conference?.shortName || team.conference?.name || 'League'}
                    </p>
                    <h2 className="mt-2 truncate text-2xl font-semibold text-white">{team.name}</h2>
                    <p className="mt-1 truncate text-sm text-slate-400">{team.arena || 'Arena unavailable'}</p>
                  </div>
                  <TeamMark team={team} size="lg" />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="surface-muted">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('teams.record')}</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                      {team.wins}-{team.losses}
                    </p>
                  </div>
                  <div className="surface-muted">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('teams.net')}</p>
                    <p className={`mt-2 text-xl font-semibold tabular-nums ${getDifferential(team) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {getDifferential(team) >= 0 ? '+' : ''}
                      {getDifferential(team).toFixed(1)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                  <span>{team.avgPointsFor.toFixed(1)} scored</span>
                  <span>{team.avgPointsAgainst.toFixed(1)} allowed</span>
                </div>
              </GlowingCard>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
};

export default TeamsPage;