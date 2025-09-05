import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormSchema, FormField } from '../../types/forms';
import { AlertCircle, Check, Upload, Star, MapPin } from 'lucide-react';

interface FormPreviewProps {
  schema: FormSchema;
  showValidation?: boolean;
  interactive?: boolean;
  onSubmit?: (data: Record<string, any>) => void;
}

export const FormPreview: React.FC<FormPreviewProps> = ({
  schema,
  showValidation = false,
  interactive = false,
  onSubmit,
}) => {
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = useForm({
    mode: showValidation ? 'onChange' : 'onSubmit',
  });

  const sortedFields = [...schema.fields].sort((a, b) => a.order - b.order);
  const watchedValues = watch();

  const onSubmitForm = async (data: Record<string, any>) => {
    if (!interactive) return;

    setSubmissionStatus('submitting');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      if (onSubmit) {
        onSubmit(data);
      }
      
      setSubmissionStatus('success');
      setSubmitMessage(schema.settings.confirmationMessage || 'Form submitted successfully!');
    } catch (error) {
      setSubmissionStatus('error');
      setSubmitMessage('Failed to submit form. Please try again.');
    }
  };

  const renderField = (field: FormField) => {
    const error = errors[field.name];
    const fieldId = `field-${field.id}`;

    // Check visibility rules
    if (field.visibility) {
      const dependentValue = watchedValues[field.visibility.field];
      const shouldShow = checkVisibilityCondition(
        dependentValue,
        field.visibility.operator,
        field.visibility.value
      );
      if (!shouldShow) return null;
    }

    const commonProps = {
      id: fieldId,
      ...register(field.name, {
        required: field.required ? `${field.label} is required` : false,
        minLength: field.validation?.minLength ? {
          value: field.validation.minLength,
          message: field.validation.errorMessage || `Minimum length is ${field.validation.minLength}`
        } : undefined,
        maxLength: field.validation?.maxLength ? {
          value: field.validation.maxLength,
          message: field.validation.errorMessage || `Maximum length is ${field.validation.maxLength}`
        } : undefined,
        min: field.validation?.min ? {
          value: field.validation.min,
          message: field.validation.errorMessage || `Minimum value is ${field.validation.min}`
        } : undefined,
        max: field.validation?.max ? {
          value: field.validation.max,
          message: field.validation.errorMessage || `Maximum value is ${field.validation.max}`
        } : undefined,
        pattern: field.validation?.pattern ? {
          value: new RegExp(field.validation.pattern),
          message: field.validation.errorMessage || 'Invalid format'
        } : undefined,
      }),
      className: `
        w-full px-3 py-2 border rounded-md transition-colors
        ${error 
          ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }
        ${interactive ? 'focus:outline-none focus:ring-2' : 'bg-gray-50'}
      `,
      disabled: !interactive,
    };

    return (
      <div key={field.id} className="mb-4">
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {field.description && (
          <p className="text-sm text-gray-600 mb-2">{field.description}</p>
        )}

        {renderFieldInput(field, commonProps, setValue)}

        {error && (
          <div className="mt-1 flex items-center text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
            {error.message as string}
          </div>
        )}

        {showValidation && !error && watchedValues[field.name] && (
          <div className="mt-1 flex items-center text-sm text-green-600">
            <Check className="w-4 h-4 mr-1 flex-shrink-0" />
            Valid
          </div>
        )}
      </div>
    );
  };

  if (submissionStatus === 'success') {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-green-900 mb-2">
            Form Submitted Successfully!
          </h3>
          <p className="text-green-700">{submitMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
        {/* Form Header */}
        <div className="text-center pb-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {schema.title}
          </h1>
          {schema.description && (
            <p className="text-gray-600 max-w-lg mx-auto">
              {schema.description}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        {schema.settings.showProgressBar && sortedFields.length > 0 && (
          <div className="bg-gray-200 rounded-full h-2 mb-6">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(Object.keys(watchedValues).length / sortedFields.length) * 100}%`
              }}
            />
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-6">
          {sortedFields.map(renderField)}
        </div>

        {/* Submit Button */}
        {interactive && (
          <div className="pt-6">
            <button
              type="submit"
              disabled={submissionStatus === 'submitting' || (showValidation && !isValid)}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {submissionStatus === 'submitting' ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Submitting...
                </div>
              ) : (
                schema.settings.submitButtonText
              )}
            </button>
          </div>
        )}

        {submissionStatus === 'error' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center text-sm text-red-800">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {submitMessage}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

// Helper function to render different field input types
const renderFieldInput = (
  field: FormField, 
  commonProps: any, 
  setValue: (name: string, value: any) => void
) => {
  const { type, options, placeholder } = field;

  switch (type) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return (
        <input
          {...commonProps}
          type={type === 'phone' ? 'tel' : type}
          placeholder={placeholder}
        />
      );

    case 'textarea':
      return (
        <textarea
          {...commonProps}
          rows={3}
          placeholder={placeholder}
        />
      );

    case 'number':
    case 'currency':
      return (
        <input
          {...commonProps}
          type="number"
          step={type === 'currency' ? '0.01' : 'any'}
          placeholder={placeholder}
        />
      );

    case 'date':
      return (
        <input
          {...commonProps}
          type="date"
        />
      );

    case 'datetime':
      return (
        <input
          {...commonProps}
          type="datetime-local"
        />
      );

    case 'select':
      return (
        <select {...commonProps}>
          <option value="">
            {placeholder || `Select ${field.label.toLowerCase()}...`}
          </option>
          {options?.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'multiselect':
      return (
        <select {...commonProps} multiple size={Math.min(options?.length || 3, 5)}>
          {options?.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {options?.map((option, index) => (
            <div key={index} className="flex items-center">
              <input
                {...commonProps}
                id={`${commonProps.id}-${index}`}
                type="radio"
                value={option.value}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label
                htmlFor={`${commonProps.id}-${index}`}
                className="ml-2 text-sm text-gray-700"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-2">
          {options?.map((option, index) => (
            <div key={index} className="flex items-center">
              <input
                {...commonProps}
                id={`${commonProps.id}-${index}`}
                type="checkbox"
                value={option.value}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor={`${commonProps.id}-${index}`}
                className="ml-2 text-sm text-gray-700"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      );

    case 'file':
      return (
        <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="flex text-sm text-gray-600">
              <label
                htmlFor={commonProps.id}
                className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
              >
                <span>Upload a file</span>
                <input {...commonProps} type="file" className="sr-only" />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">
              {field.validation?.pattern || 'Any file type'}
            </p>
          </div>
        </div>
      );

    case 'rating':
      return (
        <div className="flex items-center space-x-1">
          {Array.from({ length: field.validation?.max || 5 }).map((_, index) => (
            <button
              key={index}
              type="button"
              className="text-gray-300 hover:text-yellow-400 transition-colors"
              onClick={() => setValue(field.name, index + 1)}
            >
              <Star className="w-6 h-6 fill-current" />
            </button>
          ))}
        </div>
      );

    case 'signature':
      return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <div className="text-gray-500">
            <div className="mb-2">✍️</div>
            <p>Signature pad would appear here</p>
          </div>
        </div>
      );

    case 'location':
      return (
        <div className="space-y-2">
          <div className="flex items-center p-3 border border-gray-300 rounded-md bg-gray-50">
            <MapPin className="w-4 h-4 text-gray-500 mr-2" />
            <span className="text-sm text-gray-600">Location picker would appear here</span>
          </div>
        </div>
      );

    default:
      return (
        <input
          {...commonProps}
          type="text"
          placeholder={placeholder}
        />
      );
  }
};

// Helper function to check visibility conditions
const checkVisibilityCondition = (
  value: any,
  operator: string,
  conditionValue: any
): boolean => {
  switch (operator) {
    case 'equals':
      return value === conditionValue;
    case 'not_equals':
      return value !== conditionValue;
    case 'contains':
      return String(value).includes(String(conditionValue));
    case 'greater_than':
      return Number(value) > Number(conditionValue);
    case 'less_than':
      return Number(value) < Number(conditionValue);
    default:
      return true;
  }
};