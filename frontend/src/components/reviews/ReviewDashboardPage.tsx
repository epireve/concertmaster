import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../store/reviewStore';
import { ReviewFilters } from './ReviewDashboard/ReviewFilters';
import { ReviewList } from './ReviewDashboard/ReviewList';
import { ReviewSummaryCards } from './ReviewDashboard/ReviewSummaryCards';
import { QuickActions } from './ReviewDashboard/QuickActions';
import { Button } from '../shared';
import { Plus, Filter, Download, RefreshCw } from 'lucide-react';
import type { ReviewFilters as ReviewFiltersType } from '../../types/reviews';

export const ReviewDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  
  const {
    reviews,
    loading,
    error,
    filters,
    pagination,
    reviewStats,
    fetchReviews,
    fetchReviewStats,
    setFilters,
    clearError,
    setPagination
  } = useReviewStore();

  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchReviews();
    fetchReviewStats();
  }, [fetchReviews, fetchReviewStats]);

  // Handle navigation to create review
  const handleCreateReview = () => {
    navigate('/reviews/create');
  };

  // Handle navigation to view review
  const handleViewReview = (reviewId: string) => {
    navigate(`/reviews/${reviewId}`);
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<ReviewFiltersType>) => {
    setFilters(newFilters);
  };

  // Handle pagination changes
  const handlePageChange = (page: number) => {
    const skip = (page - 1) * pagination.limit;
    setPagination({ skip });
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchReviews(),
        fetchReviewStats()
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
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Review Dashboard
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage and track review processes across your organization
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? 'bg-blue-50 text-blue-700' : ''}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateReview}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Review
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ReviewSummaryCards analytics={reviewStats} loading={loading} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Quick Actions */}
              <QuickActions onCreateReview={handleCreateReview} />
              
              {/* Filters */}
              {showFilters && (
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900">
                        Filters
                      </h3>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={clearError}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <ReviewFilters
                      filters={filters}
                      onFiltersChange={handleFiltersChange}
                      loading={loading}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border border-gray-200">
              {/* List Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      Reviews
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {pagination.total} total reviews
                    </p>
                  </div>
                  
                  {/* Active Filters Display */}
                  {(filters.search || 
                    filters.status?.length || 
                    filters.priority?.length ||
                    filters.assignee) && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        Active filters:
                      </span>
                      <div className="flex items-center space-x-1">
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
                        {filters.assignee && (
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
                loading={loading}
                error={error}
                pagination={pagination}
                filters={filters}
                onPageChange={handlePageChange}
                onFiltersChange={handleFiltersChange}
                onViewReview={handleViewReview}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};