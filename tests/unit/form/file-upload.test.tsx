import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FileUpload, UploadFile } from '@/components/shared/FileUpload';

// Mock file for testing
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('FileUpload Component', () => {
  const mockOnChange = jest.fn();
  const mockOnUpload = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<FileUpload />);
      
      expect(screen.getByText(/drop files here or/i)).toBeInTheDocument();
      expect(screen.getByText(/browse/i)).toBeInTheDocument();
    });

    it('renders with custom label and description', () => {
      render(
        <FileUpload 
          label="Upload Documents" 
          description="Select PDF files only" 
        />
      );

      expect(screen.getByText('Upload Documents')).toBeInTheDocument();
      expect(screen.getByText('Select PDF files only')).toBeInTheDocument();
    });

    it('shows accepted file types when specified', () => {
      render(<FileUpload accept=".pdf,.doc,.docx" />);
      
      expect(screen.getByText(/accepted types: \.pdf,\.doc,\.docx/i)).toBeInTheDocument();
    });

    it('shows max file size when specified', () => {
      render(<FileUpload maxSize={5 * 1024 * 1024} />);
      
      expect(screen.getByText(/max size: 5 mb/i)).toBeInTheDocument();
    });

    it('shows max files count for multiple uploads', () => {
      render(<FileUpload multiple maxFiles={3} />);
      
      expect(screen.getByText(/max files: 3/i)).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('handles file selection through input', async () => {
      const user = userEvent.setup();
      const file = createMockFile('test.pdf', 1024, 'application/pdf');

      render(<FileUpload onChange={mockOnChange} />);

      const input = screen.getByLabelText(/upload files/i);
      await user.upload(input, file);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              file,
              status: 'pending'
            })
          ])
        );
      });
    });

    it('handles multiple file selection', async () => {
      const user = userEvent.setup();
      const files = [
        createMockFile('test1.pdf', 1024, 'application/pdf'),
        createMockFile('test2.pdf', 2048, 'application/pdf')
      ];

      render(<FileUpload multiple onChange={mockOnChange} />);

      const input = screen.getByLabelText(/upload files/i);
      await user.upload(input, files);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ file: files[0] }),
            expect.objectContaining({ file: files[1] })
          ])
        );
      });
    });

    it('respects maxFiles limit', async () => {
      const user = userEvent.setup();
      const files = [
        createMockFile('test1.pdf', 1024, 'application/pdf'),
        createMockFile('test2.pdf', 1024, 'application/pdf'),
        createMockFile('test3.pdf', 1024, 'application/pdf')
      ];

      render(<FileUpload multiple maxFiles={2} onChange={mockOnChange} />);

      const input = screen.getByLabelText(/upload files/i);
      await user.upload(input, files);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ file: files[0] }),
            expect.objectContaining({ file: files[1] })
          ])
        );
      });

      // Should only upload first 2 files
      const call = mockOnChange.mock.calls[0][0];
      expect(call).toHaveLength(2);
    });
  });

  describe('File Validation', () => {
    it('validates file size', async () => {
      const user = userEvent.setup();
      const largeFile = createMockFile('large.pdf', 50 * 1024 * 1024, 'application/pdf'); // 50MB

      render(<FileUpload maxSize={10 * 1024 * 1024} onChange={mockOnChange} />);

      const input = screen.getByLabelText(/upload files/i);
      await user.upload(input, largeFile);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              status: 'error',
              error: expect.stringContaining('File size must be less than')
            })
          ])
        );
      });
    });

    it('validates file types', async () => {
      const user = userEvent.setup();
      const invalidFile = createMockFile('test.exe', 1024, 'application/x-executable');

      render(<FileUpload accept=".pdf,.doc" onChange={mockOnChange} />);

      const input = screen.getByLabelText(/upload files/i);
      await user.upload(input, invalidFile);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              status: 'error',
              error: expect.stringContaining('File type not supported')
            })
          ])
        );
      });
    });
  });

  describe('Drag and Drop', () => {
    it('handles drag and drop events', async () => {
      const file = createMockFile('test.pdf', 1024, 'application/pdf');

      render(<FileUpload onChange={mockOnChange} />);

      const dropZone = screen.getByRole('button', { name: /upload files/i });

      // Simulate drag over
      fireEvent.dragOver(dropZone);
      expect(dropZone).toHaveClass('border-blue-400', 'bg-blue-50');

      // Simulate drop
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ file })
          ])
        );
      });
    });

    it('resets drag state on drag leave', () => {
      render(<FileUpload />);

      const dropZone = screen.getByRole('button', { name: /upload files/i });

      fireEvent.dragOver(dropZone);
      expect(dropZone).toHaveClass('border-blue-400');

      fireEvent.dragLeave(dropZone);
      expect(dropZone).not.toHaveClass('border-blue-400');
    });

    it('ignores drag events when disabled', () => {
      const file = createMockFile('test.pdf', 1024, 'application/pdf');

      render(<FileUpload disabled onChange={mockOnChange} />);

      const dropZone = screen.getByRole('button', { name: /upload files/i });

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      });

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('File Upload Process', () => {
    it('uploads file successfully', async () => {
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      mockOnUpload.mockResolvedValue({ url: 'https://example.com/test.pdf' });

      render(<FileUpload onUpload={mockOnUpload} onChange={mockOnChange} />);

      const input = screen.getByLabelText(/upload files/i);
      await act(async () => {
        await fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file);
      });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenLastCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              status: 'success',
              url: 'https://example.com/test.pdf'
            })
          ])
        );
      }, { timeout: 3000 });
    });

    it('handles upload errors', async () => {
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      mockOnUpload.mockResolvedValue({ error: 'Upload failed' });

      render(<FileUpload onUpload={mockOnUpload} onChange={mockOnChange} />);

      const input = screen.getByLabelText(/upload files/i);
      await act(async () => {
        await fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenLastCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              status: 'error',
              error: 'Upload failed'
            })
          ])
        );
      }, { timeout: 3000 });
    });

    it('shows upload progress', async () => {
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      
      // Mock upload with delay
      mockOnUpload.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ url: 'test.pdf' }), 1000))
      );

      render(<FileUpload onUpload={mockOnUpload} onChange={mockOnChange} />);

      const input = screen.getByLabelText(/upload files/i);
      await act(async () => {
        await fireEvent.change(input, { target: { files: [file] } });
      });

      // Should show uploading status
      await waitFor(() => {
        expect(screen.getByText(/uploading\.\.\./i)).toBeInTheDocument();
      });
    });
  });

  describe('File List Display', () => {
    const mockFiles: UploadFile[] = [
      {
        id: '1',
        file: createMockFile('test1.pdf', 1024, 'application/pdf'),
        progress: 100,
        status: 'success',
        url: 'https://example.com/test1.pdf'
      },
      {
        id: '2',
        file: createMockFile('test2.pdf', 2048, 'application/pdf'),
        progress: 50,
        status: 'uploading'
      },
      {
        id: '3',
        file: createMockFile('test3.pdf', 512, 'application/pdf'),
        progress: 0,
        status: 'error',
        error: 'Upload failed'
      }
    ];

    it('displays uploaded files when showPreview is true', () => {
      render(<FileUpload value={mockFiles} showPreview />);

      expect(screen.getByText('test1.pdf')).toBeInTheDocument();
      expect(screen.getByText('test2.pdf')).toBeInTheDocument();
      expect(screen.getByText('test3.pdf')).toBeInTheDocument();
    });

    it('hides file list when showPreview is false', () => {
      render(<FileUpload value={mockFiles} showPreview={false} />);

      expect(screen.queryByText('test1.pdf')).not.toBeInTheDocument();
    });

    it('shows success indicator for completed uploads', () => {
      render(<FileUpload value={mockFiles} showPreview />);

      const successFile = screen.getByText('test1.pdf').closest('div');
      expect(successFile?.querySelector('[data-testid="CheckCircle2Icon"]')).toBeInTheDocument();
    });

    it('shows error indicator for failed uploads', () => {
      render(<FileUpload value={mockFiles} showPreview />);

      const errorFile = screen.getByText('test3.pdf').closest('div');
      expect(errorFile?.querySelector('[data-testid="AlertCircleIcon"]')).toBeInTheDocument();
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });

    it('shows progress bar for uploading files', () => {
      render(<FileUpload value={mockFiles} showPreview />);

      expect(screen.getByText(/uploading\.\.\. 50%/i)).toBeInTheDocument();
    });

    it('provides retry button for failed uploads', async () => {
      const user = userEvent.setup();
      const mockRetry = jest.fn();

      render(<FileUpload value={mockFiles} onUpload={mockRetry} showPreview />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRetry).toHaveBeenCalledWith(mockFiles[2].file);
    });
  });

  describe('File Operations', () => {
    it('removes files when remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockFiles: UploadFile[] = [
        {
          id: '1',
          file: createMockFile('test.pdf', 1024, 'application/pdf'),
          progress: 100,
          status: 'success'
        }
      ];

      render(<FileUpload value={mockFiles} onChange={mockOnChange} showPreview />);

      const removeButton = screen.getByRole('button', { name: /remove file/i });
      await user.click(removeButton);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });

    it('shows file count when maxFiles > 1', () => {
      const mockFiles: UploadFile[] = [
        {
          id: '1',
          file: createMockFile('test.pdf', 1024, 'application/pdf'),
          progress: 100,
          status: 'success'
        }
      ];

      render(<FileUpload value={mockFiles} maxFiles={3} />);

      expect(screen.getByText('1 of 3 files selected')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<FileUpload />);

      const dropZone = screen.getByRole('button', { name: /upload files/i });
      
      // Should be focusable
      await user.tab();
      expect(dropZone).toHaveFocus();

      // Should respond to Enter key
      const input = screen.getByLabelText(/upload files/i);
      const clickSpy = jest.spyOn(input, 'click');
      
      await user.keyboard('{Enter}');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('provides appropriate ARIA labels', () => {
      render(<FileUpload />);

      expect(screen.getByLabelText(/upload files/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload files/i })).toBeInTheDocument();
    });

    it('shows error messages with proper roles', () => {
      render(<FileUpload error="Something went wrong" />);

      const errorElement = screen.getByText('Something went wrong');
      expect(errorElement).toHaveAttribute('role', 'alert');
    });
  });

  describe('Error Handling', () => {
    it('displays validation errors', () => {
      render(<FileUpload error="File upload is required" />);

      expect(screen.getByText('File upload is required')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('handles disabled state', () => {
      render(<FileUpload disabled />);

      const dropZone = screen.getByRole('button', { name: /upload files/i });
      expect(dropZone).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('handles missing file input gracefully', () => {
      render(<FileUpload dragDropArea={false} />);

      expect(screen.getByRole('button', { name: /choose files/i })).toBeInTheDocument();
    });
  });

  describe('File Size Formatting', () => {
    it('formats file sizes correctly', () => {
      const mockFiles: UploadFile[] = [
        {
          id: '1',
          file: createMockFile('small.txt', 512, 'text/plain'),
          progress: 100,
          status: 'success'
        },
        {
          id: '2',
          file: createMockFile('medium.pdf', 1024 * 1024, 'application/pdf'),
          progress: 100,
          status: 'success'
        },
        {
          id: '3',
          file: createMockFile('large.zip', 5 * 1024 * 1024, 'application/zip'),
          progress: 100,
          status: 'success'
        }
      ];

      render(<FileUpload value={mockFiles} showPreview />);

      expect(screen.getByText('512 Bytes')).toBeInTheDocument();
      expect(screen.getByText('1 MB')).toBeInTheDocument();
      expect(screen.getByText('5 MB')).toBeInTheDocument();
    });
  });
});