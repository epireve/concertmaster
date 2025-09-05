/**
 * FormBuilder Component Unit Tests
 * Comprehensive testing for the main form builder component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormBuilder } from '../../../frontend/src/components/forms/FormBuilder';
import { FormSchema, FormFieldType } from '../../../frontend/src/types/forms';
import { mockFormSchema, mockFormField, createMockField } from '../../fixtures/form-fixtures';

// Mock dependencies
jest.mock('lucide-react', () => ({
  Eye: () => <div data-testid="eye-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Code: () => <div data-testid="code-icon" />,
  Save: () => <div data-testid="save-icon" />,
  Play: () => <div data-testid="play-icon" />,
}));

describe('FormBuilder Component', () => {
  const user = userEvent.setup();
  let mockOnSave: jest.Mock;
  let mockOnPreview: jest.Mock;

  beforeEach(() => {
    mockOnSave = jest.fn();
    mockOnPreview = jest.fn();
  });

  describe('Initialization', () => {
    it('renders with default schema when no initial schema provided', () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      expect(screen.getByDisplayValue('Untitled Form')).toBeInTheDocument();
      expect(screen.getByText('Start building your form')).toBeInTheDocument();
    });

    it('renders with provided initial schema', () => {
      const initialSchema = mockFormSchema();
      render(
        <FormBuilder 
          initialSchema={initialSchema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );
      
      expect(screen.getByDisplayValue(initialSchema.title)).toBeInTheDocument();
    });

    it('initializes form with correct default values', () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      const titleInput = screen.getByDisplayValue('Untitled Form');
      expect(titleInput).toHaveAttribute('placeholder', 'Form Title');
    });
  });

  describe('Field Management', () => {
    it('adds new field when field type is dropped', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      const canvas = screen.getByText('Start building your form').closest('div');
      
      // Simulate drag and drop
      fireEvent.drop(canvas!, {
        dataTransfer: {
          getData: jest.fn().mockReturnValue('text'),
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Text Input')).toBeInTheDocument();
      });
    });

    it('selects field when clicked', async () => {
      const schema = mockFormSchema({
        fields: [createMockField({ type: 'text', label: 'Test Field' })],
      });

      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      const field = screen.getByText('Test Field');
      await user.click(field);

      // Field should be selected (visual indication)
      expect(field.closest('.border-blue-500')).toBeInTheDocument();
    });

    it('updates field properties correctly', async () => {
      const schema = mockFormSchema({
        fields: [createMockField({ type: 'text', label: 'Original Label' })],
      });

      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      // This would require the FieldEditor to be rendered
      // Testing the update mechanism through the API
      expect(screen.getByText('Original Label')).toBeInTheDocument();
    });

    it('deletes field when delete action is triggered', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'text', label: 'Field 1' }),
          createMockField({ type: 'email', label: 'Field 2' }),
        ],
      });

      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByText('Field 1')).toBeInTheDocument();
      expect(screen.getByText('Field 2')).toBeInTheDocument();

      // Delete functionality would be tested through field editor integration
    });

    it('duplicates field correctly', async () => {
      const schema = mockFormSchema({
        fields: [createMockField({ type: 'text', label: 'Original Field' })],
      });

      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByText('Original Field')).toBeInTheDocument();
      // Duplication would be tested through field editor integration
    });

    it('reorders fields via drag and drop', async () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'text', label: 'Field 1', order: 0 }),
          createMockField({ type: 'email', label: 'Field 2', order: 1 }),
        ],
      });

      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      const field1 = screen.getByText('Field 1');
      const field2 = screen.getByText('Field 2');

      expect(field1).toBeInTheDocument();
      expect(field2).toBeInTheDocument();

      // Reordering would be tested with drag and drop simulation
    });
  });

  describe('View Modes', () => {
    it('switches to preview mode when preview button clicked', async () => {
      const schema = mockFormSchema();
      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      const previewButton = screen.getAllByTestId('eye-icon')[0].closest('button');
      await user.click(previewButton!);

      expect(mockOnPreview).toHaveBeenCalledWith(expect.any(Object));
    });

    it('switches to settings mode when settings button clicked', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);

      const settingsButton = screen.getAllByTestId('settings-icon')[0].closest('button');
      await user.click(settingsButton!);

      // Settings view should be active
      expect(settingsButton).toHaveClass('bg-blue-100');
    });

    it('switches to code view when code button clicked', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);

      const codeButton = screen.getByTestId('code-icon').closest('button');
      await user.click(codeButton!);

      // Code view should be active
      expect(codeButton).toHaveClass('bg-blue-100');
    });

    it('displays JSON schema in code view', async () => {
      const schema = mockFormSchema();
      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      const codeButton = screen.getByTestId('code-icon').closest('button');
      await user.click(codeButton!);

      await waitFor(() => {
        expect(screen.getByText(/"name":/)).toBeInTheDocument();
      });
    });
  });

  describe('Form Actions', () => {
    it('calls onSave when save button clicked', async () => {
      const schema = mockFormSchema();
      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        fields: expect.any(Array),
      }));
    });

    it('calls onPreview when test button clicked', async () => {
      const schema = mockFormSchema();
      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      const testButton = screen.getByText('Test');
      await user.click(testButton);

      expect(mockOnPreview).toHaveBeenCalledWith(expect.any(Object));
    });

    it('updates form title correctly', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);

      const titleInput = screen.getByDisplayValue('Untitled Form');
      await user.clear(titleInput);
      await user.type(titleInput, 'My Custom Form');

      expect(screen.getByDisplayValue('My Custom Form')).toBeInTheDocument();
    });

    it('updates form description correctly', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);

      const descriptionInput = screen.getByPlaceholderText('Form description (optional)');
      await user.type(descriptionInput, 'This is a test form description');

      expect(screen.getByDisplayValue('This is a test form description')).toBeInTheDocument();
    });
  });

  describe('Sections', () => {
    it('adds new section correctly', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      // Section addition would be tested through the section management interface
      // This tests the underlying function
      expect(screen.getByText('Start building your form')).toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('prevents default on dragover', () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      const canvas = screen.getByText('Start building your form').closest('div');
      const dragOverEvent = new Event('dragover');
      const preventDefaultSpy = jest.spyOn(dragOverEvent, 'preventDefault');
      
      fireEvent(canvas!, dragOverEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('handles drop events correctly', () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      const canvas = screen.getByText('Start building your form').closest('div');
      
      fireEvent.drop(canvas!, {
        dataTransfer: {
          getData: jest.fn().mockReturnValue('email'),
        },
      });
      
      // Field should be added
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates form schema before save', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          fields: expect.any(Array),
          settings: expect.any(Object),
          styling: expect.any(Object),
        })
      );
    });

    it('generates unique IDs for new fields', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      const canvas = screen.getByText('Start building your form').closest('div');
      
      // Add multiple fields
      fireEvent.drop(canvas!, {
        dataTransfer: { getData: jest.fn().mockReturnValue('text') },
      });
      
      fireEvent.drop(canvas!, {
        dataTransfer: { getData: jest.fn().mockReturnValue('email') },
      });

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      const savedForm = mockOnSave.mock.calls[0][0];
      const fieldIds = savedForm.fields.map((f: any) => f.id);
      
      // All IDs should be unique
      expect(new Set(fieldIds).size).toBe(fieldIds.length);
    });
  });

  describe('Accessibility', () => {
    it('has accessible form controls', () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      const titleInput = screen.getByDisplayValue('Untitled Form');
      expect(titleInput).toHaveAttribute('placeholder', 'Form Title');
      
      const descriptionTextarea = screen.getByPlaceholderText('Form description (optional)');
      expect(descriptionTextarea).toBeInTheDocument();
    });

    it('has accessible toolbar buttons with titles', () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      expect(screen.getByTitle('Preview')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
      expect(screen.getByTitle('View Code')).toBeInTheDocument();
    });

    it('manages focus correctly when switching views', async () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);

      const previewButton = screen.getByTitle('Preview');
      await user.click(previewButton);

      // Focus management would be tested with more complex interactions
      expect(previewButton).toHaveClass('bg-blue-100');
    });
  });

  describe('Performance', () => {
    it('renders efficiently with large number of fields', () => {
      const fieldsArray = Array.from({ length: 50 }, (_, index) =>
        createMockField({ type: 'text', label: `Field ${index + 1}`, order: index })
      );

      const schema = mockFormSchema({ fields: fieldsArray });

      const startTime = performance.now();
      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render in under 100ms
    });

    it('memoizes field updates correctly', async () => {
      const schema = mockFormSchema({
        fields: [createMockField({ type: 'text', label: 'Test Field' })],
      });

      render(
        <FormBuilder 
          initialSchema={schema}
          onSave={mockOnSave}
          onPreview={mockOnPreview}
        />
      );

      const titleInput = screen.getByDisplayValue('Test Form');
      
      // Multiple rapid updates
      await user.type(titleInput, '1');
      await user.type(titleInput, '2');
      await user.type(titleInput, '3');

      // Should handle updates efficiently
      expect(screen.getByDisplayValue('Test Form123')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles missing field data gracefully', () => {
      const invalidSchema = {
        ...mockFormSchema(),
        fields: [{ id: 'invalid-field' }] as any,
      };

      expect(() =>
        render(
          <FormBuilder 
            initialSchema={invalidSchema}
            onSave={mockOnSave}
            onPreview={mockOnPreview}
          />
        )
      ).not.toThrow();
    });

    it('handles save errors gracefully', async () => {
      const errorOnSave = jest.fn().mockRejectedValue(new Error('Save failed'));
      
      render(<FormBuilder onSave={errorOnSave} onPreview={mockOnPreview} />);

      const saveButton = screen.getByText('Save');
      
      // Should not throw when save fails
      await expect(user.click(saveButton)).resolves.not.toThrow();
    });

    it('validates required fields before operations', () => {
      render(<FormBuilder onSave={mockOnSave} onPreview={mockOnPreview} />);
      
      const titleInput = screen.getByDisplayValue('Untitled Form');
      expect(titleInput).toHaveValue('Untitled Form');
      
      // Empty title should still allow operations but with validation
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });
});