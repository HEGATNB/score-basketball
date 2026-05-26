import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import type { Match } from '@/shared/api/client';
import { TeamMark } from './TeamMark';

interface MatchCardProps {
  match: Match;
  delay?: number;
  variant?: 'default' | 'compact' | 'featured';
  /** AI win probability override (0..100) if not part of Match */
  aiHome?: number;
  aiAway?: number;
}

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

function deriveAi(match: Match, aiHome?: number, aiAway?: number) {
  if (typeof aiHome === 'number' && typeof aiAway === 'number') return { a: aiHome, b: aiAway };
  // Simple heuristic from win records so the UI never shows blanks
  const h = (match.homeTeam.wins || 0) - (match.homeTeam.losses || 0);
  const a = (match.awayTeam.wins || 0) - (match.awayTeam.losses || 0);
  const total = Math.max(1, Math.abs(h) + Math.abs(a) + 10);
  const homePct = Math.max(35, Math.min(72, 50 + ((h - a) / total) * 35));
  return { a: Math.round(homePct), b: Math.round(100 - homePct) };
}

export const MatchCard = ({ match, variant = 'default', aiHome, aiAway }: MatchCardProps) => {
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

  if (variant === 'compact') {
    return (
      <button
        onClick={() => navigate(`/matches/${match.id}`)}
        className="match-card w-full text-left"
      >
        <div className="meta flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)]">
          <span>{formatRu(match.date)}</span>
          {isFinished ? (
            <span className="tag tag-gold">FINAL</span>
          ) : (
            <span className="tag">UPCOMING</span>
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

  if (variant === 'featured') {
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
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-3)]">
              {match.homeTeam.wins}-{match.homeTeam.losses} · ДОМА
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-mute)]">
              AT
            </span>
            <span className="font-display text-2xl text-[var(--text-3)]">VS</span>
          </div>
          <div className="text-center">
            <TeamMark team={match.awayTeam} size="lg" className="mx-auto mb-3" showGlow />
            <div className="font-display text-2xl uppercase">{match.awayTeam.abbrev}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-3)]">
              {match.awayTeam.wins}-{match.awayTeam.losses} · ВЫЕЗД
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
            style={{ background: 'var(--neon)', color: '#0a0a0c' }}
          >
            {ai.a}% <span className="text-sm">▲</span>
          </div>
          <div
            className="flex items-center justify-center gap-2 font-display text-2xl"
            style={{ background: 'var(--info)', color: '#0a0a0c' }}
          >
            <span className="text-sm">▼</span> {ai.b}%
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            className={`btn flex-1 justify-center ${picked === 'a' ? 'btn-primary' : ''}`}
            onClick={() => savePick('a')}
            style={picked !== 'a' ? { borderColor: 'rgba(209,255,58,0.4)', color: 'var(--neon)' } : undefined}
          >
            На {match.homeTeam.abbrev}
          </button>
          <button
            className={`btn flex-1 justify-center ${picked === 'b' ? 'btn-primary' : ''}`}
            onClick={() => savePick('b')}
            style={picked !== 'b' ? { borderColor: 'rgba(93,184,255,0.4)', color: 'var(--info)' } : undefined}
          >
            На {match.awayTeam.abbrev}
          </button>
          <button
            className="btn"
            onClick={() => navigate(`/matches/${match.id}`)}
          >
            Подробнее <span className="arrow">→</span>
          </button>
        </div>
      </div>
    );
  }

  // default — used in upcoming grid
  return (
    <article
      className="match-card"
      onClick={() => navigate(`/matches/${match.id}`)}
    >
      <div className="meta flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)]">
        <span>{formatRu(match.date)}</span>
        {isFinished ? (
          <span className="tag tag-gold">FINAL</span>
        ) : (
          <span className="tag">UPCOMING</span>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        <div className={`flex items-center justify-between ${ai.a < ai.b ? 'opacity-55' : ''}`}>
          <div className="flex items-center gap-3">
            <TeamMark team={match.homeTeam} size="md" />
            <div>
              <div className="font-semibold text-sm">{match.homeTeam.abbrev}</div>
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
              <div className="font-semibold text-sm">{match.awayTeam.abbrev}</div>
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

      {!isFinished && (
        <div
          className="mt-5 flex gap-2 border-t border-dashed border-[var(--line)] pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`flex flex-1 flex-col items-center gap-1 rounded-[10px] border px-2.5 py-2.5 font-semibold transition ${
              picked === 'a'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#0a0a0c]'
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
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#0a0a0c]'
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
