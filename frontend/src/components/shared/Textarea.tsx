import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
  fullWidth?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
  showCharacterCount?: boolean;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>((
  {
    label,
    error,
    helpText,
    fullWidth = false,
    resize = 'vertical',
    autoResize = false,
    minRows = 3,
    maxRows = 10,
    showCharacterCount = false,
    maxLength,
    className,
    id,
    value,
    onChange,
    ...props
  },
  ref
) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;
  
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
    if (typeof value === 'string') {
      setCharacterCount(value.length);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setCharacterCount(newValue.length);
    
    if (autoResize && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
      const minHeight = minRows * lineHeight;
      const maxHeight = maxRows * lineHeight;
      
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
    
    onChange?.(e);
  };

  useEffect(() => {
    if (autoResize && textareaRef.current && typeof value === 'string') {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
      const minHeight = minRows * lineHeight;
      const maxHeight = maxRows * lineHeight;
      
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [autoResize, minRows, maxRows, value]);

  const resizeClasses = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize'
  };

  return (
    <div className={clsx('space-y-1', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          id={textareaId}
          value={value}
          onChange={handleChange}
          maxLength={maxLength}
          rows={autoResize ? minRows : props.rows || 3}
          className={clsx(
            'block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            resizeClasses[resize],
            className
          )}
          aria-describedby={
            error ? `${textareaId}-error` : 
            helpText ? `${textareaId}-help` : 
            showCharacterCount ? `${textareaId}-count` : undefined
          }
          aria-invalid={!!error}
          {...props}
        />
      </div>
      
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {error && (
            <p id={`${textareaId}-error`} className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          
          {helpText && !error && (
            <p id={`${textareaId}-help`} className="text-sm text-gray-500">
              {helpText}
            </p>
          )}
        </div>
        
        {showCharacterCount && (
          <p 
            id={`${textareaId}-count`} 
            className={clsx(
              'text-xs ml-2 mt-0.5',
              maxLength && characterCount > maxLength * 0.9 
                ? 'text-orange-600' 
                : maxLength && characterCount === maxLength 
                  ? 'text-red-600' 
                  : 'text-gray-500'
            )}
            aria-live="polite"
          >
            {characterCount}{maxLength && `/${maxLength}`}
          </p>
        )}
      </div>
    </div>
  );
});

Textarea.displayName = 'Textarea';
