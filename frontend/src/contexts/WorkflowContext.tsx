/**
 * Workflow Context for managing workflow state
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Workflow, WorkflowNode, WorkflowEdge } from '../types/workflow';

export interface WorkflowState {
  workflow: Workflow | null;
  isLoading: boolean;
  isDirty: boolean;
  selectedNode: WorkflowNode | null;
  selectedEdge: WorkflowEdge | null;
  isExecuting: boolean;
  validationErrors: string[];
}

export type WorkflowAction =
  | { type: 'SET_WORKFLOW'; payload: Workflow }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SELECT_NODE'; payload: WorkflowNode | null }
  | { type: 'SELECT_EDGE'; payload: WorkflowEdge | null }
  | { type: 'SET_EXECUTING'; payload: boolean }
  | { type: 'SET_VALIDATION_ERRORS'; payload: string[] }
  | { type: 'ADD_NODE'; payload: WorkflowNode }
  | { type: 'UPDATE_NODE'; payload: { id: string; updates: Partial<WorkflowNode> } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'ADD_EDGE'; payload: WorkflowEdge }
  | { type: 'UPDATE_EDGE'; payload: { id: string; updates: Partial<WorkflowEdge> } }
  | { type: 'DELETE_EDGE'; payload: string }
  | { type: 'RESET_WORKFLOW' };

const initialState: WorkflowState = {
  workflow: null,
  isLoading: false,
  isDirty: false,
  selectedNode: null,
  selectedEdge: null,
  isExecuting: false,
  validationErrors: [],
};

function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'SET_WORKFLOW':
      return {
        ...state,
        workflow: action.payload,
        isDirty: false,
        selectedNode: null,
        selectedEdge: null,
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_DIRTY':
      return { ...state, isDirty: action.payload };

    case 'SELECT_NODE':
      return { 
        ...state, 
        selectedNode: action.payload,
        selectedEdge: null 
      };

    case 'SELECT_EDGE':
      return { 
        ...state, 
        selectedEdge: action.payload,
        selectedNode: null 
      };

    case 'SET_EXECUTING':
      return { ...state, isExecuting: action.payload };

    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.payload };

    case 'ADD_NODE':
      if (!state.workflow) return state;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes: [...state.workflow.nodes, action.payload],
        },
        isDirty: true,
      };

    case 'UPDATE_NODE':
      if (!state.workflow) return state;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes: state.workflow.nodes.map(node =>
            node.id === action.payload.id 
              ? { ...node, ...action.payload.updates }
              : node
          ),
        },
        isDirty: true,
      };

    case 'DELETE_NODE':
      if (!state.workflow) return state;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes: state.workflow.nodes.filter(node => node.id !== action.payload),
          edges: state.workflow.edges.filter(edge => 
            edge.source !== action.payload && edge.target !== action.payload
          ),
        },
        selectedNode: state.selectedNode?.id === action.payload ? null : state.selectedNode,
        isDirty: true,
      };

    case 'ADD_EDGE':
      if (!state.workflow) return state;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          edges: [...state.workflow.edges, action.payload],
        },
        isDirty: true,
      };

    case 'UPDATE_EDGE':
      if (!state.workflow) return state;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          edges: state.workflow.edges.map(edge =>
            edge.id === action.payload.id 
              ? { ...edge, ...action.payload.updates }
              : edge
          ),
        },
        isDirty: true,
      };

    case 'DELETE_EDGE':
      if (!state.workflow) return state;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          edges: state.workflow.edges.filter(edge => edge.id !== action.payload),
        },
        selectedEdge: state.selectedEdge?.id === action.payload ? null : state.selectedEdge,
        isDirty: true,
      };

    case 'RESET_WORKFLOW':
      return initialState;

    default:
      return state;
  }
}

interface WorkflowContextType {
  state: WorkflowState;
  dispatch: React.Dispatch<WorkflowAction>;
  
  // Convenience methods
  setWorkflow: (workflow: Workflow) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, updates: Partial<WorkflowNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  updateEdge: (id: string, updates: Partial<WorkflowEdge>) => void;
  deleteEdge: (id: string) => void;
  selectNode: (node: WorkflowNode | null) => void;
  selectEdge: (edge: WorkflowEdge | null) => void;
  validateWorkflow: () => boolean;
  saveWorkflow: () => Promise<void>;
  executeWorkflow: () => Promise<void>;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

interface WorkflowProviderProps {
  children: ReactNode;
}

export const WorkflowProvider: React.FC<WorkflowProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(workflowReducer, initialState);

  // Convenience methods
  const setWorkflow = (workflow: Workflow) => {
    dispatch({ type: 'SET_WORKFLOW', payload: workflow });
  };

  const addNode = (node: WorkflowNode) => {
    dispatch({ type: 'ADD_NODE', payload: node });
  };

  const updateNode = (id: string, updates: Partial<WorkflowNode>) => {
    dispatch({ type: 'UPDATE_NODE', payload: { id, updates } });
  };

  const deleteNode = (id: string) => {
    dispatch({ type: 'DELETE_NODE', payload: id });
  };

  const addEdge = (edge: WorkflowEdge) => {
    dispatch({ type: 'ADD_EDGE', payload: edge });
  };

  const updateEdge = (id: string, updates: Partial<WorkflowEdge>) => {
    dispatch({ type: 'UPDATE_EDGE', payload: { id, updates } });
  };

  const deleteEdge = (id: string) => {
    dispatch({ type: 'DELETE_EDGE', payload: id });
  };

  const selectNode = (node: WorkflowNode | null) => {
    dispatch({ type: 'SELECT_NODE', payload: node });
  };

  const selectEdge = (edge: WorkflowEdge | null) => {
    dispatch({ type: 'SELECT_EDGE', payload: edge });
  };

  const validateWorkflow = (): boolean => {
    // Basic validation logic
    if (!state.workflow) return false;
    
    const errors: string[] = [];
    
    // Check for orphaned nodes
    const connectedNodes = new Set<string>();
    state.workflow.edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });
    
    const orphanedNodes = state.workflow.nodes.filter(
      node => !connectedNodes.has(node.id) && node.type !== 'trigger'
    );
    
    if (orphanedNodes.length > 0) {
      errors.push(`${orphanedNodes.length} orphaned nodes found`);
    }
    
    dispatch({ type: 'SET_VALIDATION_ERRORS', payload: errors });
    return errors.length === 0;
  };

  const saveWorkflow = async (): Promise<void> => {
    if (!state.workflow) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // Mock save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      dispatch({ type: 'SET_DIRTY', payload: false });
    } catch (error) {
      console.error('Failed to save workflow:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const executeWorkflow = async (): Promise<void> => {
    if (!state.workflow) return;
    
    dispatch({ type: 'SET_EXECUTING', payload: true });
    try {
      // Mock execution
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_EXECUTING', payload: false });
    }
  };

  const value: WorkflowContextType = {
    state,
    dispatch,
    setWorkflow,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
    selectNode,
    selectEdge,
    validateWorkflow,
    saveWorkflow,
    executeWorkflow,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = (): WorkflowContextType => {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};