/**
 * Unit Tests for Workflow Types and Validation
 * Testing TypeScript interfaces and type safety for workflow structures
 */

import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowRun,
  NodeExecution,
  NodeDefinition,
  ConfigField,
  TriggerNodeData,
  CollectionNodeData,
  TransformNodeData,
  LogicNodeData,
  OutputNodeData,
  NodeCategory,
} from '../../frontend/src/types/workflow';

describe('Workflow Types', () => {
  describe('WorkflowNode Interface', () => {
    it('should create a valid WorkflowNode with all required fields', () => {
      const node: WorkflowNode = {
        id: 'node-1',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: {
          label: 'Test Node',
          config: { key: 'value' },
        },
      };

      expect(node.id).toBe('node-1');
      expect(node.type).toBe('trigger');
      expect(node.position).toEqual({ x: 100, y: 100 });
      expect(node.data.label).toBe('Test Node');
      expect(node.data.config).toEqual({ key: 'value' });
    });

    it('should support optional inputs and outputs', () => {
      const nodeWithIO: WorkflowNode = {
        id: 'node-2',
        type: 'transform',
        position: { x: 0, y: 0 },
        data: {
          label: 'Transform Node',
          config: {},
          inputs: ['input1', 'input2'],
          outputs: ['output1', 'output2'],
        },
      };

      expect(nodeWithIO.data.inputs).toEqual(['input1', 'input2']);
      expect(nodeWithIO.data.outputs).toEqual(['output1', 'output2']);
    });
  });

  describe('WorkflowEdge Interface', () => {
    it('should create a valid WorkflowEdge with required fields', () => {
      const edge: WorkflowEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
      };

      expect(edge.id).toBe('edge-1');
      expect(edge.source).toBe('node-1');
      expect(edge.target).toBe('node-2');
    });

    it('should support optional fields', () => {
      const edgeWithOptions: WorkflowEdge = {
        id: 'edge-2',
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'output1',
        targetHandle: 'input1',
        condition: 'value > 10',
        label: 'Conditional Edge',
      };

      expect(edgeWithOptions.sourceHandle).toBe('output1');
      expect(edgeWithOptions.targetHandle).toBe('input1');
      expect(edgeWithOptions.condition).toBe('value > 10');
      expect(edgeWithOptions.label).toBe('Conditional Edge');
    });
  });

  describe('Workflow Interface', () => {
    it('should create a valid Workflow with all fields', () => {
      const workflow: Workflow = {
        id: 'workflow-1',
        name: 'Test Workflow',
        description: 'A test workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Trigger', config: {} },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
          },
        ],
        createdBy: 'user-1',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
        isTemplate: false,
        status: 'draft',
      };

      expect(workflow.id).toBe('workflow-1');
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.nodes).toHaveLength(1);
      expect(workflow.edges).toHaveLength(1);
      expect(workflow.status).toBe('draft');
    });

    it('should support different workflow statuses', () => {
      const statuses: Array<Workflow['status']> = ['draft', 'active', 'paused', 'archived'];
      
      statuses.forEach((status) => {
        const workflow: Partial<Workflow> = { status };
        expect(workflow.status).toBe(status);
      });
    });
  });

  describe('WorkflowRun Interface', () => {
    it('should create a valid WorkflowRun', () => {
      const workflowRun: WorkflowRun = {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: 'running',
        startedAt: new Date('2023-01-01T10:00:00Z'),
      };

      expect(workflowRun.id).toBe('run-1');
      expect(workflowRun.workflowId).toBe('workflow-1');
      expect(workflowRun.status).toBe('running');
      expect(workflowRun.startedAt).toBeInstanceOf(Date);
    });

    it('should support all workflow run statuses', () => {
      const statuses: Array<WorkflowRun['status']> = ['running', 'completed', 'failed', 'paused'];
      
      statuses.forEach((status) => {
        const run: Partial<WorkflowRun> = { status };
        expect(run.status).toBe(status);
      });
    });
  });

  describe('NodeExecution Interface', () => {
    it('should create a valid NodeExecution', () => {
      const nodeExecution: NodeExecution = {
        id: 'execution-1',
        workflowRunId: 'run-1',
        nodeId: 'node-1',
        status: 'completed',
        startedAt: new Date('2023-01-01T10:00:00Z'),
      };

      expect(nodeExecution.id).toBe('execution-1');
      expect(nodeExecution.workflowRunId).toBe('run-1');
      expect(nodeExecution.nodeId).toBe('node-1');
      expect(nodeExecution.status).toBe('completed');
    });

    it('should support all node execution statuses', () => {
      const statuses: Array<NodeExecution['status']> = ['pending', 'running', 'completed', 'failed'];
      
      statuses.forEach((status) => {
        const execution: Partial<NodeExecution> = { status };
        expect(execution.status).toBe(status);
      });
    });
  });

  describe('NodeCategory Type', () => {
    it('should support all defined node categories', () => {
      const categories: NodeCategory[] = ['trigger', 'collection', 'transform', 'logic', 'output'];
      
      categories.forEach((category) => {
        expect(['trigger', 'collection', 'transform', 'logic', 'output']).toContain(category);
      });
    });
  });

  describe('NodeDefinition Interface', () => {
    it('should create a valid NodeDefinition', () => {
      const nodeDefinition: NodeDefinition = {
        type: 'scheduleeTrigger',
        category: 'trigger',
        label: 'Schedule Trigger',
        description: 'Triggers workflow on a schedule',
        icon: 'clock',
        color: '#4A90E2',
        inputs: [],
        outputs: ['output'],
        config: {
          fields: [
            {
              name: 'cron',
              type: 'text',
              label: 'Cron Expression',
              required: true,
              placeholder: '0 0 * * *',
              description: 'Cron expression for scheduling',
            },
          ],
          defaults: {
            cron: '0 0 * * *',
            timezone: 'UTC',
          },
        },
      };

      expect(nodeDefinition.type).toBe('scheduleeTrigger');
      expect(nodeDefinition.category).toBe('trigger');
      expect(nodeDefinition.config.fields).toHaveLength(1);
      expect(nodeDefinition.config.defaults.cron).toBe('0 0 * * *');
    });
  });

  describe('ConfigField Interface', () => {
    it('should support all field types', () => {
      const fieldTypes: Array<ConfigField['type']> = ['text', 'number', 'select', 'boolean', 'json', 'code'];
      
      fieldTypes.forEach((type) => {
        const field: ConfigField = {
          name: `test-${type}`,
          type,
          label: `Test ${type} Field`,
          required: false,
        };
        
        expect(field.type).toBe(type);
      });
    });

    it('should create select field with options', () => {
      const selectField: ConfigField = {
        name: 'delivery_method',
        type: 'select',
        label: 'Delivery Method',
        required: true,
        options: [
          { label: 'Email', value: 'email' },
          { label: 'SMS', value: 'sms' },
          { label: 'Portal', value: 'portal' },
        ],
      };

      expect(selectField.options).toHaveLength(3);
      expect(selectField.options?.[0]).toEqual({ label: 'Email', value: 'email' });
    });
  });

  describe('Specific Node Data Types', () => {
    it('should validate TriggerNodeData types', () => {
      const scheduleNode: TriggerNodeData = {
        type: 'schedule',
        config: {
          cron: '0 0 * * *',
          timezone: 'UTC',
        },
      };

      const formNode: TriggerNodeData = {
        type: 'form',
        config: {
          formId: 'form-123',
        },
      };

      const webhookNode: TriggerNodeData = {
        type: 'webhook',
        config: {
          webhookPath: '/webhook/trigger',
        },
      };

      expect(scheduleNode.type).toBe('schedule');
      expect(formNode.type).toBe('form');
      expect(webhookNode.type).toBe('webhook');
    });

    it('should validate CollectionNodeData types', () => {
      const sendFormNode: CollectionNodeData = {
        type: 'sendForm',
        config: {
          formId: 'form-123',
          recipients: 'user@example.com',
          deliveryMethod: 'email',
          reminderSchedule: '24h',
        },
      };

      const bulkImportNode: CollectionNodeData = {
        type: 'bulkImport',
        config: {
          fileSource: 'uploads/data.csv',
          mappingRules: { column1: 'field1' },
        },
      };

      expect(sendFormNode.type).toBe('sendForm');
      expect(sendFormNode.config.deliveryMethod).toBe('email');
      expect(bulkImportNode.type).toBe('bulkImport');
    });

    it('should validate TransformNodeData types', () => {
      const mapperNode: TransformNodeData = {
        type: 'mapper',
        config: {
          inputSchema: { field1: 'string' },
          outputSchema: { mappedField: 'string' },
          mappingRules: { mappedField: 'field1' },
        },
      };

      const calculatorNode: TransformNodeData = {
        type: 'calculator',
        config: {
          formula: 'input1 + input2',
          inputFields: ['input1', 'input2'],
          outputField: 'result',
        },
      };

      expect(mapperNode.type).toBe('mapper');
      expect(calculatorNode.type).toBe('calculator');
      expect(calculatorNode.config.formula).toBe('input1 + input2');
    });

    it('should validate LogicNodeData types', () => {
      const conditionalNode: LogicNodeData = {
        type: 'conditional',
        config: {
          conditions: 'value > 100',
          trueBranch: 'node-success',
          falseBranch: 'node-failure',
        },
      };

      const loopNode: LogicNodeData = {
        type: 'loop',
        config: {
          itemsSource: 'previousNode.items',
          iterationBody: 'processItem',
        },
      };

      const waitNode: LogicNodeData = {
        type: 'wait',
        config: {
          duration: 5000,
          continueCondition: 'external_trigger',
        },
      };

      expect(conditionalNode.type).toBe('conditional');
      expect(loopNode.type).toBe('loop');
      expect(waitNode.type).toBe('wait');
    });

    it('should validate OutputNodeData types', () => {
      const databaseNode: OutputNodeData = {
        type: 'database',
        config: {
          connection: 'postgres://localhost:5432/db',
          table: 'responses',
          operation: 'insert',
        },
      };

      const apiNode: OutputNodeData = {
        type: 'api',
        config: {
          endpoint: 'https://api.example.com/data',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          bodyMapping: { data: 'responseData' },
        },
      };

      const erpNode: OutputNodeData = {
        type: 'erp',
        config: {
          systemType: 'SAP',
          connectionDetails: { host: 'sap.company.com' },
        },
      };

      expect(databaseNode.type).toBe('database');
      expect(databaseNode.config.operation).toBe('insert');
      expect(apiNode.type).toBe('api');
      expect(erpNode.type).toBe('erp');
      expect(erpNode.config.systemType).toBe('SAP');
    });
  });

  describe('Type Safety and Validation', () => {
    it('should enforce required fields at compile time', () => {
      // This test ensures TypeScript compilation catches missing required fields
      // The test itself verifies the interface contracts are correctly defined

      const minimalWorkflow: Pick<Workflow, 'id' | 'name' | 'nodes' | 'edges'> = {
        id: 'test',
        name: 'Test',
        nodes: [],
        edges: [],
      };

      expect(minimalWorkflow).toBeDefined();

      const minimalNode: Pick<WorkflowNode, 'id' | 'type' | 'position' | 'data'> = {
        id: 'test',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: { label: 'Test', config: {} },
      };

      expect(minimalNode).toBeDefined();
    });

    it('should allow valid workflow status transitions', () => {
      // Test valid status values
      const validStatuses: Array<Workflow['status']> = ['draft', 'active', 'paused', 'archived'];
      
      validStatuses.forEach((status) => {
        const workflow: Partial<Workflow> = { status };
        expect(['draft', 'active', 'paused', 'archived']).toContain(workflow.status);
      });
    });

    it('should validate edge relationships', () => {
      const edge: WorkflowEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
      };

      // Verify edge connects two different nodes
      expect(edge.source).not.toBe(edge.target);
      expect(typeof edge.source).toBe('string');
      expect(typeof edge.target).toBe('string');
    });
  });
});