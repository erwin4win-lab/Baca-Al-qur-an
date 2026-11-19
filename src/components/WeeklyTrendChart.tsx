import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { DayRecord } from '../types/quran';
import { clampNumber, safePercentage } from '../utils/sanitize';

interface WeeklyTrendChartProps {
  records: Record<string, DayRecord>;
  selectedDate: string;
  defaultTargetPages: number;
  onSelectDate?: (date: string) => void;
}

interface DayTrendPoint {
  date: string;
  shortLabel: string;
  fullDateLabel: string;
  completedPages: number;
  targetPages: number;
  baseTarget: number;
  debtCarriedOver: number;
  percentage: number;
  isTargetMet: boolean;
  isSelected: boolean;
}

const WEEKDAY_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  return new Date();
}

function formatLocalDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DayTrendPoint }>;
}

const TrendTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-stone-900 text-white rounded-xl px-3.5 py-2.5 shadow-lg border border-stone-700/80 text-xs min-w-[180px]">
      <div className="font-semibold text-stone-100 mb-1.5">{item.fullDateLabel}</div>
      <div className="space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-stone-400">Halaman dibaca</span>
          <span className="font-bold text-emerald-400">{item.completedPages} hal</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-stone-400">Target harian</span>
          <span className="font-semibold text-amber-300">
            {item.targetPages} hal
            {item.debtCarriedOver > 0 ? ` (+${item.debtCarriedOver} utang)` : ''}
          </span>
        </div>
        <div className="pt-1 mt-1 border-t border-stone-700/70 flex items-center justify-between gap-4">
          <span className="text-stone-400">Capaian</span>
          <span className={`font-bold ${item.isTargetMet ? 'text-emerald-400' : 'text-amber-300'}`}>
            {item.percentage}% {item.isTargetMet ? '· Tuntas' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export const WeeklyTrendChart: React.FC<WeeklyTrendChartProps> = ({
  records,
  selectedDate,
  defaultTargetPages,
  onSelectDate
}) => {
  const [chartMode, setChartMode] = useState<'bar' | 'area'>('bar');

  const safeDefaultTarget = clampNumber(defaultTargetPages, 1, 300, 20);

  const { dataPoints, total7DaysPages, avgPages, daysMetTarget } = useMemo(() => {
    const anchorDate = parseLocalDate(selectedDate);
    const points: DayTrendPoint[] = [];

    for (let offset = -6; offset <= 0; offset++) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() + offset);
      const iso = formatLocalDateISO(d);
      const record = records?.[iso];

      const baseTarget = clampNumber(record?.targetPages, 1, 500, safeDefaultTarget);
      const debt = clampNumber(record?.debtCarriedOver, 0, 500, 0);
      const totalTarget = baseTarget + debt;
      const completed = clampNumber(record?.completedPages, 0, 500, 0);
      const pct = safePercentage(completed, totalTarget);

      const weekday = WEEKDAY_SHORT_ID[d.getDay()] || '';
      const dayNum = d.getDate();

      let fullLabel = iso;
      try {
        fullLabel = d.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        fullLabel = iso;
      }

      points.push({
        date: iso,
        shortLabel: `${weekday} ${dayNum}`,
        fullDateLabel: fullLabel,
        completedPages: completed,
        targetPages: totalTarget,
        baseTarget,
        debtCarriedOver: debt,
        percentage: pct,
        isTargetMet: completed >= totalTarget && totalTarget > 0,
        isSelected: iso === selectedDate
      });
    }

    const total = points.reduce((sum, p) => sum + p.completedPages, 0);
    const avg = Math.round((total / 7) * 10) / 10;
    const metCount = points.filter((p) => p.isTargetMet).length;

    return {
      dataPoints: points,
      total7DaysPages: total,
      avgPages: avg,
      daysMetTarget: metCount
    };
  }, [records, selectedDate, safeDefaultTarget]);

  const maxY = useMemo(() => {
    const peak = dataPoints.reduce(
      (max, p) => Math.max(max, p.completedPages, p.targetPages),
      safeDefaultTarget
    );
    return Math.ceil((peak + 4) / 5) * 5;
  }, [dataPoints, safeDefaultTarget]);

  const handleChartClick = (state: { activeTooltipIndex?: number | string | null } | null) => {
    const rawIdx = state?.activeTooltipIndex;
    const idx = typeof rawIdx === 'number' ? rawIdx : typeof rawIdx === 'string' ? parseInt(rawIdx, 10) : -1;
    if (idx >= 0 && idx < dataPoints.length && onSelectDate) {
      const clickedDate = dataPoints[idx]?.date;
      if (clickedDate) {
        onSelectDate(clickedDate);
      }
    }
  };

  return (
    <section
      aria-label="Tren Penyelesaian Tilawah 7 Hari Terakhir"
      className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200/80 space-y-4"
    >
      {/* Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-stone-900">
            Tren Tilawah 7 Hari Terakhir
          </h2>
          <p className="text-xs text-stone-500 mt-0.5 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              Total <strong className="text-stone-800">{total7DaysPages}</strong> halaman
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Rata-rata <strong className="text-stone-800">{avgPages}</strong> hal/hari
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-emerald-700">{daysMetTarget}/7</strong> hari capai target
            </span>
          </p>
        </div>

        {/* Interactive Chart Mode Switcher */}
        <div
          className="inline-flex items-center gap-1 p-1 bg-stone-100 rounded-xl self-start sm:self-auto"
          role="group"
          aria-label="Mode tampilan grafik"
        >
          <button
            type="button"
            onClick={() => setChartMode('bar')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              chartMode === 'bar'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Batang</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode('area')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              chartMode === 'area'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Kurva</span>
          </button>
        </div>
      </div>

      {/* Recharts Visualization */}
      <div className="w-full h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={dataPoints}
            margin={{ top: 10, right: 8, left: -12, bottom: 2 }}
            onClick={handleChartClick}
          >
            <defs>
              <linearGradient id="tilawahAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />

            <XAxis
              dataKey="shortLabel"
              tick={{ fill: '#57534e', fontSize: 11, fontWeight: 500 }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
              interval={0}
            />

            <YAxis
              domain={[0, maxY]}
              tick={{ fill: '#78716c', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />

            <Tooltip
              content={<TrendTooltip />}
              cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }}
            />

            {chartMode === 'bar' ? (
              <Bar
                dataKey="completedPages"
                name="Halaman Dibaca"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                className={onSelectDate ? 'cursor-pointer' : ''}
              >
                {dataPoints.map((entry) => {
                  const fillColor = entry.isTargetMet
                    ? '#10b981'
                    : entry.completedPages > 0
                    ? '#f59e0b'
                    : '#e7e5e4';
                  return (
                    <Cell
                      key={entry.date}
                      fill={fillColor}
                      stroke={entry.isSelected ? '#064e3b' : 'transparent'}
                      strokeWidth={entry.isSelected ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            ) : (
              <Area
                type="monotone"
                dataKey="completedPages"
                name="Halaman Dibaca"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#tilawahAreaGradient)"
                dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            <Line
              type="stepAfter"
              dataKey="targetPages"
              name="Target Harian"
              stroke="#d97706"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, fill: '#d97706' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Interaction Hint */}
      <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span>Target tercapai</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
            <span>Proses berjalan</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-amber-600 inline-block" />
            <span>Garis target harian</span>
          </span>
        </div>
        {onSelectDate && (
          <span className="text-stone-400">Klik hari pada grafik untuk melihat detail</span>
        )}
      </div>
    </section>
  );
};
