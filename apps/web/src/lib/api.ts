// ref: CLAUDE.md §15.2 — API 클라이언트
// 브라우저에서는 같은 도메인의 /api/* 경로로 호출 (next.config.js rewrite가 Railway로 프록시)
// 서버사이드에서는 Railway URL 직접 호출
const API_URL = typeof window !== 'undefined'
  ? ''  // 브라우저: 상대경로 → Vercel rewrite 프록시 사용
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  // Equipment
  getEquipment: () => apiFetch('/api/equipment'),
  getEquipmentById: (id: string) => apiFetch(`/api/equipment/${id}`),
  getEquipmentSensors: (id: string) => apiFetch(`/api/equipment/${id}/sensors`),
  getZones: () => apiFetch('/api/zones'),

  // Scenarios
  getScenarios: () => apiFetch('/api/scenarios'),
  getScenarioById: (id: string) => apiFetch(`/api/scenarios/${id}`),

  // Emulator
  startEmulator: (scenario_id: string, speed: number) => apiFetch('/api/emulator/start', { method: 'POST', body: JSON.stringify({ scenario_id, speed }) }),
  stopEmulator: () => apiFetch('/api/emulator/stop', { method: 'POST' }),
  pauseEmulator: () => apiFetch('/api/emulator/pause', { method: 'POST' }),
  resumeEmulator: () => apiFetch('/api/emulator/resume', { method: 'POST' }),
  getEmulatorStatus: () => apiFetch('/api/emulator/status'),

  // Events
  getEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/api/events${qs}`);
  },
  getEventById: (id: string) => apiFetch(`/api/events/${id}`),
  patchEvent: (id: string, data: any) => apiFetch(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Providers
  getProviderHealth: (provider: string) => apiFetch(`/api/provider/${provider}/health`),
  getKogas: (scenarioId: string) => apiFetch(`/api/provider/kogas/${scenarioId}`),
  getKgs: (scenarioId: string) => apiFetch(`/api/provider/kgs/${scenarioId}`),
  analyzeKgs: (data: any) => apiFetch('/api/provider/kgs/analyze', { method: 'POST', body: JSON.stringify(data) }),
  getKeti: (scenarioId: string) => apiFetch(`/api/provider/keti/${scenarioId}`),
  simulateKeti: (data: any) => apiFetch('/api/provider/keti/simulate', { method: 'POST', body: JSON.stringify(data) }),
  getSafetia: (scenarioId: string) => apiFetch(`/api/provider/safetia/${scenarioId}`),

  // HAZOP
  getHazop: (scenarioId: string) => apiFetch(`/api/hazop/${scenarioId}`),

  // SOP
  getSops: () => apiFetch('/api/sop'),
  getSopById: (id: string) => apiFetch(`/api/sop/${id}`),
  recommendSop: (params: Record<string, string>) => apiFetch(`/api/sop/recommend?${new URLSearchParams(params)}`),
  executeSop: (sopId: string, data: any) => apiFetch(`/api/sop/${sopId}/execute`, { method: 'POST', body: JSON.stringify(data) }),
  updateExecution: (execId: string, data: any) => apiFetch(`/api/sop/execution/${execId}`, { method: 'PUT', body: JSON.stringify(data) }),
  completeExecution: (execId: string) => apiFetch(`/api/sop/execution/${execId}/complete`, { method: 'POST' }),
  deleteSop: (id: string) => apiFetch(`/api/sop/${id}`, { method: 'DELETE' }),
  getTrash: () => apiFetch('/api/sop/trash'),
  restoreSop: (id: string) => apiFetch(`/api/sop/${id}/restore`, { method: 'POST' }),
  permanentDeleteSop: (id: string) => apiFetch(`/api/sop/${id}/permanent`, { method: 'DELETE' }),

  // Reports
  getReports: () => apiFetch('/api/reports'),
  getReportById: (id: string) => apiFetch(`/api/reports/${id}`),
  generateReport: (event_id: string) => apiFetch('/api/reports/generate', { method: 'POST', body: JSON.stringify({ event_id }) }),
  updateReport: (id: string, data: any) => apiFetch(`/api/reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submitReport: (id: string) => apiFetch(`/api/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'SUBMITTED' }) }),
  deleteReport: (id: string) => apiFetch(`/api/reports/${id}`, { method: 'DELETE' }),
  bulkDeleteReports: (reportIds: string[]) => apiFetch('/api/reports/bulk-delete', { method: 'POST', body: JSON.stringify({ report_ids: reportIds }) }),

  // Settings
  getSettings: () => apiFetch('/api/settings'),
  getThresholds: (equipmentId?: string) => apiFetch(`/api/settings/thresholds${equipmentId ? `?equipment_id=${equipmentId}` : ''}`),
  updateThreshold: (sensorId: string, data: any) => apiFetch(`/api/settings/thresholds/${sensorId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getSensorMeta: () => apiFetch('/api/settings/sensor-meta'),
  updateSensorMeta: (sensorId: string, data: any) => apiFetch(`/api/settings/sensor-meta/${sensorId}`, { method: 'PUT', body: JSON.stringify(data) }),
};
