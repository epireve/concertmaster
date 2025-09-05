import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Workflow, WorkflowNode, WorkflowEdge } from '../../types/workflow';
import { NodePanel } from './NodePanel';
import { WorkflowToolbar } from './WorkflowToolbar';
import { customNodeTypes } from './nodes';
import { useWorkflowStore } from '../../store/workflowStore';

interface WorkflowCanvasProps {
  workflow?: Workflow;
  onSave?: (workflow: Workflow) => void;
  readonly?: boolean;
}

const WorkflowCanvasInner: React.FC<WorkflowCanvasProps> = ({
  workflow,
  onSave,
  readonly = false,
}) => {
  const { fitView } = useReactFlow();
  const { updateWorkflow, addNode, removeNode, updateNodeConfig } = useWorkflowStore();

  // Convert workflow data to React Flow format
  const initialNodes = useMemo(() => {
    return workflow?.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      deletable: !readonly,
      draggable: !readonly,
    })) || [];
  }, [workflow?.nodes, readonly]);

  const initialEdges = useMemo(() => {
    return workflow?.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
      deletable: !readonly,
      data: { condition: edge.condition },
    })) || [];
  }, [workflow?.edges, readonly]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Handle node connection
  const onConnect = useCallback(
    (params: Connection) => {
      if (readonly) return;
      
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `${params.source}-${params.target}`,
            animated: true,
          },
          eds
        )
      );
    },
    [setEdges, readonly]
  );

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (readonly) return;
    setSelectedNode(node);
  }, [readonly]);

  // Handle node drag end - update positions
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (readonly || !workflow) return;
      
      updateWorkflow(workflow.id, {
        nodes: workflow.nodes.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n
        ),
      });
    },
    [workflow, updateWorkflow, readonly]
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (readonly || !workflow) return;
      
      deletedNodes.forEach((node) => {
        removeNode(workflow.id, node.id);
      });
    },
    [workflow, removeNode, readonly]
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (readonly || !workflow) return;
      
      const updatedEdges = workflow.edges.filter(
        (edge) => !deletedEdges.some((deleted) => deleted.id === edge.id)
      );
      
      updateWorkflow(workflow.id, { edges: updatedEdges });
    },
    [workflow, updateWorkflow, readonly]
  );

  // Handle node drop from palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (readonly || !workflow) return;

      const nodeType = event.dataTransfer.getData('application/reactflow');
      const position = {
        x: event.clientX - 250, // Adjust for panel width
        y: event.clientY - 40,  // Adjust for toolbar height
      };

      const newNode: WorkflowNode = {
        id: `${nodeType}_${Date.now()}`,
        type: nodeType,
        position,
        data: {
          label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
          config: {},
        },
      };

      addNode(workflow.id, newNode);
    },
    [workflow, addNode, readonly]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Save workflow
  const handleSave = useCallback(() => {
    if (!workflow || readonly) return;
    
    const updatedWorkflow: Workflow = {
      ...workflow,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type!,
        position: node.position,
        data: node.data,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        condition: edge.data?.condition,
        label: edge.label as string,
      })),
      updatedAt: new Date(),
    };

    onSave?.(updatedWorkflow);
    updateWorkflow(workflow.id, updatedWorkflow);
  }, [workflow, nodes, edges, onSave, updateWorkflow, readonly]);

  // Auto-fit view on initial load
  React.useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView(), 100);
    }
  }, [fitView, nodes.length]);

  return (
    <div className="h-full flex">
      {!readonly && (
        <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <NodePanel />
        </div>
      )}
      
      <div className="flex-1 relative">
        {!readonly && (
          <WorkflowToolbar
            onSave={handleSave}
            onFitView={() => fitView()}
            hasChanges={false} // TODO: Implement dirty state tracking
            selectedNode={selectedNode}
            onNodeConfigChange={(config) => {
              if (selectedNode && workflow) {
                updateNodeConfig(workflow.id, selectedNode.id, config);
              }
            }}
          />
        )}
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={customNodeTypes}
          className="workflow-canvas"
          fitView
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'trigger': return '#10b981';
                case 'collection': return '#3b82f6';
                case 'transform': return '#f59e0b';
                case 'logic': return '#8b5cf6';
                case 'output': return '#ef4444';
                default: return '#6b7280';
              }
            }}
            className="bg-white border border-gray-200 rounded-lg"
          />
          
          {/* Empty state */}
          {nodes.length === 0 && !readonly && (
            <Panel position="center">
              <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Start building your workflow
                </h3>
                <p className="text-gray-600 mb-4">
                  Drag and drop nodes from the left panel to create your data collection workflow.
                </p>
                <button
                  onClick={() => fitView()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Center View
                </button>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
};

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
};