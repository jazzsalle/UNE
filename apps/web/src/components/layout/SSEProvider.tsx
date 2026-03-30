// SSE 연결을 layout에서 한 번만 초기화
'use client';
import { useSSE } from '@/hooks/useSSE';

export function SSEProvider() {
  useSSE();
  return null;
}
