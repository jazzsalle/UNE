// ref: CLAUDE.md §5.7.5 — 영향 전파 경로 애니메이션
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PropagationPathProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  speed?: number;
  visible?: boolean;
}

export function PropagationPath({ from, to, color = '#FFEE58', speed = 1, visible = true }: PropagationPathProps) {
  const lineRef = useRef<THREE.Line>(null);

  const points = [
    new THREE.Vector3(...from),
    new THREE.Vector3(
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) + 15,
      (from[2] + to[2]) / 2
    ),
    new THREE.Vector3(...to),
  ];

  const curve = new THREE.QuadraticBezierCurve3(points[0], points[1], points[2]);
  const curvePoints = curve.getPoints(50);

  useFrame(({ clock }) => {
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineDashedMaterial;
      mat.dashSize = 3;
      mat.gapSize = 2;
      // Animate dash offset
      (lineRef.current as any).computeLineDistances?.();
    }
  });

  if (!visible) return null;

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(curvePoints), [from, to]);
  const material = useMemo(() => new THREE.LineDashedMaterial({
    color, dashSize: 3, gapSize: 2, transparent: true, opacity: 0.7,
  }), [color]);
  const lineObj = useMemo(() => {
    const l = new THREE.Line(geometry, material);
    l.computeLineDistances();
    return l;
  }, [geometry, material]);

  return <primitive ref={lineRef} object={lineObj} />;
}
