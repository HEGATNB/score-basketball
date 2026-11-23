import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { liveApi, type LiveMatchDetails, type LiveTeam } from '@/shared/api/live';
import { useLanguage, useT } from '@/shared/i18n';
import { getTeamBrand } from '@/shared/lib/teamBrand';
import { MatchBoxScore } from '@/shared/ui/MatchLiveStats';
import { TeamLogo } from '@/shared/ui/TeamLogo';
import './matches.css';

function TeamScore({ team, showScore }: { team?: LiveTeam; showScore: boolean }) {
  return (
    <div className="live-game-team">
      <TeamLogo team={{ name: team?.name, abbrev: team?.abbrev, logoUrl: team?.logo }} size={52} />
      <strong>{team?.name || team?.abbrev || '—'}</strong>
      {showScore && <span>{team?.score ?? '—'}</span>}
    </div>
  );
}

function LiveGame({ eventId }: { eventId: string }) {
  const [details, setDetails] = useState<LiveMatchDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [revision, setRevision] = useState(0);
  const { language } = useLanguage();
  const t = useT();

  useEffect(() => {
    let active = true;
    let timer: number;
    const load = async () => {
      setRefreshing(true);
      let complete = false;
      try {
        const result = await liveApi.matchDetails(eventId);
        if (!active) return;
        setDetails(result);
        setFailed(false);
        complete = result.completed;
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) {
          setRefreshing(false);
          if (!complete) timer = window.setTimeout(load, 30_000);
        }
      }
    };
    void load();
    return () => { active = false; window.clearTimeout(timer); };
  }, [eventId, revision]);

  const home = details?.teams.find((team) => team.homeAway === 'home');
  const away = details?.teams.find((team) => team.homeAway === 'away');
  const date = details?.date && new Date(details.date);
  const scoreAvailable = details?.state === 'post' || details?.state === 'in';
  const homeId = getTeamBrand(home).teamId;
  const awayId = getTeamBrand(away).teamId;
  const predictionQuery = homeId && awayId ? new URLSearchParams({ team1: homeId, team2: awayId, context: '1' }) : null;

  return (
    <section className="container-x match-center match-center-detail">
      <Link to="/matches?status=live" className="btn btn-ghost">
        <ArrowLeft size={16} aria-hidden="true" /> {t('score.backToGames')}
      </Link>
      <header className="match-center-head">
        <div>
          <h1>{t('score.gameDetails')}</h1>
          {date && Number.isFinite(date.getTime()) && <p><time dateTime={date.toISOString()}>
            {date.toLocaleString(language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </time></p>}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setRevision((current) => current + 1)} disabled={refreshing}>
          <RefreshCw size={16} aria-hidden="true" /> {t('score.refresh')}
        </button>
      </header>
      {!details && <p className="score-panel match-center-message" role="status">
        {t(failed ? 'score.gameUnavailable' : 'score.loading')}
      </p>}
      {details && (
        <>
          <div className="score-panel live-game-card">
            <div className="score-panel-head">
              <span className="score-source">ESPN</span>
              {failed || details.stale ? <span className="score-feed-note" role="status">{t('score.staleShort')}</span> : <span>{details.detail}</span>}
            </div>
            <div className="live-game-score">
              <TeamScore team={away} showScore={scoreAvailable} />
              <span aria-hidden="true">–</span>
              <TeamScore team={home} showScore={scoreAvailable} />
            </div>
            {details.state === 'pre' && predictionQuery && (
              <div className="flex justify-center px-4 pb-4">
                <Link to={'/prediction/new?' + predictionQuery.toString()} className="btn btn-primary">
                  {t('hero.ctaPredict')}
                </Link>
              </div>
            )}
          </div>
          <MatchBoxScore details={details} />
        </>
      )}
    </section>
  );
}

export default function LiveMatchPage() {
  const { eventId } = useParams();
  const t = useT();
  return eventId && /^\d{1,20}$/.test(eventId)
    ? <LiveGame key={eventId} eventId={eventId} />
    : <p className="container-x match-center" role="status">{t('score.gameUnavailable')}</p>;
}
