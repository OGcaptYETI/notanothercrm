import React from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath, EdgeLabelRenderer, getBezierPath } from 'reactflow';

export function CustomOffsetEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  data,
}: EdgeProps) {
  // Apply vertical offset for visual separation of multiple edges
  const offset = data?.offset || 0;
  
  // Apply offset to Y positions to separate overlapping edges
  const offsetSourceY = sourceY + offset;
  const offsetTargetY = targetY + offset;
  
  // Use bezier path for smoother curves with offset
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY: offsetSourceY,
    sourcePosition,
    targetX,
    targetY: offsetTargetY,
    targetPosition,
    curvature: 0.25,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              ...labelBgStyle,
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              ...labelStyle,
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
