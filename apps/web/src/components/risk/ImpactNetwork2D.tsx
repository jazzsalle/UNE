// ref: CLAUDE.md §9.3 — 2D 영향 네트워크 (react-flow)
'use client';
import { useMemo, useCallback } from 'react';
import ReactFlow, { Node, Edge, Background, Controls, Position } from 'reactflow';
import 'reactflow/dist/style.css';

const RISK_LEVEL_KR: Record<string, string> = {
  CRITICAL: '위험',
  HIGH: '높음',
  WARNING: '경고',
  MEDIUM: '보통',
  LOW: '낮음',
};

const EQUIPMENT_NAMES_KR: Record<string, string> = {
  'SHP-001': 'LH2 운반선',
  'ARM-101': '로딩암',
  'TK-101':  '저장탱크 #1',
  'TK-102':  '저장탱크 #2',
  'BOG-201': 'BOG 압축기',
  'PMP-301': '이송펌프',
  'VAP-401': '기화기',
  'REL-701': '재액화기',
  'VAL-601': '배출설비 #1',
  'VAL-602': '배출설비 #2',
  'PIP-501': '메인배관',
};

interface KgsResult {
  analysis_id: string;
  trigger_equipment_id: string;
  affected_equipment_id: string;
  impact_score: number;
  risk_level: string;
  color_2d: string;
  predicted_after_sec: number | null;
  impact_type: string;
  recommended_action: string;
}

interface ImpactNetwork2DProps {
  kgsResults: KgsResult[];
  onNodeClick?: (equipmentId: string) => void;
  fullscreen?: boolean;
}

export function ImpactNetwork2D({ kgsResults, onNodeClick, fullscreen }: ImpactNetwork2DProps) {
  const { nodes, edges } = useMemo(() => {
    if (kgsResults.length === 0) return { nodes: [], edges: [] };

    const nodeMap = new Map<string, { score: number; color: string; risk: string; type: string }>();

    for (const r of kgsResults) {
      if (!nodeMap.has(r.trigger_equipment_id) || r.impact_type === 'PRIMARY_EVENT') {
        nodeMap.set(r.trigger_equipment_id, {
          score: r.impact_score,
          color: r.color_2d || '#EF5350',
          risk: r.risk_level,
          type: 'trigger',
        });
      }
      if (r.trigger_equipment_id !== r.affected_equipment_id) {
        nodeMap.set(r.affected_equipment_id, {
          score: r.impact_score,
          color: r.color_2d || '#FFEE58',
          risk: r.risk_level,
          type: 'affected',
        });
      }
    }

    const nodeArray = Array.from(nodeMap.entries());
    // 트리거와 영향 설비 분리
    const triggers = nodeArray.filter(([, d]) => d.type === 'trigger');
    const affecteds = nodeArray.filter(([, d]) => d.type !== 'trigger');
    const nodeWidth = fullscreen ? 150 : 110;
    const hGap = fullscreen ? 30 : 20;
    const vGap = fullscreen ? 120 : 90;

    // 트리거 노드: 상단 중앙
    const totalAffectedWidth = affecteds.length * (nodeWidth + hGap) - hGap;
    const triggerX = Math.max(totalAffectedWidth / 2 - nodeWidth / 2, 50);

    // 영향 설비 노드: 트리거 아래 수평 배치
    const affectedStartX = Math.max(0, triggerX - totalAffectedWidth / 2 + nodeWidth / 2);

    const allPositioned = [
      ...triggers.map(([id, data], i) => ({
        entry: [id, data] as [string, typeof data],
        x: triggerX + i * (nodeWidth + hGap),
        y: 30,
      })),
      ...affecteds.map(([id, data], i) => ({
        entry: [id, data] as [string, typeof data],
        x: affectedStartX + i * (nodeWidth + hGap),
        y: 30 + vGap,
      })),
    ];

    const nodes: Node[] = allPositioned.map(({ entry: [id, data], x, y }) => ({
      id,
      position: { x, y },
      data: {
        label: (
          <div className="text-center">
            <div className="font-bold text-[10px]">{EQUIPMENT_NAMES_KR[id] || id}</div>
            <div className="text-[8px] text-gray-400">{id}</div>
            <div className="text-[9px] mt-0.5">{data.score}점 · {RISK_LEVEL_KR[data.risk] || data.risk}</div>
          </div>
        ),
      },
      style: {
        background: data.color + '30',
        border: `2px solid ${data.color}`,
        borderRadius: '8px',
        padding: '6px 8px',
        fontSize: '10px',
        color: '#e5e7eb',
        width: fullscreen ? 150 : 110,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));

    const edges: Edge[] = kgsResults
      .filter(r => r.trigger_equipment_id !== r.affected_equipment_id)
      .map((r) => ({
        id: r.analysis_id,
        source: r.trigger_equipment_id,
        target: r.affected_equipment_id,
        animated: true,
        style: {
          stroke: r.color_2d || '#FFEE58',
          strokeWidth: Math.max(1, r.impact_score / 30),
        },
        label: `${r.impact_score}점`,
        labelStyle: { fontSize: 8, fill: '#9ca3af' },
        labelBgStyle: { fill: '#111827' },
      }));

    return { nodes, edges };
  }, [kgsResults, fullscreen]);

  const handleNodeClick = useCallback((_: any, node: Node) => {
    onNodeClick?.(node.id);
  }, [onNodeClick]);

  if (kgsResults.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600 text-[11px]">
        [▶ 위험예측 실행] 을 눌러주세요
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: '#0a0e17' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f2937" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
