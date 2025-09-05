import React, { useState, useCallback } from 'react';
import { ReviewListProps, ReviewAction } from '../../types/review';
import { ReviewCard } from './ReviewCard';
import { Button, LoadingSpinner } from '../shared';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  hasNext,
  hasPrevious,
  onPageChange
}) => {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = ((page - 1) * pageSize) + 1;
  const endItem = Math.min(page * pageSize, total);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];

    // Calculate the range of page numbers to show
    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      range.push(i);
    }

    // Add first page
    if (page - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    // Add middle pages
    rangeWithDots.push(...range);

    // Add last page
    if (page + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const pageNumbers = totalPages > 1 ? getPageNumbers() : [];

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      {/* Mobile pagination */}
      <div className="flex flex-1 justify-between sm:hidden">
        <Button
          variant="ghost"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevious}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
        >
          Next
        </Button>
      </div>

      {/* Desktop pagination */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{total}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            {/* Previous button */}
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPrevious}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Page numbers */}
            {pageNumbers.map((pageNum, index) => {
              if (pageNum === '...') {
                return (
                  <span
                    key={`dots-${index}`}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0"
                  >
                    ...
                  </span>
                );
              }

              const isCurrentPage = pageNum === page;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum as number)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${
                    isCurrentPage
                      ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'text-gray-900'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next button */}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNext}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

interface ReviewListHeaderProps {
  total: number;
  loading?: boolean;
  onRefresh?: () => void;
}

const ReviewListHeader: React.FC<ReviewListHeaderProps> = ({
  total,
  loading = false,
  onRefresh
}) => (
  <div className="flex items-center justify-between p-4 border-b border-gray-200">
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Reviews
        <span className="ml-2 text-sm font-normal text-gray-500">
          ({total} total)
        </span>
      </h2>
    </div>
    {onRefresh && (
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
      >
        {loading ? <LoadingSpinner size="sm" /> : '↻'} Refresh
      </Button>
    )}
  </div>
);

export const ReviewList: React.FC<ReviewListProps> = ({
  reviews,
  loading = false,
  pagination,
  filters,
  onPageChange,
  onFiltersChange,
  onReviewAction
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Handle review actions with loading states
  const handleReviewAction = useCallback(async (action: ReviewAction) => {
    if (!onReviewAction || actionLoading) return;

    setActionLoading(action.reviewId);
    try {
      await onReviewAction(action);
    } finally {
      setActionLoading(null);
    }
  }, [onReviewAction, actionLoading]);

  // Handle individual review actions
  const handleVote = useCallback(async (reviewId: string, helpful: boolean) => {
    await handleReviewAction({
      type: helpful ? 'vote_helpful' : 'vote_not_helpful',
      reviewId,
      userId: 'current-user', // This would come from auth context
      timestamp: new Date()
    });
  }, [handleReviewAction]);

  const handleReport = useCallback(async (reviewId: string) => {
    await handleReviewAction({
      type: 'report',
      reviewId,
      userId: 'current-user',
      timestamp: new Date()
    });
  }, [handleReviewAction]);

  const handleEdit = useCallback((reviewId: string) => {
    // Navigate to edit form or open modal
    console.log('Edit review:', reviewId);
  }, []);

  const handleDelete = useCallback(async (reviewId: string) => {
    if (confirm('Are you sure you want to delete this review?')) {
      // Handle delete action
      console.log('Delete review:', reviewId);
    }
  }, []);

  const handleReply = useCallback((reviewId: string) => {
    // Open reply modal or navigate to reply form
    console.log('Reply to review:', reviewId);
  }, []);

  // Empty state
  if (!loading && reviews.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <ReviewListHeader 
          total={0} 
          loading={loading}
          onRefresh={() => window.location.reload()}
        />
        <div className="p-12 text-center">
          <div className="mx-auto h-24 w-24 text-gray-300 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.713-3.714M14 40v-4c0-1.313.253-2.566.713-3.714m0 0A9.971 9.971 0 0124 34c4.75 0 8.971 1.718 12.287 4.286"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No reviews found
          </h3>
          <p className="text-gray-600 mb-4">
            {filters && Object.keys(filters).length > 0 
              ? 'Try adjusting your filters to see more results.'
              : 'Be the first to write a review!'
            }
          </p>
          {filters && onFiltersChange && (
            <Button
              variant="ghost"
              onClick={() => onFiltersChange({})}
            >
              Clear all filters
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <ReviewListHeader 
        total={pagination?.total || reviews.length} 
        loading={loading}
        onRefresh={() => window.location.reload()}
      />

      {/* Loading State */}
      {loading && (
        <div className="p-8 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Review Cards */}
      {!loading && (
        <div className="divide-y divide-gray-100">
          {reviews.map((review, index) => (
            <div key={review.id} className="p-4">
              <ReviewCard
                review={review}
                showActions={true}
                compact={false}
                onVote={(reviewId, helpful) => handleVote(reviewId, helpful)}
                onReport={handleReport}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReply={handleReply}
              />
              
              {/* Loading overlay for actions */}
              {actionLoading === review.id && (
                <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination && pagination.total > pagination.pageSize && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          hasNext={pagination.hasNext}
          hasPrevious={pagination.hasPrevious}
          onPageChange={onPageChange || (() => {})}
        />
      )}

      {/* Load More Button (Alternative to pagination) */}
      {!loading && !pagination && reviews.length > 0 && (
        <div className="p-4 text-center border-t border-gray-100">
          <Button
            variant="ghost"
            onClick={() => console.log('Load more reviews')}
          >
            Load More Reviews
          </Button>
        </div>
      )}
    </div>
  );
};

// Utility component for compact review lists
export const CompactReviewList: React.FC<Omit<ReviewListProps, 'pagination'> & {
  maxItems?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}> = ({
  reviews,
  loading,
  maxItems = 3,
  showViewAll = true,
  onViewAll,
  ...props
}) => {
  const displayReviews = maxItems ? reviews.slice(0, maxItems) : reviews;
  const hasMore = reviews.length > maxItems;

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="md" />
        </div>
      ) : displayReviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No reviews available
        </div>
      ) : (
        <>
          {displayReviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              compact={true}
              {...props}
            />
          ))}
          
          {hasMore && showViewAll && (
            <div className="text-center pt-4">
              <Button
                variant="ghost"
                onClick={onViewAll}
              >
                View all {reviews.length} reviews
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};