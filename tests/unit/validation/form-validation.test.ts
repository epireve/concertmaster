/**
 * Form Validation Logic Unit Tests
 * Comprehensive testing for form validation functions and rules
 */

import { 
  validateField, 
  validateForm, 
  createValidationSchema,
  ValidationError,
  ValidationResult,
  FieldValidationRule,
  FormValidationSchema
} from '../../../frontend/src/utils/form-validation';
import { FormField, FormSchema, FormValidation } from '../../../frontend/src/types/forms';
import { createMockField, mockFormSchema, createMockValidation } from '../../fixtures/form-fixtures';

describe('Form Validation', () => {
  describe('Field Validation', () => {
    describe('Text Field Validation', () => {
      const textField = createMockField({
        type: 'text',
        required: true,
        validation: createMockValidation({
          minLength: 2,
          maxLength: 50,
          pattern: '^[a-zA-Z\\s]+$',
          errorMessage: 'Please enter a valid name',
        }),
      });

      it('validates required field with valid input', () => {
        const result = validateField(textField, 'John Doe');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('fails validation for empty required field', () => {
        const result = validateField(textField, '');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('This field is required');
      });

      it('fails validation for input below minimum length', () => {
        const result = validateField(textField, 'A');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Minimum length is 2 characters');
      });

      it('fails validation for input above maximum length', () => {
        const longText = 'A'.repeat(51);
        const result = validateField(textField, longText);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Maximum length is 50 characters');
      });

      it('fails validation for input not matching pattern', () => {
        const result = validateField(textField, 'John123');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Please enter a valid name');
      });

      it('allows empty value for non-required field', () => {
        const optionalField = { ...textField, required: false };
        const result = validateField(optionalField, '');
        expect(result.isValid).toBe(true);
      });
    });

    describe('Email Field Validation', () => {
      const emailField = createMockField({
        type: 'email',
        required: true,
        validation: createMockValidation({
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          errorMessage: 'Please enter a valid email address',
        }),
      });

      it('validates correct email format', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.org',
          'user+tag@company.co.uk',
          'firstname-lastname@subdomain.example.com',
        ];

        validEmails.forEach(email => {
          const result = validateField(emailField, email);
          expect(result.isValid).toBe(true);
        });
      });

      it('fails validation for invalid email formats', () => {
        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          'user@domain',
          'user space@domain.com',
          'user@domain@com',
          'user..double.dot@domain.com',
        ];

        invalidEmails.forEach(email => {
          const result = validateField(emailField, email);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Please enter a valid email address');
        });
      });
    });

    describe('Number Field Validation', () => {
      const numberField = createMockField({
        type: 'number',
        required: true,
        validation: createMockValidation({
          min: 1,
          max: 100,
          errorMessage: 'Please enter a number between 1 and 100',
        }),
      });

      it('validates numbers within range', () => {
        const validNumbers = [1, 50, 100, '25', '75'];
        
        validNumbers.forEach(num => {
          const result = validateField(numberField, num);
          expect(result.isValid).toBe(true);
        });
      });

      it('fails validation for numbers below minimum', () => {
        const result = validateField(numberField, 0);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Minimum value is 1');
      });

      it('fails validation for numbers above maximum', () => {
        const result = validateField(numberField, 101);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Maximum value is 100');
      });

      it('fails validation for non-numeric input', () => {
        const result = validateField(numberField, 'not-a-number');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Please enter a valid number');
      });
    });

    describe('Select Field Validation', () => {
      const selectField = createMockField({
        type: 'select',
        required: true,
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
          { label: 'Option 3', value: 'option3' },
        ],
      });

      it('validates selection from available options', () => {
        const result = validateField(selectField, 'option1');
        expect(result.isValid).toBe(true);
      });

      it('fails validation for invalid selection', () => {
        const result = validateField(selectField, 'invalid-option');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Please select a valid option');
      });

      it('fails validation for empty required selection', () => {
        const result = validateField(selectField, '');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('This field is required');
      });
    });

    describe('Multi-select Field Validation', () => {
      const multiselectField = createMockField({
        type: 'multiselect',
        required: true,
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
          { label: 'Option 3', value: 'option3' },
        ],
        validation: createMockValidation({
          min: 1,
          max: 2,
          errorMessage: 'Please select 1-2 options',
        }),
      });

      it('validates valid multi-selection', () => {
        const result = validateField(multiselectField, ['option1', 'option2']);
        expect(result.isValid).toBe(true);
      });

      it('fails validation for too few selections', () => {
        const result = validateField(multiselectField, []);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Minimum 1 selection required');
      });

      it('fails validation for too many selections', () => {
        const result = validateField(multiselectField, ['option1', 'option2', 'option3']);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Maximum 2 selections allowed');
      });

      it('fails validation for invalid selections', () => {
        const result = validateField(multiselectField, ['option1', 'invalid-option']);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid selection: invalid-option');
      });
    });

    describe('Date Field Validation', () => {
      const dateField = createMockField({
        type: 'date',
        required: true,
        validation: createMockValidation({
          min: '2024-01-01',
          max: '2024-12-31',
          errorMessage: 'Please select a date in 2024',
        }),
      });

      it('validates date within range', () => {
        const result = validateField(dateField, '2024-06-15');
        expect(result.isValid).toBe(true);
      });

      it('fails validation for date before minimum', () => {
        const result = validateField(dateField, '2023-12-31');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Date must be after 2024-01-01');
      });

      it('fails validation for date after maximum', () => {
        const result = validateField(dateField, '2025-01-01');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Date must be before 2024-12-31');
      });

      it('fails validation for invalid date format', () => {
        const result = validateField(dateField, 'invalid-date');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Please enter a valid date');
      });
    });

    describe('File Field Validation', () => {
      const fileField = createMockField({
        type: 'file',
        required: true,
        validation: createMockValidation({
          allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
          maxSize: '5MB',
          errorMessage: 'Please upload a valid file',
        }),
      });

      it('validates file with correct type and size', () => {
        const mockFile = {
          name: 'test.jpg',
          type: 'image/jpeg',
          size: 1024 * 1024, // 1MB
        };
        const result = validateField(fileField, mockFile);
        expect(result.isValid).toBe(true);
      });

      it('fails validation for unsupported file type', () => {
        const mockFile = {
          name: 'test.txt',
          type: 'text/plain',
          size: 1024,
        };
        const result = validateField(fileField, mockFile);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File type not allowed');
      });

      it('fails validation for file size exceeding limit', () => {
        const mockFile = {
          name: 'large.jpg',
          type: 'image/jpeg',
          size: 10 * 1024 * 1024, // 10MB
        };
        const result = validateField(fileField, mockFile);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File size exceeds 5MB limit');
      });
    });

    describe('Custom Validation', () => {
      const customField = createMockField({
        type: 'text',
        validation: createMockValidation({
          custom: 'validatePassword',
          errorMessage: 'Password must meet security requirements',
        }),
      });

      beforeEach(() => {
        // Mock custom validation functions
        (global as any).validatePassword = jest.fn((value: string) => {
          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumbers = /\d/.test(value);
          const hasSpecialChar = /[!@#$%^&*]/.test(value);
          const isLongEnough = value.length >= 8;
          
          return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && isLongEnough;
        });
      });

      it('validates with custom function returning true', () => {
        const result = validateField(customField, 'SecurePass123!');
        expect(result.isValid).toBe(true);
        expect((global as any).validatePassword).toHaveBeenCalledWith('SecurePass123!');
      });

      it('fails validation with custom function returning false', () => {
        const result = validateField(customField, 'weak');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must meet security requirements');
      });
    });
  });

  describe('Form-level Validation', () => {
    const testSchema = mockFormSchema();

    it('validates complete form with all valid data', () => {
      const formData = {
        'test_field_1': 'John Doe',
        'test_field_2': 'john.doe@example.com',
        'test_field_3': 'This is a test comment',
      };

      const result = validateForm(testSchema, formData);
      expect(result.isValid).toBe(true);
      expect(result.fieldErrors).toEqual({});
    });

    it('collects all field validation errors', () => {
      const formData = {
        'test_field_1': '', // Required field empty
        'test_field_2': 'invalid-email', // Invalid email
        'test_field_3': 'Valid comment',
      };

      const result = validateForm(testSchema, formData);
      expect(result.isValid).toBe(false);
      expect(Object.keys(result.fieldErrors)).toContain('test_field_1');
      expect(Object.keys(result.fieldErrors)).toContain('test_field_2');
      expect(Object.keys(result.fieldErrors)).not.toContain('test_field_3');
    });

    it('validates conditional field visibility', () => {
      const conditionalSchema = mockFormSchema({
        fields: [
          createMockField({
            name: 'trigger_field',
            type: 'select',
            options: [
              { label: 'Show', value: 'show' },
              { label: 'Hide', value: 'hide' },
            ],
          }),
          createMockField({
            name: 'conditional_field',
            type: 'text',
            required: true,
            visibility: {
              field: 'trigger_field',
              operator: 'equals',
              value: 'show',
            },
          }),
        ],
      });

      // When trigger shows conditional field
      const visibleResult = validateForm(conditionalSchema, {
        trigger_field: 'show',
        conditional_field: '', // Required but empty
      });
      expect(visibleResult.isValid).toBe(false);
      expect(visibleResult.fieldErrors.conditional_field).toContain('This field is required');

      // When trigger hides conditional field
      const hiddenResult = validateForm(conditionalSchema, {
        trigger_field: 'hide',
        conditional_field: '', // Hidden field, validation skipped
      });
      expect(hiddenResult.isValid).toBe(true);
    });

    it('validates cross-field dependencies', () => {
      const dependentSchema = mockFormSchema({
        fields: [
          createMockField({
            name: 'password',
            type: 'text',
            required: true,
          }),
          createMockField({
            name: 'confirm_password',
            type: 'text',
            required: true,
            validation: createMockValidation({
              custom: 'matchesField',
              errorMessage: 'Passwords must match',
            }),
          }),
        ],
      });

      // Mock cross-field validation
      (global as any).matchesField = jest.fn((value: string, allData: any) => {
        return value === allData.password;
      });

      const mismatchResult = validateForm(dependentSchema, {
        password: 'secret123',
        confirm_password: 'different123',
      });
      expect(mismatchResult.isValid).toBe(false);
      expect(mismatchResult.fieldErrors.confirm_password).toContain('Passwords must match');

      const matchResult = validateForm(dependentSchema, {
        password: 'secret123',
        confirm_password: 'secret123',
      });
      expect(matchResult.isValid).toBe(true);
    });
  });

  describe('Validation Schema Creation', () => {
    it('creates validation schema from form fields', () => {
      const fields = [
        createMockField({ name: 'name', type: 'text', required: true }),
        createMockField({ name: 'email', type: 'email', required: true }),
        createMockField({ name: 'age', type: 'number', required: false }),
      ];

      const schema = createValidationSchema(fields);

      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('email');
      expect(schema).toHaveProperty('age');
      expect(schema.name.required).toBe(true);
      expect(schema.email.required).toBe(true);
      expect(schema.age.required).toBe(false);
    });

    it('handles complex validation rules', () => {
      const field = createMockField({
        name: 'complex_field',
        type: 'text',
        required: true,
        validation: createMockValidation({
          minLength: 5,
          maxLength: 20,
          pattern: '^[A-Z][a-z]*$',
          custom: 'customValidator',
        }),
      });

      const schema = createValidationSchema([field]);
      const fieldSchema = schema.complex_field;

      expect(fieldSchema.required).toBe(true);
      expect(fieldSchema.minLength).toBe(5);
      expect(fieldSchema.maxLength).toBe(20);
      expect(fieldSchema.pattern).toBe('^[A-Z][a-z]*$');
      expect(fieldSchema.custom).toBe('customValidator');
    });
  });

  describe('Error Handling', () => {
    it('handles validation errors gracefully', () => {
      const corruptedField = createMockField({
        validation: null as any, // Corrupted validation
      });

      expect(() => validateField(corruptedField, 'test')).not.toThrow();
    });

    it('provides meaningful error messages', () => {
      const field = createMockField({
        type: 'email',
        label: 'Email Address',
        validation: createMockValidation({
          errorMessage: 'Please provide a valid email address',
        }),
      });

      const result = validateField(field, 'invalid-email');
      expect(result.errors).toContain('Please provide a valid email address');
    });

    it('falls back to default error messages', () => {
      const field = createMockField({
        type: 'text',
        required: true,
        validation: createMockValidation({
          errorMessage: undefined,
        }),
      });

      const result = validateField(field, '');
      expect(result.errors).toContain('This field is required');
    });
  });

  describe('Performance', () => {
    it('validates large forms efficiently', () => {
      const largeSchema = mockFormSchema({
        fields: Array.from({ length: 100 }, (_, i) =>
          createMockField({
            name: `field_${i}`,
            type: 'text',
            required: i % 2 === 0,
          })
        ),
      });

      const formData = Object.fromEntries(
        largeSchema.fields.map((field, i) => [field.name, `value_${i}`])
      );

      const startTime = performance.now();
      const result = validateForm(largeSchema, formData);
      const endTime = performance.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Should validate in under 50ms
    });

    it('caches validation results for repeated validations', () => {
      const field = createMockField({
        validation: createMockValidation({
          pattern: '^[a-zA-Z]+$',
        }),
      });

      const value = 'TestValue';
      
      // First validation
      const startTime1 = performance.now();
      validateField(field, value);
      const endTime1 = performance.now();
      
      // Second validation (should be cached)
      const startTime2 = performance.now();
      validateField(field, value);
      const endTime2 = performance.now();

      // Second validation should be faster
      expect(endTime2 - startTime2).toBeLessThan(endTime1 - startTime1);
    });
  });

  describe('Accessibility', () => {
    it('provides accessible error messages', () => {
      const field = createMockField({
        accessibility: {
          ariaLabel: 'Full name input',
          description: 'Enter your full legal name',
        },
        validation: createMockValidation({
          errorMessage: 'Full name is required for identification',
        }),
      });

      const result = validateField(field, '');
      expect(result.errors[0]).toBe('Full name is required for identification');
      expect(result.accessibilityHint).toBe('Enter your full legal name');
    });

    it('includes field context in validation results', () => {
      const field = createMockField({
        label: 'Email Address',
        accessibility: {
          ariaLabel: 'Your email address',
        },
      });

      const result = validateField(field, 'invalid');
      expect(result.fieldLabel).toBe('Email Address');
      expect(result.fieldAriaLabel).toBe('Your email address');
    });
  });
});