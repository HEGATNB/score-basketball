import { useEffect, useState } from 'react';
import { apiRequest, type Player, type Team } from '@/shared/api/client';
import { liveApi } from '@/shared/api/live';

interface MarqueeItem {
  text: string;
  highlight?: boolean;
}

interface MarqueeProps {
  items?: MarqueeItem[];
}

const FALLBACK: MarqueeItem[] = [
  { text: 'SEASON 2025/26' },
  { text: 'NBA · LIVE DATA', highlight: true },
  { text: 'AI-АНАЛИТИКА' },
  { text: 'ПРИСОЕДИНЯЙСЯ К РЕЙТИНГУ', highlight: true },
];

export const Marquee = ({ items }: MarqueeProps) => {
  const [dynamic, setDynamic] = useState<MarqueeItem[] | null>(null);

  useEffect(() => {
    if (items) return; // external override — don't fetch
    let cancelled = false;

    const run = async () => {
      try {
        const [sb, topTeams, topPlayers] = await Promise.all([
          liveApi.scoreboard().catch(() => null),
          apiRequest<Team[]>('/teams').catch(() => [] as Team[]),
          apiRequest<Player[]>('/players?limit=3&sort_by=pts&sort_order=desc&min_games=5').catch(
            () => [] as Player[],
          ),
        ]);
        if (cancelled) return;

        const out: MarqueeItem[] = [];

        // Live games count
        if (sb?.live?.length) {
          out.push({ text: `LIVE СЕЙЧАС · ${sb.live.length}`, highlight: true });
        }

        // Tonight's marquee match (the first scheduled)
        const tonight = sb?.upcoming?.[0];
        if (tonight) {
          out.push({
            text: `ИГРА ВЕЧЕРА · ${tonight.home.abbrev || '?'} VS ${tonight.away.abbrev || '?'}`,
            highlight: true,
          });
        }

        // Most recent final
        const lastFinal = sb?.finished?.[0];
        if (lastFinal) {
          out.push({
            text: `FINAL · ${lastFinal.home.abbrev} ${lastFinal.home.score ?? '?'} – ${lastFinal.away.score ?? '?'} ${lastFinal.away.abbrev}`,
          });
        }

        // Top team
        const sortedTeams = [...(topTeams || [])].sort((a, b) => b.wins - a.wins);
        if (sortedTeams.length > 0) {
          const t = sortedTeams[0];
          out.push({
            text: `ЛИДЕР ЛИГИ · ${t.abbrev || t.name} ${t.wins}-${t.losses}`,
          });
        }

        // Top scorer
        const scorer = topPlayers?.[0];
        if (scorer) {
          out.push({
            text: `ТОП-СКОРЕР · ${scorer.first_name} ${scorer.last_name} ${scorer.points_per_game.toFixed(1)} PPG`,
            highlight: true,
          });
        }

        // Season + AI tagline
        if (sb?.season) {
          out.push({ text: `СЕЗОН ${sb.season - 1}/${sb.season}` });
        } else {
          out.push({ text: 'SEASON 2025/26' });
        }
        out.push({ text: 'NBA · LIVE DATA · MODEL INSIGHTS' });

        if (!cancelled) setDynamic(out.length > 0 ? out : FALLBACK);
      } catch {
        if (!cancelled) setDynamic(FALLBACK);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const list = items || dynamic || FALLBACK;
  const all = [...list, ...list];

  return (
    <div className="marquee">
      <div className="marquee-track">
        {all.map((item, i) => (
          <span key={i} className="marquee-item">
            <span className="star">✦</span>
            {item.highlight ? <em>{item.text}</em> : item.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Marquee;
