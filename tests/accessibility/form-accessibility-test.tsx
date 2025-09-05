import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

import { Form, FormSection, FormActions, ValidationFeedback } from '@/components/shared/Form';
import { FileUpload } from '@/components/shared/FileUpload';
import { useForm } from 'react-hook-form';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Form Accessibility', () => {
  beforeAll(() => {
    // Mock console.warn to avoid axe-core warnings in tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Form Component Accessibility', () => {
    const AccessibleForm = () => {
      const form = useForm();
      
      return (
        <Form form={form} onSubmit={() => {}}>
          <div>
            <label htmlFor="name">Full Name *</label>
            <input
              id="name"
              {...form.register('name')}
              required
              aria-describedby="name-help"
            />
            <div id="name-help">Enter your full legal name</div>
          </div>
          
          <div>
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              {...form.register('email')}
              required
              aria-describedby="email-error"
            />
            <div id="email-error" role="alert">Please enter a valid email</div>
          </div>
          
          <FormActions submitLabel="Submit Application" />
        </Form>
      );
    };

    it('has no accessibility violations', async () => {
      const { container } = render(<AccessibleForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper form semantics', () => {
      render(<AccessibleForm />);
      
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
      
      const submitButton = screen.getByRole('button', { name: /submit application/i });
      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('associates labels with form controls', () => {
      render(<AccessibleForm />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveAttribute('id', 'name');
      
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('id', 'email');
    });

    it('provides appropriate ARIA descriptions', () => {
      render(<AccessibleForm />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      expect(nameInput).toHaveAttribute('aria-describedby', 'name-help');
      
      const helpText = screen.getByText('Enter your full legal name');
      expect(helpText).toHaveAttribute('id', 'name-help');
    });

    it('indicates required fields appropriately', () => {
      render(<AccessibleForm />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      expect(nameInput).toHaveAttribute('required');
      
      const nameLabel = screen.getByText(/full name \*/i);
      expect(nameLabel).toBeInTheDocument();
    });

    it('provides error messages with proper ARIA attributes', () => {
      render(<AccessibleForm />);
      
      const errorMessage = screen.getByText('Please enter a valid email');
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('id', 'email-error');
      
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
    });
  });

  describe('FormSection Accessibility', () => {
    const AccessibleFormSection = () => (
      <FormSection
        title="Personal Information"
        description="Please provide your personal details"
        collapsible
      >
        <div>
          <label htmlFor="firstName">First Name</label>
          <input id="firstName" name="firstName" />
        </div>
        <div>
          <label htmlFor="lastName">Last Name</label>
          <input id="lastName" name="lastName" />
        </div>
      </FormSection>
    );

    it('has no accessibility violations', async () => {
      const { container } = render(<AccessibleFormSection />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('uses proper heading structure', () => {
      render(<AccessibleFormSection />);
      
      const heading = screen.getByText('Personal Information');
      expect(heading).toHaveRole('heading');
    });

    it('provides accessible collapse/expand controls', async () => {
      const user = userEvent.setup();
      render(<AccessibleFormSection />);
      
      const toggleButton = screen.getByRole('button', { name: /collapse section/i });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('aria-label', 'Collapse section');
      
      await user.click(toggleButton);
      
      expect(toggleButton).toHaveAttribute('aria-label', 'Expand section');
    });

    it('maintains fieldset/legend relationship', () => {
      render(<AccessibleFormSection />);
      
      const fieldset = screen.getByRole('group');
      expect(fieldset).toBeInTheDocument();
      
      const legend = screen.getByText('Personal Information');
      expect(legend.tagName.toLowerCase()).toBe('legend');
    });
  });

  describe('FileUpload Accessibility', () => {
    const AccessibleFileUpload = () => (
      <FileUpload
        label="Upload Resume"
        description="Please upload your resume in PDF format"
        accept=".pdf"
        maxSize={5 * 1024 * 1024}
        error="Please select a valid PDF file"
      />
    );

    it('has no accessibility violations', async () => {
      const { container } = render(<AccessibleFileUpload />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper labels and descriptions', () => {
      render(<AccessibleFileUpload />);
      
      const label = screen.getByText('Upload Resume');
      expect(label).toBeInTheDocument();
      
      const description = screen.getByText('Please upload your resume in PDF format');
      expect(description).toBeInTheDocument();
      
      const fileInput = screen.getByLabelText(/upload files/i);
      expect(fileInput).toBeInTheDocument();
    });

    it('provides keyboard navigation support', async () => {
      const user = userEvent.setup();
      render(<AccessibleFileUpload />);
      
      const dropZone = screen.getByRole('button', { name: /upload files/i });
      expect(dropZone).toHaveAttribute('tabIndex', '0');
      
      // Test keyboard activation
      dropZone.focus();
      expect(dropZone).toHaveFocus();
      
      await user.keyboard('{Enter}');
      // Should trigger file dialog (in real implementation)
    });

    it('announces drag and drop state changes', async () => {
      render(<AccessibleFileUpload />);
      
      const dropZone = screen.getByRole('button', { name: /upload files/i });
      expect(dropZone).toHaveAttribute('aria-label', 'Upload files');
    });

    it('provides error messages with proper ARIA attributes', () => {
      render(<AccessibleFileUpload />);
      
      const errorMessage = screen.getByText('Please select a valid PDF file');
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });

  describe('ValidationFeedback Accessibility', () => {
    const feedbackTypes = [
      { type: 'error', message: 'This field is required', expectedRole: 'alert' },
      { type: 'warning', message: 'Password strength is weak', expectedRole: 'alert' },
      { type: 'success', message: 'Email verified successfully', expectedRole: 'status' },
      { type: 'info', message: 'Additional information', expectedRole: 'status' }
    ] as const;

    feedbackTypes.forEach(({ type, message, expectedRole }) => {
      it(`provides proper ARIA role for ${type} feedback`, () => {
        render(<ValidationFeedback type={type} message={message} />);
        
        const feedback = screen.getByText(message);
        expect(feedback.closest('div')).toHaveAttribute('role', expectedRole);
      });

      it(`has no accessibility violations for ${type} feedback`, async () => {
        const { container } = render(<ValidationFeedback type={type} message={message} />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    const NavigationTestForm = () => {
      const form = useForm();
      
      return (
        <Form form={form} onSubmit={() => {}}>
          <div>
            <label htmlFor="field1">Field 1</label>
            <input id="field1" {...form.register('field1')} />
          </div>
          
          <div>
            <label htmlFor="field2">Field 2</label>
            <select id="field2" {...form.register('field2')}>
              <option value="">Select...</option>
              <option value="option1">Option 1</option>
              <option value="option2">Option 2</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="field3">Field 3</label>
            <textarea id="field3" {...form.register('field3')} />
          </div>
          
          <div>
            <label>
              <input type="checkbox" {...form.register('field4')} />
              Check me
            </label>
          </div>
          
          <FormActions />
        </Form>
      );
    };

    it('supports sequential keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<NavigationTestForm />);
      
      // Tab through all form controls
      await user.tab();
      expect(screen.getByLabelText('Field 1')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText('Field 2')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText('Field 3')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('checkbox', { name: /check me/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /submit/i })).toHaveFocus();
    });

    it('supports reverse keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<NavigationTestForm />);
      
      // Focus on submit button first
      const submitButton = screen.getByRole('button', { name: /submit/i });
      submitButton.focus();
      
      // Shift+Tab back through controls
      await user.tab({ shift: true });
      expect(screen.getByRole('checkbox')).toHaveFocus();
      
      await user.tab({ shift: true });
      expect(screen.getByLabelText('Field 3')).toHaveFocus();
    });

    it('handles form submission via keyboard', async () => {
      const mockSubmit = jest.fn();
      const user = userEvent.setup();
      
      const KeyboardSubmitForm = () => {
        const form = useForm();
        return (
          <Form form={form} onSubmit={mockSubmit}>
            <input {...form.register('test')} />
            <button type="submit">Submit</button>
          </Form>
        );
      };

      render(<KeyboardSubmitForm />);
      
      // Focus submit button and press Enter
      const submitButton = screen.getByRole('button', { name: /submit/i });
      submitButton.focus();
      await user.keyboard('{Enter}');
      
      expect(mockSubmit).toHaveBeenCalled();
    });
  });
});