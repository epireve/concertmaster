/**
 * Grid System Component for Visual Builder
 * Provides visual grid overlay for alignment
 */

import React from 'react';

interface GridSystemProps {
  spacing: number;
  color: string;
  opacity: number;
}

export const GridSystem: React.FC<GridSystemProps> = ({
  spacing,
  color,
  opacity,
}) => {
  const gridPattern = `
    <defs>
      <pattern id="grid" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
        <path d="M ${spacing} 0 L 0 0 0 ${spacing}" fill="none" stroke="${color}" stroke-width="1" opacity="${opacity}"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  `;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full">
        <defs>
          <pattern id="grid" width={spacing} height={spacing} patternUnits="userSpaceOnUse">
            <path
              d={`M ${spacing} 0 L 0 0 0 ${spacing}`}
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity={opacity}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
};