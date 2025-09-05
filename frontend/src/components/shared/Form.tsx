import React, { createContext, useContext, ReactNode } from 'react';
import { clsx } from 'clsx';
import { UseFormReturn, FieldValues, SubmitHandler, FormProvider } from 'react-hook-form';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface FormContextValue {
  isLoading: boolean;
  isValid: boolean;
  errors: Record<string, any>;
}

const FormContext = createContext<FormContextValue | undefined>(undefined);

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('Form components must be used within a Form');
  }
  return context;
};

interface FormProps<T extends FieldValues = FieldValues> {
  form: UseFormReturn<T>;
  onSubmit: SubmitHandler<T>;
  children: ReactNode;
  className?: string;
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: 1 | 2 | 3 | 4;
  spacing?: 'compact' | 'normal' | 'comfortable';
  disabled?: boolean;
  noValidate?: boolean;
}

export function Form<T extends FieldValues = FieldValues>({
  form,
  onSubmit,
  children,
  className,
  layout = 'vertical',
  columns = 1,
  spacing = 'normal',
  disabled = false,
  noValidate = true,
  ...props
}: FormProps<T>) {
  const { formState, handleSubmit } = form;
  const { isSubmitting, isValid, errors } = formState;

  const spacingClasses = {
    compact: 'space-y-3',
    normal: 'space-y-4',
    comfortable: 'space-y-6',
  };

  const layoutClasses = {
    vertical: spacingClasses[spacing],
    horizontal: 'space-y-4',
    grid: clsx(
      'grid gap-4',
      columns === 1 && 'grid-cols-1',
      columns === 2 && 'grid-cols-1 md:grid-cols-2',
      columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    ),
  };

  return (
    <FormProvider {...form}>
      <FormContext.Provider
        value={{
          isLoading: isSubmitting,
          isValid,
          errors,
        }}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate={noValidate}
          className={clsx(layoutClasses[layout], className)}
          {...props}
        >
          <fieldset disabled={disabled || isSubmitting} className="contents">
            {children}
          </fieldset>
        </form>
      </FormContext.Provider>
    </FormProvider>
  );
}

// Form Section Component
interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  return (
    <div className={clsx('border border-gray-200 rounded-lg', className)}>
      {(title || description) && (
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-sm font-medium text-gray-900">{title}</h3>
              )}
              {description && (
                <p className="text-sm text-gray-500 mt-1">{description}</p>
              )}
            </div>
            {collapsible && (
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
              >
                <svg
                  className={clsx('w-5 h-5 transition-transform', isCollapsed && 'rotate-180')}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
      {(!collapsible || !isCollapsed) && (
        <div className="p-4 space-y-4">{children}</div>
      )}
    </div>
  );
};

// Form Actions Component
interface FormActionsProps {
  children?: ReactNode;
  submitLabel?: string;
  submitVariant?: 'primary' | 'secondary' | 'outline';
  cancelLabel?: string;
  onCancel?: () => void;
  showCancel?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const FormActions: React.FC<FormActionsProps> = ({
  children,
  submitLabel = 'Submit',
  submitVariant = 'primary',
  cancelLabel = 'Cancel',
  onCancel,
  showCancel = false,
  loading,
  disabled,
  className,
  align = 'right',
}) => {
  const { isLoading, isValid } = useFormContext();
  const isSubmitDisabled = disabled || loading || isLoading || !isValid;

  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div className={clsx('flex items-center space-x-3', alignClasses[align], className)}>
      {children}
      {showCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        type="submit"
        variant={submitVariant}
        loading={loading || isLoading}
        disabled={isSubmitDisabled}
      >
        {submitLabel}
      </Button>
    </div>
  );
};

// Form Field Component (wrapper for consistent styling)
interface FormFieldProps {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  children,
  className,
  fullWidth = false,
}) => {
  return (
    <div className={clsx('form-field', fullWidth && 'w-full', className)}>
      {children}
    </div>
  );
};

// Form Validation Feedback Component
interface ValidationFeedbackProps {
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
  className?: string;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  type,
  message,
  className,
}) => {
  const icons = {
    error: AlertCircle,
    warning: AlertTriangle,
    success: CheckCircle2,
    info: Info,
  };

  const colors = {
    error: 'text-red-600 bg-red-50 border-red-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    success: 'text-green-600 bg-green-50 border-green-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200',
  };

  const Icon = icons[type];

  return (
    <div className={clsx(
      'flex items-center px-3 py-2 text-sm border rounded-md',
      colors[type],
      className
    )}>
      <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

// Form Progress Component
interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
  showLabels?: boolean;
  stepLabels?: string[];
  className?: string;
}

export const FormProgress: React.FC<FormProgressProps> = ({
  currentStep,
  totalSteps,
  showLabels = false,
  stepLabels = [],
  className,
}) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className={clsx('form-progress', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    isCompleted && 'bg-green-500 text-white',
                    isCurrent && 'bg-blue-500 text-white',
                    !isCompleted && !isCurrent && 'bg-gray-200 text-gray-600'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    step
                  )}
                </div>
                {showLabels && stepLabels[index] && (
                  <span className={clsx(
                    'mt-2 text-xs',
                    isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'
                  )}>
                    {stepLabels[index]}
                  </span>
                )}
              </div>
              
              {index < steps.length - 1 && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mx-2 transition-colors',
                    step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      <div className="mt-2 text-center">
        <span className="text-sm text-gray-600">
          Step {currentStep} of {totalSteps}
        </span>
      </div>
    </div>
  );
};

// Form Group Component (for related fields)
interface FormGroupProps {
  children: ReactNode;
  label?: string;
  description?: string;
  className?: string;
  columns?: 1 | 2 | 3;
  spacing?: 'compact' | 'normal' | 'comfortable';
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  label,
  description,
  className,
  columns = 1,
  spacing = 'normal',
}) => {
  const spacingClasses = {
    compact: 'space-y-2',
    normal: 'space-y-3',
    comfortable: 'space-y-4',
  };

  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <fieldset className={clsx('space-y-3', className)}>
      {(label || description) && (
        <div>
          {label && (
            <legend className="text-sm font-medium text-gray-900">{label}</legend>
          )}
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
      )}
      <div
        className={clsx(
          columns === 1 ? spacingClasses[spacing] : `grid gap-3 ${gridClasses[columns]}`
        )}
      >
        {children}
      </div>
    </fieldset>
  );
};
