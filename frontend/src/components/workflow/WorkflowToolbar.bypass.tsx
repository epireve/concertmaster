// Temporary bypass for WorkflowToolbar with icon fallbacks
import React from 'react';
import { Save, Plus, RotateCcw, ZoomIn } from '../../utils/iconFallbacks';

interface WorkflowToolbarProps {
  onSave: () => void;
  onAddNode: (type: string) => void;
  workflow: {
    name: string;
    description?: string;
  };
}

const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  onSave,
  onAddNode,
  workflow
}) => {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-medium text-gray-900">
            {workflow.name}
          </h2>
          {workflow.description && (
            <span className="text-sm text-gray-500">
              {workflow.description}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Add Node Dropdown */}
          <div className="relative inline-block text-left">
            <button
              onClick={() => onAddNode('manual')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus size={16} className="mr-2" />
              Add Node
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 border border-gray-300 rounded-md">
            <button
              className="p-2 hover:bg-gray-50 rounded-l-md"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              className="p-2 hover:bg-gray-50"
              title="Reset Zoom"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={onSave}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Save size={16} className="mr-2" />
            Save
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-3 flex items-center space-x-2">
        <button
          onClick={() => onAddNode('schedule')}
          className="inline-flex items-center px-2 py-1 border border-green-300 text-xs font-medium rounded text-green-700 bg-green-50 hover:bg-green-100"
        >
          Schedule Trigger
        </button>
        <button
          onClick={() => onAddNode('webhook')}
          className="inline-flex items-center px-2 py-1 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          Webhook Trigger
        </button>
        <button
          onClick={() => onAddNode('database')}
          className="inline-flex items-center px-2 py-1 border border-purple-300 text-xs font-medium rounded text-purple-700 bg-purple-50 hover:bg-purple-100"
        >
          Database Trigger
        </button>
      </div>
    </div>
  );
};

export { WorkflowToolbar };