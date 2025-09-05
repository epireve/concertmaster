import React, { useMemo, useCallback } from 'react';
import { useForm, FieldValues } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { clsx } from 'clsx';
import { Form, FormSection, FormActions } from './Form';
import {
  ControlledInput,
  ControlledSelect,
  ControlledTextarea,
  ControlledCheckbox,
  ControlledRadioGroup,
  ControlledFileUpload,
  ControlledMultiSelect,
} from './FormFields';
import { SelectOption } from './Select';
import { RadioOption } from './RadioGroup';

// Field type definitions
export type FieldType = 
  | 'text' | 'email' | 'password' | 'number' | 'url' | 'tel'
  | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio'
  | 'file' | 'date' | 'time' | 'datetime-local'
  | 'range' | 'color' | 'hidden';

export interface BaseFieldConfig {
  id: string;
  name: string;
  type: FieldType;
  label?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  defaultValue?: any;
  validation?: {
    min?: number | string;
    max?: number | string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    custom?: (value: any) => string | true;
  };
  conditional?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
  grid?: {
    colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    order?: number;
  };
}

export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export interface TextareaFieldConfig extends BaseFieldConfig {
  type: 'textarea';
  rows?: number;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  autoResize?: boolean;
  showCharacterCount?: boolean;
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select' | 'multiselect';
  options: SelectOption[] | (() => Promise<SelectOption[]>);
  clearable?: boolean;
  searchable?: boolean;
  loading?: boolean;
  loadingText?: string;
  noOptionsText?: string;
}

export interface RadioFieldConfig extends BaseFieldConfig {
  type: 'radio';
  options: RadioOption[];
  orientation?: 'horizontal' | 'vertical';
}

export interface CheckboxFieldConfig extends BaseFieldConfig {
  type: 'checkbox';
  variant?: 'default' | 'switch';
}

export interface FileFieldConfig extends BaseFieldConfig {
  type: 'file';
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  showPreview?: boolean;
  onUpload?: (file: File) => Promise<{ url: string } | { error: string }>;
}

export interface DateFieldConfig extends BaseFieldConfig {
  type: 'date' | 'time' | 'datetime-local';
  min?: string;
  max?: string;
  step?: number;
}

export interface RangeFieldConfig extends BaseFieldConfig {
  type: 'range';
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
}

export type FieldConfig = 
  | TextFieldConfig 
  | TextareaFieldConfig 
  | SelectFieldConfig 
  | RadioFieldConfig 
  | CheckboxFieldConfig 
  | FileFieldConfig
  | DateFieldConfig
  | RangeFieldConfig;

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  fields: FieldConfig[];
  conditional?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains';
    value: any;
  };
}

export interface DynamicFormConfig {
  id: string;
  title?: string;
  description?: string;
  sections?: FormSection[];
  fields?: FieldConfig[];
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: 1 | 2 | 3 | 4;
  spacing?: 'compact' | 'normal' | 'comfortable';
  submitButton?: {
    label?: string;
    variant?: 'primary' | 'secondary' | 'outline';
    loading?: boolean;
  };
  cancelButton?: {
    show?: boolean;
    label?: string;
    onCancel?: () => void;
  };
  validation?: 'onChange' | 'onBlur' | 'onSubmit' | 'all';
  persistData?: {
    enabled?: boolean;
    key?: string;
    storage?: 'localStorage' | 'sessionStorage';
  };
  onSubmit?: (data: FieldValues) => Promise<void> | void;
  onFieldChange?: (fieldName: string, value: any, allValues: FieldValues) => void;
  onSectionToggle?: (sectionId: string, collapsed: boolean) => void;
}

