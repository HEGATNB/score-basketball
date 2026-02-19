import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { apiRequest, Team } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { Users, Trophy, MapPin } from 'lucide-react';

export const TeamsPage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const data = await apiRequest<Team[]>('/teams');
      // Сортируем по победам
      setTeams(data.sort((a, b) => b.wins - a.wins));
    } catch (err) {
      setError('Не удалось загрузить команды');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Загрузка команд...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-white mb-2">Команды NBA</h1>
        <p className="text-slate-400">Все 30 команд лиги с реальной статистикой</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team, index) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link to={`/teams/${team.id}`}>
              <GlowingCard 
                glowColor={team.wins > team.losses ? 'green' : 'orange'} 
                className="p-6 h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{team.name}</h2>
                    <p className="text-sm text-slate-400">{team.city}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-xl font-bold">
                    {team.abbrev}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-slate-400">Победы</p>
                    <p className="text-2xl font-bold text-green-400">{team.wins}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Поражения</p>
                    <p className="text-2xl font-bold text-red-400">{team.losses}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <MapPin className="w-4 h-4" />
                  <span>{team.arena}</span>
                </div>
              </GlowingCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TeamsPage;