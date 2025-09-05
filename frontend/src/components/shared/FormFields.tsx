import React from 'react';
import { useController, useFormContext, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form';
import { Input } from './Input';
import { Select, SelectOption } from './Select';
import { Textarea } from './Textarea';
import { Checkbox } from './Checkbox';
import { RadioGroup, RadioOption } from './RadioGroup';
import { FileUpload, UploadFile } from './FileUpload';

// Base interface for controlled form fields
interface BaseControlledFieldProps<T extends FieldValues = FieldValues, K extends FieldPath<T> = FieldPath<T>> {
  name: K;
  rules?: RegisterOptions<T, K>;
  shouldUnregister?: boolean;
  defaultValue?: any;
}

// Controlled Input Field
interface ControlledInputProps<T extends FieldValues = FieldValues> extends BaseControlledFieldProps<T> {
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';
  helpText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ControlledInput<T extends FieldValues = FieldValues>({
  name,
  rules,
  shouldUnregister,
  defaultValue,
  ...inputProps
}: ControlledInputProps<T>) {
  const { control } = useFormContext<T>();
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
    shouldUnregister,
    defaultValue,
  });

  return (
    <Input
      {...inputProps}
      ref={ref}
      value={value || ''}
      onChange={onChange}
      onBlur={onBlur}
      error={error?.message}
    />
  );
}

// Controlled Select Field
interface ControlledSelectProps<T extends FieldValues = FieldValues> extends BaseControlledFieldProps<T> {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  helpText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean;
  className?: string;
}

export function ControlledSelect<T extends FieldValues = FieldValues>({
  name,
  rules,
  shouldUnregister,
  defaultValue,
  clearable,
  ...selectProps
}: ControlledSelectProps<T>) {
  const { control } = useFormContext<T>();
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
    shouldUnregister,
    defaultValue,
  });

  const handleClear = () => {
    onChange('');
  };

  return (
    <Select
      {...selectProps}
      ref={ref}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onClear={clearable ? handleClear : undefined}
      clearable={clearable}
      error={error?.message}
    />
  );
}

// Controlled Textarea Field
interface ControlledTextareaProps<T extends FieldValues = FieldValues> extends BaseControlledFieldProps<T> {
  label?: string;
  placeholder?: string;
  helpText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
  showCharacterCount?: boolean;
  maxLength?: number;
  className?: string;
}

export function ControlledTextarea<T extends FieldValues = FieldValues>({
  name,
  rules,
  shouldUnregister,
  defaultValue,
  ...textareaProps
}: ControlledTextareaProps<T>) {
  const { control } = useFormContext<T>();
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
    shouldUnregister,
    defaultValue,
  });

  return (
    <Textarea
      {...textareaProps}
      ref={ref}
      value={value || ''}
      onChange={onChange}
      onBlur={onBlur}
      error={error?.message}
    />
  );
}

// Controlled Checkbox Field
interface ControlledCheckboxProps<T extends FieldValues = FieldValues> extends BaseControlledFieldProps<T> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  variant?: 'default' | 'switch';
  className?: string;
}

export function ControlledCheckbox<T extends FieldValues = FieldValues>({
  name,
  rules,
  shouldUnregister,
  defaultValue = false,
  ...checkboxProps
}: ControlledCheckboxProps<T>) {
  const { control } = useFormContext<T>();
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
    shouldUnregister,
    defaultValue,
  });

  return (
    <div>
      <Checkbox
        {...checkboxProps}
        ref={ref}
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        onBlur={onBlur}
      />
      {error && (
        <p className="text-sm text-red-600 mt-1" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

// Controlled Radio Group Field
interface ControlledRadioGroupProps<T extends FieldValues = FieldValues> extends BaseControlledFieldProps<T> {
  label?: string;
  description?: string;
  options: RadioOption[];
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export function ControlledRadioGroup<T extends FieldValues = FieldValues>({
  name,
  rules,
  shouldUnregister,
  defaultValue,
  ...radioProps
}: ControlledRadioGroupProps<T>) {
  const { control } = useFormContext<T>();
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
    shouldUnregister,
    defaultValue,
  });

  return (
    <RadioGroup
      {...radioProps}
      ref={ref}
      name={name}
      value={value || ''}
      onChange={onChange}
      error={error?.message}
    />
  );
}

// Controlled File Upload Field
interface ControlledFileUploadProps<T extends FieldValues = FieldValues> extends BaseControlledFieldProps<T> {
  label?: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  showPreview?: boolean;
  dragDropArea?: boolean;
  onUpload?: (file: File) => Promise<{ url: string } | { error: string }>;
  className?: string;
}

export function ControlledFileUpload<T extends FieldValues = FieldValues>({
  name,
  rules,
  shouldUnregister,
  defaultValue = [],
  ...fileUploadProps
}: ControlledFileUploadProps<T>) {
  const { control } = useFormContext<T>();
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
    shouldUnregister,
    defaultValue,
  });

  const handleFilesChange = (files: UploadFile[]) => {
    onChange(files);
    onBlur();
  };

  return (
    <FileUpload
      {...fileUploadProps}
      value={value || []}
      onChange={handleFilesChange}
      error={error?.message}
    />
  );
}

// Multi-Select Component (using Select with multiple)
interface ControlledMultiSelectProps<T extends FieldValues = FieldValues> extends BaseControlledFieldProps<T> {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  helpText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ControlledMultiSelect<T extends FieldValues = FieldValues>({
  name,
  rules,
  shouldUnregister,
  defaultValue = [],
  ...selectProps
}: ControlledMultiSelectProps<T>) {
  const { control } = useFormContext<T>();
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
    shouldUnregister,
    defaultValue,
  });

  const selectedOptions = Array.isArray(value) ? value : [];

  const toggleOption = (optionValue: string) => {
    const newValue = selectedOptions.includes(optionValue)
      ? selectedOptions.filter((v) => v !== optionValue)
      : [...selectedOptions, optionValue];
    onChange(newValue);
  };

  return (
    <div className="space-y-1">
      {selectProps.label && (
        <label className="block text-sm font-medium text-gray-700">
          {selectProps.label}
        </label>
      )}
      
      <div className="border border-gray-300 rounded-md p-2 min-h-[2.5rem] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((val) => {
            const option = selectProps.options.find(opt => opt.value === val);
            if (!option) return null;
            
            return (
              <span
                key={val}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
              >
                {option.label}
                <button
                  type="button"
                  onClick={() => toggleOption(val.toString())}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                  aria-label={`Remove ${option.label}`}
                >
                  &times;
                </button>
              </span>
            );
          })}
          
          <select
            ref={ref}
            multiple
            value={[]}
            onChange={(e) => {
              const selectedValue = e.target.value;
              if (selectedValue) {
                toggleOption(selectedValue);
              }
            }}
            onBlur={onBlur}
            className="border-none outline-none flex-1 min-w-[100px] bg-transparent"
            disabled={selectProps.disabled}
          >
            <option value="" disabled>
              {selectProps.placeholder || 'Select options...'}
            </option>
            {selectProps.options
              .filter(option => !selectedOptions.includes(option.value.toString()))
              .map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            }
          </select>
        </div>
      </div>
      
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error.message}
        </p>
      )}
      
      {selectProps.helpText && !error && (
        <p className="text-sm text-gray-500">
          {selectProps.helpText}
        </p>
      )}
    </div>
  );
}
