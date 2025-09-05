import React from 'react';
import { FormBuilder } from './components/forms/FormBuilder';
import { useFormStore } from './store/workflowStore';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

function App() {
  const { createForm, activeForm } = useFormStore();

  // Create sample form if none exists
  React.useEffect(() => {
    if (!activeForm) {
      createForm({
        name: 'sample-form',
        title: 'Sample Contact Form',
        description: 'A sample form to test the form builder functionality',
        version: '1.0.0',
        createdBy: 'user',
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
        fields: [
          {
            id: 'name-field',
            type: 'text',
            name: 'name',
            label: 'Full Name',
            required: true,
            placeholder: 'Enter your full name',
            order: 1
          },
          {
            id: 'email-field',
            type: 'email',
            name: 'email',
            label: 'Email Address',
            required: true,
            placeholder: 'Enter your email',
            order: 2
          }
        ]
      });
    }
  }, [activeForm, createForm]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ConcertMaster</h1>
            <p className="text-sm text-gray-600">Form Builder - Testing Input Functionality</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ErrorBoundary fallback={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Form Builder Error</h3>
              <p className="text-gray-600">The form builder encountered an error.</p>
            </div>
          </div>
        }>
          <FormBuilder
            initialSchema={activeForm}
            onSave={(schema) => {
              console.log('Form saved:', schema);
            }}
            onPreview={(schema) => {
              console.log('Form preview:', schema);
            }}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;