import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database, Globe, Building, Settings, AlertCircle } from 'lucide-react';

interface OutputNodeData {
  label: string;
  type: 'databaseWrite' | 'apiCall' | 'erpExport';
  config?: Record<string, any>;
  status?: 'idle' | 'running' | 'success' | 'error';
  error?: string;
}

const outputIcons = {
  databaseWrite: Database,
  apiCall: Globe,
  erpExport: Building,
};

export const OutputNode: React.FC<NodeProps<OutputNodeData>> = ({
  data,
  selected,
  id,
}) => {
  const { label, type, status = 'idle', error, config } = data;
  const IconComponent = outputIcons[type] || Database;

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'border-blue-500 bg-blue-50';
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-red-300 bg-red-50';
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case 'running':
        return <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />;
      case 'success':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getConfigSummary = () => {
    if (!config) return null;
    
    switch (type) {
      case 'databaseWrite':
        return config.table ? `Table: ${config.table}` : 'No table';
      case 'apiCall':
        return config.url ? `URL: ${new URL(config.url).hostname}` : 'No URL';
      case 'erpExport':
        return config.system ? `System: ${config.system.toUpperCase()}` : 'No system';
      default:
        return null;
    }
  };

  return (
    <div
      className={`
        relative min-w-[220px] px-4 py-3 rounded-lg border-2 shadow-sm transition-all duration-200
        ${getStatusColor()}
        ${selected ? 'ring-2 ring-red-500 ring-opacity-50' : ''}
        hover:shadow-md
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-red-400 border-2 border-white"
      />

      {/* Node content */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
          <IconComponent className="w-4 h-4 text-red-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 truncate">{label}</span>
              {getStatusIndicator()}
            </div>
            <button
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Configure Output"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          
          <div className="text-xs text-gray-500 mt-1">
            Output • {type.replace(/([A-Z])/g, ' $1').toLowerCase()}
          </div>
          
          {getConfigSummary() && (
            <div className="text-xs text-gray-600 mt-1 truncate" title={getConfigSummary()!}>
              {getConfigSummary()}
            </div>
          )}
          
          {error && (
            <div className="mt-1 text-xs text-red-600 truncate" title={error}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Optional output handle for chaining */}
      {config?.chainable && (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="w-3 h-3 bg-red-400 border-2 border-white"
        />
      )}

      {/* Output indicator */}
      <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
    </div>
  );
};