import React, { useState } from 'react';
import { 
  FormBuilder, 
  DynamicForm, 
  DynamicFormConfig
} from '../shared';
import { useFormBuilder } from '../../hooks/useFormBuilder';

// Example form configurations for demonstration
const EXAMPLE_FORMS: Record<string, DynamicFormConfig> = {
  contact: {
    id: 'contact_form',
    title: 'Contact Us',
    description: 'Get in touch with our team',
    layout: 'vertical',
    spacing: 'normal',
    fields: [
      {
        id: 'name',
        name: 'name',
        type: 'text',
        label: 'Full Name',
        placeholder: 'Enter your full name',
        required: true,
      },
      {
        id: 'email',
        name: 'email',
        type: 'email',
        label: 'Email Address',
        placeholder: 'your@email.com',
        required: true,
      },
      {
        id: 'phone',
        name: 'phone',
        type: 'tel',
        label: 'Phone Number',
        placeholder: '+1 (555) 000-0000',
        required: false,
      },
      {
        id: 'subject',
        name: 'subject',
        type: 'select',
        label: 'Subject',
        required: true,
        options: [
          { label: 'General Inquiry', value: 'general' },
          { label: 'Technical Support', value: 'support' },
          { label: 'Billing Question', value: 'billing' },
          { label: 'Feature Request', value: 'feature' },
        ],
      },
      {
        id: 'message',
        name: 'message',
        type: 'textarea',
        label: 'Message',
        placeholder: 'Please describe your inquiry...',
        required: true,
        rows: 4,
      },
      {
        id: 'newsletter',
        name: 'newsletter',
        type: 'checkbox',
        label: 'Subscribe to newsletter',
        description: 'Receive updates and news from our team',
        required: false,
      },
    ],
    submitButton: {
      label: 'Send Message',
      variant: 'primary',
    },
    validation: 'onChange',
  },

  survey: {
    id: 'customer_survey',
    title: 'Customer Feedback Survey',
    description: 'Help us improve our services',
    layout: 'grid',
    columns: 2,
    spacing: 'comfortable',
    sections: [
      {
        id: 'basic_info',
        title: 'Basic Information',
        fields: [
          {
            id: 'customer_name',
            name: 'customerName',
            type: 'text',
            label: 'Your Name',
            required: true,
          },
          {
            id: 'customer_email',
            name: 'customerEmail',
            type: 'email',
            label: 'Email Address',
            required: true,
          },
          {
            id: 'customer_type',
            name: 'customerType',
            type: 'radio',
            label: 'Customer Type',
            required: true,
            options: [
              { label: 'New Customer', value: 'new' },
              { label: 'Existing Customer', value: 'existing' },
              { label: 'Former Customer', value: 'former' },
            ],
            orientation: 'horizontal',
          },
        ],
      },
      {
        id: 'feedback',
        title: 'Your Feedback',
        fields: [
          {
            id: 'satisfaction',
            name: 'satisfaction',
            type: 'range',
            label: 'Overall Satisfaction',
            required: true,
            min: 1,
            max: 10,
            step: 1,
            showValue: true,
          },
          {
            id: 'services_used',
            name: 'servicesUsed',
            type: 'multiselect',
            label: 'Services Used',
            options: [
              { label: 'Web Development', value: 'web' },
              { label: 'Mobile Development', value: 'mobile' },
              { label: 'Consulting', value: 'consulting' },
              { label: 'Support', value: 'support' },
            ],
          },
          {
            id: 'comments',
            name: 'comments',
            type: 'textarea',
            label: 'Additional Comments',
            placeholder: 'Tell us more about your experience...',
            rows: 4,
          },
          {
            id: 'recommend',
            name: 'recommend',
            type: 'checkbox',
            label: 'Would recommend to others',
            variant: 'switch',
          },
        ],
      },
    ],
    submitButton: {
      label: 'Submit Survey',
      variant: 'primary',
    },
    validation: 'onChange',
  },

  registration: {
    id: 'user_registration',
    title: 'Create Account',
    description: 'Join our platform to get started',
    layout: 'vertical',
    spacing: 'normal',
    fields: [
      {
        id: 'first_name',
        name: 'firstName',
        type: 'text',
        label: 'First Name',
        required: true,
      },
      {
        id: 'last_name',
        name: 'lastName',
        type: 'text',
        label: 'Last Name',
        required: true,
      },
      {
        id: 'email',
        name: 'email',
        type: 'email',
        label: 'Email Address',
        required: true,
      },
      {
        id: 'password',
        name: 'password',
        type: 'password',
        label: 'Password',
        required: true,
      },
      {
        id: 'confirm_password',
        name: 'confirmPassword',
        type: 'password',
        label: 'Confirm Password',
        required: true,
      },
      {
        id: 'birth_date',
        name: 'birthDate',
        type: 'date',
        label: 'Date of Birth',
        required: true,
      },
      {
        id: 'avatar',
        name: 'avatar',
        type: 'file',
        label: 'Profile Picture',
        accept: 'image/*',
        maxSize: 2 * 1024 * 1024, // 2MB
        showPreview: true,
      },
      {
        id: 'terms',
        name: 'terms',
        type: 'checkbox',
        label: 'I agree to the Terms of Service',
        required: true,
      },
    ],
    submitButton: {
      label: 'Create Account',
      variant: 'primary',
    },
    cancelButton: {
      show: true,
      label: 'Cancel',
    },
    validation: 'onChange',
  },
};

