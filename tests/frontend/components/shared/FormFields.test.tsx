import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  ControlledInput,
  ControlledSelect,
  ControlledTextarea,
  ControlledCheckbox,
  ControlledRadioGroup,
  ControlledFileUpload,
  ControlledMultiSelect,
} from '../../../../frontend/src/components/shared/FormFields';

// Test wrapper component
function TestFormWrapper({ 
  children, 
  schema, 
  defaultValues = {}
}: { 
  children: React.ReactNode;
  schema?: any;
  defaultValues?: any;
}) {
  const form = useForm({
    resolver: schema ? yupResolver(schema) : undefined,
    defaultValues,
    mode: 'onChange',
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        {children}
      </form>
    </FormProvider>
  );
}

describe('Form Field Components', () => {
  const user = userEvent.setup();

  describe('ControlledInput', () => {
    const schema = yup.object({
      name: yup.string().required('Name is required'),
      email: yup.string().email('Invalid email'),
    });

    it('renders input with label', () => {
      render(
        <TestFormWrapper schema={schema}>
          <ControlledInput name="name" label="Full Name" placeholder="Enter name" />
        </TestFormWrapper>
      );

      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
    });

    it('shows validation error', async () => {
      render(
        <TestFormWrapper schema={schema}>
          <ControlledInput name="name" label="Full Name" />
          <ControlledInput name="email" label="Email" type="email" />
        </TestFormWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Invalid email')).toBeInTheDocument();
      });
    });

    it('updates value on change', async () => {
      render(
        <TestFormWrapper>
          <ControlledInput name="name" label="Name" />
        </TestFormWrapper>
      );

      const input = screen.getByLabelText('Name');
      await user.type(input, 'John Doe');

      expect(input).toHaveValue('John Doe');
    });

    it('supports different input types', () => {
      render(
        <TestFormWrapper>
          <ControlledInput name="email" label="Email" type="email" />
          <ControlledInput name="password" label="Password" type="password" />
          <ControlledInput name="number" label="Age" type="number" />
        </TestFormWrapper>
      );

      expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText('Age')).toHaveAttribute('type', 'number');
    });
  });

  describe('ControlledSelect', () => {
    const options = [
      { label: 'Option 1', value: 'option1' },
      { label: 'Option 2', value: 'option2' },
      { label: 'Option 3', value: 'option3' },
    ];

    it('renders select with options', () => {
      render(
        <TestFormWrapper>
          <ControlledSelect 
            name="category" 
            label="Category" 
            options={options}
            placeholder="Select option"
          />
        </TestFormWrapper>
      );

      const select = screen.getByLabelText('Category');
      expect(select).toBeInTheDocument();
      expect(screen.getByText('Select option')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('updates value on selection', async () => {
      render(
        <TestFormWrapper>
          <ControlledSelect name="category" label="Category" options={options} />
        </TestFormWrapper>
      );

      const select = screen.getByLabelText('Category');
      await user.selectOptions(select, 'option2');

      expect(select).toHaveValue('option2');
    });

    it('shows validation error', async () => {
      const schema = yup.object({
        category: yup.string().required('Category is required'),
      });

      render(
        <TestFormWrapper schema={schema}>
          <ControlledSelect name="category" label="Category" options={options} />
          <button type="submit">Submit</button>
        </TestFormWrapper>
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Category is required')).toBeInTheDocument();
      });
    });
  });

  describe('ControlledTextarea', () => {
    it('renders textarea with label', () => {
      render(
        <TestFormWrapper>
          <ControlledTextarea 
            name="description" 
            label="Description" 
            placeholder="Enter description"
            rows={4}
          />
        </TestFormWrapper>
      );

      const textarea = screen.getByLabelText('Description');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('rows', '4');
      expect(textarea).toHaveAttribute('placeholder', 'Enter description');
    });

    it('shows character count when enabled', () => {
      render(
        <TestFormWrapper>
          <ControlledTextarea 
            name="description" 
            label="Description"
            showCharacterCount
            maxLength={100}
          />
        </TestFormWrapper>
      );

      expect(screen.getByText('0/100')).toBeInTheDocument();
    });

    it('updates character count on input', async () => {
      render(
        <TestFormWrapper>
          <ControlledTextarea 
            name="description" 
            label="Description"
            showCharacterCount
            maxLength={100}
          />
        </TestFormWrapper>
      );

      const textarea = screen.getByLabelText('Description');
      await user.type(textarea, 'Hello world');

      expect(screen.getByText('11/100')).toBeInTheDocument();
    });
  });

  describe('ControlledCheckbox', () => {
    it('renders checkbox with label', () => {
      render(
        <TestFormWrapper>
          <ControlledCheckbox name="agree" label="I agree to terms" />
        </TestFormWrapper>
      );

      const checkbox = screen.getByLabelText('I agree to terms');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('type', 'checkbox');
    });

    it('toggles value on click', async () => {
      render(
        <TestFormWrapper>
          <ControlledCheckbox name="agree" label="I agree to terms" />
        </TestFormWrapper>
      );

      const checkbox = screen.getByLabelText('I agree to terms');
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('renders as switch variant', () => {
      render(
        <TestFormWrapper>
          <ControlledCheckbox name="notifications" label="Enable notifications" variant="switch" />
        </TestFormWrapper>
      );

      const switchRole = screen.getByRole('switch');
      expect(switchRole).toBeInTheDocument();
    });
  });

  describe('ControlledRadioGroup', () => {
    const radioOptions = [
      { label: 'Small', value: 'small' },
      { label: 'Medium', value: 'medium' },
      { label: 'Large', value: 'large' },
    ];

    it('renders radio group with options', () => {
      render(
        <TestFormWrapper>
          <ControlledRadioGroup 
            name="size" 
            label="Size" 
            options={radioOptions}
          />
        </TestFormWrapper>
      );

      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByLabelText('Small')).toBeInTheDocument();
      expect(screen.getByLabelText('Medium')).toBeInTheDocument();
      expect(screen.getByLabelText('Large')).toBeInTheDocument();
    });

    it('selects radio option', async () => {
      render(
        <TestFormWrapper>
          <ControlledRadioGroup 
            name="size" 
            label="Size" 
            options={radioOptions}
          />
        </TestFormWrapper>
      );

      const mediumRadio = screen.getByLabelText('Medium');
      await user.click(mediumRadio);

      expect(mediumRadio).toBeChecked();
      expect(screen.getByLabelText('Small')).not.toBeChecked();
      expect(screen.getByLabelText('Large')).not.toBeChecked();
    });

    it('renders horizontally when specified', () => {
      render(
        <TestFormWrapper>
          <ControlledRadioGroup 
            name="size" 
            label="Size" 
            options={radioOptions}
            orientation="horizontal"
          />
        </TestFormWrapper>
      );

      const radioGroup = screen.getByRole('radiogroup');
      const container = radioGroup.querySelector('div');
      expect(container).toHaveClass('flex', 'flex-wrap', 'gap-6');
    });
  });

  describe('ControlledFileUpload', () => {
    const mockUpload = jest.fn().mockResolvedValue({ url: 'http://example.com/file.jpg' });

    beforeEach(() => {
      mockUpload.mockClear();
    });

    it('renders file upload component', () => {
      render(
        <TestFormWrapper>
          <ControlledFileUpload 
            name="files" 
            label="Upload Files"
            accept="image/*"
            onUpload={mockUpload}
          />
        </TestFormWrapper>
      );

      expect(screen.getByText('Upload Files')).toBeInTheDocument();
      expect(screen.getByText('Drop files here or')).toBeInTheDocument();
      expect(screen.getByText('browse')).toBeInTheDocument();
    });

    it('handles file selection', async () => {
      render(
        <TestFormWrapper>
          <ControlledFileUpload 
            name="files" 
            label="Upload Files"
            onUpload={mockUpload}
          />
        </TestFormWrapper>
      );

      const fileInput = screen.getByRole('button', { name: 'Upload files' });
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      // Mock file input change
      const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (hiddenInput) {
        Object.defineProperty(hiddenInput, 'files', {
          value: [file],
          writable: false,
        });
        fireEvent.change(hiddenInput);
      }

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });
  });

  describe('ControlledMultiSelect', () => {
    const options = [
      { label: 'JavaScript', value: 'js' },
      { label: 'TypeScript', value: 'ts' },
      { label: 'Python', value: 'py' },
      { label: 'Java', value: 'java' },
    ];

    it('renders multi-select with options', () => {
      render(
        <TestFormWrapper>
          <ControlledMultiSelect 
            name="skills" 
            label="Programming Skills" 
            options={options}
            placeholder="Select skills..."
          />
        </TestFormWrapper>
      );

      expect(screen.getByText('Programming Skills')).toBeInTheDocument();
      expect(screen.getByText('Select skills...')).toBeInTheDocument();
    });

    it('adds and removes selections', async () => {
      render(
        <TestFormWrapper>
          <ControlledMultiSelect 
            name="skills" 
            label="Programming Skills" 
            options={options}
          />
        </TestFormWrapper>
      );

      const select = screen.getByRole('combobox', { multiple: true });
      
      // Select JavaScript
      await user.selectOptions(select, 'js');
      await waitFor(() => {
        expect(screen.getByText('JavaScript')).toBeInTheDocument();
      });

      // Select TypeScript
      await user.selectOptions(select, 'ts');
      await waitFor(() => {
        expect(screen.getByText('TypeScript')).toBeInTheDocument();
      });

      // Remove JavaScript
      const removeButton = screen.getByLabelText('Remove JavaScript');
      await user.click(removeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('JavaScript')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA attributes', () => {
      render(
        <TestFormWrapper>
          <ControlledInput name="name" label="Name" helpText="Enter your full name" />
          <ControlledSelect 
            name="category" 
            label="Category" 
            options={[{ label: 'Option 1', value: 'option1' }]}
          />
        </TestFormWrapper>
      );

      const nameInput = screen.getByLabelText('Name');
      expect(nameInput).toHaveAttribute('aria-describedby');
      
      const categorySelect = screen.getByLabelText('Category');
      expect(categorySelect).toHaveAccessibleName();
    });

    it('announces validation errors to screen readers', async () => {
      const schema = yup.object({
        email: yup.string().email('Invalid email').required('Email is required'),
      });

      render(
        <TestFormWrapper schema={schema}>
          <ControlledInput name="email" label="Email" type="email" />
        </TestFormWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      await user.type(emailInput, 'invalid');
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent('Invalid email');
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Integration with React Hook Form', () => {
    it('integrates with form validation', async () => {
      const schema = yup.object({
        name: yup.string().required('Name is required'),
        email: yup.string().email('Invalid email').required('Email is required'),
      });

      const TestForm = () => {
        const form = useForm({
          resolver: yupResolver(schema),
          mode: 'onChange',
        });

        return (
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(() => {})}>
              <ControlledInput name="name" label="Name" />
              <ControlledInput name="email" label="Email" type="email" />
              <button type="submit">Submit</button>
            </form>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });
    });
  });
});
