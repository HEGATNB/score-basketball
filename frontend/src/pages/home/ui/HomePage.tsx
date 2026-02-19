import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Trophy, 
  TrendingUp, 
  Cpu, 
  Flame, 
  Target, 
  Zap,
  Users,
  AlertCircle
} from 'lucide-react';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { apiRequest, Team, Match, Prediction } from '@/shared/api/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';

export const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [recentPredictions, setRecentPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiConfidence, setAiConfidence] = useState(0);
  const [liveScore] = useState({ home: 108, away: 102 });

  useEffect(() => {
    const interval = setInterval(() => {
      setAiConfidence(prev => (prev < 87 ? prev + 1 : 87));
    }, 18);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsData, matchesData] = await Promise.all([
        apiRequest<Team[]>('/teams'),
        apiRequest<Match[]>('/matches?status=finished&limit=5')
      ]);
      
      setTeams(teamsData.slice(0, 3)); // Топ-3 команды для показа
      setRecentMatches(matchesData.slice(0, 3));

      if (user) {
        const predictions = await apiRequest<Prediction[]>('/predictions/my');
        setRecentPredictions(predictions.slice(0, 3));
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Точность модели', value: `${aiConfidence}%`, trend: '+2.4%', icon: Target, color: 'orange' },
    { label: 'Всего команд', value: teams.length.toString(), sub: 'в лиге', icon: Activity, color: 'blue' },
    { label: 'Активных матчей', value: '4', sub: 'сегодня', icon: Zap, color: 'green' },
    { label: 'ROI', value: '+18%', trend: 'стабильно', icon: TrendingUp, color: 'purple' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-4"
      >
        <div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight font-spacegrotesk text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
            Hoops<span className="text-orange-500 text-glow-orange">AI</span>
          </h1>
          <p className="text-slate-400 text-lg mt-2 max-w-2xl">
            Платформа продвинутой аналитики NBA с интеграцией нейросетей
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-xl px-4 py-2 rounded-2xl border border-slate-800/50">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-green-400 animate-pulse">
            {user ? `Привет, ${user.name}` : 'SYSTEM ONLINE'}
          </span>
        </div>
      </motion.div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <GlowingCard
            key={stat.label}
            glowColor={stat.color as any}
            delay={index * 0.1}
            className="p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
              </div>
              {stat.trend && (
                <span className={`text-sm font-medium text-${stat.color}-400 bg-${stat.color}-500/10 px-2 py-1 rounded-lg`}>
                  {stat.trend}
                </span>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold font-spacegrotesk">{stat.value}</p>
              {stat.sub && <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>}
            </div>
          </GlowingCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Predictor */}
        <GlowingCard
          glowColor="orange"
          intensity="high"
          className="lg:col-span-2 p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Cpu className="w-8 h-8 text-orange-400" />
              <div>
                <h3 className="text-xl font-bold">AI Match Predictor</h3>
                <p className="text-sm text-slate-400">Модель v2.4 • Обучена на 14,841 матчах</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/prediction/new')}
              className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
            >
              Новый прогноз
            </button>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div className="text-center flex-1">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-3 shadow-xl shadow-orange-500/30">
                <span className="text-3xl font-black text-white">BOS</span>
              </div>
              <p className="text-slate-300 font-medium">Boston Celtics</p>
              <p className="text-sm text-slate-500 mt-1">39-21</p>
            </div>

            <div className="flex flex-col items-center px-6">
              <div className="text-6xl font-black font-spacegrotesk text-white mb-2">
                {liveScore.home} : {liveScore.away}
              </div>
              <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 to-yellow-400"
                  initial={{ width: '65%' }}
                  animate={{ width: '65%' }}
                  transition={{ duration: 1 }}
                />
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Home Win Probability: <span className="text-orange-400 font-bold">65%</span>
              </p>
            </div>

            <div className="text-center flex-1">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-3 shadow-xl shadow-blue-500/30">
                <span className="text-3xl font-black text-white">MIA</span>
              </div>
              <p className="text-slate-300 font-medium">Miami Heat</p>
              <p className="text-sm text-slate-500 mt-1">32-28</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Точность', value: '87%', color: 'orange' },
              { label: 'Уверенность', value: 'High', color: 'green' },
              { label: 'Фактор дома', value: '+5%', color: 'blue' },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 bg-slate-800/30 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                <p className={`text-lg font-bold text-${item.color}-400`}>{item.value}</p>
              </div>
            ))}
          </div>
        </GlowingCard>

        {/* Боковая панель */}
        <div className="space-y-6">
          {/* Топ команды */}
          <GlowingCard glowColor="purple" className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h3 className="font-bold">Топ команды</h3>
            </div>
            <div className="space-y-3">
              {teams.map((team, i) => (
                <div key={team.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-slate-400">#{i + 1}</span>
                    <span className="font-medium">{team.name}</span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                    {team.wins}-{team.losses}
                  </span>
                </div>
              ))}
            </div>
          </GlowingCard>

          {/* Последние матчи */}
          <GlowingCard glowColor="red" className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-red-400" />
              <h3 className="font-bold">Последние матчи</h3>
            </div>
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <div key={match.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{match.homeTeam.name} vs {match.awayTeam.name}</span>
                  <span className="text-sm font-mono text-orange-400">
                    {match.homeScore}:{match.awayScore}
                  </span>
                </div>
              ))}
            </div>
          </GlowingCard>

          {/* Топ скореры */}
          <GlowingCard glowColor="blue" className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold">Топ скореры</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Luka Dončić</span>
                <span className="text-blue-400">32.4 PPG</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shai Gilgeous-Alexander</span>
                <span className="text-blue-400">31.1 PPG</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Giannis Antetokounmpo</span>
                <span className="text-blue-400">30.7 PPG</span>
              </div>
            </div>
          </GlowingCard>
        </div>
      </div>

      {/* Последние прогнозы пользователя */}
      {user && recentPredictions.length > 0 && (
        <GlowingCard glowColor="green" className="p-6">
          <h3 className="text-lg font-bold mb-4">Ваши последние прогнозы</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentPredictions.map((pred) => (
              <div key={pred.id} className="bg-slate-800/30 p-4 rounded-xl">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-400">
                    {new Date(pred.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                    {pred.confidence}% уверенность
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{pred.team1?.name}</p>
                    <p className="text-sm text-orange-400">{pred.probabilityTeam1}%</p>
                  </div>
                  <span className="text-slate-500">vs</span>
                  <div className="text-right">
                    <p className="font-medium">{pred.team2?.name}</p>
                    <p className="text-sm text-blue-400">{pred.probabilityTeam2}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlowingCard>
      )}
    </div>
  );
};

export default HomePage;
import { LineChartComponent, BarChartComponent, PieChartComponent, RadarChartComponent } from '@/shared/ui/Charts';

// Добавь данные для графиков
const accuracyData = [
  { month: 'Янв', accuracy: 65 },
  { month: 'Фев', accuracy: 68 },
  { month: 'Мар', accuracy: 72 },
  { month: 'Апр', accuracy: 75 },
  { month: 'Май', accuracy: 79 },
  { month: 'Июн', accuracy: 82 },
  { month: 'Июл', accuracy: 84 },
  { month: 'Авг', accuracy: 86 },
  { month: 'Сен', accuracy: 87 },
];

const predictionsData = [
  { day: 'Пн', count: 12 },
  { day: 'Вт', count: 18 },
  { day: 'Ср', count: 15 },
  { day: 'Чт', count: 24 },
  { day: 'Пт', count: 32 },
  { day: 'Сб', count: 45 },
  { day: 'Вс', count: 38 },
];

const pieData = [
  { name: 'Точные', value: 68 },
  { name: 'Неточные', value: 32 },
];

const teamComparisonData = [
  { metric: 'Очки', Lakers: 115, Celtics: 118, Warriors: 122 },
  { metric: 'Подборы', Lakers: 42, Celtics: 44, Warriors: 43 },
  { metric: 'Передачи', Lakers: 26, Celtics: 28, Warriors: 29 },
  { metric: 'Перехваты', Lakers: 7, Celtics: 8, Warriors: 7 },
  { metric: 'Блоки', Lakers: 5, Celtics: 6, Warriors: 5 },
];

// Добавь этот JSX в конец return (после последнего GlowingCard)
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
  <LineChartComponent
    title="Точность модели по месяцам"
    data={accuracyData}
    dataKey="accuracy"
    xAxisKey="month"
  />
  
  <BarChartComponent
    title="Активность прогнозов"
    data={predictionsData}
    dataKey="count"
    xAxisKey="day"
  />
  
  <PieChartComponent
    title="Точность прогнозов"
    data={pieData}
    nameKey="name"
    valueKey="value"
  />
  
  <RadarChartComponent
    title="Сравнение топ-команд"
    data={teamComparisonData}
    dataKeys={['Lakers', 'Celtics', 'Warriors']}
  />
</div>