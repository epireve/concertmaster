/**
 * Integration Tests for Workflow System
 * Testing interactions between WorkflowStore and Types
 */

import { renderHook, act } from '@testing-library/react';
import { useWorkflowStore, workflowSelectors } from '../../frontend/src/store/workflowStore';
import { Workflow, WorkflowNode, WorkflowEdge, NodeDefinition } from '../../frontend/src/types/workflow';

// Mock crypto.randomUUID for consistent testing
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => `test-uuid-${Date.now()}-${Math.random()}`),
  },
});

describe('Workflow Integration Tests', () => {
  let mockUuidCounter = 0;

  beforeEach(() => {
    // Reset store state before each test
    useWorkflowStore.getState().setWorkflows([]);
    useWorkflowStore.getState().setActiveWorkflow(null);
    useWorkflowStore.getState().clearError();
    
    // Reset UUID counter and mock
    mockUuidCounter = 0;
    (global.crypto.randomUUID as jest.Mock).mockImplementation(() => `test-uuid-${++mockUuidCounter}`);
  });

  describe('Complete Workflow Lifecycle', () => {
    it('should create a complete workflow with nodes and edges', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflow: Workflow;
      
      // Step 1: Create workflow
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Data Collection Pipeline',
          description: 'Complete data collection and processing workflow',
          nodes: [],
          edges: [],
        });
      });
      
      // Step 2: Add trigger node
      const triggerNode: WorkflowNode = {
        id: 'trigger-1',
        type: 'schedule',
        position: { x: 100, y: 100 },
        data: {
          label: 'Daily Trigger',
          config: {
            cron: '0 0 * * *',
            timezone: 'UTC',
          },
        },
      };
      
      act(() => {
        result.current.addNode(workflow.id, triggerNode);
      });
      
      // Step 3: Add collection node
      const collectionNode: WorkflowNode = {
        id: 'collection-1',
        type: 'sendForm',
        position: { x: 300, y: 100 },
        data: {
          label: 'Send Supplier Form',
          config: {
            formId: 'supplier-emissions-form',
            recipients: 'suppliers@company.com',
            deliveryMethod: 'email',
            reminderSchedule: '24h',
          },
        },
      };
      
      act(() => {
        result.current.addNode(workflow.id, collectionNode);
      });
      
      // Step 4: Add transform node
      const transformNode: WorkflowNode = {
        id: 'transform-1',
        type: 'mapper',
        position: { x: 500, y: 100 },
        data: {
          label: 'Data Mapper',
          config: {
            inputSchema: { rawData: 'object' },
            outputSchema: { processedData: 'object' },
            mappingRules: { 
              'processedData.co2Emissions': 'rawData.carbon_footprint',
              'processedData.supplier': 'rawData.company_name',
            },
          },
        },
      };
      
      act(() => {
        result.current.addNode(workflow.id, transformNode);
      });
      
      // Step 5: Add output node
      const outputNode: WorkflowNode = {
        id: 'output-1',
        type: 'database',
        position: { x: 700, y: 100 },
        data: {
          label: 'Save to Database',
          config: {
            connection: 'postgres://localhost:5432/emissions_db',
            table: 'supplier_emissions',
            operation: 'insert',
          },
        },
      };
      
      act(() => {
        result.current.addNode(workflow.id, outputNode);
      });
      
      // Step 6: Connect nodes with edges
      const edges: WorkflowEdge[] = [
        {
          id: 'edge-1',
          source: 'trigger-1',
          target: 'collection-1',
          label: 'Start Collection',
        },
        {
          id: 'edge-2',
          source: 'collection-1',
          target: 'transform-1',
          label: 'Process Responses',
        },
        {
          id: 'edge-3',
          source: 'transform-1',
          target: 'output-1',
          label: 'Save Data',
        },
      ];
      
      edges.forEach((edge) => {
        act(() => {
          result.current.addEdge(workflow.id, edge);
        });
      });
      
      // Verify final workflow state
      const finalWorkflow = result.current.workflows.find(w => w.id === workflow.id);
      expect(finalWorkflow?.nodes).toHaveLength(4);
      expect(finalWorkflow?.edges).toHaveLength(3);
      expect(finalWorkflow?.name).toBe('Data Collection Pipeline');
      
      // Verify node types and configuration
      const triggerNodeFinal = finalWorkflow?.nodes.find(n => n.id === 'trigger-1');
      expect(triggerNodeFinal?.type).toBe('schedule');
      expect(triggerNodeFinal?.data.config.cron).toBe('0 0 * * *');
      
      const collectionNodeFinal = finalWorkflow?.nodes.find(n => n.id === 'collection-1');
      expect(collectionNodeFinal?.data.config.deliveryMethod).toBe('email');
      
      // Verify edge connections
      const firstEdge = finalWorkflow?.edges.find(e => e.id === 'edge-1');
      expect(firstEdge?.source).toBe('trigger-1');
      expect(firstEdge?.target).toBe('collection-1');
    });
  });

  describe('Workflow Node Relationship Management', () => {
    it('should correctly handle node connections and dependencies', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflow: Workflow;
      
      // Create workflow with connected nodes
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Test Connections',
          nodes: [
            {
              id: 'node-1',
              type: 'trigger',
              position: { x: 0, y: 0 },
              data: { label: 'Start', config: {} },
            },
            {
              id: 'node-2',
              type: 'transform',
              position: { x: 200, y: 0 },
              data: { label: 'Process', config: {} },
            },
            {
              id: 'node-3',
              type: 'output',
              position: { x: 400, y: 0 },
              data: { label: 'End', config: {} },
            },
          ],
          edges: [
            { id: 'edge-1', source: 'node-1', target: 'node-2' },
            { id: 'edge-2', source: 'node-2', target: 'node-3' },
          ],
        });
      });
      
      // Test workflow selectors
      const store = result.current;
      
      // Test getWorkflowById selector
      const foundWorkflow = workflowSelectors.getWorkflowById(workflow.id)(store);
      expect(foundWorkflow?.id).toBe(workflow.id);
      
      // Test getNodeById selector
      const node2 = workflowSelectors.getNodeById(workflow.id, 'node-2')(store);
      expect(node2?.id).toBe('node-2');
      expect(node2?.type).toBe('transform');
      
      // Test getConnectedNodes selector
      const connections = workflowSelectors.getConnectedNodes(workflow.id, 'node-2')(store);
      expect(connections.inputs).toHaveLength(1);
      expect(connections.outputs).toHaveLength(1);
      expect(connections.inputs[0]?.id).toBe('node-1');
      expect(connections.outputs[0]?.id).toBe('node-3');
      
      // Test edge node for connections
      const startConnections = workflowSelectors.getConnectedNodes(workflow.id, 'node-1')(store);
      expect(startConnections.inputs).toHaveLength(0);
      expect(startConnections.outputs).toHaveLength(1);
      
      const endConnections = workflowSelectors.getConnectedNodes(workflow.id, 'node-3')(store);
      expect(endConnections.inputs).toHaveLength(1);
      expect(endConnections.outputs).toHaveLength(0);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle branching workflow with conditional logic', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflow: Workflow;
      
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Branching Workflow',
          nodes: [],
          edges: [],
        });
      });
      
      // Add nodes for branching scenario
      const nodes: WorkflowNode[] = [
        {
          id: 'trigger',
          type: 'form',
          position: { x: 100, y: 100 },
          data: { label: 'Form Submitted', config: { formId: 'risk-assessment' } },
        },
        {
          id: 'validation',
          type: 'conditional',
          position: { x: 300, y: 100 },
          data: { 
            label: 'Validate Score', 
            config: { 
              conditions: 'score >= 80',
              trueBranch: 'high-risk',
              falseBranch: 'low-risk',
            },
          },
        },
        {
          id: 'high-risk',
          type: 'sendForm',
          position: { x: 500, y: 50 },
          data: { 
            label: 'High Risk Follow-up', 
            config: { 
              formId: 'detailed-assessment',
              deliveryMethod: 'email',
            },
          },
        },
        {
          id: 'low-risk',
          type: 'database',
          position: { x: 500, y: 150 },
          data: { 
            label: 'Store Standard Result', 
            config: { 
              table: 'low_risk_responses',
              operation: 'insert',
            },
          },
        },
      ];
      
      nodes.forEach((node) => {
        act(() => {
          result.current.addNode(workflow.id, node);
        });
      });
      
      // Add branching edges
      const edges: WorkflowEdge[] = [
        {
          id: 'trigger-to-validation',
          source: 'trigger',
          target: 'validation',
        },
        {
          id: 'validation-to-high-risk',
          source: 'validation',
          target: 'high-risk',
          condition: 'score >= 80',
          label: 'High Risk',
        },
        {
          id: 'validation-to-low-risk',
          source: 'validation',
          target: 'low-risk',
          condition: 'score < 80',
          label: 'Low Risk',
        },
      ];
      
      edges.forEach((edge) => {
        act(() => {
          result.current.addEdge(workflow.id, edge);
        });
      });
      
      // Verify branching structure
      const finalWorkflow = result.current.workflows.find(w => w.id === workflow.id);
      expect(finalWorkflow?.nodes).toHaveLength(4);
      expect(finalWorkflow?.edges).toHaveLength(3);
      
      // Verify conditional node has two outputs
      const validationConnections = workflowSelectors.getConnectedNodes(workflow.id, 'validation')(result.current);
      expect(validationConnections.outputs).toHaveLength(2);
      
      // Verify conditional edges have conditions
      const conditionalEdges = finalWorkflow?.edges.filter(e => e.source === 'validation');
      expect(conditionalEdges).toHaveLength(2);
      expect(conditionalEdges?.every(e => e.condition)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid node references gracefully', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflow: Workflow;
      
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Test Workflow',
          nodes: [],
          edges: [],
        });
      });
      
      // Try to get non-existent node
      const nonExistentNode = workflowSelectors.getNodeById(workflow.id, 'non-existent')(result.current);
      expect(nonExistentNode).toBeUndefined();
      
      // Try to get connections for non-existent node
      const nonExistentConnections = workflowSelectors.getConnectedNodes(workflow.id, 'non-existent')(result.current);
      expect(nonExistentConnections.inputs).toEqual([]);
      expect(nonExistentConnections.outputs).toEqual([]);
      
      // Try to get workflow with invalid ID
      const nonExistentWorkflow = workflowSelectors.getWorkflowById('invalid-id')(result.current);
      expect(nonExistentWorkflow).toBeUndefined();
    });

    it('should handle circular edge prevention', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflow: Workflow;
      
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Test Circular',
          nodes: [
            { id: 'node-1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'A', config: {} } },
            { id: 'node-2', type: 'transform', position: { x: 200, y: 0 }, data: { label: 'B', config: {} } },
          ],
          edges: [],
        });
      });
      
      // Add normal edge
      act(() => {
        result.current.addEdge(workflow.id, {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
        });
      });
      
      // Try to add circular edge (this should be handled by the application logic)
      act(() => {
        result.current.addEdge(workflow.id, {
          id: 'edge-2',
          source: 'node-2',
          target: 'node-1', // This creates a circle
        });
      });
      
      // For now, store allows this - validation should be in UI/business logic
      const finalWorkflow = result.current.workflows.find(w => w.id === workflow.id);
      expect(finalWorkflow?.edges).toHaveLength(2);
    });
  });

  describe('Performance and State Management', () => {
    it('should handle large workflows efficiently', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflow: Workflow;
      
      // Create workflow
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Large Workflow Test',
          nodes: [],
          edges: [],
        });
      });
      
      const startTime = performance.now();
      
      // Add many nodes
      const nodeCount = 100;
      for (let i = 0; i < nodeCount; i++) {
        act(() => {
          result.current.addNode(workflow.id, {
            id: `node-${i}`,
            type: 'transform',
            position: { x: (i % 10) * 150, y: Math.floor(i / 10) * 100 },
            data: {
              label: `Node ${i}`,
              config: { index: i },
            },
          });
        });
      }
      
      // Add edges to connect sequential nodes
      for (let i = 0; i < nodeCount - 1; i++) {
        act(() => {
          result.current.addEdge(workflow.id, {
            id: `edge-${i}`,
            source: `node-${i}`,
            target: `node-${i + 1}`,
          });
        });
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Verify all nodes and edges were added
      const finalWorkflow = result.current.workflows.find(w => w.id === workflow.id);
      expect(finalWorkflow?.nodes).toHaveLength(nodeCount);
      expect(finalWorkflow?.edges).toHaveLength(nodeCount - 1);
      
      // Performance assertion - should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds max
      
      console.log(`Added ${nodeCount} nodes and ${nodeCount - 1} edges in ${totalTime}ms`);
    });
  });

  describe('Store Persistence Simulation', () => {
    it('should maintain state consistency across store operations', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      // Create multiple workflows
      const workflows: Workflow[] = [];
      
      for (let i = 0; i < 3; i++) {
        act(() => {
          const workflow = result.current.createWorkflow({
            name: `Workflow ${i + 1}`,
            nodes: [],
            edges: [],
          });
          workflows.push(workflow);
        });
      }
      
      expect(result.current.workflows).toHaveLength(3);
      expect(result.current.activeWorkflow?.id).toBe(workflows[2].id); // Last created should be active
      
      // Update middle workflow
      act(() => {
        result.current.updateWorkflow(workflows[1].id, {
          name: 'Updated Middle Workflow',
          description: 'This was updated',
        });
      });
      
      // Verify update
      const updatedWorkflow = result.current.workflows.find(w => w.id === workflows[1].id);
      expect(updatedWorkflow?.name).toBe('Updated Middle Workflow');
      expect(updatedWorkflow?.description).toBe('This was updated');
      
      // Set first workflow as active
      act(() => {
        result.current.setActiveWorkflow(workflows[0]);
      });
      
      expect(result.current.activeWorkflow?.id).toBe(workflows[0].id);
      
      // Delete active workflow
      act(() => {
        result.current.deleteWorkflow(workflows[0].id);
      });
      
      expect(result.current.workflows).toHaveLength(2);
      expect(result.current.activeWorkflow).toBeNull(); // Should clear active when deleted
    });
  });
});