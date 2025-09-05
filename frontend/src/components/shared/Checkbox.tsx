import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { CheckIcon, MinusIcon } from 'lucide-react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  description?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  indeterminate?: boolean;
  variant?: 'default' | 'switch';
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>((
  {
    label,
    description,
    error,
    size = 'md',
    indeterminate = false,
    variant = 'default',
    className,
    id,
    disabled,
    checked,
    ...props
  },
  ref
) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  if (variant === 'switch') {
    return (
      <div className={clsx('flex items-start', className)}>
        <div className="flex items-center h-5">
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-describedby={error ? `${checkboxId}-error` : description ? `${checkboxId}-desc` : undefined}
            disabled={disabled}
            onClick={() => {
              const event = new Event('change', { bubbles: true });
              Object.defineProperty(event, 'target', {
                writable: false,
                value: { checked: !checked, ...props }
              });
              props.onChange?.(event as any);
            }}
            className={clsx(
              'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              checked ? 'bg-blue-600' : 'bg-gray-200',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="sr-only">{label || 'Toggle'}</span>
            <span
              className={clsx(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200',
                checked ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            {...props}
          />
        </div>
        
        {(label || description) && (
          <div className="ml-3">
            {label && (
              <label htmlFor={checkboxId} className="text-sm font-medium text-gray-700 cursor-pointer">
                {label}
                {props.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}
            {description && (
              <p id={`${checkboxId}-desc`} className="text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>
        )}
        
        {error && (
          <p id={`${checkboxId}-error`} className="text-sm text-red-600 mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('flex items-start', className)}>
      <div className="flex items-center h-5">
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            className={clsx(
              'border border-gray-300 rounded transition-colors cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              'checked:bg-blue-600 checked:border-blue-600',
              error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              sizeClasses[size]
            )}
            aria-describedby={error ? `${checkboxId}-error` : description ? `${checkboxId}-desc` : undefined}
            aria-invalid={!!error}
            {...props}
          />
          
          {/* Custom checkmark */}
          <div className={clsx(
            'absolute inset-0 flex items-center justify-center pointer-events-none',
            (checked || indeterminate) ? 'text-white' : 'text-transparent'
          )}>
            {indeterminate ? (
              <MinusIcon className={iconSizes[size]} />
            ) : (
              <CheckIcon className={iconSizes[size]} strokeWidth={3} />
            )}
          </div>
        </div>
      </div>
      
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <label htmlFor={checkboxId} className="text-sm font-medium text-gray-700 cursor-pointer">
              {label}
              {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}
          {description && (
            <p id={`${checkboxId}-desc`} className="text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>
      )}
      
      {error && (
        <p id={`${checkboxId}-error`} className="text-sm text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';
