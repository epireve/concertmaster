/**
 * Form Testing Fixtures
 * Mock data and factory functions for form-related tests
 */

import { 
  FormSchema, 
  FormField, 
  FormFieldType, 
  FormSection, 
  FormSettings, 
  FormStyling,
  FormResponse,
  FormValidation,
  FormTemplate,
  FormAnalytics,
  FieldAnalytics,
  FormResponseMetadata
} from '../../frontend/src/types/forms';

/**
 * Create a mock form field with optional overrides
 */
export function createMockField(overrides: Partial<FormField> = {}): FormField {
  return {
    id: `field-${Math.random().toString(36).substr(2, 9)}`,
    type: 'text',
    label: 'Test Field',
    name: `test_field_${Date.now()}`,
    required: false,
    placeholder: 'Enter value...',
    description: 'This is a test field',
    order: 0,
    validation: {
      minLength: 1,
      maxLength: 100,
      errorMessage: 'Invalid input',
    },
    accessibility: {
      ariaLabel: 'Test field input',
      description: 'This field is for testing purposes',
      required: false,
    },
    styling: {
      width: '100%',
      backgroundColor: '#ffffff',
      borderColor: '#d1d5db',
      textColor: '#111827',
    },
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/**
 * Create a mock form section with optional overrides
 */
export function createMockSection(overrides: Partial<FormSection> = {}): FormSection {
  return {
    id: `section-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Section',
    description: 'This is a test section',
    order: 0,
    collapsible: true,
    collapsed: false,
    ...overrides,
  };
}

/**
 * Create mock form settings with optional overrides
 */
export function createMockSettings(overrides: Partial<FormSettings> = {}): FormSettings {
  return {
    allowMultipleSubmissions: false,
    requireAuthentication: false,
    showProgressBar: true,
    savePartialResponses: true,
    redirectUrl: 'https://example.com/thank-you',
    confirmationMessage: 'Thank you for your submission!',
    notificationEmails: ['admin@example.com', 'notify@example.com'],
    submitButtonText: 'Submit',
    language: 'en',
    timezone: 'UTC',
    theme: 'default',
    animations: true,
    responsiveDesign: true,
    ...overrides,
  };
}

/**
 * Create mock form styling with optional overrides
 */
export function createMockStyling(overrides: Partial<FormStyling> = {}): FormStyling {
  return {
    theme: 'default',
    primaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    font: 'Inter',
    customCss: '/* Custom styles here */',
    borderRadius: '6px',
    spacing: 'normal',
    shadows: true,
    gradients: false,
    ...overrides,
  };
}

/**
 * Create a complete mock form schema with optional overrides
 */
export function mockFormSchema(overrides: Partial<FormSchema> = {}): FormSchema {
  const baseSchema: FormSchema = {
    id: `form-${Math.random().toString(36).substr(2, 9)}`,
    name: 'test-form',
    title: 'Test Form',
    description: 'This is a test form for unit testing',
    version: '1.0.0',
    fields: [
      createMockField({ type: 'text', label: 'Full Name', required: true, order: 0 }),
      createMockField({ type: 'email', label: 'Email Address', required: true, order: 1 }),
      createMockField({ type: 'textarea', label: 'Comments', required: false, order: 2 }),
    ],
    sections: [
      createMockSection({ title: 'Personal Information', order: 0 }),
      createMockSection({ title: 'Additional Details', order: 1 }),
    ],
    settings: createMockSettings(),
    styling: createMockStyling(),
    layout: {
      containerWidth: '800px',
      fieldSpacing: 'normal',
      sectionSpacing: 'normal',
      alignment: 'left',
      columns: 1,
      responsive: {
        mobile: { columns: 1 },
        tablet: { columns: 1 },
        desktop: { columns: 2 },
      },
    },
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    createdBy: 'test-user-123',
    ...overrides,
  };

  return baseSchema;
}

/**
 * Create mock form response metadata
 */
export function createMockResponseMetadata(overrides: Partial<FormResponseMetadata> = {}): FormResponseMetadata {
  return {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    ipAddress: '192.168.1.1',
    referrer: 'https://example.com/forms',
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    timeSpent: 180, // 3 minutes
    deviceType: 'desktop',
    location: {
      country: 'United States',
      city: 'San Francisco',
      coordinates: [-122.4194, 37.7749],
    },
    ...overrides,
  };
}

/**
 * Create a mock form response with optional overrides
 */
export function createMockResponse(overrides: Partial<FormResponse> = {}): FormResponse {
  return {
    id: `response-${Math.random().toString(36).substr(2, 9)}`,
    formId: 'test-form-123',
    workflowRunId: 'workflow-run-456',
    data: {
      'full_name': 'John Doe',
      'email_address': 'john.doe@example.com',
      'comments': 'This is a test response with sample data.',
      'rating': 5,
      'subscribe_newsletter': true,
    },
    metadata: createMockResponseMetadata(),
    status: 'submitted',
    submittedAt: new Date('2024-01-01T00:05:00.000Z'),
    submittedBy: 'user-789',
    reviewedAt: new Date('2024-01-01T01:00:00.000Z'),
    reviewedBy: 'admin-123',
    reviewComments: 'Approved - all data looks good',
    ...overrides,
  };
}

/**
 * Create mock field validation with optional overrides
 */
export function createMockValidation(overrides: Partial<FormValidation> = {}): FormValidation {
  return {
    min: 1,
    max: 100,
    minLength: 2,
    maxLength: 255,
    pattern: '^[a-zA-Z\\s]+$',
    custom: 'validateCustomField',
    errorMessage: 'Please enter a valid value',
    message: 'This field is required',
    type: 'string',
    allowedTypes: ['text/plain', 'text/html'],
    maxSize: '5MB',
    ...overrides,
  };
}

/**
 * Create mock form template with optional overrides
 */
export function createMockTemplate(overrides: Partial<FormTemplate> = {}): FormTemplate {
  return {
    id: `template-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Contact Form Template',
    description: 'A professional contact form template with validation',
    category: 'Business',
    tags: ['contact', 'business', 'professional', 'validation'],
    schema: {
      name: 'contact-form',
      title: 'Contact Us',
      description: 'Get in touch with our team',
      version: '1.0.0',
      fields: [
        createMockField({ type: 'text', label: 'Full Name', required: true }),
        createMockField({ type: 'email', label: 'Email', required: true }),
        createMockField({ type: 'phone', label: 'Phone Number', required: false }),
        createMockField({ type: 'textarea', label: 'Message', required: true }),
      ],
      sections: [createMockSection({ title: 'Contact Information' })],
      settings: createMockSettings(),
      styling: createMockStyling(),
    },
    preview: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    featured: false,
    downloads: 1234,
    rating: 4.5,
    ...overrides,
  };
}

/**
 * Create mock field analytics with optional overrides
 */
export function createMockFieldAnalytics(overrides: Partial<FieldAnalytics> = {}): FieldAnalytics {
  return {
    fieldId: 'field-123',
    fieldName: 'email_address',
    completionRate: 0.92,
    averageTimeSpent: 15.5,
    errorRate: 0.08,
    commonErrors: [
      'Invalid email format',
      'Email already exists',
      'Domain not allowed',
    ],
    dropoffRate: 0.05,
    ...overrides,
  };
}

/**
 * Create mock form analytics with optional overrides
 */
export function createMockAnalytics(overrides: Partial<FormAnalytics> = {}): FormAnalytics {
  return {
    formId: 'form-123',
    totalViews: 1500,
    totalSubmissions: 1200,
    conversionRate: 0.80,
    averageTimeToComplete: 180, // 3 minutes
    abandonmentRate: 0.15,
    fieldAnalytics: [
      createMockFieldAnalytics({ fieldId: 'field-1', fieldName: 'full_name' }),
      createMockFieldAnalytics({ fieldId: 'field-2', fieldName: 'email_address' }),
      createMockFieldAnalytics({ fieldId: 'field-3', fieldName: 'comments' }),
    ],
    popularDevices: [
      { device: 'Desktop', count: 800 },
      { device: 'Mobile', count: 600 },
      { device: 'Tablet', count: 100 },
    ],
    geographicDistribution: [
      { country: 'United States', count: 800 },
      { country: 'Canada', count: 200 },
      { country: 'United Kingdom', count: 150 },
      { country: 'Germany', count: 100 },
      { country: 'France', count: 50 },
    ],
    ...overrides,
  };
}

/**
 * Form field type options for testing
 */
export const FORM_FIELD_TYPES: FormFieldType[] = [
  'text',
  'textarea',
  'email',
  'number',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'date',
  'datetime',
  'file',
  'url',
  'phone',
  'currency',
  'rating',
  'matrix',
  'signature',
  'location',
];

/**
 * Create form fields for each type for comprehensive testing
 */
export function createAllFieldTypes(): FormField[] {
  return FORM_FIELD_TYPES.map((type, index) =>
    createMockField({
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      name: `${type}_field`,
      order: index,
    })
  );
}

/**
 * Create a large form schema for performance testing
 */
export function createLargeFormSchema(fieldCount: number = 100): FormSchema {
  const fields = Array.from({ length: fieldCount }, (_, index) => {
    const typeIndex = index % FORM_FIELD_TYPES.length;
    const fieldType = FORM_FIELD_TYPES[typeIndex];
    
    return createMockField({
      type: fieldType,
      label: `${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field ${index + 1}`,
      name: `${fieldType}_field_${index + 1}`,
      order: index,
      required: index % 3 === 0, // Every 3rd field is required
    });
  });

  const sections = Array.from({ length: Math.ceil(fieldCount / 10) }, (_, index) =>
    createMockSection({
      title: `Section ${index + 1}`,
      order: index,
    })
  );

  return mockFormSchema({
    title: `Large Test Form (${fieldCount} fields)`,
    fields,
    sections,
  });
}

/**
 * Mock API responses for form operations
 */
export const mockApiResponses = {
  createForm: (schema: FormSchema) => ({
    success: true,
    data: { ...schema, id: 'new-form-id' },
    message: 'Form created successfully',
  }),

  updateForm: (schema: FormSchema) => ({
    success: true,
    data: { ...schema, updatedAt: new Date() },
    message: 'Form updated successfully',
  }),

  deleteForm: (formId: string) => ({
    success: true,
    data: { id: formId },
    message: 'Form deleted successfully',
  }),

  submitResponse: (response: FormResponse) => ({
    success: true,
    data: { ...response, id: 'new-response-id' },
    message: 'Response submitted successfully',
  }),

  getAnalytics: (formId: string) => ({
    success: true,
    data: createMockAnalytics({ formId }),
    message: 'Analytics retrieved successfully',
  }),

  error: (message: string = 'An error occurred') => ({
    success: false,
    error: {
      message,
      code: 'GENERIC_ERROR',
      details: {},
    },
  }),

  validationError: (errors: Array<{ field: string; message: string }>) => ({
    success: false,
    error: {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: { errors },
    },
  }),
};

/**
 * Mock user interactions for testing
 */
export const mockUserActions = {
  fillForm: (fields: Record<string, any>) => ({
    type: 'FILL_FORM',
    payload: fields,
  }),

  submitForm: (formId: string) => ({
    type: 'SUBMIT_FORM',
    payload: { formId },
  }),

  saveProgress: (formId: string, data: Record<string, any>) => ({
    type: 'SAVE_PROGRESS',
    payload: { formId, data },
  }),

  validateField: (fieldName: string, value: any) => ({
    type: 'VALIDATE_FIELD',
    payload: { fieldName, value },
  }),
};

/**
 * Mock form field with all properties for comprehensive testing
 */
export const mockFormField: FormField = createMockField({
  type: 'text',
  label: 'Complete Test Field',
  name: 'complete_test_field',
  required: true,
  placeholder: 'Enter your value here...',
  description: 'This field includes all possible properties for testing',
  validation: createMockValidation(),
  options: [
    { label: 'Option 1', value: 'option1', description: 'First option' },
    { label: 'Option 2', value: 'option2', description: 'Second option' },
    { label: 'Option 3', value: 'option3', description: 'Third option' },
  ],
  defaultValue: 'default-value',
  order: 0,
  section: 'test-section-1',
  visibility: {
    field: 'other_field',
    operator: 'equals',
    value: 'show-this-field',
  },
  styling: {
    width: '100%',
    height: 'auto',
    margin: '0 0 1rem 0',
    padding: '0.5rem',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 'normal',
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    textColor: '#1f2937',
  },
  accessibility: {
    ariaLabel: 'Complete test field for accessibility testing',
    description: 'This field tests all accessibility features',
    required: true,
  },
  position: { x: 100, y: 200 },
});