// Temporary bypass App.tsx - Simplified version that avoids problematic components
import React from 'react';
import { WorkflowCanvas } from './components/workflow/WorkflowCanvas';
import { FormBuilder } from './components/forms/FormBuilder';
import { VisualFormBuilder } from './components/visual-builder/VisualFormBuilder.bypass';
import { useWorkflowStore, useFormStore } from './store/workflowStore';
import { Button } from './components/shared';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

function App() {
  // Start with form view since it's most stable
  const [currentView, setCurrentView] = React.useState<'form' | 'workflow' | 'visual-builder'>('form');
  const { createWorkflow, activeWorkflow } = useWorkflowStore();
  const { createForm, activeForm } = useFormStore();

  // Create sample form if none exists
  React.useEffect(() => {
    if (!activeForm) {
      createForm({
        name: 'sample-form',
        title: 'Sample Form',
        description: 'A sample form for data collection',
        version: '1.0.0',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
            required: true,
            placeholder: 'Enter your name'
          },
          {
            id: 'email',
            type: 'email',
            label: 'Email',
            required: true,
            placeholder: 'Enter your email'
          }
        ],
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
        createdBy: 'demo-user',
      });
    }
  }, [activeForm, createForm]);

  // Create sample workflow if none exists (only if workflow view is selected)
  React.useEffect(() => {
    if (currentView === 'workflow' && !activeWorkflow) {
      createWorkflow({
        name: 'Sample Data Collection Workflow',
        description: 'A sample workflow for collecting supplier data',
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 100, y: 100 },
            data: {
              label: 'Start',
              description: 'Workflow start point'
            }
          }
        ],
        edges: [],
      });
    }
  }, [currentView, activeWorkflow, createWorkflow]);

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                ConcertMaster
              </h1>
              <span className="text-sm text-gray-500">
                Data Collection & Orchestration Platform
              </span>
              <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                Bypass Mode
              </div>
            </div>
            
            <nav className="flex items-center space-x-1">
              <Button
                variant={currentView === 'form' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('form')}
              >
                Form Builder ✅
              </Button>
              <Button
                variant={currentView === 'workflow' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('workflow')}
              >
                Workflow Builder ⚠️
              </Button>
              <Button
                variant={currentView === 'visual-builder' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('visual-builder')}
              >
                Visual Builder 🚧
              </Button>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {currentView === 'form' && (
            <ErrorBoundary fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Form Builder Unavailable</h3>
                  <p className="text-gray-600">The form builder component failed to load.</p>
                </div>
              </div>
            }>
              <FormBuilder
                initialSchema={activeForm || undefined}
                onSave={() => {
                  console.log('Form saved successfully');
                }}
                onPreview={() => {
                  console.log('Form preview requested');
                }}
              />
            </ErrorBoundary>
          )}
          
          {currentView === 'workflow' && (
            <ErrorBoundary fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Workflow Builder Unavailable</h3>
                  <p className="text-gray-600 mb-4">The workflow builder has some compatibility issues.</p>
                  <Button 
                    variant="primary"
                    onClick={() => setCurrentView('form')}
                  >
                    Switch to Form Builder
                  </Button>
                </div>
              </div>
            }>
              {activeWorkflow ? (
                <WorkflowCanvas
                  workflow={activeWorkflow}
                  onSave={() => {
                    console.log('Workflow saved successfully');
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Workflow...</h3>
                  </div>
                </div>
              )}
            </ErrorBoundary>
          )}

          {currentView === 'visual-builder' && (
            <VisualFormBuilder
              initialSchema={activeForm || undefined}
              onSave={() => {
                console.log('Visual form saved successfully');
              }}
              onPreview={() => {
                console.log('Visual form preview requested');
              }}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Built with React Flow, TanStack Form, and Tailwind CSS
            </div>
            <div className="text-sm text-gray-500 flex items-center">
              <span className="mr-2">v1.0.0 - Temporary Bypass Mode</span>
              <div className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">
                Some features temporarily disabled
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export { App };