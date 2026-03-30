// ref: CLAUDE.md §9.7 — 설정 (P-SET) 완성
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [tab, setTab] = useState<'meta' | 'threshold' | 'policy'>('meta');
  const [sensors, setSensors] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState('BOG-201');
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [editingThreshold, setEditingThreshold] = useState<Record<string, any>>({});

  useEffect(() => {
    api.getSensorMeta().then(setSensors).catch(console.error);
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    if (tab === 'threshold') {
      api.getThresholds(selectedEquipment).then((data) => {
        setThresholds(data);
        const editing: Record<string, any> = {};
        for (const t of data) editing[t.sensor_id] = { ...t };
        setEditingThreshold(editing);
      }).catch(console.error);
    }
  }, [tab, selectedEquipment]);

  const handleThresholdChange = (sensorId: string, field: string, value: string) => {
    setEditingThreshold(prev => ({
      ...prev,
      [sensorId]: { ...prev[sensorId], [field]: parseFloat(value) || 0 },
    }));
  };

  const saveThreshold = async (sensorId: string) => {
    const data = editingThreshold[sensorId];
    if (!data) return;
    try {
      await api.updateThreshold(sensorId, {
        warning_low: data.warning_low, warning_high: data.warning_high,
        critical_low: data.critical_low, critical_high: data.critical_high,
      });
      alert('저장 완료');
    } catch (err) { console.error(err); }
  };

  const equipmentIds = [...new Set(sensors.map(s => s.equipment_id))];

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <div className="flex gap-2 mb-4">
        {[{ k: 'meta', l: '센서 메타데이터' }, { k: 'threshold', l: '임계치 관리' }, { k: 'policy', l: '운영정책' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`text-xs px-3 py-1.5 rounded ${tab === t.k ? 'bg-accent-blue text-white' : 'text-gray-400 hover:bg-bg-tertiary'}`}>{t.l}</button>
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
                <tr key={s.sensor_id} className="border-b border-gray-800 hover:bg-bg-tertiary">
                  <td className="py-1.5 text-white font-mono">{s.sensor_id}</td>
                  <td className="text-gray-300">{s.sensor_name}</td>
                  <td className="text-gray-400">{s.sensor_type}</td>
                  <td className="text-gray-400">{s.equipment_id}</td>
                  <td className="text-gray-400">{s.unit}</td>
                  <td className="text-gray-400">{s.sample_interval_sec}</td>
                  <td>{s.enabled ? <span className="text-green-400">ON</span> : <span className="text-red-400">OFF</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'threshold' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs text-gray-400">설비 선택:</span>
            <select value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}
              className="bg-bg-tertiary border border-gray-600 rounded px-2 py-1 text-xs text-white">
              {equipmentIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>

          <table className="w-full text-[11px]">
            <thead><tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-2">센서</th>
              <th className="text-left">경고 하한</th><th className="text-left">경고 상한</th>
              <th className="text-left">위험 하한</th><th className="text-left">위험 상한</th>
              <th className="text-left">정상값</th><th></th>
            </tr></thead>
            <tbody>
              {thresholds.map(t => (
                <tr key={t.sensor_id} className="border-b border-gray-800">
                  <td className="py-1.5 text-white font-mono">{t.sensor_id}</td>
                  {['warning_low', 'warning_high', 'critical_low', 'critical_high'].map(field => (
                    <td key={field}>
                      <input type="number" step="0.1"
                        value={editingThreshold[t.sensor_id]?.[field] ?? ''}
                        onChange={e => handleThresholdChange(t.sensor_id, field, e.target.value)}
                        className="w-16 bg-bg-tertiary border border-gray-600 rounded px-1 py-0.5 text-xs text-white" />
                    </td>
                  ))}
                  <td className="text-gray-400">{t.normal_value}</td>
                  <td><button onClick={() => saveThreshold(t.sensor_id)}
                    className="text-accent-blue hover:underline text-[10px]">저장</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'policy' && (
        <div className="space-y-4 max-w-lg">
          {settings.map(s => (
            <div key={s.setting_key} className="flex items-center justify-between py-2 border-b border-gray-800">
              <div>
                <div className="text-xs text-white">{s.description || s.setting_key}</div>
                <div className="text-[10px] text-gray-500">{s.setting_group} · {s.setting_key}</div>
              </div>
              <div className="flex items-center gap-2">
                {s.value_type === 'BOOLEAN' ? (
                  <button onClick={async () => {
                    const newVal = s.setting_value === 'true' ? 'false' : 'true';
                    try {
                      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/settings/${s.setting_id}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ setting_value: newVal }),
                      });
                      setSettings(prev => prev.map(x => x.setting_id === s.setting_id ? { ...x, setting_value: newVal } : x));
                    } catch (err) { console.error(err); }
                  }} className={`px-3 py-1 rounded text-[10px] transition-colors cursor-pointer ${s.setting_value === 'true' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                    {s.setting_value === 'true' ? 'ON' : 'OFF'}
                  </button>
                ) : (
                  <span className="text-xs text-white bg-bg-tertiary px-2 py-0.5 rounded">{s.setting_value}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
