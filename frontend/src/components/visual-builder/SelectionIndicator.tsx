/**
 * Selection Indicator for Visual Builder
 * Shows selection boundaries and provides resize/move handles
 */

import React from 'react';
import { Move, MoreVertical } from 'lucide-react';
import { FormField } from '../../types/forms';

interface SelectionIndicatorProps {
  bounds: { width: number; height: number };
  onMove: (delta: { x: number; y: number }) => void;
  onResize: (newSize: { width: number; height: number }) => void;
  actions: Array<{
    label: string;
    icon: React.ComponentType<any>;
    action: (field: FormField) => void;
    destructive?: boolean;
  }>;
  field: FormField;
}

export const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  bounds,
  onMove,
  onResize,
  actions,
  field,
}) => {
  const [showContextMenu, setShowContextMenu] = React.useState(false);

  return (
    <>
      {/* Selection Border */}
      <div
        className="absolute inset-0 border-2 border-blue-500 rounded pointer-events-none"
        style={{ margin: '-2px' }}
      >
        {/* Corner Handles */}
        <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-sm"></div>
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-sm"></div>
        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-sm"></div>
        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-sm"></div>
        
        {/* Move Handle */}
        <div className="absolute -top-8 left-0 flex items-center space-x-1">
          <button
            className="flex items-center space-x-1 px-2 py-1 bg-blue-500 text-white text-xs rounded shadow-lg cursor-move"
            onMouseDown={(e) => {
              // Move logic would go here
              e.preventDefault();
            }}
          >
            <Move className="w-3 h-3" />
            <span>{field.label}</span>
          </button>
          
          {/* Context Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowContextMenu(!showContextMenu)}
              className="p-1 bg-blue-500 text-white rounded shadow-lg hover:bg-blue-600"
            >
              <MoreVertical className="w-3 h-3" />
            </button>
            
            {/* Context Menu */}
            {showContextMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowContextMenu(false)}
                />
                <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {actions.map((action, index) => {
                    const IconComponent = action.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          action.action(field);
                          setShowContextMenu(false);
                        }}
                        className={`w-full flex items-center space-x-2 px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                          action.destructive ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                        <span>{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};