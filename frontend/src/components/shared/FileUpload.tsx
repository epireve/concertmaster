import React, { useRef, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { Upload, X, FileText, Image, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error' | 'pending';
  error?: string;
  url?: string;
}

interface FileUploadProps {
  label?: string;
  description?: string;
  error?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  disabled?: boolean;
  value?: UploadFile[];
  onChange?: (files: UploadFile[]) => void;
  onUpload?: (file: File) => Promise<{ url: string } | { error: string }>;
  className?: string;
  showPreview?: boolean;
  dragDropArea?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  description,
  error,
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = multiple ? 10 : 1,
  disabled = false,
  value = [],
  onChange,
  onUpload,
  className,
  showPreview = true,
  dragDropArea = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // Removed unused uploadId variable

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File size must be less than ${formatFileSize(maxSize)}`;
    }
    
    if (accept) {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        return file.type.match(type.replace('*', '.*'));
      });
      
      if (!isValidType) {
        return `File type not supported. Accepted types: ${accept}`;
      }
    }
    
    return null;
  };

  const createUploadFile = (file: File): UploadFile => {
    const validation = validateFile(file);
    return {
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: validation ? 'error' : 'pending',
      error: validation || undefined,
    };
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxFiles - value.length;
    const filesToProcess = fileArray.slice(0, remainingSlots);
    
    const newUploadFiles = filesToProcess.map(createUploadFile);
    const updatedFiles = [...value, ...newUploadFiles];
    onChange?.(updatedFiles);

    // Start uploads for valid files
    if (onUpload) {
      for (const uploadFile of newUploadFiles) {
        if (uploadFile.status === 'pending') {
          await processUpload(uploadFile, updatedFiles);
        }
      }
    }
  }, [value, onChange, onUpload, maxFiles]);

  const processUpload = async (uploadFile: UploadFile, currentFiles: UploadFile[]) => {
    const updateFileStatus = (updates: Partial<UploadFile>) => {
      const updated = currentFiles.map(f => 
        f.id === uploadFile.id ? { ...f, ...updates } : f
      );
      onChange?.(updated);
      currentFiles = updated; // Update reference for subsequent calls
    };

    try {
      updateFileStatus({ status: 'uploading', progress: 0 });
      
      // Simulate progress (replace with actual upload progress if available)
      const progressInterval = setInterval(() => {
        const currentFile = currentFiles.find(f => f.id === uploadFile.id);
        if (currentFile && currentFile.status === 'uploading' && currentFile.progress < 90) {
          updateFileStatus({ progress: currentFile.progress + 10 });
        }
      }, 100);

      const result = await onUpload!(uploadFile.file);
      clearInterval(progressInterval);

      if ('error' in result) {
        updateFileStatus({ 
          status: 'error', 
          error: result.error, 
          progress: 0 
        });
      } else {
        updateFileStatus({ 
          status: 'success', 
          url: result.url, 
          progress: 100 
        });
      }
    } catch (error) {
      updateFileStatus({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Upload failed',
        progress: 0
      });
    }
  };

  const removeFile = (fileId: string) => {
    const updated = value.filter(f => f.id !== fileId);
    onChange?.(updated);
  };

  const retryUpload = async (fileId: string) => {
    const fileToRetry = value.find(f => f.id === fileId);
    if (fileToRetry && onUpload) {
      await processUpload(fileToRetry, value);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const canAddMore = value.length < maxFiles;

  return (
    <div className={clsx('space-y-3', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}

      {/* Upload Area */}
      {canAddMore && dragDropArea && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFileDialog}
          className={clsx(
            'relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer',
            isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'border-red-300'
          )}
          role="button"
          tabIndex={0}
          aria-label="Upload files"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFileDialog();
            }
          }}
        >
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                Drop files here or{' '}
                <span className="text-blue-600 font-medium">browse</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {accept && `Accepted types: ${accept}`}
                {maxSize && ` • Max size: ${formatFileSize(maxSize)}`}
                {multiple && ` • Max files: ${maxFiles}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Button Upload (fallback or additional option) */}
      {(!dragDropArea || !canAddMore) && canAddMore && (
        <Button
          type="button"
          variant="outline"
          onClick={openFileDialog}
          disabled={disabled}
          leftIcon={<Upload className="w-4 h-4" />}
        >
          Choose Files
        </Button>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="sr-only"
        aria-hidden="true"
        disabled={disabled}
      />

      {/* File List */}
      {value.length > 0 && showPreview && (
        <div className="space-y-2">
          {value.map((uploadFile) => (
            <FileUploadItem
              key={uploadFile.id}
              uploadFile={uploadFile}
              onRemove={() => removeFile(uploadFile.id)}
              onRetry={() => retryUpload(uploadFile.id)}
              formatFileSize={formatFileSize}
              getFile={getFile}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      {/* File Count Info */}
      {maxFiles > 1 && (
        <p className="text-xs text-gray-500">
          {value.length} of {maxFiles} files selected
        </p>
      )}
    </div>
  );
};

// Separate component for individual file items
interface FileUploadItemProps {
  uploadFile: UploadFile;
  onRemove: () => void;
  onRetry: () => void;
  formatFileSize: (bytes: number) => string;
  getFile: (file: File) => React.ReactNode;
}

const FileUploadItem: React.FC<FileUploadItemProps> = ({
  uploadFile,
  onRemove,
  onRetry,
  formatFileSize,
  getFile,
}) => {
  const { file, progress, status, error, url } = uploadFile;

  return (
    <div className="flex items-center p-3 border border-gray-200 rounded-lg">
      <div className="flex-shrink-0 text-gray-400">
        {getFile(file)}
      </div>
      
      <div className="flex-1 ml-3 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.name}
          </p>
          <div className="flex items-center space-x-2">
            {status === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            {status === 'error' && (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <button
              onClick={onRemove}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center mt-1">
          <p className="text-xs text-gray-500">
            {formatFileSize(file.size)}
          </p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-xs text-blue-600 hover:text-blue-800"
            >
              View
            </a>
          )}
        </div>
        
        {/* Progress Bar */}
        {status === 'uploading' && (
          <div className="mt-2">
            <div className="bg-gray-200 rounded-full h-2 relative overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 relative"
                style={{ width: `${progress}%` }}
              >
                {/* Animated progress bar shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-pulse" />
              </div>
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                Uploading... {progress}%
              </p>
              <p className="text-xs text-gray-400">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
        )}
        
        {/* Error State */}
        {status === 'error' && error && (
          <div className="mt-2">
            <p className="text-xs text-red-600">{error}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRetry}
              className="mt-1 p-0 h-auto text-xs"
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
