'use client';

import { useState } from 'react';
import type { TCMNode, TCMEdge } from '../types';
import { GraphCanvas } from './GraphCanvas';
import { FilterPanel } from './FilterPanel';

interface TCMGraphClientProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
}

export function TCMGraphClient({ nodes, edges }: TCMGraphClientProps) {
  const [eraFilter, setEraFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState('');

  return (
    <>
      {/* Filter bar — fixed at top of graph area */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <FilterPanel
          nodes={nodes}
          edges={edges}
          eraFilter={eraFilter}
          schoolFilter={schoolFilter}
          edgeTypeFilter={edgeTypeFilter}
          onEraChange={setEraFilter}
          onSchoolChange={setSchoolFilter}
          onEdgeTypeChange={setEdgeTypeFilter}
        />
      </div>

      {/* Graph Canvas */}
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        eraFilter={eraFilter}
        schoolFilter={schoolFilter}
        edgeTypeFilter={edgeTypeFilter}
      />
    </>
  );
}
