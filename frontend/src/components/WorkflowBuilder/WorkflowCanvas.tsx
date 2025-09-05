/**
 * ConcertMaster Workflow Canvas
 * React Flow based visual workflow builder
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  ReactFlowInstance,
  NodeTypes,
  EdgeTypes,
  Panel,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Custom Node Types
import TriggerNode from './Nodes/TriggerNode';
import TransformNode from './Nodes/TransformNode';
import ActionNode from './Nodes/ActionNode';
import ConditionNode from './Nodes/ConditionNode';
import CustomEdge from './Edges/CustomEdge';

// Components
import NodePalette from './NodePalette';
import NodeInspector from './NodeInspector';
import WorkflowToolbar from './WorkflowToolbar';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { useTheme } from '../../contexts/ThemeContext';

// Types
import { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '../../types/workflow';
import { NodeConfig } from '../../types/nodes';

// Utils
import { validateWorkflow } from '../../utils/workflowValidation';
import { generateNodeId } from '../../utils/nodeUtils';

// Custom node types mapping
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  transform: TransformNode,
  action: ActionNode,
  condition: ConditionNode,
};

// Custom edge types mapping
const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

interface WorkflowCanvasProps {
  workflowId?: string;
  isReadonly?: boolean;
  onSave?: (definition: WorkflowDefinition) => void;
  onValidationChange?: (errors: string[]) => void;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflowId,
  isReadonly = false,
  onSave,
  onValidationChange,
}) => {
  const { theme } = useTheme();
  const { workflow, updateWorkflow } = useWorkflow();
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Load workflow data on mount
  useEffect(() => {
    if (workflow?.definition) {
      setNodes(workflow.definition.nodes || []);
      setEdges(workflow.definition.edges || []);
    }
  }, [workflow, setNodes, setEdges]);

  // Validate workflow when nodes or edges change
  useEffect(() => {
    const validateCurrentWorkflow = async () => {
      setIsValidating(true);
      try {
        const definition: WorkflowDefinition = { nodes, edges };
        const errors = await validateWorkflow(definition);
        setValidationErrors(errors);
        onValidationChange?.(errors);
      } catch (error) {
        console.error('Workflow validation error:', error);
        setValidationErrors(['Validation failed']);
      } finally {
        setIsValidating(false);
      }
    };

    if (nodes.length > 0) {
      validateCurrentWorkflow();
    }
  }, [nodes, edges, onValidationChange]);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      if (isReadonly) return;
      
      const newEdge: WorkflowEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: 'custom',
        animated: true,
      } as WorkflowEdge;
      
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, isReadonly]
  );

  // Handle drag and drop from node palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance || isReadonly) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const nodeConfig = JSON.parse(event.dataTransfer.getData('node-config')) as NodeConfig;

      if (!type || !nodeConfig) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: WorkflowNode = {
        id: generateNodeId(type),
        type: type as any,
        position,
        data: {
          label: nodeConfig.displayName,
          config: nodeConfig.defaultConfig || {},
          schema: nodeConfig.schema,
          category: nodeConfig.category,
          description: nodeConfig.description,
          icon: nodeConfig.icon,
          color: nodeConfig.color,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, isReadonly]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node as WorkflowNode);
    },
    []
  );

  // Handle node configuration update
  const onNodeConfigUpdate = useCallback(
    (nodeId: string, config: any) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, config } }
            : node
        )
      );
    },
    [setNodes]
  );

  // Handle node deletion
  const onNodeDelete = useCallback(
    (nodeId: string) => {
      if (isReadonly) return;
      
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [setNodes, setEdges, selectedNode, isReadonly]
  );

  // Handle edge deletion
  const onEdgeDelete = useCallback(
    (edgeId: string) => {
      if (isReadonly) return;
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    },
    [setEdges, isReadonly]
  );

  // Save workflow
  const handleSave = useCallback(async () => {
    if (validationErrors.length > 0) {
      alert('Please fix validation errors before saving');
      return;
    }

    const definition: WorkflowDefinition = { nodes, edges };
    
    try {
      if (onSave) {
        await onSave(definition);
      } else if (workflowId) {
        await updateWorkflow(workflowId, { definition });
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
    }
  }, [nodes, edges, validationErrors, onSave, workflowId, updateWorkflow]);

  // Auto-save functionality
  useEffect(() => {
    if (isReadonly || !workflowId) return;

    const autoSaveTimer = setTimeout(() => {
      if (nodes.length > 0 && validationErrors.length === 0) {
        handleSave();
      }
    }, 5000); // Auto-save every 5 seconds

    return () => clearTimeout(autoSaveTimer);
  }, [nodes, edges, validationErrors, handleSave, isReadonly, workflowId]);

  // Clear selection when clicking on empty area
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const proOptions = {
    hideAttribution: true,
  };

  return (
    <div className="workflow-canvas h-full flex">
      {/* Node Palette */}
      {!isReadonly && (
        <NodePalette onNodeDragStart={(nodeConfig) => {
          // Store node config for drop handler
        }} />
      )}

      {/* Main Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          attributionPosition="bottom-left"
          proOptions={proOptions}
          className={`${theme === 'dark' ? 'dark' : ''}`}
        >
          {/* Background */}
          <Background
            color={theme === 'dark' ? '#374151' : '#e5e7eb'}
            gap={20}
            size={1}
          />
          
          {/* Controls */}
          <Controls />
          
          {/* MiniMap */}
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'trigger': return '#10B981';
                case 'transform': return '#3B82F6';
                case 'action': return '#F59E0B';
                case 'condition': return '#EF4444';
                default: return '#6B7280';
              }
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />

          {/* Toolbar Panel */}
          <Panel position="top-center">
            <WorkflowToolbar
              onSave={handleSave}
              onValidate={() => {
                const definition: WorkflowDefinition = { nodes, edges };
                validateWorkflow(definition);
              }}
              validationErrors={validationErrors}
              isValidating={isValidating}
              isReadonly={isReadonly}
            />
          </Panel>

          {/* Status Panel */}
          <Panel position="bottom-right">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 text-sm">
              <div className="flex items-center space-x-4">
                <span>Nodes: {nodes.length}</span>
                <span>Connections: {edges.length}</span>
                {validationErrors.length > 0 && (
                  <span className="text-red-500">
                    Errors: {validationErrors.length}
                  </span>
                )}
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Inspector */}
      {selectedNode && !isReadonly && (
        <NodeInspector
          node={selectedNode}
          onConfigUpdate={onNodeConfigUpdate}
          onDelete={() => onNodeDelete(selectedNode.id)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};

// Wrapper component with ReactFlowProvider
const WorkflowCanvasWrapper: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvasWrapper;