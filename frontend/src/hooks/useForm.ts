import { useForm as useHookForm, UseFormProps, UseFormReturn } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';

export interface UseFormOptions<T extends Record<string, any> = Record<string, any>> extends UseFormProps<T> {
  schema?: yup.Schema<T>;
  onSubmit?: (data: T) => Promise<void> | void;
  onSubmitSuccess?: (data: T) => void;
  onSubmitError?: (error: Error) => void;
  enableAutoSave?: boolean;
  autoSaveDelay?: number;
  showToastMessages?: boolean;
  successMessage?: string;
  errorMessage?: string;
  validateOnMount?: boolean;
  resetOnSuccess?: boolean;
}

interface FormState {
  isLoading: boolean;
  lastSaved?: Date;
  hasUnsavedChanges: boolean;
  submitCount: number;
  isValid: boolean;
}

interface UseFormEnhanced<T extends Record<string, any>> extends UseFormReturn<T> {
  formState: UseFormReturn<T>['formState'] & FormState;
  submitForm: () => Promise<void>;
  saveForm: () => Promise<void>;
  resetForm: () => void;
  isDirty: boolean;
  isSubmitting: boolean;
  hasErrors: boolean;
  getFieldError: (fieldName: keyof T) => string | undefined;
  setFieldValue: (fieldName: keyof T, value: any) => void;
  validateField: (fieldName: keyof T) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
}

export function useForm<T extends Record<string, any> = Record<string, any>>({
  schema,
  onSubmit,
  onSubmitSuccess,
  onSubmitError,
  enableAutoSave = false,
  autoSaveDelay = 2000,
  showToastMessages = true,
  successMessage = 'Form submitted successfully!',
  errorMessage = 'An error occurred while submitting the form.',
  validateOnMount = false,
  resetOnSuccess = false,
  ...useFormOptions
}: UseFormOptions<T> = {}): UseFormEnhanced<T> {
  const hookForm = useHookForm<T>({
    ...useFormOptions,
    resolver: schema ? yupResolver(schema) : undefined,
    mode: useFormOptions.mode || 'onChange',
  });
  
  const [formState, setFormState] = useState<FormState>({
    isLoading: false,
    hasUnsavedChanges: false,
    submitCount: 0,
    isValid: true,
  });
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const initialValues = useRef<T>();
  
  // Store initial values on mount
  if (!initialValues.current && hookForm.getValues) {
    initialValues.current = hookForm.getValues();
  }
  
  // Auto-save functionality
  const saveForm = useCallback(async () => {
    if (!enableAutoSave || !onSubmit) return;
    
    try {
      const isValid = await hookForm.trigger();
      if (!isValid) return;
      
      const data = hookForm.getValues();
      await onSubmit(data);
      
      setFormState(prev => ({
        ...prev,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
      }));
      
      if (showToastMessages) {
        toast.success('Changes saved automatically');
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      if (showToastMessages) {
        toast.error('Failed to save changes');
      }
    }
  }, [enableAutoSave, onSubmit, hookForm, showToastMessages]);
  
  // Debounced auto-save
  const scheduleAutoSave = useCallback(() => {
    if (!enableAutoSave) return;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveForm();
    }, autoSaveDelay);
  }, [enableAutoSave, autoSaveDelay, saveForm]);
  
  // Enhanced submit function
  const submitForm = useCallback(async () => {
    if (!onSubmit) return;
    
    setFormState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const isValid = await hookForm.trigger();
      if (!isValid) {
        setFormState(prev => ({ ...prev, isLoading: false }));
        if (showToastMessages) {
          toast.error('Please correct the errors before submitting');
        }
        return;
      }
      
      const data = hookForm.getValues();
      await onSubmit(data);
      
      setFormState(prev => ({
        ...prev,
        isLoading: false,
        hasUnsavedChanges: false,
        submitCount: prev.submitCount + 1,
        lastSaved: new Date(),
      }));
      
      if (showToastMessages) {
        toast.success(successMessage);
      }
      
      onSubmitSuccess?.(data);
      
      if (resetOnSuccess) {
        hookForm.reset();
      }
    } catch (error) {
      console.error('Form submission failed:', error);
      
      setFormState(prev => ({ ...prev, isLoading: false }));
      
      if (showToastMessages) {
        toast.error(errorMessage);
      }
      
      onSubmitError?.(error as Error);
    }
  }, [onSubmit, hookForm, showToastMessages, successMessage, errorMessage, onSubmitSuccess, onSubmitError, resetOnSuccess]);
  
  // Reset form with state cleanup
  const resetForm = useCallback(() => {
    hookForm.reset();
    setFormState({
      isLoading: false,
      hasUnsavedChanges: false,
      submitCount: 0,
      isValid: true,
    });
  }, [hookForm]);
  
  // Utility functions
  const getFieldError = useCallback((fieldName: keyof T): string | undefined => {
    const error = hookForm.formState.errors[fieldName];
    return error?.message as string;
  }, [hookForm.formState.errors]);
  
  const setFieldValue = useCallback((fieldName: keyof T, value: any) => {
    hookForm.setValue(fieldName as string, value, {
      shouldValidate: true,
      shouldDirty: true,
    });
    
    setFormState(prev => ({ ...prev, hasUnsavedChanges: true }));
    scheduleAutoSave();
  }, [hookForm, scheduleAutoSave]);
  
  const validateField = useCallback(async (fieldName: keyof T): Promise<boolean> => {
    return hookForm.trigger(fieldName as string);
  }, [hookForm]);
  
  const validateForm = useCallback(async (): Promise<boolean> => {
    return hookForm.trigger();
  }, [hookForm]);
  
  // Watch for form changes to trigger auto-save
  const watchedValues = hookForm.watch();
  
  React.useEffect(() => {
    if (initialValues.current && enableAutoSave) {
      const hasChanged = JSON.stringify(watchedValues) !== JSON.stringify(initialValues.current);
      setFormState(prev => ({ ...prev, hasUnsavedChanges: hasChanged }));
      
      if (hasChanged) {
        scheduleAutoSave();
      }
    }
  }, [watchedValues, enableAutoSave, scheduleAutoSave]);
  
  // Validate on mount if requested
  React.useEffect(() => {
    if (validateOnMount) {
      hookForm.trigger();
    }
  }, [validateOnMount, hookForm]);
  
  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);
  
  // Enhanced form state
  const enhancedFormState = {
    ...hookForm.formState,
    ...formState,
  };
  
  return {
    ...hookForm,
    formState: enhancedFormState,
    submitForm,
    saveForm,
    resetForm,
    isDirty: hookForm.formState.isDirty || formState.hasUnsavedChanges,
    isSubmitting: hookForm.formState.isSubmitting || formState.isLoading,
    hasErrors: Object.keys(hookForm.formState.errors).length > 0,
    getFieldError,
    setFieldValue,
    validateField,
    validateForm,
  };
}

