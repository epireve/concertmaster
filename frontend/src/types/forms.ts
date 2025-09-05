// Types for the Form Builder and Form System

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  description?: string;
  validation?: FormValidation;
  options?: FormOption[];
  defaultValue?: any;
  order: number;
  section?: string;
  visibility?: FormVisibilityRule;
  styling?: FieldStyling;
  accessibility?: FieldAccessibility;
  position?: { x: number; y: number };
  updatedAt?: Date;
}

export type FormFieldType = 
  | 'text'
  | 'textarea' 
  | 'email'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'file'
  | 'url'
  | 'phone'
  | 'currency'
  | 'rating'
  | 'matrix'
  | 'signature'
  | 'location';

export interface FormOption {
  label: string;
  value: string;
  description?: string;
}

export interface FormValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: string; // Custom validation function
  errorMessage?: string;
  message?: string;
  type?: string;
  allowedTypes?: string[];
  maxSize?: string;
}

export interface FieldStyling {
  width?: string;
  height?: string;
  margin?: string;
  padding?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

export interface FieldAccessibility {
  ariaLabel?: string;
  description?: string;
  required?: boolean;
}

export interface FormVisibilityRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  collapsible?: boolean;
  collapsed?: boolean;
}

export interface FormLayout {
  containerWidth?: string;
  fieldSpacing?: 'compact' | 'normal' | 'comfortable' | 'large';
  sectionSpacing?: 'compact' | 'normal' | 'comfortable' | 'large';
  alignment?: 'left' | 'center' | 'right';
  columns?: number;
  responsive?: {
    mobile?: { columns: number };
    tablet?: { columns: number };
    desktop?: { columns: number };
  };
}

export interface FormSchema {
  id: string;
  name: string;
  title: string;
  description?: string;
  version: string;
  fields: FormField[];
  sections: FormSection[];
  settings: FormSettings;
  styling: FormStyling;
  layout?: FormLayout;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface FormSettings {
  allowMultipleSubmissions: boolean;
  requireAuthentication: boolean;
  showProgressBar: boolean;
  savePartialResponses: boolean;
  redirectUrl?: string;
  confirmationMessage?: string;
  notificationEmails?: string[];
  submitButtonText: string;
  language: string;
  timezone: string;
  theme?: string;
  animations?: boolean;
  responsiveDesign?: boolean;
}

export interface FormStyling {
  theme: 'default' | 'modern' | 'minimal' | 'corporate';
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  font: string;
  customCss?: string;
  borderRadius?: string;
  spacing?: 'compact' | 'normal' | 'comfortable' | 'large';
  shadows?: boolean;
  gradients?: boolean;
}

export interface FormResponse {
  id: string;
  formId: string;
  workflowRunId?: string;
  data: Record<string, any>;
  metadata: FormResponseMetadata;
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';
  submittedAt?: Date;
  submittedBy?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewComments?: string;
}

export interface FormResponseMetadata {
  userAgent: string;
  ipAddress: string;
  referrer?: string;
  startedAt: Date;
  timeSpent: number; // in seconds
  deviceType: 'desktop' | 'mobile' | 'tablet';
  location?: {
    country: string;
    city: string;
    coordinates?: [number, number];
  };
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  schema: Omit<FormSchema, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;
  preview: string; // Base64 image
  featured: boolean;
  downloads: number;
  rating: number;
}

// Form Builder specific types
export interface FieldEditorProps {
  field: FormField;
  onChange: (field: FormField) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export interface FormPreviewProps {
  schema: FormSchema;
  showValidation?: boolean;
  interactive?: boolean;
}

export interface FormBuilderState {
  schema: FormSchema;
  selectedField: FormField | null;
  previewMode: boolean;
  isDirty: boolean;
}

// Validation and submission types
export interface FormValidationError {
  field: string;
  message: string;
  code: string;
}

export interface FormSubmissionResult {
  success: boolean;
  responseId?: string;
  errors?: FormValidationError[];
  message?: string;
}

// Form analytics types
export interface FormAnalytics {
  formId: string;
  totalViews: number;
  totalSubmissions: number;
  conversionRate: number;
  averageTimeToComplete: number;
  abandonmentRate: number;
  fieldAnalytics: FieldAnalytics[];
  popularDevices: { device: string; count: number }[];
  geographicDistribution: { country: string; count: number }[];
}

export interface FieldAnalytics {
  fieldId: string;
  fieldName: string;
  completionRate: number;
  averageTimeSpent: number;
  errorRate: number;
  commonErrors: string[];
  dropoffRate: number;
}

// Integration types
export interface FormIntegration {
  id: string;
  formId: string;
  type: 'webhook' | 'email' | 'database' | 'api' | 'zapier';
  config: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
}

export interface WebhookIntegration {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic' | 'api_key';
    credentials: Record<string, string>;
  };
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    delay: number;
  };
}