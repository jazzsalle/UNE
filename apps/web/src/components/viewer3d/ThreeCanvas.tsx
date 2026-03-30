// ref: CLAUDE.md §5, §21.3 — 반응형 3D Canvas
'use client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useProgress, Html } from '@react-three/drei';

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
}

export function ThreeCanvas({ children, className }: ThreeCanvasProps) {
  return (
    <div className={`w-full h-full ${className || ''}`}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.1, far: 5000, position: [350, 350, 300] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
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
          target={[90, 0, 20]}
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
