import React from 'react';
import { 
  Clock, 
  User, 
  Calendar, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../../shared';
import type { 
  ReviewableItem, 
  ReviewFilters, 
  PaginationParams,
  ReviewStatus,
  Priority
} from '../../../types/reviews';

interface ReviewListProps {
  reviews: ReviewableItem[];
  loading: boolean;
  error: string | null;
  pagination: PaginationParams;
  filters: ReviewFilters;
  onPageChange: (page: number) => void;
  onFiltersChange: (filters: Partial<ReviewFilters>) => void;
  onViewReview?: (reviewId: string) => void;
}

const StatusIcon: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  switch (status) {
    case 'completed':
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'rejected':
    case 'archived':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'in_progress':
    case 'under_review':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
};

const StatusBadge: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const getStatusColor = (status: ReviewStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'archived': return 'bg-slate-100 text-slate-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: ReviewStatus) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'under_review': return 'Under Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'completed': return 'Completed';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  return (
    <span 
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
      role="status"
      aria-label={`Review status: ${getStatusLabel(status)}`}
    >
      <StatusIcon status={status} />
      <span className="ml-1">{getStatusLabel(status)}</span>
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'critical': return 'bg-red-200 text-red-900 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: Priority) => {
    if (priority === 'urgent' || priority === 'critical') {
      return <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />;
    }
    return null;
  };

  return (
    <span 
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(priority)}`}
      role="status"
      aria-label={`Priority level: ${priority}${priority === 'urgent' || priority === 'critical' ? ' - Requires immediate attention' : ''}`}
    >
      {getPriorityIcon(priority)}
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
};

const ReviewRow: React.FC<{ 
  review: ReviewableItem; 
  onViewReview?: (reviewId: string) => void;
}> = ({ review, onViewReview }) => {
  const isOverdue = review.dueDate && new Date(review.dueDate) < new Date();
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewReview?.(review.id);
    }
  };
  
  const handleClick = () => {
    onViewReview?.(review.id);
  };
  
  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const getTimeAgo = (date: string | Date) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer transition-colors focus-within:bg-gray-50"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View review: ${review.title}${isOverdue ? ' (Overdue)' : ''}`}
      aria-describedby={`review-${review.id}-description`}
    >
      <td className="px-6 py-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 pt-1">
            <StatusIcon status={review.status} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 truncate" id={`review-${review.id}-title`}>
                  {review.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2" id={`review-${review.id}-description`}>
                  {review.description}
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-gray-500">
                    {review.itemType.replace('_', ' ')}
                  </span>
                  <span className="text-gray-300" aria-hidden="true">•</span>
                  <span className="text-xs text-gray-500">
                    ID: {review.itemId}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap" headers="status-header">
        <StatusBadge status={review.status} />
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap" headers="priority-header">
        <PriorityBadge priority={review.priority} />
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap" headers="assignee-header">
        {review.currentAssignment ? (
          <div className="flex items-center space-x-2">
            <User className="h-3 w-3 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-900">
              {review.currentAssignment.assignedUser?.name || review.currentAssignment.assignedTo}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">Unassigned</span>
        )}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap" headers="due-date-header">
        {review.dueDate ? (
          <div className="flex items-center space-x-2">
            <Calendar className="h-3 w-3 text-gray-400" aria-hidden="true" />
            <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
              {formatDate(review.dueDate)}
            </span>
            {isOverdue && (
              <AlertTriangle className="h-3 w-3 text-red-500" aria-label="Overdue" />
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500">No due date</span>
        )}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" headers="created-header">
        <time dateTime={new Date(review.createdAt).toISOString()}>
          {getTimeAgo(review.createdAt)}
        </time>
      </td>
    </tr>
  );
};

const Pagination: React.FC<{
  pagination: PaginationParams;
  onPageChange: (page: number) => void;
}> = ({ pagination, onPageChange }) => {
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  const handleKeyDown = (e: React.KeyboardEvent, page: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPageChange(page);
    }
  };
  
  const getPageNumbers = () => {
    const pages = [];
    const showPages = 5;
    const halfShow = Math.floor(showPages / 2);
    
    let start = Math.max(1, currentPage - halfShow);
    let end = Math.min(totalPages, start + showPages - 1);
    
    if (end - start < showPages - 1) {
      start = Math.max(1, end - showPages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <nav className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6" aria-label="Reviews pagination">
      <div className="flex items-center justify-between">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!pagination.hasPrevious}
            aria-label={`Go to previous page (page ${currentPage - 1})`}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!pagination.hasNext}
            aria-label={`Go to next page (page ${currentPage + 1})`}
          >
            Next
          </Button>
        </div>
        
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700" role="status" aria-live="polite">
              Showing{' '}
              <span className="font-medium">
                {Math.min(pagination.offset + 1, pagination.total)}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(pagination.offset + pagination.limit, pagination.total)}
              </span>{' '}
              of{' '}
              <span className="font-medium">{pagination.total}</span>{' '}
              results
            </p>
          </div>
          
          <div>
            <div className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={!pagination.hasPrevious}
                className="rounded-l-md"
                aria-label={`Go to previous page (page ${currentPage - 1})`}
              >
                Previous
              </Button>
              
              {getPageNumbers().map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className="rounded-none"
                  aria-label={page === currentPage ? `Current page, page ${page}` : `Go to page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                >
                  {page}
                </Button>
              ))}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={!pagination.hasNext}
                className="rounded-r-md"
                aria-label={`Go to next page (page ${currentPage + 1})`}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export const ReviewList: React.FC<ReviewListProps> = ({
  reviews,
  loading,
  error,
  pagination,
  onPageChange,
  onViewReview
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden="true" />
          <span className="text-sm text-gray-500">Loading reviews...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64" role="alert">
        <div className="text-center">
          <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-gray-900 font-medium">Failed to load reviews</p>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="text-center">
          <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-gray-900 font-medium">No reviews found</p>
          <p className="text-xs text-gray-500 mt-1">
            Try adjusting your filters or create a new review
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Reviews list">
          <thead className="bg-gray-50">
            <tr>
              <th id="review-header" scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Review
              </th>
              <th id="status-header" scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th id="priority-header" scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th id="assignee-header" scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assignee
              </th>
              <th id="due-date-header" scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th id="created-header" scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reviews.map((review) => (
              <ReviewRow
                key={review.id}
                review={review}
                onViewReview={onViewReview}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      <Pagination
        pagination={pagination}
        onPageChange={onPageChange}
      />
    </div>
  );
};