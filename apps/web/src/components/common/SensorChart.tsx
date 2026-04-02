// ref: CLAUDE.md §15.3 — 재사용 센서 시계열 차트 (개선판)
'use client';
import { useMemo, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, ComposedChart, Area, ReferenceArea, ReferenceDot,
} from 'recharts';

interface SensorChartProps {
  data: { elapsed_sec: number; value: number; label?: string }[];
  sensorType: string;
  unit: string;
  threshold?: { warning_low: number; warning_high: number; critical_low: number; critical_high: number; normal_value: number };
  height?: number;
  compact?: boolean;
}

interface AnomalyChartProps {
  data: { time: number; actual: number; predicted: number; error: number; label?: string }[];
  height?: number;
}

// 이상 구간 추출 (연속 ANOMALY/WARNING 구간)
function extractAnomalyZones(data: { elapsed_sec: number; label?: string }[]): { start: number; end: number; type: string }[] {
  const zones: { start: number; end: number; type: string }[] = [];
  let currentZone: { start: number; end: number; type: string } | null = null;

  for (const d of data) {
    const isAnomaly = d.label === 'ANOMALY';
    const isWarning = d.label === 'WARNING';
    if (isAnomaly || isWarning) {
      const type = isAnomaly ? 'ANOMALY' : 'WARNING';
      if (!currentZone || currentZone.type !== type) {
        if (currentZone) zones.push(currentZone);
        currentZone = { start: d.elapsed_sec, end: d.elapsed_sec, type };
      } else {
        currentZone.end = d.elapsed_sec;
      }
    } else {
      if (currentZone) { zones.push(currentZone); currentZone = null; }
    }
  }
  if (currentZone) zones.push(currentZone);
  return zones;
}

// 커스텀 툴팁
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const isAnomaly = d?.label === 'ANOMALY';
  const isWarning = d?.label === 'WARNING';

  return (
    <div className={`px-3 py-2 rounded-lg border text-[11px] shadow-xl ${
      isAnomaly ? 'bg-red-950/95 border-red-500/40' :
      isWarning ? 'bg-amber-950/95 border-amber-500/40' :
      'bg-gray-900/95 border-gray-700'
    }`}>
      <div className="text-gray-400 text-[10px] mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-mono font-medium text-white">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
      {isAnomaly && <div className="mt-1 text-[9px] text-red-400 font-medium">이상 감지</div>}
      {isWarning && <div className="mt-1 text-[9px] text-amber-400 font-medium">경고</div>}
    </div>
  );
}

// 이상 마커 클릭 핸들러용 도트
function AnomalyDot(props: any) {
  const { cx, cy, payload, onClick } = props;
  if (!payload || (payload.label !== 'ANOMALY' && payload.label !== 'WARNING')) return null;
  const isAnomaly = payload.label === 'ANOMALY';

  return (
    <g onClick={() => onClick?.(payload)} style={{ cursor: 'pointer' }}>
      {/* 외곽 글로우 */}
      <circle cx={cx} cy={cy} r={6} fill={isAnomaly ? '#ef4444' : '#f97316'} opacity={0.2} />
      {/* 내부 점 */}
      <circle cx={cx} cy={cy} r={3} fill={isAnomaly ? '#ef4444' : '#f97316'} stroke="#fff" strokeWidth={1} />
      {/* 삼각형 마커 (위) */}
      <polygon
        points={`${cx},${cy - 10} ${cx - 4},${cy - 5} ${cx + 4},${cy - 5}`}
        fill={isAnomaly ? '#ef4444' : '#f97316'}
      />
    </g>
  );
}

