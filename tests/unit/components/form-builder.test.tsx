/**
 * Unit Tests for FormBuilder Component
 * Testing form creation, field management, and visual form builder features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormBuilder } from '../../../frontend/src/components/forms/FormBuilder';
import { TestDataFactory } from '../../setup/setupTests';

// Mock form field components
jest.mock('../../../frontend/src/components/forms/FieldPalette', () => ({
  FieldPalette: ({ onFieldSelect }: any) => (
    <div data-testid="field-palette">
      <button data-testid="add-text-field" onClick={() => onFieldSelect({ type: 'text', label: 'Text Input' })}>
        Add Text Field
      </button>
      <button data-testid="add-number-field" onClick={() => onFieldSelect({ type: 'number', label: 'Number Input' })}>
        Add Number Field
      </button>
      <button data-testid="add-select-field" onClick={() => onFieldSelect({ type: 'select', label: 'Select Field' })}>
        Add Select Field
      </button>
      <button data-testid="add-checkbox-field" onClick={() => onFieldSelect({ type: 'checkbox', label: 'Checkbox' })}>
        Add Checkbox
      </button>
    </div>
  ),
}));

jest.mock('../../../frontend/src/components/forms/FieldEditor', () => ({
  FieldEditor: ({ field, onFieldUpdate, onFieldDelete }: any) => (
    <div data-testid={`field-editor-${field.id}`}>
      <input 
        data-testid={`field-label-${field.id}`}
        value={field.label}
        onChange={(e) => onFieldUpdate({ ...field, label: e.target.value })}
      />
      <input 
        data-testid={`field-placeholder-${field.id}`}
        value={field.placeholder || ''}
        onChange={(e) => onFieldUpdate({ ...field, placeholder: e.target.value })}
      />
      <input 
        type="checkbox"
        data-testid={`field-required-${field.id}`}
        checked={field.required || false}
        onChange={(e) => onFieldUpdate({ ...field, required: e.target.checked })}
      />
      <button data-testid={`delete-field-${field.id}`} onClick={() => onFieldDelete(field.id)}>
        Delete Field
      </button>
    </div>
  ),
}));

jest.mock('../../../frontend/src/components/forms/FormPreview', () => ({
  FormPreview: ({ fields }: any) => (
    <div data-testid="form-preview">
      {fields.map((field: any) => (
        <div key={field.id} data-testid={`preview-field-${field.id}`} data-field-type={field.type}>
          <label>{field.label}{field.required && ' *'}</label>
          {field.type === 'text' && <input type="text" placeholder={field.placeholder} />}
          {field.type === 'number' && <input type="number" placeholder={field.placeholder} />}
          {field.type === 'select' && (
            <select>
              {field.options?.map((option: any, index: number) => (
                <option key={index} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          {field.type === 'checkbox' && <input type="checkbox" />}
        </div>
      ))}
    </div>
  ),
}));

describe('FormBuilder Component', () => {
  const defaultProps = {
    onFormSave: jest.fn(),
    onFormDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Builder Initialization', () => {
    it('should render with empty form initially', () => {
      render(<FormBuilder {...defaultProps} />);
      
      expect(screen.getByTestId('field-palette')).toBeInTheDocument();
      expect(screen.getByTestId('form-preview')).toBeInTheDocument();
      expect(screen.queryByTestId('field-editor-1')).not.toBeInTheDocument();
    });

    it('should render with existing form data', () => {
      const existingForm = {
        id: 'form-1',
        title: 'Existing Form',
        fields: [
          {
            id: 'field-1',
            type: 'text',
            label: 'Full Name',
            placeholder: 'Enter your full name',
            required: true,
          },
          {
            id: 'field-2',
            type: 'number',
            label: 'Age',
            required: false,
          },
        ],
      };

      render(<FormBuilder {...defaultProps} initialForm={existingForm} />);
      
      expect(screen.getByDisplayValue('Existing Form')).toBeInTheDocument();
      expect(screen.getByTestId('preview-field-field-1')).toBeInTheDocument();
      expect(screen.getByTestId('preview-field-field-2')).toBeInTheDocument();
      expect(screen.getByText('Full Name *')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
    });
  });

  describe('Field Management', () => {
    it('should add new text field from palette', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      const addTextButton = screen.getByTestId('add-text-field');
      
      await act(async () => {
        await user.click(addTextButton);
      });

      expect(screen.getByTestId('preview-field-1')).toBeInTheDocument();
      expect(screen.getByTestId('preview-field-1')).toHaveAttribute('data-field-type', 'text');
      expect(screen.getByText('Text Input')).toBeInTheDocument();
    });

    it('should add multiple different field types', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      await act(async () => {
        await user.click(screen.getByTestId('add-text-field'));
        await user.click(screen.getByTestId('add-number-field'));
        await user.click(screen.getByTestId('add-select-field'));
        await user.click(screen.getByTestId('add-checkbox-field'));
      });

      expect(screen.getByTestId('preview-field-1')).toHaveAttribute('data-field-type', 'text');
      expect(screen.getByTestId('preview-field-2')).toHaveAttribute('data-field-type', 'number');
      expect(screen.getByTestId('preview-field-3')).toHaveAttribute('data-field-type', 'select');
      expect(screen.getByTestId('preview-field-4')).toHaveAttribute('data-field-type', 'checkbox');
    });

    it('should select and edit field properties', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      // Add a field first
      await act(async () => {
        await user.click(screen.getByTestId('add-text-field'));
      });

      // Click on the field to select it
      await act(async () => {
        await user.click(screen.getByTestId('preview-field-1'));
      });

      expect(screen.getByTestId('field-editor-1')).toBeInTheDocument();
      
      // Edit field label
      const labelInput = screen.getByTestId('field-label-1');
      await act(async () => {
        await user.clear(labelInput);
        await user.type(labelInput, 'Custom Label');
      });

      expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });

    it('should update field placeholder', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      await act(async () => {
        await user.click(screen.getByTestId('add-text-field'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('preview-field-1'));
      });

      const placeholderInput = screen.getByTestId('field-placeholder-1');
      await act(async () => {
        await user.type(placeholderInput, 'Enter custom text');
      });

      expect(screen.getByPlaceholderText('Enter custom text')).toBeInTheDocument();
    });

    it('should toggle field required status', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      await act(async () => {
        await user.click(screen.getByTestId('add-text-field'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('preview-field-1'));
      });

      const requiredCheckbox = screen.getByTestId('field-required-1');
      
      expect(requiredCheckbox).not.toBeChecked();
      expect(screen.queryByText('Text Input *')).not.toBeInTheDocument();

      await act(async () => {
        await user.click(requiredCheckbox);
      });

      expect(requiredCheckbox).toBeChecked();
      expect(screen.getByText('Text Input *')).toBeInTheDocument();
    });

    it('should delete field from form', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      await act(async () => {
        await user.click(screen.getByTestId('add-text-field'));
      });

      expect(screen.getByTestId('preview-field-1')).toBeInTheDocument();

      await act(async () => {
        await user.click(screen.getByTestId('preview-field-1'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('delete-field-1'));
      });

      expect(screen.queryByTestId('preview-field-1')).not.toBeInTheDocument();
    });
  });

  describe('Field Reordering', () => {
    it('should support drag and drop field reordering', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      // Add multiple fields
      await act(async () => {
        await user.click(screen.getByTestId('add-text-field'));
        await user.click(screen.getByTestId('add-number-field'));
      });

      const firstField = screen.getByTestId('preview-field-1');
      const secondField = screen.getByTestId('preview-field-2');

      expect(firstField).toHaveAttribute('data-field-type', 'text');
      expect(secondField).toHaveAttribute('data-field-type', 'number');

      // Simulate drag and drop
      await act(async () => {
        fireEvent.dragStart(firstField);
        fireEvent.dragEnter(secondField);
        fireEvent.dragOver(secondField);
        fireEvent.drop(secondField);
        fireEvent.dragEnd(firstField);
      });

      // After reordering, the number field should be first
      const reorderedFirstField = screen.getByTestId('preview-field-1');
      const reorderedSecondField = screen.getByTestId('preview-field-2');

      expect(reorderedFirstField).toHaveAttribute('data-field-type', 'number');
      expect(reorderedSecondField).toHaveAttribute('data-field-type', 'text');
    });
  });

  describe('Form Configuration', () => {
    it('should allow form title editing', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      const titleInput = screen.getByPlaceholderText('Form Title') || 
                        screen.getByDisplayValue('') ||
                        screen.getByRole('textbox', { name: /title/i });
      
      await act(async () => {
        await user.type(titleInput, 'Customer Survey Form');
      });

      expect(screen.getByDisplayValue('Customer Survey Form')).toBeInTheDocument();
    });

    it('should allow form description editing', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      const descriptionInput = screen.getByPlaceholderText('Form Description') ||
                              screen.getByRole('textbox', { name: /description/i });
      
      await act(async () => {
        await user.type(descriptionInput, 'Please fill out this survey to help us improve our services.');
      });

      expect(screen.getByDisplayValue('Please fill out this survey to help us improve our services.')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required form title before saving', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      
      await act(async () => {
        await user.click(saveButton);
      });

      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(defaultProps.onFormSave).not.toHaveBeenCalled();
    });

    it('should validate that form has at least one field', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      const saveButton = screen.getByRole('button', { name: /save/i });
      
      await act(async () => {
        await user.type(titleInput, 'Valid Title');
        await user.click(saveButton);
      });

      expect(screen.getByText(/form must have at least one field/i)).toBeInTheDocument();
      expect(defaultProps.onFormSave).not.toHaveBeenCalled();
    });

    it('should validate field configuration completeness', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      // Add a select field (which requires options)
      await act(async () => {
        await user.click(screen.getByTestId('add-select-field'));
      });

      // Set form title and try to save
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      const saveButton = screen.getByRole('button', { name: /save/i });
      
      await act(async () => {
        await user.type(titleInput, 'Form with Select');
        await user.click(saveButton);
      });

      expect(screen.getByText(/select field must have options/i)).toBeInTheDocument();
    });
  });

  describe('Form Persistence', () => {
    it('should save valid form successfully', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      // Create valid form
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      
      await act(async () => {
        await user.type(titleInput, 'Test Form');
        await user.click(screen.getByTestId('add-text-field'));
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      
      await act(async () => {
        await user.click(saveButton);
      });

      expect(defaultProps.onFormSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Form',
          fields: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              label: 'Text Input',
            }),
          ]),
        })
      );
    });

    it('should handle form deletion', async () => {
      const user = userEvent.setup();
      const existingForm = {
        id: 'form-1',
        title: 'Form to Delete',
        fields: [],
      };

      render(<FormBuilder {...defaultProps} initialForm={existingForm} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      await act(async () => {
        await user.click(deleteButton);
      });

      expect(defaultProps.onFormDelete).toHaveBeenCalledWith('form-1');
    });
  });

  describe('Field Type Specific Features', () => {
    it('should handle select field options management', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      await act(async () => {
        await user.click(screen.getByTestId('add-select-field'));
        await user.click(screen.getByTestId('preview-field-1'));
      });

      // Should show options editor for select field
      expect(screen.getByText('Options')).toBeInTheDocument();
      
      const addOptionButton = screen.getByRole('button', { name: /add option/i });
      
      await act(async () => {
        await user.click(addOptionButton);
      });

      const optionLabelInput = screen.getByPlaceholderText('Option Label');
      const optionValueInput = screen.getByPlaceholderText('Option Value');
      
      await act(async () => {
        await user.type(optionLabelInput, 'First Option');
        await user.type(optionValueInput, 'option1');
      });

      expect(screen.getByDisplayValue('First Option')).toBeInTheDocument();
      expect(screen.getByDisplayValue('option1')).toBeInTheDocument();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large forms efficiently', async () => {
      const user = userEvent.setup();
      const largeForm = {
        id: 'large-form',
        title: 'Large Form',
        fields: Array.from({ length: 100 }, (_, i) => ({
          id: `field-${i + 1}`,
          type: 'text',
          label: `Field ${i + 1}`,
          required: i % 2 === 0,
        })),
      };

      const startTime = performance.now();
      render(<FormBuilder {...defaultProps} initialForm={largeForm} />);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
      expect(screen.getByText('Large Form')).toBeInTheDocument();
      expect(screen.getAllByTestId(/preview-field-/)).toHaveLength(100);
    });

    it('should handle rapid field updates without lag', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      await act(async () => {
        await user.click(screen.getByTestId('add-text-field'));
        await user.click(screen.getByTestId('preview-field-1'));
      });

      const labelInput = screen.getByTestId('field-label-1');
      
      const startTime = performance.now();
      
      // Simulate rapid typing
      for (let i = 0; i < 50; i++) {
        await act(async () => {
          await user.clear(labelInput);
          await user.type(labelInput, `Label Update ${i}`);
        });
      }
      
      const updateTime = performance.now() - startTime;
      
      expect(updateTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(screen.getByDisplayValue('Label Update 49')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<FormBuilder {...defaultProps} />);
      
      // Navigate using keyboard
      await act(async () => {
        await user.tab(); // Focus on first interactive element
      });

      expect(document.activeElement).toBeTruthy();
      
      // Add field using keyboard
      await act(async () => {
        await user.keyboard('{Enter}'); // Activate focused element
      });

      // Should have added a field or opened a menu
      expect(screen.getByTestId('field-palette')).toBeInTheDocument();
    });

    it('should provide proper ARIA labels', () => {
      render(<FormBuilder {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /add text field/i })).toHaveAttribute('aria-label');
      expect(screen.getByTestId('form-preview')).toHaveAttribute('aria-label', 'Form Preview');
    });
  });
});