// 카메라 시점 저장/초기화 — Three.js 내부 컴포넌트 + HTML 오버레이 버튼
'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import gsap from 'gsap';

const STORAGE_PREFIX = 'lh2-camera-';

// 기본 카메라 위치 (ThreeCanvas 초기값)
const DEFAULT_POSITION: [number, number, number] = [350, 350, 300];
const DEFAULT_TARGET: [number, number, number] = [90, 0, 20];

interface SavedCamera {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Three.js 씬 내부에서 카메라 접근하는 컴포넌트.
 * ref를 통해 save/reset 함수를 외부(HTML 오버레이)에 노출.
 */
export interface CameraBookmarkRef {
  save: () => void;
  reset: () => void;
  restore: () => void;
}

interface CameraBookmarkProps {
  /** localStorage 키 구분 (페이지별: monitoring, anomaly, risk, simulation) */
  pageId: string;
  /** 외부에서 접근할 ref */
  controlRef: React.MutableRefObject<CameraBookmarkRef | null>;
}

export function CameraBookmark({ pageId, controlRef }: CameraBookmarkProps) {
  const { camera, controls } = useThree();
  const storageKey = STORAGE_PREFIX + pageId;

  const getOrbit = useCallback(() => {
    return controls as unknown as OrbitControlsImpl | null;
  }, [controls]);

  // save: 현재 카메라 위치/타겟을 localStorage에 저장
  const save = useCallback(() => {
    const orbit = getOrbit();
    const data: SavedCamera = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: orbit
        ? [orbit.target.x, orbit.target.y, orbit.target.z]
        : DEFAULT_TARGET,
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [camera, getOrbit, storageKey]);

  // reset: 기본 카메라 위치로 복원 + localStorage 삭제
  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    const orbit = getOrbit();

    gsap.to(camera.position, {
      x: DEFAULT_POSITION[0],
      y: DEFAULT_POSITION[1],
      z: DEFAULT_POSITION[2],
      duration: 0.8,
      ease: 'power2.inOut',
    });

    if (orbit) {
      gsap.to(orbit.target, {
        x: DEFAULT_TARGET[0],
        y: DEFAULT_TARGET[1],
        z: DEFAULT_TARGET[2],
        duration: 0.8,
        ease: 'power2.inOut',
        onUpdate: () => orbit.update(),
      });
    }
  }, [camera, getOrbit, storageKey]);

  // restore: localStorage에서 저장된 시점 복원
  const restore = useCallback(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const data: SavedCamera = JSON.parse(raw);
      const orbit = getOrbit();

      gsap.to(camera.position, {
        x: data.position[0],
        y: data.position[1],
        z: data.position[2],
        duration: 0.8,
        ease: 'power2.inOut',
      });

      if (orbit) {
        gsap.to(orbit.target, {
          x: data.target[0],
          y: data.target[1],
          z: data.target[2],
          duration: 0.8,
          ease: 'power2.inOut',
          onUpdate: () => orbit.update(),
        });
      }
    } catch {
      // 파싱 실패 시 무시
    }
  }, [camera, getOrbit, storageKey]);

  // ref에 함수 노출
  useEffect(() => {
    controlRef.current = { save, reset, restore };
  }, [save, reset, restore, controlRef]);

  // 마운트 시 저장된 시점 자동 복원
  useEffect(() => {
    // 씬 로딩 후 복원 (약간의 지연)
    const timer = setTimeout(() => restore(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * 카메라 시점 저장/초기화 오버레이 버튼 (Canvas 외부 HTML)
 */
interface CameraControlsOverlayProps {
  controlRef: React.MutableRefObject<CameraBookmarkRef | null>;
  /** 저장된 시점이 있는지 여부 (UI 힌트용) */
  pageId: string;
}

export function CameraControlsOverlay({ controlRef, pageId }: CameraControlsOverlayProps) {
  const hasSaved = typeof window !== 'undefined' && !!localStorage.getItem(STORAGE_PREFIX + pageId);

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      <button
        onClick={() => controlRef.current?.save()}
        className="bg-white/[0.08] hover:bg-white/[0.15] backdrop-blur-sm border border-white/[0.1] text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] transition-all flex items-center gap-1"
        title="현재 카메라 시점 저장"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        시점저장
      </button>
      <button
        onClick={() => controlRef.current?.restore()}
        className={`backdrop-blur-sm border border-white/[0.1] px-2.5 py-1.5 rounded-lg text-[10px] transition-all flex items-center gap-1 ${
          hasSaved
            ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border-cyan-500/20'
            : 'bg-white/[0.08] hover:bg-white/[0.15] text-gray-500 cursor-default'
        }`}
        title="저장된 시점으로 이동"
        disabled={!hasSaved}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
        시점복원
      </button>
      <button
        onClick={() => controlRef.current?.reset()}
        className="bg-white/[0.08] hover:bg-white/[0.15] backdrop-blur-sm border border-white/[0.1] text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] transition-all flex items-center gap-1"
        title="기본 시점으로 초기화"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        초기화
      </button>
    </div>
  );
}
