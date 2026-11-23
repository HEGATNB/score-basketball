import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Newspaper, RefreshCw, Search } from 'lucide-react';
import { liveApi, type LiveNewsItem, type NewsFeed } from '@/shared/api/live';
import { NewsModal } from '@/shared/ui/NewsModal';
import { NewsBentoCard, NewsBentoFeature } from '@/shared/ui/NewsBentoCard';
import '../../matches/ui/matches.css';

export function NewsPage() {
  const [params, setParams] = useSearchParams();
  const team = params.get('team') ?? '';
  const articleId = params.get('article') ?? '';
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [article, setArticle] = useState<LiveNewsItem | null>(null);
  const [articleFailed, setArticleFailed] = useState(false);
  const currentArticle = feed?.items.find((item) => item.id === articleId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    liveApi.newsFeed().then((data) => {
      if (!active) return;
      setFeed(data);
      setFailed(false);
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    if (!articleId || currentArticle) return;
    let active = true;
    setArticleFailed(false);
    liveApi.article(articleId).then((value) => {
      if (!active) return;
      setArticle({
        id: value.id, title: value.title, description: value.description, category: value.category,
        published: value.published, thumb: value.images[0]?.url ?? null, url: value.url, byline: value.byline,
      });
    }).catch(() => { if (active) setArticleFailed(true); });
    return () => { active = false; };
  }, [articleId, currentArticle]);

  function updateParam(key: 'team' | 'article', value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  const teams = [...new Set([...(feed?.items.flatMap((item) => item.teams ?? []) ?? []), ...(team ? [team] : [])])].sort();
  const query = search.trim().toLowerCase();
  const results = (feed?.items ?? []).filter((item) => (!team || item.teams?.includes(team))
    && (!query || [item.title, item.description, ...(item.teams ?? [])].some((value) => value?.toLowerCase().includes(query))));
  const [featured, ...others] = results;
  const lastUpdated = feed && new Date(feed.fetchedAt * 1000);
  const active = currentArticle ?? (article?.id === articleId ? article : null);

  return (
    <section className="section">
      <div className="container-x">
        <header className="match-center-head">
          <div><h1>Новости NBA</h1><p>Материалы ESPN о командах, составах и матчах.</p></div>
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>
            <RefreshCw size={16} aria-hidden="true" /> Обновить
          </button>
        </header>

        <div className="score-panel mb-6 flex flex-wrap items-center gap-3 p-3">
          <label className="relative min-w-0 flex-[1_1_14rem]">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <span className="sr-only">Поиск по новостям</span>
            <input type="search" className="field w-full pl-9" placeholder="Заголовок, игрок или команда"
              value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="min-w-0 flex-[1_1_8rem] sm:flex-none">
            <span className="sr-only">Команда</span>
            <select className="field w-full" value={team} onChange={(event) => updateParam('team', event.target.value)}>
              <option value="">Все команды</option>
              {teams.map((code) => <option key={code}>{code}</option>)}
            </select>
          </label>
          {lastUpdated && <time className="text-xs text-[var(--text-2)]" dateTime={lastUpdated.toISOString()}>
            ESPN · {lastUpdated.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </time>}
        </div>

        {(feed?.stale || failed) && <p className="score-feed-note mb-3" role="status">
          {feed ? 'Показана последняя полученная лента ESPN.' : 'Лента ESPN временно недоступна. Попробуйте обновить её.'}
        </p>}
        {articleId && articleFailed && <p className="score-feed-note mb-3" role="status">Материал временно недоступен.</p>}
        {featured ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <NewsBentoFeature item={featured} onOpen={() => updateParam('article', featured.id)} />
            <div className="grid content-start gap-4 sm:grid-cols-2">
              {others.slice(0, 4).map((item) => (
                <NewsBentoCard key={item.id} item={item} onOpen={() => updateParam('article', item.id)} />
              ))}
            </div>
            {others.length > 4 && <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
              {others.slice(4).map((item) => (
                <NewsBentoCard key={item.id} item={item} onOpen={() => updateParam('article', item.id)} />
              ))}
            </div>}
          </div>
        ) : !failed && (
          <div className="score-panel flex items-center gap-3 p-6 text-[var(--text-2)]" role="status">
            <Newspaper size={19} aria-hidden="true" />
            {loading ? 'Загружаем новости…' : 'В свежей ленте нет материалов по этим фильтрам.'}
          </div>
        )}
      </div>
      <NewsModal article={active} onClose={() => updateParam('article', '')} onOpen={(item) => updateParam('article', item.id)} />
    </section>
  );
}

export default NewsPage;
