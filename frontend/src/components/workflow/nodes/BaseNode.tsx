import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Settings, AlertCircle } from 'lucide-react';

interface BaseNodeData {
  label: string;
  config?: Record<string, any>;
  inputs?: string[];
  outputs?: string[];
  status?: 'idle' | 'running' | 'success' | 'error';
  error?: string;
}

export const BaseNode: React.FC<NodeProps<BaseNodeData>> = ({
  data,
  selected,
  id,
}) => {
  const { label, inputs = [], outputs = [], status = 'idle', error } = data;

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'border-blue-500 bg-blue-50';
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-300 bg-white';
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

  return (
    <div
      className={`
        relative min-w-[200px] px-4 py-3 rounded-lg border-2 shadow-sm transition-all duration-200
        ${getStatusColor()}
        ${selected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
        hover:shadow-md
      `}
    >
      {/* Input handles */}
      {inputs.map((input, index) => (
        <Handle
          key={`input-${index}`}
          type="target"
          position={Position.Left}
          id={input}
          className="w-3 h-3 bg-gray-400 border-2 border-white"
          style={{ top: `${((index + 1) * 100) / (inputs.length + 1)}%` }}
        />
      ))}

      {/* Node content */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900">{label}</span>
            {getStatusIndicator()}
          </div>
          {error && (
            <div className="mt-1 text-xs text-red-600 truncate" title={error}>
              {error}
            </div>
          )}
        </div>
        
        <button
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Configure Node"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Output handles */}
      {outputs.map((output, index) => (
        <Handle
          key={`output-${index}`}
          type="source"
          position={Position.Right}
          id={output}
          className="w-3 h-3 bg-gray-400 border-2 border-white"
          style={{ top: `${((index + 1) * 100) / (outputs.length + 1)}%` }}
        />
      ))}

      {/* Node type indicator */}
      <div className="absolute -top-2 -left-2 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
    </div>
  );
};