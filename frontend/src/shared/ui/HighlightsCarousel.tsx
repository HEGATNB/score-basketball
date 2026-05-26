import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Flame,
  X,
  Youtube,
  ExternalLink,
} from 'lucide-react';
import { liveApi, type LiveHighlight } from '@/shared/api/live';

/**
 * Highlight reel — REAL clips pulled from ESPN's per-match summary endpoint.
 *
 * ESPN videos are geo-restricted in many regions, so we don't try to embed
 * them in-app (the embed gets blocked at the CDN and shows broken UI).
 * Instead we render a premium preview deck: thumbnail + matchup + score +
 * duration, and on click we open a "Watch this clip" modal with two clean
 * CTAs:
 *
 *   1. Watch on ESPN  → opens the canonical ESPN page (works wherever the
 *      user's region is allowed).
 *   2. Search on YouTube → opens YouTube search results for the matchup.
 *
 * This gives a working path in every region without trying to play a
 * blocked stream.
 */

const FALLBACK_THUMB =
  'https://images.pexels.com/photos/2834917/pexels-photo-2834917.jpeg?auto=compress&cs=tinysrgb&w=1280';

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function classifyClip(title: string): { tag: string; tone: 'hot' | 'gold' | 'neutral' } {
  const t = title.toLowerCase();
  if (/(dunk|slam|poster|alley)/.test(t)) return { tag: 'POSTER', tone: 'hot' };
  if (/(buzzer|game[\s-]?winner|clutch|ot|overtime)/.test(t)) return { tag: 'CLUTCH', tone: 'gold' };
  if (/(three|3-pointer|threes|sniper)/.test(t)) return { tag: 'SNIPER', tone: 'neutral' };
  if (/(block|swat|reject)/.test(t)) return { tag: 'BLOCK', tone: 'neutral' };
  if (/(highlight|top plays|reel|recap)/.test(t)) return { tag: 'RECAP', tone: 'neutral' };
  return { tag: 'PLAY', tone: 'neutral' };
}

