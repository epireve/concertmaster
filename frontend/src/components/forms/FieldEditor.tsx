import React from 'react';
import { FormField, FormFieldType, FormOption, FormValidation } from '../../types/forms';
import { Trash2, Copy, Settings, Plus, Minus } from 'lucide-react';

interface FieldEditorProps {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export const FieldEditor: React.FC<FieldEditorProps> = ({
  field,
  onChange,
  onDelete,
  onDuplicate,
}) => {
  const updateValidation = (updates: Partial<FormValidation>) => {
    const newValidation = { ...field.validation, ...updates };
    onChange({ validation: newValidation });
  };

  const updateOptions = (options: FormOption[]) => {
    onChange({ options });
  };

  const addOption = () => {
    const newOption: FormOption = {
      label: `Option ${(field.options?.length || 0) + 1}`,
      value: `option_${(field.options?.length || 0) + 1}`,
    };
    updateOptions([...(field.options || []), newOption]);
  };

  const removeOption = (index: number) => {
    const newOptions = [...(field.options || [])];
    newOptions.splice(index, 1);
    updateOptions(newOptions);
  };

  const updateOption = (index: number, updates: Partial<FormOption>) => {
    const newOptions = [...(field.options || [])];
    newOptions[index] = { ...newOptions[index], ...updates };
    updateOptions(newOptions);
  };

  const hasOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(field.type);
  const hasValidation = !['checkbox', 'signature'].includes(field.type);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-medium text-gray-900">Field Properties</h3>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={onDuplicate}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Duplicate Field"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete Field"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic Properties */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Field Label
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Field Name (ID)
          </label>
          <input
            type="text"
            value={field.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Placeholder Text
          </label>
          <input
            type="text"
            value={field.placeholder || ''}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter placeholder text..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={field.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            placeholder="Help text for this field..."
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="required"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="required" className="ml-2 text-xs text-gray-700">
            Required field
          </label>
        </div>

        {/* Options for select, radio, checkbox fields */}
        {hasOptions && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700">
                Options
              </label>
              <button
                onClick={addOption}
                className="inline-flex items-center px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Option
              </button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(field.options || []).map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => updateOption(index, { 
                      label: e.target.value,
                      value: e.target.value.toLowerCase().replace(/\s+/g, '_')
                    })}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Option ${index + 1}`}
                  />
                  <button
                    onClick={() => removeOption(index)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {(!field.options || field.options.length === 0) && (
              <div className="text-xs text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded">
                No options added yet
              </div>
            )}
          </div>
        )}

        {/* Validation Rules */}
        {hasValidation && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Validation Rules
            </label>
            
            <div className="space-y-3">
              {(field.type === 'text' || field.type === 'textarea') && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Min Length
                      </label>
                      <input
                        type="number"
                        value={field.validation?.minLength || ''}
                        onChange={(e) => updateValidation({ 
                          minLength: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Max Length
                      </label>
                      <input
                        type="number"
                        value={field.validation?.maxLength || ''}
                        onChange={(e) => updateValidation({ 
                          maxLength: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                      />
                    </div>
                  </div>
                </>
              )}

              {field.type === 'number' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Minimum
                    </label>
                    <input
                      type="number"
                      value={field.validation?.min || ''}
                      onChange={(e) => updateValidation({ 
                        min: e.target.value ? parseFloat(e.target.value) : undefined 
                      })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Maximum
                    </label>
                    <input
                      type="number"
                      value={field.validation?.max || ''}
                      onChange={(e) => updateValidation({ 
                        max: e.target.value ? parseFloat(e.target.value) : undefined 
                      })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Pattern (Regex)
                </label>
                <input
                  type="text"
                  value={field.validation?.pattern || ''}
                  onChange={(e) => updateValidation({ pattern: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                  placeholder="^[A-Z0-9]+$"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Custom Error Message
                </label>
                <input
                  type="text"
                  value={field.validation?.errorMessage || ''}
                  onChange={(e) => updateValidation({ errorMessage: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                  placeholder="This field is invalid"
                />
              </div>
            </div>
          </div>
        )}

        {/* Field-specific settings */}
        {field.type === 'file' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              File Settings
            </label>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Accepted File Types
                </label>
                <input
                  type="text"
                  value={field.validation?.pattern || ''}
                  onChange={(e) => updateValidation({ pattern: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                  placeholder=".pdf,.doc,.docx"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  value={field.validation?.max || ''}
                  onChange={(e) => updateValidation({ 
                    max: e.target.value ? parseFloat(e.target.value) : undefined 
                  })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        )}

        {field.type === 'rating' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Rating Settings
            </label>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Number of Stars
                </label>
                <input
                  type="number"
                  value={field.validation?.max || 5}
                  onChange={(e) => updateValidation({ 
                    max: e.target.value ? parseInt(e.target.value) : 5 
                  })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="10"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};