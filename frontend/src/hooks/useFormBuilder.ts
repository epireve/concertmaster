import { useState, useCallback, useMemo } from 'react';
import { DynamicFormConfig, FieldConfig } from '../components/shared/DynamicForm';

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  config: DynamicFormConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormBuilderState {
  config: DynamicFormConfig;
  isDirty: boolean;
  lastSaved?: Date;
  version: number;
}

export interface UseFormBuilderOptions {
  initialConfig?: DynamicFormConfig;
  autoSave?: boolean;
  autoSaveDelay?: number;
  onSave?: (config: DynamicFormConfig) => Promise<void>;
  onChange?: (config: DynamicFormConfig) => void;
}

export const useFormBuilder = (options: UseFormBuilderOptions = {}) => {
  const {
    initialConfig,
    autoSave = false,
    autoSaveDelay = 2000,
    onSave,
    onChange,
  } = options;

  const defaultConfig: DynamicFormConfig = {
    id: `form_${Date.now()}`,
    title: 'New Form',
    description: '',
    fields: [],
    layout: 'vertical',
    columns: 1,
    spacing: 'normal',
    validation: 'onChange',
    submitButton: { label: 'Submit', variant: 'primary' },
    cancelButton: { show: false },
  };

  const [state, setState] = useState<FormBuilderState>({
    config: initialConfig || defaultConfig,
    isDirty: false,
    version: 1,
  });

  const [history, setHistory] = useState<DynamicFormConfig[]>([state.config]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Auto-save timer
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Update config and manage history
  const updateConfig = useCallback((newConfig: DynamicFormConfig | ((prev: DynamicFormConfig) => DynamicFormConfig)) => {
    setState(prev => {
      const updatedConfig = typeof newConfig === 'function' ? newConfig(prev.config) : newConfig;
      
      // Update history (limit to 50 entries)
      setHistory(currentHistory => {
        const newHistory = [...currentHistory.slice(0, historyIndex + 1), updatedConfig];
        return newHistory.slice(-50);
      });
      setHistoryIndex(prev => prev + 1);

      const newState = {
        ...prev,
        config: updatedConfig,
        isDirty: true,
        version: prev.version + 1,
      };

      // Trigger onChange callback
      onChange?.(updatedConfig);

      // Handle auto-save
      if (autoSave && onSave) {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
        
        const timer = setTimeout(() => {
          onSave(updatedConfig).then(() => {
            setState(current => ({
              ...current,
              isDirty: false,
              lastSaved: new Date(),
            }));
          }).catch(console.error);
        }, autoSaveDelay);
        
        setAutoSaveTimer(timer);
      }

      return newState;
    });
  }, [autoSave, autoSaveDelay, onSave, onChange, autoSaveTimer, historyIndex]);

  // Undo/Redo functionality
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (canUndo) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setState(prev => ({
        ...prev,
        config: history[newIndex],
        isDirty: true,
        version: prev.version + 1,
      }));
    }
  }, [canUndo, historyIndex, history]);

  const redo = useCallback(() => {
    if (canRedo) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setState(prev => ({
        ...prev,
        config: history[newIndex],
        isDirty: true,
        version: prev.version + 1,
      }));
    }
  }, [canRedo, historyIndex, history]);

  // Field operations
  const addField = useCallback((field: FieldConfig, index?: number) => {
    updateConfig(prev => {
      const fields = [...(prev.fields || [])];
      if (index !== undefined) {
        fields.splice(index, 0, field);
      } else {
        fields.push(field);
      }
      return { ...prev, fields };
    });
  }, [updateConfig]);

  const updateField = useCallback((fieldId: string, updates: Partial<FieldConfig>) => {
    updateConfig(prev => ({
      ...prev,
      fields: prev.fields?.map(field => 
        field.id === fieldId ? { ...field, ...updates } as FieldConfig : field
      ) || [],
    }));
  }, [updateConfig]);

  const removeField = useCallback((fieldId: string) => {
    updateConfig(prev => ({
      ...prev,
      fields: prev.fields?.filter(field => field.id !== fieldId) || [],
    }));
  }, [updateConfig]);

  const moveField = useCallback((fieldId: string, newIndex: number) => {
    updateConfig(prev => {
      const fields = [...(prev.fields || [])];
      const currentIndex = fields.findIndex(field => field.id === fieldId);
      
      if (currentIndex !== -1) {
        const [movedField] = fields.splice(currentIndex, 1);
        fields.splice(newIndex, 0, movedField);
      }
      
      return { ...prev, fields };
    });
  }, [updateConfig]);

  const duplicateField = useCallback((fieldId: string) => {
    const field = state.config.fields?.find(f => f.id === fieldId);
    if (field) {
      const duplicatedField: FieldConfig = {
        ...field,
        id: `${field.id}_copy_${Date.now()}`,
        name: `${field.name}_copy`,
        label: `${field.label} (Copy)`,
      };
      addField(duplicatedField);
    }
  }, [state.config.fields, addField]);

  // Form settings
  const updateFormSettings = useCallback((settings: Partial<DynamicFormConfig>) => {
    updateConfig(prev => ({ ...prev, ...settings }));
  }, [updateConfig]);

  // Save functionality
  const save = useCallback(async () => {
    if (onSave) {
      try {
        await onSave(state.config);
        setState(prev => ({
          ...prev,
          isDirty: false,
          lastSaved: new Date(),
        }));
        return true;
      } catch (error) {
        console.error('Failed to save form:', error);
        return false;
      }
    }
    return false;
  }, [state.config, onSave]);

  // Reset to initial or clean state
  const reset = useCallback(() => {
    const resetConfig = initialConfig || defaultConfig;
    setState({
      config: resetConfig,
      isDirty: false,
      version: 1,
    });
    setHistory([resetConfig]);
    setHistoryIndex(0);
  }, [initialConfig, defaultConfig]);

  // Export/Import functionality
  const exportConfig = useCallback(() => {
    return JSON.stringify(state.config, null, 2);
  }, [state.config]);

  const importConfig = useCallback((configJson: string) => {
    try {
      const importedConfig: DynamicFormConfig = JSON.parse(configJson);
      // Validate config structure here if needed
      updateConfig(importedConfig);
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }, [updateConfig]);

  // Form validation
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate field names
    const fieldNames = state.config.fields?.map(f => f.name) || [];
    const duplicateNames = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      errors.push(`Duplicate field names: ${[...new Set(duplicateNames)].join(', ')}`);
    }

    // Check for empty form
    if (!state.config.fields || state.config.fields.length === 0) {
      warnings.push('Form has no fields');
    }

    // Check for fields without labels
    const fieldsWithoutLabels = state.config.fields?.filter(f => !f.label) || [];
    if (fieldsWithoutLabels.length > 0) {
      warnings.push(`${fieldsWithoutLabels.length} field(s) missing labels`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      hasIssues: errors.length > 0 || warnings.length > 0,
    };
  }, [state.config]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  return {
    // State
    config: state.config,
    isDirty: state.isDirty,
    lastSaved: state.lastSaved,
    version: state.version,
    validation,

    // History
    canUndo,
    canRedo,
    undo,
    redo,

    // Field operations
    addField,
    updateField,
    removeField,
    moveField,
    duplicateField,

    // Form operations
    updateFormSettings,
    updateConfig,
    save,
    reset,

    // Import/Export
    exportConfig,
    importConfig,
  };
};

