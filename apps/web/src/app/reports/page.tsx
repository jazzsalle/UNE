// ref: CLAUDE.md §9.9 — 보고서 (P-RPT) 완성
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [managerComment, setManagerComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getReports().then(setReports).catch(console.error);
  }, []);

  useEffect(() => {
    if (selected) setManagerComment(selected.manager_comment || '');
  }, [selected]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.updateReport(selected.report_id, { manager_comment: managerComment });
      setReports(prev => prev.map(r => r.report_id === selected.report_id ? { ...r, manager_comment: managerComment } : r));
      setSelected((prev: any) => prev ? { ...prev, manager_comment: managerComment } : prev);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    try {
      await api.submitReport(selected.report_id);
      setReports(prev => prev.map(r => r.report_id === selected.report_id ? { ...r, status: 'SUBMITTED' } : r));
      setSelected((prev: any) => prev ? { ...prev, status: 'SUBMITTED' } : prev);
    } catch (err) { console.error(err); }
  };

  const summary = selected?.generated_summary;

  return (
    <div className="h-full flex">
      <aside className="w-[260px] border-r border-gray-700 overflow-y-auto p-3">
        <h4 className="text-xs text-gray-400 mb-3">보고서 목록 ({reports.length}건)</h4>
        {reports.map(r => (
          <button key={r.report_id} onClick={() => setSelected(r)}
            className={`w-full text-left text-[11px] px-3 py-2.5 rounded mb-1 transition-colors ${
              selected?.report_id === r.report_id ? 'bg-accent-blue/20 text-white border border-accent-blue/30' : 'text-gray-300 hover:bg-bg-tertiary'
            }`}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                r.status === 'DRAFT' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
              }`}>{r.status}</span>
              <span className="text-[10px] text-gray-500">{r.scenario_id}</span>
            </div>
            <div className="truncate">{r.title}</div>
          </button>
        ))}
      </aside>

      <main className="flex-1 p-4 overflow-y-auto">
        {selected ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold">{selected.title}</h2>
                <div className="text-[10px] text-gray-500 mt-1">
                  {selected.report_id} · {selected.report_type} ·
                  <span className={selected.status === 'DRAFT' ? 'text-yellow-400' : 'text-green-400'}> {selected.status}</span>
                </div>
              </div>
            </div>

            {/* 자동수집 데이터 */}
            {summary && (
              <div className="bg-bg-tertiary rounded-lg p-4 mb-4">
                <h4 className="text-xs text-gray-400 mb-3 font-medium">자동수집 데이터</h4>
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  {summary.event && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-medium">이벤트 개요</div>
                      <div className="text-white">{summary.event.summary}</div>
                      <div className="text-gray-400">심각도: {summary.event.severity}</div>
                    </div>
                  )}
                  {summary.kogas_diagnosis && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-medium">KOGAS 진단</div>
                      <div className="text-white">{summary.kogas_diagnosis.fault_name}</div>
                      <div className="text-gray-400">확신도: {(summary.kogas_diagnosis.confidence * 100).toFixed(0)}%</div>
                      <div className="text-gray-400">의심부위: {summary.kogas_diagnosis.suspected_part}</div>
                    </div>
                  )}
                  {summary.kgs_impact?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-medium">KGS 영향분석</div>
                      {summary.kgs_impact.map((k: any, i: number) => (
                        <div key={i} className="text-gray-300">{k.affected}: {k.score}점 ({k.risk})</div>
                      ))}
                    </div>
                  )}
                  {summary.keti_recommendation && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-medium">KETI 권고안</div>
                      <div className="text-gray-300">A: {summary.keti_recommendation.option_a}</div>
                      <div className="text-gray-300">B: {summary.keti_recommendation.option_b}</div>
                    </div>
                  )}
                  {summary.safetia_history?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-medium">이력 요약</div>
                      {summary.safetia_history.map((s: any, i: number) => (
                        <div key={i} className="text-gray-300">{s.equipment}: {s.incident}</div>
                      ))}
                    </div>
                  )}
                  {summary.sop_executions?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-medium">SOP 수행이력</div>
                      {summary.sop_executions.map((e: any, i: number) => (
                        <div key={i} className="text-gray-300">{e.sop_id}: {e.status}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 관리자 의견 */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-400 mb-2 font-medium">관리자 의견</h4>
              <textarea
                className="w-full h-28 bg-bg-tertiary border border-gray-600 rounded-lg p-3 text-xs text-white resize-none"
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                placeholder="관리자 의견을 입력하세요..."
                disabled={selected.status === 'SUBMITTED'}
              />
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || selected.status === 'SUBMITTED'}
                className="bg-accent-blue text-white px-5 py-2 rounded text-xs font-medium disabled:opacity-50">
                {saving ? '저장중...' : '저장'}
              </button>
              <button onClick={handleSubmit} disabled={selected.status === 'SUBMITTED'}
                className="bg-accent-green text-black px-5 py-2 rounded text-xs font-medium disabled:opacity-50">
                {selected.status === 'SUBMITTED' ? '제출됨' : '제출'}
              </button>
              <button className="bg-bg-tertiary text-gray-300 px-5 py-2 rounded text-xs hover:bg-gray-600">PDF</button>
            </div>
          </>
        ) : (
          <div className="text-gray-500 text-xs text-center mt-10">보고서를 선택하세요</div>
        )}
      </main>
    </div>
  );
}
