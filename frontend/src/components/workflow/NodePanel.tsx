import React, { useState } from 'react';
import { NodeCategory, NodeDefinition } from '../../types/workflow';

// Node definitions for each category
const nodeDefinitions: Record<NodeCategory, NodeDefinition[]> = {
  trigger: [
    {
      type: 'scheduleTrigger',
      category: 'trigger',
      label: 'Schedule',
      description: 'Start workflow on schedule',
      icon: '⏰',
      color: '#10b981',
      inputs: [],
      outputs: ['data'],
      config: {
        fields: [
          {
            name: 'cron',
            type: 'text',
            label: 'Cron Expression',
            required: true,
            placeholder: '0 0 1 */3 *',
            description: 'Cron expression for scheduling',
          },
          {
            name: 'timezone',
            type: 'select',
            label: 'Timezone',
            required: true,
            options: [
              { label: 'UTC', value: 'UTC' },
              { label: 'America/New_York', value: 'America/New_York' },
              { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
              { label: 'Europe/London', value: 'Europe/London' },
            ],
          },
        ],
        defaults: { cron: '0 0 * * *', timezone: 'UTC' },
      },
    },
    {
      type: 'formTrigger',
      category: 'trigger',
      label: 'Form Submit',
      description: 'Start workflow when form is submitted',
      icon: '📝',
      color: '#10b981',
      inputs: [],
      outputs: ['formData'],
      config: {
        fields: [
          {
            name: 'formId',
            type: 'select',
            label: 'Form',
            required: true,
            options: [], // Will be populated dynamically
          },
          {
            name: 'validateOnSubmit',
            type: 'boolean',
            label: 'Validate on Submit',
            required: false,
          },
        ],
        defaults: { validateOnSubmit: true },
      },
    },
    {
      type: 'webhookTrigger',
      category: 'trigger',
      label: 'Webhook',
      description: 'Start workflow via webhook',
      icon: '🌐',
      color: '#10b981',
      inputs: [],
      outputs: ['payload'],
      config: {
        fields: [
          {
            name: 'path',
            type: 'text',
            label: 'Endpoint Path',
            required: true,
            placeholder: '/webhook/my-endpoint',
          },
          {
            name: 'method',
            type: 'select',
            label: 'HTTP Method',
            required: true,
            options: [
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'PATCH', value: 'PATCH' },
            ],
          },
          {
            name: 'authentication',
            type: 'select',
            label: 'Authentication',
            required: false,
            options: [
              { label: 'None', value: 'none' },
              { label: 'API Key', value: 'api_key' },
              { label: 'Bearer Token', value: 'bearer' },
            ],
          },
        ],
        defaults: { method: 'POST', authentication: 'none' },
      },
    },
  ],
  collection: [
    {
      type: 'sendForm',
      category: 'collection',
      label: 'Send Form',
      description: 'Send form to recipients',
      icon: '📤',
      color: '#3b82f6',
      inputs: ['recipients'],
      outputs: ['sent'],
      config: {
        fields: [
          {
            name: 'formId',
            type: 'select',
            label: 'Form',
            required: true,
            options: [],
          },
          {
            name: 'recipientsSource',
            type: 'select',
            label: 'Recipients Source',
            required: true,
            options: [
              { label: 'Manual List', value: 'manual' },
              { label: 'Database Query', value: 'database' },
              { label: 'Previous Node', value: 'previous' },
            ],
          },
          {
            name: 'deliveryMethod',
            type: 'select',
            label: 'Delivery Method',
            required: true,
            options: [
              { label: 'Email', value: 'email' },
              { label: 'SMS', value: 'sms' },
              { label: 'Portal Link', value: 'portal' },
            ],
          },
          {
            name: 'reminderSchedule',
            type: 'text',
            label: 'Reminder Schedule',
            required: false,
            placeholder: '3 days, 7 days',
          },
        ],
        defaults: {
          recipientsSource: 'manual',
          deliveryMethod: 'email',
        },
      },
    },
    {
      type: 'bulkImport',
      category: 'collection',
      label: 'Bulk Import',
      description: 'Import from CSV/Excel',
      icon: '📊',
      color: '#3b82f6',
      inputs: [],
      outputs: ['data'],
      config: {
        fields: [
          {
            name: 'fileSource',
            type: 'select',
            label: 'File Source',
            required: true,
            options: [
              { label: 'Upload', value: 'upload' },
              { label: 'URL', value: 'url' },
              { label: 'FTP', value: 'ftp' },
            ],
          },
          {
            name: 'fileType',
            type: 'select',
            label: 'File Type',
            required: true,
            options: [
              { label: 'CSV', value: 'csv' },
              { label: 'Excel', value: 'excel' },
              { label: 'JSON', value: 'json' },
            ],
          },
          {
            name: 'headerRow',
            type: 'boolean',
            label: 'Has Header Row',
            required: false,
          },
        ],
        defaults: {
          fileSource: 'upload',
          fileType: 'csv',
          headerRow: true,
        },
      },
    },
  ],
  transform: [
    {
      type: 'dataMapper',
      category: 'transform',
      label: 'Data Mapper',
      description: 'Map fields between schemas',
      icon: '🔄',
      color: '#f59e0b',
      inputs: ['input'],
      outputs: ['output'],
      config: {
        fields: [
          {
            name: 'mappingRules',
            type: 'json',
            label: 'Mapping Rules',
            required: true,
            description: 'JSON object defining field mappings',
          },
          {
            name: 'inputSchema',
            type: 'json',
            label: 'Input Schema',
            required: false,
          },
          {
            name: 'outputSchema',
            type: 'json',
            label: 'Output Schema',
            required: false,
          },
        ],
        defaults: { mappingRules: {} },
      },
    },
    {
      type: 'calculator',
      category: 'transform',
      label: 'Calculator',
      description: 'Perform calculations',
      icon: '🧮',
      color: '#f59e0b',
      inputs: ['input'],
      outputs: ['result'],
      config: {
        fields: [
          {
            name: 'formula',
            type: 'code',
            label: 'Formula',
            required: true,
            placeholder: 'field1 + field2 * 0.1',
          },
          {
            name: 'outputField',
            type: 'text',
            label: 'Output Field Name',
            required: true,
            placeholder: 'calculated_value',
          },
        ],
        defaults: {},
      },
    },
    {
      type: 'aggregator',
      category: 'transform',
      label: 'Aggregator',
      description: 'Aggregate multiple responses',
      icon: '📈',
      color: '#f59e0b',
      inputs: ['data'],
      outputs: ['aggregated'],
      config: {
        fields: [
          {
            name: 'groupBy',
            type: 'text',
            label: 'Group By Field',
            required: false,
            placeholder: 'category',
          },
          {
            name: 'aggregationType',
            type: 'select',
            label: 'Aggregation Type',
            required: true,
            options: [
              { label: 'Sum', value: 'sum' },
              { label: 'Average', value: 'avg' },
              { label: 'Count', value: 'count' },
              { label: 'Min', value: 'min' },
              { label: 'Max', value: 'max' },
            ],
          },
          {
            name: 'field',
            type: 'text',
            label: 'Field to Aggregate',
            required: true,
            placeholder: 'amount',
          },
        ],
        defaults: { aggregationType: 'sum' },
      },
    },
  ],
  logic: [
    {
      type: 'conditional',
      category: 'logic',
      label: 'Conditional',
      description: 'Branch based on conditions',
      icon: '🔀',
      color: '#8b5cf6',
      inputs: ['input'],
      outputs: ['true', 'false'],
      config: {
        fields: [
          {
            name: 'condition',
            type: 'code',
            label: 'Condition',
            required: true,
            placeholder: 'data.score > 0.8',
            description: 'JavaScript expression that returns true/false',
          },
        ],
        defaults: {},
      },
    },
    {
      type: 'loop',
      category: 'logic',
      label: 'Loop',
      description: 'Iterate over items',
      icon: '🔁',
      color: '#8b5cf6',
      inputs: ['items'],
      outputs: ['item', 'completed'],
      config: {
        fields: [
          {
            name: 'itemsPath',
            type: 'text',
            label: 'Items Path',
            required: true,
            placeholder: 'data.items',
          },
          {
            name: 'maxIterations',
            type: 'number',
            label: 'Max Iterations',
            required: false,
            placeholder: '1000',
          },
        ],
        defaults: { maxIterations: 1000 },
      },
    },
    {
      type: 'wait',
      category: 'logic',
      label: 'Wait',
      description: 'Pause workflow',
      icon: '⏸️',
      color: '#8b5cf6',
      inputs: ['trigger'],
      outputs: ['continue'],
      config: {
        fields: [
          {
            name: 'duration',
            type: 'number',
            label: 'Duration (seconds)',
            required: false,
            placeholder: '3600',
          },
          {
            name: 'condition',
            type: 'code',
            label: 'Continue Condition',
            required: false,
            placeholder: 'data.ready === true',
          },
        ],
        defaults: { duration: 3600 },
      },
    },
  ],
  output: [
    {
      type: 'databaseWrite',
      category: 'output',
      label: 'Database',
      description: 'Write to database',
      icon: '🗄️',
      color: '#ef4444',
      inputs: ['data'],
      outputs: ['result'],
      config: {
        fields: [
          {
            name: 'connection',
            type: 'select',
            label: 'Database Connection',
            required: true,
            options: [], // Will be populated from connections
          },
          {
            name: 'table',
            type: 'text',
            label: 'Table Name',
            required: true,
            placeholder: 'responses',
          },
          {
            name: 'operation',
            type: 'select',
            label: 'Operation',
            required: true,
            options: [
              { label: 'Insert', value: 'insert' },
              { label: 'Update', value: 'update' },
              { label: 'Upsert', value: 'upsert' },
            ],
          },
        ],
        defaults: { operation: 'insert' },
      },
    },
    {
      type: 'apiCall',
      category: 'output',
      label: 'API Call',
      description: 'Call external API',
      icon: '🌍',
      color: '#ef4444',
      inputs: ['data'],
      outputs: ['response'],
      config: {
        fields: [
          {
            name: 'url',
            type: 'text',
            label: 'API URL',
            required: true,
            placeholder: 'https://api.example.com/endpoint',
          },
          {
            name: 'method',
            type: 'select',
            label: 'HTTP Method',
            required: true,
            options: [
              { label: 'GET', value: 'GET' },
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'PATCH', value: 'PATCH' },
              { label: 'DELETE', value: 'DELETE' },
            ],
          },
          {
            name: 'headers',
            type: 'json',
            label: 'Headers',
            required: false,
            placeholder: '{"Authorization": "Bearer token"}',
          },
          {
            name: 'bodyMapping',
            type: 'json',
            label: 'Body Mapping',
            required: false,
            description: 'How to map input data to request body',
          },
        ],
        defaults: { method: 'POST' },
      },
    },
    {
      type: 'erpExport',
      category: 'output',
      label: 'ERP Export',
      description: 'Send to ERP system',
      icon: '🏢',
      color: '#ef4444',
      inputs: ['data'],
      outputs: ['exported'],
      config: {
        fields: [
          {
            name: 'system',
            type: 'select',
            label: 'ERP System',
            required: true,
            options: [
              { label: 'SAP', value: 'sap' },
              { label: 'Oracle', value: 'oracle' },
              { label: 'NetSuite', value: 'netsuite' },
              { label: 'Dynamics 365', value: 'dynamics365' },
            ],
          },
          {
            name: 'connection',
            type: 'select',
            label: 'Connection',
            required: true,
            options: [], // Will be populated from ERP connections
          },
          {
            name: 'mapping',
            type: 'select',
            label: 'Field Mapping',
            required: true,
            options: [], // Will be populated from saved mappings
          },
        ],
        defaults: {},
      },
    },
  ],
};

