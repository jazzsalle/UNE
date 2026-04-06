// ref: CLAUDE.md §5.3, §5.5, §10 — 코드 상수, 컬러맵, 카메라 프리셋

export type ModeCode = 'M-MON' | 'M-ANO' | 'M-RSK' | 'M-SIM' | 'M-HIS' | 'M-SOP';
export type VisualState = 'emergency' | 'critical' | 'simTarget' | 'affected' | 'warning' | 'normal';
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';

export const COLOR_MAP: Record<VisualState, string> = {
  emergency: '#FF1744',
  critical:  '#FF5722',
  simTarget: '#E040FB',
  affected:  '#FFEE58',
  warning:   '#FFA726',
  normal:    '#66BB6A',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  INFO:      '#3b82f6',
  WARNING:   '#f97316',
  CRITICAL:  '#ef4444',
  EMERGENCY: '#dc2626',
};

export const MODE_TABS: { code: ModeCode; label: string; path: string }[] = [
  { code: 'M-MON', label: '전주기 운전 모니터링', path: '/monitoring' },
  { code: 'M-ANO', label: '설비 상태감시',  path: '/anomaly' },
  { code: 'M-RSK', label: '상호영향 위험예측', path: '/risk' },
  { code: 'M-SIM', label: '시뮬레이션',   path: '/simulation' },
  { code: 'M-HIS', label: '이력관리',    path: '/history' },
  { code: 'M-SOP', label: '디지털 SOP',  path: '/sop' },
];

// ISO/Bird-eye 뷰: position은 target 대비 항상 높고(Y↑) 대각선 오프셋(X+60~80, Z+40~60)
export const CAMERA_PRESETS: Record<string, { target: [number, number, number]; position: [number, number, number]; description: string }> = {
  cam_ship_carrier_001:    { target: [303.0, -95.9, 12.8],  position: [383.0, -25.9, 100.0],  description: '선석 ISO 뷰, 운반선 전체 조망' },
  cam_loading_arm_101:     { target: [271.8, -121.1, 8.6],  position: [341.8, -61.1, 88.6],   description: '로딩암 ISO 뷰' },
  cam_tank_101:            { target: [144.7, -208.2, 22.4], position: [224.7, -148.2, 102.4],  description: '저장탱크 #1 ISO 뷰' },
  cam_tank_102:            { target: [47.2, -204.4, 22.4],  position: [127.2, -144.4, 102.4],  description: '저장탱크 #2 ISO 뷰' },
  cam_bog_compressor_201:  { target: [33.4, -43.6, 21.1],   position: [113.4, 16.4, 101.1],    description: 'BOG 압축기 ISO 뷰' },
  cam_pump_301:            { target: [140.6, 54.1, 25.4],   position: [210.6, 104.1, 95.4],    description: '이송펌프 ISO 뷰' },
  cam_vaporizer_401:       { target: [133.4, 189.0, 30.6],  position: [203.4, 239.0, 100.6],   description: '기화기 ISO 뷰' },
  cam_reliquefier_701:     { target: [143.7, -59.4, 30.9],  position: [213.7, 0.6, 100.9],     description: '재액화기 ISO 뷰' },
  cam_valve_station_601:   { target: [-52.2, -47.9, 39.8],  position: [27.8, 12.1, 119.8],     description: '벤트스택 #1 ISO 뷰' },
  cam_valve_station_602:   { target: [-2.5, 177.4, 39.8],   position: [77.5, 237.4, 119.8],    description: '벤트스택 #2 ISO 뷰' },
  cam_pipe_main_a:         { target: [59.4, -8.0, 24.3],    position: [300.0, 200.0, 200.0],   description: '메인 이송배관 전경' },
  cam_overview:            { target: [90.0, 0.0, 20.0],     position: [350.0, 350.0, 300.0],   description: '인수기지 전체 조감도' },
  cam_berth_overview:      { target: [280.0, -110.0, 10.0], position: [450.0, 50.0, 150.0],    description: '선석/하역부 전체 조망' },
};

export const EQUIPMENT_ICONS: Record<string, string> = {
  LH2_CARRIER: '🚢', LOADING_ARM: '⚓', STORAGE_TANK: '🏭', BOG_COMPRESSOR: '💨',
  TRANSFER_PUMP: '🔧', VAPORIZER: '🌡', MAIN_PIPE: '🔗', VALVE_STATION: '🔒',
  RELIQUEFIER: '♻', SEAWATER_PUMP: '🌊',
};

// 센서 유형 한글 매핑
export const SENSOR_TYPE_KR: Record<string, string> = {
  PRESSURE: '압력',
  TEMPERATURE: '온도',
  FLOW: '유량',
  VIBRATION: '진동',
  CURRENT: '전류',
  LEVEL: '레벨',
};

// 심각도 한글 매핑
export const SEVERITY_KR: Record<string, string> = {
  INFO: '정보',
  WARNING: '경고',
  CRITICAL: '위험',
  EMERGENCY: '비상',
};

// Phase 한글 매핑
export const PHASE_KR: Record<string, string> = {
  NORMAL: '정상',
  SYMPTOM: '이상감지',
  FAULT: '고장',
  SECONDARY_IMPACT: '시뮬레이션',
  RESPONSE: '대응/복구',
};

// 알람 라벨 한글 매핑
export const ALARM_LABEL_KR: Record<string, string> = {
  NORMAL: '정상',
  WARNING: '경고',
  ANOMALY: '이상',
};
