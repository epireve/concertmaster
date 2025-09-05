/**
 * Enhanced Visual Form Builder with Advanced Drag & Drop
 * Features: Real-time canvas rendering, advanced property panels, component palette
 */

import React, { useState, useCallback, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useForm } from '@tanstack/react-form';
import { FormSchema, FormField, FormFieldType } from '../../types/forms';
import { ComponentPalette } from './ComponentPalette';
import { VisualCanvas } from './VisualCanvas';
import { PropertyPanel } from './PropertyPanel';
import { CanvasToolbar } from './CanvasToolbar';
import { LivePreviewPanel } from './LivePreviewPanel';
import { Eye, Code, Settings, Save, Play, Layers, Grid, Zap } from 'lucide-react';

interface VisualFormBuilderProps {
  initialSchema?: FormSchema;
  onSave?: (schema: FormSchema) => void;
  onPreview?: (schema: FormSchema) => void;
}

type ViewMode = 'design' | 'preview' | 'code' | 'responsive';
type CanvasMode = 'visual' | 'split' | 'preview';

export const VisualFormBuilder: React.FC<VisualFormBuilderProps> = ({
  initialSchema,
  onSave,
  onPreview,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('design');
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('visual');
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showLayers, setShowLayers] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [canvasBackground, setCanvasBackground] = useState('#ffffff');

  // Initialize form with enhanced default values
  const form = useForm<FormSchema>({
    defaultValues: initialSchema || {
      id: crypto.randomUUID(),
      name: 'visual-form',
      title: 'Visual Form Builder',
      description: '',
      version: '1.0.0',
      fields: [],
      sections: [],
      settings: {
        allowMultipleSubmissions: false,
        requireAuthentication: false,
        showProgressBar: true,
        savePartialResponses: true,
        submitButtonText: 'Submit',
        language: 'en',
        timezone: 'UTC',
        theme: 'modern',
        animations: true,
        responsiveDesign: true,
      },
      styling: {
        theme: 'modern',
        primaryColor: '#3b82f6',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        font: 'Inter',
        borderRadius: '8px',
        spacing: 'comfortable',
        shadows: true,
        gradients: false,
      },
      layout: {
        containerWidth: 'max-w-2xl',
        fieldSpacing: 'normal',
        sectionSpacing: 'large',
        alignment: 'left',
        columns: 1,
        responsive: {
          mobile: { columns: 1 },
          tablet: { columns: 1 },
          desktop: { columns: 1 },
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'visual-builder-user',
    },
  });

  const { fields, sections, styling, layout } = form.useStore((state) => ({
    fields: state.values.fields,
    sections: state.values.sections,
    styling: state.values.styling,
    layout: state.values.layout,
  }));

  // Enhanced field operations with visual feedback
  const addField = useCallback((fieldType: FormFieldType, position?: { x: number; y: number }, sectionId?: string) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: fieldType,
      name: `${fieldType}_${Date.now()}`,
      label: getFieldLabel(fieldType),
      required: false,
      order: fields.length,
      section: sectionId,
      styling: {
        width: '100%',
        margin: '16px 0',
        padding: '12px',
        borderRadius: styling?.borderRadius || '8px',
        fontSize: '14px',
        fontWeight: 'normal',
      },
      validation: getDefaultValidation(fieldType),
      accessibility: {
        ariaLabel: getFieldLabel(fieldType),
        description: `Enter your ${getFieldLabel(fieldType).toLowerCase()}`,
        required: false,
      },
      position: position || { x: 0, y: fields.length * 80 },
    };

    form.setFieldValue('fields', [...fields, newField]);
    setSelectedField(newField);
  }, [fields, form, styling]);

  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    const updatedFields = fields.map(field =>
      field.id === fieldId ? { ...field, ...updates, updatedAt: new Date() } : field
    );
    form.setFieldValue('fields', updatedFields);
    form.setFieldValue('updatedAt', new Date());
  }, [fields, form]);

  const deleteField = useCallback((fieldId: string) => {
    const updatedFields = fields.filter(field => field.id !== fieldId);
    form.setFieldValue('fields', updatedFields);
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  }, [fields, form, selectedField]);

  const duplicateField = useCallback((fieldId: string) => {
    const originalField = fields.find(field => field.id === fieldId);
    if (!originalField) return;

    const duplicatedField: FormField = {
      ...originalField,
      id: crypto.randomUUID(),
      name: `${originalField.name}_copy`,
      label: `${originalField.label} (Copy)`,
      order: fields.length,
      position: {
        x: originalField.position?.x || 0,
        y: (originalField.position?.y || 0) + 60,
      },
    };

    form.setFieldValue('fields', [...fields, duplicatedField]);
  }, [fields, form]);

  // Canvas operations
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    // Only clear selection if clicking on empty canvas area
    if (event.target === event.currentTarget) {
      setSelectedField(null);
      setSelectedSection(null);
    }
  }, []);

  const handleFieldDrop = useCallback((fieldType: FormFieldType, position: { x: number; y: number }) => {
    addField(fieldType, position);
  }, [addField]);

  // Save operations
  const handleSave = useCallback(() => {
    const formData = form.getFieldValue('');
    onSave?.(formData);
  }, [form, onSave]);

  const handlePreview = useCallback(() => {
    const formData = form.getFieldValue('');
    onPreview?.(formData);
  }, [form, onPreview]);

  // Memoized computed values
  const canvasStyle = useMemo(() => ({
    backgroundColor: canvasBackground,
    zoom: `${zoom}%`,
    minHeight: '600px',
  }), [canvasBackground, zoom]);

  const gridVisible = showGrid && viewMode === 'design';

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Enhanced Toolbar */}
        <CanvasToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          canvasMode={canvasMode}
          onCanvasModeChange={setCanvasMode}
          zoom={zoom}
          onZoomChange={setZoom}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          showLayers={showLayers}
          onToggleLayers={() => setShowLayers(!showLayers)}
          canvasBackground={canvasBackground}
          onBackgroundChange={setCanvasBackground}
          onSave={handleSave}
          onPreview={handlePreview}
          form={form}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Component Palette - Left Sidebar */}
          {viewMode === 'design' && (
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
              <ComponentPalette
                onFieldSelect={addField}
                selectedField={selectedField}
                form={form}
              />
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 flex flex-col relative">
            {/* Canvas Container */}
            <div 
              className="flex-1 overflow-auto"
              onClick={handleCanvasClick}
            >
              {canvasMode === 'visual' && (
                <VisualCanvas
                  fields={fields}
                  sections={sections}
                  styling={styling}
                  layout={layout}
                  selectedField={selectedField}
                  selectedSection={selectedSection}
                  onFieldSelect={setSelectedField}
                  onSectionSelect={setSelectedSection}
                  onFieldDrop={handleFieldDrop}
                  onFieldUpdate={updateField}
                  onFieldDelete={deleteField}
                  showGrid={gridVisible}
                  zoom={zoom}
                  canvasStyle={canvasStyle}
                  form={form}
                />
              )}

              {canvasMode === 'split' && (
                <div className="flex h-full">
                  <div className="flex-1 border-r border-gray-200">
                    <VisualCanvas
                      fields={fields}
                      sections={sections}
                      styling={styling}
                      layout={layout}
                      selectedField={selectedField}
                      selectedSection={selectedSection}
                      onFieldSelect={setSelectedField}
                      onSectionSelect={setSelectedSection}
                      onFieldDrop={handleFieldDrop}
                      onFieldUpdate={updateField}
                      onFieldDelete={deleteField}
                      showGrid={gridVisible}
                      zoom={zoom}
                      canvasStyle={canvasStyle}
                      form={form}
                    />
                  </div>
                  <div className="flex-1">
                    <LivePreviewPanel
                      schema={form.getFieldValue('')}
                      interactive={true}
                      showValidation={true}
                    />
                  </div>
                </div>
              )}

              {canvasMode === 'preview' && (
                <LivePreviewPanel
                  schema={form.getFieldValue('')}
                  interactive={true}
                  showValidation={true}
                />
              )}

              {viewMode === 'code' && (
                <div className="h-full p-4">
                  <pre className="bg-gray-900 text-white p-4 rounded-lg h-full overflow-auto text-sm">
                    {JSON.stringify(form.getFieldValue(''), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Property Panel - Right Sidebar */}
          {viewMode === 'design' && (selectedField || selectedSection) && (
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
              <PropertyPanel
                selectedField={selectedField}
                selectedSection={selectedSection}
                form={form}
                onFieldUpdate={updateField}
                onFieldDelete={deleteField}
                onFieldDuplicate={duplicateField}
                onClearSelection={() => {
                  setSelectedField(null);
                  setSelectedSection(null);
                }}
              />
            </div>
          )}

          {/* Layers Panel - Floating */}
          {showLayers && viewMode === 'design' && (
            <div className="absolute top-4 right-4 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Layers</h3>
                <button
                  onClick={() => setShowLayers(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                      selectedField?.id === field.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => setSelectedField(field)}
                  >
                    <div className="flex items-center space-x-2">
                      <Layers className="w-3 h-3 text-gray-400" />
                      <span className="text-sm truncate">{field.label}</span>
                      <span className="text-xs text-gray-400">{field.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );
};

// Helper functions
function getFieldLabel(fieldType: FormFieldType): string {
  const labels: Record<FormFieldType, string> = {
    text: 'Text Input',
    textarea: 'Text Area',
    email: 'Email Address',
    number: 'Number',
    select: 'Dropdown',
    multiselect: 'Multiple Select',
    radio: 'Radio Buttons',
    checkbox: 'Checkboxes',
    date: 'Date Picker',
    datetime: 'Date & Time',
    file: 'File Upload',
    url: 'URL',
    phone: 'Phone Number',
    currency: 'Currency',
    rating: 'Rating',
    matrix: 'Matrix',
    signature: 'Digital Signature',
    location: 'Location',
  };
  return labels[fieldType] || 'Field';
}

function getDefaultValidation(fieldType: FormFieldType): any {
  const validations: Record<string, any> = {
    email: { type: 'email', message: 'Please enter a valid email address' },
    number: { type: 'number', min: 0 },
    phone: { pattern: /^[\+]?[1-9][\d]{0,15}$/, message: 'Please enter a valid phone number' },
    url: { type: 'url', message: 'Please enter a valid URL' },
    file: { maxSize: '10MB', allowedTypes: ['image/*', 'application/pdf'] },
  };
  return validations[fieldType] || {};
}