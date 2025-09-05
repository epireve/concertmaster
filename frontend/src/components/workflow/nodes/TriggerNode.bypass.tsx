// Temporary bypass for TriggerNode with icon fallbacks
import React from 'react';
import { Handle, Position } from 'reactflow';
import { Clock, Database, Globe } from '../../../utils/iconFallbacks';

interface TriggerNodeProps {
  data: {
    label: string;
    type: 'schedule' | 'webhook' | 'database' | 'manual';
    description?: string;
  };
  isConnectable: boolean;
}

const TriggerNode: React.FC<TriggerNodeProps> = ({ data, isConnectable }) => {
  const getIcon = () => {
    switch (data.type) {
      case 'schedule':
        return <Clock size={16} />;
      case 'webhook':
        return <Globe size={16} />;
      case 'database':
        return <Database size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getColor = () => {
    switch (data.type) {
      case 'schedule':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'webhook':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'database':
        return 'bg-purple-100 border-purple-300 text-purple-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[150px] ${getColor()}`}>
      <div className="flex items-center">
        <div className="mr-2">
          {getIcon()}
        </div>
        <div>
          <div className="text-sm font-medium">{data.label}</div>
          {data.description && (
            <div className="text-xs opacity-75">{data.description}</div>
          )}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        isConnectable={isConnectable}
        className="w-3 h-3 bg-gray-400"
      />
    </div>
  );
};

export { TriggerNode };