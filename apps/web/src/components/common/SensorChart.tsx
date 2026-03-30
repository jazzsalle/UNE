// ref: CLAUDE.md §15.3 — 재사용 센서 시계열 차트
'use client';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, ComposedChart } from 'recharts';

interface SensorChartProps {
  data: { elapsed_sec: number; value: number; label?: string }[];
  sensorType: string;
  unit: string;
  threshold?: { warning_low: number; warning_high: number; critical_low: number; critical_high: number; normal_value: number };
  height?: number;
  compact?: boolean;
}

export function SensorChart({ data, sensorType, unit, threshold, height = 120, compact = false }: SensorChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      time: Math.floor(d.elapsed_sec / 60) + ':' + String(d.elapsed_sec % 60).padStart(2, '0'),
      value: d.value,
      isAnomaly: d.label === 'ANOMALY' || d.label === 'WARNING',
      elapsed: d.elapsed_sec,
    }));
  }, [data]);

  const lineColor = data.some(d => d.label === 'ANOMALY') ? '#ef4444' :
                    data.some(d => d.label === 'WARNING') ? '#f97316' : '#06b6d4';

  return (
    <div className="bg-bg-tertiary rounded p-2">
      {!compact && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-gray-400">{sensorType}</span>
          <span className="text-[10px] text-gray-500">{unit}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: compact ? -20 : 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} width={compact ? 30 : 40} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', fontSize: 11 }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#e5e7eb' }}
          />

          {/* Threshold reference lines */}
          {threshold && (
            <>
              <ReferenceLine y={threshold.warning_high} stroke="#f97316" strokeDasharray="5 5" label="" />
              <ReferenceLine y={threshold.warning_low} stroke="#f97316" strokeDasharray="5 5" />
              <ReferenceLine y={threshold.critical_high} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine y={threshold.critical_low} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine y={threshold.normal_value} stroke="#22c55e" strokeDasharray="2 2" strokeOpacity={0.5} />
            </>
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, stroke: lineColor }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
