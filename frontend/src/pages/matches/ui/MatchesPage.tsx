import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Trophy } from 'lucide-react';
import { apiRequest, type Match } from '@/shared/api/client';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { MatchCard } from '@/shared/ui/MatchCard';

type FilterMode = 'all' | 'scheduled' | 'finished';

function groupByDay(matches: Match[]) {
  const groups = new Map<string, Match[]>();
  matches.forEach((m) => {
    let key = 'Дата';
    try {
      key = new Date(m.date).toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      key = 'Дата';
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  });
  return Array.from(groups.entries());
}

export const MatchesPage = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    apiRequest<Match[]>('/matches')
      .then(setMatches)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    return matches.filter((m) => m.status === filter);
  }, [filter, matches]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);
  const finishedCount = matches.filter((m) => m.status === 'finished').length;
  const scheduledCount = matches.filter((m) => m.status === 'scheduled').length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем матчи" />
      </div>
    );
  }

  return (
    <section className="section">
      <div className="container-x">
        <div className="section-head">
          <div className="flex flex-col gap-3">
            <span className="eyebrow"><span className="dot" />РАСПИСАНИЕ · {matches.length} ИГР</span>
            <h2>
              КАЖДЫЙ <em>TIP-OFF</em>.<br />КАЖДЫЙ ФИНАЛЬНЫЙ СЧЁТ.
            </h2>
          </div>
          <p className="lead">Полный календарь, день за днём. Кликни — увидишь разбор и прогноз ИИ.</p>
        </div>

        {/* Stats band */}
        <div
          className="mb-8 grid overflow-hidden rounded-lg border border-[var(--line)]"
          style={{ gap: 1, background: 'var(--line)', gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          <div className="bg-[var(--surface)] p-5">
            <div
              className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.16em' }}
            >
              Всего
            </div>
            <div className="font-display text-3xl tab-num">{matches.length}</div>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <div
              className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.16em' }}
            >
              Сыграно
            </div>
            <div className="font-display text-3xl tab-num" style={{ color: 'var(--ok)' }}>
              {finishedCount}
            </div>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <div
              className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.16em' }}
            >
              Предстоит
            </div>
            <div className="font-display text-3xl tab-num" style={{ color: 'var(--accent)' }}>
              {scheduledCount}
            </div>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <div
              className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.16em' }}
            >
              Видимо
            </div>
            <div className="font-display text-3xl tab-num">{filtered.length}</div>
          </div>
        </div>

        {/* Filter pills */}
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1">
            {([
              ['all', 'Все'],
              ['scheduled', 'Предстоящие'],
              ['finished', 'Сыгранные'],
            ] as Array<[FilterMode, string]>).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`rounded-pill px-4 py-2 text-xs font-semibold transition ${
                  filter === v
                    ? 'bg-[var(--accent)] text-[#0a0a0c]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="tag">
            <CalendarRange className="h-3 w-3" /> {filtered.length} игр
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <Trophy className="mx-auto h-10 w-10 text-[var(--text-3)]" />
            <div className="mt-4 font-display text-3xl uppercase">Нет матчей по фильтру</div>
            <p className="mt-2 text-sm text-[var(--text-3)]">Смени фильтр.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <div className="mb-5 flex items-center gap-4">
                  <h3 className="m-0 font-display text-2xl uppercase">{day}</h3>
                  <div className="h-px flex-1 bg-[var(--line)]" />
                  <span className="tag">{items.length} игр</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MatchesPage;
