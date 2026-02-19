import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiRequest } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { 
  LineChartComponent, 
  BarChartComponent, 
  PieChartComponent,
  ProgressBar  // <-- Здесь НЕТ запятой
} from '@/shared/ui/Charts';  // <-- Закрывающая скобка на новой строке
import { TrendingUp, Activity, Target, Award } from 'lucide-react';

export const AnalyticsPage = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiRequest<any>('/predict/stats');
      setStats(data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    } finally {
      setLoading(false);
    }
  };

  // Демо-данные для графиков
  const accuracyData = [
    { month: 'Янв', acc: 65 },
    { month: 'Фев', acc: 68 },
    { month: 'Мар', acc: 72 },
    { month: 'Апр', acc: 75 },
    { month: 'Май', acc: 79 },
    { month: 'Июн', acc: 82 },
  ];

  const predictionsByDay = [
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-white mb-2">Аналитика</h1>
        <p className="text-slate-400">Статистика работы AI модели</p>
      </motion.div>

      {/* Карточки с метриками */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlowingCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Target className="w-8 h-8 text-orange-400" />
            <span className="text-2xl font-bold text-white">{stats?.accuracy || 0}%</span>
          </div>
          <p className="text-slate-400">Точность модели</p>
        </GlowingCard>

        <GlowingCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">{stats?.totalPredictions || 0}</span>
          </div>
          <p className="text-slate-400">Всего прогнозов</p>
        </GlowingCard>

        <GlowingCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-green-400" />
            <span className="text-2xl font-bold text-white">+18%</span>
          </div>
          <p className="text-slate-400">Рост точности</p>
        </GlowingCard>

        <GlowingCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Award className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-bold text-white">14,841</span>
          </div>
          <p className="text-slate-400">Обучающих матчей</p>
        </GlowingCard>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChartComponent
          title="Динамика точности модели"
          data={accuracyData}
          dataKey="acc"
          xAxisKey="month"
        />

        <BarChartComponent
          title="Активность по дням недели"
          data={predictionsByDay}
          dataKey="count"
          xAxisKey="day"
        />

        <PieChartComponent
          title="Точность прогнозов"
          data={pieData}
          nameKey="name"
          valueKey="value"
        />
      </div>

      {/* Детальная статистика */}
      <GlowingCard className="p-6">
        <h3 className="text-lg font-bold text-white mb-6">Детальная статистика</h3>
        
        <div className="space-y-6">
          <ProgressBar value={87} label="Точность модели" />
          <ProgressBar value={65} label="Точность на выезде" color="#3b82f6" />
          <ProgressBar value={72} label="Точность дома" color="#10b981" />
          <ProgressBar value={93} label="Уверенность при >60%" color="#8b5cf6" />
        </div>
      </GlowingCard>
    </div>
  );
};

export default AnalyticsPage;