import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Pause,
  Play,
  X,
  Youtube,
} from 'lucide-react';
import { liveApi, type LiveHighlight } from '@/shared/api/live';

/**
 * Highlights — cinematic story-style reel.
 *
 * Design references: Apple product hero, NYT/Vox cover stories, Instagram
 * stories progress bars. The user wanted the "листание" (paging) interaction
 * back without the dated 3D stack.
 *
 * Layout:
 *   ┌─ progress bars (1 per clip, current one fills like Insta) ─┐
 *   │                                                             │
 *   │             FULL-WIDTH CINEMATIC HERO                       │
 *   │             (auto-rotates every ROTATE_MS)                  │
 *   │                                                             │
 *   ├─ thumbnail rail (snap-scroll, active = accent ring) ────────┤
 *
 * Navigation:
 *   - Click a thumb to jump
 *   - ← / → keys (when component has focus)
 *   - Swipe on hero (mobile)
 *   - Pause/resume button (top-right of hero)
 *   - Auto-rotate pauses on hover, when player is open, when user paused
 */

const ROTATE_MS = 6500;
const SWIPE_THRESHOLD = 60;

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
  if (/(buzzer|game[\s-]?winner|clutch|ot|overtime)/.test(t))
    return { tag: 'CLUTCH', tone: 'gold' };
  if (/(three|3-pointer|threes|sniper)/.test(t)) return { tag: 'SNIPER', tone: 'neutral' };
  if (/(block|swat|reject)/.test(t)) return { tag: 'BLOCK', tone: 'neutral' };
  if (/(highlight|top plays|reel|recap)/.test(t)) return { tag: 'RECAP', tone: 'neutral' };
  return { tag: 'PLAY', tone: 'neutral' };
}

