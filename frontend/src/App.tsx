import React from 'react';
import { WorkflowCanvas } from './components/workflow/WorkflowCanvas';
import { FormBuilder } from './components/forms/FormBuilder';
import { VisualFormBuilder } from './components/visual-builder/VisualFormBuilder';
import { useWorkflowStore, useFormStore } from './store/workflowStore';
import { Button } from './components/shared';

function App() {
  const [currentView, setCurrentView] = React.useState<'workflow' | 'form' | 'visual-builder'>('workflow');
  const { createWorkflow, activeWorkflow } = useWorkflowStore();
  const { createForm, activeForm } = useFormStore();

  // Create sample workflow if none exists
  React.useEffect(() => {
    if (!activeWorkflow) {
      const sampleWorkflow = createWorkflow({
        name: 'Sample Data Collection Workflow',
        description: 'A sample workflow for collecting supplier data',
        nodes: [],
        edges: [],
      });
    }
  }, [activeWorkflow, createWorkflow]);

  // Create sample form if none exists
  React.useEffect(() => {
    if (!activeForm && currentView === 'form') {
      const sampleForm = createForm({
        name: 'sample-form',
        title: 'Sample Form',
        description: 'A sample form for data collection',
        version: '1.0.0',
        fields: [],
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
  }, [activeForm, currentView, createForm]);

  return (
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
          </div>
          
          <nav className="flex items-center space-x-1">
            <Button
              variant={currentView === 'workflow' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView('workflow')}
            >
              Workflow Builder
            </Button>
            <Button
              variant={currentView === 'form' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView('form')}
            >
              Form Builder
            </Button>
            <Button
              variant={currentView === 'visual-builder' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView('visual-builder')}
            >
              Visual Builder
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {currentView === 'workflow' && activeWorkflow && (
          <WorkflowCanvas
            workflow={activeWorkflow}
            onSave={(updatedWorkflow) => {
              console.log('Workflow saved:', updatedWorkflow);
              // Handle workflow save
            }}
          />
        )}
        
        {currentView === 'form' && (
          <FormBuilder
            initialSchema={activeForm || undefined}
            onSave={(schema) => {
              console.log('Form saved:', schema);
              // Handle form save
            }}
            onPreview={(schema) => {
              console.log('Form preview:', schema);
              // Handle form preview
            }}
          />
        )}

        {currentView === 'visual-builder' && (
          <VisualFormBuilder
            initialSchema={activeForm || undefined}
            onSave={(schema) => {
              console.log('Visual form saved:', schema);
              // Handle visual form save
            }}
            onPreview={(schema) => {
              console.log('Visual form preview:', schema);
              // Handle visual form preview
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
          <div className="text-sm text-gray-500">
            v1.0.0 - Open Source Data Collection Platform
          </div>
        </div>
      </footer>
    </div>
  );
}

export { App };