import { ExternalLink } from 'lucide-react';
import type { PredictionContext } from '@/shared/api/client';

const statusText = {
  applied: 'Поправка рассчитана по подтверждённым отсутствиям.',
  neutral: 'По доступной сводке поправка равна нулю.',
  no_match: 'В ближайшие 72 часа такой встречи в расписании нет.',
  unavailable: 'Для этой встречи нет свежих данных по обеим командам.',
};

export function PredictionContextSummary({ context, home, away }: {
  context: PredictionContext; home?: string; away?: string;
}) {
  const sign = context.shiftTeam1 > 0 ? '+' : '';
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-2)]">{statusText[context.status]}</p>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--line)] p-3 text-sm sm:grid-cols-3">
        <div><dt className="text-[var(--text-2)]">Базовый шанс {home}</dt><dd className="font-mono text-xl">{context.baseTeam1}%</dd></div>
        <div><dt className="text-[var(--text-2)]">С учётом состава</dt><dd className="font-mono text-xl">{context.adjustedTeam1}%</dd></div>
        <div><dt className="text-[var(--text-2)]">Изменение</dt><dd className="font-mono text-xl">{sign}{context.shiftTeam1} п. п.</dd></div>
      </dl>
      {context.absences.length > 0 && (
        <ul className="space-y-1 text-sm text-[var(--text-2)]">
          {context.absences.map((entry) => (
            <li key={entry.side + ':' + entry.player}>{entry.side === 1 ? home : away} · {entry.player} · не сыграет</li>
          ))}
        </ul>
      )}
      {context.sourceUrl && (
        <a className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-strong)]" href={context.sourceUrl} target="_blank" rel="noreferrer">
          Сводка ESPN <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      <p className="text-xs leading-relaxed text-[var(--text-2)]">Экспериментальная оценка. За каждого дополнительного игрока со статусом Out у одной команды — 1,5 п. п. в пользу соперника. Максимум 6 п. п.</p>
    </div>
  );
}
