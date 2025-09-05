/**
 * Performance Tests for Core Engine Components
 * Testing performance benchmarks and stress scenarios
 */

import { renderHook, act } from '@testing-library/react';
import { useWorkflowStore } from '../../frontend/src/store/workflowStore';
import { Workflow, WorkflowNode, WorkflowEdge } from '../../frontend/src/types/workflow';

describe('Workflow Performance Tests', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorkflowStore.getState().setWorkflows([]);
    useWorkflowStore.getState().setActiveWorkflow(null);
    useWorkflowStore.getState().clearError();
    jest.clearAllMocks();
  });

  describe('Store Performance Benchmarks', () => {
    it('should create workflows within performance budget', () => {
      const { result } = renderHook(() => useWorkflowStore());
      const creationTimes: number[] = [];
      
      // Test creating multiple workflows
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        
        act(() => {
          result.current.createWorkflow({
            name: `Performance Test Workflow ${i}`,
            description: `Workflow ${i} for performance testing`,
            nodes: [],
            edges: [],
          });
        });
        
        const endTime = performance.now();
        creationTimes.push(endTime - startTime);
      }
      
      const averageCreationTime = creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length;
      const maxCreationTime = Math.max(...creationTimes);
      
      // Performance assertions
      expect(averageCreationTime).toBeLessThan(10); // 10ms average
      expect(maxCreationTime).toBeLessThan(50); // 50ms max
      expect(result.current.workflows).toHaveLength(100);
      
      console.log(`Workflow Creation - Average: ${averageCreationTime.toFixed(2)}ms, Max: ${maxCreationTime.toFixed(2)}ms`);
    });

    it('should handle large node additions efficiently', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflow: Workflow;
      
      // Create base workflow
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Large Node Performance Test',
          nodes: [],
          edges: [],
        });
      });
      
      const nodeAdditionTimes: number[] = [];
      const nodeCount = 1000;
      
      // Add many nodes and measure performance
      for (let i = 0; i < nodeCount; i++) {
        const startTime = performance.now();
        
        act(() => {
          result.current.addNode(workflow.id, {
            id: `perf-node-${i}`,
            type: 'transform',
            position: { x: (i % 20) * 100, y: Math.floor(i / 20) * 80 },
            data: {
              label: `Performance Node ${i}`,
              config: {
                index: i,
                data: `test-data-${i}`,
                timestamp: Date.now(),
              },
            },
          });
        });
        
        const endTime = performance.now();
        nodeAdditionTimes.push(endTime - startTime);
      }
      
      const averageNodeTime = nodeAdditionTimes.reduce((a, b) => a + b, 0) / nodeAdditionTimes.length;
      const maxNodeTime = Math.max(...nodeAdditionTimes);
      
      // Performance assertions
      expect(averageNodeTime).toBeLessThan(5); // 5ms average per node
      expect(maxNodeTime).toBeLessThan(20); // 20ms max per node
      
      const finalWorkflow = result.current.workflows.find(w => w.id === workflow.id);
      expect(finalWorkflow?.nodes).toHaveLength(nodeCount);
      
      console.log(`Node Addition - Average: ${averageNodeTime.toFixed(2)}ms, Max: ${maxNodeTime.toFixed(2)}ms for ${nodeCount} nodes`);
    });

    it('should handle complex edge operations efficiently', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      let workflow: Workflow;
      
      // Create workflow with pre-existing nodes
      const nodeCount = 500;
      const nodes: WorkflowNode[] = [];
      
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `node-${i}`,
          type: 'transform',
          position: { x: (i % 25) * 80, y: Math.floor(i / 25) * 60 },
          data: {
            label: `Node ${i}`,
            config: { index: i },
          },
        });
      }
      
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Edge Performance Test',
          nodes,
          edges: [],
        });
      });
      
      const edgeAdditionTimes: number[] = [];
      const edgeCount = 250; // Connect every other node
      
      // Add edges between nodes
      for (let i = 0; i < edgeCount; i++) {
        const startTime = performance.now();
        
        act(() => {
          result.current.addEdge(workflow.id, {
            id: `edge-${i}`,
            source: `node-${i}`,
            target: `node-${i + 1}`,
            label: `Connection ${i}`,
          });
        });
        
        const endTime = performance.now();
        edgeAdditionTimes.push(endTime - startTime);
      }
      
      const averageEdgeTime = edgeAdditionTimes.reduce((a, b) => a + b, 0) / edgeAdditionTimes.length;
      const maxEdgeTime = Math.max(...edgeAdditionTimes);
      
      // Performance assertions
      expect(averageEdgeTime).toBeLessThan(3); // 3ms average per edge
      expect(maxEdgeTime).toBeLessThan(15); // 15ms max per edge
      
      const finalWorkflow = result.current.workflows.find(w => w.id === workflow.id);
      expect(finalWorkflow?.edges).toHaveLength(edgeCount);
      
      console.log(`Edge Addition - Average: ${averageEdgeTime.toFixed(2)}ms, Max: ${maxEdgeTime.toFixed(2)}ms for ${edgeCount} edges`);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks with repeated operations', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Perform many create/delete cycles
      for (let cycle = 0; cycle < 50; cycle++) {
        let workflows: Workflow[] = [];
        
        // Create multiple workflows
        for (let i = 0; i < 20; i++) {
          act(() => {
            const workflow = result.current.createWorkflow({
              name: `Memory Test Workflow ${cycle}-${i}`,
              nodes: Array.from({ length: 50 }, (_, nodeIndex) => ({
                id: `node-${cycle}-${i}-${nodeIndex}`,
                type: 'transform',
                position: { x: nodeIndex * 20, y: 0 },
                data: {
                  label: `Node ${nodeIndex}`,
                  config: { data: new Array(100).fill(`data-${nodeIndex}`) },
                },
              })),
              edges: [],
            });
            workflows.push(workflow);
          });
        }
        
        // Delete all workflows
        workflows.forEach((workflow) => {
          act(() => {
            result.current.deleteWorkflow(workflow.id);
          });
        });
        
        // Force garbage collection if available
        if ((global as any).gc) {
          (global as any).gc();
        }
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryDifference = finalMemory - initialMemory;
      
      // Allow some memory growth but not excessive
      expect(memoryDifference).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
      
      console.log(`Memory usage - Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, Difference: ${(memoryDifference / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Concurrent Operation Tests', () => {
    it('should handle concurrent workflow operations', async () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      const concurrentOperations = 100;
      const startTime = performance.now();
      
      // Simulate concurrent operations
      const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            act(() => {
              const workflow = result.current.createWorkflow({
                name: `Concurrent Workflow ${i}`,
                nodes: [],
                edges: [],
              });
              
              // Add some nodes
              for (let j = 0; j < 5; j++) {
                result.current.addNode(workflow.id, {
                  id: `node-${i}-${j}`,
                  type: 'transform',
                  position: { x: j * 100, y: 0 },
                  data: {
                    label: `Node ${j}`,
                    config: { workflowIndex: i, nodeIndex: j },
                  },
                });
              }
              
              // Add some edges
              for (let j = 0; j < 4; j++) {
                result.current.addEdge(workflow.id, {
                  id: `edge-${i}-${j}`,
                  source: `node-${i}-${j}`,
                  target: `node-${i}-${j + 1}`,
                });
              }
            });
            resolve();
          }, Math.random() * 10); // Random delay to simulate real concurrency
        });
      });
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Verify all operations completed
      expect(result.current.workflows).toHaveLength(concurrentOperations);
      
      // Check that all workflows have their nodes and edges
      result.current.workflows.forEach((workflow, index) => {
        expect(workflow.nodes).toHaveLength(5);
        expect(workflow.edges).toHaveLength(4);
        expect(workflow.name).toBe(`Concurrent Workflow ${index}`);
      });
      
      console.log(`Concurrent operations completed in ${totalTime.toFixed(2)}ms for ${concurrentOperations} workflows`);
    });
  });

  describe('Search and Query Performance', () => {
    it('should perform workflow searches efficiently', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      // Create many workflows with different names and types
      const workflowCount = 1000;
      const workflows: Workflow[] = [];
      
      for (let i = 0; i < workflowCount; i++) {
        act(() => {
          const workflow = result.current.createWorkflow({
            name: `Search Test Workflow ${i}`,
            description: i % 2 === 0 ? 'Even workflow' : 'Odd workflow',
            nodes: [
              {
                id: `node-${i}`,
                type: i % 3 === 0 ? 'trigger' : i % 3 === 1 ? 'transform' : 'output',
                position: { x: 0, y: 0 },
                data: {
                  label: `Node ${i}`,
                  config: { category: i % 5 },
                },
              },
            ],
            edges: [],
          });
          workflows.push(workflow);
        });
      }
      
      // Perform various search operations
      const searchOperations = [
        () => result.current.workflows.filter(w => w.name.includes('500')),
        () => result.current.workflows.filter(w => w.description?.includes('Even')),
        () => result.current.workflows.filter(w => w.nodes.some(n => n.type === 'trigger')),
        () => result.current.workflows.filter(w => w.nodes.some(n => n.data.config.category === 3)),
      ];
      
      const searchTimes: number[] = [];
      
      searchOperations.forEach((searchOp) => {
        const startTime = performance.now();
        const results = searchOp();
        const endTime = performance.now();
        
        searchTimes.push(endTime - startTime);
        expect(results.length).toBeGreaterThan(0); // Should find some results
      });
      
      const averageSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      const maxSearchTime = Math.max(...searchTimes);
      
      // Search should be fast even with many workflows
      expect(averageSearchTime).toBeLessThan(50); // 50ms average
      expect(maxSearchTime).toBeLessThan(100); // 100ms max
      
      console.log(`Search Performance - Average: ${averageSearchTime.toFixed(2)}ms, Max: ${maxSearchTime.toFixed(2)}ms across ${workflowCount} workflows`);
    });
  });

  describe('Stress Testing', () => {
    it('should handle maximum workflow complexity', () => {
      const { result } = renderHook(() => useWorkflowStore());
      
      const startTime = performance.now();
      
      let workflow: Workflow;
      
      // Create complex workflow
      act(() => {
        workflow = result.current.createWorkflow({
          name: 'Maximum Complexity Stress Test',
          nodes: [],
          edges: [],
        });
      });
      
      // Add maximum nodes
      const maxNodes = 2000;
      for (let i = 0; i < maxNodes; i++) {
        act(() => {
          result.current.addNode(workflow.id, {
            id: `stress-node-${i}`,
            type: ['trigger', 'collection', 'transform', 'logic', 'output'][i % 5] as any,
            position: { 
              x: (i % 50) * 120, 
              y: Math.floor(i / 50) * 100 
            },
            data: {
              label: `Stress Node ${i}`,
              config: {
                index: i,
                category: i % 10,
                data: Array.from({ length: 10 }, (_, j) => `data-${i}-${j}`),
                timestamp: Date.now(),
                metadata: {
                  created: new Date().toISOString(),
                  type: 'stress-test',
                  priority: i % 3,
                },
              },
            },
          });
        });
      }
      
      // Add many edges (create a complex connected graph)
      const maxEdges = 1500;
      for (let i = 0; i < maxEdges; i++) {
        const sourceIndex = i % maxNodes;
        const targetIndex = (i + 1) % maxNodes;
        
        act(() => {
          result.current.addEdge(workflow.id, {
            id: `stress-edge-${i}`,
            source: `stress-node-${sourceIndex}`,
            target: `stress-node-${targetIndex}`,
            label: `Connection ${i}`,
            condition: i % 5 === 0 ? 'value > threshold' : undefined,
          });
        });
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Verify the complex workflow was created
      const stressWorkflow = result.current.workflows.find(w => w.id === workflow.id);
      expect(stressWorkflow?.nodes).toHaveLength(maxNodes);
      expect(stressWorkflow?.edges).toHaveLength(maxEdges);
      
      // Should complete within reasonable time even for maximum complexity
      expect(totalTime).toBeLessThan(30000); // 30 seconds max for stress test
      
      console.log(`Stress Test - Created ${maxNodes} nodes and ${maxEdges} edges in ${totalTime.toFixed(2)}ms`);
    });
  });
});