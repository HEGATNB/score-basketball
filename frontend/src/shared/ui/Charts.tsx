import { motion } from 'framer-motion';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { Glass } from './Glass';

// Premium chart palette
const COLORS = ['#E76F2E', '#D4AF37', '#7DD3FC', '#86EFAC', '#C8581C', '#8C8579'];

const tooltipStyle = {
  backgroundColor: 'rgba(8, 9, 12, 0.92)',
  border: '1px solid rgba(245, 239, 226, 0.12)',
  borderRadius: 10,
  boxShadow: '0 24px 60px -12px rgba(0,0,0,0.6)',
  padding: '12px 14px',
  fontFamily: 'Geist, system-ui, sans-serif',
  fontSize: 12,
  color: '#F5EFE2',
};

const labelStyle = { color: '#F5EFE2', fontWeight: 500 };
const tooltipItemStyle = { color: '#F5EFE2', fontWeight: 500 };
const tooltipWrapperStyle = { outline: 'none' };
const axisStyle = { fill: '#8C8579', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' };

interface ChartProps {
  title?: string;
  data: any[];
  className?: string;
}

export const LineChartComponent = ({
  title,
  data,
  dataKey,
  xAxisKey,
  color = '#E76F2E',
  className = '',
}: ChartProps & { dataKey: string; xAxisKey: string; color?: string }) => {
  return (
    <Glass rounded="3xl" className={`p-6 ${className}`}>
      {title && (
        <div className="mb-5">
          <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">Динамика</p>
          <h3 className="display mt-1 text-2xl text-cream-50">{title}</h3>
        </div>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,239,226,0.06)" />
            <XAxis dataKey={xAxisKey} tick={axisStyle} stroke="rgba(245,239,226,0.16)" />
            <YAxis tick={axisStyle} stroke="rgba(245,239,226,0.16)" />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={tooltipItemStyle}
              wrapperStyle={tooltipWrapperStyle}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6, fill: color, stroke: '#FBF7EE', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Glass>
  );
};

export const BarChartComponent = ({
  title,
  data,
  dataKey,
  xAxisKey,
  className = '',
}: ChartProps & { dataKey: string; xAxisKey: string }) => {
  return (
    <Glass rounded="3xl" className={`p-6 ${className}`}>
      {title && (
        <div className="mb-5">
          <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">Сравнение</p>
          <h3 className="display mt-1 text-2xl text-cream-50">{title}</h3>
        </div>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,239,226,0.06)" />
            <XAxis dataKey={xAxisKey} tick={axisStyle} stroke="rgba(245,239,226,0.16)" />
            <YAxis tick={axisStyle} stroke="rgba(245,239,226,0.16)" />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={tooltipItemStyle}
              wrapperStyle={tooltipWrapperStyle}
              cursor={{ fill: 'rgba(231, 111, 46, 0.08)' }}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F08338" stopOpacity={1} />
                <stop offset="100%" stopColor="#C8581C" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <Bar dataKey={dataKey} fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Glass>
  );
};

export const PieChartComponent = ({
  title,
  data,
  nameKey,
  valueKey,
  className = '',
}: ChartProps & { nameKey: string; valueKey: string }) => {
  return (
    <Glass rounded="3xl" className={`p-6 ${className}`}>
      {title && (
        <div className="mb-5">
          <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">Распределение</p>
          <h3 className="display mt-1 text-2xl text-cream-50">{title}</h3>
        </div>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry[valueKey]}%`}
              outerRadius={85}
              innerRadius={45}
              fill="#E76F2E"
              dataKey={valueKey}
              stroke="rgba(8,9,12,0.9)"
              strokeWidth={2}
            >
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={tooltipItemStyle}
              wrapperStyle={tooltipWrapperStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Custom legend */}
      <div className="mt-4 grid gap-1.5 text-xs">
        {data.slice(0, 8).map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between font-sans-display text-cream-400">
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: COLORS[idx % COLORS.length] }}
              />
              {entry[nameKey]}
            </span>
            <span className="font-mono tab-num text-cream-200">{entry[valueKey]}%</span>
          </div>
        ))}
      </div>
    </Glass>
  );
};

export const RadarChartComponent = ({
  title,
  data,
  dataKeys,
  className = '',
}: ChartProps & { dataKeys: string[] }) => {
  return (
    <Glass rounded="3xl" className={`p-6 ${className}`}>
      {title && (
        <div className="mb-5">
          <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">Профиль</p>
          <h3 className="display mt-1 text-2xl text-cream-50">{title}</h3>
        </div>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="rgba(245,239,226,0.08)" />
            <PolarAngleAxis dataKey="metric" tick={axisStyle} stroke="rgba(245,239,226,0.16)" />
            <PolarRadiusAxis stroke="rgba(245,239,226,0.08)" tick={axisStyle} />
            {dataKeys.map((key, index) => (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.25}
                strokeWidth={2}
              />
            ))}
            <Legend wrapperStyle={{ fontFamily: 'Geist', color: '#F5EFE2', fontSize: 11 }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={tooltipItemStyle}
              wrapperStyle={tooltipWrapperStyle}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Glass>
  );
};

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  label?: string;
}

export const ProgressBar = ({ value, max = 100, color = '#E76F2E', label }: ProgressBarProps) => {
  const percentage = Math.min(100, (value / max) * 100);

  return (
    <div className="space-y-2 w-full">
      {label && (
        <div className="flex items-center justify-between">
          <p className="font-sans-display text-xs text-cream-300">{label}</p>
          <p className="font-mono text-xs tab-num text-cream-50">{value.toFixed(0)}%</p>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-100/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.2))` }}
        />
      </div>
    </div>
  );
};
