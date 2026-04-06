// ref: CLAUDE.md §22.1 — 디바이스별 성능 계층화
'use client';
import { useMediaQuery, BREAKPOINTS } from './useMediaQuery';

export type PerformanceTier = 'low' | 'medium' | 'high';

export function usePerformanceTier() {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.mobile - 1}px)`);
  const isLowEnd = typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4;

  const tier: PerformanceTier = isMobile ? 'low' : isLowEnd ? 'medium' : 'high';

  return {
    tier,
    enableGlow: tier === 'high',
    enableParticles: tier !== 'low',
    enableHeatmap: tier !== 'low',
    enableShadows: false, // POC 일괄 비활성
    maxParticlesPerPipe: tier === 'low' ? 0 : tier === 'medium' ? 50 : 200,
    dpr: tier === 'low' ? 1 : tier === 'medium' ? 1.5 : 2,
    antialias: tier !== 'low',
  };
}
