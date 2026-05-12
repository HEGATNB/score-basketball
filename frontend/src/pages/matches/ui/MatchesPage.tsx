import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Trophy } from 'lucide-react';
import { apiRequest, type Match } from '@/shared/api/client';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { TeamMark } from '@/shared/ui/TeamMark';
import { hexToRgba } from '@/shared/lib/teamBrand';

type FilterMode = 'all' | 'scheduled' | 'finished';

function formatGameDay(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatGameTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MatchesPage = () => {
  const { t } = useLanguage();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    apiRequest<Match[]>('/matches')
      .then(setMatches)
      .catch((error) => console.error('Failed to load matches', error))
      .finally(() => setLoading(false));
  }, []);

  const filteredMatches = useMemo(() => {
    if (filter === 'all') {
      return matches;
    }

    return matches.filter((match) => match.status === filter);
  }, [filter, matches]);

  const finishedCount = matches.filter((match) => match.status === 'finished').length;
  const scheduledCount = matches.filter((match) => match.status === 'scheduled').length;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GlowingCard glowColor="orange" className="p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="data-chip">
                <CalendarRange className="h-3.5 w-3.5" />
                {t('matches.board')}
              </span>
              <span className="data-chip">{t('matches.gamesInFeed', { count: matches.length })}</span>
            </div>

            <h1 className="mt-4 max-w-3xl font-spacegrotesk text-3xl font-bold text-white sm:text-4xl">
              {t('matches.title')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {t('matches.subtitle')}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('matches.filter')}</p>
            <div className="segmented-bar mt-3">
              {([
                ['all', t('matches.allGames')],
                ['scheduled', t('matches.upcoming')],
                ['finished', t('matches.finals')],
              ] as Array<[FilterMode, string]>).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`segmented-item ${filter === value ? 'segmented-item-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="surface-muted mt-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('matches.currentFocus')}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {filter === 'all' && t('matches.allDesc')}
                {filter === 'scheduled' && t('matches.upcomingDesc')}
                {filter === 'finished' && t('matches.finalsDesc')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('matches.finished')}</p>
            <p className="mt-2 text-base font-semibold text-white">{finishedCount}</p>
            <p className="mt-1 text-sm text-slate-400">{t('matches.finishedDesc')}</p>
          </div>
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('matches.upcomingCount')}</p>
            <p className="mt-2 text-base font-semibold text-white">{scheduledCount}</p>
            <p className="mt-1 text-sm text-slate-400">{t('matches.upcomingCountDesc')}</p>
          </div>
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('matches.currentView')}</p>
            <p className="mt-2 text-base font-semibold capitalize text-white">{filter}</p>
            <p className="mt-1 text-sm text-slate-400">{t('matches.selectedBoard')}</p>
          </div>
          <div className="surface-muted">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('matches.visibleGames')}</p>
            <p className="mt-2 text-base font-semibold text-white">{filteredMatches.length}</p>
            <p className="mt-1 text-sm text-slate-400">{t('matches.listedBelow')}</p>
          </div>
        </div>
      </GlowingCard>

      <GlowingCard glowColor="green" className="overflow-hidden p-0">
        <div className="hidden lg:block">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: '170px' }} />
              <col />
              <col style={{ width: '180px' }} />
              <col style={{ width: '100px' }} />
            </colgroup>
            <thead className="bg-white/[0.02]">
              <tr className="border-b border-white/8">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('matches.date')}
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('matches.matchup')}
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('matches.status')}
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('matches.score')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.map((match) => {
                const statusTone =
                  match.status === 'finished'
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                    : 'border-amber-400/20 bg-amber-500/10 text-amber-100';

                return (
                  <tr key={match.id} className="border-t border-white/6 transition-colors hover:bg-white/[0.03]">
                    <td className="relative px-5 py-4 align-middle">
                      <span
                        className="absolute bottom-4 left-0 top-4 w-[2px] rounded-full"
                        style={{ backgroundColor: hexToRgba(match.homeTeam.brandColor || '#c96a2b', 0.45) }}
                      />
                      <p className="text-sm font-semibold text-white">{formatGameDay(match.date)}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatGameTime(match.date)}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="space-y-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <TeamMark team={match.homeTeam} size="sm" />
                          <span className="truncate text-sm font-semibold text-white">{match.homeTeam.name}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <TeamMark team={match.awayTeam} size="sm" />
                          <span className="truncate text-sm font-semibold text-white">{match.awayTeam.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="space-y-2">
                        <span className={`status-pill ${statusTone}`}>
                          {match.status === 'finished' ? t('matches.final') : t('matches.scheduled')}
                        </span>
                        <div>
                          <Link
                            to={`/matches/${match.id}`}
                            className="text-xs uppercase tracking-[0.16em] text-slate-500 transition hover:text-white"
                          >
                            {t('matches.openDetail')}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      <div className="space-y-2">
                        <p className="text-base font-semibold tabular-nums text-white">{match.homeScore ?? '--'}</p>
                        <p className="text-base font-semibold tabular-nums text-white">{match.awayScore ?? '--'}</p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden">
          {filteredMatches.map((match) => {
            const statusTone =
              match.status === 'finished'
                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                : 'border-amber-400/20 bg-amber-500/10 text-amber-100';

            return (
              <Link
                key={match.id}
                to={`/matches/${match.id}`}
                className="table-row block border-l-2 border-l-transparent px-5 py-4"
                style={{ borderLeftColor: hexToRgba(match.homeTeam.brandColor || '#c96a2b', 0.45) }}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{formatGameDay(match.date)}</p>
                  <p className="mt-1 text-sm text-slate-400">{formatGameTime(match.date)}</p>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <TeamMark team={match.homeTeam} size="sm" />
                    <span className="truncate text-sm font-semibold text-white">{match.homeTeam.name}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <TeamMark team={match.awayTeam} size="sm" />
                    <span className="truncate text-sm font-semibold text-white">{match.awayTeam.name}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <span className={`status-pill ${statusTone}`}>
                      {match.status === 'finished' ? t('matches.final') : t('matches.scheduled')}
                    </span>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{t('matches.openDetail')}</p>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className="text-base font-semibold tabular-nums text-white">{match.homeScore ?? '--'}</p>
                    <p className="text-base font-semibold tabular-nums text-white">{match.awayScore ?? '--'}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </GlowingCard>

      {filteredMatches.length === 0 && (
        <GlowingCard glowColor="purple" className="p-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-4 text-white">{t('matches.noMatches')}</p>
        </GlowingCard>
      )}
    </div>
  );
};

export default MatchesPage;