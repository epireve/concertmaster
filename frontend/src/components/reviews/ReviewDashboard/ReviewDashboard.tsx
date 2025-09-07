import React, { useEffect, useState } from 'react';
import { useReviewStore } from '../../../store/reviewStore';
import { ReviewFilters } from './ReviewFilters';
import { ReviewList } from './ReviewList';
import { ReviewSummaryCards } from './ReviewSummaryCards';
import { QuickActions } from './QuickActions';
import { Button } from '../../shared';
import { Plus, Filter, Download, RefreshCw } from 'lucide-react';
import type { ReviewFilters as ReviewFiltersType } from '../../../types/reviews';

interface ReviewDashboardProps {
  onCreateReview?: () => void;
  onViewReview?: (reviewId: string) => void;
}

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({
  onCreateReview,
  onViewReview
}) => {
  const {
    reviews,
    loading,
    errors,
    filters,
    pagination,
    analytics,
    fetchReviews,
    fetchAnalytics,
    setFilters,
    resetFilters,
    setPagination
  } = useReviewStore();

  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchReviews();
    fetchAnalytics();
  }, [fetchReviews, fetchAnalytics]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<ReviewFiltersType>) => {
    setFilters(newFilters);
    fetchReviews(newFilters);
  };

  // Handle pagination changes
  const handlePageChange = (page: number) => {
    const offset = (page - 1) * pagination.limit;
    setPagination({ offset });
    fetchReviews(undefined, { offset });
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchReviews(),
        fetchAnalytics()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      const response = await fetch('/api/v1/reviews/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `reviews-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export reviews:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to main content link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
      >
        Skip to main content
      </a>
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 id="page-title" className="text-2xl font-bold text-gray-900">
                  Review Dashboard
                </h1>
                <p className="text-sm text-gray-600 mt-1" id="page-description">
                  Manage and track review processes across your organization
                </p>
              </div>
              
              <div className="flex items-center space-x-3" role="toolbar" aria-label="Dashboard actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? 'bg-blue-50 text-blue-700' : ''}
                  aria-pressed={showFilters}
                  aria-expanded={showFilters}
                  aria-controls="filters-panel"
                  aria-label={showFilters ? 'Hide filters panel' : 'Show filters panel'}
                >
                  <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                  Filters
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label={isRefreshing ? 'Refreshing reviews...' : 'Refresh review list'}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Refresh
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  aria-label="Export reviews to CSV file"
                >
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  Export
                </Button>
                
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onCreateReview}
                  aria-label="Create a new review"
                >
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  New Review
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">Review Statistics Summary</h2>
        <ReviewSummaryCards analytics={analytics} loading={loading.reviews} />
      </section>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1" role="complementary" aria-labelledby="sidebar-heading">
            <h2 id="sidebar-heading" className="sr-only">Dashboard Sidebar</h2>
            <div className="space-y-6">
              {/* Quick Actions */}
              <QuickActions onCreateReview={onCreateReview} />
              
              {/* Filters */}
              {showFilters && (
                <div 
                  id="filters-panel" 
                  className="bg-white rounded-lg border border-gray-200"
                  role="region"
                  aria-labelledby="filters-heading"
                >
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 id="filters-heading" className="text-sm font-medium text-gray-900">
                        Filters
                      </h3>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={resetFilters}
                        aria-label="Clear all applied filters"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <ReviewFilters
                      filters={filters}
                      onFiltersChange={handleFiltersChange}
                      loading={loading.reviews}
                    />
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <section className="bg-white rounded-lg border border-gray-200" role="main" aria-labelledby="reviews-heading">
              {/* List Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="reviews-heading" className="text-lg font-medium text-gray-900">
                      Reviews
                    </h2>
                    <p className="text-sm text-gray-500 mt-1" role="status" aria-live="polite">
                      {pagination.total} total reviews
                    </p>
                  </div>
                  
                  {/* Active Filters Display */}
                  {(filters.search || 
                    filters.status?.length || 
                    filters.priority?.length ||
                    filters.assignedTo) && (
                    <div className="flex items-center space-x-2" role="status" aria-live="polite">
                      <span className="text-xs text-gray-500">
                        Active filters:
                      </span>
                      <div className="flex items-center space-x-1" aria-label="Applied filters">
                        {filters.search && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            Search: {filters.search}
                          </span>
                        )}
                        {filters.status?.length && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                            Status: {filters.status.length}
                          </span>
                        )}
                        {filters.priority?.length && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                            Priority: {filters.priority.length}
                          </span>
                        )}
                        {filters.assignedTo && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                            Assignee
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Review List */}
              <ReviewList
                reviews={reviews}
                loading={loading.reviews}
                error={errors.reviews}
                pagination={pagination}
                filters={filters}
                onPageChange={handlePageChange}
                onFiltersChange={handleFiltersChange}
                onViewReview={onViewReview}
              />
            </div>
          </section>
          </div>
        </div>
      </main>
      
      {/* Live region for announcements */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only" id="announcements"></div>
      
      {/* Status messages */}
      <div aria-live="polite" aria-atomic="false" className="sr-only" id="status-messages"></div>
    </div>
  );
};