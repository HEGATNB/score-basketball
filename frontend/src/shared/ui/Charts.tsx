import { motion } from 'framer-motion';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

// Red & black brand palette (with semantic accents)
const COLORS = ['#d26a34', '#e48a54', '#9c4719', '#e3b341', '#d99a4f', '#36d399'];
const ACCENT = '#d26a34';
const ACCENT_STRONG = '#e48a54';

const tooltipStyle = {
  backgroundColor: 'rgba(8, 8, 11, 0.94)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 12,
  boxShadow: '0 24px 60px -12px rgba(0,0,0,0.7)',
  padding: '12px 14px',
  fontFamily: 'Space Grotesk, system-ui, sans-serif',
  fontSize: 12,
  color: '#f5f1ea',
};

const labelStyle = { color: '#f5f1ea', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' };
const tooltipItemStyle = { color: '#c2bfb8', fontWeight: 500 };
const tooltipWrapperStyle = { outline: 'none' };
const axisStyle = { fill: '#8a8a92', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' };

interface ChartProps {
  title?: string;
  eyebrow?: string;
  data: any[];
  className?: string;
}

function ChartHeader({ eyebrow, title }: { eyebrow?: string; title?: string }) {
  if (!title && !eyebrow) return null;
  return (
    <div className="mb-5">
      {eyebrow && (
        <p
          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.28em' }}
        >
          {eyebrow}
        </p>
      )}
      {title && (
        <h3 className="display-h mt-1.5" style={{ fontSize: 22, lineHeight: 1 }}>
          {title}
        </h3>
      )}
    </div>
  );
}

export const LineChartComponent = ({
  title,
  eyebrow = 'Динамика',
  data,
  dataKey,
  xAxisKey,
  color = ACCENT,
  className = '',
}: ChartProps & { dataKey: string; xAxisKey: string; color?: string }) => {
  return (
    <div className={`panel ${className}`}>
      <ChartHeader eyebrow={eyebrow} title={title} />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey={xAxisKey} tick={axisStyle} stroke="rgba(255,255,255,0.16)" />
            <YAxis tick={axisStyle} stroke="rgba(255,255,255,0.16)" />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={tooltipItemStyle}
              wrapperStyle={tooltipWrapperStyle}
              cursor={{ stroke: 'rgba(210,106,52,0.25)', strokeWidth: 1 }}
            />
            <defs>
              <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ fill: color, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: color, stroke: '#fff5f5', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const BarChartComponent = ({
  title,
  eyebrow = 'Сравнение',
  data,
  dataKey,
  xAxisKey,
  className = '',
}: ChartProps & { dataKey: string; xAxisKey: string }) => {
  return (
    <div className={`panel ${className}`}>
      <ChartHeader eyebrow={eyebrow} title={title} />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey={xAxisKey} tick={axisStyle} stroke="rgba(255,255,255,0.16)" />
            <YAxis tick={axisStyle} stroke="rgba(255,255,255,0.16)" />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={tooltipItemStyle}
              wrapperStyle={tooltipWrapperStyle}
              cursor={{ fill: 'rgba(210, 106, 52, 0.08)' }}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT_STRONG} stopOpacity={1} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.78} />
              </linearGradient>
            </defs>
            <Bar dataKey={dataKey} fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const PieChartComponent = ({
  title,
  eyebrow = 'Распределение',
  data,
  nameKey,
  valueKey,
  className = '',
}: ChartProps & { nameKey: string; valueKey: string }) => {
  return (
    <div className={`panel ${className}`}>
      <ChartHeader eyebrow={eyebrow} title={title} />
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
              innerRadius={48}
              fill={ACCENT}
              dataKey={valueKey}
              stroke="rgba(8,8,11,0.95)"
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
      <div className="mt-4 grid gap-1.5 text-xs">
        {data.slice(0, 8).map((entry, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between"
            style={{ color: 'var(--text-3)' }}
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: COLORS[idx % COLORS.length] }}
              />
              {entry[nameKey]}
            </span>
            <span className="font-mono tab-num" style={{ color: 'var(--text-2)' }}>
              {entry[valueKey]}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const RadarChartComponent = ({
  title,
  eyebrow = 'Профиль',
  data,
  dataKeys,
  className = '',
}: ChartProps & { dataKeys: string[] }) => {
  return (
    <div className={`panel ${className}`}>
      <ChartHeader eyebrow={eyebrow} title={title} />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="metric" tick={axisStyle} stroke="rgba(255,255,255,0.16)" />
            <PolarRadiusAxis stroke="rgba(255,255,255,0.08)" tick={axisStyle} />
            {dataKeys.map((key, index) => (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.22}
                strokeWidth={2}
              />
            ))}
            <Legend
              wrapperStyle={{ fontFamily: 'Space Grotesk', color: '#f5f1ea', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={tooltipItemStyle}
              wrapperStyle={tooltipWrapperStyle}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  label?: string;
}

export const ProgressBar = ({ value, max = 100, color = ACCENT, label }: ProgressBarProps) => {
  const percentage = Math.min(100, (value / max) * 100);

  return (
    <div className="w-full space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <p
            className="font-mono text-[11px] uppercase"
            style={{ color: 'var(--text-3)', letterSpacing: '0.16em' }}
          >
            {label}
          </p>
          <p
            className="font-mono text-xs tab-num"
            style={{ color: 'var(--text)' }}
          >
            {value.toFixed(0)}%
          </p>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-3)' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.22))`,
            boxShadow: `0 0 12px ${color}55`,
          }}
        />
      </div>
    </div>
  );
};