interface FormBuilderExampleProps {
  className?: string;
}

export const FormBuilderExample: React.FC<FormBuilderExampleProps> = ({ className }) => {
  const [selectedExample, setSelectedExample] = useState<string>('contact');
  const [mode, setMode] = useState<'builder' | 'preview'>('builder');
  
  const {
    config,
    updateConfig,
    isDirty,
    save: _save,
    reset: _reset,
    validation,
  } = useFormBuilder({
    initialConfig: EXAMPLE_FORMS[selectedExample],
    onChange: (newConfig) => {
      console.log('Form config updated:', newConfig);
    },
  });

  const handleExampleChange = (exampleKey: string) => {
    setSelectedExample(exampleKey);
    updateConfig(EXAMPLE_FORMS[exampleKey]);
  };

  const handleFormSubmit = async (data: any) => {
    console.log('Form submitted:', data);
    alert('Form submitted successfully! Check the console for details.');
  };

  const handleSave = async (formConfig: DynamicFormConfig) => {
    console.log('Saving form config:', formConfig);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Form Builder Demo</h1>
            <p className="text-gray-600 mt-1">
              Create and customize forms with an intuitive drag-and-drop interface
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Example selector */}
            <select
              value={selectedExample}
              onChange={(e) => handleExampleChange(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="contact">Contact Form</option>
              <option value="survey">Customer Survey</option>
              <option value="registration">User Registration</option>
            </select>
            
            {/* Mode toggle */}
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                onClick={() => setMode('builder')}
                className={`px-4 py-2 text-sm font-medium ${
                  mode === 'builder'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Builder
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`px-4 py-2 text-sm font-medium ${
                  mode === 'preview'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Preview
              </button>
            </div>
          </div>
        </div>
        
        {/* Status indicators */}
        {isDirty && (
          <div className="mt-3 text-sm text-orange-600">
            Unsaved changes
          </div>
        )}
        
        {!validation.isValid && (
          <div className="mt-3 text-sm text-red-600">
            {validation.errors.length} error(s): {validation.errors.join(', ')}
          </div>
        )}
        
        {validation.warnings.length > 0 && (
          <div className="mt-3 text-sm text-yellow-600">
            {validation.warnings.length} warning(s): {validation.warnings.join(', ')}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'builder' ? (
          <FormBuilder
            initialConfig={config}
            onChange={updateConfig}
            onSave={handleSave}
            className="h-full"
          />
        ) : (
          <div className="p-8 bg-gray-50 h-full overflow-auto">
            <div className="max-w-2xl mx-auto">
              <DynamicForm
                config={{
                  ...config,
                  onSubmit: handleFormSubmit,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Simple preview component for showcasing capabilities
export const FormBuilderPreview: React.FC = () => {
  const [selectedForm, setSelectedForm] = useState<keyof typeof EXAMPLE_FORMS>('contact');
  
  const handleSubmit = async (data: any) => {
    console.log(`${selectedForm} form submitted:`, data);
    alert(`${selectedForm} form submitted! Check console for details.`);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Form Examples</h2>
        <p className="text-gray-600 mt-2">
          See different form types generated from configuration
        </p>
      </div>
      
      <div className="flex justify-center">
        <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
          {Object.keys(EXAMPLE_FORMS).map((formKey) => (
            <button
              key={formKey}
              onClick={() => setSelectedForm(formKey as keyof typeof EXAMPLE_FORMS)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                selectedForm === formKey
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {formKey.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <DynamicForm
          config={{
            ...EXAMPLE_FORMS[selectedForm],
            onSubmit: handleSubmit,
          }}
        />
      </div>
    </div>
  );
};

export default FormBuilderExample;