interface DynamicFormProps {
  config: DynamicFormConfig;
  initialData?: FieldValues;
  className?: string;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  config,
  initialData = {},
  className,
}) => {
  // Build validation schema from field configs
  const validationSchema = useMemo(() => {
    const schemaFields: Record<string, any> = {};
    
    const processFields = (fields: FieldConfig[]) => {
      fields.forEach(field => {
        let fieldSchema = yup.mixed();
        
        // Base validation
        if (field.required) {
          fieldSchema = fieldSchema.required(`${field.label || field.name} is required`);
        } else {
          fieldSchema = fieldSchema.optional();
        }
        
        // Type-specific validation
        switch (field.type) {
          case 'text':
          case 'password':
            fieldSchema = yup.string();
            if (field.validation?.minLength) {
              fieldSchema = fieldSchema.min(field.validation.minLength);
            }
            if (field.validation?.maxLength) {
              fieldSchema = fieldSchema.max(field.validation.maxLength);
            }
            if (field.validation?.pattern) {
              fieldSchema = fieldSchema.matches(new RegExp(field.validation.pattern));
            }
            break;
            
          case 'email':
            fieldSchema = yup.string().email('Please enter a valid email address');
            break;
            
          case 'url':
            fieldSchema = yup.string().url('Please enter a valid URL');
            break;
            
          case 'number':
            fieldSchema = yup.number();
            if (field.validation?.min !== undefined) {
              fieldSchema = fieldSchema.min(Number(field.validation.min));
            }
            if (field.validation?.max !== undefined) {
              fieldSchema = fieldSchema.max(Number(field.validation.max));
            }
            break;
            
          case 'checkbox':
            fieldSchema = yup.boolean();
            if (field.required) {
              fieldSchema = fieldSchema.oneOf([true], `${field.label || field.name} must be checked`);
            }
            break;
            
          case 'select':
          case 'radio':
            fieldSchema = yup.string();
            break;
            
          case 'multiselect':
            fieldSchema = yup.array();
            if (field.required) {
              fieldSchema = fieldSchema.min(1, 'Please select at least one option');
            }
            break;
            
          case 'file':
            fieldSchema = yup.mixed();
            break;
            
          case 'date':
          case 'time':
          case 'datetime-local':
            fieldSchema = yup.date();
            break;
        }
        
        // Custom validation
        if (field.validation?.custom) {
          fieldSchema = fieldSchema.test('custom', 'Validation failed', field.validation.custom);
        }
        
        if (field.required) {
          fieldSchema = fieldSchema.required(`${field.label || field.name} is required`);
        }
        
        schemaFields[field.name] = fieldSchema;
      });
    };
    
    if (config.sections) {
      config.sections.forEach(section => processFields(section.fields));
    }
    
    if (config.fields) {
      processFields(config.fields);
    }
    
    return yup.object(schemaFields);
  }, [config]);
  
  // Initialize form
  const form = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: initialData,
    mode: config.validation === 'all' ? 'all' : 
          config.validation === 'onChange' ? 'onChange' :
          config.validation === 'onBlur' ? 'onBlur' : 'onSubmit',
  });
  
  const { watch, getValues } = form;
  const watchedValues = watch();
  
  // Handle field changes
  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    config.onFieldChange?.(fieldName, value, getValues());
  }, [config, getValues]);
  
  // Check if field should be visible based on conditional rules
  const isFieldVisible = useCallback((field: FieldConfig): boolean => {
    if (!field.conditional) return true;
    
    const { field: conditionField, operator, value: conditionValue } = field.conditional;
    const currentValue = watchedValues[conditionField];
    
    switch (operator) {
      case 'equals':
        return currentValue === conditionValue;
      case 'not_equals':
        return currentValue !== conditionValue;
      case 'contains':
        return Array.isArray(currentValue) 
          ? currentValue.includes(conditionValue)
          : String(currentValue).includes(String(conditionValue));
      case 'greater_than':
        return Number(currentValue) > Number(conditionValue);
      case 'less_than':
        return Number(currentValue) < Number(conditionValue);
      default:
        return true;
    }
  }, [watchedValues]);
  
  // Check if section should be visible
  const isSectionVisible = useCallback((section: FormSection): boolean => {
    if (!section.conditional) return true;
    
    const { field: conditionField, operator, value: conditionValue } = section.conditional;
    const currentValue = watchedValues[conditionField];
    
    switch (operator) {
      case 'equals':
        return currentValue === conditionValue;
      case 'not_equals':
        return currentValue !== conditionValue;
      case 'contains':
        return Array.isArray(currentValue) 
          ? currentValue.includes(conditionValue)
          : String(currentValue).includes(String(conditionValue));
      default:
        return true;
    }
  }, [watchedValues]);
  
  // Render field component based on type
  const renderField = useCallback((field: FieldConfig) => {
    if (!isFieldVisible(field)) return null;
    
    const commonProps = {
      name: field.name,
      label: field.label,
      disabled: field.disabled,
      rules: { required: field.required },
      className: clsx(
        field.className,
        field.grid && `col-span-${field.grid.colSpan || 1}`,
        field.grid?.order && `order-${field.grid.order}`
      ),
    };
    
    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
      case 'url':
      case 'tel':
        const textField = field as TextFieldConfig;
        return (
          <ControlledInput
            {...commonProps}
            type={textField.type}
            placeholder={textField.placeholder}
            leftIcon={textField.leftIcon}
            rightIcon={textField.rightIcon}
            helpText={textField.description}
          />
        );
        
      case 'textarea':
        const textareaField = field as TextareaFieldConfig;
        return (
          <ControlledTextarea
            {...commonProps}
            placeholder={textareaField.placeholder}
            helpText={textareaField.description}
            autoResize={textareaField.autoResize}
            showCharacterCount={textareaField.showCharacterCount}
            resize={textareaField.resize}
            minRows={textareaField.rows}
          />
        );
        
      case 'select':
        const selectField = field as SelectFieldConfig;
        return (
          <ControlledSelect
            {...commonProps}
            placeholder={selectField.placeholder}
            options={Array.isArray(selectField.options) ? selectField.options : []}
            helpText={selectField.description}
            clearable={selectField.clearable}
            loading={selectField.loading}
          />
        );
        
      case 'multiselect':
        const multiselectField = field as SelectFieldConfig;
        return (
          <ControlledMultiSelect
            {...commonProps}
            placeholder={multiselectField.placeholder}
            options={Array.isArray(multiselectField.options) ? multiselectField.options : []}
            helpText={multiselectField.description}
          />
        );
        
      case 'checkbox':
        const checkboxField = field as CheckboxFieldConfig;
        return (
          <ControlledCheckbox
            {...commonProps}
            description={checkboxField.description}
            variant={checkboxField.variant}
          />
        );
        
      case 'radio':
        const radioField = field as RadioFieldConfig;
        return (
          <ControlledRadioGroup
            {...commonProps}
            description={radioField.description}
            options={radioField.options}
            orientation={radioField.orientation}
          />
        );
        
      case 'file':
        const fileField = field as FileFieldConfig;
        return (
          <ControlledFileUpload
            {...commonProps}
            description={fileField.description}
            accept={fileField.accept}
            multiple={fileField.multiple}
            maxSize={fileField.maxSize}
            maxFiles={fileField.maxFiles}
            showPreview={fileField.showPreview}
            onUpload={fileField.onUpload}
          />
        );
        
      default:
        return null;
    }
  }, [isFieldVisible]);
  
  // Handle form submission
  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await config.onSubmit?.(data);
    } catch (error) {
      console.error('Form submission failed:', error);
    }
  });
  
  const gridColumns = config.layout === 'grid' ? config.columns || 2 : 1;
  const gridClass = config.layout === 'grid' 
    ? `grid grid-cols-1 md:grid-cols-${gridColumns} gap-4`
    : '';
  
  return (
    <div className={clsx('dynamic-form', className)}>
      {config.title && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
          {config.description && (
            <p className="text-sm text-gray-600 mt-1">{config.description}</p>
          )}
        </div>
      )}
      
      <Form 
        form={form}
        onSubmit={handleSubmit}
        layout={config.layout}
        columns={config.columns}
        spacing={config.spacing}
        className="space-y-6"
      >
        {config.sections ? (
          config.sections.map(section => {
            if (!isSectionVisible(section)) return null;
            
            return (
              <FormSection
                key={section.id}
                title={section.title}
                description={section.description}
                collapsible={section.collapsible}
                defaultCollapsed={section.defaultCollapsed}
              >
                <div className={gridClass}>
                  {section.fields.map(field => (
                    <div key={field.id}>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              </FormSection>
            );
          })
        ) : (
          <div className={gridClass}>
            {config.fields?.map(field => (
              <div key={field.id}>
                {renderField(field)}
              </div>
            ))}
          </div>
        )}
        
        <FormActions
          submitLabel={config.submitButton?.label}
          submitVariant={config.submitButton?.variant}
          loading={config.submitButton?.loading}
          showCancel={config.cancelButton?.show}
          cancelLabel={config.cancelButton?.label}
          onCancel={config.cancelButton?.onCancel}
        />
      </Form>
    </div>
  );
};

// Hook for managing dynamic forms
export const useDynamicForm = (config: DynamicFormConfig, initialData?: FieldValues) => {
  const [formConfig, setFormConfig] = React.useState(config);
  const [data, setData] = React.useState(initialData || {});
  
  const updateField = useCallback((fieldId: string, updates: Partial<FieldConfig>) => {
    setFormConfig(prev => {
      const newConfig = { ...prev };
      
      // Update in sections
      if (newConfig.sections) {
        newConfig.sections = newConfig.sections.map(section => ({
          ...section,
          fields: section.fields.map(field => 
            field.id === fieldId ? { ...field, ...updates } : field
          ),
        }));
      }
      
      // Update in root fields
      if (newConfig.fields) {
        newConfig.fields = newConfig.fields.map(field => 
          field.id === fieldId ? { ...field, ...updates } : field
        );
      }
      
      return newConfig;
    });
  }, []);
  
  const addField = useCallback((sectionId: string | null, field: FieldConfig, index?: number) => {
    setFormConfig(prev => {
      const newConfig = { ...prev };
      
      if (sectionId && newConfig.sections) {
        newConfig.sections = newConfig.sections.map(section => {
          if (section.id === sectionId) {
            const fields = [...section.fields];
            if (index !== undefined) {
              fields.splice(index, 0, field);
            } else {
              fields.push(field);
            }
            return { ...section, fields };
          }
          return section;
        });
      } else if (!sectionId && newConfig.fields) {
        const fields = [...newConfig.fields];
        if (index !== undefined) {
          fields.splice(index, 0, field);
        } else {
          fields.push(field);
        }
        newConfig.fields = fields;
      }
      
      return newConfig;
    });
  }, []);
  
  const removeField = useCallback((fieldId: string) => {
    setFormConfig(prev => {
      const newConfig = { ...prev };
      
      // Remove from sections
      if (newConfig.sections) {
        newConfig.sections = newConfig.sections.map(section => ({
          ...section,
          fields: section.fields.filter(field => field.id !== fieldId),
        }));
      }
      
      // Remove from root fields
      if (newConfig.fields) {
        newConfig.fields = newConfig.fields.filter(field => field.id !== fieldId);
      }
      
      return newConfig;
    });
  }, []);
  
  const moveField = useCallback((fieldId: string, direction: 'up' | 'down' | number) => {
    setFormConfig(prev => {
      const newConfig = { ...prev };
      
      const moveInArray = (fields: FieldConfig[]) => {
        const index = fields.findIndex(f => f.id === fieldId);
        if (index === -1) return fields;
        
        let newIndex: number;
        if (typeof direction === 'number') {
          newIndex = direction;
        } else {
          newIndex = direction === 'up' ? index - 1 : index + 1;
        }
        
        newIndex = Math.max(0, Math.min(fields.length - 1, newIndex));
        
        const newFields = [...fields];
        const [movedField] = newFields.splice(index, 1);
        newFields.splice(newIndex, 0, movedField);
        
        return newFields;
      };
      
      // Move in sections
      if (newConfig.sections) {
        newConfig.sections = newConfig.sections.map(section => ({
          ...section,
          fields: moveInArray(section.fields),
        }));
      }
      
      // Move in root fields
      if (newConfig.fields) {
        newConfig.fields = moveInArray(newConfig.fields);
      }
      
      return newConfig;
    });
  }, []);
  
  return {
    formConfig,
    data,
    setData,
    updateField,
    addField,
    removeField,
    moveField,
    setFormConfig,
  };
};

export default DynamicForm;