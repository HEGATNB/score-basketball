import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, ArrowUpRight } from 'lucide-react';
import { apiRequest, type Player, type Team } from '@/shared/api/client';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResponse {
  query: string;
  teams: Team[];
  players: Player[];
  total: number;
}

export const SearchPalette = ({ open, onClose }: SearchPaletteProps) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Focus input on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) {
      setQ('');
      setResult(null);
      return;
    }
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResult(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await apiRequest<SearchResponse>(
          `/home/search?q=${encodeURIComponent(trimmed)}`,
          undefined,
          false,
        );
        setResult(data);
      } catch {
        setResult({ query: trimmed, teams: [], players: [], total: 0 });
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [q, open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const goToTeam = (id: number) => {
    navigate(`/teams/${id}`);
    onClose();
  };
  const goToPlayers = () => {
    navigate('/players');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: 'rgba(6,7,10,0.78)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'rgba(20,20,28,0.95)' }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
          ) : (
            <Search className="h-4 w-4 text-[var(--text-3)]" />
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск команды или игрока…"
            className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
          />
          <kbd className="rounded-sm border border-[var(--line-strong)] bg-[var(--surface-3)] px-2 py-1 font-mono text-[10px] text-[var(--text-3)]">
            ESC
          </kbd>
          <button onClick={onClose} aria-label="Закрыть" className="text-[var(--text-3)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="p-8 text-center text-sm text-[var(--text-3)]">
              Введи минимум 2 символа — будем искать по командам и игрокам.
            </div>
          ) : !result || (result.teams.length === 0 && result.players.length === 0) ? (
            <div className="p-8 text-center text-sm text-[var(--text-3)]">
              {loading ? 'Ищем…' : 'Ничего не найдено.'}
            </div>
          ) : (
            <>
              {result.teams.length > 0 && (
                <div className="border-b border-[var(--line)] py-2">
                  <div
                    className="px-5 pb-2 pt-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.22em' }}
                  >
                    Команды · {result.teams.length}
                  </div>
                  {result.teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => goToTeam(t.id)}
                      className="group flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition hover:bg-[var(--surface-2)]"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="team-sq team-sq-sm"
                          style={{
                            background: `linear-gradient(135deg, ${t.brandColor || '#ff5a1f'}, ${t.accentColor || '#ffb800'})`,
                          }}
                        >
                          {t.abbrev || t.name.slice(0, 3).toUpperCase()}
                        </span>
                        <div>
                          <div className="text-sm font-semibold">{t.name}</div>
                          <div
                            className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                            style={{ letterSpacing: '0.14em' }}
                          >
                            {t.city || '—'} · {t.wins}–{t.losses}
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-[var(--text-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                    </button>
                  ))}
                </div>
              )}

              {result.players.length > 0 && (
                <div className="py-2">
                  <div
                    className="px-5 pb-2 pt-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.22em' }}
                  >
                    Игроки · {result.players.length}
                  </div>
                  {result.players.map((p) => {
                    const fullName =
                      p.full_name || `${p.first_name} ${p.last_name}`.trim() || 'Игрок';
                    return (
                      <button
                        key={p.id}
                        onClick={goToPlayers}
                        className="group flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition hover:bg-[var(--surface-2)]"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="team-sq team-sq-sm"
                            style={{
                              background: 'linear-gradient(135deg, #5db8ff, #d1ff3a)',
                              color: '#0a0a0c',
                            }}
                          >
                            {p.first_name?.[0]?.toUpperCase() || '?'}
                            {p.last_name?.[0]?.toUpperCase() || ''}
                          </span>
                          <div>
                            <div className="text-sm font-semibold">{fullName}</div>
                            <div
                              className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                              style={{ letterSpacing: '0.14em' }}
                            >
                              {p.position || 'PRO'} · {p.team_abbrev || p.team?.abbrev || '—'}
                              {p.season ? ` · ${p.season}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className="font-mono text-xs tab-num"
                            style={{ color: 'var(--accent)' }}
                          >
                            {p.points_per_game.toFixed(1)} PPG
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-[var(--text-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center justify-between border-t border-[var(--line)] px-5 py-2.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.18em' }}
        >
          <span>Поиск по командам и игрокам</span>
          <span>↵ открыть · ESC закрыть</span>
        </div>
      </div>
    </div>
  );
};

export default SearchPalette;
