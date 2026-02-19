import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiRequest, Team } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { ArrowLeft, Trophy, MapPin, Calendar, Users } from 'lucide-react';

export const TeamPage = () => {
  const { teamId } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  const loadTeam = async () => {
    try {
      const data = await apiRequest<Team>(`/teams/${teamId}`);
      setTeam(data);
    } catch (err) {
      setError('Команда не найдена');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <Link to="/teams" className="text-orange-400 hover:text-orange-300 mt-4 inline-block">
          ← Назад к командам
        </Link>
      </div>
    );
  }

  const winPercentage = team.wins + team.losses > 0 
    ? ((team.wins / (team.wins + team.losses)) * 100).toFixed(1)
    : '0';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <Link to="/teams" className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-2 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Назад к списку
      </Link>

      <GlowingCard glowColor="orange" intensity="high" className="p-8 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{team.name}</h1>
            <p className="text-slate-400">{team.city}</p>
          </div>
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-3xl font-bold">
            {team.abbrev}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-slate-400 mb-1">Победы</p>
            <p className="text-3xl font-bold text-green-400">{team.wins}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Поражения</p>
            <p className="text-3xl font-bold text-red-400">{team.losses}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">% побед</p>
            <p className="text-3xl font-bold text-orange-400">{winPercentage}%</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Чемпионства</p>
            <p className="text-3xl font-bold text-yellow-400">{team.championships || 0}</p>
          </div>
        </div>
      </GlowingCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlowingCard glowColor="blue" className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Арена
          </h3>
          <p className="text-2xl font-bold text-white mb-2">{team.arena || 'Не указано'}</p>
          <p className="text-slate-400">Основана в {team.foundedYear || 'Не указано'}</p>
        </GlowingCard>

        <GlowingCard glowColor="purple" className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Статистика
          </h3>
          <div className="space-y-2">
            <p>Средние очки: <span className="text-orange-400 font-bold">{team.pointsPerGame?.toFixed(1) || '0'}</span></p>
            <p>Пропущено: <span className="text-blue-400 font-bold">{team.pointsAgainst?.toFixed(1) || '0'}</span></p>
          </div>
        </GlowingCard>
      </div>

      <div className="mt-8 flex gap-4">
        <Link
          to={`/prediction/new?team1=${team.id}`}
          className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
        >
          Сделать прогноз с этой командой
        </Link>
      </div>
    </motion.div>
  );
};

export default TeamPage;