import React, { useState } from 'react';
import { Node } from 'reactflow';
import { Save, Eye, Play, Square, RotateCcw, ZoomIn } from 'lucide-react';

interface WorkflowToolbarProps {
  onSave: () => void;
  onFitView: () => void;
  hasChanges: boolean;
  selectedNode?: Node | null;
  onNodeConfigChange?: (config: Record<string, any>) => void;
}

export const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  onSave,
  onFitView,
  hasChanges,
  selectedNode,
  onNodeConfigChange,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    // TODO: Implement workflow execution
    setTimeout(() => {
      setIsRunning(false);
    }, 3000);
  };

  const handleStop = () => {
    setIsRunning(false);
    // TODO: Implement workflow stop
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Left side - Main actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onSave}
            disabled={!hasChanges}
            className={`
              inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md
              ${hasChanges 
                ? 'text-white bg-blue-600 hover:bg-blue-700' 
                : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }
              transition-colors duration-200
            `}
          >
            <Save className="w-4 h-4 mr-1.5" />
            Save
            {hasChanges && <span className="ml-1 w-2 h-2 bg-blue-300 rounded-full" />}
          </button>

          <div className="h-6 w-px bg-gray-300" />

          {!isRunning ? (
            <button
              onClick={handleRun}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Play className="w-4 h-4 mr-1.5" />
              Run
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
            >
              <Square className="w-4 h-4 mr-1.5" />
              Stop
            </button>
          )}

          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`
              inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md transition-colors duration-200
              ${showPreview 
                ? 'text-blue-700 bg-blue-50 border-blue-300' 
                : 'text-gray-700 bg-white hover:bg-gray-50'
              }
            `}
          >
            <Eye className="w-4 h-4 mr-1.5" />
            Preview
          </button>
        </div>

        {/* Center - Status */}
        <div className="flex items-center space-x-3">
          {isRunning && (
            <div className="flex items-center text-sm text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2" />
              Running workflow...
            </div>
          )}
          
          {selectedNode && (
            <div className="text-sm text-gray-600">
              Selected: <span className="font-medium">{selectedNode.data.label}</span>
            </div>
          )}
        </div>

        {/* Right side - View controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onFitView}
            className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-500 bg-white hover:bg-gray-50"
            title="Fit View"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-500 bg-white hover:bg-gray-50"
            title="Reset Layout"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary toolbar for node configuration */}
      {selectedNode && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-700 mb-2">
            Node Configuration: {selectedNode.data.label}
          </div>
          <div className="text-xs text-gray-500">
            Select node properties in the right panel to configure
          </div>
        </div>
      )}
    </div>
  );
};