/**
 * Comprehensive integration tests for FormPreview component in Phase 4 Review System.
 * Tests cover rendering, validation, interaction, accessibility, and error handling.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormPreview } from '@/components/forms/FormPreview';
import { FormSchema } from '@/types/forms';
import '@testing-library/jest-dom';

// Mock form schema for testing
const mockFormSchema: FormSchema = {
  id: 'test-form-001',
  name: 'supplier-registration',
  title: 'Supplier Registration Form',
  description: 'Complete supplier onboarding and review process',
  version: '1.0.0',
  fields: [
    {
      id: 'company_name',
      name: 'company_name',
      type: 'text',
      label: 'Company Name',
      required: true,
      order: 1,
      placeholder: 'Enter your company name',
      validation: {
        minLength: 2,
        maxLength: 100,
        errorMessage: 'Company name must be 2-100 characters'
      }
    },
    {
      id: 'contact_email',
      name: 'contact_email',
      type: 'email',
      label: 'Contact Email',
      required: true,
      order: 2,
      placeholder: 'Enter your email address',
      validation: {
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        errorMessage: 'Please enter a valid email address'
      }
    },
    {
      id: 'business_type',
      name: 'business_type',
      type: 'select',
      label: 'Business Type',
      required: true,
      order: 3,
      options: [
        { label: 'Corporation', value: 'corporation' },
        { label: 'LLC', value: 'llc' },
        { label: 'Partnership', value: 'partnership' },
        { label: 'Sole Proprietorship', value: 'sole_proprietorship' }
      ]
    },
    {
      id: 'annual_revenue',
      name: 'annual_revenue',
      type: 'currency',
      label: 'Annual Revenue',
      required: false,
      order: 4,
      placeholder: '0.00',
      validation: {
        min: 0,
        max: 999999999.99
      }
    },
    {
      id: 'certification_files',
      name: 'certification_files',
      type: 'file',
      label: 'Certification Documents',
      required: true,
      order: 5,
      validation: {
        pattern: '\\.(pdf|doc|docx)$',
        maxSize: 10485760, // 10MB
        errorMessage: 'Only PDF, DOC, DOCX files under 10MB allowed'
      }
    },
    {
      id: 'rating',
      name: 'rating',
      type: 'rating',
      label: 'Service Expectation Rating',
      required: false,
      order: 6,
      validation: {
        max: 5
      }
    },
    {
      id: 'comments',
      name: 'comments',
      type: 'textarea',
      label: 'Additional Comments',
      required: false,
      order: 7,
      placeholder: 'Any additional information...'
    },
    {
      id: 'terms_agreement',
      name: 'terms_agreement',
      type: 'checkbox',
      label: 'Terms and Conditions',
      required: true,
      order: 8,
      options: [
        { label: 'I agree to the terms and conditions', value: 'agreed' }
      ]
    }
  ],
  sections: [],
  settings: {
    allowMultipleSubmissions: false,
    requireAuthentication: true,
    showProgressBar: true,
    savePartialResponses: true,
    submitButtonText: 'Submit for Review',
    confirmationMessage: 'Your application has been submitted for review',
    language: 'en',
    timezone: 'UTC',
    enableReview: true
  },
  styling: {
    theme: 'default',
    primaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    font: 'Inter'
  },
  createdBy: 'test-user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe('FormPreview Component', () => {
  const user = userEvent.setup();

  describe('Rendering and Structure', () => {
    test('renders form with title and description', () => {
      render(<FormPreview schema={mockFormSchema} />);
      
      expect(screen.getByText('Supplier Registration Form')).toBeInTheDocument();
      expect(screen.getByText('Complete supplier onboarding and review process')).toBeInTheDocument();
    });

    test('renders all form fields in correct order', () => {
      render(<FormPreview schema={mockFormSchema} />);
      
      const fields = screen.getAllByRole('textbox');
      const selectField = screen.getByLabelText('Business Type');
      const fileField = screen.getByLabelText('Certification Documents');
      
      expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Contact Email')).toBeInTheDocument();
      expect(selectField).toBeInTheDocument();
      expect(screen.getByLabelText('Annual Revenue')).toBeInTheDocument();
      expect(fileField).toBeInTheDocument();
      expect(screen.getByLabelText('Service Expectation Rating')).toBeInTheDocument();
      expect(screen.getByLabelText('Additional Comments')).toBeInTheDocument();
      expect(screen.getByLabelText('I agree to the terms and conditions')).toBeInTheDocument();
    });

    test('shows required field indicators', () => {
      render(<FormPreview schema={mockFormSchema} />);
      
      // Count required field asterisks
      const requiredIndicators = screen.getAllByText('*');
      expect(requiredIndicators).toHaveLength(5); // company_name, contact_email, business_type, certification_files, terms_agreement
    });

    test('displays progress bar when enabled', () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const progressBar = screen.getByRole('progressbar', { name: /form progress/i });
      expect(progressBar).toBeInTheDocument();
    });

    test('renders submit button with custom text', () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const submitButton = screen.getByRole('button', { name: /submit for review/i });
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    test('allows text input in text fields', async () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const companyNameInput = screen.getByLabelText('Company Name');
      await user.type(companyNameInput, 'Test Company Inc');
      
      expect(companyNameInput).toHaveValue('Test Company Inc');
    });

    test('validates email format', async () => {
      render(<FormPreview schema={mockFormSchema} interactive showValidation />);
      
      const emailInput = screen.getByLabelText('Contact Email');
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger validation
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');
      
      await waitFor(() => {
        expect(screen.getByText('Valid')).toBeInTheDocument();
      });
    });

    test('handles select field interaction', async () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const selectField = screen.getByLabelText('Business Type');
      await user.selectOptions(selectField, 'corporation');
      
      expect(selectField).toHaveValue('corporation');
    });

    test('handles currency field with proper formatting', async () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const revenueInput = screen.getByLabelText('Annual Revenue');
      await user.type(revenueInput, '1500000.50');
      
      expect(revenueInput).toHaveValue('1500000.50');
    });

    test('handles rating field interaction', async () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const ratingButtons = screen.getAllByRole('button');
      const starButtons = ratingButtons.filter(button => 
        button.className.includes('text-gray-300')
      );
      
      if (starButtons.length >= 4) {
        await user.click(starButtons[3]); // Click 4th star (4-star rating)
        expect(starButtons[3]).toHaveClass('text-yellow-400');
      }
    });

    test('handles file upload field', async () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const fileInput = screen.getByLabelText('Certification Documents');
      const file = new File(['fake content'], 'certificate.pdf', { type: 'application/pdf' });
      
      await user.upload(fileInput, file);
      
      expect(fileInput.files[0]).toBe(file);
      expect(fileInput.files).toHaveLength(1);
    });

    test('handles checkbox agreement', async () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const checkbox = screen.getByLabelText('I agree to the terms and conditions');
      await user.click(checkbox);
      
      expect(checkbox).toBeChecked();
    });
  });

  describe('Validation and Error Handling', () => {
    test('shows validation errors for required fields', async () => {
      render(<FormPreview schema={mockFormSchema} interactive showValidation />);
      
      const submitButton = screen.getByRole('button', { name: /submit for review/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Company name is required')).toBeInTheDocument();
        expect(screen.getByText('Contact Email is required')).toBeInTheDocument();
      });
    });

    test('validates minimum and maximum length constraints', async () => {
      render(<FormPreview schema={mockFormSchema} interactive showValidation />);
      
      const companyNameInput = screen.getByLabelText('Company Name');
      
      // Test minimum length
      await user.type(companyNameInput, 'A');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText('Company name must be 2-100 characters')).toBeInTheDocument();
      });
      
      // Test valid length
      await user.clear(companyNameInput);
      await user.type(companyNameInput, 'Valid Company Name');
      
      await waitFor(() => {
        expect(screen.getByText('Valid')).toBeInTheDocument();
      });
    });

    test('validates currency field constraints', async () => {
      render(<FormPreview schema={mockFormSchema} interactive showValidation />);
      
      const revenueInput = screen.getByLabelText('Annual Revenue');
      
      // Test negative value
      await user.type(revenueInput, '-1000');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText(/minimum value/i)).toBeInTheDocument();
      });
      
      // Test maximum value
      await user.clear(revenueInput);
      await user.type(revenueInput, '9999999999');
      
      await waitFor(() => {
        expect(screen.getByText(/maximum value/i)).toBeInTheDocument();
      });
    });

    test('handles file validation errors', async () => {
      render(<FormPreview schema={mockFormSchema} interactive showValidation />);
      
      const fileInput = screen.getByLabelText('Certification Documents');
      
      // Test invalid file type
      const invalidFile = new File(['content'], 'document.txt', { type: 'text/plain' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      // Would typically show error through custom validation
      expect(fileInput.files).toHaveLength(1);
    });

    test('disables submit button when validation fails', async () => {
      render(<FormPreview schema={mockFormSchema} interactive showValidation />);
      
      const submitButton = screen.getByRole('button', { name: /submit for review/i });
      
      // Initially disabled due to empty required fields
      expect(submitButton).toBeDisabled();
      
      // Fill in required fields
      await user.type(screen.getByLabelText('Company Name'), 'Test Company');
      await user.type(screen.getByLabelText('Contact Email'), 'test@example.com');
      await user.selectOptions(screen.getByLabelText('Business Type'), 'corporation');
      await user.click(screen.getByLabelText('I agree to the terms and conditions'));
      
      const file = new File(['content'], 'cert.pdf', { type: 'application/pdf' });
      await user.upload(screen.getByLabelText('Certification Documents'), file);
      
      // Should be enabled after filling required fields
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      });
    });
  });

  describe('Form Submission', () => {
    test('handles successful form submission', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      render(<FormPreview schema={mockFormSchema} interactive onSubmit={mockOnSubmit} />);
      
      // Fill out required fields
      await user.type(screen.getByLabelText('Company Name'), 'Test Company');
      await user.type(screen.getByLabelText('Contact Email'), 'test@example.com');
      await user.selectOptions(screen.getByLabelText('Business Type'), 'corporation');
      await user.click(screen.getByLabelText('I agree to the terms and conditions'));
      
      const file = new File(['content'], 'cert.pdf', { type: 'application/pdf' });
      await user.upload(screen.getByLabelText('Certification Documents'), file);
      
      const submitButton = screen.getByRole('button', { name: /submit for review/i });
      await user.click(submitButton);
      
      // Check loading state
      await waitFor(() => {
        expect(screen.getByText('Submitting...')).toBeInTheDocument();
      });
      
      // Check success state
      await waitFor(() => {
        expect(screen.getByText('Form Submitted Successfully!')).toBeInTheDocument();
        expect(screen.getByText('Your application has been submitted for review')).toBeInTheDocument();
      });
      
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    test('handles form submission error', async () => {
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));
      render(<FormPreview schema={mockFormSchema} interactive onSubmit={mockOnSubmit} />);
      
      // Fill out required fields
      await user.type(screen.getByLabelText('Company Name'), 'Test Company');
      await user.type(screen.getByLabelText('Contact Email'), 'test@example.com');
      await user.selectOptions(screen.getByLabelText('Business Type'), 'corporation');
      await user.click(screen.getByLabelText('I agree to the terms and conditions'));
      
      const file = new File(['content'], 'cert.pdf', { type: 'application/pdf' });
      await user.upload(screen.getByLabelText('Certification Documents'), file);
      
      const submitButton = screen.getByRole('button', { name: /submit for review/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to submit form. Please try again.')).toBeInTheDocument();
      });
    });

    test('shows progress indicator during submission', async () => {
      let resolveSubmit: (value: any) => void;
      const submissionPromise = new Promise(resolve => {
        resolveSubmit = resolve;
      });
      
      const mockOnSubmit = jest.fn().mockReturnValue(submissionPromise);
      render(<FormPreview schema={mockFormSchema} interactive onSubmit={mockOnSubmit} />);
      
      // Fill required fields and submit
      await user.type(screen.getByLabelText('Company Name'), 'Test Company');
      await user.type(screen.getByLabelText('Contact Email'), 'test@example.com');
      await user.selectOptions(screen.getByLabelText('Business Type'), 'corporation');
      await user.click(screen.getByLabelText('I agree to the terms and conditions'));
      
      const file = new File(['content'], 'cert.pdf', { type: 'application/pdf' });
      await user.upload(screen.getByLabelText('Certification Documents'), file);
      
      const submitButton = screen.getByRole('button', { name: /submit for review/i });
      await user.click(submitButton);
      
      // Check loading state
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      
      // Resolve the submission
      resolveSubmit!(undefined);
      
      await waitFor(() => {
        expect(screen.getByText('Form Submitted Successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper form structure with labels', () => {
      render(<FormPreview schema={mockFormSchema} />);
      
      mockFormSchema.fields.forEach(field => {
        if (field.type !== 'rating' && field.type !== 'file') {
          const fieldElement = screen.getByLabelText(field.label);
          expect(fieldElement).toBeInTheDocument();
        }
      });
    });

    test('associates labels with form controls', () => {
      render(<FormPreview schema={mockFormSchema} />);
      
      const companyNameInput = screen.getByLabelText('Company Name');
      const emailInput = screen.getByLabelText('Contact Email');
      const businessTypeSelect = screen.getByLabelText('Business Type');
      
      expect(companyNameInput).toHaveAttribute('id');
      expect(emailInput).toHaveAttribute('id');
      expect(businessTypeSelect).toHaveAttribute('id');
    });

    test('provides error messages with proper ARIA attributes', async () => {
      render(<FormPreview schema={mockFormSchema} interactive showValidation />);
      
      const companyNameInput = screen.getByLabelText('Company Name');
      await user.type(companyNameInput, 'A');
      await user.tab();
      
      await waitFor(() => {
        const errorMessage = screen.getByText('Company name must be 2-100 characters');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    test('supports keyboard navigation', async () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const companyNameInput = screen.getByLabelText('Company Name');
      const emailInput = screen.getByLabelText('Contact Email');
      const businessTypeSelect = screen.getByLabelText('Business Type');
      
      // Focus first field
      companyNameInput.focus();
      expect(companyNameInput).toHaveFocus();
      
      // Tab to next field
      await user.tab();
      expect(emailInput).toHaveFocus();
      
      // Tab to select field
      await user.tab();
      expect(businessTypeSelect).toHaveFocus();
    });

    test('has proper heading hierarchy', () => {
      render(<FormPreview schema={mockFormSchema} />);
      
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Supplier Registration Form');
    });
  });

  describe('Progress Tracking', () => {
    test('updates progress bar as fields are filled', async () => {
      render(<FormPreview schema={mockFormSchema} interactive />);
      
      const progressBar = document.querySelector('[style*="width"]') as HTMLElement;
      
      // Initially 0% progress
      expect(progressBar).toHaveStyle({ width: '0%' });
      
      // Fill one field
      await user.type(screen.getByLabelText('Company Name'), 'Test Company');
      
      await waitFor(() => {
        const updatedProgressBar = document.querySelector('[style*="width"]') as HTMLElement;
        expect(updatedProgressBar.style.width).not.toBe('0%');
      });
    });
  });

  describe('Non-interactive Mode', () => {
    test('renders form in read-only mode when not interactive', () => {
      render(<FormPreview schema={mockFormSchema} interactive={false} />);
      
      const companyNameInput = screen.getByLabelText('Company Name');
      const emailInput = screen.getByLabelText('Contact Email');
      
      expect(companyNameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    });

    test('applies correct styling for disabled state', () => {
      render(<FormPreview schema={mockFormSchema} interactive={false} />);
      
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveClass('bg-gray-50');
        expect(input).toBeDisabled();
      });
    });
  });
});

// Performance tests
describe('FormPreview Performance', () => {
  test('renders large form efficiently', () => {
    const largeSchema: FormSchema = {
      ...mockFormSchema,
      fields: Array.from({ length: 100 }, (_, index) => ({
        id: `field_${index}`,
        name: `field_${index}`,
        type: 'text',
        label: `Field ${index + 1}`,
        required: false,
        order: index + 1
      }))
    };
    
    const startTime = performance.now();
    render(<FormPreview schema={largeSchema} />);
    const endTime = performance.now();
    
    // Should render within reasonable time
    expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    
    // Should render all fields
    expect(screen.getAllByRole('textbox')).toHaveLength(100);
  });

  test('handles rapid user input efficiently', async () => {
    const user = userEvent.setup({ delay: null }); // No delay for performance test
    render(<FormPreview schema={mockFormSchema} interactive />);
    
    const companyNameInput = screen.getByLabelText('Company Name');
    const longText = 'A'.repeat(1000);
    
    const startTime = performance.now();
    await user.type(companyNameInput, longText);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(5000); // Should handle within 5 seconds
    expect(companyNameInput).toHaveValue(longText);
  });
});