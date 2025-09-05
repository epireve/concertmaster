import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { ChevronDownIcon, CheckIcon } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  group?: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  helpText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>((
  {
    label,
    error,
    helpText,
    options,
    placeholder,
    fullWidth = false,
    size = 'md',
    loading = false,
    clearable = false,
    onClear,
    className,
    id,
    value,
    ...props
  },
  ref
) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  const groupedOptions = options.reduce((groups, option) => {
    const group = option.group || 'default';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(option);
    return groups;
  }, {} as Record<string, SelectOption[]>);

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
  };

  return (
    <div className={clsx('space-y-1', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          value={value}
          className={clsx(
            'block w-full border border-gray-300 rounded-md shadow-sm transition-colors appearance-none',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'bg-white pr-10',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            loading && 'opacity-50 cursor-wait',
            sizeClasses[size],
            className
          )}
          disabled={loading || props.disabled}
          aria-describedby={error ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          
          {Object.keys(groupedOptions).map((groupKey) => {
            const groupOptions = groupedOptions[groupKey];
            
            if (groupKey === 'default') {
              return groupOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ));
            }
            
            return (
              <optgroup key={groupKey} label={groupKey}>
                {groupOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          {loading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </div>
        
        {clearable && value && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-8 flex items-center pr-2 pointer-events-auto hover:text-gray-600"
            aria-label="Clear selection"
          >
            <span className="text-gray-400 text-lg">&times;</span>
          </button>
        )}
      </div>
      
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p id={`${selectId}-help`} className="text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
