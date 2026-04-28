import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarRange, MapPin, Users } from 'lucide-react';
import { apiRequest, type Player, type Team } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { PlayerCard } from '@/shared/ui/PlayerCard';
import { TeamMark } from '@/shared/ui/TeamMark';
import { hexToRgba } from '@/shared/lib/teamBrand';

export const TeamPage = () => {
  const { teamId } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamId) {
      setError('Team id is missing.');
      setLoading(false);
      return;
    }
    apiRequest<Team>(`/teams/${teamId}`)
      .then((teamData) => {
        setTeam(teamData);
        if (teamData.abbrev) {
          return apiRequest<Player[]>(`/players/team/${teamData.abbrev}`)
            .then(setPlayers);
        }
        return [];
      })
      .catch((err) => {
        console.error('Error loading team data:', err);
        setError('Unable to load this team profile right now.');
      })
      .finally(() => setLoading(false));
  }, [teamId]);

  const winRate = useMemo(() => {
    if (!team) {
      return 0;
    }

    const totalGames = team.wins + team.losses;
    return totalGames > 0 ? (team.wins / totalGames) * 100 : 0;
  }, [team]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
      </div>
    );
  }

  if (!team || error) {
    return (
      <div className="space-y-6">
        <Link to="/teams" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to teams
        </Link>
        <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">{error || 'Team not found.'}</p>
      </div>
    );
  }

  const differential = team.avgPointsFor - team.avgPointsAgainst;
  const tint = hexToRgba(team.brandColor || '#c96a2b', 0.16);

  return (
    <div className="space-y-8">
      <Link to="/teams" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to team index
      </Link>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <GlowingCard glowColor="orange" className="p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="data-chip">{team.conference?.shortName || team.conference?.name || 'League'}</span>
            <span className="data-chip">{team.division?.name || 'Division'}</span>
          </div>

          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Team profile</p>
              <h1 className="mt-3 font-spacegrotesk text-4xl font-bold text-white sm:text-5xl">{team.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Current form, scoring profile and roster rotation for {team.city || team.name}.
              </p>
            </div>

            <TeamMark team={team} size="lg" />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="metric-panel">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Record</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {team.wins}-{team.losses}
              </p>
            </div>
            <div className="metric-panel">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Win rate</p>
              <p className="mt-3 text-3xl font-semibold text-white">{winRate.toFixed(1)}%</p>
            </div>
            <div className="metric-panel">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Offense</p>
              <p className="mt-3 text-3xl font-semibold text-white">{team.avgPointsFor.toFixed(1)}</p>
            </div>
            <div className="metric-panel">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Defense</p>
              <p className="mt-3 text-3xl font-semibold text-white">{team.avgPointsAgainst.toFixed(1)}</p>
            </div>
          </div>

          <div className="surface-muted mt-6" style={{ borderColor: tint }}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-400">Net rating proxy</span>
              <span className={`font-semibold ${differential >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {differential >= 0 ? '+' : ''}
                {differential.toFixed(1)}
              </span>
            </div>
          </div>
        </GlowingCard>

        <div className="grid gap-6">
          <GlowingCard glowColor="blue" className="p-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-[#d6e1eb]" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[rgba(214,225,235,0.72)]">Home floor</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{team.arena || 'Arena not available'}</h2>
              </div>
            </div>
            <p className="mt-4 text-slate-300">
              {team.city || 'Unknown city'} / founded {team.foundedYear || 'n/a'}
            </p>
          </GlowingCard>

          <GlowingCard glowColor="green" className="p-6">
            <div className="flex items-center gap-3">
              <CalendarRange className="h-5 w-5 text-[#d5e0d2]" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[rgba(213,224,210,0.72)]">Season snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Rotation and balance</h2>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="surface-muted">
                <p className="text-slate-500">Roster loaded</p>
                <p className="mt-2 text-lg font-semibold text-white">{players.length} players</p>
              </div>
              <div className="surface-muted">
                <p className="text-slate-500">Conference</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {team.conference?.shortName || team.conference?.name || 'League'}
                </p>
              </div>
            </div>
          </GlowingCard>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-[#ecd8ab]" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Roster</p>
            <h2 className="text-2xl font-semibold text-white">Core rotation</h2>
          </div>
        </div>

        {players.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {players.map((player, index) => (
              <PlayerCard key={player.id} player={player} delay={index * 0.04} />
            ))}
          </div>
        ) : (
          <GlowingCard glowColor="purple" className="p-8 text-center">
            <p className="text-white">Player data for this team is not available yet.</p>
          </GlowingCard>
        )}
      </section>
    </div>
  );
};

export default TeamPage;