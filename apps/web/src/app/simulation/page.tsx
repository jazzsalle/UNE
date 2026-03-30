// ref: CLAUDE.md §9.5 — 시뮬레이션 (M-SIM)
'use client';
import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';

export default function SimulationPage() {
  const { eventContext } = useAppStore();
  const [kgsResults, setKgsResults] = useState<any[]>([]);
  const [ketiResult, setKetiResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'event' | 'manual'>('event');

  const scenarioId = eventContext?.scenario_id || 'SC-01';

  const handleRun = async () => {
    setLoading(true);
    try {
      const [kgs, keti] = await Promise.all([
        api.getKgs(scenarioId),
        api.getKeti(scenarioId),
      ]);
      setKgsResults(kgs);
      setKetiResult(keti);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 탭 + 입력 */}
      <div className="bg-bg-secondary border-b border-gray-700 px-4 py-2">
        <div className="flex gap-2 mb-2">
          <button onClick={() => setTab('event')} className={`text-xs px-3 py-1 rounded ${tab === 'event' ? 'bg-accent-blue text-white' : 'text-gray-400'}`}>이벤트 연계</button>
          <button onClick={() => setTab('manual')} className={`text-xs px-3 py-1 rounded ${tab === 'manual' ? 'bg-accent-blue text-white' : 'text-gray-400'}`}>수동 실행</button>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-400">시나리오: <b className="text-white">{scenarioId}</b></span>
          <span className="text-green-400">🟢 KETI 연결정상</span>
          <button onClick={handleRun} disabled={loading} className="bg-accent-green text-black px-4 py-1 rounded font-medium">
            {loading ? '실행중...' : '▶ 시뮬레이션 실행'}
          </button>
        </div>
      </div>

      {/* 2분할 */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex items-center justify-center bg-bg-primary">
          <div className="text-gray-500 text-sm text-center">
            <div className="text-4xl mb-2">🎬</div>
            <div>3D 시뮬레이션 뷰어</div>
            <div className="text-xs text-gray-600 mt-1">타임라인 스크러버 포함</div>
          </div>
        </div>

        <div className="w-[45%] border-l border-gray-700 p-3 overflow-y-auto">
          {kgsResults.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs text-gray-400 mb-2">KGS 위험영향 결과</h4>
              {kgsResults.map((r) => (
                <div key={r.analysis_id} className="text-[11px] mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color_2d || '#666' }} />
                  <span className="text-white">{r.affected_equipment_id}</span>
                  <span className="text-gray-400">{r.impact_score}점</span>
                  <span className="text-gray-500">{r.risk_level}</span>
                </div>
              ))}
            </div>
          )}

          {ketiResult && (
            <div className="mb-4">
              <h4 className="text-xs text-gray-400 mb-2">KETI 대응안 비교</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg-tertiary p-3 rounded">
                  <div className="text-[10px] text-gray-500 mb-1">Option A</div>
                  <div className="text-[11px] text-white">{ketiResult.recommended_option_a}</div>
                </div>
                <div className="bg-bg-tertiary p-3 rounded">
                  <div className="text-[10px] text-gray-500 mb-1">Option B</div>
                  <div className="text-[11px] text-white">{ketiResult.recommended_option_b}</div>
                </div>
              </div>
              {ketiResult.simulation_summary && (
                <div className="mt-3 p-2 bg-bg-tertiary rounded text-[11px] text-gray-300">{ketiResult.simulation_summary}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
