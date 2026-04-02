// 상시 모니터링 데이터 생성을 layout에서 한 번만 초기화
// 시나리오 미실행 시 더미 센서 데이터를 Zustand store에 공급
'use client';
import { useAmbientMonitor } from '@/hooks/useAmbientMonitor';

export function AmbientProvider() {
  useAmbientMonitor();
  return null;
}
