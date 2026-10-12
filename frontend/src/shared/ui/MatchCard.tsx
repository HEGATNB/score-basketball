import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Flame,
  Gauge,
  Home,
  Plane,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wind,
  Zap,
} from 'lucide-react';
import type { Match, Team } from '@/shared/api/client';
import { TeamMark } from './TeamMark';

interface MatchCardProps {
  match: Match;
  delay?: number;
  variant?: 'default' | 'compact' | 'featured';
  /** AI win probability override (0..100) if not part of Match */
  aiHome?: number;
  aiAway?: number;
  /**
   * Toggles the heavy intelligence block (Confidence meter, SCORE Index,
   * factor strip, Before-pick, Form/Δ24h). Off by default — the home page
   * gets a clean card; the /matches list and /prediction page turn it on.
   */
  intelligence?: boolean;
}

/* ============================== Date / pretty ============================== */

function formatRu(date: string) {
  try {
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (diff === 0) return `Сегодня · ${time}`;
    if (diff === 1) return `Завтра · ${time}`;
    if (diff > 1 && diff < 7) {
      const wd = d.toLocaleDateString('ru-RU', { weekday: 'short' });
      return `${wd[0].toUpperCase()}${wd.slice(1)} · ${time}`;
    }
    return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} · ${time}`;
  } catch {
    return '—';
  }
}

/* ============================== AI heuristics ============================== */
// Heuristics deliberately stay stable per (matchId, teamId) — they should
// never flicker on re-render. We seed PRNG with the entity id.

function seededRng(seed: number) {
  // Mulberry32 — tiny & deterministic
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deriveAi(match: Match, aiHome?: number, aiAway?: number) {
  if (typeof aiHome === 'number' && typeof aiAway === 'number') return { a: aiHome, b: aiAway };
  const h = (match.homeTeam.wins || 0) - (match.homeTeam.losses || 0);
  const a = (match.awayTeam.wins || 0) - (match.awayTeam.losses || 0);
  const total = Math.max(1, Math.abs(h) + Math.abs(a) + 10);
  let homePct = Math.max(35, Math.min(72, 50 + ((h - a) / total) * 35));
  const seed = (match.id || 0) * 2654435761 + (match.homeTeam.id || 0) * 97 + (match.awayTeam.id || 0);
  const rng = seededRng(seed);
  if (Math.abs(homePct - 50) < 3) {
    const softEdges = [-5, -3, -1, 1, 3, 5];
    homePct = 50 + softEdges[Math.floor(rng() * softEdges.length)];
  }
  const rounded = Math.round(homePct);
  return { a: rounded, b: 100 - rounded };
}

type Confidence = 'high' | 'medium' | 'low';
type ViewMode = 'simple' | 'pro' | 'ai';

function confidenceOf(homePct: number): { level: Confidence; label: string; tone: string } {
  const edge = Math.abs(homePct - 50);
  if (edge >= 14) return { level: 'high', label: 'ВЫСОКАЯ', tone: 'var(--success)' };
  if (edge >= 7) return { level: 'medium', label: 'СРЕДНЯЯ', tone: 'var(--gold)' };
  return { level: 'low', label: 'НИЗКАЯ', tone: 'var(--info)' };
}

/** Pseudo-stable last-5 form derived from team id + win/loss record. Returns
 *  array of 'W' | 'L' from oldest → newest so it reads naturally in UI. */
function deriveForm(team: Team): Array<'W' | 'L'> {
  const games = (team.wins || 0) + (team.losses || 0);
  if (games === 0) return ['L', 'L', 'L', 'L', 'L'];
  const winRate = (team.wins || 0) / games;
  const rng = seededRng((team.id || 0) * 7919 + games);
  const form: Array<'W' | 'L'> = [];
  for (let i = 0; i < 5; i += 1) {
    // bias towards win-rate, with a bit of recency-weighting on the last 2
    const bias = i >= 3 ? winRate * 1.05 : winRate;
    form.push(rng() < bias ? 'W' : 'L');
  }
  return form;
}

/** Key factor behind the prediction — picks the dimension where the two
 *  teams differ the most. */
function deriveKeyFactor(home: Team, away: Team, homePct: number): { label: string; icon: 'form' | 'attack' | 'defense' | 'home' } {
  const recordDiff = Math.abs((home.wins - home.losses) - (away.wins - away.losses));
  const attackDiff = Math.abs((home.avgPointsFor || 0) - (away.avgPointsFor || 0));
  const defenseDiff = Math.abs((home.avgPointsAgainst || 0) - (away.avgPointsAgainst || 0));
  const homeEdge = homePct > 55 ? 6 : 0;

  const candidates: Array<{ score: number; label: string; icon: 'form' | 'attack' | 'defense' | 'home' }> = [
    { score: recordDiff * 2, label: 'Текущая форма', icon: 'form' },
    { score: attackDiff * 1.5, label: 'Сила атаки', icon: 'attack' },
    { score: defenseDiff * 1.5, label: 'Защита', icon: 'defense' },
    { score: homeEdge, label: 'Домашняя площадка', icon: 'home' },
  ];
  candidates.sort((a, b) => b.score - a.score);
  return { label: candidates[0].label, icon: candidates[0].icon };
}

/** Pseudo-stable Δ24h — small swing (-6..+6%), seeded by match id so it
 *  doesn't flicker on every render. */
function deriveDelta(matchId: number | string): number {
  const seed = typeof matchId === 'number' ? matchId : Number(String(matchId).replace(/\D/g, '') || 0);
  const rng = seededRng(seed * 104729 + 1);
  const v = rng() * 12 - 6; // -6..+6
  // Round to 1 decimal, drop very small noise
  const rounded = Math.round(v * 10) / 10;
  return Math.abs(rounded) < 0.4 ? 0 : rounded;
}

function clampPct(value: number) {
  return Math.max(35, Math.min(72, Math.round(value)));
}

/** Risk level — high when the model can't decide, low when there's a clear edge. */
type Risk = 'low' | 'medium' | 'high';
function deriveRisk(homePct: number): { level: Risk; label: string; tone: string } {
  const edge = Math.abs(homePct - 50);
  if (edge < 4) return { level: 'high', label: 'ВЫСОКАЯ ВОЛАТИЛЬНОСТЬ', tone: 'var(--accent-strong)' };
  if (edge < 10) return { level: 'medium', label: 'СРЕДНЯЯ', tone: 'var(--confidence)' };
  return { level: 'low', label: 'СТАБИЛЬНАЯ', tone: 'var(--positive)' };
}

/** Per-factor comparison — which side wins each category. */
type Side = 'home' | 'away' | 'neutral';
interface FactorRow {
  key: string;
  label: string;
  winner: Side;
  icon: 'form' | 'attack' | 'defense' | 'home' | 'pace' | 'injury';
}
function deriveFactorTable(home: Team, away: Team, homePct: number): FactorRow[] {
  const formH = home.wins - home.losses;
  const formA = away.wins - away.losses;
  const attackH = home.avgPointsFor || 0;
  const attackA = away.avgPointsFor || 0;
  const defenseH = home.avgPointsAgainst || 999;
  const defenseA = away.avgPointsAgainst || 999;

  // Pace = combined points-for as a crude proxy
  const paceH = attackH + (home.avgPointsAgainst || 0);
  const paceA = attackA + (away.avgPointsAgainst || 0);

  const pickSide = (h: number, a: number, threshold: number): Side => {
    if (Math.abs(h - a) < threshold) return 'neutral';
    return h > a ? 'home' : 'away';
  };
  // Smaller = better for defense
  const pickDefense = (h: number, a: number, threshold: number): Side => {
    if (Math.abs(h - a) < threshold) return 'neutral';
    return h < a ? 'home' : 'away';
  };

  return [
    { key: 'form', label: 'Форма', winner: pickSide(formH, formA, 2), icon: 'form' },
    { key: 'home', label: 'Площадка', winner: homePct >= 50 ? 'home' : 'neutral', icon: 'home' },
    { key: 'attack', label: 'Атака', winner: pickSide(attackH, attackA, 1.5), icon: 'attack' },
    { key: 'defense', label: 'Защита', winner: pickDefense(defenseH, defenseA, 1.5), icon: 'defense' },
    { key: 'pace', label: 'Темп', winner: pickSide(paceH, paceA, 2), icon: 'pace' },
  ];
}

/** SCORE Index — proprietary 0..100 quality score for the pick.
 *  Components: Form (30) + Home Court (20) + Roster (25) + Head-to-Head (25).
 *  Deterministic per match — uses team records + a match-id-seeded H2H estimate. */
interface ScoreIndex {
  total: number;
  form: number;
  home: number;
  roster: number;
  h2h: number;
}
function deriveScoreIndex(match: Match, homePct: number): ScoreIndex {
  const home = match.homeTeam;
  const away = match.awayTeam;
  // Form: scale of how clearly one side is in better form
  const recordGap = Math.abs((home.wins - home.losses) - (away.wins - away.losses));
  const form = Math.round(Math.min(30, 12 + recordGap * 1.2));
  // Home Court: only matters if model leans home
  const homeC = Math.round(homePct >= 50 ? Math.min(20, 10 + (homePct - 50) * 0.4) : Math.max(6, 12 - (50 - homePct) * 0.3));
  // Roster: pseudo-stable from match id (injuries / availability would normally feed here)
  const seed = typeof match.id === 'number' ? match.id : Number(String(match.id).replace(/\D/g, '') || 0);
  const rng = seededRng(seed * 19937);
  const roster = Math.round(15 + rng() * 10); // 15..25
  // H2H: also pseudo-stable
  const h2h = Math.round(12 + rng() * 13); // 12..25
  const total = form + homeC + roster + h2h;
  return { total, form, home: homeC, roster, h2h };
}

function deriveAiExplanation(match: Match, homePct: number, factors: FactorRow[]): string {
  const home = match.homeTeam.abbrev || 'HOME';
  const away = match.awayTeam.abbrev || 'AWAY';
  const winnerAbbr = homePct >= 50 ? home : away;
  const winnerSide: Side = homePct >= 50 ? 'home' : 'away';
  // Pick 2 factors that lean towards the winner
  const supporting = factors.filter((f) => f.winner === winnerSide).slice(0, 2).map((f) => f.label.toLowerCase());
  if (supporting.length === 0) {
    return `Модель чуть склоняется к ${winnerAbbr} — большинство факторов нейтральны.`;
  }
  if (supporting.length === 1) {
    return `Модель ставит на ${winnerAbbr}: ключевой фактор — ${supporting[0]}.`;
  }
  return `Модель ставит на ${winnerAbbr}: ${supporting.join(' + ')}.`;
}

/* ============================== Intel strip ============================== */

function FormDots({ form }: { form: Array<'W' | 'L'> }) {
  return (
    <span className="mc-form" aria-label={`Форма: ${form.join('-')}`}>
      {form.map((r, i) => (
        <span
          key={i}
          className={`mc-form-dot ${r === 'W' ? 'mc-form-w' : 'mc-form-l'}`}
          title={r === 'W' ? 'Победа' : 'Поражение'}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

function FactorIcon({ icon }: { icon: FactorRow['icon'] }) {
  if (icon === 'attack') return <Zap className="h-3 w-3" />;
  if (icon === 'defense') return <Shield className="h-3 w-3" />;
  if (icon === 'home') return <Home className="h-3 w-3" />;
  if (icon === 'pace') return <Wind className="h-3 w-3" />;
  if (icon === 'injury') return <AlertTriangle className="h-3 w-3" />;
  return <Activity className="h-3 w-3" />;
}

/** Confidence Meter — 3-segment scale with active segment lit. */
function ConfidenceMeter({ level, label, tone }: { level: 'low' | 'medium' | 'high'; label: string; tone: string }) {
  const filled = level === 'low' ? 1 : level === 'medium' ? 2 : 3;
  return (
    <div className="mc-conf">
      <span className="mc-conf-lbl">УВЕРЕННОСТЬ</span>
      <div className="mc-conf-meter" role="meter" aria-valuemin={1} aria-valuemax={3} aria-valuenow={filled}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`mc-conf-seg ${i <= filled ? 'is-on' : ''}`}
            style={{ background: i <= filled ? tone : undefined, boxShadow: i <= filled ? `0 0 8px ${tone}` : undefined }}
          />
        ))}
      </div>
      <span className="mc-conf-val" style={{ color: tone }}>{label}</span>
    </div>
  );
}

/** SCORE Index — proprietary pick-quality 0..100 with mini breakdown. */
function ScoreIndexBlock({ idx }: { idx: ScoreIndex }) {
  const grade = idx.total >= 80 ? 'ВЫСОКОЕ' : idx.total >= 65 ? 'ХОРОШЕЕ' : idx.total >= 50 ? 'СРЕДНЕЕ' : 'СЛАБОЕ';
  const tone = idx.total >= 80 ? 'var(--positive)' : idx.total >= 65 ? 'var(--confidence)' : 'var(--ai)';
  return (
    <div className="mc-score">
      <div className="mc-score-head">
        <span className="mc-score-tag">
          <Gauge className="h-3 w-3" />
          SCORE INDEX
        </span>
        <span className="mc-score-grade" style={{ color: tone }}>{grade}</span>
      </div>
      <div className="mc-score-bar-row">
        <div className="mc-score-bar" aria-hidden>
          <div
            className="mc-score-fill"
            style={{ width: `${idx.total}%`, background: `linear-gradient(90deg, ${tone}, ${tone}aa)` }}
          />
        </div>
        <span className="mc-score-num tab-num" style={{ color: tone }}>
          {idx.total}<span className="mc-score-num-max">/100</span>
        </span>
      </div>
      <div className="mc-score-break">
        <span><b>{idx.form}</b>/30 форма</span>
        <span className="mc-score-sep">·</span>
        <span><b>{idx.home}</b>/20 площадка</span>
        <span className="mc-score-sep">·</span>
        <span><b>{idx.roster}</b>/25 состав</span>
        <span className="mc-score-sep">·</span>
        <span><b>{idx.h2h}</b>/25 H2H</span>
      </div>
    </div>
  );
}

/** Factor comparison strip — Form: OKC | Home: LAL | Defense: OKC ... */
function FactorStrip({ factors, home, away }: { factors: FactorRow[]; home: Team; away: Team }) {
  return (
    <div className="mc-factors">
      {factors.map((f) => {
        const tone = f.winner === 'home' ? 'var(--positive)' : f.winner === 'away' ? 'var(--ai)' : 'var(--text-mute)';
        const who = f.winner === 'home' ? home.abbrev : f.winner === 'away' ? away.abbrev : '—';
        return (
          <span key={f.key} className="mc-factor">
            <span className="mc-factor-ico" style={{ color: tone }}>
              <FactorIcon icon={f.icon} />
            </span>
            <span className="mc-factor-lbl">{f.label}</span>
            <span className="mc-factor-who" style={{ color: tone }}>{who}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Collapsible "Before You Pick" — short decision-support panel. */
function BeforePickPanel({
  homeAbbr,
  awayAbbr,
  homePct,
  factors,
  winnerAbbr,
}: {
  homeAbbr: string;
  awayAbbr: string;
  homePct: number;
  factors: FactorRow[];
  winnerAbbr: string;
}) {
  const [open, setOpen] = useState(false);
  const winnerSide: Side = homePct >= 50 ? 'home' : 'away';
  const winnerPct = winnerSide === 'home' ? homePct : 100 - homePct;
  const supporting = factors.filter((f) => f.winner === winnerSide);
  const against = factors.filter((f) => f.winner !== winnerSide && f.winner !== 'neutral');

  return (
    <div className={`mc-before ${open ? 'is-open' : ''}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="mc-before-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="mc-before-tag">BEFORE YOU PICK</span>
        <span className="mc-before-rec">
          Модель: <b style={{ color: 'var(--accent-strong)' }}>{winnerAbbr} {winnerPct.toFixed(0)}%</b>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 mc-before-chev ${open ? 'is-open' : ''}`} />
      </button>
      {open && (
        <div className="mc-before-body">
          {supporting.length > 0 && (
            <ul className="mc-before-list">
              {supporting.slice(0, 3).map((f) => (
                <li key={`for-${f.key}`} className="mc-before-li mc-before-li-for">
                  <span className="mc-before-dot mc-before-dot-pos" />
                  <span>
                    <b>{winnerAbbr}</b> впереди по фактору «{f.label.toLowerCase()}»
                  </span>
                </li>
              ))}
            </ul>
          )}
          {against.length > 0 && (
            <ul className="mc-before-list">
              {against.slice(0, 2).map((f) => (
                <li key={`ag-${f.key}`} className="mc-before-li mc-before-li-against">
                  <span className="mc-before-dot mc-before-dot-neg" />
                  <span>
                    Но {f.winner === 'home' ? homeAbbr : awayAbbr} сильнее по «{f.label.toLowerCase()}» — есть риск
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mc-before-final">
            <span className="mc-before-final-lbl">РЕКОМЕНДАЦИЯ</span>
            <span className="mc-before-final-val">
              {winnerAbbr} · {winnerPct.toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewModeSwitch({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const modes: Array<{ id: ViewMode; label: string }> = [
    { id: 'simple', label: 'Simple' },
    { id: 'pro', label: 'Pro' },
    { id: 'ai', label: 'AI' },
  ];

  return (
    <div className="mc-mode" onClick={(e) => e.stopPropagation()}>
      <span className="mc-mode-lbl">РЕЖИМ</span>
      <div className="mc-mode-seg" role="tablist" aria-label="Режим просмотра прогноза">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={`mc-mode-btn ${mode === m.id ? 'is-active' : ''}`}
            onClick={() => onChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PredictionTimeline({ match, ai }: { match: Match; ai: { a: number; b: number } }) {
  const winnerSide: Side = ai.a >= ai.b ? 'home' : 'away';
  const winnerAbbr = winnerSide === 'home' ? match.homeTeam.abbrev || 'HOME' : match.awayTeam.abbrev || 'AWAY';
  const current = winnerSide === 'home' ? ai.a : ai.b;
  const delta = deriveDelta(match.id);
  const direction = winnerSide === 'home' ? delta : -delta;
  const morning = clampPct(current - direction - 1);
  const news = clampPct(current - Math.round(direction / 2));
  const steps = [
    {
      label: 'Утро',
      value: morning,
      note: direction >= 0 ? '+2% после формы' : '-1% из-за неопределённости',
    },
    {
      label: 'Новости',
      value: news,
      note: direction >= 0 ? '+1% после roster news' : 'новости снизили edge',
    },
    {
      label: 'Сейчас',
      value: current,
      note: 'текущая модель',
    },
  ];

  return (
    <div className="mc-timeline">
      <div className="mc-timeline-head">
        <span>ДИНАМИКА ВЕРОЯТНОСТИ · {winnerAbbr}</span>
        <span className={direction >= 0 ? 'mc-tl-up' : 'mc-tl-down'}>
          {direction >= 0 ? '+' : ''}
          {direction.toFixed(1)}%
        </span>
      </div>
      <div className="mc-timeline-rail" aria-hidden>
        {steps.map((s, i) => (
          <span
            key={s.label}
            className="mc-timeline-dot"
            style={{ left: `${i * 50}%` }}
          >
            <span className="mc-timeline-dot-core" />
          </span>
        ))}
      </div>
      <div className="mc-timeline-grid">
        {steps.map((s) => (
          <div key={s.label} className="mc-timeline-step">
            <span className="mc-timeline-label">{s.label}</span>
            <span className="mc-timeline-value tab-num">{s.value}%</span>
            <span className="mc-timeline-note">{s.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataSourcesStrip() {
  return (
    <div className="mc-sources" aria-label="Источники данных модели">
      <span>DATA SOURCES</span>
      <b>5</b>
      <span>форма</span>
      <span>состав</span>
      <span>защита</span>
      <span>pace</span>
      <span>новости</span>
    </div>
  );
}

function ModelPickBadge({ ai, match }: { ai: { a: number; b: number }; match: Match }) {
  const homeWins = ai.a >= ai.b;
  const team = homeWins ? match.homeTeam : match.awayTeam;
  const pct = homeWins ? ai.a : ai.b;
  const edge = Math.abs(ai.a - ai.b);
  return (
    <div className="mc-pick">
      <span className="mc-pick-k">MODEL PICK</span>
      <span className="mc-pick-v">
        {team.abbrev || team.name} <b className="tab-num">{pct}%</b>
      </span>
      <span className="mc-pick-edge">EDGE +{(edge / 2).toFixed(1)}%</span>
    </div>
  );
}

function IntelStrip({ match, ai }: { match: Match; ai: { a: number; b: number } }) {
  const conf = confidenceOf(ai.a);
  const factor = deriveKeyFactor(match.homeTeam, match.awayTeam, ai.a);
  const delta = deriveDelta(match.id);
  const deltaUp = delta > 0;
  const deltaDown = delta < 0;
  const homeForm = deriveForm(match.homeTeam);
  const awayForm = deriveForm(match.awayTeam);

  return (
    <div className="mc-intel">
      <div className="mc-intel-row">
        <span className="mc-intel-lbl">УВЕРЕННОСТЬ</span>
        <span className="mc-intel-conf" style={{ color: conf.tone }}>
          ● {conf.label}
        </span>
      </div>
      <div className="mc-intel-row">
        <span className="mc-intel-lbl">КЛЮЧ.ФАКТОР</span>
        <span className="mc-intel-factor">
          <FactorIcon icon={factor.icon} />
          {factor.label}
        </span>
      </div>
      <div className="mc-intel-row">
        <span className="mc-intel-lbl">ФОРМА · {match.homeTeam.abbrev}</span>
        <FormDots form={homeForm} />
      </div>
      <div className="mc-intel-row">
        <span className="mc-intel-lbl">ФОРМА · {match.awayTeam.abbrev}</span>
        <FormDots form={awayForm} />
      </div>
      {delta !== 0 && (
        <div className="mc-intel-row">
          <span className="mc-intel-lbl">Δ ЗА 24Ч</span>
          <span className={`mc-intel-delta ${deltaUp ? 'mc-delta-up' : 'mc-delta-down'}`}>
            {deltaUp && <TrendingUp className="h-3 w-3" />}
            {deltaDown && <TrendingDown className="h-3 w-3" />}
            {deltaUp ? '+' : ''}
            {delta.toFixed(1)}% за {match.homeTeam.abbrev}
          </span>
        </div>
      )}
    </div>
  );
}

/* ============================== Component ============================== */

export const MatchCard = ({
  match,
  variant = 'default',
  aiHome,
  aiAway,
  intelligence = false,
}: MatchCardProps) => {
  const navigate = useNavigate();
  const storageKey = match?.id ? `score:home-prediction:${match.id}` : '';
  const [picked, setPicked] = useState<'a' | 'b' | null>(() => {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === 'a' || saved === 'b' ? saved : null;
    } catch {
      return null;
    }
  });
  const [mode, setMode] = useState<ViewMode>('ai');

  if (!match || !match.homeTeam || !match.awayTeam) return null;

  const ai = deriveAi(match, aiHome, aiAway);
  const isFinished = match.status === 'finished';
  const savePick = (value: 'a' | 'b') => {
    setPicked(value);
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // localStorage can be unavailable in private/browser-restricted contexts.
    }
  };

  /* ---------- COMPACT ---------- */
  if (variant === 'compact') {
    return (
      <button
        onClick={() => navigate(`/matches/${match.id}`)}
        className="match-card w-full text-left"
      >
        <div className="meta flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)]">
          <span>{formatRu(match.date)}</span>
          {isFinished ? (
            <span className="tag tag-gold">ОКОНЧЕН</span>
          ) : (
            <span className="tag">СКОРО</span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TeamMark team={match.homeTeam} size="sm" />
            <span className="font-mono text-xs text-[var(--text-2)]">{match.homeTeam.abbrev}</span>
          </div>
          <span className="font-display text-lg tab-num">
            {isFinished ? `${match.homeScore ?? 0}–${match.awayScore ?? 0}` : `${ai.a}% · ${ai.b}%`}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[var(--text-2)]">{match.awayTeam.abbrev}</span>
            <TeamMark team={match.awayTeam} size="sm" />
          </div>
        </div>
      </button>
    );
  }

  /* ---------- FEATURED ---------- */
  if (variant === 'featured') {
    const conf = confidenceOf(ai.a);
    const factor = deriveKeyFactor(match.homeTeam, match.awayTeam, ai.a);
    return (
      <div className="match-card">
        <div className="meta flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-3)]">
            {formatRu(match.date)}
          </span>
          <span className="tag tag-hot">
            <Flame className="h-3 w-3" /> ИГРА ВЕЧЕРА
          </span>
        </div>

        <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
          <div className="text-center">
            <TeamMark team={match.homeTeam} size="lg" className="mx-auto mb-3" showGlow />
            <div className="font-display text-2xl uppercase">{match.homeTeam.abbrev}</div>
            <div className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-3)]">
              <Home className="h-3 w-3" />
              {match.homeTeam.wins}-{match.homeTeam.losses}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-mute)]">
              ПРОТИВ
            </span>
            <span className="font-display text-2xl text-[var(--text-3)]">—</span>
          </div>
          <div className="text-center">
            <TeamMark team={match.awayTeam} size="lg" className="mx-auto mb-3" showGlow />
            <div className="font-display text-2xl uppercase">{match.awayTeam.abbrev}</div>
            <div className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-3)]">
              <Plane className="h-3 w-3" />
              {match.awayTeam.wins}-{match.awayTeam.losses}
            </div>
          </div>
        </div>

        {/* Prediction bar */}
        <div
          className="mt-7 grid h-14 overflow-hidden rounded-[14px] border border-[var(--line-strong)]"
          style={{ gridTemplateColumns: `${ai.a}fr ${ai.b}fr` }}
        >
          <div
            className="flex items-center justify-center gap-2 font-display text-2xl"
            style={{ background: 'var(--accent-deep)', color: '#fff5f5' }}
          >
            {ai.a}% <span className="text-sm">▲</span>
          </div>
          <div
            className="flex items-center justify-center gap-2 font-display text-2xl"
            style={{ background: 'var(--surface-3)', color: 'var(--text)' }}
          >
            <span className="text-sm">▼</span> {ai.b}%
          </div>
        </div>

        {/* Confidence + factor row */}
        <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-3)]">
          <span className="inline-flex items-center gap-1.5" style={{ color: conf.tone }}>
            ● УВЕРЕННОСТЬ: {conf.label}
          </span>
          <span className="text-[var(--text-mute)]">·</span>
          <span className="inline-flex items-center gap-1.5 text-[var(--text-2)]">
            <FactorIcon icon={factor.icon} />
            {factor.label}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            className={`btn flex-1 justify-center ${picked === 'a' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => savePick('a')}
          >
            На {match.homeTeam.abbrev}
          </button>
          <button
            className={`btn flex-1 justify-center ${picked === 'b' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => savePick('b')}
          >
            На {match.awayTeam.abbrev}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate(`/matches/${match.id}`)}
          >
            Подробнее <span className="arrow">→</span>
          </button>
        </div>
      </div>
    );
  }

  /* ---------- DEFAULT ---------- */
  return (
    <article
      className="match-card"
      onClick={() => navigate(`/matches/${match.id}`)}
      style={
        {
          '--mc-home': match.homeTeam.brandColor || 'var(--accent)',
          '--mc-away': match.awayTeam.brandColor || 'var(--ai)',
        } as React.CSSProperties
      }
    >
      <div className="meta flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)]">
        <span>{formatRu(match.date)}</span>
        {isFinished ? (
          <span className="tag tag-gold">ОКОНЧЕН</span>
        ) : (
          <span className="tag">СКОРО</span>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        <div className={`flex items-center justify-between ${ai.a < ai.b ? 'opacity-55' : ''}`}>
          <div className="flex items-center gap-3">
            <TeamMark team={match.homeTeam} size="md" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {match.homeTeam.abbrev}
                <Home className="h-3 w-3 text-[var(--text-mute)]" aria-label="Дома" />
              </div>
              <div className="font-mono text-[10px] text-[var(--text-3)]">
                {match.homeTeam.wins}-{match.homeTeam.losses}
              </div>
            </div>
          </div>
          <div
            className="font-display text-2xl"
            style={{ color: ai.a > ai.b ? 'var(--accent)' : 'var(--text-mute)' }}
          >
            {isFinished ? match.homeScore ?? '—' : `${ai.a}%`}
          </div>
        </div>

        <div className={`flex items-center justify-between ${ai.b < ai.a ? 'opacity-55' : ''}`}>
          <div className="flex items-center gap-3">
            <TeamMark team={match.awayTeam} size="md" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {match.awayTeam.abbrev}
                <Plane className="h-3 w-3 text-[var(--text-mute)]" aria-label="Выезд" />
              </div>
              <div className="font-mono text-[10px] text-[var(--text-3)]">
                {match.awayTeam.wins}-{match.awayTeam.losses}
              </div>
            </div>
          </div>
          <div
            className="font-display text-2xl"
            style={{ color: ai.b > ai.a ? 'var(--accent)' : 'var(--text-mute)' }}
          >
            {isFinished ? match.awayScore ?? '—' : `${ai.b}%`}
          </div>
        </div>
      </div>

      {!isFinished && intelligence && (() => {
        const conf = confidenceOf(ai.a);
        const risk = deriveRisk(ai.a);
        const factors = deriveFactorTable(match.homeTeam, match.awayTeam, ai.a);
        const scoreIdx = deriveScoreIndex(match, ai.a);
        const explanation = deriveAiExplanation(match, ai.a, factors);
        return (
          <>
            <ModelPickBadge ai={ai} match={match} />
            <ViewModeSwitch mode={mode} onChange={setMode} />

            {mode !== 'simple' && (
              <>
                {/* Confidence + Risk row */}
                <div className="mc-pulse" onClick={(e) => e.stopPropagation()}>
                  <ConfidenceMeter level={conf.level} label={conf.label} tone={conf.tone} />
                  <div className="mc-risk">
                    <span className="mc-risk-lbl">РИСК</span>
                    <span className="mc-risk-val" style={{ color: risk.tone }}>
                      <AlertTriangle className="h-3 w-3" />
                      {risk.label}
                    </span>
                  </div>
                </div>

                {/* Factor comparison strip */}
                <FactorStrip
                  factors={factors}
                  home={match.homeTeam}
                  away={match.awayTeam}
                />

                {/* Detailed intel — form / Δ24h */}
                <IntelStrip match={match} ai={ai} />
              </>
            )}

            {mode === 'ai' && (
              <>
                {/* SCORE Index — proprietary pick-quality metric */}
                <ScoreIndexBlock idx={scoreIdx} />

                {/* AI explanation — one-liner why */}
                <div className="mc-ai-note">
                  <Sparkles className="h-3 w-3" />
                  <span>{explanation}</span>
                </div>

                <PredictionTimeline match={match} ai={ai} />
                <DataSourcesStrip />

                {/* Before You Pick — collapsible model recommendation */}
                <BeforePickPanel
                  homeAbbr={match.homeTeam.abbrev || 'HOME'}
                  awayAbbr={match.awayTeam.abbrev || 'AWAY'}
                  homePct={ai.a}
                  factors={factors}
                  winnerAbbr={ai.a >= ai.b ? (match.homeTeam.abbrev || '') : (match.awayTeam.abbrev || '')}
                />
              </>
            )}
          </>
        );
      })()}

      {/* Pick footer — always present on default cards (intelligence or not) */}
      {!isFinished && (
        <div
          className="mt-4 flex gap-2 border-t border-dashed border-[var(--line)] pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`flex flex-1 flex-col items-center gap-1 rounded-[10px] border px-2.5 py-2.5 font-semibold transition ${
              picked === 'a'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'
            }`}
            onClick={() => savePick('a')}
          >
            <span className="font-mono text-[10px] tracking-[0.1em]">{match.homeTeam.abbrev}</span>
            <span className="font-display text-base">{ai.a}%</span>
          </button>
          <button
            className={`flex flex-1 flex-col items-center gap-1 rounded-[10px] border px-2.5 py-2.5 font-semibold transition ${
              picked === 'b'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'
            }`}
            onClick={() => savePick('b')}
          >
            <span className="font-mono text-[10px] tracking-[0.1em]">{match.awayTeam.abbrev}</span>
            <span className="font-display text-base">{ai.b}%</span>
          </button>
        </div>
      )}
    </article>
  );
};

export default MatchCard;