// Hook for form field validation
export function useFieldValidation<T extends Record<string, any>>(
  fieldName: keyof T,
  schema?: yup.Schema
) {
  const [error, setError] = useState<string | undefined>();
  const [isValidating, setIsValidating] = useState(false);
  
  const validate = useCallback(async (value: any): Promise<boolean> => {
    if (!schema) return true;
    
    setIsValidating(true);
    
    try {
      await schema.validate(value);
      setError(undefined);
      setIsValidating(false);
      return true;
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        setError(err.message);
      } else {
        setError('Validation failed');
      }
      setIsValidating(false);
      return false;
    }
  }, [schema]);
  
  return {
    error,
    isValidating,
    validate,
    clearError: () => setError(undefined),
  };
}

// Hook for form persistence
export function useFormPersistence<T extends Record<string, any>>(
  formId: string,
  form: UseFormReturn<T>,
  options: {
    enabled?: boolean;
    debounceMs?: number;
    storageType?: 'localStorage' | 'sessionStorage';
  } = {}
) {
  const {
    enabled = true,
    debounceMs = 1000,
    storageType = 'localStorage'
  } = options;
  
  const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
  const storageKey = `form-data-${formId}`;
  const debounceRef = useRef<NodeJS.Timeout>();
  
  // Load persisted data on mount
  React.useEffect(() => {
    if (!enabled) return;
    
    try {
      const savedData = storage.getItem(storageKey);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        form.reset(parsedData);
      }
    } catch (error) {
      console.warn('Failed to load persisted form data:', error);
    }
  }, [enabled, storageKey, storage, form]);
  
  // Save form data on changes
  const formValues = form.watch();
  
  React.useEffect(() => {
    if (!enabled) return;
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      try {
        storage.setItem(storageKey, JSON.stringify(formValues));
      } catch (error) {
        console.warn('Failed to persist form data:', error);
      }
    }, debounceMs);
  }, [formValues, enabled, storageKey, storage, debounceMs]);
  
  // Clear persisted data
  const clearPersistedData = useCallback(() => {
    try {
      storage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear persisted form data:', error);
    }
  }, [storageKey, storage]);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  
  return {
    clearPersistedData,
  };
}

// Export React for useEffect dependencies
import React from 'react';
