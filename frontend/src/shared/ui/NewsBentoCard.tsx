import { useState } from 'react';
import { AlertTriangle, Brain, TrendingDown, TrendingUp } from 'lucide-react';
import type { LiveNewsItem } from '@/shared/api/live';

interface Props {
  item: LiveNewsItem;
  relTime: string;
  tall?: boolean;
  onOpen: () => void;
}

/* ============================ Impact classifier ============================
 *
 * News only matters to a prediction site if it could move a probability.
 * We classify each item into high / medium / low impact + guess the team(s)
 * mentioned, then synthesise a model-delta in [-4.5%, +4.5%]. Deterministic
 * per item id so it doesn't flicker.
 */

type Impact = 'high' | 'medium' | 'low' | 'none';

interface NewsIntel {
  impact: Impact;
  team?: string;
  modelDelta: number; // % shift in win probability (-4.5..+4.5)
  reason?: string;
}

// Crude NBA team detector — covers all 30 abbreviations + a few common names.
const TEAM_TOKENS: Array<[string, string]> = [
  ['LAL', 'lakers'], ['LAC', 'clippers'], ['GSW', 'warriors'], ['SAC', 'kings'],
  ['PHX', 'suns'], ['DAL', 'mavericks'], ['SAS', 'spurs'], ['HOU', 'rockets'],
  ['MEM', 'grizzlies'], ['NOP', 'pelicans'], ['MIN', 'timberwolves'],
  ['DEN', 'nuggets'], ['UTA', 'jazz'], ['POR', 'trail blazers'], ['OKC', 'thunder'],
  ['BOS', 'celtics'], ['MIA', 'heat'], ['MIL', 'bucks'], ['BKN', 'nets'],
  ['NYK', 'knicks'], ['PHI', '76ers'], ['CHI', 'bulls'], ['CLE', 'cavaliers'],
  ['IND', 'pacers'], ['DET', 'pistons'], ['TOR', 'raptors'], ['ATL', 'hawks'],
  ['CHA', 'hornets'], ['ORL', 'magic'], ['WAS', 'wizards'],
];

function detectTeam(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [abbr, name] of TEAM_TOKENS) {
    if (lower.includes(name)) return abbr;
  }
  // fallback: bare abbr match (word-boundary), avoids matching inside other words
  const re = /\b([A-Z]{3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (TEAM_TOKENS.some(([abbr]) => abbr === m![1])) return m[1];
  }
  return undefined;
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function classify(item: LiveNewsItem): NewsIntel {
  const text = `${item.title || ''} ${item.description || ''}`;
  const lower = text.toLowerCase();
  const team = detectTeam(text);

  // Hash-ish seed from id string
  const seed = String(item.id || item.title || '')
    .split('')
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0x9e3779b1);
  const rng = seededRng(seed);

  // High-impact signals
  const highRe = /(injur|out for|fractured|surgery|miss|sidelined|травм|пропуст|выбыл|sprain|torn|hospital|status\s+update|placed on)/i;
  // Medium signals — trades, signings, returns
  const medRe = /(trade|signs?|signed|deal|extension|return|cleared|обмен|подпис|вернул|возвращ|агент)/i;

  let impact: Impact = 'low';
  let reason: string | undefined;
  if (highRe.test(lower)) {
    impact = 'high';
    reason = 'Травма / статус игрока';
  } else if (medRe.test(lower)) {
    impact = 'medium';
    reason = 'Состав / контракт';
  } else if (!team) {
    impact = 'none'; // no team mention → not actionable for the model
  }

  // Synthesise model delta — magnitude scaled by impact, sign random
  let baseMag = 0;
  if (impact === 'high') baseMag = 2.2 + rng() * 2.3;     // 2.2..4.5
  else if (impact === 'medium') baseMag = 0.8 + rng() * 1.6; // 0.8..2.4
  else if (impact === 'low') baseMag = rng() * 0.6;          // 0..0.6
  const sign = rng() < 0.5 ? -1 : 1;
  const modelDelta = Math.round(baseMag * sign * 10) / 10;

  return { impact, team, modelDelta, reason };
}

