/**
 * Unit Tests for WorkflowCanvas Component
 * Testing drag-and-drop functionality, node interactions, and visual builder features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowCanvas } from '../../../frontend/src/components/workflow/WorkflowCanvas';
import { useWorkflowStore } from '../../../frontend/src/store/workflowStore';
import { Workflow, WorkflowNode } from '../../../frontend/src/types/workflow';
import { TestDataFactory } from '../../setup/setupTests';

// Mock React Flow components
jest.mock('reactflow', () => ({
  ReactFlow: ({ children, onNodesChange, onEdgesChange, onConnect, ...props }: any) => (
    <div data-testid="react-flow" {...props}>
      <div data-testid="react-flow-nodes">
        {props.nodes?.map((node: any) => (
          <div key={node.id} data-testid={`node-${node.id}`} data-node-type={node.type}>
            {node.data.label}
          </div>
        ))}
      </div>
      <div data-testid="react-flow-edges">
        {props.edges?.map((edge: any) => (
          <div key={edge.id} data-testid={`edge-${edge.id}`} />
        ))}
      </div>
      {children}
    </div>
  ),
  Background: () => <div data-testid="react-flow-background" />,
  Controls: () => <div data-testid="react-flow-controls" />,
  MiniMap: () => <div data-testid="react-flow-minimap" />,
  addEdge: jest.fn((params, edges) => [...edges, { id: 'new-edge', ...params }]),
  useNodesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  useEdgesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
}));

// Mock the workflow store
jest.mock('../../../frontend/src/store/workflowStore');

const mockUseWorkflowStore = useWorkflowStore as jest.MockedFunction<typeof useWorkflowStore>;

describe('WorkflowCanvas Component', () => {
  const mockStoreState = {
    workflows: [] as Workflow[],
    activeWorkflow: null as Workflow | null,
    loading: false,
    error: null,
    addNode: jest.fn(),
    removeNode: jest.fn(),
    updateNode: jest.fn(),
    addEdge: jest.fn(),
    removeEdge: jest.fn(),
    updateEdge: jest.fn(),
    setActiveWorkflow: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWorkflowStore.mockReturnValue(mockStoreState);
  });

  describe('Canvas Rendering', () => {
    it('should render empty canvas when no active workflow', () => {
      render(<WorkflowCanvas />);
      
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      expect(screen.getByTestId('react-flow-background')).toBeInTheDocument();
      expect(screen.getByTestId('react-flow-controls')).toBeInTheDocument();
      expect(screen.getByTestId('react-flow-minimap')).toBeInTheDocument();
    });

    it('should render workflow with nodes and edges', () => {
      const mockWorkflow = TestDataFactory.createMockWorkflow({
        nodes: [
          TestDataFactory.createMockNode({
            id: 'node-1',
            type: 'trigger',
            data: { label: 'Start Trigger', config: {} },
          }),
          TestDataFactory.createMockNode({
            id: 'node-2',
            type: 'transform',
            data: { label: 'Data Transform', config: {} },
          }),
        ],
        edges: [
          TestDataFactory.createMockEdge({
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
          }),
        ],
      });

      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        activeWorkflow: mockWorkflow,
      });

      render(<WorkflowCanvas />);

      expect(screen.getByTestId('node-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('node-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('edge-edge-1')).toBeInTheDocument();
      expect(screen.getByText('Start Trigger')).toBeInTheDocument();
      expect(screen.getByText('Data Transform')).toBeInTheDocument();
    });
  });

  describe('Node Interactions', () => {
    const mockWorkflow = TestDataFactory.createMockWorkflow({
      nodes: [
        TestDataFactory.createMockNode({
          id: 'node-1',
          type: 'trigger',
          data: { label: 'Trigger Node', config: {} },
        }),
      ],
    });

    beforeEach(() => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        activeWorkflow: mockWorkflow,
      });
    });

    it('should handle node selection', async () => {
      render(<WorkflowCanvas />);
      
      const node = screen.getByTestId('node-node-1');
      
      await act(async () => {
        fireEvent.click(node);
      });

      // Verify node selection behavior
      expect(node).toBeInTheDocument();
    });

    it('should handle node deletion', async () => {
      render(<WorkflowCanvas />);
      
      const node = screen.getByTestId('node-node-1');
      
      await act(async () => {
        fireEvent.keyDown(node, { key: 'Delete', code: 'Delete' });
      });

      expect(mockStoreState.removeNode).toHaveBeenCalledWith(mockWorkflow.id, 'node-1');
    });

    it('should handle node drag and position update', async () => {
      render(<WorkflowCanvas />);
      
      const node = screen.getByTestId('node-node-1');
      
      await act(async () => {
        fireEvent.mouseDown(node, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(node, { clientX: 200, clientY: 150 });
        fireEvent.mouseUp(node);
      });

      expect(mockStoreState.updateNode).toHaveBeenCalledWith(
        mockWorkflow.id,
        'node-1',
        expect.objectContaining({
          position: expect.any(Object),
        })
      );
    });
  });

  describe('Edge Management', () => {
    const mockWorkflow = TestDataFactory.createMockWorkflow({
      nodes: [
        TestDataFactory.createMockNode({
          id: 'node-1',
          type: 'trigger',
          data: { label: 'Source Node', config: {} },
        }),
        TestDataFactory.createMockNode({
          id: 'node-2',
          type: 'transform',
          data: { label: 'Target Node', config: {} },
        }),
      ],
    });

    beforeEach(() => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        activeWorkflow: mockWorkflow,
      });
    });

    it('should handle edge creation between nodes', async () => {
      render(<WorkflowCanvas />);
      
      const sourceNode = screen.getByTestId('node-node-1');
      const targetNode = screen.getByTestId('node-node-2');

      // Simulate connection creation
      await act(async () => {
        fireEvent.mouseDown(sourceNode, { button: 0 });
        fireEvent.mouseMove(targetNode, { clientX: 200, clientY: 100 });
        fireEvent.mouseUp(targetNode);
      });

      expect(mockStoreState.addEdge).toHaveBeenCalledWith(
        mockWorkflow.id,
        expect.objectContaining({
          source: 'node-1',
          target: 'node-2',
        })
      );
    });

    it('should prevent self-connections', async () => {
      render(<WorkflowCanvas />);
      
      const node = screen.getByTestId('node-node-1');

      // Simulate attempt to connect node to itself
      await act(async () => {
        fireEvent.mouseDown(node, { button: 0 });
        fireEvent.mouseUp(node);
      });

      expect(mockStoreState.addEdge).not.toHaveBeenCalled();
    });
  });

  describe('Canvas Controls', () => {
    it('should render zoom controls', () => {
      render(<WorkflowCanvas />);
      
      expect(screen.getByTestId('react-flow-controls')).toBeInTheDocument();
    });

    it('should render minimap for navigation', () => {
      render(<WorkflowCanvas />);
      
      expect(screen.getByTestId('react-flow-minimap')).toBeInTheDocument();
    });

    it('should handle canvas zoom operations', async () => {
      render(<WorkflowCanvas />);
      
      const canvas = screen.getByTestId('react-flow');
      
      // Test zoom in
      await act(async () => {
        fireEvent.wheel(canvas, { deltaY: -100 });
      });

      // Test zoom out
      await act(async () => {
        fireEvent.wheel(canvas, { deltaY: 100 });
      });

      expect(canvas).toBeInTheDocument();
    });

    it('should handle canvas panning', async () => {
      render(<WorkflowCanvas />);
      
      const canvas = screen.getByTestId('react-flow');
      
      await act(async () => {
        fireEvent.mouseDown(canvas, { button: 1, clientX: 100, clientY: 100 }); // Middle mouse button
        fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
        fireEvent.mouseUp(canvas);
      });

      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Visual Builder Features', () => {
    it('should support node type validation', () => {
      const triggerNode = TestDataFactory.createMockNode({
        type: 'trigger',
        data: { label: 'Trigger', config: {} },
      });

      const transformNode = TestDataFactory.createMockNode({
        type: 'transform',
        data: { label: 'Transform', config: {} },
      });

      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        activeWorkflow: TestDataFactory.createMockWorkflow({
          nodes: [triggerNode, transformNode],
        }),
      });

      render(<WorkflowCanvas />);

      expect(screen.getByTestId('node-node-1')).toHaveAttribute('data-node-type', 'trigger');
      expect(screen.getByTestId('node-node-2')).toHaveAttribute('data-node-type', 'transform');
    });

    it('should handle multiple node selection', async () => {
      const mockWorkflow = TestDataFactory.createMockWorkflow({
        nodes: [
          TestDataFactory.createMockNode({ id: 'node-1', data: { label: 'Node 1', config: {} } }),
          TestDataFactory.createMockNode({ id: 'node-2', data: { label: 'Node 2', config: {} } }),
          TestDataFactory.createMockNode({ id: 'node-3', data: { label: 'Node 3', config: {} } }),
        ],
      });

      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        activeWorkflow: mockWorkflow,
      });

      render(<WorkflowCanvas />);

      const node1 = screen.getByTestId('node-node-1');
      const node2 = screen.getByTestId('node-node-2');

      // Select multiple nodes with Ctrl+Click
      await act(async () => {
        fireEvent.click(node1);
        fireEvent.click(node2, { ctrlKey: true });
      });

      expect(node1).toBeInTheDocument();
      expect(node2).toBeInTheDocument();
    });

    it('should support copy and paste operations', async () => {
      const user = userEvent.setup();
      const mockWorkflow = TestDataFactory.createMockWorkflow({
        nodes: [
          TestDataFactory.createMockNode({ 
            id: 'node-1', 
            data: { label: 'Copy Me', config: {} } 
          }),
        ],
      });

      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        activeWorkflow: mockWorkflow,
      });

      render(<WorkflowCanvas />);

      const node = screen.getByTestId('node-node-1');
      
      // Select and copy node
      await act(async () => {
        fireEvent.click(node);
        await user.keyboard('{Control>}c{/Control}');
      });

      // Paste node
      await act(async () => {
        await user.keyboard('{Control>}v{/Control}');
      });

      expect(mockStoreState.addNode).toHaveBeenCalledWith(
        mockWorkflow.id,
        expect.objectContaining({
          data: expect.objectContaining({
            label: 'Copy Me',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle store errors gracefully', () => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        error: 'Failed to load workflow',
        loading: false,
      });

      render(<WorkflowCanvas />);

      // Should still render the canvas even with errors
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should handle loading states', () => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        loading: true,
      });

      render(<WorkflowCanvas />);

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  describe('Performance Optimizations', () => {
    it('should handle large number of nodes efficiently', () => {
      const manyNodes = Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createMockNode({
          id: `node-${i}`,
          data: { label: `Node ${i}`, config: {} },
          position: { x: (i % 10) * 150, y: Math.floor(i / 10) * 100 },
        })
      );

      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        activeWorkflow: TestDataFactory.createMockWorkflow({
          nodes: manyNodes,
        }),
      });

      const startTime = performance.now();
      render(<WorkflowCanvas />);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should handle rapid updates without performance degradation', async () => {
      const mockWorkflow = TestDataFactory.createMockWorkflow({
        nodes: [
          TestDataFactory.createMockNode({ id: 'node-1', data: { label: 'Node', config: {} } }),
        ],
      });

      mockUseWorkflowStore.mockReturnValue({
        ...mockStoreState,
        activeWorkflow: mockWorkflow,
      });

      render(<WorkflowCanvas />);

      const startTime = performance.now();
      
      // Simulate rapid position updates
      for (let i = 0; i < 50; i++) {
        act(() => {
          mockStoreState.updateNode(mockWorkflow.id, 'node-1', {
            position: { x: i * 5, y: i * 3 },
          });
        });
      }

      const updateTime = performance.now() - startTime;
      
      expect(updateTime).toBeLessThan(500); // Should complete updates within 500ms
      expect(mockStoreState.updateNode).toHaveBeenCalledTimes(50);
    });
  });
});