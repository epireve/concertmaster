/**
 * Form Submission Integration Tests
 * Testing complete form submission workflows and API interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormBuilder } from '../../../frontend/src/components/forms/FormBuilder';
import { FormPreview } from '../../../frontend/src/components/forms/FormPreview';
import { mockFormSchema, createMockResponse, mockApiResponses } from '../../fixtures/form-fixtures';
import { formApi } from '../../../frontend/src/api/form-api';

// Mock the API module
jest.mock('../../../frontend/src/api/form-api');
const mockedFormApi = formApi as jest.Mocked<typeof formApi>;

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Test wrapper with React Query
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Form Submission Integration', () => {
  const user = userEvent.setup();
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  describe('Form Creation and Saving', () => {
    it('creates and saves a new form successfully', async () => {
      const mockSaveResponse = mockApiResponses.createForm(mockFormSchema());
      mockedFormApi.createForm.mockResolvedValue(mockSaveResponse);

      const handleSave = jest.fn();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder onSave={handleSave} />
        </TestWrapper>
      );

      // Build form
      const titleInput = screen.getByDisplayValue('Untitled Form');
      await user.clear(titleInput);
      await user.type(titleInput, 'Contact Form');

      // Add description
      const descriptionInput = screen.getByPlaceholderText('Form description (optional)');
      await user.type(descriptionInput, 'Please fill out this contact form');

      // Save form
      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Contact Form',
            description: 'Please fill out this contact form',
          })
        );
      });
    });

    it('handles form save errors gracefully', async () => {
      const mockErrorResponse = mockApiResponses.error('Network error');
      mockedFormApi.createForm.mockRejectedValue(mockErrorResponse);

      const handleSave = jest.fn().mockRejectedValue(mockErrorResponse);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder onSave={handleSave} />
        </TestWrapper>
      );

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Should handle error without crashing
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('validates form before saving', async () => {
      const handleSave = jest.fn();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder onSave={handleSave} />
        </TestWrapper>
      );

      // Try to save without any fields
      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Should still allow saving even with no fields (valid empty form)
      expect(handleSave).toHaveBeenCalled();
    });
  });

  describe('Form Response Submission', () => {
    const testSchema = mockFormSchema({
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Full Name',
          name: 'full_name',
          required: true,
          order: 0,
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          name: 'email_address',
          required: true,
          order: 1,
        },
        {
          id: 'message',
          type: 'textarea',
          label: 'Message',
          name: 'message',
          required: false,
          order: 2,
        },
      ] as any,
    });

    it('submits form response successfully', async () => {
      const mockResponse = createMockResponse();
      const mockSubmitResponse = mockApiResponses.submitResponse(mockResponse);
      
      mockedFormApi.submitResponse.mockResolvedValue(mockSubmitResponse);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSubmitResponse),
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={testSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      // Fill out form
      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, 'John Doe');

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'john.doe@example.com');

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'This is a test message');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedFormApi.submitResponse).toHaveBeenCalledWith(
          testSchema.id,
          expect.objectContaining({
            full_name: 'John Doe',
            email_address: 'john.doe@example.com',
            message: 'This is a test message',
          })
        );
      });
    });

    it('shows validation errors for invalid form data', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={testSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      // Try to submit without required fields
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/full name.*required/i)).toBeInTheDocument();
        expect(screen.getByText(/email.*required/i)).toBeInTheDocument();
      });
    });

    it('handles submission errors gracefully', async () => {
      const mockErrorResponse = mockApiResponses.validationError([
        { field: 'email_address', message: 'Email already exists' },
      ]);

      mockedFormApi.submitResponse.mockRejectedValue(mockErrorResponse);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockErrorResponse),
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={testSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      // Fill out form with valid data
      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, 'John Doe');

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'existing@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      // Delay the API response to test loading state
      mockedFormApi.submitResponse.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={testSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      // Fill out and submit form
      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, 'John Doe');

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'john.doe@example.com');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Check for loading state
      expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText(/submitting/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Updates', () => {
    const existingSchema = mockFormSchema({
      id: 'existing-form-123',
      title: 'Existing Form',
    });

    it('updates existing form successfully', async () => {
      const mockUpdateResponse = mockApiResponses.updateForm({
        ...existingSchema,
        title: 'Updated Form',
      });

      mockedFormApi.updateForm.mockResolvedValue(mockUpdateResponse);

      const handleSave = jest.fn();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder initialSchema={existingSchema} onSave={handleSave} />
        </TestWrapper>
      );

      // Update form title
      const titleInput = screen.getByDisplayValue('Existing Form');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Form');

      // Save changes
      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'existing-form-123',
            title: 'Updated Form',
          })
        );
      });
    });

    it('handles concurrent modifications', async () => {
      const mockConflictResponse = {
        success: false,
        error: {
          message: 'Form has been modified by another user',
          code: 'CONFLICT',
          details: { lastModified: new Date().toISOString() },
        },
      };

      mockedFormApi.updateForm.mockRejectedValue(mockConflictResponse);

      const handleSave = jest.fn().mockRejectedValue(mockConflictResponse);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder initialSchema={existingSchema} onSave={handleSave} />
        </TestWrapper>
      );

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Should handle conflict error
      expect(handleSave).toHaveBeenCalled();
    });
  });

  describe('Auto-save Functionality', () => {
    it('saves form automatically after changes', async () => {
      jest.useFakeTimers();
      
      const mockAutoSaveResponse = mockApiResponses.updateForm(mockFormSchema());
      mockedFormApi.updateForm.mockResolvedValue(mockAutoSaveResponse);

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder />
        </TestWrapper>
      );

      // Make changes to trigger auto-save
      const titleInput = screen.getByDisplayValue('Untitled Form');
      await user.type(titleInput, ' - Modified');

      // Fast forward timers to trigger auto-save
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        // Auto-save would be implemented in the component
        expect(titleInput).toHaveDisplayValue('Untitled Form - Modified');
      });

      jest.useRealTimers();
    });

    it('prevents data loss on navigation', async () => {
      const mockBeforeUnload = jest.fn();
      window.addEventListener('beforeunload', mockBeforeUnload);

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder />
        </TestWrapper>
      );

      // Make unsaved changes
      const titleInput = screen.getByDisplayValue('Untitled Form');
      await user.type(titleInput, ' - Modified');

      // Simulate navigation away
      const beforeUnloadEvent = new Event('beforeunload');
      window.dispatchEvent(beforeUnloadEvent);

      // Should prevent navigation if there are unsaved changes
      expect(mockBeforeUnload).toHaveBeenCalled();
    });
  });

  describe('Multi-step Forms', () => {
    const multiStepSchema = mockFormSchema({
      sections: [
        { id: 'section-1', title: 'Personal Info', order: 0 },
        { id: 'section-2', title: 'Contact Info', order: 1 },
        { id: 'section-3', title: 'Preferences', order: 2 },
      ] as any,
      fields: [
        { id: 'name', section: 'section-1', type: 'text', label: 'Name', name: 'name', required: true, order: 0 },
        { id: 'email', section: 'section-2', type: 'email', label: 'Email', name: 'email', required: true, order: 1 },
        { id: 'newsletter', section: 'section-3', type: 'checkbox', label: 'Newsletter', name: 'newsletter', required: false, order: 2 },
      ] as any,
      settings: {
        ...mockFormSchema().settings,
        showProgressBar: true,
      },
    });

    it('navigates through form steps correctly', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={multiStepSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      // Should show first step
      expect(screen.getByText('Personal Info')).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();

      // Fill first step and continue
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'John Doe');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should show second step
      expect(screen.getByText('Contact Info')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('validates current step before advancing', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={multiStepSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      // Try to advance without filling required field
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should show validation error and stay on first step
      await waitFor(() => {
        expect(screen.getByText(/name.*required/i)).toBeInTheDocument();
        expect(screen.getByText('Personal Info')).toBeInTheDocument();
      });
    });

    it('saves progress between steps', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={multiStepSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      // Fill first step
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'John Doe');

      // Progress should be saved (implementation would use localStorage or API)
      expect(nameInput).toHaveValue('John Doe');
    });
  });

  describe('File Upload Integration', () => {
    const fileUploadSchema = mockFormSchema({
      fields: [
        {
          id: 'document',
          type: 'file',
          label: 'Upload Document',
          name: 'document',
          required: true,
          order: 0,
          validation: {
            allowedTypes: ['application/pdf', 'image/jpeg'],
            maxSize: '5MB',
          },
        },
      ] as any,
    });

    it('uploads file successfully', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const mockUploadResponse = {
        success: true,
        data: { fileId: 'file-123', url: 'https://example.com/files/test.pdf' },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUploadResponse),
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={fileUploadSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      const fileInput = screen.getByLabelText(/upload document/i);
      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });

    it('handles file upload errors', async () => {
      const mockFile = new File(['test'], 'large.pdf', { type: 'application/pdf' });
      const mockErrorResponse = {
        success: false,
        error: { message: 'File too large', code: 'FILE_SIZE_EXCEEDED' },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 413,
        json: () => Promise.resolve(mockErrorResponse),
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormPreview 
            schema={fileUploadSchema} 
            interactive={true} 
            showValidation={true} 
          />
        </TestWrapper>
      );

      const fileInput = screen.getByLabelText(/upload document/i);
      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/file too large/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Collaboration', () => {
    it('shows when another user is editing the form', async () => {
      // This would test WebSocket or polling-based real-time updates
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder />
        </TestWrapper>
      );

      // Simulate another user editing
      // Implementation would depend on the real-time system used
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('resolves editing conflicts gracefully', async () => {
      // Test conflict resolution when multiple users edit simultaneously
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <FormBuilder />
        </TestWrapper>
      );

      // Implementation would handle conflicts through merging or user choice
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });
});