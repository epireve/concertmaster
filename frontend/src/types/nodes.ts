/**
 * Node configuration types for the workflow system
 */

import { NodeDefinition } from './workflow';

export interface NodeConfig {
  id: string;
  type: string;
  label: string;
  description?: string;
  category: 'trigger' | 'collection' | 'transform' | 'logic' | 'output';
  icon: string;
  color: string;
  inputs: string[];
  outputs: string[];
  defaultData?: Record<string, any>;
  configSchema?: ConfigField[];
}

export interface ConfigField {
  name: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'json' | 'code' | 'textarea';
  label: string;
  required: boolean;
  options?: { label: string; value: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
  placeholder?: string;
  description?: string;
  defaultValue?: any;
}

export interface NodeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface NodeHandle {
  id: string;
  type: 'source' | 'target';
  position: 'top' | 'right' | 'bottom' | 'left';
  style?: Record<string, any>;
}

// Re-export from workflow for compatibility
export type { NodeDefinition };