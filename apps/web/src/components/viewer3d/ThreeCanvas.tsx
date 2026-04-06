// ref: CLAUDE.md §5, §21.3 — 반응형 3D Canvas
'use client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useProgress, Html } from '@react-three/drei';
import { DEFAULT_POSITION, DEFAULT_TARGET } from './CameraBookmark';

function Loader() {
  const { progress, active } = useProgress();
  if (!active) return null;
  return (
    <Html center>
      <div className="text-white text-sm bg-black/70 px-4 py-2 rounded">
        로딩 중... {progress.toFixed(0)}%
      </div>
    </Html>
  );
}

interface ThreeCanvasProps {
  children: React.ReactNode;
  className?: string;
  /** 초기 카메라 위치 (저장된 시점이 있으면 사용) */
  initialPosition?: [number, number, number];
  /** 초기 OrbitControls 타겟 (저장된 시점이 있으면 사용) */
  initialTarget?: [number, number, number];
}

export function ThreeCanvas({ children, className, initialPosition, initialTarget }: ThreeCanvasProps) {
  const pos = initialPosition || DEFAULT_POSITION;
  const tgt = initialTarget || DEFAULT_TARGET;

  return (
    <div className={`w-full h-full min-h-[50vh] lg:min-h-0 ${className || ''}`}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.1, far: 5000, position: pos }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('[WebGL] Context lost — waiting for restore');
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            console.info('[WebGL] Context restored');
          });
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 200, 100]} intensity={0.8} />
        <directionalLight position={[-100, 100, -50]} intensity={0.3} />
        <Suspense fallback={<Loader />}>
          {children}
        </Suspense>
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.1}
          minDistance={10}
          maxDistance={2000}
          target={tgt}
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
