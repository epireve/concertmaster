/**
 * Workflow validation utilities
 */

import { Workflow, WorkflowNode, WorkflowEdge } from '../types/workflow';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning extends Omit<ValidationError, 'severity'> {
  severity: 'warning';
}

export function validateWorkflow(workflow: Workflow): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!workflow) {
    errors.push({
      code: 'WORKFLOW_MISSING',
      message: 'Workflow is required',
      severity: 'error',
    });
    return { isValid: false, errors, warnings: [] };
  }

  // Validate workflow structure
  if (!workflow.name || workflow.name.trim().length === 0) {
    errors.push({
      code: 'WORKFLOW_NAME_MISSING',
      message: 'Workflow name is required',
      severity: 'error',
    });
  }

  if (!workflow.nodes || workflow.nodes.length === 0) {
    errors.push({
      code: 'NO_NODES',
      message: 'Workflow must contain at least one node',
      severity: 'error',
    });
    return { isValid: false, errors, warnings: [] };
  }

  // Validate nodes
  const nodeIds = new Set<string>();
  const triggerNodes = workflow.nodes.filter(node => node.type === 'trigger');
  
  if (triggerNodes.length === 0) {
    errors.push({
      code: 'NO_TRIGGER',
      message: 'Workflow must have at least one trigger node',
      severity: 'error',
    });
  }

  if (triggerNodes.length > 1) {
    warnings.push({
      code: 'MULTIPLE_TRIGGERS',
      message: 'Multiple trigger nodes detected. Only the first one will be executed.',
      severity: 'warning',
    });
  }

  workflow.nodes.forEach(node => {
    // Check for duplicate IDs
    if (nodeIds.has(node.id)) {
      errors.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID: ${node.id}`,
        nodeId: node.id,
        severity: 'error',
      });
    }
    nodeIds.add(node.id);

    // Validate node structure
    if (!node.id || node.id.trim().length === 0) {
      errors.push({
        code: 'NODE_ID_MISSING',
        message: 'Node ID is required',
        nodeId: node.id,
        severity: 'error',
      });
    }

    if (!node.type || node.type.trim().length === 0) {
      errors.push({
        code: 'NODE_TYPE_MISSING',
        message: 'Node type is required',
        nodeId: node.id,
        severity: 'error',
      });
    }

    if (!node.data?.label || node.data.label.trim().length === 0) {
      warnings.push({
        code: 'NODE_LABEL_MISSING',
        message: 'Node label is missing or empty',
        nodeId: node.id,
        severity: 'warning',
      });
    }

    // Validate node position
    if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
      errors.push({
        code: 'INVALID_NODE_POSITION',
        message: 'Node position must contain valid x and y coordinates',
        nodeId: node.id,
        severity: 'error',
      });
    }

    // Node-specific validations
    validateNodeByType(node, errors, warnings);
  });

  // Validate edges
  if (workflow.edges) {
    const edgeIds = new Set<string>();
    
    workflow.edges.forEach(edge => {
      // Check for duplicate edge IDs
      if (edgeIds.has(edge.id)) {
        errors.push({
          code: 'DUPLICATE_EDGE_ID',
          message: `Duplicate edge ID: ${edge.id}`,
          edgeId: edge.id,
          severity: 'error',
        });
      }
      edgeIds.add(edge.id);

      // Validate edge references
      if (!nodeIds.has(edge.source)) {
        errors.push({
          code: 'INVALID_EDGE_SOURCE',
          message: `Edge source node '${edge.source}' does not exist`,
          edgeId: edge.id,
          severity: 'error',
        });
      }

      if (!nodeIds.has(edge.target)) {
        errors.push({
          code: 'INVALID_EDGE_TARGET',
          message: `Edge target node '${edge.target}' does not exist`,
          edgeId: edge.id,
          severity: 'error',
        });
      }

      // Check for self-loops
      if (edge.source === edge.target) {
        warnings.push({
          code: 'SELF_LOOP',
          message: `Self-loop detected in edge '${edge.id}'`,
          edgeId: edge.id,
          severity: 'warning',
        });
      }
    });

    // Check for cycles
    const cycles = detectCycles(workflow.nodes, workflow.edges);
    cycles.forEach(cycle => {
      warnings.push({
        code: 'CYCLE_DETECTED',
        message: `Cycle detected: ${cycle.join(' → ')}`,
        severity: 'warning',
      });
    });

    // Check for orphaned nodes (excluding triggers)
    const connectedNodes = new Set<string>();
    workflow.edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const orphanedNodes = workflow.nodes.filter(
      node => !connectedNodes.has(node.id) && node.type !== 'trigger'
    );

    orphanedNodes.forEach(node => {
      warnings.push({
        code: 'ORPHANED_NODE',
        message: `Node '${node.data?.label || node.id}' is not connected to any other nodes`,
        nodeId: node.id,
        severity: 'warning',
      });
    });
  }

  const isValid = errors.length === 0;
  return { isValid, errors, warnings };
}

function validateNodeByType(
  node: WorkflowNode, 
  errors: ValidationError[], 
  warnings: ValidationWarning[]
): void {
  switch (node.type) {
    case 'trigger':
      validateTriggerNode(node, errors, warnings);
      break;
    case 'collection':
      validateCollectionNode(node, errors, warnings);
      break;
    case 'transform':
      validateTransformNode(node, errors, warnings);
      break;
    case 'logic':
      validateLogicNode(node, errors, warnings);
      break;
    case 'output':
      validateOutputNode(node, errors, warnings);
      break;
    default:
      warnings.push({
        code: 'UNKNOWN_NODE_TYPE',
        message: `Unknown node type: ${node.type}`,
        nodeId: node.id,
        severity: 'warning',
      });
  }
}

function validateTriggerNode(
  node: WorkflowNode, 
  errors: ValidationError[], 
  warnings: ValidationWarning[]
): void {
  const config = node.data?.config;
  if (!config) {
    errors.push({
      code: 'TRIGGER_CONFIG_MISSING',
      message: 'Trigger node configuration is required',
      nodeId: node.id,
      severity: 'error',
    });
  }
}

function validateCollectionNode(
  node: WorkflowNode, 
  errors: ValidationError[], 
  warnings: ValidationWarning[]
): void {
  // Collection node specific validation
  const config = node.data?.config;
  if (!config) {
    errors.push({
      code: 'COLLECTION_CONFIG_MISSING',
      message: 'Collection node configuration is required',
      nodeId: node.id,
      severity: 'error',
    });
  }
}

function validateTransformNode(
  node: WorkflowNode, 
  errors: ValidationError[], 
  warnings: ValidationWarning[]
): void {
  // Transform node specific validation
  const config = node.data?.config;
  if (!config) {
    errors.push({
      code: 'TRANSFORM_CONFIG_MISSING',
      message: 'Transform node configuration is required',
      nodeId: node.id,
      severity: 'error',
    });
  }
}

function validateLogicNode(
  node: WorkflowNode, 
  errors: ValidationError[], 
  warnings: ValidationWarning[]
): void {
  // Logic node specific validation
  const config = node.data?.config;
  if (!config) {
    errors.push({
      code: 'LOGIC_CONFIG_MISSING',
      message: 'Logic node configuration is required',
      nodeId: node.id,
      severity: 'error',
    });
  }
}

function validateOutputNode(
  node: WorkflowNode, 
  errors: ValidationError[], 
  warnings: ValidationWarning[]
): void {
  // Output node specific validation
  const config = node.data?.config;
  if (!config) {
    errors.push({
      code: 'OUTPUT_CONFIG_MISSING',
      message: 'Output node configuration is required',
      nodeId: node.id,
      severity: 'error',
    });
  }
}

function detectCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach(node => {
    adjacencyList.set(node.id, []);
  });
  edges.forEach(edge => {
    const targets = adjacencyList.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyList.set(edge.source, targets);
  });

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart).concat([neighbor]);
        cycles.push(cycle);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return false;
  }

  // Check each node
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });

  return cycles;
}