import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { 
  Plus, 
  Settings, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  ChevronUp, 
  ChevronDown,
  GripVertical,
  Type,
  Hash,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  Circle,
  Upload,
  List,
  Palette
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';
import { Input } from './Input';
import { Select, SelectOption } from './Select';
import { Textarea } from './Textarea';
import { Checkbox } from './Checkbox';
import { Modal } from './Modal';
import { DynamicForm, FieldConfig, FieldType, DynamicFormConfig, useDynamicForm } from './DynamicForm';

// Field type definitions with icons and metadata
const FIELD_TYPES: Record<FieldType, {
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  category: 'basic' | 'choice' | 'advanced';
  defaultConfig: Partial<FieldConfig>;
}> = {
  text: {
    label: 'Text Input',
    icon: Type,
    description: 'Single line text input',
    category: 'basic',
    defaultConfig: { placeholder: 'Enter text...' },
  },
  email: {
    label: 'Email',
    icon: Mail,
    description: 'Email address input with validation',
    category: 'basic',
    defaultConfig: { placeholder: 'user@example.com' },
  },
  password: {
    label: 'Password',
    icon: Type,
    description: 'Password input field',
    category: 'basic',
    defaultConfig: { placeholder: 'Enter password...' },
  },
  number: {
    label: 'Number',
    icon: Hash,
    description: 'Numeric input field',
    category: 'basic',
    defaultConfig: { placeholder: '0' },
  },
  url: {
    label: 'URL',
    icon: Type,
    description: 'URL input with validation',
    category: 'basic',
    defaultConfig: { placeholder: 'https://example.com' },
  },
  tel: {
    label: 'Phone',
    icon: Type,
    description: 'Telephone number input',
    category: 'basic',
    defaultConfig: { placeholder: '+1 (555) 000-0000' },
  },
  textarea: {
    label: 'Long Text',
    icon: FileText,
    description: 'Multi-line text input',
    category: 'basic',
    defaultConfig: { placeholder: 'Enter your text here...', rows: 4 },
  },
  select: {
    label: 'Dropdown',
    icon: List,
    description: 'Single selection dropdown',
    category: 'choice',
    defaultConfig: { 
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
      ],
    },
  },
  multiselect: {
    label: 'Multi-Select',
    icon: List,
    description: 'Multiple selection dropdown',
    category: 'choice',
    defaultConfig: {
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
      ],
    },
  },
  checkbox: {
    label: 'Checkbox',
    icon: CheckSquare,
    description: 'Single checkbox input',
    category: 'choice',
    defaultConfig: {},
  },
  radio: {
    label: 'Radio Group',
    icon: Circle,
    description: 'Single choice from multiple options',
    category: 'choice',
    defaultConfig: {
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
      ],
    },
  },
  file: {
    label: 'File Upload',
    icon: Upload,
    description: 'File upload with drag & drop',
    category: 'advanced',
    defaultConfig: { accept: 'image/*,application/pdf', maxSize: 10 * 1024 * 1024 },
  },
  date: {
    label: 'Date',
    icon: Calendar,
    description: 'Date picker input',
    category: 'advanced',
    defaultConfig: {},
  },
  time: {
    label: 'Time',
    icon: Calendar,
    description: 'Time picker input',
    category: 'advanced',
    defaultConfig: {},
  },
  'datetime-local': {
    label: 'Date & Time',
    icon: Calendar,
    description: 'Date and time picker',
    category: 'advanced',
    defaultConfig: {},
  },
  range: {
    label: 'Range Slider',
    icon: Type,
    description: 'Numeric range input',
    category: 'advanced',
    defaultConfig: { min: 0, max: 100, step: 1 },
  },
  color: {
    label: 'Color Picker',
    icon: Palette,
    description: 'Color selection input',
    category: 'advanced',
    defaultConfig: {},
  },
  hidden: {
    label: 'Hidden Field',
    icon: EyeOff,
    description: 'Hidden input field',
    category: 'advanced',
    defaultConfig: {},
  },
};

