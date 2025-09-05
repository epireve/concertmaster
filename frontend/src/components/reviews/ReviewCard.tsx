/**
 * ReviewCard Component
 * Displays individual review information in a card format
 */

import React from 'react';
import { 
  Calendar, 
  User, 
  Clock, 
  Star, 
  Edit3, 
  Trash2, 
  UserPlus, 
  CheckCircle, 
  XCircle,
  Eye,
  AlertCircle 
} from 'lucide-react';
import { 
  Review, 
  ReviewStatus, 
  ReviewPriority,
  PRIORITY_COLORS, 
  STATUS_COLORS, 
  REVIEW_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS
} from '../../types/reviews';

interface ReviewCardProps {
  review: Review;
  onEdit?: (review: Review) => void;
  onDelete?: (review: Review) => void;
  onAssign?: (review: Review) => void;
  onApprove?: (review: Review) => void;
  onReject?: (review: Review) => void;
  onView?: (review: Review) => void;
  compact?: boolean;
  showActions?: boolean;
  className?: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  onEdit,
  onDelete,
  onAssign,
  onApprove,
  onReject,
  onView,
  compact = false,
  showActions = true,
  className = ''
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityIcon = (priority: ReviewPriority) => {
    switch (priority) {
      case ReviewPriority.CRITICAL:
        return <AlertCircle className="h-4 w-4" />;
      case ReviewPriority.HIGH:
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const renderRating = (rating?: number) => {
    if (rating === undefined) return null;
    
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating 
                ? 'text-yellow-400 fill-current' 
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-sm text-gray-600 ml-1">({rating.toFixed(1)})</span>
      </div>
    );
  };

  const canApprove = review.status === ReviewStatus.IN_PROGRESS || review.status === ReviewStatus.COMPLETED;
  const canReject = review.status === ReviewStatus.IN_PROGRESS || review.status === ReviewStatus.COMPLETED;
  const canAssign = review.status === ReviewStatus.PENDING || !review.assigned_to;

  return (
    <div className={`
      bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200
      ${compact ? 'p-4' : 'p-6'}
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h3 
              className={`font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600 ${
                compact ? 'text-sm' : 'text-lg'
              }`}
              onClick={() => onView?.(review)}
              title={review.title}
            >
              {review.title}
            </h3>
            {review.is_overdue && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Overdue
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[review.status]}`}>
              {STATUS_LABELS[review.status]}
            </span>
            
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[review.priority]}`}>
              <span className="mr-1">{getPriorityIcon(review.priority)}</span>
              {PRIORITY_LABELS[review.priority]}
            </span>
            
            <span className="text-gray-500">
              {REVIEW_TYPE_LABELS[review.review_type]}
            </span>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center space-x-1 ml-4">
            {onView && (
              <button
                onClick={() => onView(review)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            
            {onEdit && (
              <button
                onClick={() => onEdit(review)}
                className="p-1 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50"
                title="Edit Review"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}
            
            {onAssign && canAssign && (
              <button
                onClick={() => onAssign(review)}
                className="p-1 text-gray-400 hover:text-green-600 rounded-full hover:bg-green-50"
                title="Assign Review"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}
            
            {onApprove && canApprove && (
              <button
                onClick={() => onApprove(review)}
                className="p-1 text-gray-400 hover:text-green-600 rounded-full hover:bg-green-50"
                title="Approve Review"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
            
            {onReject && canReject && (
              <button
                onClick={() => onReject(review)}
                className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                title="Reject Review"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
            
            {onDelete && (
              <button
                onClick={() => onDelete(review)}
                className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                title="Delete Review"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {!compact && review.description && (
        <p className="text-gray-700 text-sm mb-4 line-clamp-2">
          {review.description}
        </p>
      )}

      {/* Rating */}
      {review.rating && (
        <div className="mb-4">
          {renderRating(review.rating)}
        </div>
      )}

      {/* Metadata */}
      <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-2'} gap-4 text-sm text-gray-500`}>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Created by: {review.created_by}</span>
          </div>
          
          {review.assigned_to && (
            <div className="flex items-center space-x-2">
              <UserPlus className="h-4 w-4" />
              <span>Assigned to: {review.assigned_to}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Created: {formatDate(review.created_at)}</span>
          </div>
          
          {review.due_date && (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span className={review.is_overdue ? 'text-red-600' : ''}>
                Due: {formatDate(review.due_date)}
              </span>
            </div>
          )}
          
          {review.completed_at && (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Completed: {formatDateTime(review.completed_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Comments Preview */}
      {!compact && review.comments && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-700 line-clamp-2">
            <span className="font-medium">Comments:</span> {review.comments}
          </p>
        </div>
      )}

      {/* Form/Workflow Links */}
      {(!compact && (review.form_id || review.workflow_id)) && (
        <div className="mt-4 flex items-center space-x-4 text-sm">
          {review.form_id && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Form: {review.form_id.substring(0, 8)}...
            </span>
          )}
          
          {review.workflow_id && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
              Workflow: {review.workflow_id.substring(0, 8)}...
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewCard;