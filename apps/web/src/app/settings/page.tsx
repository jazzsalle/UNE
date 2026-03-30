// ref: CLAUDE.md §9.7 — 설정 (P-SET)
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [tab, setTab] = useState<'meta' | 'threshold' | 'policy'>('meta');
  const [sensors, setSensors] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);

  useEffect(() => {
    api.getSensorMeta().then(setSensors).catch(console.error);
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex gap-2 mb-4">
        {[{k:'meta',l:'센서 메타데이터'},{k:'threshold',l:'임계치 관리'},{k:'policy',l:'운영정책'}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`text-xs px-3 py-1 rounded ${tab === t.k ? 'bg-accent-blue text-white' : 'text-gray-400'}`}>{t.l}</button>
        ))}
      </div>

      {tab === 'meta' && (
        <div className="overflow-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-2">ID</th><th className="text-left">이름</th><th className="text-left">유형</th>
              <th className="text-left">설비</th><th className="text-left">단위</th><th className="text-left">주기(s)</th><th className="text-left">활성</th>
            </tr></thead>
            <tbody>
              {sensors.map(s => (
                <tr key={s.sensor_id} className="border-b border-gray-800">
                  <td className="py-1.5 text-white">{s.sensor_id}</td>
                  <td className="text-gray-300">{s.sensor_name}</td>
                  <td className="text-gray-400">{s.sensor_type}</td>
                  <td className="text-gray-400">{s.equipment_id}</td>
                  <td className="text-gray-400">{s.unit}</td>
                  <td className="text-gray-400">{s.sample_interval_sec}</td>
                  <td>{s.enabled ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'threshold' && <div className="text-gray-500 text-xs">임계치 편집 UI (구현 예정)</div>}
      {tab === 'policy' && (
        <div className="space-y-3">
          {settings.map(s => (
            <div key={s.setting_key} className="flex items-center gap-4 text-xs">
              <span className="text-gray-400 w-48">{s.description || s.setting_key}</span>
              <span className="text-white">{s.setting_value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
