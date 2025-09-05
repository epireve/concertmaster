/**
 * Field Renderer Component for Visual Builder
 * Renders form fields with live preview and styling
 */

import React from 'react';
import { FormField, FormFieldType } from '../../types/forms';
import { 
  Type, AlignLeft, Mail, Hash, ChevronDown, CheckSquare, 
  Calendar, Upload, Link, Phone, DollarSign, Star, 
  Grid3x3, PenTool, MapPin 
} from 'lucide-react';

interface FieldRendererProps {
  field: FormField;
  isSelected: boolean;
  isPreview: boolean;
  styling?: any;
  form?: any;
  onUpdate?: (updates: Partial<FormField>) => void;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  isSelected,
  isPreview,
  styling,
  form,
  onUpdate,
}) => {
  const fieldStyle = {
    ...styling,
    ...field.styling,
    borderRadius: field.styling?.borderRadius || styling?.borderRadius || '6px',
    borderColor: isSelected ? '#3b82f6' : '#d1d5db',
    borderWidth: isSelected ? '2px' : '1px',
  };

  // Get field icon
  const getFieldIcon = (type: FormFieldType) => {
    const icons: Record<FormFieldType, React.ComponentType<any>> = {
      text: Type,
      textarea: AlignLeft,
      email: Mail,
      number: Hash,
      select: ChevronDown,
      multiselect: ChevronDown,
      radio: CheckSquare,
      checkbox: CheckSquare,
      date: Calendar,
      datetime: Calendar,
      file: Upload,
      url: Link,
      phone: Phone,
      currency: DollarSign,
      rating: Star,
      matrix: Grid3x3,
      signature: PenTool,
      location: MapPin,
    };
    return icons[type] || Type;
  };

  const IconComponent = getFieldIcon(field.type);

  // Render field label
  const renderLabel = () => (
    <div className="flex items-center space-x-2 mb-2">
      <IconComponent className="w-4 h-4 text-gray-500" />
      <label className="block text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
    </div>
  );

  // Render field description
  const renderDescription = () => {
    if (!field.description) return null;
    return (
      <p className="text-xs text-gray-500 mt-1">{field.description}</p>
    );
  };

  // Render placeholder text for design mode
  const renderPlaceholder = () => {
    if (isPreview) return null;
    return (
      <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
        {field.type}
      </div>
    );
  };

  // Render different field types
  const renderFieldInput = () => {
    const commonProps = {
      className: `w-full px-3 py-2 border rounded-md text-sm ${
        isPreview 
          ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
          : 'border-gray-200 bg-gray-50 cursor-default'
      }`,
      placeholder: field.placeholder || `Enter ${field.label.toLowerCase()}...`,
      disabled: !isPreview,
      style: fieldStyle,
    };

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            {...commonProps}
            defaultValue={isPreview ? '' : 'Sample text input'}
          />
        );

      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={3}
            defaultValue={isPreview ? '' : 'Sample textarea content'}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            {...commonProps}
            defaultValue={isPreview ? '' : 'user@example.com'}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            {...commonProps}
            defaultValue={isPreview ? '' : '123'}
          />
        );

      case 'select':
        return (
          <select {...commonProps}>
            <option value="">Choose an option...</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            )) || [
              <option key="1" value="option1">Option 1</option>,
              <option key="2" value="option2">Option 2</option>,
              <option key="3" value="option3">Option 3</option>,
            ]}
          </select>
        );

      case 'multiselect':
        return (
          <select {...commonProps} multiple size={3}>
            {field.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            )) || [
              <option key="1" value="option1">Option 1</option>,
              <option key="2" value="option2">Option 2</option>,
              <option key="3" value="option3">Option 3</option>,
            ]}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={field.name}
                  value={option.value}
                  disabled={!isPreview}
                  className="text-blue-600"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            )) || [
              <label key="1" className="flex items-center space-x-2">
                <input type="radio" name={field.name} disabled={!isPreview} className="text-blue-600" />
                <span className="text-sm">Option 1</span>
              </label>,
              <label key="2" className="flex items-center space-x-2">
                <input type="radio" name={field.name} disabled={!isPreview} className="text-blue-600" />
                <span className="text-sm">Option 2</span>
              </label>,
            ]}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={option.value}
                  disabled={!isPreview}
                  className="text-blue-600"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            )) || [
              <label key="1" className="flex items-center space-x-2">
                <input type="checkbox" disabled={!isPreview} className="text-blue-600" />
                <span className="text-sm">Option 1</span>
              </label>,
              <label key="2" className="flex items-center space-x-2">
                <input type="checkbox" disabled={!isPreview} className="text-blue-600" />
                <span className="text-sm">Option 2</span>
              </label>,
            ]}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            {...commonProps}
            defaultValue={isPreview ? '' : '2023-12-25'}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            {...commonProps}
            defaultValue={isPreview ? '' : '2023-12-25T12:00'}
          />
        );

      case 'file':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <div className="text-sm text-gray-600">
              {isPreview ? 'Click to upload or drag and drop' : 'File upload area'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {field.validation?.allowedTypes?.join(', ') || 'Any file type'}
            </div>
          </div>
        );

      case 'url':
        return (
          <input
            type="url"
            {...commonProps}
            defaultValue={isPreview ? '' : 'https://example.com'}
          />
        );

      case 'phone':
        return (
          <input
            type="tel"
            {...commonProps}
            defaultValue={isPreview ? '' : '+1 (555) 123-4567'}
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              {...commonProps}
              className={`pl-10 ${commonProps.className}`}
              defaultValue={isPreview ? '' : '99.99'}
              step="0.01"
            />
          </div>
        );

      case 'rating':
        return (
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-6 h-6 cursor-pointer ${
                  isPreview 
                    ? 'text-gray-300 hover:text-yellow-400' 
                    : 'text-yellow-400'
                }`}
                fill={!isPreview && star <= 3 ? 'currentColor' : 'none'}
              />
            ))}
          </div>
        );

      case 'matrix':
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
                    Question
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
                    Option 1
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
                    Option 2
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
                    Option 3
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 text-sm">Row 1</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <input type="radio" disabled={!isPreview} />
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <input type="radio" disabled={!isPreview} />
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <input type="radio" disabled={!isPreview} />
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2 text-sm">Row 2</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <input type="radio" disabled={!isPreview} />
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <input type="radio" disabled={!isPreview} />
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <input type="radio" disabled={!isPreview} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      case 'signature':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
            <PenTool className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <div className="text-sm text-gray-600">
              {isPreview ? 'Click to sign' : 'Signature pad area'}
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-3">
            <input
              type="text"
              {...commonProps}
              placeholder="Enter address..."
              defaultValue={isPreview ? '' : '123 Main St, City, State'}
            />
            <div className="h-32 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center">
              <MapPin className="w-8 h-8 text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Map view</span>
            </div>
          </div>
        );

      default:
        return (
          <input
            type="text"
            {...commonProps}
            defaultValue={isPreview ? '' : 'Unknown field type'}
          />
        );
    }
  };

  return (
    <div className="relative">
      {renderPlaceholder()}
      {renderLabel()}
      {renderFieldInput()}
      {renderDescription()}
    </div>
  );
};