function bigThumb(url?: string | null): string {
  if (!url) return FALLBACK_THUMB;
  if (/[?&]w=/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}w=1920&h=1080`;
}

function buildYouTubeSearch(h: LiveHighlight): string {
  const home = h.matchup?.home?.name || h.matchup?.home?.abbrev || '';
  const away = h.matchup?.away?.name || h.matchup?.away?.abbrev || '';
  const d = h.matchup?.date ? new Date(h.matchup.date) : null;
  const dateStr = d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const q = `NBA ${away} ${home} highlights ${dateStr}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function matchupLabel(h: LiveHighlight) {
  const home = h.matchup?.home;
  const away = h.matchup?.away;
  if (home?.abbrev && away?.abbrev) return `${away.abbrev} @ ${home.abbrev}`;
  return '';
}

function scoreLabel(h: LiveHighlight) {
  const home = h.matchup?.home;
  const away = h.matchup?.away;
  if (home?.score != null && away?.score != null) return `${away.score}–${home.score}`;
  return null;
}

function tagClass(tone: 'hot' | 'gold' | 'neutral') {
  return tone === 'hot' ? 'hl2-tag-hot' : tone === 'gold' ? 'hl2-tag-gold' : 'hl2-tag-neutral';
}

export const HighlightsCarousel = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<LiveHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [opened, setOpened] = useState<LiveHighlight | null>(null);
  const [progress, setProgress] = useState(0); // 0..1 of active slide

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(Date.now());
  const railRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

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

  const total = items.length;

  const advance = useCallback(
    (delta: 1 | -1) => {
      if (total === 0) return;
      setDirection(delta);
      setActive((a) => (a + delta + total) % total);
      startRef.current = Date.now();
      setProgress(0);
    },
    [total],
  );

  const jumpTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      setDirection(index >= active ? 1 : -1);
      setActive(((index % total) + total) % total);
      startRef.current = Date.now();
      setProgress(0);
    },
    [active, total],
  );

  // Auto-rotate with progress-bar animation. Pauses on hover, when user paused
  // it manually, or when the in-app player modal is open.
  useEffect(() => {
    if (loading || total < 2) return;
    if (paused || hovering || opened) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = Date.now() - progress * ROTATE_MS;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(1, elapsed / ROTATE_MS);
      setProgress(p);
      if (p >= 1) {
        advance(1);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // intentionally omit `progress` from deps — it'd restart the timer every frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, total, paused, hovering, opened, active, advance]);

  // Keep the active thumbnail visible in the rail
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const thumb = rail.querySelector<HTMLElement>(`[data-thumb-index="${active}"]`);
    if (!thumb) return;
    thumb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  // Keyboard navigation when the section is focused
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const onKey = (e: KeyboardEvent) => {
      if (opened) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        advance(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        advance(-1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    section.addEventListener('keydown', onKey);
    return () => section.removeEventListener('keydown', onKey);
  }, [advance, opened]);

  // Pointer/touch swipe on hero
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    touchStartX.current = e.clientX;
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return;
    const dx = e.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    advance(dx < 0 ? 1 : -1);
  };

  // ESC closes the modal player + body scroll lock
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

  const current = items[active];

  // Hero swap animation
  const swapVariants = useMemo(
    () => ({
      enter: (dir: 1 | -1) => ({
        opacity: 0,
        scale: 1.04,
        x: dir > 0 ? 70 : -70,
      }),
      center: { opacity: 1, scale: 1, x: 0 },
      exit: (dir: 1 | -1) => ({
        opacity: 0,
        scale: 0.97,
        x: dir > 0 ? -70 : 70,
      }),
    }),
    [],
  );

  if (loading) {
    return (
      <section className="section">
        <div className="container-x">
          <HeaderBlock />
          <div className="hl2-shell">
            <div className="hl2-stage hl2-skel" />
            <div className="hl2-rail">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="hl2-thumb hl2-skel" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0 || !current) return null;

  return (
    <section className="section" ref={sectionRef} tabIndex={-1}>
      <div className="container-x">
        <HeaderBlock onMore={() => navigate('/matches')} />

        <div
          className="hl2-shell"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {/* Story-style progress bars */}
          <div className="hl2-progress" aria-hidden>
            {items.map((_, i) => {
              const isActive = i === active;
              const isPast = i < active;
              const fill = isActive ? progress : isPast ? 1 : 0;
              return (
                <div key={i} className="hl2-progress-track">
                  <div
                    className="hl2-progress-fill"
                    style={{
                      transform: `scaleX(${fill})`,
                      transition: isActive ? 'none' : 'transform 0.25s ease',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Cinematic hero stage with swap animation */}
          <div
            className="hl2-stage"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (touchStartX.current = null)}
          >
            {/* Persistent dark base — prevents flash during AnimatePresence transitions */}
            <div className="hl2-stage-base" aria-hidden />

            <AnimatePresence custom={direction} mode="popLayout">
              <motion.div
                key={current.id}
                custom={direction}
                variants={swapVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 280, damping: 32 },
                  opacity: { duration: 0.45 },
                  scale: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                }}
                className="hl2-slide"
              >
                <HeroSlide clip={current} onPlay={() => setOpened(current)} />
              </motion.div>
            </AnimatePresence>

            {/* Side navigation arrows */}
            <button
              type="button"
              onClick={() => advance(-1)}
              aria-label="Предыдущий клип"
              className="hl2-nav hl2-nav-left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => advance(1)}
              aria-label="Следующий клип"
              className="hl2-nav hl2-nav-right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Pause/play toggle */}
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Возобновить листание' : 'Поставить на паузу'}
              className="hl2-pause"
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{paused ? 'PLAY' : 'PAUSE'}</span>
            </button>

            {/* Slide counter */}
            <div className="hl2-counter">
              <span className="hl2-counter-now tab-num">
                {String(active + 1).padStart(2, '0')}
              </span>
              <span className="hl2-counter-sep">/</span>
              <span className="hl2-counter-total tab-num">
                {String(total).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Thumbnail rail */}
          <div className="hl2-rail no-scrollbar" ref={railRef}>
            {items.map((h, i) => (
              <ThumbCard
                key={h.id || i}
                clip={h}
                index={i}
                isActive={i === active}
                onSelect={() => jumpTo(i)}
              />
            ))}
          </div>
        </div>
      </div>

      {opened && <PlayerModal clip={opened} onClose={() => setOpened(null)} />}
    </section>
  );
};

/* ============================== Header ============================== */

function HeaderBlock({ onMore }: { onMore?: () => void }) {
  return (
    <div className="section-head">
      <div className="flex flex-col gap-3">
        <span className="eyebrow">
          <span className="dot" />
          VIDEO DESK · ESPN LIVE
        </span>
        <h2>
          ЛУЧШИЕ
          <br />
          <em>МОМЕНТЫ</em> НЕДЕЛИ
        </h2>
      </div>
      <div className="flex flex-col items-end gap-4">
        <p className="lead">
          Реальные клипы из матчей — концовки, посаженные данки, клатчи. Пролистывай стрелками,
          свайпом или жди — листается само.
        </p>
        {onMore && (
          <div className="actions">
            <button onClick={onMore} className="btn">
              Все матчи <span className="arrow">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== Hero Slide ============================== */

function HeroSlide({ clip, onPlay }: { clip: LiveHighlight; onPlay: () => void }) {
  const meta = classifyClip(clip.title);
  const thumb = bigThumb(clip.thumbnail);
  const duration = formatDuration(clip.duration);
  const matchup = matchupLabel(clip);
  const score = scoreLabel(clip);

  return (
    <>
      <motion.div
        className="hl2-img"
        style={{ backgroundImage: `url(${thumb})` }}
        initial={{ scale: 1.08 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: ROTATE_MS / 1000, ease: 'linear' }}
      />
      <div className="hl2-scrim" />
      <div className="hl2-grain" />

      {/* Top bar — feature tag + duration */}
      <div className="hl2-top">
        <span className={`hl2-tag ${tagClass(meta.tone)}`}>
          {meta.tone === 'hot' && <Flame className="h-3 w-3" />}
          ГЛАВНОЕ · {meta.tag}
        </span>
        {duration && (
          <span className="hl2-time">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
        )}
      </div>

      {/* Center play button — clicking it opens the modal */}
      <button
        type="button"
        onClick={onPlay}
        aria-label="Смотреть клип"
        className="hl2-play"
      >
        <Play className="h-8 w-8" strokeWidth={0} fill="currentColor" />
      </button>

      {/* Bottom — matchup, title, CTA */}
      <div className="hl2-meta">
        {(matchup || score) && (
          <div className="hl2-matchup">
            {matchup && <span>{matchup}</span>}
            {score && (
              <>
                <span className="hl2-mdot" />
                <span className="hl2-score">{score}</span>
              </>
            )}
            {clip.matchup?.date && (
              <>
                <span className="hl2-mdot" />
                <span>
                  {new Date(clip.matchup.date).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </>
            )}
          </div>
        )}
        <h3 className="hl2-title">{clip.title}</h3>
        <button type="button" onClick={onPlay} className="hl2-watch">
          СМОТРЕТЬ КЛИП
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

/* ============================== Thumb Rail ============================== */

function ThumbCard({
  clip,
  index,
  isActive,
  onSelect,
}: {
  clip: LiveHighlight;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const meta = classifyClip(clip.title);
  const thumb = bigThumb(clip.thumbnail);
  const matchup = matchupLabel(clip);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-thumb-index={index}
      aria-current={isActive}
      className={`hl2-thumb ${isActive ? 'hl2-thumb-active' : ''}`}
    >
      <div className="hl2-thumb-img" style={{ backgroundImage: `url(${thumb})` }} />
      <div className="hl2-thumb-scrim" />
      <div className="hl2-thumb-body">
        <div className="hl2-thumb-meta">
          <span className={`hl2-tag hl2-tag-sm ${tagClass(meta.tone)}`}>{meta.tag}</span>
          {matchup && <span className="hl2-thumb-matchup">{matchup}</span>}
        </div>
        <span className="hl2-thumb-title">{clip.title}</span>
      </div>
      <span className="hl2-thumb-num tab-num">{String(index + 1).padStart(2, '0')}</span>
    </button>
  );
}

/* ============================== Modal Player ============================== */

function PlayerModal({ clip, onClose }: { clip: LiveHighlight; onClose: () => void }) {
  const meta = classifyClip(clip.title);
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(6,7,10,0.92)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}
    >
      <div className="hc-player" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="hc-player-close" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>

        <div className="hc-player-stage">
          {clip.youtubeId ? (
            <iframe
              key={clip.youtubeId}
              src={`https://www.youtube.com/embed/${clip.youtubeId}?autoplay=1&modestbranding=1&rel=0&playsinline=1&color=white`}
              title={clip.title}
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
                  backgroundImage: `url(${bigThumb(clip.thumbnail)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'brightness(0.42) saturate(0.85)',
                }}
              />
              <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
                <p className="max-w-md text-sm text-[var(--text-2)]">
                  Клип защищён регионом. Открой на YouTube или ESPN.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildYouTubeSearch(clip)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                  >
                    <Youtube className="h-4 w-4" />
                    Поиск на YouTube
                  </a>
                  {clip.webUrl && (
                    <a
                      href={clip.webUrl}
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
              {meta.tag}
            </span>
            {clip.matchup?.away?.logo && (
              <img src={clip.matchup.away.logo} alt="" className="h-6 w-6 object-contain" />
            )}
            <span className="font-display text-base">{clip.matchup?.away?.abbrev}</span>
            <span
              className="font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.18em' }}
            >
              @
            </span>
            <span className="font-display text-base">{clip.matchup?.home?.abbrev}</span>
            {clip.matchup?.home?.logo && (
              <img src={clip.matchup.home.logo} alt="" className="h-6 w-6 object-contain" />
            )}
            {clip.matchup?.home?.score != null && clip.matchup?.away?.score != null && (
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-2)]"
                style={{ letterSpacing: '0.18em' }}
              >
                · {clip.matchup.away.score}–{clip.matchup.home.score}
              </span>
            )}
            {clip.matchup?.date && (
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.18em' }}
              >
                ·{' '}
                {new Date(clip.matchup.date).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            )}
          </div>
          <h3 className="hc-player-title">{clip.title}</h3>
          {clip.caption && clip.caption !== clip.title && (
            <p className="hc-player-caption">{clip.caption}</p>
          )}
          <div className="hc-player-cta">
            {clip.webUrl && (
              <a
                href={clip.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                ESPN
              </a>
            )}
            <a
              href={buildYouTubeSearch(clip)}
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
  );
}

export default HighlightsCarousel;
