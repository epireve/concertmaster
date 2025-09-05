import React, { useState, useCallback, useEffect } from 'react';
import { ReviewFormProps, ReviewFormData, ReviewFormValidation, ReviewTarget } from '../../types/review';
import { Button, Input, Textarea, Select, FileUpload } from '../shared';
import { RatingSystem, useRating } from './RatingSystem';

const TARGET_TYPE_OPTIONS = [
  { value: 'form', label: 'Form' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'template', label: 'Template' },
  { value: 'component', label: 'Component' },
  { value: 'system', label: 'System' }
];

const COMMON_TAGS = [
  'user-friendly',
  'intuitive',
  'complex',
  'fast',
  'slow',
  'reliable',
  'buggy',
  'helpful',
  'confusing',
  'well-designed',
  'needs-improvement',
  'excellent',
  'poor-documentation',
  'feature-rich',
  'basic'
];

export const ReviewForm: React.FC<ReviewFormProps> = ({
  review,
  targetType,
  targetId,
  template,
  onSubmit,
  onCancel,
  loading = false,
  disabled = false
}) => {
  // Form state
  const [formData, setFormData] = useState<ReviewFormData>({
    title: review?.title || '',
    content: review?.content || '',
    rating: review?.rating || 0,
    tags: review?.tags || [],
    targetType: targetType || review?.target.type || 'form',
    targetId: targetId || review?.target.id || '',
    attachments: [],
    anonymous: false
  });

  const [validation, setValidation] = useState<ReviewFormValidation>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [customTag, setCustomTag] = useState('');
  
  // Rating hook
  const { rating, updateRating, isModified: isRatingModified } = useRating(formData.rating);

  // Update rating in form data when rating changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, rating }));
    setIsDirty(true);
  }, [rating]);

  // Initialize form with template if provided
  useEffect(() => {
    if (template && !review) {
      setFormData(prev => ({
        ...prev,
        targetType: template.targetType,
        tags: template.suggestedTags?.slice(0, 3) || []
      }));
    }
  }, [template, review]);

  // Validation
  const validateForm = useCallback((): ReviewFormValidation => {
    const errors: ReviewFormValidation = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length < 5) {
      errors.title = 'Title must be at least 5 characters';
    } else if (formData.title.length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }

    if (!formData.content.trim()) {
      errors.content = 'Review content is required';
    } else if (formData.content.length < 20) {
      errors.content = 'Review must be at least 20 characters';
    } else if (formData.content.length > 2000) {
      errors.content = 'Review must be less than 2000 characters';
    }

    if (formData.rating === 0) {
      errors.rating = 'Please provide a rating';
    } else if (formData.rating < 1 || formData.rating > 5) {
      errors.rating = 'Rating must be between 1 and 5 stars';
    }

    if (!formData.targetId.trim()) {
      errors.targetId = 'Target ID is required';
    }

    return errors;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    setValidation(errors);

    if (Object.keys(errors).length === 0) {
      onSubmit(formData);
    }
  }, [formData, validateForm, onSubmit]);

  // Handle field changes
  const handleFieldChange = useCallback((field: keyof ReviewFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    
    // Clear validation error for this field
    if (validation[field as keyof ReviewFormValidation]) {
      setValidation(prev => ({ ...prev, [field]: undefined }));
    }
  }, [validation]);

  // Handle tag management
  const handleTagToggle = useCallback((tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
    setIsDirty(true);
  }, []);

  const handleAddCustomTag = useCallback(() => {
    if (customTag.trim() && !formData.tags.includes(customTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, customTag.trim()]
      }));
      setCustomTag('');
      setShowTagInput(false);
      setIsDirty(true);
    }
  }, [customTag, formData.tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
    setIsDirty(true);
  }, []);

  // Handle file uploads
  const handleFileUpload = useCallback((files: File[]) => {
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
    setIsDirty(true);
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
    setIsDirty(true);
  }, []);

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {review ? 'Edit Review' : 'Write a Review'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Share your experience to help others make informed decisions
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Target Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What are you reviewing?
            </label>
            <Select
              options={TARGET_TYPE_OPTIONS}
              value={formData.targetType}
              onChange={(value) => handleFieldChange('targetType', value)}
              disabled={disabled || !!targetType}
              placeholder="Select target type"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target ID
            </label>
            <Input
              type="text"
              value={formData.targetId}
              onChange={(e) => handleFieldChange('targetId', e.target.value)}
              placeholder="Enter target ID"
              disabled={disabled || !!targetId}
              error={validation.targetId}
            />
          </div>
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Rating *
          </label>
          <div className="flex items-center space-x-4">
            <RatingSystem
              value={rating}
              size="lg"
              interactive={!disabled}
              onChange={updateRating}
              disabled={disabled}
            />
            <span className="text-sm text-gray-500">
              Click to rate
            </span>
          </div>
          {validation.rating && (
            <p className="mt-1 text-sm text-red-600">{validation.rating}</p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Review Title *
          </label>
          <Input
            type="text"
            value={formData.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Summarize your review in a few words"
            disabled={disabled}
            error={validation.title}
            maxLength={100}
          />
          <p className="mt-1 text-xs text-gray-500">
            {formData.title.length}/100 characters
          </p>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Detailed Review *
          </label>
          <Textarea
            value={formData.content}
            onChange={(e) => handleFieldChange('content', e.target.value)}
            placeholder="Share your detailed experience..."
            rows={6}
            disabled={disabled}
            error={validation.content}
            maxLength={2000}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">
              {formData.content.length}/2000 characters
            </p>
            <p className="text-xs text-gray-500">
              Minimum 20 characters required
            </p>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (Optional)
          </label>
          <div className="space-y-3">
            {/* Selected Tags */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:text-blue-600 focus:outline-none focus:text-blue-600"
                      >
                        <span className="sr-only">Remove {tag} tag</span>
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Common Tags */}
            {!disabled && (
              <div>
                <p className="text-xs text-gray-600 mb-2">Popular tags:</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_TAGS.filter(tag => !formData.tags.includes(tag)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Tag Input */}
            {!disabled && (
              <div>
                {showTagInput ? (
                  <div className="flex items-center space-x-2">
                    <Input
                      type="text"
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      placeholder="Enter custom tag"
                      className="flex-1"
                      maxLength={20}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomTag();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleAddCustomTag}
                      disabled={!customTag.trim()}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowTagInput(false);
                        setCustomTag('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTagInput(true)}
                    className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
                  >
                    + Add custom tag
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Attachments */}
        {!disabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments (Optional)
            </label>
            <FileUpload
              accept="image/*,video/*,.pdf,.doc,.docx"
              maxSize={10 * 1024 * 1024} // 10MB
              maxFiles={5}
              onChange={(uploadFiles) => {
                const files = uploadFiles.map(uf => uf.file);
                handleFileUpload(files);
              }}
              multiple
            />
            {formData.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{file.name}</span>
                      <span className="text-xs text-gray-400">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Options */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.anonymous}
              onChange={(e) => handleFieldChange('anonymous', e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Submit anonymously
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {isDirty && '* You have unsaved changes'}
          </div>
          <div className="flex items-center space-x-3">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={disabled || !isDirty}
            >
              {review ? 'Update Review' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};