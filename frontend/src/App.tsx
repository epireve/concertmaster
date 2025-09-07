import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { WorkflowCanvas } from './components/workflow/WorkflowCanvas';
import { FormBuilder } from './components/forms/FormBuilder';
import { ReviewDashboardPage } from './components/reviews/ReviewDashboardPage';
import { ReviewDetailsPageRoute } from './components/reviews/ReviewDetailsPageRoute';
import { useWorkflowStore, useFormStore } from './store/workflowStore';
import { Button } from './components/shared';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

// Navigation Header Component
const NavigationHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const getActiveView = (pathname: string) => {
    if (pathname.startsWith('/reviews')) return 'reviews';
    if (pathname.startsWith('/workflow')) return 'workflow';
    if (pathname.startsWith('/form-builder')) return 'form';
    return 'form'; // default
  };
  
  const currentView = getActiveView(location.pathname);
  
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 z-10">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ConcertMaster</h1>
          <p className="text-sm text-gray-600">Data Collection & Orchestration Platform</p>
        </div>
        
        <div className="flex items-center space-x-1">
          <nav className="flex space-x-1">
            <Button
              variant={currentView === 'form' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/form-builder')}
            >
              Form Builder ✅
            </Button>
            <Button
              variant={currentView === 'workflow' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/workflow')}
            >
              Workflow Designer ✅
            </Button>
            <Button
              variant={currentView === 'reviews' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/reviews')}
            >
              Review System ✅
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/visual-builder')}
            >
              Visual Builder 🔧
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
};

// Main App Layout Component
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <NavigationHeader />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Built with React Flow, React Hook Form, and Tailwind CSS
          </div>
          <div className="text-sm text-gray-500">
            ConcertMaster v1.0.0 - Phase 4 Review System Active
          </div>
        </div>
      </footer>
    </div>
  );
};

// Form Builder Page Component
const FormBuilderPage: React.FC = () => {
  const { createForm, activeForm } = useFormStore();

  // Create sample form if none exists
  React.useEffect(() => {
    if (!activeForm) {
      createForm({
        name: 'sample-form',
        title: 'Sample Contact Form',
        description: 'A sample form to demonstrate the form builder',
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
            id: 'name',
            type: 'text',
            name: 'name',
            label: 'Full Name',
            required: true,
            placeholder: 'Enter your full name',
            order: 1
          },
          {
            id: 'email',
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
    <ErrorBoundary fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Form Builder Loading...</h3>
          <p className="text-gray-600">Please wait while the form builder initializes.</p>
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
  );
};

// Workflow Designer Page Component
const WorkflowDesignerPage: React.FC = () => {
  const { createWorkflow, activeWorkflow } = useWorkflowStore();

  // Create sample workflow if none exists
  React.useEffect(() => {
    if (!activeWorkflow) {
      createWorkflow({
        name: 'sample-workflow',
        label: 'Sample Data Processing',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 100 },
            data: { 
              label: 'Form Submission',
              config: {
                trigger: 'form_submit',
                formId: 'sample-form'
              }
            }
          },
          {
            id: 'transform-1',
            type: 'transform',
            position: { x: 350, y: 100 },
            data: { 
              label: 'Process Data',
              config: {
                transformation: 'validate_and_clean'
              }
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'trigger-1',
            target: 'transform-1',
            label: 'data flow'
          }
        ]
      });
    }
  }, [activeWorkflow, createWorkflow]);
  
  return (
    <ErrorBoundary fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Workflow Designer Loading...</h3>
          <p className="text-gray-600">Please wait while the workflow designer initializes.</p>
        </div>
      </div>
    }>
      <WorkflowCanvas 
        workflow={activeWorkflow || {
          name: 'sample-workflow',
          nodes: [],
          edges: []
        }}
        onSave={() => {
          console.log('Workflow saved');
        }}
      />
    </ErrorBoundary>
  );
};

// Visual Builder Page Component
const VisualBuilderPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Visual Builder</h3>
        <p className="text-gray-600 mb-4">Advanced visual form building features are being enhanced.</p>
        <p className="text-sm text-blue-600">Available in next update - use Form Builder for now</p>
      </div>
    </div>
  );
};

// Review System Page Component
const ReviewSystemPage: React.FC = () => {
  return (
    <ReviewDashboardPage />
  );
};

// Main App Component
function App() {

  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/form-builder" replace />} />
          
          {/* Form Builder Route */}
          <Route path="/form-builder" element={
            <AppLayout>
              <FormBuilderPage />
            </AppLayout>
          } />
          
          {/* Workflow Designer Route */}
          <Route path="/workflow" element={
            <AppLayout>
              <WorkflowDesignerPage />
            </AppLayout>
          } />
          
          {/* Review System Routes */}
          <Route path="/reviews" element={
            <AppLayout>
              <ReviewDashboardPage />
            </AppLayout>
          } />
          
          <Route path="/reviews/:id" element={
            <AppLayout>
              <ReviewDetailsPageRoute />
            </AppLayout>
          } />
          
          {/* Visual Builder Route */}
          <Route path="/visual-builder" element={
            <AppLayout>
              <VisualBuilderPage />
            </AppLayout>
          } />
          
          {/* Catch all - redirect to form builder */}
          <Route path="*" element={<Navigate to="/form-builder" replace />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;