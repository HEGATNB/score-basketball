import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  Play,
  Trophy,
} from 'lucide-react';
import { apiRequest, type Match, type Player, type Team } from '@/shared/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { Marquee } from '@/shared/ui/Marquee';
import { TeamMark } from '@/shared/ui/TeamMark';
import { MatchCard } from '@/shared/ui/MatchCard';
import { PlayerCard } from '@/shared/ui/PlayerCard';

const HERO_FRAMES = [
  'https://images.pexels.com/photos/2834917/pexels-photo-2834917.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/2304442/pexels-photo-2304442.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/1080884/pexels-photo-1080884.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/8007522/pexels-photo-8007522.jpeg?auto=compress&cs=tinysrgb&w=1600',
];

interface PredictStats {
  totalPredictions?: number;
  totalUsers?: number;
  totalTrainingGames?: number;
  accuracy?: number;
  modelVersion?: string;
}

const CHALLENGES = [
  { id: 'c1', icon: '🔥', title: '5 ПОДРЯД', desc: 'Угадай 5 матчей без промахов', progress: 60, value: '3 / 5', reward: '+250 XP', color: '#ff5a1f' },
  { id: 'c2', icon: '🎯', title: 'ЛИГА АНАЛИТИКОВ', desc: '70% точности за неделю', progress: 88, value: '62% / 70%', reward: '+500 XP', color: '#5db8ff' },
  { id: 'c3', icon: '💎', title: 'АНДЕРДОГ', desc: 'Угадай 3 матча против ИИ', progress: 33, value: '1 / 3', reward: '+700 XP', color: '#d1ff3a' },
  { id: 'c4', icon: '🏆', title: 'ЧЕМПИОН НЕДЕЛИ', desc: 'Топ-10 в недельном рейтинге', progress: 100, value: 'РАЗБЛОКИРОВАНО', reward: '+1000 XP', color: '#ffb800' },
];

