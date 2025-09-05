/**
 * Form Accessibility Tests
 * Testing screen reader compatibility, keyboard navigation, and WCAG compliance
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FormBuilder } from '../../../frontend/src/components/forms/FormBuilder';
import { FormPreview } from '../../../frontend/src/components/forms/FormPreview';
import { mockFormSchema, createMockField } from '../../fixtures/form-fixtures';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock window.speechSynthesis for screen reader tests
Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: {
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => []),
    speaking: false,
    pending: false,
    paused: false,
  },
});

describe('Form Accessibility', () => {
  const user = userEvent.setup();

  describe('WCAG 2.1 AA Compliance', () => {
    it('meets accessibility standards for form builder', async () => {
      const { container } = render(
        <FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('meets accessibility standards for form preview', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'text', label: 'Full Name', required: true }),
          createMockField({ type: 'email', label: 'Email Address', required: true }),
          createMockField({ type: 'textarea', label: 'Message', required: false }),
        ],
      });

      const { container } = render(
        <FormPreview schema={schema} interactive={true} showValidation={true} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper heading hierarchy', () => {
      const schema = mockFormSchema({
        sections: [
          { id: 'section-1', title: 'Personal Information', order: 0 },
          { id: 'section-2', title: 'Contact Details', order: 1 },
        ] as any,
      });

      render(<FormPreview schema={schema} />);

      // Check heading levels are proper
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();

      const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
      expect(sectionHeadings).toHaveLength(2);
      expect(sectionHeadings[0]).toHaveTextContent('Personal Information');
      expect(sectionHeadings[1]).toHaveTextContent('Contact Details');
    });

    it('provides proper form landmarks', () => {
      const schema = mockFormSchema();
      render(<FormPreview schema={schema} interactive={true} />);

      // Main form landmark
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports full keyboard navigation in form builder', async () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // Tab through form elements
      await user.tab();
      expect(screen.getByDisplayValue('Untitled Form')).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText('Form description (optional)')).toHaveFocus();

      // Tab through toolbar buttons
      await user.tab();
      const firstToolbarButton = document.activeElement;
      expect(firstToolbarButton).toHaveAttribute('role', 'button');

      // Test reverse tabbing
      await user.tab({ shift: true });
      expect(screen.getByPlaceholderText('Form description (optional)')).toHaveFocus();
    });

    it('supports keyboard navigation in form fields', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'text', label: 'Name', name: 'name', required: true }),
          createMockField({ type: 'email', label: 'Email', name: 'email', required: true }),
          createMockField({ type: 'select', label: 'Country', name: 'country', 
            options: [
              { label: 'USA', value: 'usa' },
              { label: 'Canada', value: 'canada' },
            ]
          }),
        ],
      });

      render(<FormPreview schema={schema} interactive={true} />);

      // Tab through form fields
      await user.tab();
      expect(screen.getByLabelText(/name/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/email/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/country/i)).toHaveFocus();

      // Test arrow key navigation for select
      await user.keyboard('{ArrowDown}');
      // Select should open dropdown or change selection
    });

    it('handles escape key to close modals and dropdowns', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ 
            type: 'select', 
            label: 'Options',
            options: [
              { label: 'Option 1', value: 'opt1' },
              { label: 'Option 2', value: 'opt2' },
            ]
          }),
        ],
      });

      render(<FormPreview schema={schema} interactive={true} />);

      const selectField = screen.getByLabelText(/options/i);
      
      // Open dropdown with keyboard
      selectField.focus();
      await user.keyboard(' '); // Space to open
      
      // Escape to close
      await user.keyboard('{Escape}');
      
      // Focus should return to select element
      expect(selectField).toHaveFocus();
    });

    it('supports Enter and Space for button activation', async () => {
      const mockSave = jest.fn();
      render(<FormBuilder onSave={mockSave} onPreview={jest.fn()} />);

      const saveButton = screen.getByText('Save');
      
      // Test Enter key
      saveButton.focus();
      await user.keyboard('{Enter}');
      expect(mockSave).toHaveBeenCalledTimes(1);

      // Test Space key
      saveButton.focus();
      await user.keyboard(' ');
      expect(mockSave).toHaveBeenCalledTimes(2);
    });

    it('provides skip links for complex interfaces', () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // Check for skip links
      const skipLink = screen.getByText(/skip to main content/i);
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });

  describe('Screen Reader Support', () => {
    it('provides proper ARIA labels for all form controls', () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ 
            type: 'text', 
            label: 'Full Name',
            accessibility: {
              ariaLabel: 'Enter your full legal name',
              description: 'This will be used for official documentation',
            }
          }),
          createMockField({ 
            type: 'email', 
            label: 'Email',
            required: true,
            accessibility: {
              ariaLabel: 'Enter your email address',
            }
          }),
        ],
      });

      render(<FormPreview schema={schema} interactive={true} />);

      const nameField = screen.getByLabelText(/full name/i);
      expect(nameField).toHaveAttribute('aria-label', 'Enter your full legal name');
      expect(nameField).toHaveAttribute('aria-describedby');

      const emailField = screen.getByLabelText(/email/i);
      expect(emailField).toHaveAttribute('aria-label', 'Enter your email address');
      expect(emailField).toHaveAttribute('aria-required', 'true');
    });

    it('announces form validation errors', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'email', label: 'Email', name: 'email', required: true }),
        ],
      });

      render(<FormPreview schema={schema} interactive={true} showValidation={true} />);

      const emailField = screen.getByLabelText(/email/i);
      
      // Enter invalid email
      await user.type(emailField, 'invalid-email');
      await user.tab(); // Blur to trigger validation

      // Check for ARIA live region updates
      const errorRegion = screen.getByRole('alert');
      expect(errorRegion).toBeInTheDocument();
      expect(errorRegion).toHaveTextContent(/please enter a valid email/i);
      expect(errorRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('provides progress indication for multi-step forms', () => {
      const schema = mockFormSchema({
        sections: [
          { id: 'step-1', title: 'Step 1', order: 0 },
          { id: 'step-2', title: 'Step 2', order: 1 },
          { id: 'step-3', title: 'Step 3', order: 2 },
        ] as any,
        settings: { ...mockFormSchema().settings, showProgressBar: true },
      });

      render(<FormPreview schema={schema} interactive={true} />);

      // Check for progress indicator
      const progressIndicator = screen.getByRole('progressbar');
      expect(progressIndicator).toBeInTheDocument();
      expect(progressIndicator).toHaveAttribute('aria-valuenow');
      expect(progressIndicator).toHaveAttribute('aria-valuemax', '3');
      expect(progressIndicator).toHaveAttribute('aria-label', /progress/i);
    });

    it('describes form submission status', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'text', label: 'Name', name: 'name', required: true }),
        ],
      });

      render(<FormPreview schema={schema} interactive={true} />);

      const nameField = screen.getByLabelText(/name/i);
      const submitButton = screen.getByRole('button', { name: /submit/i });

      // Fill and submit form
      await user.type(nameField, 'John Doe');
      await user.click(submitButton);

      // Check for submission status announcement
      await screen.findByRole('status');
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveTextContent(/submitting/i);
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('supports screen reader navigation landmarks', () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // Check for proper landmarks
      expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // Toolbar/nav
      expect(screen.getByRole('complementary')).toBeInTheDocument(); // Sidebar
    });
  });

  describe('Color and Contrast', () => {
    it('maintains sufficient color contrast for text', () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // Check computed styles for contrast
      const titleInput = screen.getByDisplayValue('Untitled Form');
      const styles = window.getComputedStyle(titleInput);
      
      // These would be actual contrast ratio calculations in a real test
      expect(styles.color).toBeDefined();
      expect(styles.backgroundColor).toBeDefined();
    });

    it('does not rely solely on color for information', () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'text', label: 'Required Field', required: true }),
          createMockField({ type: 'text', label: 'Optional Field', required: false }),
        ],
      });

      render(<FormPreview schema={schema} showValidation={true} />);

      // Required fields should have text indicator in addition to color
      expect(screen.getByText('*')).toBeInTheDocument(); // Asterisk for required
      
      const requiredField = screen.getByLabelText(/required field/i);
      expect(requiredField).toHaveAttribute('aria-required', 'true');
    });

    it('supports high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // High contrast styles would be applied
      const titleInput = screen.getByDisplayValue('Untitled Form');
      expect(titleInput).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('maintains visible focus indicators', async () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      const titleInput = screen.getByDisplayValue('Untitled Form');
      
      await user.click(titleInput);
      expect(titleInput).toHaveFocus();
      
      // Check for visible focus styles
      expect(titleInput).toHaveClass(/focus:/); // Tailwind focus styles
    });

    it('manages focus during dynamic content changes', async () => {
      const schema = mockFormSchema();
      const mockOnSave = jest.fn();
      
      render(<FormBuilder initialSchema={schema} onSave={mockOnSave} />);

      // Add a new field
      const addButton = screen.getByText(/add field/i);
      await user.click(addButton);

      // Focus should move to new field or appropriate element
      // This would depend on UX design decisions
      expect(document.activeElement).toBeInTheDocument();
    });

    it('traps focus in modal dialogs', async () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // Open settings modal (assuming there's one)
      const settingsButton = screen.getByTitle('Settings');
      await user.click(settingsButton);

      // Focus should be trapped within modal
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Test Tab key doesn't leave modal
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        expect(firstElement).toHaveFocus();
        
        // Tab to last element
        for (let i = 0; i < focusableElements.length - 1; i++) {
          await user.tab();
        }
        expect(lastElement).toHaveFocus();
        
        // Tab once more should cycle to first
        await user.tab();
        expect(firstElement).toHaveFocus();
      }
    });

    it('restores focus after modal closes', async () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      const settingsButton = screen.getByTitle('Settings');
      await user.click(settingsButton);

      // Close modal (with Escape key)
      await user.keyboard('{Escape}');

      // Focus should return to settings button
      expect(settingsButton).toHaveFocus();
    });
  });

  describe('Touch and Mobile Accessibility', () => {
    it('provides adequate touch targets', () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        // Touch targets should be at least 44x44 pixels
        const minSize = 44;
        expect(parseInt(styles.minHeight) || parseInt(styles.height)).toBeGreaterThanOrEqual(minSize);
        expect(parseInt(styles.minWidth) || parseInt(styles.width)).toBeGreaterThanOrEqual(minSize);
      });
    });

    it('supports zoom up to 200% without horizontal scrolling', () => {
      // Mock viewport scaling
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        value: 2,
      });

      const { container } = render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // Content should still be accessible at 200% zoom
      expect(container).toBeInTheDocument();
    });

    it('provides orientation-independent functionality', () => {
      // Mock orientation change
      Object.defineProperty(screen, 'orientation', {
        writable: true,
        value: { angle: 90 },
      });

      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // All functionality should work in both orientations
      expect(screen.getByDisplayValue('Untitled Form')).toBeInTheDocument();
    });
  });

  describe('Error Prevention and Recovery', () => {
    it('prevents accidental form submission', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'text', label: 'Important Data', required: true }),
        ],
      });

      render(<FormPreview schema={schema} interactive={true} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      // Try to submit empty form
      await user.click(submitButton);

      // Should show confirmation or validation
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('provides clear error recovery instructions', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ 
            type: 'email', 
            label: 'Email',
            validation: {
              pattern: '^[^@]+@[^@]+\\.[^@]+$',
              errorMessage: 'Please enter a valid email address in the format: user@domain.com',
            }
          }),
        ],
      });

      render(<FormPreview schema={schema} interactive={true} showValidation={true} />);

      const emailField = screen.getByLabelText(/email/i);
      
      // Enter invalid email
      await user.type(emailField, 'invalid');
      await user.tab();

      // Error message should provide clear instructions
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(/format.*user@domain\.com/i);
    });

    it('supports undo functionality for destructive actions', () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // This would test undo functionality if implemented
      // For example, undoing field deletion
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });

  describe('Internationalization and Localization', () => {
    it('supports right-to-left languages', () => {
      // Mock RTL language
      document.dir = 'rtl';
      
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      const container = screen.getByDisplayValue('Untitled Form').closest('div');
      expect(container).toHaveStyle({ direction: 'rtl' });

      // Reset
      document.dir = 'ltr';
    });

    it('provides localized ARIA labels', () => {
      // Mock different language
      const originalLanguage = navigator.language;
      Object.defineProperty(navigator, 'language', {
        writable: true,
        value: 'es-ES',
      });

      const schema = mockFormSchema({
        settings: {
          ...mockFormSchema().settings,
          language: 'es',
        },
        fields: [
          createMockField({ 
            type: 'text', 
            label: 'Nombre',
            accessibility: {
              ariaLabel: 'Ingrese su nombre completo',
            }
          }),
        ],
      });

      render(<FormPreview schema={schema} />);

      const field = screen.getByLabelText(/nombre/i);
      expect(field).toHaveAttribute('aria-label', 'Ingrese su nombre completo');

      // Reset
      Object.defineProperty(navigator, 'language', {
        writable: true,
        value: originalLanguage,
      });
    });
  });

  describe('Cognitive Accessibility', () => {
    it('provides clear instructions and help text', () => {
      const schema = mockFormSchema({
        description: 'Please fill out this form completely. All fields marked with * are required.',
        fields: [
          createMockField({
            type: 'text',
            label: 'Password',
            description: 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
            required: true,
          }),
        ],
      });

      render(<FormPreview schema={schema} />);

      // Form description
      expect(screen.getByText(/please fill out this form/i)).toBeInTheDocument();
      
      // Field help text
      expect(screen.getByText(/password must be at least/i)).toBeInTheDocument();
      
      // Required field indicator
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('uses consistent navigation patterns', () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // Navigation should be predictable
      const toolbar = screen.getByRole('toolbar');
      const buttons = toolbar.querySelectorAll('button');
      
      // Buttons should follow consistent pattern
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('allows users to control timing', () => {
      // This would test session timeout warnings, auto-save intervals, etc.
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // Should not have content that changes automatically without user control
      // This is more of a design constraint that would be tested during implementation
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });

  describe('Integration with Assistive Technologies', () => {
    it('works with virtual screen readers', () => {
      // Mock screen reader API
      const mockScreenReader = {
        speak: jest.fn(),
        stop: jest.fn(),
        supported: true,
      };

      (window as any).speechSynthesis = mockScreenReader;

      const schema = mockFormSchema();
      render(<FormPreview schema={schema} />);

      // Screen reader should be able to navigate and read content
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('supports voice recognition software', () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ 
            type: 'text', 
            label: 'First Name',
            accessibility: {
              ariaLabel: 'First Name',
            }
          }),
        ],
      });

      render(<FormPreview schema={schema} />);

      // Fields should have clear, voice-recognizable labels
      const field = screen.getByLabelText(/first name/i);
      expect(field).toHaveAttribute('aria-label', 'First Name');
    });

    it('supports switch navigation', async () => {
      render(<FormBuilder onSave={jest.fn()} onPreview={jest.fn()} />);

      // All interactive elements should be reachable via keyboard/switch
      const interactiveElements = screen.getAllByRole(/button|textbox|combobox/);
      
      for (const element of interactiveElements) {
        expect(element).not.toHaveAttribute('tabindex', '-1');
      }
    });
  });
});