// Hook for managing form templates
export const useFormTemplates = () => {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load from localStorage or API
      const savedTemplates = localStorage.getItem('form-templates');
      if (savedTemplates) {
        const parsed = JSON.parse(savedTemplates);
        setTemplates(parsed.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        })));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveTemplate = useCallback(async (template: Omit<FormTemplate, 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newTemplate: FormTemplate = {
      ...template,
      createdAt: now,
      updatedAt: now,
    };

    setTemplates(prev => {
      const updated = [...prev, newTemplate];
      localStorage.setItem('form-templates', JSON.stringify(updated));
      return updated;
    });

    return newTemplate;
  }, []);

  const updateTemplate = useCallback(async (id: string, updates: Partial<FormTemplate>) => {
    setTemplates(prev => {
      const updated = prev.map(template => 
        template.id === id 
          ? { ...template, ...updates, updatedAt: new Date() }
          : template
      );
      localStorage.setItem('form-templates', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    setTemplates(prev => {
      const updated = prev.filter(template => template.id !== id);
      localStorage.setItem('form-templates', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getTemplate = useCallback((id: string) => {
    return templates.find(template => template.id === id);
  }, [templates]);

  const getTemplatesByCategory = useCallback((category: string) => {
    return templates.filter(template => template.category === category);
  }, [templates]);

  React.useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return {
    templates,
    isLoading,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    getTemplatesByCategory,
    loadTemplates,
  };
};

// Export React for useEffect
import React from 'react';