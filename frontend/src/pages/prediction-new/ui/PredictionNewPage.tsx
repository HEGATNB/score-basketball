import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiRequest } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { useAuth } from '@/app/providers/AuthProvider';
import { Cpu } from 'lucide-react';

interface Team {
  id: number;
  name: string;
  wins: number;
  losses: number;
}

export const PredictionNewPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const data = await apiRequest<Team[]>('/teams');
      setTeams(data);
    } catch (err) {
      console.error('Ошибка загрузки команд:', err);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handlePredict = async () => {
    if (!team1Id || !team2Id) {
      alert('Выберите обе команды');
      return;
    }
    if (team1Id === team2Id) {
      alert('Команды должны быть разными');
      return;
    }

    setLoading(true);
    try {
      console.log('📤 Отправляем запрос на /predict');
      
      const result = await apiRequest<any>('/predict', {
        method: 'POST',
        body: JSON.stringify({
          team1Id: Number(team1Id),
          team2Id: Number(team2Id)
        })
      });
      
      console.log('✅ Получен ответ от сервера:', result);
      console.log('📌 ID прогноза:', result.id);
      
      if (!result.id) {
        throw new Error('Сервер не вернул ID прогноза');
      }
      
      // Принудительный переход с таймаутом
      setTimeout(() => {
        navigate(`/prediction/${result.id}`);
      }, 100);
      
    } catch (err: any) {
      console.error('❌ Ошибка:', err);
      alert(err.message || 'Ошибка при создании прогноза');
    } finally {
      setLoading(false);
    }
  };

  if (loadingTeams) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlowingCard glowColor="orange" intensity="high" className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <Cpu className="w-8 h-8 text-orange-400" />
            <h1 className="text-3xl font-bold text-white">AI Прогноз</h1>
          </div>

          <div className="space-y-6">
            <select
              value={team1Id}
              onChange={(e) => setTeam1Id(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
              disabled={loading}
            >
              <option value="">Команда 1 (хозяева)</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.wins}-{t.losses})
                </option>
              ))}
            </select>

            <div className="text-center text-2xl font-bold text-slate-600">VS</div>

            <select
              value={team2Id}
              onChange={(e) => setTeam2Id(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
              disabled={loading}
            >
              <option value="">Команда 2 (гости)</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.wins}-{t.losses})
                </option>
              ))}
            </select>

            <button
              onClick={handlePredict}
              disabled={loading}
              className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold text-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>AI анализирует...</span>
                </>
              ) : (
                'Сделать прогноз'
              )}
            </button>
          </div>
        </GlowingCard>
      </motion.div>
    </div>
  );
};

export default PredictionNewPage;