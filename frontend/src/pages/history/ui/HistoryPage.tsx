import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiRequest } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { useAuth } from '@/app/providers/AuthProvider';
import { History, TrendingUp, Calendar } from 'lucide-react';

interface Prediction {
  id: string;
  probabilityTeam1: number;
  probabilityTeam2: number;
  expectedScoreTeam1: number;
  expectedScoreTeam2: number;
  createdAt: string;
  team1Id: number;
  team2Id: number;
  team1: any;
  team2: any;
}

export const HistoryPage = () => {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      const data = await apiRequest<Prediction[]>('/predictions/my');
      setPredictions(data);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-4">История прогнозов</h1>
        <p className="text-slate-400 mb-8">Войдите, чтобы увидеть свои прогнозы</p>
        <Link
          to="/auth"
          className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors inline-block"
        >
          Войти
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-4">История прогнозов</h1>
        <p className="text-slate-400 mb-8">У вас пока нет прогнозов</p>
        <Link
          to="/prediction/new"
          className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors inline-block"
        >
          Создать первый прогноз
        </Link>
      </div>
    );
  }

  const sortedPredictions = [...predictions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">История прогнозов</h1>
        <p className="text-slate-400">Всего прогнозов: {predictions.length}</p>
      </motion.div>

      <div className="space-y-4">
        {sortedPredictions.map((pred, index) => {
          const winner = pred.probabilityTeam1 > pred.probabilityTeam2 ? pred.team1 : pred.team2;
          const prob = Math.max(pred.probabilityTeam1, pred.probabilityTeam2);

          return (
            <motion.div
              key={pred.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`/prediction/${pred.id}`}>
                <GlowingCard className="p-6 hover:border-orange-500/50 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="flex items-center gap-1 text-sm text-slate-400">
                          <Calendar className="w-4 h-4" />
                          {new Date(pred.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-sm font-bold">
                            {pred.team1?.abbrev}
                          </div>
                          <span className="text-white">{pred.team1?.name}</span>
                        </div>
                        
                        <span className="text-slate-600">vs</span>
                        
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">
                            {pred.team2?.abbrev}
                          </div>
                          <span className="text-white">{pred.team2?.name}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-white mb-1">
                        {pred.expectedScoreTeam1} : {pred.expectedScoreTeam2}
                      </div>
                      <div className="text-sm text-orange-400">
                        Победа {winner?.abbrev} ({prob}%)
                      </div>
                    </div>
                  </div>
                </GlowingCard>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryPage;