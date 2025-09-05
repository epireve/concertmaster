import React, { forwardRef, createContext, useContext } from 'react';
import { clsx } from 'clsx';

export interface RadioOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  size: 'sm' | 'md' | 'lg';
}

const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

interface RadioGroupProps {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  options?: RadioOption[];
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

export const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>((
  {
    name,
    value,
    onChange,
    options = [],
    label,
    description,
    error,
    disabled = false,
    orientation = 'vertical',
    size = 'md',
    className,
    children,
  },
  ref
) => {
  const groupId = `radio-group-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <fieldset ref={ref} className={clsx('space-y-2', className)}>
      {label && (
        <legend className="text-sm font-medium text-gray-700">
          {label}
        </legend>
      )}
      
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}
      
      <RadioGroupContext.Provider value={{
        name,
        value,
        onChange,
        disabled,
        error,
        size
      }}>
        <div className={clsx(
          'space-y-2',
          orientation === 'horizontal' && 'flex flex-wrap gap-6 space-y-0'
        )}>
          {children || options.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              label={option.label}
              description={option.description}
            />
          ))}
        </div>
      </RadioGroupContext.Provider>
      
      {error && (
        <p id={`${groupId}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
});

RadioGroup.displayName = 'RadioGroup';

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'name' | 'size'> {
  value: string;
  label?: string;
  description?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>((
  {
    value,
    label,
    description,
    disabled,
    className,
    id,
    ...props
  },
  ref
) => {
  const context = useContext(RadioGroupContext);
  
  if (!context) {
    throw new Error('Radio must be used within a RadioGroup');
  }
  
  const { name, value: groupValue, onChange, disabled: groupDisabled, size } = context;
  const radioId = id || `radio-${name}-${value}`;
  const isChecked = groupValue === value;
  const isDisabled = disabled || groupDisabled;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6'
  };

  const handleChange = () => {
    if (!isDisabled) {
      onChange(value);
    }
  };

  return (
    <div className={clsx('flex items-start', className)}>
      <div className="flex items-center h-5">
        <input
          ref={ref}
          type="radio"
          id={radioId}
          name={name}
          value={value}
          checked={isChecked}
          disabled={isDisabled}
          onChange={handleChange}
          className={clsx(
            'border border-gray-300 rounded-full transition-colors cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
            'checked:bg-blue-600 checked:border-blue-600',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizeClasses[size]
          )}
          aria-describedby={description ? `${radioId}-desc` : undefined}
          {...props}
        />
        
        {/* Custom radio dot */}
        <div className={clsx(
          'absolute pointer-events-none',
          sizeClasses[size],
          'flex items-center justify-center'
        )}>
          <div className={clsx(
            'rounded-full bg-white transition-opacity',
            isChecked ? 'opacity-100' : 'opacity-0',
            size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-2.5 h-2.5'
          )} />
        </div>
      </div>
      
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <label htmlFor={radioId} className="text-sm font-medium text-gray-700 cursor-pointer">
              {label}
            </label>
          )}
          {description && (
            <p id={`${radioId}-desc`} className="text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

Radio.displayName = 'Radio';
