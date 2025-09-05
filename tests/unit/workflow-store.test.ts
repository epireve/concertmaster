/**
 * Unit Tests for WorkflowStore
 * Testing Zustand state management for workflows, nodes, and edges
 */

import { renderHook, act } from '@testing-library/react';
import { useWorkflowStore } from '../../frontend/src/store/workflowStore';
import { Workflow, WorkflowNode, WorkflowEdge } from '../../frontend/src/types/workflow';

// Mock crypto.randomUUID for consistent testing
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-123'),
  },
});

describe('WorkflowStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorkflowStore.getState().setWorkflows([]);
    useWorkflowStore.getState().setActiveWorkflow(null);
    useWorkflowStore.getState().clearError();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      expect(result.current.workflows).toEqual([]);
      expect(result.current.activeWorkflow).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Workflow Management', () => {
    const mockWorkflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Test Workflow',
      description: 'A test workflow',
      nodes: [],
      edges: [],
      status: 'draft',
      isTemplate: false,
    };

    it('should create a new workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      act(() => {
        const newWorkflow = result.current.createWorkflow(mockWorkflow);
        expect(newWorkflow.id).toBe('test-uuid-123');
        expect(newWorkflow.name).toBe('Test Workflow');
        expect(newWorkflow.status).toBe('draft');
        expect(newWorkflow.createdAt).toBeInstanceOf(Date);
        expect(newWorkflow.updatedAt).toBeInstanceOf(Date);
      });
      
      expect(result.current.workflows).toHaveLength(1);
      expect(result.current.activeWorkflow).toBeTruthy();
      expect(result.current.activeWorkflow?.name).toBe('Test Workflow');
    });

    it('should update an existing workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflowId: string;
      
      act(() => {
        const newWorkflow = result.current.createWorkflow(mockWorkflow);
        workflowId = newWorkflow.id;
      });
      
      act(() => {
        result.current.updateWorkflow(workflowId, {
          name: 'Updated Workflow',
          description: 'Updated description',
          status: 'active',
        });
      });
      
      const updatedWorkflow = result.current.workflows.find(w => w.id === workflowId);
      expect(updatedWorkflow?.name).toBe('Updated Workflow');
      expect(updatedWorkflow?.description).toBe('Updated description');
      expect(updatedWorkflow?.status).toBe('active');
      expect(result.current.activeWorkflow?.name).toBe('Updated Workflow');
    });

    it('should delete a workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflowId: string;
      
      act(() => {
        const newWorkflow = result.current.createWorkflow(mockWorkflow);
        workflowId = newWorkflow.id;
      });
      
      expect(result.current.workflows).toHaveLength(1);
      expect(result.current.activeWorkflow).toBeTruthy();
      
      act(() => {
        result.current.deleteWorkflow(workflowId);
      });
      
      expect(result.current.workflows).toHaveLength(0);
      expect(result.current.activeWorkflow).toBeNull();
    });

    it('should set workflows array', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      const workflows: Workflow[] = [
        {
          ...mockWorkflow,
          id: 'workflow-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          ...mockWorkflow,
          id: 'workflow-2',
          name: 'Second Workflow',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      act(() => {
        result.current.setWorkflows(workflows);
      });
      
      expect(result.current.workflows).toHaveLength(2);
      expect(result.current.workflows[0].name).toBe('Test Workflow');
      expect(result.current.workflows[1].name).toBe('Second Workflow');
    });
  });

  describe('Node Management', () => {
    let workflowId: string;
    const mockNode: WorkflowNode = {
      id: 'node-1',
      type: 'trigger',
      position: { x: 100, y: 100 },
      data: {
        label: 'Test Node',
        config: { test: 'value' },
        inputs: ['input1'],
        outputs: ['output1'],
      },
    };

    beforeEach(() => {
      const { result } = renderHook(() => useWorkflowStore());
      act(() => {
        const workflow = result.current.createWorkflow({
          name: 'Test Workflow',
          nodes: [],
          edges: [],
        });
        workflowId = workflow.id;
      });
    });

    it('should add a node to workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      act(() => {
        result.current.addNode(workflowId, mockNode);
      });
      
      const workflow = result.current.workflows.find(w => w.id === workflowId);
      expect(workflow?.nodes).toHaveLength(1);
      expect(workflow?.nodes[0]).toEqual(mockNode);
      expect(result.current.activeWorkflow?.nodes).toHaveLength(1);
    });

    it('should remove a node from workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      act(() => {
        result.current.addNode(workflowId, mockNode);
      });
      
      expect(result.current.workflows.find(w => w.id === workflowId)?.nodes).toHaveLength(1);
      
      act(() => {
        result.current.removeNode(workflowId, 'node-1');
      });
      
      const workflow = result.current.workflows.find(w => w.id === workflowId);
      expect(workflow?.nodes).toHaveLength(0);
    });

    it('should update a node in workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      act(() => {
        result.current.addNode(workflowId, mockNode);
      });
      
      act(() => {
        result.current.updateNode(workflowId, 'node-1', {
          position: { x: 200, y: 200 },
          data: { ...mockNode.data, label: 'Updated Node' },
        });
      });
      
      const workflow = result.current.workflows.find(w => w.id === workflowId);
      const updatedNode = workflow?.nodes.find(n => n.id === 'node-1');
      
      expect(updatedNode?.position).toEqual({ x: 200, y: 200 });
      expect(updatedNode?.data.label).toBe('Updated Node');
    });

    it('should update node configuration', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      act(() => {
        result.current.addNode(workflowId, mockNode);
      });
      
      act(() => {
        result.current.updateNodeConfig(workflowId, 'node-1', {
          newConfig: 'value',
          updatedField: 123,
        });
      });
      
      const workflow = result.current.workflows.find(w => w.id === workflowId);
      const updatedNode = workflow?.nodes.find(n => n.id === 'node-1');
      
      expect(updatedNode?.data.config).toEqual({
        newConfig: 'value',
        updatedField: 123,
      });
    });
  });

  describe('Edge Management', () => {
    let workflowId: string;
    const mockEdge: WorkflowEdge = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'output1',
      targetHandle: 'input1',
      label: 'Test Edge',
    };

    beforeEach(() => {
      const { result } = renderHook(() => useWorkflowStore());
      act(() => {
        const workflow = result.current.createWorkflow({
          name: 'Test Workflow',
          nodes: [],
          edges: [],
        });
        workflowId = workflow.id;
      });
    });

    it('should add an edge to workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      act(() => {
        result.current.addEdge(workflowId, mockEdge);
      });
      
      const workflow = result.current.workflows.find(w => w.id === workflowId);
      expect(workflow?.edges).toHaveLength(1);
      expect(workflow?.edges[0]).toEqual(mockEdge);
    });

    it('should remove an edge from workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      act(() => {
        result.current.addEdge(workflowId, mockEdge);
      });
      
      expect(result.current.workflows.find(w => w.id === workflowId)?.edges).toHaveLength(1);
      
      act(() => {
        result.current.removeEdge(workflowId, 'edge-1');
      });
      
      const workflow = result.current.workflows.find(w => w.id === workflowId);
      expect(workflow?.edges).toHaveLength(0);
    });

    it('should update an edge in workflow', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      act(() => {
        result.current.addEdge(workflowId, mockEdge);
      });
      
      act(() => {
        result.current.updateEdge(workflowId, 'edge-1', {
          label: 'Updated Edge',
          condition: 'value > 10',
        });
      });
      
      const workflow = result.current.workflows.find(w => w.id === workflowId);
      const updatedEdge = workflow?.edges.find(e => e.id === 'edge-1');
      
      expect(updatedEdge?.label).toBe('Updated Edge');
      expect(updatedEdge?.condition).toBe('value > 10');
    });
  });

  describe('State Management', () => {
    it('should handle loading state', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      expect(result.current.loading).toBe(false);
      
      act(() => {
        result.current.setLoading(true);
      });
      
      expect(result.current.loading).toBe(true);
    });

    it('should handle error state', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      expect(result.current.error).toBeNull();
      
      act(() => {
        result.current.setError('Test error message');
      });
      
      expect(result.current.error).toBe('Test error message');
      
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.error).toBeNull();
    });
  });

  describe('Node-Edge Relationship Management', () => {
    let workflowId: string;

    beforeEach(() => {
      const { result } = renderHook(() => useWorkflowStore());
      act(() => {
        const workflow = result.current.createWorkflow({
          name: 'Test Workflow',
          nodes: [
            {
              id: 'node-1',
              type: 'trigger',
              position: { x: 0, y: 0 },
              data: { label: 'Node 1', config: {} },
            },
            {
              id: 'node-2',
              type: 'transform',
              position: { x: 200, y: 0 },
              data: { label: 'Node 2', config: {} },
            },
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'node-1',
              target: 'node-2',
            },
          ],
        });
        workflowId = workflow.id;
      });
    });

    it('should remove associated edges when removing a node', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      // Verify initial state
      let workflow = result.current.workflows.find(w => w.id === workflowId);
      expect(workflow?.nodes).toHaveLength(2);
      expect(workflow?.edges).toHaveLength(1);
      
      // Remove node-1 which should also remove the edge
      act(() => {
        result.current.removeNode(workflowId, 'node-1');
      });
      
      workflow = result.current.workflows.find(w => w.id === workflowId);
      expect(workflow?.nodes).toHaveLength(1);
      expect(workflow?.edges).toHaveLength(0); // Edge should be removed
    });
  });
});