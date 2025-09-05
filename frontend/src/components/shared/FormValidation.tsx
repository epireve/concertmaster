import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';

// Real-time validation state
export interface ValidationState {
  isValid: boolean;
  isValidating: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Field-level validation component
interface FieldValidationProps {
  fieldName: string;
  value: any;
  validators: ValidationRule[];
  debounceMs?: number;
  showValidation?: 'always' | 'on-error' | 'on-focus' | 'on-change';
  className?: string;
  onValidationChange?: (state: ValidationState) => void;
}

export interface ValidationRule {
  id: string;
  validate: (value: any) => Promise<ValidationResult> | ValidationResult;
  message: string;
  type: 'error' | 'warning' | 'suggestion';
  dependencies?: string[];
  debounce?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  type?: 'error' | 'warning' | 'suggestion';
}

export const FieldValidation: React.FC<FieldValidationProps> = ({
  fieldName,
  value,
  validators,
  debounceMs = 300,
  showValidation = 'always',
  className,
  onValidationChange,
}) => {
  const [validationState, setValidationState] = useState<ValidationState>({
    isValid: true,
    isValidating: false,
    errors: [],
    warnings: [],
    suggestions: [],
  });

  const [hasFocus, setHasFocus] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  const validateField = useCallback(async (inputValue: any) => {
    setValidationState(prev => ({ ...prev, isValidating: true }));

    const results = await Promise.all(
      validators.map(async (rule) => {
        try {
          const result = await rule.validate(inputValue);
          return {
            ...result,
            rule,
          };
        } catch (error) {
          return {
            isValid: false,
            message: rule.message,
            type: 'error' as const,
            rule,
          };
        }
      })
    );

    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    results.forEach(result => {
      if (!result.isValid && result.message) {
        if (result.type === 'error' || result.rule.type === 'error') {
          errors.push(result.message);
        } else if (result.type === 'warning' || result.rule.type === 'warning') {
          warnings.push(result.message);
        } else {
          suggestions.push(result.message);
        }
      }
    });

    const newState: ValidationState = {
      isValid: errors.length === 0,
      isValidating: false,
      errors,
      warnings,
      suggestions,
    };

    setValidationState(newState);
    onValidationChange?.(newState);
  }, [validators, onValidationChange]);

  // Debounced validation
  useEffect(() => {
    setHasChanged(true);
    
    const timer = setTimeout(() => {
      validateField(value);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, validateField, debounceMs]);

  // Determine if validation should be shown
  const shouldShowValidation = () => {
    switch (showValidation) {
      case 'always':
        return true;
      case 'on-error':
        return !validationState.isValid;
      case 'on-focus':
        return hasFocus;
      case 'on-change':
        return hasChanged;
      default:
        return true;
    }
  };

  if (!shouldShowValidation()) {
    return null;
  }

  const hasMessages = validationState.errors.length > 0 || 
                    validationState.warnings.length > 0 || 
                    validationState.suggestions.length > 0;

  return (
    <div className={clsx('field-validation mt-1 space-y-1', className)}>
      {/* Loading state */}
      {validationState.isValidating && (
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          <span>Validating...</span>
        </div>
      )}

      {/* Validation messages */}
      {!validationState.isValidating && hasMessages && (
        <>
          {/* Errors */}
          {validationState.errors.map((error, index) => (
            <div key={`error-${index}`} className="flex items-start text-sm text-red-600">
              <AlertCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ))}

          {/* Warnings */}
          {validationState.warnings.map((warning, index) => (
            <div key={`warning-${index}`} className="flex items-start text-sm text-yellow-600">
              <AlertCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}

          {/* Suggestions */}
          {validationState.suggestions.map((suggestion, index) => (
            <div key={`suggestion-${index}`} className="flex items-start text-sm text-blue-600">
              <Info className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
              <span>{suggestion}</span>
            </div>
          ))}
        </>
      )}

      {/* Success state */}
      {!validationState.isValidating && validationState.isValid && hasChanged && (
        <div className="flex items-center text-sm text-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          <span>Valid</span>
        </div>
      )}
    </div>
  );
};

// Form-level validation summary
interface FormValidationSummaryProps {
  validationStates: Record<string, ValidationState>;
  className?: string;
}

export const FormValidationSummary: React.FC<FormValidationSummaryProps> = ({
  validationStates,
  className,
}) => {
  const totalErrors = Object.values(validationStates).reduce(
    (sum, state) => sum + state.errors.length, 0
  );
  
  const totalWarnings = Object.values(validationStates).reduce(
    (sum, state) => sum + state.warnings.length, 0
  );

  const isValidating = Object.values(validationStates).some(state => state.isValidating);

  if (totalErrors === 0 && totalWarnings === 0 && !isValidating) {
    return null;
  }

  return (
    <div className={clsx(
      'form-validation-summary p-4 rounded-lg border',
      totalErrors > 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200',
      className
    )}>
      <div className="flex items-center mb-2">
        {isValidating && <Loader2 className="w-4 h-4 mr-2 animate-spin text-gray-500" />}
        {totalErrors > 0 && <AlertCircle className="w-4 h-4 mr-2 text-red-600" />}
        {totalErrors === 0 && totalWarnings > 0 && <AlertCircle className="w-4 h-4 mr-2 text-yellow-600" />}
        
        <h4 className={clsx(
          'text-sm font-medium',
          totalErrors > 0 ? 'text-red-800' : 'text-yellow-800'
        )}>
          {isValidating && 'Validating form...'}
          {!isValidating && totalErrors > 0 && `${totalErrors} error${totalErrors > 1 ? 's' : ''} found`}
          {!isValidating && totalErrors === 0 && totalWarnings > 0 && 
            `${totalWarnings} warning${totalWarnings > 1 ? 's' : ''} found`}
        </h4>
      </div>

      {!isValidating && (
        <div className="space-y-1">
          {Object.entries(validationStates).map(([fieldName, state]) => (
            <div key={fieldName}>
              {state.errors.map((error, index) => (
                <div key={`${fieldName}-error-${index}`} className="text-sm text-red-700">
                  <span className="font-medium">{fieldName}:</span> {error}
                </div>
              ))}
              {state.warnings.map((warning, index) => (
                <div key={`${fieldName}-warning-${index}`} className="text-sm text-yellow-700">
                  <span className="font-medium">{fieldName}:</span> {warning}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Common validation rules factory
export const ValidationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    id: 'required',
    message,
    type: 'error',
    validate: (value: any) => ({
      isValid: value !== null && value !== undefined && value !== '',
    }),
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    id: 'minLength',
    message: message || `Must be at least ${min} characters`,
    type: 'error',
    validate: (value: string) => ({
      isValid: !value || value.length >= min,
    }),
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    id: 'maxLength',
    message: message || `Must be no more than ${max} characters`,
    type: 'error',
    validate: (value: string) => ({
      isValid: !value || value.length <= max,
    }),
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    id: 'email',
    message,
    type: 'error',
    validate: (value: string) => {
      if (!value) return { isValid: true };
      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      return { isValid: emailRegex.test(value) };
    },
  }),

  phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
    id: 'phone',
    message,
    type: 'error',
    validate: (value: string) => {
      if (!value) return { isValid: true };
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      return { isValid: phoneRegex.test(value.replace(/\s|-|\(|\)/g, '')) };
    },
  }),

  url: (message = 'Please enter a valid URL'): ValidationRule => ({
    id: 'url',
    message,
    type: 'error',
    validate: (value: string) => {
      if (!value) return { isValid: true };
      try {
        new URL(value.startsWith('http') ? value : `https://${value}`);
        return { isValid: true };
      } catch {
        return { isValid: false };
      }
    },
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    id: 'pattern',
    message,
    type: 'error',
    validate: (value: string) => ({
      isValid: !value || regex.test(value),
    }),
  }),

  min: (minimum: number, message?: string): ValidationRule => ({
    id: 'min',
    message: message || `Must be at least ${minimum}`,
    type: 'error',
    validate: (value: number) => ({
      isValid: value === null || value === undefined || value >= minimum,
    }),
  }),

  max: (maximum: number, message?: string): ValidationRule => ({
    id: 'max',
    message: message || `Must be no more than ${maximum}`,
    type: 'error',
    validate: (value: number) => ({
      isValid: value === null || value === undefined || value <= maximum,
    }),
  }),

  asyncUnique: (
    checkUnique: (value: any) => Promise<boolean>,
    message = 'This value is already taken'
  ): ValidationRule => ({
    id: 'asyncUnique',
    message,
    type: 'error',
    debounce: true,
    validate: async (value: any) => {
      if (!value) return { isValid: true };
      const isUnique = await checkUnique(value);
      return { isValid: isUnique };
    },
  }),

  passwordStrength: (
    minScore = 3,
    message = 'Password is too weak'
  ): ValidationRule => ({
    id: 'passwordStrength',
    message,
    type: 'warning',
    validate: (password: string) => {
      if (!password) return { isValid: true };
      
      let score = 0;
      
      // Length check
      if (password.length >= 8) score++;
      if (password.length >= 12) score++;
      
      // Character variety
      if (/[a-z]/.test(password)) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/\d/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      
      return {
        isValid: score >= minScore,
        message: score < minScore ? 
          `Password strength: ${score}/${6}. Try adding uppercase, numbers, and symbols.` :
          undefined,
      };
    },
  }),

  confirmPassword: (
    passwordFieldName: string,
    message = 'Passwords do not match'
  ): ValidationRule => ({
    id: 'confirmPassword',
    message,
    type: 'error',
    dependencies: [passwordFieldName],
    validate: (value: string, allValues?: Record<string, any>) => {
      if (!value) return { isValid: true };
      const originalPassword = allValues?.[passwordFieldName];
      return { isValid: value === originalPassword };
    },
  }),
};

// Hook for managing form validation
export const useFormValidation = () => {
  const [validationStates, setValidationStates] = useState<Record<string, ValidationState>>({});
  
  const updateFieldValidation = useCallback((fieldName: string, state: ValidationState) => {
    setValidationStates(prev => ({
      ...prev,
      [fieldName]: state,
    }));
  }, []);
  
  const isFormValid = Object.values(validationStates).every(state => state.isValid);
  const isFormValidating = Object.values(validationStates).some(state => state.isValidating);
  
  const getFieldValidation = useCallback((fieldName: string): ValidationState => {
    return validationStates[fieldName] || {
      isValid: true,
      isValidating: false,
      errors: [],
      warnings: [],
      suggestions: [],
    };
  }, [validationStates]);
  
  return {
    validationStates,
    isFormValid,
    isFormValidating,
    updateFieldValidation,
    getFieldValidation,
  };
};

export default FieldValidation;