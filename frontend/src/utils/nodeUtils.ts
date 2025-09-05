/**
 * Node utility functions for workflow system
 */

import { WorkflowNode } from '../types/workflow';
import { NodeConfig } from '../types/nodes';

/**
 * Generate a unique node ID
 */
export function generateNodeId(prefix: string = 'node'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Create a new workflow node with default values
 */
export function createWorkflowNode(
  type: string,
  position: { x: number; y: number },
  config?: NodeConfig
): WorkflowNode {
  const id = generateNodeId(type);
  
  return {
    id,
    type,
    position,
    data: {
      label: config?.label || `${type.charAt(0).toUpperCase()}${type.slice(1)} Node`,
      config: config?.defaultData || {},
      inputs: config?.inputs || [],
      outputs: config?.outputs || [],
    },
  };
}

/**
 * Validate node configuration
 */
export function validateNode(node: WorkflowNode): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!node.id) {
    errors.push('Node ID is required');
  }

  if (!node.type) {
    errors.push('Node type is required');
  }

  if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push('Node position must contain valid x and y coordinates');
  }

  if (!node.data) {
    errors.push('Node data is required');
  } else {
    if (!node.data.label) {
      errors.push('Node label is required');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get node bounds (bounding box)
 */
export function getNodeBounds(nodes: WorkflowNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(node => {
    const x = node.position.x;
    const y = node.position.y;
    const nodeWidth = 200; // Default node width
    const nodeHeight = 100; // Default node height

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + nodeWidth);
    maxY = Math.max(maxY, y + nodeHeight);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Find nodes by type
 */
export function findNodesByType(nodes: WorkflowNode[], type: string): WorkflowNode[] {
  return nodes.filter(node => node.type === type);
}

/**
 * Find node by ID
 */
export function findNodeById(nodes: WorkflowNode[], id: string): WorkflowNode | undefined {
  return nodes.find(node => node.id === id);
}

/**
 * Get connected nodes (direct neighbors)
 */
export function getConnectedNodes(
  nodeId: string,
  nodes: WorkflowNode[],
  edges: { source: string; target: string }[]
): {
  incoming: WorkflowNode[];
  outgoing: WorkflowNode[];
} {
  const incoming: WorkflowNode[] = [];
  const outgoing: WorkflowNode[] = [];

  edges.forEach(edge => {
    if (edge.target === nodeId) {
      const sourceNode = findNodeById(nodes, edge.source);
      if (sourceNode) {
        incoming.push(sourceNode);
      }
    }
    
    if (edge.source === nodeId) {
      const targetNode = findNodeById(nodes, edge.target);
      if (targetNode) {
        outgoing.push(targetNode);
      }
    }
  });

  return { incoming, outgoing };
}

/**
 * Calculate optimal grid position for new node
 */
export function calculateGridPosition(
  existingNodes: WorkflowNode[],
  gridSize: number = 50
): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: 100, y: 100 };
  }

  const bounds = getNodeBounds(existingNodes);
  const newX = Math.round((bounds.maxX + 100) / gridSize) * gridSize;
  const newY = Math.round(bounds.minY / gridSize) * gridSize;

  return { x: newX, y: newY };
}

/**
 * Snap position to grid
 */
export function snapToGrid(position: { x: number; y: number }, gridSize: number = 25): {
  x: number;
  y: number;
} {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

/**
 * Check if two nodes overlap
 */
export function nodesOverlap(
  node1: WorkflowNode,
  node2: WorkflowNode,
  nodeWidth: number = 200,
  nodeHeight: number = 100,
  padding: number = 20
): boolean {
  const x1 = node1.position.x;
  const y1 = node1.position.y;
  const x2 = node2.position.x;
  const y2 = node2.position.y;

  return !(
    x1 + nodeWidth + padding < x2 ||
    x2 + nodeWidth + padding < x1 ||
    y1 + nodeHeight + padding < y2 ||
    y2 + nodeHeight + padding < y1
  );
}

/**
 * Auto-arrange nodes in a basic layout
 */
export function autoArrangeNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  // Node dimensions for future use
  // const nodeWidth = 200;
  // const nodeHeight = 100;
  const horizontalSpacing = 250;
  const verticalSpacing = 150;
  
  const triggerNodes = findNodesByType(nodes, 'trigger');
  const otherNodes = nodes.filter(node => node.type !== 'trigger');
  
  const arrangedNodes: WorkflowNode[] = [];
  let currentY = 100;
  
  // Place trigger nodes first
  triggerNodes.forEach((node, index) => {
    arrangedNodes.push({
      ...node,
      position: { x: 100, y: currentY + (index * verticalSpacing) }
    });
  });
  
  // Arrange other nodes in rows
  let currentX = 100 + horizontalSpacing;
  const nodesPerRow = Math.ceil(Math.sqrt(otherNodes.length));
  
  otherNodes.forEach((node, index) => {
    const row = Math.floor(index / nodesPerRow);
    const col = index % nodesPerRow;
    
    arrangedNodes.push({
      ...node,
      position: {
        x: currentX + (col * horizontalSpacing),
        y: 100 + (row * verticalSpacing)
      }
    });
  });
  
  return arrangedNodes;
}

/**
 * Deep clone a node
 */
export function cloneNode(node: WorkflowNode): WorkflowNode {
  return JSON.parse(JSON.stringify(node));
}

/**
 * Get node type color mapping
 */
export function getNodeTypeColor(type: string): string {
  const colors: Record<string, string> = {
    trigger: '#22c55e',    // Green
    collection: '#3b82f6', // Blue
    transform: '#f59e0b',  // Amber
    logic: '#8b5cf6',      // Purple
    output: '#ef4444',     // Red
  };
  
  return colors[type] || '#6b7280'; // Gray as default
}

/**
 * Get node type icon
 */
export function getNodeTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    trigger: 'Play',
    collection: 'Database',
    transform: 'Shuffle',
    logic: 'GitBranch',
    output: 'Save',
  };
  
  return icons[type] || 'Box';
}