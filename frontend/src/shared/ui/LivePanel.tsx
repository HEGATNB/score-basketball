import { ArrowRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLiveScoreboard } from '@/shared/hooks/useLiveScoreboard';
import { useLanguage, useT } from '@/shared/i18n';
import { ScoreRow } from './ScoreRow';

export function LivePanel() {
  const { data, failed, refreshing, refresh, stale } = useLiveScoreboard();
  const { language } = useLanguage();
  const t = useT();
  const rows = data ? [...data.live, ...data.upcoming, ...data.finished].slice(0, 3) : [];
  const fetchedAt = data?.fetchedAt ? new Date(data.fetchedAt * 1000) : null;

  return (
    <section className="score-panel" aria-labelledby="home-live-heading">
      <div className="score-panel-head">
        <div>
          <h2 id="home-live-heading">{t('score.today')}</h2>
          <p className="score-source">
            ESPN
            {fetchedAt && (
              <> · <time dateTime={fetchedAt.toISOString()}>{fetchedAt.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}</time></>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-icon score-refresh" onClick={refresh} disabled={refreshing} aria-label={t('score.refresh')}>
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </div>
      {stale && <p className="score-feed-note" role="status">{t('score.stale')}</p>}
      {rows.length ? rows.map((event) => <ScoreRow key={event.id} event={event} stale={stale} />) : (
        <p className="score-panel-empty" role="status">
          {failed ? t('score.unavailable') : refreshing ? t('score.loading') : t('score.noToday')}
        </p>
      )}
      <Link className="score-panel-link" to="/matches?status=live">{t('score.openLive')} <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  );
}

export default LivePanel;
