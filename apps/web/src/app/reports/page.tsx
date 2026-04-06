// ref: CLAUDE.md §9.9 — 보고서 (P-RPT) 완성 + 이벤트 연계 자동생성
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [managerComment, setManagerComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'single' | 'bulk' | null>(null);

  useEffect(() => {
    api.getReports().then(setReports).catch(console.error);
  }, []);

  useEffect(() => {
    if (selected) setManagerComment(selected.manager_comment || '');
  }, [selected]);

  const loadEvents = async () => {
    const evts = await api.getEvents({ status: 'CLOSED' });
    // Filter events that don't already have a report
    const reportedEventIds = new Set(reports.map(r => r.event_id).filter(Boolean));
    setEvents(evts.filter((e: any) => !reportedEventIds.has(e.event_id)));
    setShowGenerate(true);
  };

  const handleGenerate = async (eventId: string) => {
    setGenerating(true);
    try {
      const report = await api.generateReport(eventId);
      setReports(prev => [report, ...prev]);
      setSelected(report);
      setShowGenerate(false);
    } catch (err) { console.error(err); }
    setGenerating(false);
  };

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

  const refreshReports = () => {
    api.getReports().then(setReports).catch(console.error);
  };

  // 건별 삭제
  const handleDeleteSingle = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await api.deleteReport(selected.report_id);
      setReports(prev => prev.filter(r => r.report_id !== selected.report_id));
      setCheckedIds(prev => { const next = new Set(prev); next.delete(selected.report_id); return next; });
      setSelected(null);
    } catch (err) { console.error(err); }
    setDeleting(false);
    setShowDeleteConfirm(null);
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (checkedIds.size === 0) return;
    setDeleting(true);
    try {
      await api.bulkDeleteReports(Array.from(checkedIds));
      setReports(prev => prev.filter(r => !checkedIds.has(r.report_id)));
      if (selected && checkedIds.has(selected.report_id)) setSelected(null);
      setCheckedIds(new Set());
    } catch (err) { console.error(err); }
    setDeleting(false);
    setShowDeleteConfirm(null);
  };

  const toggleCheck = (reportId: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  const toggleAllChecks = () => {
    if (checkedIds.size === reports.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(reports.map(r => r.report_id)));
    }
  };

  const summary = selected?.generated_summary;

  return (
    <div className="h-full flex flex-col lg:flex-row">
      <aside className="w-full lg:w-[280px] border-b lg:border-b-0 lg:border-r border-gray-700 overflow-y-auto p-3 max-h-[30vh] lg:max-h-none">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs text-gray-400">보고서 목록 ({reports.length}건)</h4>
          <div className="flex gap-1">
            <button onClick={() => setShowHelp(!showHelp)}
              className="text-[10px] text-gray-500 hover:text-cyan-400 border border-gray-600 hover:border-cyan-500/30 px-1.5 py-0.5 rounded transition-all"
              title="도움말">?</button>
            <button onClick={refreshReports}
              className="text-[12px] px-2 py-1 rounded bg-bg-tertiary text-gray-400 hover:text-white" title="새로고침">
              ↻
            </button>
            <button onClick={loadEvents}
              className="text-[12px] px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
              + 생성
            </button>
          </div>
        </div>

        {showHelp && (
          <div className="mb-3 p-2.5 bg-gray-800/80 rounded border border-gray-600 text-[11px] space-y-1.5">
            <div className="text-cyan-400 font-bold text-[12px]">보고서 관리</div>
            <ul className="text-gray-400 space-y-1 list-disc ml-3">
              <li><b className="text-white">자동 생성</b>: 시나리오 대응(RESPONSE) 단계에서 이벤트 종료 시 보고서 초안이 자동 생성됨</li>
              <li><b className="text-white">수동 생성</b>: [+ 생성] 버튼으로 종료된 이벤트를 선택하여 새 보고서 작성</li>
              <li><b className="text-white">자동수집 영역</b>: KOGAS 진단, KGS 영향분석, KETI 권고안, 이력, SOP 수행 결과가 자동으로 포함</li>
              <li><b className="text-white">관리자 작성</b>: 관리자 의견란에 직접 코멘트를 작성하고 저장</li>
              <li><b className="text-white">상태 관리</b>: DRAFT(초안) → SUBMITTED(제출) 상태 전환</li>
              <li><b className="text-white">삭제</b>: 개별 삭제(상세화면 삭제 버튼) 또는 체크박스 선택 후 일괄 삭제</li>
            </ul>
          </div>
        )}

        {/* Generate from event modal */}
        {showGenerate && (
          <div className="mb-3 bg-bg-tertiary rounded-lg p-3 border border-gray-600">
            <div className="text-[12px] text-gray-400 mb-2 font-medium">이벤트 기반 보고서 생성</div>
            {events.length === 0 ? (
              <div className="text-[12px] text-gray-500">생성 가능한 종료 이벤트가 없습니다.</div>
            ) : (
              <div className="space-y-1">
                {events.map((e: any) => (
                  <button key={e.event_id} onClick={() => handleGenerate(e.event_id)} disabled={generating}
                    className="w-full text-left text-[12px] px-2 py-1.5 rounded hover:bg-bg-secondary text-gray-300 disabled:opacity-50">
                    <span className="text-cyan-400">{e.scenario_id}</span> · {e.summary || e.trigger_equipment_id}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowGenerate(false)} className="text-[9px] text-gray-500 mt-2 hover:text-gray-300">닫기</button>
          </div>
        )}

        {/* 일괄 삭제 컨트롤 */}
        {reports.length > 0 && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/50">
            <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-gray-400 hover:text-gray-300">
              <input
                type="checkbox"
                checked={reports.length > 0 && checkedIds.size === reports.length}
                onChange={toggleAllChecks}
                className="rounded accent-cyan-500 w-3.5 h-3.5"
              />
              전체선택
            </label>
            {checkedIds.size > 0 && (
              <button
                onClick={() => setShowDeleteConfirm('bulk')}
                disabled={deleting}
                className="ml-auto text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                선택 삭제 ({checkedIds.size}건)
              </button>
            )}
          </div>
        )}

        {reports.map(r => (
          <div key={r.report_id} className="flex items-start gap-1.5 mb-1">
            <input
              type="checkbox"
              checked={checkedIds.has(r.report_id)}
              onChange={() => toggleCheck(r.report_id)}
              className="mt-2.5 rounded accent-cyan-500 w-3.5 h-3.5 shrink-0 cursor-pointer"
            />
            <button onClick={() => setSelected(r)}
              className={`flex-1 text-left text-[13px] px-3 py-2.5 rounded transition-colors ${
                selected?.report_id === r.report_id ? 'bg-accent-blue/20 text-white border border-accent-blue/30' : 'text-gray-300 hover:bg-bg-tertiary'
              }`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  r.status === 'DRAFT' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                }`}>{r.status}</span>
                <span className="text-[12px] text-gray-500">{r.scenario_id}</span>
              </div>
              <div className="truncate">{r.title}</div>
            </button>
          </div>
        ))}
      </aside>

      <main className="flex-1 p-4 overflow-y-auto">
        {selected ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold">{selected.title}</h2>
                <div className="text-[12px] text-gray-500 mt-1">
                  {selected.report_id} · {selected.report_type} ·
                  <span className={selected.status === 'DRAFT' ? 'text-yellow-400' : 'text-green-400'}> {selected.status}</span>
                </div>
              </div>
            </div>

            {/* 자동수집 데이터 */}
            {summary && (
              <div className="bg-bg-tertiary rounded-lg p-4 mb-4">
                <h4 className="text-xs text-gray-400 mb-3 font-medium">자동수집 데이터</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
                  {summary.event && (
                    <div className="space-y-1">
                      <div className="text-[12px] text-gray-500 font-medium">이벤트 개요</div>
                      <div className="text-white">{summary.event.summary || summary.event_overview}</div>
                      <div className="text-gray-400">심각도: {summary.event.severity}</div>
                    </div>
                  )}
                  {(summary.kogas_diagnosis || summary.kogas) && (() => {
                    const k = summary.kogas_diagnosis || summary.kogas;
                    return (
                      <div className="space-y-1">
                        <div className="text-[12px] text-gray-500 font-medium">KOGAS 진단</div>
                        <div className="text-white">{k.fault_name || k.diagnosis}</div>
                        <div className="text-gray-400">확신도: {typeof k.confidence === 'number' ? (k.confidence * 100).toFixed(0) : k.confidence}%</div>
                        {k.suspected_part && <div className="text-gray-400">의심부위: {k.suspected_part}</div>}
                      </div>
                    );
                  })()}
                  {(summary.kgs_impact?.length > 0 || summary.kgs) && (
                    <div className="space-y-1">
                      <div className="text-[12px] text-gray-500 font-medium">KGS 영향분석</div>
                      {(summary.kgs_impact || []).map((k: any, i: number) => (
                        <div key={i} className="text-gray-300">{k.affected}: {k.score}점 ({k.risk})</div>
                      ))}
                    </div>
                  )}
                  {(summary.keti_recommendation || summary.keti) && (() => {
                    const k = summary.keti_recommendation || summary.keti;
                    return (
                      <div className="space-y-1">
                        <div className="text-[12px] text-gray-500 font-medium">KETI 권고안</div>
                        <div className="text-gray-300">A: {k.option_a}</div>
                        <div className="text-gray-300">B: {k.option_b}</div>
                      </div>
                    );
                  })()}
                  {summary.safetia_history?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[12px] text-gray-500 font-medium">이력 요약</div>
                      {summary.safetia_history.map((s: any, i: number) => (
                        <div key={i} className="text-gray-300">{s.equipment}: {s.incident}</div>
                      ))}
                    </div>
                  )}
                  {summary.sop_executions?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[12px] text-gray-500 font-medium">SOP 수행이력</div>
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
              <button
                onClick={() => setShowDeleteConfirm('single')}
                disabled={deleting}
                className="ml-auto bg-red-500/20 text-red-400 px-4 py-2 rounded text-xs font-medium hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                삭제
              </button>
            </div>
          </>
        ) : (
          <div className="text-gray-500 text-xs text-center mt-10">보고서를 선택하세요</div>
        )}
      </main>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-bg-secondary border border-gray-600 rounded-lg p-5 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-sm font-bold text-white mb-2">
              {showDeleteConfirm === 'single' ? '보고서 삭제' : '보고서 일괄 삭제'}
            </div>
            <div className="text-[13px] text-gray-300 mb-4">
              {showDeleteConfirm === 'single'
                ? `"${selected?.title}" 보고서를 삭제하시겠습니까?`
                : `선택한 ${checkedIds.size}건의 보고서를 삭제하시겠습니까?`
              }
              <div className="text-[12px] text-red-400/80 mt-1">이 작업은 되돌릴 수 없습니다.</div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-1.5 rounded text-xs text-gray-400 hover:text-white bg-bg-tertiary hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={showDeleteConfirm === 'single' ? handleDeleteSingle : handleBulkDelete}
                disabled={deleting}
                className="px-4 py-1.5 rounded text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? '삭제중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
