import React, { useState, useCallback } from 'react';
import { useForm, Controller, UseFormReturn } from 'react-hook-form';
import { 
  FormSchema, 
  FormField, 
  FormFieldType, 
  FormSection,
 
} from '../../types/forms';
import { FieldPalette } from './FieldPalette';
import { FieldEditor } from './FieldEditor';
import { FormPreview } from './FormPreview';
import { FormSettingsPanel } from './FormSettingsPanel';
import { Eye, Settings, Code, Save, Play } from 'lucide-react';

interface FormBuilderProps {
  initialSchema?: FormSchema;
  onSave?: (schema: FormSchema) => void;
  onPreview?: (schema: FormSchema) => void;
}

type ViewMode = 'builder' | 'preview' | 'settings' | 'code';

export const FormBuilder: React.FC<FormBuilderProps> = ({
  initialSchema,
  onSave,
  onPreview,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('builder');
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [, setDraggedField] = useState<FormFieldType | null>(null);

  // Initialize form with react-hook-form
  const form = useForm<FormSchema>({
    defaultValues: initialSchema || {
      id: crypto.randomUUID(),
      name: 'New Form',
      title: 'Untitled Form',
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
      },
      styling: {
        theme: 'default',
        primaryColor: '#3b82f6',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        font: 'Inter',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'current-user', // TODO: Get from auth context
    },
  });

  const watchedValues = form.watch();
  const fields = watchedValues.fields || [];
  const sections = watchedValues.sections || [];

  // Add field to form
  const addField = useCallback((fieldType: FormFieldType, sectionId?: string) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: fieldType,
      name: `${fieldType}_${Date.now()}`,
      label: getFieldLabel(fieldType),
      required: false,
      order: fields.length,
      section: sectionId,
    };

    form.setValue('fields', [...fields, newField]);
  }, [fields, form]);

  // Update field
  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    const updatedFields = fields.map((field: FormField) =>
      field.id === fieldId ? { ...field, ...updates } : field
    );
    form.setValue('fields', updatedFields, { shouldValidate: true, shouldDirty: true });
    
    // Update selected field if it's the one being edited
    if (selectedField?.id === fieldId) {
      setSelectedField({ ...selectedField, ...updates });
    }
  }, [fields, form, selectedField]);

  // Delete field
  const deleteField = useCallback((fieldId: string) => {
    const updatedFields = fields.filter((field: FormField) => field.id !== fieldId);
    form.setValue('fields', updatedFields);
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  }, [fields, form, selectedField]);

  // Duplicate field
  const duplicateField = useCallback((fieldId: string) => {
    const originalField = fields.find((field: FormField) => field.id === fieldId);
    if (!originalField) return;

    const duplicatedField: FormField = {
      ...originalField,
      id: crypto.randomUUID(),
      name: `${originalField.name}_copy`,
      label: `${originalField.label} (Copy)`,
      order: fields.length,
    };

    form.setValue('fields', [...fields, duplicatedField]);
  }, [fields, form]);

  // Reorder fields
  const reorderFields = useCallback((startIndex: number, endIndex: number) => {
    const reorderedFields = Array.from(fields);
    const [removed] = reorderedFields.splice(startIndex, 1);
    reorderedFields.splice(endIndex, 0, removed);

    // Update order values
    const updatedFields = reorderedFields.map((field: FormField, index: number) => ({
      ...field,
      order: index,
    }));

    form.setValue('fields', updatedFields);
  }, [fields, form]);

  // Add section
  const addSection = useCallback((title: string) => {
    const newSection: FormSection = {
      id: crypto.randomUUID(),
      title,
      order: sections.length,
    };

    form.setValue('sections', [...sections, newSection]);
    return newSection.id;
  }, [sections, form]);

  // Handle drag and drop from palette
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const fieldType = event.dataTransfer.getData('field-type') as FormFieldType;
    if (fieldType) {
      addField(fieldType);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  // Save form
  const handleSave = () => {
    const formData = form.getValues();
    onSave?.(formData);
  };

  // Preview form
  const handlePreview = () => {
    const formData = form.getValues();
    onPreview?.(formData);
    setViewMode('preview');
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar - Field Palette */}
      {viewMode === 'builder' && (
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <FieldPalette
            onFieldSelect={addField}
            onDragStart={(fieldType) => setDraggedField(fieldType)}
            onDragEnd={() => setDraggedField(null)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Controller
                name="title"
                control={form.control}
                render={({ field }) => (
                  <input
                    value={field.value || ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                    placeholder="Form Title"
                  />
                )}
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('builder')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'builder' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Builder"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={handlePreview}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'preview' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Preview"
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                onClick={() => setViewMode('settings')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'settings' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => setViewMode('code')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'code' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="View Code"
              >
                <Code className="w-4 h-4" />
              </button>

              <div className="h-6 w-px bg-gray-300" />

              <button
                onClick={handleSave}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save
              </button>

              <button
                onClick={handlePreview}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                <Play className="w-4 h-4 mr-1.5" />
                Test
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex">
          {/* Form Canvas */}
          <div 
            className="flex-1 p-6 overflow-y-auto"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {viewMode === 'builder' && (
              <FormBuilderCanvas
                fields={fields}
                sections={sections}
                selectedField={selectedField}
                onFieldSelect={setSelectedField}
                onFieldUpdate={updateField}
                onFieldDelete={deleteField}
                onFieldDuplicate={duplicateField}
                onFieldReorder={reorderFields}
                onSectionAdd={addSection}
                form={form}
              />
            )}

            {viewMode === 'preview' && (
              <FormPreview 
                schema={form.getValues()} 
                showValidation={true}
                interactive={true}
              />
            )}

            {viewMode === 'settings' && (
              <FormSettingsPanel form={form} />
            )}

            {viewMode === 'code' && (
              <FormCodeView schema={form.getValues()} />
            )}
          </div>

          {/* Right Sidebar - Field Properties */}
          {viewMode === 'builder' && selectedField && (
            <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
              <FieldEditor
                field={selectedField}
                onChange={(updates) => updateField(selectedField.id, updates)}
                onDelete={() => deleteField(selectedField.id)}
                onDuplicate={() => duplicateField(selectedField.id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to get default field labels
function getFieldLabel(fieldType: FormFieldType): string {
  const labels: Record<FormFieldType, string> = {
    text: 'Text Input',
    textarea: 'Text Area',
    email: 'Email',
    number: 'Number',
    select: 'Dropdown',
    multiselect: 'Multiple Select',
    radio: 'Radio Buttons',
    checkbox: 'Checkboxes',
    date: 'Date',
    datetime: 'Date & Time',
    file: 'File Upload',
    url: 'URL',
    phone: 'Phone Number',
    currency: 'Currency',
    rating: 'Rating',
    matrix: 'Matrix',
    signature: 'Signature',
    location: 'Location',
  };
  
  return labels[fieldType] || 'Field';
}

// Form Builder Canvas Component
interface FormBuilderCanvasProps {
  fields: FormField[];
  sections: FormSection[];
  selectedField: FormField | null;
  onFieldSelect: (field: FormField) => void;
  onFieldUpdate: (fieldId: string, updates: Partial<FormField>) => void;
  onFieldDelete: (fieldId: string) => void;
  onFieldDuplicate: (fieldId: string) => void;
  onFieldReorder: (startIndex: number, endIndex: number) => void;
  onSectionAdd: (title: string) => string;
  form: UseFormReturn<FormSchema>;
}

const FormBuilderCanvas: React.FC<FormBuilderCanvasProps> = ({
  fields,
  selectedField,
  onFieldSelect,
  onFieldUpdate,
  onFieldDelete,
  onFieldDuplicate,
  form,
}) => {
  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Start building your form
          </h3>
          <p className="text-gray-600 max-w-sm">
            Drag fields from the left panel or click the + button to add your first form field.
          </p>
        </div>
      </div>
    );
  }

  // Sort fields by order
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Controller
        name="description"
        control={form.control}
        render={({ field }) => (
          <div>
            <textarea
              value={field.value || ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              className="w-full p-3 border border-gray-300 rounded-md resize-none"
              placeholder="Form description (optional)"
              rows={2}
            />
          </div>
        )}
      />

      <div className="space-y-3">
        {sortedFields.map((field) => (
          <div
            key={field.id}
            className={`
              p-4 border rounded-lg cursor-pointer transition-colors
              ${selectedField?.id === field.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
            onClick={() => onFieldSelect(field)}
          >
            <FieldRenderer
              field={field}
              isSelected={selectedField?.id === field.id}
              onUpdate={(updates) => onFieldUpdate(field.id, updates)}
              onDelete={() => onFieldDelete(field.id)}
              onDuplicate={() => onFieldDuplicate(field.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Simple field renderer for the canvas
interface FieldRendererProps {
  field: FormField;
  isSelected: boolean;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="text-xs text-gray-500 mb-2">
        {field.type.charAt(0).toUpperCase() + field.type.slice(1)} Field
      </div>
      
      {/* Simplified field preview */}
      <div className="border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-500">
        {field.placeholder || `Enter ${field.label.toLowerCase()}...`}
      </div>
      
      {field.description && (
        <p className="text-xs text-gray-600 mt-1">{field.description}</p>
      )}
    </div>
  );
};

// Form Code View Component
interface FormCodeViewProps {
  schema: FormSchema;
}

const FormCodeView: React.FC<FormCodeViewProps> = ({ schema }) => {
  return (
    <div className="h-full">
      <div className="bg-gray-900 text-white p-4 rounded-lg h-full overflow-auto">
        <pre className="text-sm">
          {JSON.stringify(schema, null, 2)}
        </pre>
      </div>
    </div>
  );
};