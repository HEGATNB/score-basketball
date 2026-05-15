import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play, Flame } from 'lucide-react';
import { liveApi, type LiveEvent } from '@/shared/api/live';

/**
 * Highlight reel — recent finished games rendered as a 3D-ish carousel with
 * auto-rotation. We use a known stable basketball image as the backdrop
 * (Pexels), tinted by the home team brand colour. Clicking a card scrolls
 * the page to the upcoming-matches grid, since we don't have a per-game
 * deep-link page yet for ESPN events.
 */

const FALLBACK_BG = [
  'https://images.pexels.com/photos/2834917/pexels-photo-2834917.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/2304442/pexels-photo-2304442.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/1080884/pexels-photo-1080884.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/8007522/pexels-photo-8007522.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/2444852/pexels-photo-2444852.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/3290070/pexels-photo-3290070.jpeg?auto=compress&cs=tinysrgb&w=900',
];

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  thumb: string;
  homeColor?: string;
  awayColor?: string;
}

function eventToSlide(e: LiveEvent, i: number): Slide {
  const winnerName = e.home.winner
    ? e.home.shortName || e.home.abbrev
    : e.away.winner
      ? e.away.shortName || e.away.abbrev
      : null;
  const margin =
    e.home.score != null && e.away.score != null
      ? Math.abs((e.home.score || 0) - (e.away.score || 0))
      : null;

  return {
    id: e.id,
    title: winnerName ? `${winnerName} забрали матч` : `${e.home.abbrev} vs ${e.away.abbrev}`,
    subtitle: margin
      ? `Перевес ${margin} очков · ${e.shortDetail || 'FINAL'}`
      : e.shortDetail || 'FINAL',
    tag: margin && margin >= 15 ? 'BLOWOUT' : margin && margin <= 5 ? 'CLUTCH' : 'FINAL',
    thumb: FALLBACK_BG[i % FALLBACK_BG.length],
    homeColor: e.home.color,
    awayColor: e.away.color,
  };
}

export const HighlightsCarousel = () => {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [active, setActive] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Load recent finished games — try today first, then yesterday for fresher coverage
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const today = await liveApi.scoreboard().catch(() => null);
        let finished: LiveEvent[] = today?.finished || [];

        // If today has nothing finished yet, look at the last few days
        if (finished.length < 4) {
          const offsets = [1, 2, 3];
          for (const offset of offsets) {
            if (finished.length >= 6) break;
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - offset);
            const dateStr = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
            const sb = await liveApi.scoreboard(dateStr).catch(() => null);
            if (sb?.finished) finished = [...finished, ...sb.finished];
          }
        }
        if (cancelled) return;

        const out = finished.slice(0, 6).map(eventToSlide);
        // If still nothing, build static placeholder slides so the section
        // never renders empty.
        if (out.length === 0) {
          setSlides(
            FALLBACK_BG.slice(0, 4).map((thumb, i) => ({
              id: `placeholder-${i}`,
              title: 'Лучшие моменты сезона',
              subtitle: 'Скоро появятся свежие хайлайты',
              tag: 'REEL',
              thumb,
            })),
          );
        } else {
          setSlides(out);
        }
      } catch {
        if (!cancelled) setSlides([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (slides.length < 2) return;
    intervalRef.current = window.setInterval(() => {
      setActive((a) => (a + 1) % slides.length);
    }, 4500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [slides.length]);

  const total = slides.length;

  const cardStyle = useMemo(
    () => (i: number): React.CSSProperties => {
      let offset = i - active;
      if (offset > total / 2) offset -= total;
      if (offset < -total / 2) offset += total;
      const abs = Math.abs(offset);
      const tx = offset * 220;
      const tz = -abs * 220;
      const ry = offset * -14;
      const opacity = abs > 2 ? 0 : 1 - abs * 0.18;
      return {
        transform: `translate3d(${tx}px, 0, ${tz}px) rotateY(${ry}deg) scale(${1 - abs * 0.05})`,
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

  if (slides.length === 0) return null;

  return (
    <section className="section">
      <div className="container-x">
        <div className="section-head">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">
              <span className="dot" />ТОП-МОМЕНТЫ · TURBO REEL
            </span>
            <h2>
              СЦЕНЫ, КОТОРЫЕ<br /><em>ВЗОРВАЛИ</em> СЕЗОН
            </h2>
          </div>
          <div className="flex flex-col items-end gap-4">
            <p className="lead">
              Финалы последних дней с большим перевесом или клатч-концовкой. Тапни — попадёшь
              к матчу.
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

        <div
          className="relative h-[480px]"
          style={{ perspective: '1800px' }}
        >
          <div
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {slides.map((s, i) => {
              const isActive = i === active;
              return (
                <article
                  key={s.id}
                  className="absolute left-1/2 top-1/2 h-[420px] w-[340px] -translate-x-1/2 -translate-y-1/2 cursor-pointer overflow-hidden rounded-lg border"
                  style={{
                    ...cardStyle(i),
                    borderColor: isActive ? 'var(--accent)' : 'var(--line)',
                    boxShadow: isActive
                      ? '0 30px 100px -10px rgba(255,90,31,0.55), 0 0 0 1px var(--accent)'
                      : '0 30px 80px -20px rgba(0,0,0,0.7)',
                  }}
                  onClick={() => {
                    if (isActive) navigate('/matches');
                    else setActive(i);
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${s.thumb})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'contrast(1.05) brightness(0.7)',
                    }}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background: s.homeColor
                        ? `linear-gradient(135deg, ${s.homeColor}55, transparent 60%), linear-gradient(180deg, transparent 30%, rgba(8,8,11,0.92))`
                        : 'linear-gradient(180deg, transparent 30%, rgba(8,8,11,0.92))',
                    }}
                  />

                  {/* Play indicator */}
                  {isActive && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-full"
                        style={{
                          background: 'rgba(255,90,31,0.95)',
                          boxShadow: '0 20px 60px -8px rgba(255,90,31,0.7)',
                        }}
                      >
                        <Play className="h-7 w-7 translate-x-0.5" style={{ color: '#0a0a0c', fill: '#0a0a0c' }} />
                      </div>
                    </div>
                  )}

                  {/* Body */}
                  <div className="absolute bottom-5 left-5 right-5 z-[2]">
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className={`tag ${s.tag === 'CLUTCH' ? 'tag-hot' : s.tag === 'BLOWOUT' ? 'tag-gold' : ''}`}
                      >
                        <Flame className="h-3 w-3" />
                        {s.tag}
                      </span>
                    </div>
                    <h3
                      className="m-0 font-display uppercase"
                      style={{ fontSize: 26, lineHeight: 1, letterSpacing: '0.01em' }}
                    >
                      {s.title}
                    </h3>
                    <div
                      className="mt-2 font-mono text-[11px] text-[var(--text-2)]"
                      style={{ letterSpacing: '0.14em' }}
                    >
                      {s.subtitle}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Progress pips */}
        <div className="mt-7 flex justify-center gap-2">
          {slides.map((_, i) => (
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
    </section>
  );
};

export default HighlightsCarousel;
