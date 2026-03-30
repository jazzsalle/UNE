// ref: CLAUDE.md §9.3 — 2D 영향 네트워크 (react-flow)
'use client';
import { useMemo, useCallback } from 'react';
import ReactFlow, { Node, Edge, Background, Controls, MiniMap, Position } from 'reactflow';
import 'reactflow/dist/style.css';

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
}

export function ImpactNetwork2D({ kgsResults, onNodeClick }: ImpactNetwork2DProps) {
  const { nodes, edges } = useMemo(() => {
    if (kgsResults.length === 0) return { nodes: [], edges: [] };

    const nodeMap = new Map<string, { score: number; color: string; risk: string; type: string }>();

    for (const r of kgsResults) {
      // Trigger node
      if (!nodeMap.has(r.trigger_equipment_id) || r.impact_type === 'PRIMARY_EVENT') {
        nodeMap.set(r.trigger_equipment_id, {
          score: r.impact_score,
          color: r.color_2d || '#EF5350',
          risk: r.risk_level,
          type: 'trigger',
        });
      }
      // Affected node
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
    const nodes: Node[] = nodeArray.map(([id, data], i) => ({
      id,
      position: {
        x: data.type === 'trigger' ? 200 : 50 + (i % 3) * 150,
        y: data.type === 'trigger' ? 50 : 150 + Math.floor(i / 3) * 100,
      },
      data: {
        label: (
          <div className="text-center">
            <div className="font-bold text-[11px]">{id}</div>
            <div className="text-[9px]">{data.score}점 · {data.risk}</div>
          </div>
        ),
      },
      style: {
        background: data.color + '30',
        border: `2px solid ${data.color}`,
        borderRadius: '8px',
        padding: '8px',
        fontSize: '11px',
        color: '#e5e7eb',
        width: 120,
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
        labelStyle: { fontSize: 9, fill: '#9ca3af' },
        labelBgStyle: { fill: '#111827' },
      }));

    return { nodes, edges };
  }, [kgsResults]);

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
    <div className="h-full" style={{ background: '#0a0e17' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f2937" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => n.style?.border?.toString() || '#666'}
          maskColor="#0a0e1780"
          style={{ background: '#111827' }}
        />
      </ReactFlow>
    </div>
  );
}
