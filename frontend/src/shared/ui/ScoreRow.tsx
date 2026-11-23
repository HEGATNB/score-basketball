import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Match } from '@/shared/api/client';
import type { LiveEvent, LiveTeam } from '@/shared/api/live';
import { useLanguage, useT } from '@/shared/i18n';
import { TeamLogo } from './TeamLogo';

const toLogoTeam = (team: LiveTeam) => ({
  name: team.name,
  abbrev: team.abbrev,
  logoUrl: team.logo,
  brandColor: team.color,
  accentColor: team.altColor,
});

export function predictionLink(match: Match) {
  if (!match.homeTeam.id || !match.awayTeam.id) return '/prediction/new';
  return '/prediction/new?' + new URLSearchParams({
    team1: String(match.homeTeam.id),
    team2: String(match.awayTeam.id),
  });
}

type RowProps = { withDate?: boolean } & (
  { match: Match; event?: never; stale?: never } |
  { event: LiveEvent; match?: never; stale?: boolean }
);

export function ScoreRow({ match, event, stale, withDate }: RowProps) {
  const t = useT();
  const { language } = useLanguage();
  const date = new Date(event?.date ?? match?.date ?? '');
  const dateValid = Number.isFinite(date.getTime());
  const away = event ? toLogoTeam(event.away) : match.awayTeam;
  const home = event ? toLogoTeam(event.home) : match.homeTeam;
  const awayScore = event ? event.away.score : match.awayScore;
  const homeScore = event ? event.home.score : match.homeScore;
  const complete = event ? event.state === 'post' : match.status === 'finished';
  const live = event?.state === 'in';
  const postponed = match?.status === 'postponed';
  const showScores = (complete || live) && awayScore != null && homeScore != null;
  const dateTime = dateValid ? new Intl.DateTimeFormat(language, withDate ? {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  } : { hour: '2-digit', minute: '2-digit' }).format(date) : '—';
  const time = complete
    ? t('score.final')
    : live
      ? stale ? t('score.staleShort') : event.shortDetail || t('score.live')
      : postponed ? t('score.postponed') : dateTime;
  const href = event ? '/matches/live/' + encodeURIComponent(event.id)
    : match.source === 'espn' ? '/matches/live/' + match.id : '/matches/' + match.id;

  return (
    <Link className="score-row" to={href} aria-label={
      (away.name || away.abbrev || '—') + ' – ' + (home.name || home.abbrev || '—') +
      ', ' + time + (showScores ? ', ' + awayScore + ' – ' + homeScore : '')
    }>
      <div className="score-row-status" data-live={live && !stale ? '' : undefined}>
        {live && !stale && <span className="score-live-dot" />}
        {(!complete && !live && !postponed && dateValid)
          ? <time dateTime={date.toISOString()}>{time}</time>
          : time}
      </div>
      <div className="score-row-teams">
        {[
          { team: away, value: awayScore, leading: showScores && awayScore > homeScore },
          { team: home, value: homeScore, leading: showScores && homeScore > awayScore },
        ].map(({ team, value, leading }, index) => (
          <div className="score-row-team" key={index}>
            <TeamLogo team={team} size={24} />
            <span className="score-team-name">{team.name || team.abbrev || '—'}</span>
            {showScores && <strong data-leading={leading ? '' : undefined}>{value}</strong>}
          </div>
        ))}
      </div>
      <ArrowUpRight className="score-row-arrow" size={16} aria-hidden="true" />
    </Link>
  );
}
