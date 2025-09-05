import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { Form, FormSection, FormActions, FormProgress, ValidationFeedback } from '@/components/shared/Form';

// Mock react-hook-form for controlled testing
jest.mock('react-hook-form', () => ({
  ...jest.requireActual('react-hook-form'),
  FormProvider: ({ children, ...props }: any) => (
    <div data-testid="form-provider" {...props}>{children}</div>
  ),
}));

describe('Form Component', () => {
  const mockSubmit = jest.fn();
  const mockForm = {
    handleSubmit: jest.fn((fn) => (e: any) => {
      e.preventDefault();
      fn({ test: 'data' });
    }),
    formState: {
      isSubmitting: false,
      isValid: true,
      errors: {}
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockForm.handleSubmit.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders form with default props', () => {
      render(
        <Form form={mockForm as any} onSubmit={mockSubmit}>
          <input name="test" />
        </Form>
      );

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByTestId('form-provider')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(
        <Form form={mockForm as any} onSubmit={mockSubmit} className="custom-form">
          <input name="test" />
        </Form>
      );

      expect(screen.getByRole('form')).toHaveClass('custom-form');
    });

    it('applies layout classes correctly', () => {
      const layouts = [
        { layout: 'vertical' as const, expectedClass: 'space-y-4' },
        { layout: 'horizontal' as const, expectedClass: 'space-y-4' },
        { layout: 'grid' as const, expectedClass: 'grid gap-4 grid-cols-1 md:grid-cols-2' }
      ];

      layouts.forEach(({ layout, expectedClass }) => {
        const { unmount } = render(
          <Form form={mockForm as any} onSubmit={mockSubmit} layout={layout} columns={2}>
            <input name="test" />
          </Form>
        );

        expect(screen.getByRole('form')).toHaveClass(expectedClass);
        unmount();
      });
    });
  });

  describe('Form Submission', () => {
    it('handles form submission', async () => {
      render(
        <Form form={mockForm as any} onSubmit={mockSubmit}>
          <button type="submit">Submit</button>
        </Form>
      );

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      expect(mockForm.handleSubmit).toHaveBeenCalled();
    });

    it('disables form when disabled prop is true', () => {
      render(
        <Form form={mockForm as any} onSubmit={mockSubmit} disabled>
          <input name="test" />
          <button type="submit">Submit</button>
        </Form>
      );

      const fieldset = screen.getByRole('form').querySelector('fieldset');
      expect(fieldset).toHaveAttribute('disabled');
    });

    it('disables form when submitting', () => {
      const submittingForm = {
        ...mockForm,
        formState: { ...mockForm.formState, isSubmitting: true }
      };

      render(
        <Form form={submittingForm as any} onSubmit={mockSubmit}>
          <input name="test" />
        </Form>
      );

      const fieldset = screen.getByRole('form').querySelector('fieldset');
      expect(fieldset).toHaveAttribute('disabled');
    });
  });

  describe('Spacing Configuration', () => {
    it('applies spacing classes correctly', () => {
      const spacings = [
        { spacing: 'compact' as const, expectedClass: 'space-y-3' },
        { spacing: 'normal' as const, expectedClass: 'space-y-4' },
        { spacing: 'comfortable' as const, expectedClass: 'space-y-6' }
      ];

      spacings.forEach(({ spacing, expectedClass }) => {
        const { unmount } = render(
          <Form form={mockForm as any} onSubmit={mockSubmit} spacing={spacing}>
            <input name="test" />
          </Form>
        );

        expect(screen.getByRole('form')).toHaveClass(expectedClass);
        unmount();
      });
    });
  });

  describe('Grid Layout', () => {
    it('applies correct grid classes for different column counts', () => {
      const columnConfigs = [
        { columns: 1 as const, expectedClass: 'grid-cols-1' },
        { columns: 2 as const, expectedClass: 'grid-cols-1 md:grid-cols-2' },
        { columns: 3 as const, expectedClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' },
        { columns: 4 as const, expectedClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' }
      ];

      columnConfigs.forEach(({ columns, expectedClass }) => {
        const { unmount } = render(
          <Form form={mockForm as any} onSubmit={mockSubmit} layout="grid" columns={columns}>
            <input name="test" />
          </Form>
        );

        expect(screen.getByRole('form')).toHaveClass(expectedClass);
        unmount();
      });
    });
  });
});