export function SensorChart({ data, sensorType, unit, threshold, height = 120, compact = false }: SensorChartProps) {
  const [selectedMarker, setSelectedMarker] = useState<any>(null);

  const chartData = useMemo(() => {
    return data.map((d) => ({
      time: Math.floor(d.elapsed_sec / 60) + ':' + String(d.elapsed_sec % 60).padStart(2, '0'),
      value: d.value,
      label: d.label,
      elapsed: d.elapsed_sec,
    }));
  }, [data]);

  const anomalyZones = useMemo(() => extractAnomalyZones(data), [data]);

  // 동적 Y 도메인 계산
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto'] as [string, string];
    const values = chartData.map(d => d.value).filter(v => !isNaN(v));
    if (values.length === 0) return ['auto', 'auto'] as [string, string];
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (threshold) {
      min = Math.min(min, threshold.critical_low);
      max = Math.max(max, threshold.critical_high);
    }
    const padding = (max - min) * 0.15 || 1;
    return [Math.floor((min - padding) * 10) / 10, Math.ceil((max + padding) * 10) / 10] as [number, number];
  }, [chartData, threshold]);

  const lineColor = data.some(d => d.label === 'ANOMALY') ? '#ef4444' :
                    data.some(d => d.label === 'WARNING') ? '#f97316' : '#06b6d4';

  const handleMarkerClick = useCallback((payload: any) => {
    setSelectedMarker((prev: any) => prev?.elapsed === payload.elapsed ? null : payload);
  }, []);

  return (
    <div className="bg-white/[0.02] rounded-lg p-2 relative">
      {!compact && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] text-gray-300 font-medium">{sensorType}</span>
          <span className="text-[10px] text-gray-500">{unit}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: compact ? 2 : 18, left: compact ? -15 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: compact ? 8 : 10, fill: '#9ca3af' }}
            tickLine={{ stroke: '#4b5563' }}
            axisLine={{ stroke: '#4b5563' }}
            interval="preserveStartEnd"
            label={!compact ? { value: '시간', position: 'insideBottom', offset: -12, fontSize: 9, fill: '#6b7280' } : undefined}
          />
          <YAxis
            tick={{ fontSize: compact ? 8 : 10, fill: '#9ca3af' }}
            tickLine={{ stroke: '#4b5563' }}
            axisLine={{ stroke: '#4b5563' }}
            width={compact ? 35 : 48}
            domain={yDomain}
            label={!compact ? { value: unit, angle: -90, position: 'insideLeft', offset: 10, fontSize: 9, fill: '#6b7280' } : undefined}
          />
          <Tooltip content={<ChartTooltip />} />

          {/* 이상 구간 배경 색상 */}
          {anomalyZones.map((zone, i) => {
            const startTime = Math.floor(zone.start / 60) + ':' + String(zone.start % 60).padStart(2, '0');
            const endTime = Math.floor(zone.end / 60) + ':' + String(zone.end % 60).padStart(2, '0');
            return (
              <ReferenceArea
                key={`zone-${i}`}
                x1={startTime}
                x2={endTime}
                fill={zone.type === 'ANOMALY' ? '#ef4444' : '#f97316'}
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            );
          })}

          {/* 임계치 라인 */}
          {threshold && (
            <>
              <ReferenceLine y={threshold.critical_high} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5}
                label={!compact ? { value: '위험 상한', position: 'right', fontSize: 8, fill: '#ef4444' } : undefined} />
              <ReferenceLine y={threshold.critical_low} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5}
                label={!compact ? { value: '위험 하한', position: 'right', fontSize: 8, fill: '#ef4444' } : undefined} />
              <ReferenceLine y={threshold.warning_high} stroke="#f97316" strokeDasharray="5 5" strokeWidth={1}
                label={!compact ? { value: '경고 상한', position: 'right', fontSize: 8, fill: '#f97316' } : undefined} />
              <ReferenceLine y={threshold.warning_low} stroke="#f97316" strokeDasharray="5 5" strokeWidth={1}
                label={!compact ? { value: '경고 하한', position: 'right', fontSize: 8, fill: '#f97316' } : undefined} />
              <ReferenceLine y={threshold.normal_value} stroke="#22c55e" strokeDasharray="2 2" strokeOpacity={0.4} strokeWidth={1} />
            </>
          )}

          <Line
            type="monotone"
            dataKey="value"
            name="측정값"
            stroke={lineColor}
            strokeWidth={compact ? 1.5 : 2}
            dot={<AnomalyDot onClick={handleMarkerClick} />}
            activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: '#0c1220' }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 마커 클릭 시 상세 정보 팝업 */}
      {selectedMarker && (
        <div className="absolute top-2 right-2 z-20 glass px-3 py-2 text-[10px] max-w-[200px] animate-slideInRight">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-bold ${selectedMarker.label === 'ANOMALY' ? 'text-red-400' : 'text-amber-400'}`}>
              {selectedMarker.label === 'ANOMALY' ? '이상 감지' : '경고'}
            </span>
            <button onClick={() => setSelectedMarker(null)} className="text-gray-500 hover:text-white">✕</button>
          </div>
          <div className="space-y-0.5 text-gray-300">
            <div>시간: <span className="font-mono text-white">{Math.floor(selectedMarker.elapsed / 60)}:{String(selectedMarker.elapsed % 60).padStart(2, '0')}</span></div>
            <div>측정값: <span className="font-mono text-white">{selectedMarker.value?.toFixed(2)}</span></div>
            <div>상태: <span className={selectedMarker.label === 'ANOMALY' ? 'text-red-400' : 'text-amber-400'}>{selectedMarker.label === 'ANOMALY' ? '임계치 초과' : '경고 범위'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 이상탐지 전용 차트: 실측값, 학습값, 오차를 동시에 표시
 */
export function AnomalyDetectionChart({ data, height = 180 }: AnomalyChartProps) {
  const [selectedMarker, setSelectedMarker] = useState<any>(null);

  const chartData = useMemo(() => {
    return data.map((d) => ({
      time: Math.floor(d.time / 60) + ':' + String(d.time % 60).padStart(2, '0'),
      actual: d.actual,
      predicted: d.predicted,
      error: d.error,
      label: d.label,
      elapsed: d.time,
    }));
  }, [data]);

  const anomalyZones = useMemo(() => {
    const zones: { start: string; end: string; type: string }[] = [];
    let current: { start: string; end: string; type: string } | null = null;

    for (const d of chartData) {
      const isAnomaly = d.label === 'ANOMALY';
      const isWarning = d.label === 'WARNING';
      if (isAnomaly || isWarning) {
        const type = isAnomaly ? 'ANOMALY' : 'WARNING';
        if (!current || current.type !== type) {
          if (current) zones.push(current);
          current = { start: d.time, end: d.time, type };
        } else {
          current.end = d.time;
        }
      } else {
        if (current) { zones.push(current); current = null; }
      }
    }
    if (current) zones.push(current);
    return zones;
  }, [chartData]);

  const handleMarkerClick = useCallback((payload: any) => {
    setSelectedMarker((prev: any) => prev?.elapsed === payload.elapsed ? null : payload);
  }, []);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-[11px]">
        에뮬레이터 실행 시 데이터가 표시됩니다
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] rounded-lg p-3 relative h-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] text-gray-300 font-medium">이상탐지 그래프</span>
        <div className="flex gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-cyan-400 inline-block rounded" />
            <span className="text-gray-400">실측값</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-purple-400 inline-block rounded" style={{ borderBottom: '1px dashed #a78bfa' }} />
            <span className="text-gray-400">학습값</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-2 bg-red-400/20 inline-block rounded border border-red-400/30" />
            <span className="text-gray-400">오차</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 15, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={{ stroke: '#4b5563' }}
            axisLine={{ stroke: '#4b5563' }}
            interval="preserveStartEnd"
            label={{ value: '시간', position: 'insideBottom', offset: -12, fontSize: 9, fill: '#6b7280' }}
          />
          <YAxis
            yAxisId="value"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={{ stroke: '#4b5563' }}
            axisLine={{ stroke: '#4b5563' }}
            width={50}
            label={{ value: '측정값', angle: -90, position: 'insideLeft', offset: 5, fontSize: 9, fill: '#6b7280' }}
          />
          <YAxis
            yAxisId="error"
            orientation="right"
            tick={{ fontSize: 9, fill: '#6b7280' }}
            tickLine={{ stroke: '#374151' }}
            axisLine={{ stroke: '#374151' }}
            width={40}
            label={{ value: '오차', angle: 90, position: 'insideRight', offset: 5, fontSize: 9, fill: '#6b7280' }}
          />
          <Tooltip content={<ChartTooltip />} />

          {/* 이상 구간 배경 */}
          {anomalyZones.map((zone, i) => (
            <ReferenceArea
              key={`az-${i}`}
              x1={zone.start}
              x2={zone.end}
              yAxisId="value"
              fill={zone.type === 'ANOMALY' ? '#ef4444' : '#f97316'}
              fillOpacity={0.08}
            />
          ))}

          {/* 오차 영역 (Area) */}
          <Area
            yAxisId="error"
            type="monotone"
            dataKey="error"
            name="오차"
            fill="#ef4444"
            fillOpacity={0.15}
            stroke="#ef4444"
            strokeWidth={1}
            strokeOpacity={0.4}
          />

          {/* 학습값 (점선) */}
          <Line
            yAxisId="value"
            type="monotone"
            dataKey="predicted"
            name="학습값"
            stroke="#a78bfa"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 3, stroke: '#a78bfa' }}
          />

          {/* 실측값 (실선 + 이상 마커) */}
          <Line
            yAxisId="value"
            type="monotone"
            dataKey="actual"
            name="실측값"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={<AnomalyDot onClick={handleMarkerClick} />}
            activeDot={{ r: 4, stroke: '#06b6d4', strokeWidth: 2, fill: '#0c1220' }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 마커 클릭 시 상세 정보 */}
      {selectedMarker && (
        <div className="absolute top-2 right-2 z-20 glass px-3 py-2 text-[10px] max-w-[220px] animate-slideInRight">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-bold ${selectedMarker.label === 'ANOMALY' ? 'text-red-400' : 'text-amber-400'}`}>
              {selectedMarker.label === 'ANOMALY' ? '이상 감지 상세' : '경고 상세'}
            </span>
            <button onClick={() => setSelectedMarker(null)} className="text-gray-500 hover:text-white">✕</button>
          </div>
          <div className="space-y-0.5 text-gray-300">
            <div>시간: <span className="font-mono text-white">{Math.floor(selectedMarker.elapsed / 60)}:{String(selectedMarker.elapsed % 60).padStart(2, '0')}</span></div>
            <div>실측값: <span className="font-mono text-cyan-400">{selectedMarker.actual?.toFixed(3)}</span></div>
            <div>학습값: <span className="font-mono text-purple-400">{selectedMarker.predicted?.toFixed(3)}</span></div>
            <div>오차: <span className="font-mono text-red-400">{selectedMarker.error?.toFixed(4)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
