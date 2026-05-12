import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GlowingCard } from './GlowingCard';

const COLORS = ['#e41c38', '#1d428a', '#728b74', '#ff4d29', '#8d6b5d', '#56786f'];

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
  color = '#e41c38',
  className = '',
}: ChartProps & {
  dataKey: string;
  xAxisKey: string;
  color?: string;
}) => {
  return (
    <GlowingCard className={`p-6 ${className}`}>
      {title && <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#161d26',
                border: '1px solid rgba(244,233,215,0.1)',
                borderRadius: 16,
              }}
              labelStyle={{ color: '#f5efe4' }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={3}
              dot={{ fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlowingCard>
  );
};

export const BarChartComponent = ({
  title,
  data,
  dataKey,
  xAxisKey,
  className = '',
}: ChartProps & {
  dataKey: string;
  xAxisKey: string;
}) => {
  return (
    <GlowingCard className={`p-6 ${className}`}>
      {title && <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#161d26',
                border: '1px solid rgba(244,233,215,0.1)',
                borderRadius: 16,
              }}
              labelStyle={{ color: '#f5efe4' }}
            />
            <Bar dataKey={dataKey} fill="#e41c38" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlowingCard>
  );
};

export const PieChartComponent = ({
  title,
  data,
  nameKey,
  valueKey,
  className = '',
}: ChartProps & {
  nameKey: string;
  valueKey: string;
}) => {
  return (
    <GlowingCard className={`p-6 ${className}`}>
      {title && <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>}
      <div className="space-y-6">
        <div className="mx-auto h-64 w-full max-w-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                label={false}
                labelLine={false}
                outerRadius={84}
                dataKey={valueKey}
                paddingAngle={2}
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161d26',
                  border: '1px solid rgba(244,233,215,0.1)',
                  borderRadius: 16,
                }}
                itemStyle={{ color: '#f5efe4' }}
                formatter={(value: number | string, _name: string, entry: any) => [
                  `${value}%`,
                  entry?.payload?.[nameKey] || '',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((entry, index) => (
            <div
              key={`${entry[nameKey]}-${index}`}
              className="surface-muted grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3"
            >
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="min-w-0 text-sm font-medium leading-5 text-slate-200">
                {entry[nameKey]}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                {entry[valueKey]}%
              </span>
              <span />
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                model weight
              </span>
              <span />
            </div>
          ))}
        </div>
      </div>
    </GlowingCard>
  );
};

export const RadarChartComponent = ({
  title,
  data,
  dataKeys,
  className = '',
}: ChartProps & {
  dataKeys: string[];
}) => {
  return (
    <GlowingCard className={`p-6 ${className}`}>
      {title && <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>}
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
              contentStyle={{
                backgroundColor: '#161d26',
                border: '1px solid rgba(244,233,215,0.1)',
                borderRadius: 16,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </GlowingCard>
  );
};

export const ProgressBar = ({
  value,
  max = 100,
  color = '#e41c38',
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
}) => {
  const percentage = (value / max) * 100;

  return (
    <div className="w-full space-y-1">
      {label && <p className="text-sm text-slate-400">{label}</p>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
};