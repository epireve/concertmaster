import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Form, FormSection, FormActions } from '../../../../frontend/src/components/shared/Form';
import { ControlledInput, ControlledSelect } from '../../../../frontend/src/components/shared/FormFields';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// Test schema
const testSchema = yup.object({
  name: yup.string().required('Name is required').min(2, 'Name must be at least 2 characters'),
  email: yup.string().email('Invalid email').required('Email is required'),
  age: yup.number().positive('Age must be positive').integer('Age must be an integer'),
  category: yup.string().required('Category is required'),
});

type TestFormData = {
  name: string;
  email: string;
  age: number;
  category: string;
};

// Test form component
function TestForm({ onSubmit }: { onSubmit: (data: TestFormData) => void }) {
  const form = useForm<TestFormData>({
    resolver: yupResolver(testSchema),
    defaultValues: {
      name: '',
      email: '',
      age: 0,
      category: '',
    },
  });

  return (
    <Form form={form} onSubmit={onSubmit} data-testid="test-form">
      <ControlledInput 
        name="name" 
        label="Name" 
        placeholder="Enter your name"
        data-testid="name-input"
      />
      <ControlledInput 
        name="email" 
        type="email"
        label="Email" 
        placeholder="Enter your email"
        data-testid="email-input"
      />
      <ControlledInput 
        name="age" 
        type="number"
        label="Age" 
        placeholder="Enter your age"
        data-testid="age-input"
      />
      <ControlledSelect
        name="category"
        label="Category"
        placeholder="Select a category"
        options={[
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ]}
        data-testid="category-select"
      />
      <FormActions submitLabel="Submit Form" data-testid="form-actions" />
    </Form>
  );
}

describe('Form Components', () => {
  const user = userEvent.setup();
  
  describe('Form', () => {
    it('renders form with all fields', () => {
      const mockSubmit = jest.fn();
      render(<TestForm onSubmit={mockSubmit} />);
      
      expect(screen.getByTestId('test-form')).toBeInTheDocument();
      expect(screen.getByTestId('name-input')).toBeInTheDocument();
      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('age-input')).toBeInTheDocument();
      expect(screen.getByTestId('category-select')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit Form' })).toBeInTheDocument();
    });

    it('shows validation errors on invalid submission', async () => {
      const mockSubmit = jest.fn();
      render(<TestForm onSubmit={mockSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: 'Submit Form' });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Category is required')).toBeInTheDocument();
      });
      
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('submits valid form data', async () => {
      const mockSubmit = jest.fn().mockResolvedValue(undefined);
      render(<TestForm onSubmit={mockSubmit} />);
      
      // Fill out the form
      await user.type(screen.getByTestId('name-input'), 'John Doe');
      await user.type(screen.getByTestId('email-input'), 'john@example.com');
      await user.type(screen.getByTestId('age-input'), '25');
      await user.selectOptions(screen.getByTestId('category-select'), 'option1');
      
      const submitButton = screen.getByRole('button', { name: 'Submit Form' });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          name: 'John Doe',
          email: 'john@example.com',
          age: 25,
          category: 'option1',
        });
      });
    });

    it('shows loading state during submission', async () => {
      const mockSubmit = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      render(<TestForm onSubmit={mockSubmit} />);
      
      // Fill out the form with valid data
      await user.type(screen.getByTestId('name-input'), 'John Doe');
      await user.type(screen.getByTestId('email-input'), 'john@example.com');
      await user.selectOptions(screen.getByTestId('category-select'), 'option1');
      
      const submitButton = screen.getByRole('button', { name: 'Submit Form' });
      await user.click(submitButton);
      
      // Should show loading state
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Submit Form')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('FormSection', () => {
    it('renders section with title and description', () => {
      render(
        <FormSection title="Test Section" description="This is a test section">
          <div>Section content</div>
        </FormSection>
      );
      
      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('This is a test section')).toBeInTheDocument();
      expect(screen.getByText('Section content')).toBeInTheDocument();
    });

    it('toggles collapsible section', async () => {
      render(
        <FormSection 
          title="Collapsible Section" 
          collapsible 
          defaultCollapsed={false}
        >
          <div>Section content</div>
        </FormSection>
      );
      
      const content = screen.getByText('Section content');
      const toggleButton = screen.getByLabelText('Collapse section');
      
      expect(content).toBeInTheDocument();
      
      await user.click(toggleButton);
      
      expect(content).not.toBeInTheDocument();
      expect(screen.getByLabelText('Expand section')).toBeInTheDocument();
    });
  });

  describe('FormActions', () => {
    it('renders submit and cancel buttons', () => {
      const mockCancel = jest.fn();
      
      render(
        <FormActions 
          submitLabel="Save Changes"
          cancelLabel="Cancel"
          onCancel={mockCancel}
          showCancel
        />
      );
      
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('calls onCancel when cancel button clicked', async () => {
      const mockCancel = jest.fn();
      
      render(
        <FormActions 
          onCancel={mockCancel}
          showCancel
        />
      );
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);
      
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('Grid Layout', () => {
    function GridForm() {
      const form = useForm();
      return (
        <Form form={form} onSubmit={() => {}} layout="grid" columns={2}>
          <ControlledInput name="field1" label="Field 1" />
          <ControlledInput name="field2" label="Field 2" />
          <ControlledInput name="field3" label="Field 3" />
          <ControlledInput name="field4" label="Field 4" />
        </Form>
      );
    }

    it('applies grid layout classes', () => {
      render(<GridForm />);
      
      const form = screen.getByRole('form');
      expect(form).toHaveClass('grid', 'gap-4', 'grid-cols-1', 'md:grid-cols-2');
    });
  });

  describe('Form Validation', () => {
    it('validates fields in real-time', async () => {
      const mockSubmit = jest.fn();
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      const emailInput = screen.getByTestId('email-input');
      
      // Type invalid email
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Blur the field
      
      await waitFor(() => {
        expect(screen.getByText('Invalid email')).toBeInTheDocument();
      });
      
      // Type single character for name (minimum 2 required)
      await user.type(nameInput, 'A');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const mockSubmit = jest.fn();
      render(<TestForm onSubmit={mockSubmit} />);
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('noValidate');
      
      // Check that inputs have proper labels
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Age')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
    });

    it('announces validation errors to screen readers', async () => {
      const mockSubmit = jest.fn();
      render(<TestForm onSubmit={mockSubmit} />);
      
      const submitButton = screen.getByRole('button', { name: 'Submit Form' });
      await user.click(submitButton);
      
      await waitFor(() => {
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive classes for different screen sizes', () => {
      function ResponsiveForm() {
        const form = useForm();
        return (
          <Form form={form} onSubmit={() => {}} layout="grid" columns={4}>
            <ControlledInput name="field1" label="Field 1" />
          </Form>
        );
      }
      
      render(<ResponsiveForm />);
      
      const form = screen.getByRole('form');
      expect(form).toHaveClass(
        'grid-cols-1',
        'md:grid-cols-2',
        'lg:grid-cols-4'
      );
    });
  });
});
