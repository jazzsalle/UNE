// ref: CLAUDE.md §9.6 — 이력조회 (M-HIS)
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function HistoryPage() {
  const [histories, setHistories] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string[]>([]);

  useEffect(() => {
    // Load safetia history for all scenarios
    Promise.all(['SC-01','SC-02','SC-03','SC-04','SC-05','SC-06','SC-07','SC-08'].map(s => api.getSafetia(s).catch(() => [])))
      .then(results => setHistories(results.flat()));
  }, []);

  const filtered = equipmentFilter.length > 0 ? histories.filter(h => equipmentFilter.includes(h.equipment_id)) : histories;

  return (
    <div className="h-full flex">
      <aside className="w-[200px] bg-bg-secondary border-r border-gray-700 p-3 overflow-y-auto">
        <h4 className="text-xs text-gray-400 mb-2">설비 필터</h4>
        {['BOG-201','TK-101','PMP-301','VAP-401','VAL-601','REL-701','ARM-101','SHP-001','PIP-501'].map(id => (
          <label key={id} className="flex items-center gap-2 text-[11px] text-gray-300 mb-1">
            <input type="checkbox" checked={equipmentFilter.includes(id)} onChange={(e) => {
              setEquipmentFilter(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
            }} className="rounded" />
            {id}
          </label>
        ))}
      </aside>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-3">
          <table className="w-full text-[11px]">
            <thead><tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-2">설비</th><th className="text-left">최근점검</th><th className="text-left">사고이력</th><th className="text-left">연계SOP</th>
            </tr></thead>
            <tbody>
              {filtered.map(h => (
                <tr key={h.history_id} onClick={() => setSelected(h)}
                  className={`border-b border-gray-800 cursor-pointer hover:bg-bg-tertiary ${selected?.history_id === h.history_id ? 'bg-bg-tertiary' : ''}`}>
                  <td className="py-2 text-white">{h.equipment_id}</td>
                  <td className="text-gray-400">{h.last_maintenance_date || '—'}</td>
                  <td className="text-gray-400 max-w-[200px] truncate">{h.past_incident_summary || '—'}</td>
                  <td className="text-accent-blue">{h.linked_sop_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="h-[200px] border-t border-gray-700 bg-bg-secondary p-4 overflow-y-auto">
            <h4 className="text-xs font-bold mb-2">이력 상세 — {selected.equipment_id}</h4>
            <div className="text-[11px] space-y-1">
              <div><span className="text-gray-500">점검일:</span> <span className="text-white">{selected.last_maintenance_date}</span></div>
              <div><span className="text-gray-500">사고요약:</span> <span className="text-white">{selected.past_incident_summary}</span></div>
              <div><span className="text-gray-500">운영자메모:</span> <span className="text-white">{selected.operator_note}</span></div>
              <div><span className="text-gray-500">연계SOP:</span> <span className="text-accent-blue">{selected.linked_sop_id}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
