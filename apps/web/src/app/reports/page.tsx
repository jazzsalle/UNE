// ref: CLAUDE.md §9.9 — 보고서 (P-RPT)
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    api.getReports().then(setReports).catch(console.error);
  }, []);

  return (
    <div className="h-full flex">
      <aside className="w-[250px] border-r border-gray-700 overflow-y-auto p-3">
        <h4 className="text-xs text-gray-400 mb-2">보고서 목록</h4>
        {reports.map(r => (
          <button key={r.report_id} onClick={() => setSelected(r)}
            className={`w-full text-left text-[11px] px-3 py-2 rounded mb-1 ${
              selected?.report_id === r.report_id ? 'bg-accent-blue/20 text-white' : 'text-gray-300 hover:bg-bg-tertiary'
            }`}>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${r.status === 'DRAFT' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                {r.status}
              </span>
              <span className="truncate">{r.title}</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">{r.scenario_id}</div>
          </button>
        ))}
      </aside>

      <main className="flex-1 p-4 overflow-y-auto">
        {selected ? (
          <>
            <h2 className="text-sm font-bold mb-1">{selected.title}</h2>
            <div className="text-[10px] text-gray-500 mb-4">{selected.report_id} · {selected.report_type} · {selected.status}</div>

            {selected.generated_summary && (
              <div className="bg-bg-tertiary rounded p-3 mb-4">
                <h4 className="text-xs text-gray-400 mb-2">자동수집 데이터</h4>
                <pre className="text-[10px] text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(selected.generated_summary, null, 2)}
                </pre>
              </div>
            )}

            <div className="mb-4">
              <h4 className="text-xs text-gray-400 mb-1">관리자 의견</h4>
              <textarea className="w-full h-24 bg-bg-tertiary border border-gray-600 rounded p-2 text-xs text-white"
                defaultValue={selected.manager_comment || ''} placeholder="관리자 의견 입력..." />
            </div>

            <div className="flex gap-2">
              <button className="bg-accent-blue text-white px-4 py-1.5 rounded text-xs">저장</button>
              <button className="bg-accent-green text-black px-4 py-1.5 rounded text-xs">제출</button>
            </div>
          </>
        ) : (
          <div className="text-gray-500 text-xs text-center mt-10">보고서를 선택하세요</div>
        )}
      </main>
    </div>
  );
}
