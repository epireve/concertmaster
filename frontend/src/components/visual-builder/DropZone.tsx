/**
 * Drop Zone Component for Visual Builder
 * Provides visual feedback for drag and drop operations
 */

import React from 'react';
import { useDrop } from 'react-dnd';
import { Plus } from 'lucide-react';
import { FormFieldType } from '../../types/forms';

interface DropZoneProps {
  position: 'top' | 'bottom';
  index?: number;
  onDrop: (fieldType: FormFieldType) => void;
  isVisible: boolean;
  style?: React.CSSProperties;
}

export const DropZone: React.FC<DropZoneProps> = ({
  position,
  index,
  onDrop,
  isVisible,
  style,
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'FORM_FIELD',
    drop: (item: { fieldType: FormFieldType }) => {
      onDrop(item.fieldType);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  if (!isVisible && !isOver) return null;

  return (
    <div
      ref={drop}
      className={`absolute transition-all duration-200 z-10 ${
        isOver && canDrop ? 'opacity-100' : 'opacity-0 hover:opacity-75'
      }`}
      style={{
        height: '40px',
        ...style,
      }}
    >
      <div
        className={`h-full border-2 border-dashed rounded-lg flex items-center justify-center transition-all duration-200 ${
          isOver && canDrop
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }`}
      >
        {isOver && canDrop ? (
          <div className="flex items-center space-x-2 text-blue-600 font-medium text-sm">
            <Plus className="w-4 h-4" />
            <span>Drop to add field</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-gray-400 text-sm">
            <Plus className="w-3 h-3" />
            <span>Drop zone</span>
          </div>
        )}
      </div>
    </div>
  );
};