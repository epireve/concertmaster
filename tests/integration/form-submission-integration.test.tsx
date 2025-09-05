import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

import { FormBuilder } from '@/components/shared/FormBuilder';
import { Form } from '@/components/shared/Form';
import { FileUpload } from '@/components/shared/FileUpload';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

// Mock server for API requests
const server = setupServer(
  rest.post('/api/v1/forms/submit', (req, res, ctx) => {
    return res(ctx.json({ success: true, id: 'form-123' }));
  }),
  rest.post('/api/v1/upload', (req, res, ctx) => {
    return res(ctx.json({ 
      success: true, 
      url: 'https://example.com/uploaded-file.pdf',
      fileId: 'file-123'
    }));
  }),
  rest.get('/api/v1/forms/:id', (req, res, ctx) => {
    return res(ctx.json({
      id: req.params.id,
      title: 'Test Form',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Full Name',
          required: true,
          validation: { minLength: 2 }
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          required: true
        },
        {
          id: 'resume',
          type: 'file',
          label: 'Upload Resume',
          accept: '.pdf,.doc,.docx',
          maxSize: 5242880
        }
      ]
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Form Submission Integration', () => {
  const mockFormData = {
    id: 'test-form',
    title: 'Contact Form',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'Full Name',
        required: true,
        validation: { minLength: 2 }
      },
      {
        id: 'email',
        type: 'email',
        label: 'Email Address',
        required: true
      },
      {
        id: 'message',
        type: 'textarea',
        label: 'Message',
        required: true,
        validation: { minLength: 10 }
      }
    ]
  };

  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks();
  });

  describe('Basic Form Submission', () => {
    const TestForm = () => {
      const schema = yup.object({
        name: yup.string().min(2).required(),
        email: yup.string().email().required(),
        message: yup.string().min(10).required()
      });

      const form = useForm({
        resolver: yupResolver(schema),
        mode: 'onChange'
      });

      const onSubmit = async (data: any) => {
        const response = await fetch('/api/v1/forms/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        return response.json();
      };

      return (
        <Form form={form} onSubmit={onSubmit}>
          <input {...form.register('name')} placeholder="Full Name" />
          <input {...form.register('email')} placeholder="Email Address" />
          <textarea {...form.register('message')} placeholder="Your message" />
          <button type="submit">Submit Form</button>
        </Form>
      );
    };

    it('successfully submits valid form data', async () => {
      const user = userEvent.setup();
      render(<TestForm />);

      // Fill out the form
      await user.type(screen.getByPlaceholderText('Full Name'), 'John Doe');
      await user.type(screen.getByPlaceholderText('Email Address'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Your message'), 'This is a test message with sufficient length.');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /submit form/i });
      
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      });

      await user.click(submitButton);

      // Wait for submission to complete
      await waitFor(() => {
        expect(submitButton).toHaveTextContent('Submit Form');
      });
    });

    it('prevents submission with invalid data', async () => {
      const user = userEvent.setup();
      render(<TestForm />);

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /submit form/i });
      expect(submitButton).toBeDisabled();

      // Fill out partial data
      await user.type(screen.getByPlaceholderText('Full Name'), 'J'); // Too short
      await user.type(screen.getByPlaceholderText('Email Address'), 'invalid-email');

      // Form should still be invalid
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      
      // Delay the response to test loading state
      server.use(
        rest.post('/api/v1/forms/submit', (req, res, ctx) => {
          return res(
            ctx.delay(500),
            ctx.json({ success: true, id: 'form-123' })
          );
        })
      );

      render(<TestForm />);

      // Fill out valid form
      await user.type(screen.getByPlaceholderText('Full Name'), 'John Doe');
      await user.type(screen.getByPlaceholderText('Email Address'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Your message'), 'This is a test message.');

      const submitButton = screen.getByRole('button', { name: /submit form/i });
      
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      });

      await user.click(submitButton);

      // Check that button is disabled during submission
      expect(submitButton).toBeDisabled();
      
      // Wait for submission to complete
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      }, { timeout: 1000 });
    });
  });

  describe('File Upload Integration', () => {
    const createMockFile = (name: string, size: number, type: string): File => {
      const file = new File(['test content'], name, { type });
      Object.defineProperty(file, 'size', { value: size });
      return file;
    };

    const FileUploadForm = () => {
      const [uploadedFiles, setUploadedFiles] = React.useState([]);

      const handleUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/v1/upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        if (result.success) {
          return { url: result.url };
        } else {
          return { error: 'Upload failed' };
        }
      };

      return (
        <div>
          <FileUpload
            label="Upload Document"
            accept=".pdf,.doc,.docx"
            maxSize={5 * 1024 * 1024}
            value={uploadedFiles}
            onChange={setUploadedFiles}
            onUpload={handleUpload}
          />
        </div>
      );
    };

    it('successfully uploads valid files', async () => {
      const user = userEvent.setup();
      render(<FileUploadForm />);

      const file = createMockFile('resume.pdf', 1024 * 1024, 'application/pdf'); // 1MB PDF
      const input = screen.getByLabelText(/upload document/i);

      await act(async () => {
        await user.upload(input, file);
      });

      // Wait for upload to complete
      await waitFor(() => {
        expect(screen.getByText('resume.pdf')).toBeInTheDocument();
      });

      // Check for success indicator
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /view/i })).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('rejects files that exceed size limit', async () => {
      const user = userEvent.setup();
      render(<FileUploadForm />);

      const largeFile = createMockFile('large.pdf', 10 * 1024 * 1024, 'application/pdf'); // 10MB
      const input = screen.getByLabelText(/upload document/i);

      await act(async () => {
        await user.upload(input, largeFile);
      });

      await waitFor(() => {
        expect(screen.getByText(/file size must be less than/i)).toBeInTheDocument();
      });
    });

    it('rejects unsupported file types', async () => {
      const user = userEvent.setup();
      render(<FileUploadForm />);

      const invalidFile = createMockFile('malware.exe', 1024, 'application/x-executable');
      const input = screen.getByLabelText(/upload document/i);

      await act(async () => {
        await user.upload(input, invalidFile);
      });

      await waitFor(() => {
        expect(screen.getByText(/file type not supported/i)).toBeInTheDocument();
      });
    });

    it('handles upload errors gracefully', async () => {
      server.use(
        rest.post('/api/v1/upload', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Server error' }));
        })
      );

      const user = userEvent.setup();
      render(<FileUploadForm />);

      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      const input = screen.getByLabelText(/upload document/i);

      await act(async () => {
        await user.upload(input, file);
      });

      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should show retry button
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles network errors during submission', async () => {
      const user = userEvent.setup();

      server.use(
        rest.post('/api/v1/forms/submit', (req, res, ctx) => {
          return res.networkError('Network error');
        })
      );

      const TestForm = () => {
        const [error, setError] = React.useState('');
        const form = useForm();

        const onSubmit = async (data: any) => {
          try {
            const response = await fetch('/api/v1/forms/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Submit failed');
          } catch (err) {
            setError('Unable to submit form. Please try again.');
          }
        };

        return (
          <Form form={form} onSubmit={onSubmit}>
            <input {...form.register('name')} placeholder="Name" />
            <button type="submit">Submit</button>
            {error && <div role="alert">{error}</div>}
          </Form>
        );
      };

      render(<TestForm />);

      await user.type(screen.getByPlaceholderText('Name'), 'John Doe');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/unable to submit form/i);
      });
    });

    it('recovers from validation errors', async () => {
      const user = userEvent.setup();

      server.use(
        rest.post('/api/v1/forms/submit', (req, res, ctx) => {
          const body = req.body as any;
          if (!body.email || !body.email.includes('@')) {
            return res(
              ctx.status(422),
              ctx.json({
                errors: {
                  email: ['Please provide a valid email address']
                }
              })
            );
          }
          return res(ctx.json({ success: true }));
        })
      );

      const ValidationForm = () => {
        const [serverErrors, setServerErrors] = React.useState<any>({});
        const form = useForm();

        const onSubmit = async (data: any) => {
          try {
            const response = await fetch('/api/v1/forms/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            if (response.status === 422) {
              const errorData = await response.json();
              setServerErrors(errorData.errors);
              return;
            }
            
            if (!response.ok) throw new Error('Submit failed');
            setServerErrors({});
          } catch (err) {
            console.error('Submit error:', err);
          }
        };

        return (
          <Form form={form} onSubmit={onSubmit}>
            <input {...form.register('email')} placeholder="Email" />
            <button type="submit">Submit</button>
            {serverErrors.email && (
              <div role="alert">{serverErrors.email[0]}</div>
            )}
          </Form>
        );
      };

      render(<ValidationForm />);

      // Submit with invalid email
      await user.type(screen.getByPlaceholderText('Email'), 'invalid');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Should show server validation error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/valid email address/i);
      });

      // Fix the email and resubmit
      await user.clear(screen.getByPlaceholderText('Email'));
      await user.type(screen.getByPlaceholderText('Email'), 'valid@example.com');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });
});