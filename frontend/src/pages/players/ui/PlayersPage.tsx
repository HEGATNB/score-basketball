import { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { apiRequest, type Player } from '@/shared/api/client';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { PlayerCard } from '@/shared/ui/PlayerCard';
import { PlayerAvatar } from '@/shared/ui/PlayerAvatar';
import { PlayerDetailModal } from '@/shared/ui/PlayerDetailModal';

type SortKey = 'pts' | 'reb' | 'ast' | 'gp' | 'player_name';

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'pts', label: 'Очки' },
  { id: 'reb', label: 'Подборы' },
  { id: 'ast', label: 'Передачи' },
  { id: 'gp', label: 'Матчи' },
  { id: 'player_name', label: 'Имя' },
];

export const PlayersPage = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [season, setSeason] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('pts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Player | null>(null);
  const [visible, setVisible] = useState(60);
  const debouncedSearch = useDebounce(search.trim(), 300);

  useEffect(() => {
    let cancelled = false;
    apiRequest<string[]>('/players/seasons')
      .then((s) => {
        if (cancelled) return;
        setSeasons(s);
        if (s.length > 0) setSeason(s[0]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setVisible(60);
    const params = new URLSearchParams();
    params.set('limit', '500');
    params.set('sort_by', sortBy);
    params.set('sort_order', 'desc');
    params.set('min_games', '5');
    if (season) params.set('season', season);
    if (debouncedSearch) params.set('search', debouncedSearch);
    apiRequest<Player[]>(`/players?${params.toString()}`)
      .then((data) => {
        if (!cancelled) setPlayers(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPlayers([]);
          setError('Не удалось загрузить игроков.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [season, debouncedSearch, sortBy]);

  const featured = useMemo(() => players.slice(0, 3), [players]);
  const rest = useMemo(() => players.slice(3), [players]);

  return (
    <section className="section">
      <div className="container-x">
        <div className="section-head">
          <div className="flex flex-col gap-3">
            <span className="eyebrow"><span className="dot" />PLAYERS · DATABASE</span>
            <h2>
              ПРОФИЛИ <em>ИГРОКОВ</em><br />И СЕЗОННАЯ ФОРМА
            </h2>
          </div>
          <p className="lead">
            Статистика игроков из базы: очки, подборы, передачи, команды, сезоны и расширенные метрики.
            Фильтруй по сезону или быстро находи нужного игрока.
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
              placeholder="Поиск игрока..."
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

          {seasons.length > 1 && (
            <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1">
              {seasons.slice(0, 5).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                    season === s
                      ? 'bg-[var(--accent)] text-[#0a0a0c]'
                      : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setSortBy(o.id)}
                className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                  sortBy === o.id
                    ? 'bg-[var(--accent)] text-[#0a0a0c]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LoadingSpinner size="md" label="Загружаем" />
          </div>
        ) : error ? (
          <div className="card border-[rgba(255,56,88,0.25)] bg-[rgba(255,56,88,0.06)] p-6 text-[var(--danger)]">{error}</div>
        ) : players.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="font-display text-3xl uppercase">Ничего не найдено</div>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              Попробуй очистить поиск или сменить сезон.
            </p>
          </div>
        ) : (
          <>
            {/* Featured trio when no search */}
            {!debouncedSearch && featured.length > 0 && (
              <div className="mb-12">
                <div className="mb-5 flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span
                    className="font-mono text-[11px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.22em' }}
                  >
                    Лидеры · {SORT_OPTIONS.find((o) => o.id === sortBy)?.label}
                  </span>
                </div>
                <div className="flex gap-5 overflow-x-auto pb-2 no-scrollbar">
                  {featured.map((p) => (
                    <PlayerCard key={p.id} player={p} highlight onOpenDetails={() => setSelected(p)} />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5 flex items-center justify-between">
              <span
                className="font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Игроки в выборке · {players.length}
              </span>
              {season && <span className="tag">Сезон · {season}</span>}
            </div>

            {(() => {
              const sourceList = debouncedSearch ? players : rest;
              const shown = sourceList.slice(0, visible);
              const hasMore = sourceList.length > shown.length;
              return (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {shown.map((player) => (
                      <PlayerRowCard
                        key={player.id}
                        player={player}
                        onOpen={() => setSelected(player)}
                      />
                    ))}
                  </div>
                  {hasMore && (
                    <div className="mt-10 flex justify-center">
                      <button
                        onClick={() => setVisible((v) => v + 60)}
                        className="btn btn-primary"
                      >
                        Показать ещё {Math.min(60, sourceList.length - shown.length)} игроков
                        <span className="arrow">↓</span>
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
      <PlayerDetailModal player={selected} onClose={() => setSelected(null)} />
    </section>
  );
};

function asText(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return fallback;
}

function asNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function PlayerRowCard({ player, onOpen }: { player: Player; onOpen?: () => void }) {
  const first = asText(player.first_name);
  const last = asText(player.last_name);
  const fullName = asText((player as any).full_name) || `${first} ${last}`.trim() || 'Player';
  const position = asText(player.position) || 'PRO';
  const number = asText(player.number);
  const team = asText(player.team_abbrev) || asText(player.team?.abbrev) || 'NBA';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card group w-full p-5 text-left transition hover:-translate-y-1 hover:border-[var(--accent)]"
    >
      <div className="flex items-center gap-4">
        <PlayerAvatar player={player} variant="row" />
        <div className="min-w-0 flex-1">
          <div
            className="font-mono text-[10px] uppercase text-[var(--text-3)]"
            style={{ letterSpacing: '0.18em' }}
          >
            {position}
            {number ? ` · #${number}` : ''}
          </div>
          <div className="mt-1 truncate font-display text-xl uppercase">{fullName}</div>
          <div
            className="mt-0.5 font-mono text-[10px] uppercase"
            style={{ color: 'var(--accent)', letterSpacing: '0.18em' }}
          >
            {team}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-4">
        <div className="text-center">
          <div
            className="font-mono text-[9px] uppercase text-[var(--text-3)]"
            style={{ letterSpacing: '0.14em' }}
          >
            PTS
          </div>
          <div className="mt-1 font-display text-xl" style={{ color: 'var(--accent)' }}>
            {asNumber(player.points_per_game).toFixed(1)}
          </div>
        </div>
        <div className="text-center">
          <div
            className="font-mono text-[9px] uppercase text-[var(--text-3)]"
            style={{ letterSpacing: '0.14em' }}
          >
            REB
          </div>
          <div className="mt-1 font-display text-xl">
            {asNumber(player.rebounds_per_game).toFixed(1)}
          </div>
        </div>
        <div className="text-center">
          <div
            className="font-mono text-[9px] uppercase text-[var(--text-3)]"
            style={{ letterSpacing: '0.14em' }}
          >
            AST
          </div>
          <div className="mt-1 font-display text-xl">
            {asNumber(player.assists_per_game).toFixed(1)}
          </div>
        </div>
      </div>
    </button>
  );
}

export default PlayersPage;
