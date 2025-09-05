import { NodeTypes } from 'reactflow';
import { BaseNode } from './BaseNode';
import { TriggerNode } from './TriggerNode';
import { CollectionNode } from './CollectionNode';
import { TransformNode } from './TransformNode';
import { LogicNode } from './LogicNode';
import { OutputNode } from './OutputNode';

// Custom node types for React Flow
export const customNodeTypes: NodeTypes = {
  // Base node type
  default: BaseNode,
  
  // Trigger nodes
  scheduleTrigger: TriggerNode,
  formTrigger: TriggerNode,
  webhookTrigger: TriggerNode,
  emailTrigger: TriggerNode,
  
  // Collection nodes
  sendForm: CollectionNode,
  bulkImport: CollectionNode,
  
  // Transform nodes
  dataMapper: TransformNode,
  calculator: TransformNode,
  aggregator: TransformNode,
  
  // Logic nodes
  conditional: LogicNode,
  loop: LogicNode,
  wait: LogicNode,
  
  // Output nodes
  databaseWrite: OutputNode,
  apiCall: OutputNode,
  erpExport: OutputNode,
};

export {
  BaseNode,
  TriggerNode,
  CollectionNode,
  TransformNode,
  LogicNode,
  OutputNode,
};