interface DragNodeProps {
  nodeType: string;
  definition: NodeDefinition;
}

const DragNode: React.FC<DragNodeProps> = ({ nodeType, definition }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-3 cursor-grab hover:border-gray-300 hover:shadow-md transition-all duration-200"
      onDragStart={(event) => onDragStart(event, nodeType)}
      draggable
    >
      <div className="flex items-center space-x-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
          style={{ backgroundColor: `${definition.color}20`, color: definition.color }}
        >
          {definition.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {definition.label}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {definition.description}
          </div>
        </div>
      </div>
    </div>
  );
};

interface NodeCategoryPanelProps {
  category: NodeCategory;
  definitions: NodeDefinition[];
  expanded: boolean;
  onToggle: () => void;
}

const NodeCategoryPanel: React.FC<NodeCategoryPanelProps> = ({
  category,
  definitions,
  expanded,
  onToggle,
}) => {
  const categoryLabels: Record<NodeCategory, string> = {
    trigger: 'Triggers',
    collection: 'Collection',
    transform: 'Transform',
    logic: 'Logic',
    output: 'Output',
  };

  const categoryIcons: Record<NodeCategory, string> = {
    trigger: '🎯',
    collection: '📋',
    transform: '⚙️',
    logic: '🧠',
    output: '📤',
  };

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-150 rounded-lg transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span className="text-lg">{categoryIcons[category]}</span>
          <span className="text-sm font-medium text-gray-900">
            {categoryLabels[category]}
          </span>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
            {definitions.length}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {expanded && (
        <div className="mt-2 space-y-2">
          {definitions.map((definition) => (
            <DragNode
              key={definition.type}
              nodeType={definition.type}
              definition={definition}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const NodePanel: React.FC = () => {
  const [expandedCategories, setExpandedCategories] = useState<Set<NodeCategory>>(
    new Set(['trigger', 'collection']) // Expand these by default
  );

  const toggleCategory = (category: NodeCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Node Library</h2>
        <p className="text-sm text-gray-600 mt-1">
          Drag nodes to the canvas to build your workflow
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {(Object.keys(nodeDefinitions) as NodeCategory[]).map((category) => (
          <NodeCategoryPanel
            key={category}
            category={category}
            definitions={nodeDefinitions[category]}
            expanded={expandedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
          />
        ))}
      </div>
      
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center">
          💡 Tip: Connect nodes by dragging from output handles to input handles
        </div>
      </div>
    </div>
  );
};