interface FormBuilderProps {
  initialConfig?: DynamicFormConfig;
  onChange?: (config: DynamicFormConfig) => void;
  onSave?: (config: DynamicFormConfig) => void;
  className?: string;
  readOnly?: boolean;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  initialConfig,
  onChange,
  onSave,
  className,
  readOnly = false,
}) => {
  const defaultConfig: DynamicFormConfig = {
    id: `form_${Date.now()}`,
    title: 'Untitled Form',
    description: '',
    fields: [],
    layout: 'vertical',
    columns: 1,
    spacing: 'normal',
    validation: 'onChange',
    submitButton: { label: 'Submit', variant: 'primary' },
    cancelButton: { show: false },
  };
  
  const { formConfig, updateField, addField, removeField, moveField, setFormConfig } = useDynamicForm(
    initialConfig || defaultConfig
  );
  
  const [selectedField, setSelectedField] = useState<FieldConfig | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draggedField, setDraggedField] = useState<FieldConfig | null>(null);
  
  // Notify parent of changes
  React.useEffect(() => {
    onChange?.(formConfig);
  }, [formConfig, onChange]);
  
  // Field categories for the sidebar
  const fieldCategories = useMemo(() => {
    const categories: Record<string, FieldType[]> = {
      basic: [],
      choice: [],
      advanced: [],
    };
    
    Object.entries(FIELD_TYPES).forEach(([type, config]) => {
      categories[config.category].push(type as FieldType);
    });
    
    return categories;
  }, []);
  
  // Generate unique field ID
  const generateFieldId = useCallback((type: FieldType): string => {
    const existingIds = formConfig.fields?.map(f => f.id) || [];
    let counter = 1;
    let id = `${type}_${counter}`;
    
    while (existingIds.includes(id)) {
      counter++;
      id = `${type}_${counter}`;
    }
    
    return id;
  }, [formConfig.fields]);
  
  // Add new field
  const handleAddField = useCallback((type: FieldType) => {
    const fieldId = generateFieldId(type);
    const fieldTypeConfig = FIELD_TYPES[type];
    
    const newField: FieldConfig = {
      id: fieldId,
      name: fieldId,
      type,
      label: fieldTypeConfig.label,
      required: false,
      ...fieldTypeConfig.defaultConfig,
    } as FieldConfig;
    
    addField(null, newField);
    setSelectedField(newField);
    setShowFieldEditor(true);
  }, [addField, generateFieldId]);
  
  // Duplicate field
  const handleDuplicateField = useCallback((field: FieldConfig) => {
    const newId = generateFieldId(field.type);
    const duplicatedField: FieldConfig = {
      ...field,
      id: newId,
      name: newId,
      label: `${field.label} (Copy)`,
    };
    
    addField(null, duplicatedField);
  }, [addField, generateFieldId]);
  
  // Edit field
  const handleEditField = useCallback((field: FieldConfig) => {
    setSelectedField(field);
    setShowFieldEditor(true);
  }, []);
  
  // Delete field
  const handleDeleteField = useCallback((fieldId: string) => {
    removeField(fieldId);
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
      setShowFieldEditor(false);
    }
  }, [removeField, selectedField]);
  
  // Handle drag end
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    
    if (source.droppableId === 'field-types' && destination.droppableId === 'form-fields') {
      // Adding new field from sidebar
      const fieldType = result.draggableId as FieldType;
      handleAddField(fieldType);
    } else if (source.droppableId === 'form-fields' && destination.droppableId === 'form-fields') {
      // Reordering existing fields
      const field = formConfig.fields?.[source.index];
      if (field) {
        moveField(field.id, destination.index);
      }
    }
  }, [handleAddField, formConfig.fields, moveField]);
  
  // Save field edits
  const handleSaveField = useCallback((fieldData: Partial<FieldConfig>) => {
    if (!selectedField) return;
    
    updateField(selectedField.id, fieldData);
    setShowFieldEditor(false);
    setSelectedField(null);
  }, [selectedField, updateField]);
  
  // Update form settings
  const handleFormSettingsChange = useCallback((settings: Partial<DynamicFormConfig>) => {
    setFormConfig(prev => ({ ...prev, ...settings }));
  }, [setFormConfig]);
  
  return (
    <div className={clsx('form-builder h-screen flex bg-gray-50', className)}>
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Field Types Sidebar */}
        {!readOnly && (
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Field Types</h3>
              <p className="text-sm text-gray-600 mt-1">
                Drag fields to add them to your form
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {Object.entries(fieldCategories).map(([category, types]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
                    {category === 'basic' ? 'Basic Fields' :
                     category === 'choice' ? 'Choice Fields' : 'Advanced Fields'}
                  </h4>
                  
                  <Droppable droppableId="field-types" isDropDisabled>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2"
                      >
                        {types.map((type, index) => {
                          const fieldConfig = FIELD_TYPES[type];
                          const Icon = fieldConfig.icon;
                          
                          return (
                            <Draggable
                              key={type}
                              draggableId={type}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={clsx(
                                    'flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-move transition-colors',
                                    snapshot.isDragging && 'bg-blue-50 border-blue-300',
                                    'hover:bg-gray-100'
                                  )}
                                  onClick={() => !snapshot.isDragging && handleAddField(type)}
                                >
                                  <Icon className="w-5 h-5 text-gray-500 mr-3" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {fieldConfig.label}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {fieldConfig.description}
                                    </p>
                                  </div>
                                  <Plus className="w-4 h-4 text-gray-400" />
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Form Builder Area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Input
                value={formConfig.title}
                onChange={(e) => handleFormSettingsChange({ title: e.target.value })}
                className="text-lg font-semibold"
                placeholder="Form Title"
                disabled={readOnly}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                leftIcon={showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              >
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
              
              {!readOnly && onSave && (
                <Button
                  onClick={() => onSave(formConfig)}
                  leftIcon={<Settings className="w-4 h-4" />}
                >
                  Save Form
                </Button>
              )}
            </div>
          </div>
          
          {/* Form Content */}
          <div className="flex-1 overflow-auto">
            {showPreview ? (
              // Preview Mode
              <div className="p-8 max-w-4xl mx-auto">
                <DynamicForm config={formConfig} />
              </div>
            ) : (
              // Builder Mode
              <div className="p-8 max-w-4xl mx-auto">
                <Droppable droppableId="form-fields">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={clsx(
                        'min-h-96 space-y-4',
                        snapshot.isDraggingOver && 'bg-blue-50 rounded-lg'
                      )}
                    >
                      {formConfig.fields?.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <Type className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium">No fields yet</p>
                          <p className="text-sm">
                            Drag field types from the sidebar to start building your form
                          </p>
                        </div>
                      )}
                      
                      {formConfig.fields?.map((field, index) => (
                        <Draggable
                          key={field.id}
                          draggableId={field.id}
                          index={index}
                          isDragDisabled={readOnly}
                        >
                          {(provided, snapshot) => (
                            <FormFieldBuilder
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              field={field}
                              isSelected={selectedField?.id === field.id}
                              isDragging={snapshot.isDragging}
                              dragHandleProps={provided.dragHandleProps}
                              onEdit={() => handleEditField(field)}
                              onDuplicate={() => handleDuplicateField(field)}
                              onDelete={() => handleDeleteField(field.id)}
                              readOnly={readOnly}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )}
          </div>
        </div>
      </DragDropContext>
      
      {/* Field Editor Modal */}
      {selectedField && (
        <FieldEditor
          field={selectedField}
          isOpen={showFieldEditor}
          onClose={() => setShowFieldEditor(false)}
          onSave={handleSaveField}
        />
      )}
    </div>
  );
};

// Form Field Builder Component
interface FormFieldBuilderProps {
  field: FieldConfig;
  isSelected: boolean;
  isDragging: boolean;
  dragHandleProps: any;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}

const FormFieldBuilder = React.forwardRef<HTMLDivElement, FormFieldBuilderProps>(
  ({ field, isSelected, isDragging, dragHandleProps, onEdit, onDuplicate, onDelete, readOnly, ...props }, ref) => {
    const fieldTypeConfig = FIELD_TYPES[field.type];
    const Icon = fieldTypeConfig.icon;
    
    return (
      <div
        ref={ref}
        {...props}
        className={clsx(
          'relative group bg-white rounded-lg border-2 transition-colors',
          isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200',
          isDragging && 'shadow-lg',
          'hover:border-gray-300'
        )}
      >
        {/* Drag Handle */}
        {!readOnly && (
          <div
            {...dragHandleProps}
            className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move p-1 rounded hover:bg-gray-100"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}
        
        {/* Field Actions */}
        {!readOnly && (
          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
            <button
              onClick={onEdit}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="Edit field"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onDuplicate}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="Duplicate field"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-gray-100 text-red-500 hover:text-red-700"
              title="Delete field"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Field Content */}
        <div className="p-4 pt-8">
          <div className="flex items-center mb-2">
            <Icon className="w-4 h-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">
              {fieldTypeConfig.label}
            </span>
            {field.required && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </div>
          
          <div className="text-sm text-gray-900 font-medium mb-1">
            {field.label || field.name}
          </div>
          
          {field.description && (
            <div className="text-xs text-gray-500 mb-2">
              {field.description}
            </div>
          )}
          
          {/* Field Preview */}
          <div className="mt-3 opacity-75 pointer-events-none">
            <DynamicForm
              config={{
                id: 'preview',
                fields: [field],
                layout: 'vertical',
              }}
            />
          </div>
        </div>
      </div>
    );
  }
);

FormFieldBuilder.displayName = 'FormFieldBuilder';

// Field Editor Modal
interface FieldEditorProps {
  field: FieldConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: Partial<FieldConfig>) => void;
}

const FieldEditor: React.FC<FieldEditorProps> = ({ field, isOpen, onClose, onSave }) => {
  const [editedField, setEditedField] = useState<FieldConfig>(field);
  
  React.useEffect(() => {
    setEditedField(field);
  }, [field]);
  
  const handleSave = () => {
    onSave(editedField);
  };
  
  const updateField = (updates: Partial<FieldConfig>) => {
    setEditedField(prev => ({ ...prev, ...updates }));
  };
  
  const fieldTypeConfig = FIELD_TYPES[field.type];
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${fieldTypeConfig.label}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Basic Settings */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Field Name"
              value={editedField.name}
              onChange={(e) => updateField({ name: e.target.value })}
              helpText="Used as the field identifier"
            />
            
            <Input
              label="Label"
              value={editedField.label || ''}
              onChange={(e) => updateField({ label: e.target.value })}
              helpText="Displayed label for the field"
            />
            
            <Input
              label="Placeholder"
              value={editedField.placeholder || ''}
              onChange={(e) => updateField({ placeholder: e.target.value })}
              helpText="Placeholder text shown in the field"
            />
            
            <Textarea
              label="Description"
              value={editedField.description || ''}
              onChange={(e) => updateField({ description: e.target.value })}
              helpText="Help text shown below the field"
              rows={2}
            />
          </div>
          
          <div className="mt-4 flex items-center space-x-4">
            <Checkbox
              checked={editedField.required || false}
              onChange={(e) => updateField({ required: e.target.checked })}
              label="Required field"
            />
            
            <Checkbox
              checked={editedField.disabled || false}
              onChange={(e) => updateField({ disabled: e.target.checked })}
              label="Disabled"
            />
            
            <Checkbox
              checked={editedField.readOnly || false}
              onChange={(e) => updateField({ readOnly: e.target.checked })}
              label="Read only"
            />
          </div>
        </div>
        
        {/* Type-specific Settings */}
        {(field.type === 'select' || field.type === 'multiselect' || field.type === 'radio') && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Options</h3>
            <OptionsEditor
              options={(editedField as any).options || []}
              onChange={(options) => updateField({ options } as any)}
            />
          </div>
        )}
        
        {/* Validation Settings */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Validation</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(field.type === 'text' || field.type === 'textarea' || field.type === 'password') && (
              <>
                <Input
                  label="Minimum Length"
                  type="number"
                  value={editedField.validation?.minLength || ''}
                  onChange={(e) => updateField({
                    validation: { ...editedField.validation, minLength: parseInt(e.target.value) || undefined }
                  })}
                />
                
                <Input
                  label="Maximum Length"
                  type="number"
                  value={editedField.validation?.maxLength || ''}
                  onChange={(e) => updateField({
                    validation: { ...editedField.validation, maxLength: parseInt(e.target.value) || undefined }
                  })}
                />
              </>
            )}
            
            {field.type === 'number' && (
              <>
                <Input
                  label="Minimum Value"
                  type="number"
                  value={editedField.validation?.min || ''}
                  onChange={(e) => updateField({
                    validation: { ...editedField.validation, min: parseInt(e.target.value) || undefined }
                  })}
                />
                
                <Input
                  label="Maximum Value"
                  type="number"
                  value={editedField.validation?.max || ''}
                  onChange={(e) => updateField({
                    validation: { ...editedField.validation, max: parseInt(e.target.value) || undefined }
                  })}
                />
              </>
            )}
            
            <Input
              label="Pattern (RegEx)"
              value={editedField.validation?.pattern || ''}
              onChange={(e) => updateField({
                validation: { ...editedField.validation, pattern: e.target.value || undefined }
              })}
              helpText="Regular expression for validation"
            />
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Options Editor Component
interface OptionsEditorProps {
  options: Array<{ label: string; value: string }>;
  onChange: (options: Array<{ label: string; value: string }>) => void;
}

const OptionsEditor: React.FC<OptionsEditorProps> = ({ options, onChange }) => {
  const addOption = () => {
    const newOption = { label: `Option ${options.length + 1}`, value: `option${options.length + 1}` };
    onChange([...options, newOption]);
  };
  
  const updateOption = (index: number, updates: Partial<{ label: string; value: string }>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    onChange(newOptions);
  };
  
  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };
  
  const moveOption = (index: number, direction: 'up' | 'down') => {
    const newOptions = [...options];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < options.length) {
      [newOptions[index], newOptions[newIndex]] = [newOptions[newIndex], newOptions[index]];
      onChange(newOptions);
    }
  };
  
  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <div key={index} className="flex items-center space-x-2">
          <Input
            placeholder="Label"
            value={option.label}
            onChange={(e) => updateOption(index, { label: e.target.value })}
            className="flex-1"
          />
          <Input
            placeholder="Value"
            value={option.value}
            onChange={(e) => updateOption(index, { value: e.target.value })}
            className="flex-1"
          />
          
          <div className="flex space-x-1">
            <button
              onClick={() => moveOption(index, 'up')}
              disabled={index === 0}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => moveOption(index, 'down')}
              disabled={index === options.length - 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => removeOption(index)}
              className="p-1 rounded hover:bg-gray-100 text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      
      <Button
        variant="outline"
        onClick={addOption}
        leftIcon={<Plus className="w-4 h-4" />}
        size="sm"
      >
        Add Option
      </Button>
    </div>
  );
};

export default FormBuilder;