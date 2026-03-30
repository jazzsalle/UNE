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
  { code: 'M-MON', label: '모니터링',    path: '/monitoring' },
  { code: 'M-ANO', label: '이상탐지',    path: '/anomaly' },
  { code: 'M-RSK', label: '위험예측',    path: '/risk' },
  { code: 'M-SIM', label: '시뮬레이션',   path: '/simulation' },
  { code: 'M-HIS', label: '이력조회',    path: '/history' },
  { code: 'M-SOP', label: 'SOP',        path: '/sop' },
];

export const CAMERA_PRESETS: Record<string, { target: [number, number, number]; position: [number, number, number]; description: string }> = {
  cam_ship_carrier_001:    { target: [303.0, -95.9, 12.8],  position: [425.2, -10.4, 73.9],   description: '선석 정면, 운반선 전체 조망' },
  cam_loading_arm_101:     { target: [271.8, -121.1, 8.6],  position: [398.0, -32.8, 71.7],   description: '로딩암 연결부 클로즈업' },
  cam_tank_101:            { target: [144.7, -208.2, 22.4], position: [215.5, -158.6, 57.8],  description: '저장탱크 #1 측면' },
  cam_tank_102:            { target: [47.2, -204.4, 22.4],  position: [118.0, -154.9, 57.8],  description: '저장탱크 #2 측면' },
  cam_bog_compressor_201:  { target: [33.4, -43.6, 21.1],   position: [119.9, 16.9, 64.4],    description: 'BOG 압축기 정면' },
  cam_pump_301:            { target: [140.6, 54.1, 25.4],   position: [192.4, 90.4, 51.3],    description: '이송펌프 측면' },
  cam_vaporizer_401:       { target: [133.4, 189.0, 30.6],  position: [196.6, 233.3, 62.3],   description: '기화기 입출구 배관 포함' },
  cam_reliquefier_701:     { target: [143.7, -59.4, 30.9],  position: [202.8, -18.0, 60.5],   description: '재액화기 전면' },
  cam_valve_station_601:   { target: [-52.2, -47.9, 39.8],  position: [27.7, 8.0, 79.8],      description: '밸브 스테이션 #1 정면' },
  cam_valve_station_602:   { target: [-2.5, 177.4, 39.8],   position: [77.5, 233.4, 79.8],    description: '밸브 스테이션 #2 정면' },
  cam_pipe_main_a:         { target: [59.4, -8.0, 24.3],    position: [464.9, 275.9, 227.1],  description: '메인 이송배관 전경' },
  cam_overview:            { target: [90.0, 0.0, 20.0],     position: [350.0, 350.0, 300.0],  description: '인수기지 전체 조감도' },
  cam_berth_overview:      { target: [280.0, -110.0, 10.0], position: [450.0, 50.0, 150.0],   description: '선석/하역부 전체 조망' },
};

export const EQUIPMENT_ICONS: Record<string, string> = {
  LH2_CARRIER: '🚢', LOADING_ARM: '⚓', STORAGE_TANK: '🏭', BOG_COMPRESSOR: '💨',
  TRANSFER_PUMP: '🔧', VAPORIZER: '🌡', MAIN_PIPE: '🔗', VALVE_STATION: '🔒',
  RELIQUEFIER: '♻', SEAWATER_PUMP: '🌊',
};
