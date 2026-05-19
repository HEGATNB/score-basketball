import { useEffect, useMemo, useState } from 'react';
import { Search, X, Newspaper } from 'lucide-react';
import { liveApi, type LiveNewsItem } from '@/shared/api/live';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { NewsModal } from '@/shared/ui/NewsModal';
import { NewsBentoCard, NewsBentoFeature } from '@/shared/ui/NewsBentoCard';

type SortMode = 'fresh' | 'top';

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const ts = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - ts);
    const min = Math.floor(diff / 60_000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ч назад`;
    const d = Math.floor(hr / 24);
    return `${d} д назад`;
  } catch {
    return '';
  }
}

export const NewsPage = () => {
  const [news, setNews] = useState<LiveNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('fresh');
  const [active, setActive] = useState<LiveNewsItem | null>(null);

  useEffect(() => {
    setLoading(true);
    liveApi
      .news(40)
      .then((data) => setNews(Array.isArray(data) ? data : []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    news.forEach((n) => {
      if (n.category) set.add(n.category);
    });
    return Array.from(set).slice(0, 8);
  }, [news]);

  const filtered = useMemo(() => {
    let list = news.filter((n) => {
      if (category !== 'all' && n.category !== category) return false;
      if (
        search &&
        !`${n.title} ${n.description || ''}`.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
    if (sortMode === 'fresh') {
      list = [...list].sort(
        (a, b) =>
          new Date(b.published || 0).getTime() - new Date(a.published || 0).getTime(),
      );
    }
    return list;
  }, [news, search, category, sortMode]);

  const hero = filtered[0];
  const secondary = filtered.slice(1, 5);
  const grid = filtered.slice(5);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем ленту" />
      </div>
    );
  }

  return (
    <section className="section">
      <div className="container-x">
        <div className="section-head">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">
              <span className="dot" />
              ЛЕНТА · ESPN NEWS
            </span>
            <h2>
              СВЕЖИЕ <em>ЗАГОЛОВКИ</em>
              <br />
              ИЗ ОСНОВНЫХ ЛИГ
            </h2>
          </div>
          <p className="lead">
            Прямой поток из ESPN. Аналитика, травмы, разборы, инсайды — обновляется каждые
            5 минут. Кликни на карточку — статья откроется в премиум-ридере.
          </p>
        </div>

        {/* Filter bar */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-3)' }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Найти по заголовку…"
              className="field pl-11 pr-11"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]"
                onClick={() => setSearch('')}
                aria-label="Очистить"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1 no-scrollbar">
              <button
                onClick={() => setCategory('all')}
                className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                  category === 'all'
                    ? 'bg-[var(--accent)] text-[#0a0a0c]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                Все
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`whitespace-nowrap rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                    category === c
                      ? 'bg-[var(--accent)] text-[#0a0a0c]'
                      : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1">
            <button
              onClick={() => setSortMode('fresh')}
              className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                sortMode === 'fresh'
                  ? 'bg-[var(--accent)] text-[#0a0a0c]'
                  : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
              }`}
            >
              Свежее
            </button>
            <button
              onClick={() => setSortMode('top')}
              className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                sortMode === 'top'
                  ? 'bg-[var(--accent)] text-[#0a0a0c]'
                  : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
              }`}
            >
              Топ
            </button>
          </div>

          <span className="tag">
            <Newspaper className="h-3 w-3" /> {filtered.length} материалов
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <Newspaper className="mx-auto h-10 w-10 text-[var(--text-3)]" />
            <div className="mt-4 font-display text-3xl uppercase">Ничего не нашли</div>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              Попробуй сбросить фильтры или поменять запрос.
            </p>
          </div>
        ) : (
          <>
            {/* Bento — feature + 4 cards */}
            {hero && (
              <div className="news-bento mb-12">
                <NewsBentoFeature
                  item={hero}
                  relTime={relativeTime(hero.published)}
                  onOpen={() => setActive(hero)}
                />
                {secondary.map((n, i) => (
                  <NewsBentoCard
                    key={n.id || i}
                    item={n}
                    relTime={relativeTime(n.published)}
                    tall={i < 2}
                    onOpen={() => setActive(n)}
                  />
                ))}
              </div>
            )}

            {/* Magazine grid */}
            {grid.length > 0 && (
              <>
                <div className="mb-5 flex items-center gap-4">
                  <h3 className="m-0 font-display text-2xl uppercase">Архив выпуска</h3>
                  <div className="h-px flex-1 bg-[var(--line)]" />
                  <span className="tag">{grid.length}</span>
                </div>
                <div className="news-bento-flat">
                  {grid.map((n, i) => (
                    <NewsBentoCard
                      key={n.id || i}
                      item={n}
                      relTime={relativeTime(n.published)}
                      onOpen={() => setActive(n)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <NewsModal article={active} onClose={() => setActive(null)} />
      </div>
    </section>
  );
};

export default NewsPage;
