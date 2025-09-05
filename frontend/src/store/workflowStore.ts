import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Workflow, WorkflowNode, WorkflowEdge } from '../types/workflow';
import { FormSchema } from '../types/forms';

// Workflow Store State
interface WorkflowState {
  workflows: Workflow[];
  activeWorkflow: Workflow | null;
  loading: boolean;
  error: string | null;
}

// Workflow Store Actions
interface WorkflowActions {
  // Workflow management
  setWorkflows: (workflows: Workflow[]) => void;
  setActiveWorkflow: (workflow: Workflow | null) => void;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Workflow;
  updateWorkflow: (workflowId: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (workflowId: string) => void;
  
  // Node management
  addNode: (workflowId: string, node: WorkflowNode) => void;
  removeNode: (workflowId: string, nodeId: string) => void;
  updateNode: (workflowId: string, nodeId: string, updates: Partial<WorkflowNode>) => void;
  updateNodeConfig: (workflowId: string, nodeId: string, config: Record<string, any>) => void;
  
  // Edge management
  addEdge: (workflowId: string, edge: WorkflowEdge) => void;
  removeEdge: (workflowId: string, edgeId: string) => void;
  updateEdge: (workflowId: string, edgeId: string, updates: Partial<WorkflowEdge>) => void;
  
  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// Combined Store Type
type WorkflowStore = WorkflowState & WorkflowActions;

export const useWorkflowStore = create<WorkflowStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        workflows: [],
        activeWorkflow: null,
        loading: false,
        error: null,

        // Workflow Actions
        setWorkflows: (workflows) => set({ workflows }),
        
        setActiveWorkflow: (workflow) => set({ activeWorkflow: workflow }),
        
        createWorkflow: (workflowData) => {
          const newWorkflow: Workflow = {
            ...workflowData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'draft',
          };
          
          set((state) => ({
            workflows: [...state.workflows, newWorkflow],
            activeWorkflow: newWorkflow,
          }));
          
          return newWorkflow;
        },
        
        updateWorkflow: (workflowId, updates) => {
          set((state) => ({
            workflows: state.workflows.map((workflow) =>
              workflow.id === workflowId
                ? { ...workflow, ...updates, updatedAt: new Date() }
                : workflow
            ),
            activeWorkflow:
              state.activeWorkflow?.id === workflowId
                ? { ...state.activeWorkflow, ...updates, updatedAt: new Date() }
                : state.activeWorkflow,
          }));
        },
        
        deleteWorkflow: (workflowId) => {
          set((state) => ({
            workflows: state.workflows.filter((workflow) => workflow.id !== workflowId),
            activeWorkflow:
              state.activeWorkflow?.id === workflowId ? null : state.activeWorkflow,
          }));
        },

        // Node Actions
        addNode: (workflowId, node) => {
          set((state) => ({
            workflows: state.workflows.map((workflow) =>
              workflow.id === workflowId
                ? {
                    ...workflow,
                    nodes: [...workflow.nodes, node],
                    updatedAt: new Date(),
                  }
                : workflow
            ),
            activeWorkflow:
              state.activeWorkflow?.id === workflowId
                ? {
                    ...state.activeWorkflow,
                    nodes: [...state.activeWorkflow.nodes, node],
                    updatedAt: new Date(),
                  }
                : state.activeWorkflow,
          }));
        },
        
        removeNode: (workflowId, nodeId) => {
          set((state) => ({
            workflows: state.workflows.map((workflow) =>
              workflow.id === workflowId
                ? {
                    ...workflow,
                    nodes: workflow.nodes.filter((node) => node.id !== nodeId),
                    edges: workflow.edges.filter(
                      (edge) => edge.source !== nodeId && edge.target !== nodeId
                    ),
                    updatedAt: new Date(),
                  }
                : workflow
            ),
            activeWorkflow:
              state.activeWorkflow?.id === workflowId
                ? {
                    ...state.activeWorkflow,
                    nodes: state.activeWorkflow.nodes.filter((node) => node.id !== nodeId),
                    edges: state.activeWorkflow.edges.filter(
                      (edge) => edge.source !== nodeId && edge.target !== nodeId
                    ),
                    updatedAt: new Date(),
                  }
                : state.activeWorkflow,
          }));
        },
        
        updateNode: (workflowId, nodeId, updates) => {
          set((state) => ({
            workflows: state.workflows.map((workflow) =>
              workflow.id === workflowId
                ? {
                    ...workflow,
                    nodes: workflow.nodes.map((node) =>
                      node.id === nodeId ? { ...node, ...updates } : node
                    ),
                    updatedAt: new Date(),
                  }
                : workflow
            ),
            activeWorkflow:
              state.activeWorkflow?.id === workflowId
                ? {
                    ...state.activeWorkflow,
                    nodes: state.activeWorkflow.nodes.map((node) =>
                      node.id === nodeId ? { ...node, ...updates } : node
                    ),
                    updatedAt: new Date(),
                  }
                : state.activeWorkflow,
          }));
        },
        
        updateNodeConfig: (workflowId, nodeId, config) => {
          const existingData = get().activeWorkflow?.nodes.find(n => n.id === nodeId)?.data;
          get().updateNode(workflowId, nodeId, {
            data: { 
              label: existingData?.label || 'Node',
              ...existingData, 
              config,
            },
          });
        },

        // Edge Actions
        addEdge: (workflowId, edge) => {
          set((state) => ({
            workflows: state.workflows.map((workflow) =>
              workflow.id === workflowId
                ? {
                    ...workflow,
                    edges: [...workflow.edges, edge],
                    updatedAt: new Date(),
                  }
                : workflow
            ),
            activeWorkflow:
              state.activeWorkflow?.id === workflowId
                ? {
                    ...state.activeWorkflow,
                    edges: [...state.activeWorkflow.edges, edge],
                    updatedAt: new Date(),
                  }
                : state.activeWorkflow,
          }));
        },
        
        removeEdge: (workflowId, edgeId) => {
          set((state) => ({
            workflows: state.workflows.map((workflow) =>
              workflow.id === workflowId
                ? {
                    ...workflow,
                    edges: workflow.edges.filter((edge) => edge.id !== edgeId),
                    updatedAt: new Date(),
                  }
                : workflow
            ),
            activeWorkflow:
              state.activeWorkflow?.id === workflowId
                ? {
                    ...state.activeWorkflow,
                    edges: state.activeWorkflow.edges.filter((edge) => edge.id !== edgeId),
                    updatedAt: new Date(),
                  }
                : state.activeWorkflow,
          }));
        },
        
        updateEdge: (workflowId, edgeId, updates) => {
          set((state) => ({
            workflows: state.workflows.map((workflow) =>
              workflow.id === workflowId
                ? {
                    ...workflow,
                    edges: workflow.edges.map((edge) =>
                      edge.id === edgeId ? { ...edge, ...updates } : edge
                    ),
                    updatedAt: new Date(),
                  }
                : workflow
            ),
            activeWorkflow:
              state.activeWorkflow?.id === workflowId
                ? {
                    ...state.activeWorkflow,
                    edges: state.activeWorkflow.edges.map((edge) =>
                      edge.id === edgeId ? { ...edge, ...updates } : edge
                    ),
                    updatedAt: new Date(),
                  }
                : state.activeWorkflow,
          }));
        },

        // State Management
        setLoading: (loading) => set({ loading }),
        
        setError: (error) => set({ error }),
        
        clearError: () => set({ error: null }),
      }),
      {
        name: 'workflow-store',
        partialize: (state) => ({
          workflows: state.workflows,
          activeWorkflow: state.activeWorkflow,
        }),
      }
    ),
    {
      name: 'workflow-store',
    }
  )
);