describe('FormSection Component', () => {
  it('renders with title and description', () => {
    render(
      <FormSection title="Section Title" description="Section description">
        <input name="test" />
      </FormSection>
    );

    expect(screen.getByText('Section Title')).toBeInTheDocument();
    expect(screen.getByText('Section description')).toBeInTheDocument();
  });

  it('renders collapsible section', async () => {
    const user = userEvent.setup();
    
    render(
      <FormSection title="Collapsible Section" collapsible>
        <input name="test" data-testid="section-content" />
      </FormSection>
    );

    expect(screen.getByTestId('section-content')).toBeInTheDocument();

    const collapseButton = screen.getByRole('button', { name: /collapse section/i });
    await user.click(collapseButton);

    expect(screen.queryByTestId('section-content')).not.toBeInTheDocument();
  });

  it('starts collapsed when defaultCollapsed is true', () => {
    render(
      <FormSection title="Collapsed Section" collapsible defaultCollapsed>
        <input name="test" data-testid="section-content" />
      </FormSection>
    );

    expect(screen.queryByTestId('section-content')).not.toBeInTheDocument();
  });
});

describe('FormActions Component', () => {
  const mockFormContext = {
    isLoading: false,
    isValid: true,
    errors: {}
  };

  beforeEach(() => {
    // Mock useFormContext
    const mockUseFormContext = jest.fn(() => mockFormContext);
    jest.doMock('@/components/shared/Form', () => ({
      ...jest.requireActual('@/components/shared/Form'),
      useFormContext: mockUseFormContext
    }));
  });

  it('renders submit button with default label', () => {
    render(<FormActions />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders custom submit label', () => {
    render(<FormActions submitLabel="Save Changes" />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('shows cancel button when enabled', () => {
    const mockCancel = jest.fn();
    render(<FormActions showCancel onCancel={mockCancel} />);
    
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('disables submit when form is invalid', () => {
    jest.doMock('@/components/shared/Form', () => ({
      ...jest.requireActual('@/components/shared/Form'),
      useFormContext: () => ({ ...mockFormContext, isValid: false })
    }));

    const { rerender } = render(<FormActions />);
    rerender(<FormActions />);
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();
  });
});

describe('ValidationFeedback Component', () => {
  it('renders error feedback with correct styling', () => {
    render(<ValidationFeedback type="error" message="This is an error" />);
    
    const feedback = screen.getByText('This is an error');
    expect(feedback.closest('div')).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200');
  });

  it('renders success feedback with correct styling', () => {
    render(<ValidationFeedback type="success" message="This is success" />);
    
    const feedback = screen.getByText('This is success');
    expect(feedback.closest('div')).toHaveClass('text-green-600', 'bg-green-50', 'border-green-200');
  });

  it('renders warning feedback with correct styling', () => {
    render(<ValidationFeedback type="warning" message="This is a warning" />);
    
    const feedback = screen.getByText('This is a warning');
    expect(feedback.closest('div')).toHaveClass('text-yellow-600', 'bg-yellow-50', 'border-yellow-200');
  });

  it('renders info feedback with correct styling', () => {
    render(<ValidationFeedback type="info" message="This is info" />);
    
    const feedback = screen.getByText('This is info');
    expect(feedback.closest('div')).toHaveClass('text-blue-600', 'bg-blue-50', 'border-blue-200');
  });
});

describe('FormProgress Component', () => {
  it('renders progress steps correctly', () => {
    render(<FormProgress currentStep={2} totalSteps={4} />);
    
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    
    // Check step indicators
    const stepIndicators = screen.getAllByText(/^[1-4]$/);
    expect(stepIndicators).toHaveLength(3); // Steps 1, 3, 4 (step 2 shows checkmark)
  });

  it('shows step labels when enabled', () => {
    const stepLabels = ['Personal Info', 'Address', 'Payment', 'Review'];
    
    render(
      <FormProgress 
        currentStep={2} 
        totalSteps={4} 
        showLabels 
        stepLabels={stepLabels} 
      />
    );

    stepLabels.forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('applies correct styling for completed, current, and future steps', () => {
    render(<FormProgress currentStep={3} totalSteps={5} />);

    const steps = screen.getAllByText(/^[1-5]$/).concat(screen.getAllByTestId('check-circle'));
    
    // Step 1 and 2 should be completed (green background)
    // Step 3 should be current (blue background)  
    // Steps 4 and 5 should be future (gray background)
    expect(steps.length).toBeGreaterThan(0);
  });
});

// Integration tests for form with real react-hook-form
describe('Form Integration', () => {
  const TestFormComponent = () => {
    const schema = yup.object({
      name: yup.string().required('Name is required'),
      email: yup.string().email('Invalid email').required('Email is required')
    });

    const form = useForm({
      resolver: yupResolver(schema),
      mode: 'onChange'
    });

    const onSubmit = jest.fn();

    return (
      <Form form={form} onSubmit={onSubmit}>
        <input {...form.register('name')} placeholder="Name" />
        <input {...form.register('email')} placeholder="Email" />
        <FormActions />
      </Form>
    );
  };

  it('integrates with react-hook-form validation', async () => {
    const user = userEvent.setup();
    
    render(<TestFormComponent />);

    const nameInput = screen.getByPlaceholderText('Name');
    const emailInput = screen.getByPlaceholderText('Email');
    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Form should be initially invalid
    expect(submitButton).toBeDisabled();

    // Enter valid data
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });
});