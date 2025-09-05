/**
 * Advanced Visual Canvas with Drop Zones and Live Rendering
 * Features: Drag & drop zones, live field rendering, selection indicators, grid system
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useDrop } from 'react-dnd';
import { FormField, FormSection, FormFieldType } from '../../types/forms';
import { FieldRenderer } from './FieldRenderer';
import { DropZone } from './DropZone';
import { SelectionIndicator } from './SelectionIndicator';
import { GridSystem } from './GridSystem';
import { ResizeHandle } from './ResizeHandle';
import { Plus, Copy, Trash2, Settings, Eye, EyeOff } from 'lucide-react';
import { Move } from '../../utils/iconFallbacks';

interface VisualCanvasProps {
  fields: FormField[];
  sections: FormSection[];
  styling?: any;
  layout?: any;
  selectedField: FormField | null;
  selectedSection: string | null;
  onFieldSelect: (field: FormField) => void;
  onSectionSelect: (sectionId: string) => void;
  onFieldDrop: (fieldType: FormFieldType, position: { x: number; y: number }) => void;
  onFieldUpdate: (fieldId: string, updates: Partial<FormField>) => void;
  onFieldDelete: (fieldId: string) => void;
  showGrid: boolean;
  zoom: number;
  canvasStyle: React.CSSProperties;
  form: any;
}

interface FieldPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
  fields,
  sections,
  styling,
  layout,
  selectedField,
  selectedSection,
  onFieldSelect,
  onSectionSelect,
  onFieldDrop,
  onFieldUpdate,
  onFieldDelete,
  showGrid,
  zoom,
  canvasStyle,
  form,
}) => {
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; fieldType: FormFieldType } | null>(null);
  const [fieldPositions, setFieldPositions] = useState<Record<string, FieldPosition>>({});
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [showFieldOutlines, setShowFieldOutlines] = useState(true);

  // Canvas drop zone
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'FORM_FIELD',
    drop: (item: { fieldType: FormFieldType }, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = (drop.current as any)?.getBoundingClientRect();
      
      if (offset && canvasRect) {
        const x = offset.x - canvasRect.left;
        const y = offset.y - canvasRect.top;
        onFieldDrop(item.fieldType, { x, y });
      }
    },
    hover: (item: { fieldType: FormFieldType }, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = (drop.current as any)?.getBoundingClientRect();
      
      if (offset && canvasRect) {
        const x = offset.x - canvasRect.left;
        const y = offset.y - canvasRect.top;
        setDragPreview({ x, y, fieldType: item.fieldType });
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  // Calculate field layout based on responsive settings
  const calculateFieldLayout = useMemo(() => {
    const containerWidth = 800; // Default canvas width
    const columns = layout?.columns || 1;
    const fieldWidth = containerWidth / columns;
    const fieldHeight = 80;
    const spacing = 20;

    return fields.map((field, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      
      return {
        ...field,
        position: field.position || {
          x: col * fieldWidth + spacing,
          y: row * (fieldHeight + spacing) + spacing,
        },
        width: fieldWidth - spacing,
        height: fieldHeight,
      };
    });
  }, [fields, layout]);

  // Handle field position updates
  const handleFieldMove = useCallback((fieldId: string, newPosition: { x: number; y: number }) => {
    onFieldUpdate(fieldId, { position: newPosition });
  }, [onFieldUpdate]);

  // Handle field resize
  const handleFieldResize = useCallback((fieldId: string, newSize: { width: number; height: number }) => {
    const currentField = fields.find(f => f.id === fieldId);
    if (currentField) {
      onFieldUpdate(fieldId, {
        styling: {
          ...currentField.styling,
          width: `${newSize.width}px`,
          height: `${newSize.height}px`,
        },
      });
    }
  }, [fields, onFieldUpdate]);

  // Canvas click handler
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    // Only clear selection if clicking on empty canvas
    if (event.target === event.currentTarget) {
      onFieldSelect(null as any);
      onSectionSelect(null as any);
    }
  }, [onFieldSelect, onSectionSelect]);

  // Field context menu actions
  const fieldActions = useMemo(() => [
    {
      label: 'Edit Properties',
      icon: Settings,
      action: (field: FormField) => onFieldSelect(field),
    },
    {
      label: 'Duplicate',
      icon: Copy,
      action: (field: FormField) => {
        // Duplicate logic would go here
        console.log('Duplicate field:', field.id);
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      action: (field: FormField) => onFieldDelete(field.id),
      destructive: true,
    },
  ], [onFieldSelect, onFieldDelete]);

  // Empty canvas state
  const EmptyCanvas = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Plus className="w-10 h-10 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Start Building Your Form
        </h3>
        <p className="text-gray-600 mb-4">
          Drag components from the palette on the left to start creating your form. 
          You can also click the + button on components for quick adding.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          💡 Tip: Use the grid system and snap-to-grid for precise alignment
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full relative overflow-auto bg-gray-50">
      {/* Canvas Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
        <button
          onClick={() => setShowFieldOutlines(!showFieldOutlines)}
          className={`p-2 rounded-md transition-colors ${
            showFieldOutlines 
              ? 'bg-blue-100 text-blue-600' 
              : 'bg-white text-gray-400 hover:text-gray-600'
          } shadow-sm border border-gray-200`}
          title="Toggle field outlines"
        >
          {showFieldOutlines ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        
        <div className="bg-white px-3 py-1 rounded-md shadow-sm border border-gray-200 text-sm text-gray-600">
          {zoom}%
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={drop}
        className={`min-h-full relative transition-all duration-200 ${
          isOver && canDrop ? 'bg-blue-50' : ''
        }`}
        style={{
          ...canvasStyle,
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
          minWidth: '100%',
          minHeight: '100%',
        }}
        onClick={handleCanvasClick}
      >
        {/* Grid System */}
        {showGrid && (
          <GridSystem 
            spacing={20} 
            color={styling?.primaryColor || '#3b82f6'}
            opacity={0.1}
          />
        )}

        {/* Drop zones between fields */}
        {fields.length > 0 && (
          <DropZone
            position="top"
            onDrop={(fieldType) => onFieldDrop(fieldType, { x: 50, y: 20 })}
            isVisible={isOver}
          />
        )}

        {/* Rendered Fields */}
        {calculateFieldLayout.length === 0 ? (
          <EmptyCanvas />
        ) : (
          <>
            {calculateFieldLayout.map((field, index) => (
              <React.Fragment key={field.id}>
                {/* Field Container */}
                <div
                  className={`absolute transition-all duration-200 ${
                    showFieldOutlines ? 'ring-1 ring-gray-200 ring-opacity-50' : ''
                  } ${
                    selectedField?.id === field.id 
                      ? 'ring-2 ring-blue-500 ring-opacity-75' 
                      : hoveredField === field.id 
                      ? 'ring-1 ring-blue-300' 
                      : ''
                  }`}
                  style={{
                    left: field.position?.x || 0,
                    top: field.position?.y || 0,
                    width: field.width,
                    minHeight: field.height,
                    borderRadius: styling?.borderRadius || '8px',
                  }}
                  onMouseEnter={() => setHoveredField(field.id)}
                  onMouseLeave={() => setHoveredField(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFieldSelect(field);
                  }}
                >
                  {/* Selection Indicator */}
                  {selectedField?.id === field.id && (
                    <SelectionIndicator
                      bounds={{ 
                        width: field.width, 
                        height: field.height || 80 
                      }}
                      onMove={(delta) => handleFieldMove(field.id, {
                        x: (field.position?.x || 0) + delta.x,
                        y: (field.position?.y || 0) + delta.y,
                      })}
                      onResize={(newSize) => handleFieldResize(field.id, newSize)}
                      actions={fieldActions}
                      field={field}
                    />
                  )}

                  {/* Field Content */}
                  <div className="relative p-4 bg-white rounded-lg shadow-sm border border-gray-200 h-full">
                    <FieldRenderer
                      field={field}
                      isSelected={selectedField?.id === field.id}
                      isPreview={false}
                      styling={styling}
                      form={form}
                      onUpdate={(updates) => onFieldUpdate(field.id, updates)}
                    />

                    {/* Field Controls Overlay */}
                    {(hoveredField === field.id || selectedField?.id === field.id) && (
                      <div className="absolute top-2 right-2 flex items-center space-x-1">
                        <button
                          className="p-1 bg-white shadow-md rounded border border-gray-200 opacity-0 hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFieldSelect(field);
                          }}
                          title="Edit field"
                        >
                          <Settings className="w-3 h-3 text-gray-600" />
                        </button>
                        <button
                          className="p-1 bg-white shadow-md rounded border border-gray-200 opacity-0 hover:opacity-100 transition-opacity cursor-move"
                          title="Move field"
                        >
                          <Move className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Drop zone after each field */}
                <DropZone
                  position="bottom"
                  index={index}
                  onDrop={(fieldType) => onFieldDrop(fieldType, { 
                    x: field.position?.x || 0, 
                    y: (field.position?.y || 0) + (field.height || 80) + 40 
                  })}
                  isVisible={isOver}
                  style={{
                    top: (field.position?.y || 0) + (field.height || 80) + 20,
                    left: field.position?.x || 0,
                    width: field.width,
                  }}
                />
              </React.Fragment>
            ))}

            {/* Final drop zone */}
            <DropZone
              position="bottom"
              index={fields.length}
              onDrop={(fieldType) => {
                const lastField = calculateFieldLayout[calculateFieldLayout.length - 1];
                onFieldDrop(fieldType, { 
                  x: lastField?.position?.x || 50, 
                  y: (lastField?.position?.y || 0) + (lastField?.height || 80) + 60 
                });
              }}
              isVisible={isOver}
              style={{
                top: calculateFieldLayout.length > 0 
                  ? (calculateFieldLayout[calculateFieldLayout.length - 1]?.position?.y || 0) + 140
                  : 100,
                left: 50,
                width: 'calc(100% - 100px)',
              }}
            />
          </>
        )}

        {/* Drag Preview */}
        {dragPreview && (
          <div
            className="absolute pointer-events-none z-50 opacity-60"
            style={{
              left: dragPreview.x - 50,
              top: dragPreview.y - 20,
            }}
          >
            <div className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
              Adding {dragPreview.fieldType} field
            </div>
          </div>
        )}

        {/* Canvas Drop Overlay */}
        {isOver && canDrop && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-5 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center pointer-events-none z-10">
            <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-blue-200">
              <div className="flex items-center space-x-2 text-blue-600">
                <Plus className="w-5 h-5" />
                <span className="font-medium">Drop to add component</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};