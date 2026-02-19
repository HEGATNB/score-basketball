import React from 'react';
import { motion } from 'framer-motion'; // <-- ВАЖНО: добавить импорт motion!
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { GlowingCard } from './GlowingCard';

// Цвета для графиков
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

interface ChartProps {
  title?: string;
  data: any[];
  className?: string;
}

// Линейный график (тренды)
export const LineChartComponent: React.FC<ChartProps & { 
  dataKey: string; 
  xAxisKey: string;
  color?: string;
}> = ({ title, data, dataKey, xAxisKey, color = '#f97316', className = '' }) => {
  return (
    <GlowingCard className={`p-6 ${className}`}>
      {title && <h3 className="text-lg font-bold text-white mb-4">{title}</h3>}
      <div className="h-64 w-full"> {/* Добавлен w-full */}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
              labelStyle={{ color: '#f8fafc' }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ fill: color }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlowingCard>
  );
};

// Столбчатая диаграмма
export const BarChartComponent: React.FC<ChartProps & { 
  dataKey: string; 
  xAxisKey: string;
}> = ({ title, data, dataKey, xAxisKey, className = '' }) => {
  return (
    <GlowingCard className={`p-6 ${className}`}>
      {title && <h3 className="text-lg font-bold text-white mb-4">{title}</h3>}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
              labelStyle={{ color: '#f8fafc' }}
            />
            <Bar dataKey={dataKey} fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlowingCard>
  );
};

// Круговая диаграмма
export const PieChartComponent: React.FC<ChartProps & { 
  nameKey: string; 
  valueKey: string;
}> = ({ title, data, nameKey, valueKey, className = '' }) => {
  return (
    <GlowingCard className={`p-6 ${className}`}>
      {title && <h3 className="text-lg font-bold text-white mb-4">{title}</h3>}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry[nameKey]}: ${entry[valueKey]}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={valueKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </GlowingCard>
  );
};

// Радарная диаграмма (для сравнения команд)
export const RadarChartComponent: React.FC<ChartProps & {
  dataKeys: string[];
}> = ({ title, data, dataKeys, className = '' }) => {
  return (
    <GlowingCard className={`p-6 ${className}`}>
      {title && <h3 className="text-lg font-bold text-white mb-4">{title}</h3>}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="metric" stroke="#94a3b8" />
            <PolarRadiusAxis stroke="#334155" />
            {dataKeys.map((key, index) => (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
            <Legend />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </GlowingCard>
  );
};

// Прогресс-бар с анимацией (исправлен)
export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; label?: string }> = ({ 
  value, 
  max = 100, 
  color = '#f97316',
  label
}) => {
  const percentage = (value / max) * 100;
  
  return (
    <div className="space-y-1 w-full">
      {label && <p className="text-sm text-slate-400">{label}</p>}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden w-full">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
};