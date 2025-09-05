// Types for the Visual Workflow Builder

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
    inputs?: string[];
    outputs?: string[];
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isTemplate?: boolean;
  status?: 'draft' | 'active' | 'paused' | 'archived';
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  triggerData?: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface NodeExecution {
  id: string;
  workflowRunId: string;
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// Node category definitions
export type NodeCategory = 'trigger' | 'collection' | 'transform' | 'logic' | 'output';

export interface NodeDefinition {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  inputs: string[];
  outputs: string[];
  config: {
    fields: ConfigField[];
    defaults: Record<string, any>;
  };
}

export interface ConfigField {
  name: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'json' | 'code';
  label: string;
  required: boolean;
  options?: { label: string; value: string }[];
  validation?: Record<string, any>;
  placeholder?: string;
  description?: string;
}

// Specific node types
export interface TriggerNodeData {
  type: 'schedule' | 'form' | 'webhook' | 'email';
  config: {
    cron?: string;
    timezone?: string;
    formId?: string;
    webhookPath?: string;
    emailPattern?: string;
  };
}

export interface CollectionNodeData {
  type: 'sendForm' | 'bulkImport';
  config: {
    formId?: string;
    recipients?: string;
    deliveryMethod?: 'email' | 'sms' | 'portal';
    reminderSchedule?: string;
    fileSource?: string;
    mappingRules?: Record<string, any>;
  };
}

export interface TransformNodeData {
  type: 'mapper' | 'calculator' | 'aggregator';
  config: {
    inputSchema?: Record<string, any>;
    outputSchema?: Record<string, any>;
    mappingRules?: Record<string, any>;
    formula?: string;
    inputFields?: string[];
    outputField?: string;
    groupBy?: string;
    aggregationMethod?: string;
  };
}

export interface LogicNodeData {
  type: 'conditional' | 'loop' | 'wait';
  config: {
    conditions?: string;
    trueBranch?: string;
    falseBranch?: string;
    itemsSource?: string;
    iterationBody?: string;
    duration?: number;
    continueCondition?: string;
  };
}

export interface OutputNodeData {
  type: 'database' | 'api' | 'erp';
  config: {
    connection?: string;
    endpoint?: string;
    method?: string;
    headers?: Record<string, any>;
    bodyMapping?: Record<string, any>;
    systemType?: 'SAP' | 'Oracle' | 'NetSuite';
    connectionDetails?: Record<string, any>;
    table?: string;
    operation?: 'insert' | 'update' | 'upsert';
  };
}