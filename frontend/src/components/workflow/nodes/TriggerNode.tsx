import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Clock, FileText, Globe, Mail, Settings, AlertCircle } from 'lucide-react';

interface TriggerNodeData {
  label: string;
  type: 'scheduleTrigger' | 'formTrigger' | 'webhookTrigger' | 'emailTrigger';
  config?: Record<string, any>;
  status?: 'idle' | 'running' | 'success' | 'error';
  error?: string;
}

const triggerIcons = {
  scheduleTrigger: Clock,
  formTrigger: FileText,
  webhookTrigger: Globe,
  emailTrigger: Mail,
};

export const TriggerNode: React.FC<NodeProps<TriggerNodeData>> = ({
  data,
  selected,
  id,
}) => {
  const { label, type, status = 'idle', error, config } = data;
  const IconComponent = triggerIcons[type] || Clock;

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'border-blue-500 bg-blue-50';
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-green-300 bg-green-50';
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
      case 'scheduleTrigger':
        return config.cron ? `Cron: ${config.cron}` : null;
      case 'formTrigger':
        return config.formId ? `Form: ${config.formId}` : null;
      case 'webhookTrigger':
        return config.path ? `Path: ${config.path}` : null;
      case 'emailTrigger':
        return config.emailPattern ? `Pattern: ${config.emailPattern}` : null;
      default:
        return null;
    }
  };

  return (
    <div
      className={`
        relative min-w-[220px] px-4 py-3 rounded-lg border-2 shadow-sm transition-all duration-200
        ${getStatusColor()}
        ${selected ? 'ring-2 ring-green-500 ring-opacity-50' : ''}
        hover:shadow-md
      `}
    >
      {/* Node content */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
          <IconComponent className="w-4 h-4 text-green-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 truncate">{label}</span>
              {getStatusIndicator()}
            </div>
            <button
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Configure Trigger"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          
          <div className="text-xs text-gray-500 mt-1">
            Trigger • {type.replace('Trigger', '').replace(/([A-Z])/g, ' $1').toLowerCase()}
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

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-400 border-2 border-white"
      />

      {/* Trigger indicator */}
      <div className="absolute -top-2 -left-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
    </div>
  );
};