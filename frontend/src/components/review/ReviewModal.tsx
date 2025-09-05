import React, { useState, useCallback } from 'react';
import { ReviewModalProps } from '../../types/review';
import { Modal } from '../shared';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';

export const ReviewModal: React.FC<ReviewModalProps> = ({
  review,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onVote,
  onReport
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(false);

  // Handle edit mode
  const handleEdit = useCallback(() => {
    if (review && onEdit) {
      setMode('edit');
    }
  }, [review, onEdit]);

  // Handle save after editing
  const handleSave = useCallback(async (formData: any) => {
    if (!review || !onEdit) return;
    
    setLoading(true);
    try {
      await onEdit(review);
      setMode('view');
    } finally {
      setLoading(false);
    }
  }, [review, onEdit]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setMode('view');
  }, []);

  // Handle delete with confirmation
  const handleDelete = useCallback(async () => {
    if (!review || !onDelete) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this review? This action cannot be undone.'
    );
    
    if (confirmed) {
      setLoading(true);
      try {
        await onDelete(review.id);
        onClose();
      } finally {
        setLoading(false);
      }
    }
  }, [review, onDelete, onClose]);

  // Handle vote
  const handleVote = useCallback(async (reviewId: string, helpful: boolean) => {
    if (!onVote) return;
    
    setLoading(true);
    try {
      await onVote(reviewId, helpful);
    } finally {
      setLoading(false);
    }
  }, [onVote]);

  // Handle report
  const handleReport = useCallback(async (reviewId: string) => {
    if (!onReport) return;
    
    const reason = window.prompt(
      'Please provide a reason for reporting this review:'
    );
    
    if (reason) {
      setLoading(true);
      try {
        await onReport(reviewId);
        alert('Thank you for your report. We will review it shortly.');
      } finally {
        setLoading(false);
      }
    }
  }, [onReport]);

  if (!review) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Review' : 'Review Details'}
      size="xl"
    >
      <div className="max-h-[80vh] overflow-y-auto">
        {mode === 'view' ? (
          <div className="space-y-6">
            {/* Review Card */}
            <ReviewCard
              review={review}
              showActions={true}
              compact={false}
              onVote={handleVote}
              onReport={handleReport}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />

            {/* Additional Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>Review ID:</span>
                <code className="px-2 py-1 bg-gray-100 rounded font-mono text-xs">
                  {review.id}
                </code>
              </div>
              
              <div className="flex items-center space-x-2">
                {onEdit && (
                  <button
                    onClick={handleEdit}
                    disabled={loading}
                    className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                  >
                    Edit Review
                  </button>
                )}
                
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  >
                    Delete Review
                  </button>
                )}
              </div>
            </div>

            {/* Review Metadata */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Review Metadata
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Device Type:</span>
                  <span className="ml-2 capitalize">{review.metadata.deviceType}</span>
                </div>
                <div>
                  <span className="text-gray-600">Language:</span>
                  <span className="ml-2 uppercase">{review.metadata.language}</span>
                </div>
                {review.metadata.location && (
                  <div>
                    <span className="text-gray-600">Location:</span>
                    <span className="ml-2">
                      {review.metadata.location.city}, {review.metadata.location.country}
                    </span>
                  </div>
                )}
                {review.metadata.source && (
                  <div>
                    <span className="text-gray-600">Source:</span>
                    <span className="ml-2 capitalize">{review.metadata.source}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Helpful Votes:</span>
                  <span className="ml-2">{review.metadata.helpful}</span>
                </div>
                <div>
                  <span className="text-gray-600">Reports:</span>
                  <span className="ml-2">{review.metadata.reports}</span>
                </div>
              </div>
            </div>

            {/* Review History */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Review History
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span>{review.createdAt.toLocaleString()}</span>
                </div>
                {review.updatedAt.getTime() !== review.createdAt.getTime() && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span>{review.updatedAt.toLocaleString()}</span>
                  </div>
                )}
                {review.publishedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Published:</span>
                    <span>{review.publishedAt.toLocaleString()}</span>
                  </div>
                )}
                {review.moderatedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Moderated:</span>
                    <span>{review.moderatedAt.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Edit Mode */
          <ReviewForm
            review={review}
            onSubmit={handleSave}
            onCancel={handleCancelEdit}
            loading={loading}
          />
        )}
      </div>
    </Modal>
  );
};

// Specialized modals for different use cases
export const ReviewReportModal: React.FC<{
  review: any;
  isOpen: boolean;
  onClose: () => void;
  onReport: (reviewId: string, reason: string, details?: string) => void;
}> = ({ review, isOpen, onClose, onReport }) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const reportReasons = [
    'Spam or promotional content',
    'Inappropriate language',
    'False or misleading information',
    'Harassment or abuse',
    'Copyright violation',
    'Off-topic content',
    'Other'
  ];

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setLoading(true);
    try {
      await onReport(review.id, reason, details);
      onClose();
      setReason('');
      setDetails('');
    } finally {
      setLoading(false);
    }
  }, [reason, details, review?.id, onReport, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report Review"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Why are you reporting this review? *
          </label>
          <div className="space-y-2">
            {reportReasons.map((reportReason) => (
              <label key={reportReason} className="flex items-center">
                <input
                  type="radio"
                  name="reason"
                  value={reportReason}
                  checked={reason === reportReason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">{reportReason}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional details (optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Please provide any additional context..."
            maxLength={500}
          />
          <p className="text-xs text-gray-500 mt-1">
            {details.length}/500 characters
          </p>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reason || loading}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Reporting...' : 'Submit Report'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const ReviewDeleteModal: React.FC<{
  review: any;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (reviewId: string) => void;
}> = ({ review, isOpen, onClose, onDelete }) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = useCallback(async () => {
    setLoading(true);
    try {
      await onDelete(review.id);
      onClose();
    } finally {
      setLoading(false);
    }
  }, [review?.id, onDelete, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Review"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">
              Are you sure you want to delete this review?
            </h3>
            <p className="text-sm text-red-700 mt-1">
              This action cannot be undone. The review and all associated data will be permanently removed.
            </p>
          </div>
        </div>

        {review && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900 mb-1">
              {review.title}
            </p>
            <p className="text-sm text-gray-600 truncate">
              {review.content.substring(0, 100)}...
            </p>
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete Review'}
          </button>
        </div>
      </div>
    </Modal>
  );
};