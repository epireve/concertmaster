import React, { useState, useCallback } from 'react';
import { FormField, FormVisibilityRule } from '../../types/forms';
import { Plus, X, ChevronDown, Eye, EyeOff } from 'lucide-react';

interface ConditionalLogicBuilderProps {
  fields: FormField[];
  selectedField: FormField;
  onUpdateField: (fieldId: string, updates: Partial<FormField>) => void;
}

interface LogicRule {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  action: 'show' | 'hide' | 'require' | 'disable';
}

export const ConditionalLogicBuilder: React.FC<ConditionalLogicBuilderProps> = ({
  fields,
  selectedField,
  onUpdateField,
}) => {
  const [rules, setRules] = useState<LogicRule[]>(() => {
    // Initialize from existing visibility rules
    if (selectedField.visibility) {
      return [{
        id: crypto.randomUUID(),
        field: selectedField.visibility.field,
        operator: selectedField.visibility.operator,
        value: selectedField.visibility.value,
        action: 'show'
      }];
    }
    return [];
  });

  const [isExpanded, setIsExpanded] = useState(false);

  // Available fields for conditions (excluding current field)
  const availableFields = fields.filter(field => field.id !== selectedField.id);

  const addRule = useCallback(() => {
    const newRule: LogicRule = {
      id: crypto.randomUUID(),
      field: availableFields[0]?.id || '',
      operator: 'equals',
      value: '',
      action: 'show'
    };
    setRules(prev => [...prev, newRule]);
  }, [availableFields]);

  const updateRule = useCallback((ruleId: string, updates: Partial<LogicRule>) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  }, []);

  const removeRule = useCallback((ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
  }, []);

  const applyRules = useCallback(() => {
    if (rules.length === 0) {
      // Remove visibility rules
      onUpdateField(selectedField.id, { visibility: undefined });
      return;
    }

    // For now, support only the first rule (can be extended for complex logic)
    const firstRule = rules[0];
    const visibilityRule: FormVisibilityRule = {
      field: firstRule.field,
      operator: firstRule.operator,
      value: firstRule.value
    };

    onUpdateField(selectedField.id, { visibility: visibilityRule });
  }, [rules, selectedField.id, onUpdateField]);

  // Apply rules whenever they change
  React.useEffect(() => {
    applyRules();
  }, [applyRules]);

  const getFieldName = (fieldId: string) => {
    return fields.find(f => f.id === fieldId)?.label || fieldId;
  };

  const getOperatorLabel = (operator: string) => {
    const labels = {
      equals: 'equals',
      not_equals: 'does not equal',
      contains: 'contains',
      greater_than: 'is greater than',
      less_than: 'is less than'
    };
    return labels[operator] || operator;
  };

  const getActionLabel = (action: string) => {
    const labels = {
      show: 'Show this field',
      hide: 'Hide this field',
      require: 'Make this field required',
      disable: 'Disable this field'
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Conditional Logic</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
        >
          <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div className="text-xs text-gray-600">
            Set conditions to control when this field should be shown or hidden based on other field values.
          </div>

          {rules.length > 0 && (
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div key={rule.id} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-700">
                      Rule {index + 1}
                    </span>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Action */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Action
                      </label>
                      <select
                        value={rule.action}
                        onChange={(e) => updateRule(rule.id, { action: e.target.value as any })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="show">Show this field</option>
                        <option value="hide">Hide this field</option>
                        <option value="require">Make required</option>
                        <option value="disable">Disable field</option>
                      </select>
                    </div>

                    {/* Condition */}
                    <div className="text-xs text-gray-600">When:</div>
                    
                    {/* Field Selection */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Field
                      </label>
                      <select
                        value={rule.field}
                        onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select field...</option>
                        {availableFields.map(field => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Operator Selection */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Operator
                      </label>
                      <select
                        value={rule.operator}
                        onChange={(e) => updateRule(rule.id, { operator: e.target.value as any })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">does not equal</option>
                        <option value="contains">contains</option>
                        <option value="greater_than">is greater than</option>
                        <option value="less_than">is less than</option>
                      </select>
                    </div>

                    {/* Value Input */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Value
                      </label>
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                        placeholder="Enter value..."
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Rule Preview */}
                  <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
                    <div className="flex items-center">
                      {rule.action === 'show' ? (
                        <Eye className="w-3 h-3 mr-1" />
                      ) : (
                        <EyeOff className="w-3 h-3 mr-1" />
                      )}
                      {getActionLabel(rule.action)} when "{getFieldName(rule.field)}" {getOperatorLabel(rule.operator)} "{rule.value}"
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {availableFields.length > 0 && (
            <button
              onClick={addRule}
              className="flex items-center px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Condition
            </button>
          )}

          {availableFields.length === 0 && (
            <div className="text-xs text-gray-500 italic">
              Add more fields to the form to create conditional logic rules.
            </div>
          )}

          {rules.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <h4 className="text-xs font-medium text-yellow-800 mb-1">Logic Summary</h4>
              <div className="text-xs text-yellow-700">
                This field will be {rules[0]?.action === 'show' ? 'shown' : 'hidden'} when the conditions above are met.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Enhanced Field Editor that includes conditional logic
export const EnhancedFieldEditor: React.FC<{
  field: FormField;
  fields: FormField[];
  onChange: (field: FormField) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ field, fields, onChange, onDelete, onDuplicate }) => {
  const handleFieldUpdate = useCallback((fieldId: string, updates: Partial<FormField>) => {
    onChange({ ...field, ...updates });
  }, [field, onChange]);

  return (
    <div className="space-y-6">
      {/* Basic Field Properties */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field Label
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => handleFieldUpdate(field.id, { label: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field Name
          </label>
          <input
            type="text"
            value={field.name}
            onChange={(e) => handleFieldUpdate(field.id, { name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={field.description || ''}
            onChange={(e) => handleFieldUpdate(field.id, { description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => handleFieldUpdate(field.id, { required: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label className="ml-2 text-sm text-gray-700">Required field</label>
        </div>
      </div>

      {/* Conditional Logic Builder */}
      <ConditionalLogicBuilder
        fields={fields}
        selectedField={field}
        onUpdateField={handleFieldUpdate}
      />

      {/* Field Actions */}
      <div className="border-t border-gray-200 pt-4 flex space-x-2">
        <button
          onClick={onDuplicate}
          className="flex-1 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
};