// Form Store for form schemas and responses
interface FormState {
  forms: FormSchema[];
  activeForm: FormSchema | null;
  loading: boolean;
  error: string | null;
}

interface FormActions {
  setForms: (forms: FormSchema[]) => void;
  setActiveForm: (form: FormSchema | null) => void;
  createForm: (form: Omit<FormSchema, 'id' | 'createdAt' | 'updatedAt'>) => FormSchema;
  updateForm: (formId: string, updates: Partial<FormSchema>) => void;
  deleteForm: (formId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type FormStore = FormState & FormActions;

export const useFormStore = create<FormStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial State
        forms: [],
        activeForm: null,
        loading: false,
        error: null,

        // Actions
        setForms: (forms) => set({ forms }),
        
        setActiveForm: (form) => set({ activeForm: form }),
        
        createForm: (formData) => {
          const newForm: FormSchema = {
            ...formData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({
            forms: [...state.forms, newForm],
            activeForm: newForm,
          }));
          
          return newForm;
        },
        
        updateForm: (formId, updates) => {
          set((state) => ({
            forms: state.forms.map((form) =>
              form.id === formId
                ? { ...form, ...updates, updatedAt: new Date() }
                : form
            ),
            activeForm:
              state.activeForm?.id === formId
                ? { ...state.activeForm, ...updates, updatedAt: new Date() }
                : state.activeForm,
          }));
        },
        
        deleteForm: (formId) => {
          set((state) => ({
            forms: state.forms.filter((form) => form.id !== formId),
            activeForm: state.activeForm?.id === formId ? null : state.activeForm,
          }));
        },
        
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),
        clearError: () => set({ error: null }),
      }),
      {
        name: 'form-store',
        partialize: (state) => ({
          forms: state.forms,
          activeForm: state.activeForm,
        }),
      }
    ),
    {
      name: 'form-store',
    }
  )
);

// Selectors for common operations
export const workflowSelectors = {
  getWorkflowById: (workflowId: string) => (state: WorkflowStore) =>
    state.workflows.find((workflow) => workflow.id === workflowId),
  
  getNodeById: (workflowId: string, nodeId: string) => (state: WorkflowStore) =>
    state.workflows
      .find((workflow) => workflow.id === workflowId)
      ?.nodes.find((node) => node.id === nodeId),
  
  getConnectedNodes: (workflowId: string, nodeId: string) => (state: WorkflowStore) => {
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow) return { inputs: [], outputs: [] };
    
    const inputs = workflow.edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => workflow.nodes.find((node) => node.id === edge.source))
      .filter(Boolean);
    
    const outputs = workflow.edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => workflow.nodes.find((node) => node.id === edge.target))
      .filter(Boolean);
    
    return { inputs, outputs };
  },
};

export const formSelectors = {
  getFormById: (formId: string) => (state: FormStore) =>
    state.forms.find((form) => form.id === formId),
  
  getFormsByStatus: (status?: string) => (state: FormStore) =>
    status ? state.forms.filter((form) => form.id === status) : state.forms,
};