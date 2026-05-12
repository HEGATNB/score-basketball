import { useEffect, useState } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { apiRequest } from '@/shared/api/client';
import type { Team } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { Link } from 'react-router-dom';

const TeamCard = ({ columnIndex, rowIndex, style, data }: any) => {
  const index = rowIndex * 3 + columnIndex;
  const team = data.teams[index];
  if (!team) return null;

  return (
    <div style={style} className="p-2">
      <Link to={`/teams/${team.id}`}>
        <GlowingCard className="p-4 h-full">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-2">
              <span className="text-lg font-bold">{team.abbrev}</span>
            </div>
            <h3 className="font-bold text-white text-sm">{team.name}</h3>
            <p className="text-xs text-slate-400">{team.wins}-{team.losses}</p>
          </div>
        </GlowingCard>
      </Link>
    </div>
  );
};

export const TeamsPageVirtual = () => {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    apiRequest<Team[]>('/teams').then(setTeams);
  }, []);

  return (
    <div className="h-[800px] w-full">
      <AutoSizer>
        {({ height, width }: { height: number; width: number }) => (
          <Grid
            columnCount={3}
            columnWidth={width / 3}
            height={height}
            rowCount={Math.ceil(teams.length / 3)}
            rowHeight={200}
            width={width}
            itemData={{ teams }}
          >
            {TeamCard}
          </Grid>
        )}
      </AutoSizer>
    </div>
  );
};

export default TeamsPageVirtual;
