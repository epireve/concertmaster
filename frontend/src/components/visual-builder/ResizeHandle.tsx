/**
 * Resize Handle Component for Visual Builder
 * Provides resize functionality for form fields
 */

import React from 'react';

interface ResizeHandleProps {
  position: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
  onResize: (delta: { width: number; height: number }) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  position,
  onResize,
}) => {
  const getPositionClasses = () => {
    const base = "absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-";
    
    switch (position) {
      case 'nw': return `${base}nw-resize -top-1 -left-1`;
      case 'ne': return `${base}ne-resize -top-1 -right-1`;
      case 'sw': return `${base}sw-resize -bottom-1 -left-1`;
      case 'se': return `${base}se-resize -bottom-1 -right-1`;
      case 'n': return `${base}n-resize -top-1 left-1/2 transform -translate-x-1/2`;
      case 's': return `${base}s-resize -bottom-1 left-1/2 transform -translate-x-1/2`;
      case 'e': return `${base}e-resize -right-1 top-1/2 transform -translate-y-1/2`;
      case 'w': return `${base}w-resize -left-1 top-1/2 transform -translate-y-1/2`;
      default: return base;
    }
  };

  return (
    <div
      className={getPositionClasses()}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Resize logic would go here
      }}
    />
  );
};