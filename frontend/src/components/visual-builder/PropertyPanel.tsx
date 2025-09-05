/**
 * Advanced Property Panel for Visual Builder
 * Features: Field properties, styling options, validation settings
 */

import React, { useState } from 'react';
import { FormField } from '../../types/forms';
import { 
  Settings, Trash2, Copy, Eye, Type, Palette, ChevronDown 
} from 'lucide-react';

import { Shield, Layout, Accessibility, ChevronRight } from '../../utils/iconFallbacks';

interface PropertyPanelProps {
  selectedField: FormField | null;
  selectedSection: string | null;
  form: any;
  onFieldUpdate: (fieldId: string, updates: Partial<FormField>) => void;
  onFieldDelete: (fieldId: string) => void;
  onFieldDuplicate: (fieldId: string) => void;
  onClearSelection: () => void;
}

type PropertyTab = 'basic' | 'styling' | 'validation' | 'accessibility' | 'advanced';

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedField,
  selectedSection,
  form,
  onFieldUpdate,
  onFieldDelete,
  onFieldDuplicate,
  onClearSelection,
}) => {
  const [activeTab, setActiveTab] = useState<PropertyTab>('basic');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['general']));

  if (!selectedField && !selectedSection) {
    return null;
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleFieldUpdate = (updates: Partial<FormField>) => {
    if (selectedField) {
      onFieldUpdate(selectedField.id, updates);
    }
  };

  const tabs = [
    { id: 'basic' as const, label: 'Basic', icon: Settings },
    { id: 'styling' as const, label: 'Style', icon: Palette },
    { id: 'validation' as const, label: 'Validation', icon: Shield },
    { id: 'accessibility' as const, label: 'A11y', icon: Accessibility },
    { id: 'advanced' as const, label: 'Advanced', icon: Layout },
  ];

  const renderBasicProperties = () => {
    if (!selectedField) return null;

    return (
      <div className="space-y-6">
        {/* General Properties */}
        <PropertySection
          title="General"
          icon={Settings}
          expanded={expandedSections.has('general')}
          onToggle={() => toggleSection('general')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Label
              </label>
              <input
                type="text"
                value={selectedField.label}
                onChange={(e) => handleFieldUpdate({ label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Name
              </label>
              <input
                type="text"
                value={selectedField.name}
                onChange={(e) => handleFieldUpdate({ name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placeholder Text
              </label>
              <input
                type="text"
                value={selectedField.placeholder || ''}
                onChange={(e) => handleFieldUpdate({ placeholder: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Enter placeholder text..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={selectedField.description || ''}
                onChange={(e) => handleFieldUpdate({ description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Help text for this field..."
              />
            </div>

            <div className="flex items-center space-x-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedField.required}
                  onChange={(e) => handleFieldUpdate({ required: e.target.checked })}
                  className="text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">Required field</span>
              </label>
            </div>
          </div>
        </PropertySection>

        {/* Field-specific Options */}
        {(selectedField.type === 'select' || selectedField.type === 'radio' || selectedField.type === 'checkbox') && (
          <PropertySection
            title="Options"
            icon={Type}
            expanded={expandedSections.has('options')}
            onToggle={() => toggleSection('options')}
          >
            <div className="space-y-3">
              {selectedField.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => {
                      const newOptions = [...(selectedField.options || [])];
                      newOptions[index] = { ...option, label: e.target.value };
                      handleFieldUpdate({ options: newOptions });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Option label"
                  />
                  <input
                    type="text"
                    value={option.value}
                    onChange={(e) => {
                      const newOptions = [...(selectedField.options || [])];
                      newOptions[index] = { ...option, value: e.target.value };
                      handleFieldUpdate({ options: newOptions });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => {
                      const newOptions = selectedField.options?.filter((_, i) => i !== index);
                      handleFieldUpdate({ options: newOptions });
                    }}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )) || []}
              
              <button
                onClick={() => {
                  const newOptions = [
                    ...(selectedField.options || []),
                    { label: `Option ${(selectedField.options?.length || 0) + 1}`, value: `option${(selectedField.options?.length || 0) + 1}` }
                  ];
                  handleFieldUpdate({ options: newOptions });
                }}
                className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-gray-400"
              >
                + Add Option
              </button>
            </div>
          </PropertySection>
        )}
      </div>
    );
  };

  const renderStylingProperties = () => {
    if (!selectedField) return null;

    return (
      <div className="space-y-6">
        <PropertySection
          title="Appearance"
          icon={Palette}
          expanded={expandedSections.has('appearance')}
          onToggle={() => toggleSection('appearance')}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width
                </label>
                <select
                  value={selectedField.styling?.width || '100%'}
                  onChange={(e) => handleFieldUpdate({ 
                    styling: { ...selectedField.styling, width: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="100%">Full Width</option>
                  <option value="75%">75%</option>
                  <option value="50%">Half Width</option>
                  <option value="25%">25%</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height
                </label>
                <input
                  type="text"
                  value={selectedField.styling?.height || 'auto'}
                  onChange={(e) => handleFieldUpdate({ 
                    styling: { ...selectedField.styling, height: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="auto"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Padding
                </label>
                <input
                  type="text"
                  value={selectedField.styling?.padding || '12px'}
                  onChange={(e) => handleFieldUpdate({ 
                    styling: { ...selectedField.styling, padding: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="12px"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Margin
                </label>
                <input
                  type="text"
                  value={selectedField.styling?.margin || '16px 0'}
                  onChange={(e) => handleFieldUpdate({ 
                    styling: { ...selectedField.styling, margin: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="16px 0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Border Radius
              </label>
              <input
                type="text"
                value={selectedField.styling?.borderRadius || '6px'}
                onChange={(e) => handleFieldUpdate({ 
                  styling: { ...selectedField.styling, borderRadius: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="6px"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Background Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={selectedField.styling?.backgroundColor || '#ffffff'}
                  onChange={(e) => handleFieldUpdate({ 
                    styling: { ...selectedField.styling, backgroundColor: e.target.value }
                  })}
                  className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={selectedField.styling?.backgroundColor || '#ffffff'}
                  onChange={(e) => handleFieldUpdate({ 
                    styling: { ...selectedField.styling, backgroundColor: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </div>
        </PropertySection>
      </div>
    );
  };

  const renderValidationProperties = () => {
    if (!selectedField) return null;

    return (
      <div className="space-y-6">
        <PropertySection
          title="Validation Rules"
          icon={Shield}
          expanded={expandedSections.has('validation')}
          onToggle={() => toggleSection('validation')}
        >
          <div className="space-y-4">
            {selectedField.type === 'text' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Length
                    </label>
                    <input
                      type="number"
                      value={selectedField.validation?.minLength || ''}
                      onChange={(e) => handleFieldUpdate({ 
                        validation: { 
                          ...selectedField.validation, 
                          minLength: e.target.value ? parseInt(e.target.value) : undefined 
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Length
                    </label>
                    <input
                      type="number"
                      value={selectedField.validation?.maxLength || ''}
                      onChange={(e) => handleFieldUpdate({ 
                        validation: { 
                          ...selectedField.validation, 
                          maxLength: e.target.value ? parseInt(e.target.value) : undefined 
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern (Regex)
                  </label>
                  <input
                    type="text"
                    value={selectedField.validation?.pattern || ''}
                    onChange={(e) => handleFieldUpdate({ 
                      validation: { ...selectedField.validation, pattern: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="^[A-Za-z]+$"
                  />
                </div>
              </>
            )}

            {selectedField.type === 'number' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Value
                  </label>
                  <input
                    type="number"
                    value={selectedField.validation?.min || ''}
                    onChange={(e) => handleFieldUpdate({ 
                      validation: { 
                        ...selectedField.validation, 
                        min: e.target.value ? parseInt(e.target.value) : undefined 
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Value
                  </label>
                  <input
                    type="number"
                    value={selectedField.validation?.max || ''}
                    onChange={(e) => handleFieldUpdate({ 
                      validation: { 
                        ...selectedField.validation, 
                        max: e.target.value ? parseInt(e.target.value) : undefined 
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Error Message
              </label>
              <textarea
                value={selectedField.validation?.message || ''}
                onChange={(e) => handleFieldUpdate({ 
                  validation: { ...selectedField.validation, message: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={2}
                placeholder="Custom error message..."
              />
            </div>
          </div>
        </PropertySection>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Properties</h3>
          <button
            onClick={onClearSelection}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        {selectedField && (
          <div className="flex items-center space-x-2 mb-3">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {selectedField.label}
              </div>
              <div className="text-xs text-gray-500 capitalize">
                {selectedField.type} field
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => onFieldDuplicate(selectedField.id)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title="Duplicate field"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => onFieldDelete(selectedField.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Delete field"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <IconComponent className="w-3 h-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'basic' && renderBasicProperties()}
        {activeTab === 'styling' && renderStylingProperties()}
        {activeTab === 'validation' && renderValidationProperties()}
        {activeTab === 'accessibility' && (
          <div className="text-center py-8 text-gray-500">
            Accessibility properties coming soon
          </div>
        )}
        {activeTab === 'advanced' && (
          <div className="text-center py-8 text-gray-500">
            Advanced properties coming soon
          </div>
        )}
      </div>
    </div>
  );
};

interface PropertySectionProps {
  title: string;
  icon: React.ComponentType<any>;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const PropertySection: React.FC<PropertySectionProps> = ({
  title,
  icon: IconComponent,
  expanded,
  onToggle,
  children,
}) => (
  <div className="border border-gray-200 rounded-lg">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
    >
      <div className="flex items-center space-x-2">
        <IconComponent className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900">{title}</span>
      </div>
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-gray-500" />
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-500" />
      )}
    </button>
    {expanded && (
      <div className="p-3 border-t border-gray-200">
        {children}
      </div>
    )}
  </div>
);