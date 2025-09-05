// Temporary bypass for WorkflowCanvas with minimal ReactFlow implementation
import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Connection,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { TriggerNode } from './nodes/TriggerNode.bypass';
import { WorkflowToolbar } from './WorkflowToolbar.bypass';

interface WorkflowCanvasProps {
  workflow: {
    id?: string;
    name: string;
    description?: string;
    nodes: any[];
    edges: any[];
  };
  onSave: () => void;
}

// Define node types for ReactFlow
const nodeTypes = {
  trigger: TriggerNode,
};

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ workflow, onSave }) => {
  // Convert workflow nodes/edges to ReactFlow format
  const initialNodes: Node[] = useMemo(() => {
    return workflow.nodes.map((node, index) => ({
      id: node.id || `node-${index}`,
      type: node.type || 'trigger',
      position: node.position || { x: 100 + index * 200, y: 100 },
      data: {
        label: node.data?.label || node.label || 'Node',
        type: node.data?.type || 'manual',
        description: node.data?.description || node.description,
        ...node.data,
      },
    }));
  }, [workflow.nodes]);

  const initialEdges: Edge[] = useMemo(() => {
    return workflow.edges.map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      source: edge.source || '',
      target: edge.target || '',
      type: edge.type || 'default',
      data: edge.data || {},
    }));
  }, [workflow.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onSaveWorkflow = useCallback(() => {
    console.log('Saving workflow:', { nodes, edges });
    onSave();
  }, [nodes, edges, onSave]);

  const addNewNode = useCallback((type: string) => {
    const newNode: Node = {
      id: `node-${nodes.length + 1}`,
      type: 'trigger',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: `New ${type}`,
        type: type,
        description: `A new ${type} node`,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [nodes.length, setNodes]);

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Workflow Selected</h3>
          <p className="text-gray-600">Please select or create a workflow to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <WorkflowToolbar
        onSave={onSaveWorkflow}
        onAddNode={addNewNode}
        workflow={workflow}
      />

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.data?.type) {
                  case 'schedule': return '#10b981';
                  case 'webhook': return '#3b82f6';
                  case 'database': return '#8b5cf6';
                  default: return '#6b7280';
                }
              }}
              className="bg-white border border-gray-200"
            />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Status bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>
            {workflow.name} - {nodes.length} nodes, {edges.length} connections
          </div>
          <div className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">
            Simplified Mode - Some features disabled
          </div>
        </div>
      </div>
    </div>
  );
};

export { WorkflowCanvas };