const NEWS = [
  {
    id: 'n1',
    cat: 'АНАЛИТИКА',
    time: '2 часа назад',
    title: 'Почему Celtics доминируют дома: разбор',
    excerpt: 'Шесть выигранных матчей подряд в TD Garden — разбираем темп игры, защиту по периметру и роль Porziņģis.',
    thumb: 'https://images.pexels.com/photos/2834917/pexels-photo-2834917.jpeg?auto=compress&cs=tinysrgb&w=900',
    featured: true,
  },
  {
    id: 'n2',
    cat: 'ТРАВМЫ',
    time: '5 часов назад',
    title: 'Porziņģis под вопросом на матч с Lakers',
    thumb: 'https://images.pexels.com/photos/1080884/pexels-photo-1080884.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    id: 'n3',
    cat: 'РАЗБОР',
    time: '8 часов назад',
    title: 'Step-back Дончича: как остановить',
    thumb: 'https://images.pexels.com/photos/2304442/pexels-photo-2304442.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    id: 'n4',
    cat: 'ТРЕНДЫ',
    time: '12 часов назад',
    title: 'ИИ-точность за неделю: 78%',
    thumb: 'https://images.pexels.com/photos/8007522/pexels-photo-8007522.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    id: 'n5',
    cat: 'ИГРОКИ',
    time: '1 день назад',
    title: 'Йокич: 10-й трипл-дабл за сезон',
    thumb: 'https://images.pexels.com/photos/2444852/pexels-photo-2444852.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
];

export const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PredictStats | null>(null);
  const [loading, setLoading] = useState(true);

  const playersRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const summary = await apiRequest<any>('/home/summary').catch(() => null);
        if (summary && (summary.topTeams || summary.upcomingMatches)) {
          const all = [...(summary.upcomingMatches || []), ...(summary.recentMatches || [])];
          setTeams([...(summary.topTeams || [])].sort((a: Team, b: Team) => b.wins - a.wins));
          setMatches(all);
          setPlayers(summary.topPlayers || []);
          apiRequest<any>('/predict/stats').then(setStats).catch(() => undefined);
        } else {
          const [t, m, s, p] = await Promise.all([
            apiRequest<Team[]>('/teams'),
            apiRequest<Match[]>('/matches?limit=12'),
            apiRequest<any>('/predict/stats').catch(() => ({})),
            apiRequest<Player[]>('/players?limit=8&sort_by=pts&sort_order=desc&min_games=5').catch(() => []),
          ]);
          setTeams([...t].sort((a, b) => b.wins - a.wins));
          setMatches(m);
          setStats(s);
          setPlayers(p);
        }
      } catch (e) {
        console.error('home load', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const upcoming = useMemo(() => matches.filter((m) => m.status !== 'finished').slice(0, 6), [matches]);
  const finished = useMemo(() => matches.filter((m) => m.status === 'finished').slice(0, 6), [matches]);
  const featured = useMemo(() => upcoming[0] || matches[0], [upcoming, matches]);
  const topTeams = useMemo(() => teams.slice(0, 8), [teams]);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <LoadingSpinner size="lg" label="Загружаем площадку" />
      </div>
    );
  }

  const accuracy = Math.round(stats?.accuracy ?? 0);
  const totalPredictions = stats?.totalPredictions ?? 0;

  const liveRows = upcoming.slice(0, 3);
  const fakeLiveScore = (i: number) => {
    // Cosmetic scoreboard — not from live API. Same approach as the SCORE demo.
    const base = 58 + i * 6;
    const diff = (i + 1) * 4;
    const sa = base + (i % 2 === 0 ? diff : 0);
    const sb = base + (i % 2 === 0 ? 0 : diff);
    const quarters = ['Q4 · 4:23', 'Q3 · 1:02', 'Q2 · 6:18'];
    return { sa, sb, q: quarters[i] || 'Q1 · 8:00' };
  };

  return (
    <>
      {/* ============== HERO ============== */}
      <section className="hero">
        <div className="hero-bg" aria-hidden>
          {HERO_FRAMES.map((src, i) => (
            <div
              key={i}
              className="hero-frame"
              style={{ backgroundImage: `url(${src})`, animationDelay: `${i * 6}s` }}
            />
          ))}
          <div className="hero-scanlines" />
        </div>

        <div className="container-x relative z-[2]">
          <div className="grid items-end gap-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div
                className="mb-7 inline-flex items-center gap-3 font-mono text-xs uppercase text-[var(--accent)]"
                style={{ letterSpacing: '0.2em' }}
              >
                <span className="h-px w-14" style={{ background: 'var(--accent)' }} />
                <span>SEASON 2025/26 · TIPOFF</span>
              </div>

              <h1
                className="m-0 mb-6 font-display font-black uppercase"
                style={{
                  fontSize: 'clamp(64px, 10vw, 160px)',
                  lineHeight: 0.86,
                  letterSpacing: '-0.005em',
                }}
              >
                <span className="stroked-text">SCORE.</span>
                <br />
                <span>БРОСАЙ</span>
                <br />
                <span style={{ color: 'var(--accent)' }}>ПРОГНОЗ</span>
                <span style={{ color: 'var(--text-3)', margin: '0 8px', fontWeight: 100 }}>/</span>
                <span>ЗАБИРАЙ</span>
              </h1>

              <p className="mb-8 max-w-[540px] text-[18px] leading-relaxed text-[var(--text-2)]">
                ИИ разбирает форму, травмы, домашнюю площадку и темп. Ты бросаешь прогноз —
                забираешь очки и поднимаешься в рейтинге. Никакого казино, только баскетбол и
                холодная аналитика.
              </p>

              <div className="flex flex-wrap items-center gap-3.5">
                <button
                  onClick={() => navigate(user ? '/prediction/new' : '/auth')}
                  className="btn btn-primary"
                  style={{ padding: '16px 24px', fontSize: 14 }}
                >
                  <Trophy className="h-4 w-4" />
                  Бросай прогноз
                </button>
                <button onClick={() => navigate('/matches')} className="btn btn-ghost" style={{ padding: '16px 20px' }}>
                  <Play className="h-4 w-4" />
                  Смотреть матчи
                </button>
              </div>

              <div
                className="mt-8 grid max-w-[560px] grid-cols-3 overflow-hidden rounded-lg border border-[var(--line)]"
                style={{ gap: 1, background: 'var(--line)' }}
              >
                <div className="bg-[rgba(14,14,19,0.7)] px-5 py-4 backdrop-blur-md">
                  <div className="font-display text-4xl leading-none">
                    <span style={{ color: 'var(--accent)' }}>{accuracy || 78}</span>%
                  </div>
                  <div
                    className="mt-1.5 text-[11px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.14em' }}
                  >
                    Точность ИИ за сезон
                  </div>
                </div>
                <div className="bg-[rgba(14,14,19,0.7)] px-5 py-4 backdrop-blur-md">
                  <div className="font-display text-4xl leading-none tab-num">
                    {totalPredictions.toLocaleString('ru')}
                    <span className="text-base text-[var(--text-3)]"></span>
                  </div>
                  <div
                    className="mt-1.5 text-[11px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.14em' }}
                  >
                    Сделано прогнозов
                  </div>
                </div>
                <div className="bg-[rgba(14,14,19,0.7)] px-5 py-4 backdrop-blur-md">
                  <div className="font-display text-4xl leading-none">
                    {upcoming.length}<span className="text-base text-[var(--text-3)]">/{matches.length}</span>
                  </div>
                  <div
                    className="mt-1.5 text-[11px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.14em' }}
                  >
                    Матчей в очереди
                  </div>
                </div>
              </div>
            </div>

            {/* Live side panel */}
            <aside className="panel">
              <h3
                className="m-0 mb-4 flex items-center justify-between font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                <span>Live сейчас</span>
                <span className="inline-flex items-center gap-1.5 text-[var(--danger)]">
                  <span className="pulse-dot" />
                  LIVE
                </span>
              </h3>
              {liveRows.length > 0 ? (
                liveRows.map((m, i) => {
                  const ls = fakeLiveScore(i);
                  return (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/matches/${m.id}`)}
                      className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-[var(--line)] py-3.5 first:border-t-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <TeamMark team={m.homeTeam} size="sm" />
                        <div className="text-left">
                          <div className="text-[13px] font-semibold">{m.homeTeam.abbrev}</div>
                          <div
                            className="font-display text-2xl leading-none"
                            style={{ color: ls.sa > ls.sb ? 'var(--accent)' : 'var(--text)' }}
                          >
                            {ls.sa}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                          style={{ letterSpacing: '0.1em' }}
                        >
                          {ls.q}
                        </span>
                        <span className="font-mono text-[9px] text-[var(--danger)]">● LIVE</span>
                      </div>
                      <div className="flex flex-row-reverse items-center gap-2.5">
                        <TeamMark team={m.awayTeam} size="sm" />
                        <div className="text-right">
                          <div className="text-[13px] font-semibold">{m.awayTeam.abbrev}</div>
                          <div
                            className="font-display text-2xl leading-none"
                            style={{ color: ls.sb > ls.sa ? 'var(--accent)' : 'var(--text)' }}
                          >
                            {ls.sb}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="py-6 text-center text-sm text-[var(--text-3)]">Сейчас нет live матчей.</p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4">
                <span className="text-xs text-[var(--text-3)]">Полный счёт и трансляции</span>
                <button
                  onClick={() => navigate('/matches')}
                  className="btn btn-ghost"
                  style={{ padding: '8px 12px', fontSize: 12 }}
                >
                  Все матчи <span className="arrow">→</span>
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ============== MARQUEE ============== */}
      <Marquee />

      {/* ============== STAR PLAYERS RAIL ============== */}
      {players.length > 0 && (
        <section className="section">
          <div className="container-x">
            <div className="section-head">
              <div className="flex flex-col gap-3">
                <span className="eyebrow"><span className="dot" />ROSTER · 2025/26</span>
                <h2>
                  ЛЮДИ, КОТОРЫЕ<br /><em>ДЕЛАЮТ</em> ИГРУ
                </h2>
              </div>
              <div className="flex flex-col items-end gap-4">
                <p className="lead">
                  Карточки в стиле видеоигры. Кликни — увидишь полную статистику и последние матчи.
                </p>
                <div className="actions">
                  <button
                    className="btn btn-icon"
                    onClick={() => playersRailRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
                    aria-label="Назад"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    className="btn btn-icon"
                    onClick={() => playersRailRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
                    aria-label="Вперёд"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button onClick={() => navigate('/players')} className="btn">
                    Все игроки <span className="arrow">→</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={playersRailRef}
              className="no-scrollbar flex gap-5 overflow-x-auto py-3.5"
              style={{ scrollSnapType: 'x mandatory', scrollBehavior: 'smooth', paddingBottom: 30 }}
            >
              {players.map((p) => (
                <PlayerCard key={p.id} player={p} onOpenDetails={() => navigate('/players')} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============== FEATURED PREDICTION ============== */}
      {featured && (
        <section className="section">
          <div className="container-x">
            <div className="section-head">
              <div className="flex flex-col gap-3">
                <span className="eyebrow"><span className="dot" />ИГРА ВЕЧЕРА · AI BREAKDOWN</span>
                <h2>
                  СЕГОДНЯ ИИ<br />ЗОВЁТ <em>ШТОРМ</em>
                </h2>
              </div>
              <p className="lead">
                Модель разобрала шесть факторов и собрала разрядку для матча. Соглашайся с ИИ или иди против — система оценит обе версии.
              </p>
            </div>

            <MatchCard match={featured} variant="featured" />
          </div>
        </section>
      )}

      {/* ============== UPCOMING MATCHES ============== */}
      {(upcoming.length > 0 || finished.length > 0) && (
        <section className="section-tight">
          <div className="container-x">
            <div className="section-head">
              <div className="flex flex-col gap-3">
                <span className="eyebrow"><span className="dot" />СЛЕДУЮЩИЕ 48 ЧАСОВ</span>
                <h2>
                  БРОСАЙ ПРОГНОЗ<br /><em>В ДВА КЛИКА</em>
                </h2>
              </div>
              <div className="flex flex-col items-end gap-4">
                <p className="lead">Выбирай команду — ИИ покажет шансы и причины. Чем раньше прогноз, тем больше очков.</p>
                <div className="actions">
                  <button onClick={() => navigate('/matches')} className="btn btn-ghost">
                    Все матчи
                  </button>
                  <button onClick={() => navigate('/matches')} className="btn">
                    Расписание <span className="arrow">→</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(upcoming.length ? upcoming : finished).slice(0, 6).map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============== STANDINGS + LEADERBOARD ============== */}
      <section className="section-tight">
        <div className="container-x">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="card p-6">
              <h3
                className="m-0 mb-5 font-display text-2xl uppercase"
                style={{ letterSpacing: '0.01em' }}
              >
                Турнирная таблица
              </h3>
              <div className="overflow-x-auto">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th style={{ width: 24 }}>#</th>
                      <th>Команда</th>
                      <th>W</th>
                      <th>L</th>
                      <th>%</th>
                      <th>±</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTeams.map((t, i) => {
                      const total = t.wins + t.losses;
                      const pct = total > 0 ? ((t.wins / total) * 100).toFixed(1) : '0.0';
                      const diff = (t.avgPointsFor || 0) - (t.avgPointsAgainst || 0);
                      return (
                        <tr
                          key={t.id}
                          className={i < 3 ? 'hot cursor-pointer' : 'cursor-pointer'}
                          onClick={() => navigate(`/teams/${t.id}`)}
                        >
                          <td className="font-mono text-sm">{String(i + 1).padStart(2, '0')}</td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <TeamMark team={t} size="sm" />
                              <span className="font-semibold">{t.abbrev || t.name.slice(0, 3)}</span>
                              <span className="text-[11px] text-[var(--text-3)]">{t.city || ''}</span>
                            </div>
                          </td>
                          <td className="pct">{t.wins}</td>
                          <td className="pct">{t.losses}</td>
                          <td className="pct">{pct}</td>
                          <td
                            className="pct"
                            style={{ color: diff >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                          >
                            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="card p-6">
                <h3 className="m-0 mb-4.5 flex items-center justify-between font-display text-2xl uppercase">
                  <span>🏆 Рейтинг</span>
                  <span className="tag tag-gold">НЕДЕЛЯ</span>
                </h3>
                {[
                  { rk: 1, name: 'KingOfTheNet', acc: 81, pts: 12480, gold: true },
                  { rk: 2, name: 'StreetballSage', acc: 76, pts: 11220 },
                  { rk: 3, name: 'MetricsKing', acc: 74, pts: 10840 },
                  { rk: 47, name: user?.username || 'Ты', acc: 62, pts: 6420, you: true },
                  { rk: 48, name: 'CourtVision', acc: 61, pts: 6280 },
                ].map((r) => (
                  <div
                    key={r.rk + r.name}
                    className={`leader-row ${r.gold ? 'gold' : ''}`}
                    style={
                      r.you
                        ? {
                            background: 'var(--accent-soft)',
                            margin: '0 -10px',
                            padding: '12px 10px',
                            borderRadius: 10,
                            borderTop: '1px solid var(--accent)',
                          }
                        : undefined
                    }
                  >
                    <div className="rk">{r.rk}</div>
                    <div className="av">{r.name[0].toUpperCase()}</div>
                    <div className="nm">
                      {r.name}
                      {r.you && (
                        <span
                          className="ml-2 font-mono text-[10px]"
                          style={{ color: 'var(--accent)', letterSpacing: '0.1em' }}
                        >
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="acc">{r.acc}% точн.</div>
                    <div className="pts">{r.pts.toLocaleString('ru')}</div>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/history')}
                  className="btn mt-4 w-full justify-center"
                >
                  Весь рейтинг <span className="arrow">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== CABINET (mini) ============== */}
      <section className="section-tight">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <span className="eyebrow"><span className="dot" />ЛИЧНЫЙ КАБИНЕТ</span>
              <h2>
                ТВОЯ <em>СТАТА</em><br />ЗА СЕЗОН
              </h2>
            </div>
            <p className="lead">
              Каждый прогноз идёт в копилку. Стрики, точность, любимые команды — видишь, где ты сильнее ИИ.
            </p>
          </div>

          <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-2">
            <div
              className="p-8"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(255,90,31,0.18), transparent 60%), var(--surface)',
              }}
            >
              <h4
                className="m-0 mb-3.5 font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                Точность прогнозов
              </h4>
              <div className="mb-2.5 font-display text-7xl leading-[0.9]">
                <span style={{ color: 'var(--accent)' }}>62</span>
                <span className="text-3xl text-[var(--text-3)]">%</span>
              </div>
              <p className="mb-7 max-w-[360px] text-sm text-[var(--text-3)]">
                Ты обходишь 71% игроков платформы. Лучшая дисциплина — Восточный дивизион (74%).
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { num: '184', lbl: 'Всего прогнозов', diff: '↑ +12 на неделе' },
                  { num: '7', lbl: 'Текущий стрик', diff: 'Рекорд: 11' },
                  { num: '#47', lbl: 'Место в рейтинге', diff: '↑ 8 за неделю' },
                  { num: '6 420', lbl: 'XP всего', diff: 'Лига 3 → 4: 580 XP' },
                ].map((s) => (
                  <div key={s.lbl} className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-4">
                    <div className="font-display text-3xl leading-none tab-num">{s.num}</div>
                    <div
                      className="mt-1 font-mono text-[10px] uppercase text-[var(--text-3)]"
                      style={{ letterSpacing: '0.14em' }}
                    >
                      {s.lbl}
                    </div>
                    <div className="mt-1.5 font-mono text-[11px]" style={{ color: 'var(--ok)' }}>
                      {s.diff}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--line)] bg-[var(--bg-2)] p-8 lg:border-l lg:border-t-0">
              <h4
                className="m-0 mb-3.5 font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                Последние 20 прогнозов
              </h4>
              <div className="spark mb-7">
                {'WWLWWLWWWLWWLWWWWLWW'.split('').map((g, i) => (
                  <div
                    key={i}
                    className={`bar ${g === 'W' ? 'win' : ''}`}
                    style={{ height: g === 'W' ? `${50 + (i % 5) * 10}%` : `${20 + (i % 3) * 10}%` }}
                    title={g === 'W' ? 'Угадано' : 'Мимо'}
                  />
                ))}
              </div>

              <h4
                className="m-0 mb-3.5 font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                Слабые стороны
              </h4>
              <div className="flex flex-col gap-2.5">
                {[
                  { l: 'Андердоги в гостях', v: '34% · -28%', color: 'var(--danger)' },
                  { l: 'OT и матчи на сирене', v: '41% · -21%', color: 'var(--danger)' },
                  { l: 'Матчи без лидеров', v: '67% · +5%', color: 'var(--gold)' },
                ].map((r) => (
                  <div
                    key={r.l}
                    className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3.5"
                  >
                    <span className="text-[13px]">{r.l}</span>
                    <span className="font-mono text-xs" style={{ color: r.color }}>
                      {r.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== CHALLENGES ============== */}
      <section className="section-tight">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <span className="eyebrow"><span className="dot" />ЧЕЛЛЕНДЖИ И БЕЙДЖИ</span>
              <h2>
                СОБИРАЙ <em>ОЧКИ</em>,<br />ПОДНИМАЙ ЛИГУ
              </h2>
            </div>
            <p className="lead">
              Стрики, аналитика, ставки на андердогов — каждое действие приносит XP и шанс получить редкий бейдж.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHALLENGES.map((c) => (
              <article key={c.id} className="challenge-card">
                <div
                  className="badge-icon"
                  style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}88)` }}
                >
                  <span>{c.icon}</span>
                  <div
                    className="absolute -inset-2 -z-10 rounded-3xl opacity-25"
                    style={{ background: c.color, filter: 'blur(14px)' }}
                  />
                </div>
                <div className="font-display text-xl uppercase">{c.title}</div>
                <div className="mt-2 mb-4 min-h-[34px] text-xs leading-[1.4] text-[var(--text-3)]">
                  {c.desc}
                </div>
                <div className="mb-2 h-1 overflow-hidden rounded-sm bg-[var(--surface-3)]">
                  <div className="h-full" style={{ width: `${c.progress}%`, background: c.color }} />
                </div>
                <div
                  className="flex justify-between font-mono text-[10px] uppercase text-[var(--text-3)]"
                  style={{ letterSpacing: '0.1em' }}
                >
                  <span>{c.value}</span>
                  <span style={{ color: 'var(--gold)' }}>{c.reward}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============== NEWS ============== */}
      <section className="section-tight">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <span className="eyebrow"><span className="dot" />ЛЕНТА · ANALYTICS</span>
              <h2>
                ЧТО ЧИТАТЬ<br /><em>ПЕРЕД</em> ПРОГНОЗОМ
              </h2>
            </div>
            <div className="flex flex-col items-end gap-4">
              <p className="lead">Аналитика, травмы, разборы матчей. Чтобы бросать прогноз не вслепую.</p>
              <div className="actions">
                <button className="btn btn-ghost">Аналитика</button>
                <button className="btn btn-ghost">Травмы</button>
                <button className="btn">Вся лента <span className="arrow">→</span></button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr_1fr]">
            {NEWS.map((n) => (
              <article
                key={n.id}
                className={`card cursor-pointer ${n.featured ? 'lg:row-span-2' : ''}`}
                style={{ borderRadius: 'var(--r-md)' }}
              >
                <div
                  className="relative"
                  style={{
                    height: n.featured ? 320 : 240,
                    backgroundImage: `url(${n.thumb})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(8,8,11,0.9))' }}
                  />
                </div>
                <div className={n.featured ? 'p-6' : 'p-5'}>
                  <div
                    className="mb-3 flex items-center gap-2.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.16em' }}
                  >
                    <span style={{ color: 'var(--accent)' }}>{n.cat}</span>
                    <span>·</span>
                    <span>{n.time}</span>
                  </div>
                  <h4
                    className="m-0 mb-2.5 font-display uppercase"
                    style={{ fontSize: n.featured ? '36px' : '22px', lineHeight: 1.05 }}
                  >
                    {n.title}
                  </h4>
                  {n.featured && (
                    <p className="text-[13px] leading-[1.5] text-[var(--text-3)]">{n.excerpt}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============== CTA: Sign-in invite ============== */}
      {!user && (
        <section className="section-tight">
          <div className="container-x">
            <div className="card p-10 text-center" style={{ background: 'linear-gradient(135deg, rgba(255,90,31,0.10), transparent), var(--surface)' }}>
              <Lock className="mx-auto h-7 w-7" style={{ color: 'var(--accent)' }} />
              <h3 className="mt-4 font-display text-4xl uppercase">Готов попасть в рейтинг?</h3>
              <p className="mx-auto mt-3 max-w-[460px] text-sm text-[var(--text-3)]">
                Зарегистрируйся за минуту — сохраняй прогнозы, копи XP, прокачивай лигу.
              </p>
              <button onClick={() => navigate('/auth')} className="btn btn-primary mt-6">
                Войти / Зарегистрироваться <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default HomePage;
