import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Radio, RefreshCw, Search, X } from 'lucide-react';
import { apiRequest, type Match } from '@/shared/api/client';
import { useLiveScoreboard } from '@/shared/hooks/useLiveScoreboard';
import { useLanguage, useT } from '@/shared/i18n';
import { predictionLink, ScoreRow } from '@/shared/ui/ScoreRow';
import './matches.css';

type Status = 'all' | 'live' | 'scheduled' | 'finished';
type ArchiveStatus = 'scheduled' | 'finished';

const statuses: Status[] = ['all', 'live', 'scheduled', 'finished'];
const archiveStatuses: ArchiveStatus[] = ['scheduled', 'finished'];
const pageSize = 12;

function dateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function groupByDay(matches: Match[]) {
  const days = new Map<string, Match[]>();
  for (const match of matches) {
    const day = dateKey(match.date);
    const current = days.get(day) ?? [];
    current.push(match);
    days.set(day, current);
  }
  return [...days.entries()];
}

export function MatchesPage() {
  const t = useT();
  const { language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [archive, setArchive] = useState<Partial<Record<ArchiveStatus, Match[]>>>({});
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [visible, setVisible] = useState({ key: '', count: pageSize });
  const live = useLiveScoreboard();

  const requestedStatus = params.get('status') as Status | null;
  const status = requestedStatus && statuses.includes(requestedStatus) ? requestedStatus : 'all';
  const query = params.get('q') ?? '';
  const search = query.trim().toLocaleLowerCase(language);
  const date = params.get('date') ?? '';
  const key = [status, search, date].join('|');
  const count = visible.key === key ? visible.count : pageSize;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setArchiveLoading(true);
    void Promise.all(archiveStatuses.map(async (kind) => {
      try {
        const endpoint = '/matches?status=' + kind + '&limit=100' + (kind === 'scheduled' ? '&upcoming=true' : '');
        const games = await apiRequest<Match[]>(endpoint, { signal: controller.signal }, false);
        if (active) setArchive((current) => ({ ...current, [kind]: games }));
      } catch {
        // A retry can recover either feed independently.
      }
    })).finally(() => {
      if (active) setArchiveLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [reload]);

  function updateParam(name: 'status' | 'q' | 'date', value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (!value || (name === 'status' && value === 'all')) next.delete(name);
      else next.set(name, value);
      return next;
    }, { replace: name === 'q' });
  }

  function matchesFilters(matchDate: string, teams: Array<{ name?: string; abbrev?: string; shortName?: string }>) {
    return (!date || dateKey(matchDate) === date) && (
      !search || teams.some((team) =>
        [team.name, team.abbrev, team.shortName].some((label) => label?.toLocaleLowerCase(language).includes(search))
      )
    );
  }

  const displayLive = status === 'all' || status === 'live';
  const liveGames = live.data?.live ?? [];
  const matchingLive = liveGames.filter((event) => matchesFilters(event.date, [event.away, event.home]));
  const liveGameIds = new Set(liveGames.map((event) => 'ESPN_' + event.id));
  const upcoming = (archive.scheduled ?? [])
    .filter((match) => match.status === 'postponed' || Date.parse(match.date) >= Date.now())
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const results = [...(archive.finished ?? [])].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const archiveKinds = archiveStatuses.filter((kind) => status === 'all' || status === kind);
  const archiveGames = (status === 'finished' ? results : status === 'scheduled' ? upcoming : [...upcoming, ...results])
    .filter((match) => (!displayLive || !match.gameId || !liveGameIds.has(match.gameId))
      && matchesFilters(match.date, [match.awayTeam, match.homeTeam]));
  const visibleGameCount = Math.min(count, archiveGames.length);
  const days = groupByDay(archiveGames.slice(0, visibleGameCount));
  const archiveFailed = archiveKinds.some((kind) => archive[kind] === undefined);

  return (
    <section className="container-x match-center">
      <header className="match-center-head">
        <div>
          <h1>{t('score.matchCenter')}</h1>
          <p>{t('matches.lead')}</p>
        </div>
        <button type="button" className="btn btn-secondary match-center-refresh" disabled={live.refreshing} onClick={live.refresh}>
          <RefreshCw size={16} aria-hidden="true" /> {t('score.refresh')}
        </button>
      </header>

      <div className="match-center-controls">
        <div className="match-center-tabs" role="group" aria-label={t('score.filters')}>
          {statuses.map((value) => (
            <button key={value} type="button" aria-pressed={status === value} onClick={() => updateParam('status', value)}>
              {value === 'live' && <Radio size={15} aria-hidden="true" />}
              {t('matches.filter.' + value)}
            </button>
          ))}
        </div>
        <div className="match-center-fields">
          <label className="match-center-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">{t('score.searchTeams')}</span>
            <input type="search" placeholder={t('score.searchExample')} value={query}
              onChange={(event) => updateParam('q', event.target.value)} />
          </label>
          <label className="match-center-date">
            <span className="sr-only">{t('score.dateFilter')}</span>
            <input type="date" value={date} onInput={(event) => updateParam('date', event.currentTarget.value)} />
          </label>
          {(date || query) && (
            <button type="button" className="btn btn-icon" aria-label={t('common.clear')}
              onClick={() => setParams(status === 'all' ? {} : { status }, { replace: true })}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {displayLive && (status === 'live' || matchingLive.length > 0 || live.failed) && (
        <section className="score-panel match-center-live" aria-labelledby="match-center-live">
          <div className="score-panel-head">
            <h2 id="match-center-live">{t('score.live')}</h2>
            <span className="score-source">ESPN</span>
          </div>
          {live.stale && <p className="score-feed-note" role="status">{t('score.stale')}</p>}
          {matchingLive.map((event) => <ScoreRow key={event.id} event={event} stale={live.stale} />)}
          {matchingLive.length === 0 && (
            <p className="score-panel-empty" role="status">
              {live.failed ? t('score.unavailable') : live.refreshing && !live.data ? t('score.loading')
                : liveGames.length ? t('score.noSearchResults') : t('matches.empty.noLive')}
            </p>
          )}
          {status === 'live' && !matchingLive.length && <Link className="score-panel-link" to="/matches?status=scheduled">{t('score.upcoming')} <ArrowRight size={16} aria-hidden="true" /></Link>}
        </section>
      )}

      {status !== 'live' && (
        <div className="match-center-list">
          {archiveFailed && !archiveLoading && (
            <div className="score-panel match-center-message" role="status">
              <span>{t('score.archiveUnavailable')}</span>
              <button type="button" className="btn btn-secondary" onClick={() => setReload((current) => current + 1)}>{t('score.retry')}</button>
            </div>
          )}
          {archiveLoading && !days.length && <p className="score-panel match-center-message" role="status">{t('score.loadingSchedule')}</p>}
          {!archiveLoading && !archiveFailed && !days.length && (
            <p className="score-panel match-center-message" role="status">
              {t(query || date ? 'score.noSearchResults' : status === 'scheduled' ? 'score.noUpcoming' : 'matches.empty.noFilter')}
            </p>
          )}
          {days.map(([day, games]) => (
            <section className="score-panel" key={day}>
              <div className="score-panel-head match-center-day">
                <CalendarDays size={18} aria-hidden="true" />
                <h2>{day ? new Date(games[0].date).toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}</h2>
              </div>
              {games.map((game) => (
                <div className="match-center-game" key={game.id}>
                  <ScoreRow match={game} />
                  {game.status === 'scheduled' && (
                    <Link className="match-center-predict" to={predictionLink(game)}>{t('score.predictGame')} <ArrowRight size={15} aria-hidden="true" /></Link>
                  )}
                </div>
              ))}
            </section>
          ))}
          {archiveGames.length > visibleGameCount && (
            <button type="button" className="btn btn-secondary match-center-more"
              onClick={() => setVisible({ key, count: count + pageSize })}>
              {t('score.showMore')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default MatchesPage;