/** Hi-res ESPN thumbnail — ESPN supports `&w=` query for resize. */
function bigThumb(url?: string | null): string {
  if (!url) return FALLBACK_THUMB;
  if (/[?&]w=/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}w=1280&h=720`;
}

function buildYouTubeSearch(h: LiveHighlight): string {
  const home = h.matchup?.home?.name || h.matchup?.home?.abbrev || '';
  const away = h.matchup?.away?.name || h.matchup?.away?.abbrev || '';
  const d = h.matchup?.date ? new Date(h.matchup.date) : null;
  const dateStr = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const q = `NBA ${away} ${home} highlights ${dateStr}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export const HighlightsCarousel = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<LiveHighlight[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState<LiveHighlight | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    liveApi
      .highlights(12)
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => setItems([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-rotate (pauses when modal open)
  useEffect(() => {
    if (items.length < 2 || opened) return;
    intervalRef.current = window.setInterval(() => {
      setActive((a) => (a + 1) % items.length);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [items.length, opened]);

  // ESC closes modal
  useEffect(() => {
    if (!opened) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpened(null);
    };
    window.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [opened]);

  const total = items.length;

  const cardStyle = useMemo(
    () =>
      (i: number): React.CSSProperties => {
        let offset = i - active;
        if (offset > total / 2) offset -= total;
        if (offset < -total / 2) offset += total;
        const abs = Math.abs(offset);
        const tx = offset * 220;
        const tz = -abs * 220;
        const ry = offset * -14;
        const opacity = abs > 2 ? 0 : 1 - abs * 0.18;
        return {
          transform: `translate(-50%, -50%) translate3d(${tx}px, 0, ${tz}px) rotateY(${ry}deg) scale(${1 - abs * 0.05})`,
          opacity,
          filter: abs > 1 ? `blur(${(abs - 1) * 2}px)` : 'none',
          zIndex: 10 - abs,
          pointerEvents: abs > 2 ? ('none' as const) : ('auto' as const),
          transition:
            'transform 0.85s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.7s, filter 0.7s',
        };
      },
    [active, total],
  );

  if (loading) {
    return (
      <section className="section">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <span className="eyebrow">
                <span className="dot" />
                VIDEO DESK · ESPN
              </span>
              <h2>
                ЛУЧШИЕ
                <br />
                <em>МОМЕНТЫ</em> НЕДЕЛИ
              </h2>
            </div>
          </div>
          <div className="flex h-[480px] items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <div
              className="font-mono text-[11px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.2em' }}
            >
              Подгружаем видео из ESPN...
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="section">
      <div className="container-x">
        <div className="section-head">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">
              <span className="dot" />
              VIDEO DESK · ESPN
            </span>
            <h2>
              ЛУЧШИЕ
              <br />
              <em>МОМЕНТЫ</em> НЕДЕЛИ
            </h2>
          </div>
          <div className="flex flex-col items-end gap-4">
            <p className="lead">
              Видео из последних матчей: важные владения, концовки и контекст, который дополняет сухую статистику.
            </p>
            <div className="actions">
              <button
                className="btn btn-icon"
                onClick={() => setActive((a) => (a - 1 + total) % total)}
                aria-label="Назад"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="btn btn-icon"
                onClick={() => setActive((a) => (a + 1) % total)}
                aria-label="Вперёд"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate('/matches')} className="btn">
                Все матчи <span className="arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        <div className="relative h-[480px]" style={{ perspective: '1800px' }}>
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {items.map((h, i) => {
              const isActive = i === active;
              const klass = classifyClip(h.title);
              const home = h.matchup?.home;
              const away = h.matchup?.away;
              const matchupLabel = home?.abbrev && away?.abbrev ? `${away.abbrev} @ ${home.abbrev}` : '';
              const scoreLine =
                home?.score != null && away?.score != null
                  ? `${away.score}–${home.score}`
                  : null;
              const duration = formatDuration(h.duration);
              const thumb = bigThumb(h.thumbnail);

              return (
                <article
                  key={h.id || i}
                  className="absolute left-1/2 top-1/2 h-[420px] w-[340px] -translate-x-1/2 -translate-y-1/2 cursor-pointer overflow-hidden rounded-lg border"
                  style={{
                    ...cardStyle(i),
                    borderColor: isActive ? 'var(--accent)' : 'var(--line)',
                    boxShadow: isActive
                      ? '0 30px 100px -10px rgba(255,90,31,0.55), 0 0 0 1px var(--accent)'
                      : '0 30px 80px -20px rgba(0,0,0,0.7)',
                  }}
                  onClick={() => {
                    if (isActive) setOpened(h);
                    else setActive(i);
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${thumb})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'contrast(1.05) brightness(0.72)',
                    }}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(8,8,11,0.18) 20%, rgba(8,8,11,0.92))',
                    }}
                  />

                  {(home?.logo || away?.logo) && (
                    <div className="absolute left-4 top-4 z-[2] flex items-center gap-2">
                      {away?.logo && (
                        <img
                          src={away.logo}
                          alt={away.abbrev || ''}
                          className="h-7 w-7 object-contain"
                          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}
                        />
                      )}
                      {home?.logo && (
                        <img
                          src={home.logo}
                          alt={home.abbrev || ''}
                          className="h-7 w-7 object-contain"
                          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}
                        />
                      )}
                    </div>
                  )}

                  {isActive && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-full"
                        style={{
                          background: 'rgba(255,90,31,0.95)',
                          boxShadow: '0 20px 60px -8px rgba(255,90,31,0.7)',
                        }}
                      >
                        <Play
                          className="h-7 w-7 translate-x-0.5"
                          style={{ color: '#0a0a0c', fill: '#0a0a0c' }}
                        />
                      </div>
                    </div>
                  )}

                  {duration && (
                    <div
                      className="absolute right-4 top-4 z-[2] rounded-sm px-2 py-0.5 font-mono text-[10px]"
                      style={{
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {duration}
                    </div>
                  )}

                  <div className="absolute bottom-5 left-5 right-5 z-[2]">
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className={`tag ${klass.tone === 'hot' ? 'tag-hot' : klass.tone === 'gold' ? 'tag-gold' : ''}`}
                      >
                        <Flame className="h-3 w-3" />
                        {klass.tag}
                      </span>
                      {matchupLabel && (
                        <span
                          className="font-mono text-[10px] uppercase text-[var(--text-2)]"
                          style={{ letterSpacing: '0.16em' }}
                        >
                          {matchupLabel}
                          {scoreLine ? ` · ${scoreLine}` : ''}
                        </span>
                      )}
                    </div>
                    <h3
                      className="m-0 font-display uppercase"
                      style={{ fontSize: 22, lineHeight: 1.05, letterSpacing: '0.01em' }}
                    >
                      {h.title}
                    </h3>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-7 flex justify-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Слайд ${i + 1}`}
              className="h-[3px] rounded-sm transition-all"
              style={{
                width: i === active ? 50 : 26,
                background: i === active ? 'var(--accent)' : 'var(--surface-3)',
              }}
            />
          ))}
        </div>
      </div>

      {/* === In-app player: YouTube iframe (plays everywhere) === */}
      {opened && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
          style={{ background: 'rgba(6,7,10,0.92)', backdropFilter: 'blur(14px)' }}
          onClick={() => setOpened(null)}
        >
          <div
            className="hc-player"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpened(null)}
              className="hc-player-close"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="hc-player-stage">
              {opened.youtubeId ? (
                <iframe
                  key={opened.youtubeId}
                  src={`https://www.youtube.com/embed/${opened.youtubeId}?autoplay=1&modestbranding=1&rel=0&playsinline=1&color=white`}
                  title={opened.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="hc-player-iframe"
                />
              ) : (
                <div className="hc-player-fallback">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${bigThumb(opened.thumbnail)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'brightness(0.4) saturate(0.7)',
                    }}
                  />
                  <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
                    <p className="max-w-md text-sm text-[var(--text-2)]">
                      Ищем клип на YouTube. Если ничего не нашлось — попробуй открыть
                      на ESPN.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={buildYouTubeSearch(opened)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{ borderColor: '#ff0033' }}
                      >
                        <Youtube className="h-4 w-4" />
                        Поиск на YouTube
                      </a>
                      {opened.webUrl && (
                        <a
                          href={opened.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Открыть на ESPN
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="hc-player-info">
              <div className="hc-player-meta">
                <span
                  className="font-mono text-[10px] uppercase"
                  style={{ letterSpacing: '0.22em', color: 'var(--accent)' }}
                >
                  {classifyClip(opened.title).tag}
                </span>
                {opened.matchup?.away?.logo && (
                  <img
                    src={opened.matchup.away.logo}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                )}
                <span className="font-display text-base">
                  {opened.matchup?.away?.abbrev}
                </span>
                <span
                  className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                  style={{ letterSpacing: '0.18em' }}
                >
                  @
                </span>
                <span className="font-display text-base">
                  {opened.matchup?.home?.abbrev}
                </span>
                {opened.matchup?.home?.logo && (
                  <img
                    src={opened.matchup.home.logo}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                )}
                {opened.matchup?.home?.score != null &&
                  opened.matchup?.away?.score != null && (
                    <span
                      className="font-mono text-[10px] uppercase text-[var(--text-2)]"
                      style={{ letterSpacing: '0.18em' }}
                    >
                      · {opened.matchup.away.score}–{opened.matchup.home.score}
                    </span>
                  )}
                {opened.matchup?.date && (
                  <span
                    className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.18em' }}
                  >
                    ·{' '}
                    {new Date(opened.matchup.date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                )}
              </div>

              <h3 className="hc-player-title">{opened.title}</h3>

              {opened.caption && opened.caption !== opened.title && (
                <p className="hc-player-caption">{opened.caption}</p>
              )}

              <div className="hc-player-cta">
                {opened.webUrl && (
                  <a
                    href={opened.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    ESPN
                  </a>
                )}
                <a
                  href={buildYouTubeSearch(opened)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                >
                  <Youtube className="h-3.5 w-3.5" />
                  Ещё клипы на YT
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HighlightsCarousel;