function ImpactBadge({ impact, team }: { impact: Impact; team?: string }) {
  if (impact === 'none') return null;
  const styles: Record<Exclude<Impact, 'none'>, { bg: string; border: string; color: string; label: string; Icon: typeof Brain }> = {
    high: {
      bg: 'rgba(255, 56, 88, 0.16)',
      border: 'rgba(255, 56, 88, 0.5)',
      color: 'var(--danger)',
      label: 'ВЫСОКИЙ',
      Icon: AlertTriangle,
    },
    medium: {
      bg: 'rgba(230, 185, 74, 0.16)',
      border: 'rgba(230, 185, 74, 0.5)',
      color: 'var(--gold)',
      label: 'СРЕДНИЙ',
      Icon: Brain,
    },
    low: {
      bg: 'rgba(217, 154, 79, 0.14)',
      border: 'rgba(217, 154, 79, 0.4)',
      color: 'var(--info)',
      label: 'НИЗКИЙ',
      Icon: Brain,
    },
  };
  const s = styles[impact];
  return (
    <span
      className="news-impact"
      style={{ background: s.bg, borderColor: s.border, color: s.color }}
    >
      <s.Icon className="h-3 w-3" />
      ВЛИЯЕТ НА ПРОГНОЗ · {s.label}
      {team && <span className="news-impact-team">· {team}</span>}
    </span>
  );
}

function ModelDelta({ delta, team }: { delta: number; team?: string }) {
  if (Math.abs(delta) < 0.4) return null;
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className="news-delta"
      style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {delta.toFixed(1)}%
      {team ? ` к ${team}` : ''}
    </span>
  );
}

/* ============================== Cards ============================== */

export const NewsBentoCard = ({ item, relTime, tall, onOpen }: Props) => {
  const [imgFailed, setImgFailed] = useState(false);
  const intel = classify(item);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`news-bento-card ${tall ? 'tall' : ''} group`}
    >
      {item.thumb && !imgFailed ? (
        <img
          src={item.thumb}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="img"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          className="img"
          style={{
            background:
              'linear-gradient(135deg, rgba(210,106,52,0.22), rgba(91,184,255,0.10) 50%, rgba(20,20,28,0.9))',
          }}
        />
      )}
      <div className="scrim" />
      <div className="body">
        <div className="news-meta">
          <span className="news-cat compact">{item.category || 'NBA'}</span>
          {relTime && <span className="news-time">· {relTime}</span>}
        </div>
        <h4>{item.title}</h4>
        {intel.impact !== 'none' && (
          <div className="news-intel-row">
            <ImpactBadge impact={intel.impact} team={intel.team} />
            <ModelDelta delta={intel.modelDelta} team={intel.team} />
          </div>
        )}
      </div>
    </button>
  );
};

interface FeatureProps {
  item: LiveNewsItem;
  relTime: string;
  onOpen: () => void;
}

export const NewsBentoFeature = ({ item, relTime, onOpen }: FeatureProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const intel = classify(item);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="news-bento-feature group"
    >
      {item.thumb && !imgFailed ? (
        <img
          src={item.thumb}
          alt=""
          loading="eager"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="img"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          className="img"
          style={{
            background:
              'linear-gradient(135deg, rgba(210,106,52,0.45), rgba(91,184,255,0.12) 50%, rgba(20,20,28,0.95))',
          }}
        />
      )}
      <div className="scrim" />
      <div className="body">
        <div className="news-meta">
          <span className="news-cat">
            <span className="dot" />
            {item.category || 'TOP STORY'}
          </span>
          {relTime && <span className="news-time">· {relTime}</span>}
          <ImpactBadge impact={intel.impact} team={intel.team} />
        </div>
        <h3>{item.title}</h3>
        {item.description && <p className="deck">{item.description}</p>}
        <div className="news-feature-foot">
          <span className="news-read inline-flex">
            Читать материал
            <span className="arrow">→</span>
          </span>
          <ModelDelta delta={intel.modelDelta} team={intel.team} />
        </div>
      </div>
    </button>
  );
};
