import React, { useState, useCallback, useMemo } from 'react';
import { ReviewFiltersProps, ReviewFilters as ReviewFiltersType, ReviewSortOption, ReviewStatus } from '../../types/review';
import { Button, Input, Select, Checkbox } from '../shared';
import { DisplayRating } from './RatingSystem';

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Most Recent' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'helpful', label: 'Most Helpful' },
  { value: 'updatedAt', label: 'Recently Updated' },
  { value: 'author', label: 'Author Name' },
  { value: 'title', label: 'Title' }
];

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'pending', label: 'Pending' },
  { value: 'draft', label: 'Draft' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'hidden', label: 'Hidden' }
];

const TARGET_TYPE_OPTIONS = [
  { value: 'form', label: 'Forms' },
  { value: 'workflow', label: 'Workflows' },
  { value: 'template', label: 'Templates' },
  { value: 'component', label: 'Components' },
  { value: 'system', label: 'System' }
];

export const ReviewFilters: React.FC<ReviewFiltersProps> = ({
  filters,
  statistics,
  onFiltersChange,
  onReset,
  availableTags = [],
  availableAuthors = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  
  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    const newTimeout = setTimeout(() => {
      onFiltersChange({ search: value || undefined });
    }, 300);
    
    setSearchTimeout(newTimeout);
  }, [searchTimeout, onFiltersChange]);

  // Rating filter handlers
  const handleRatingFilter = useCallback((rating: number) => {
    const currentRatings = filters.rating || [];
    const newRatings = currentRatings.includes(rating)
      ? currentRatings.filter(r => r !== rating)
      : [...currentRatings, rating];
    
    onFiltersChange({ 
      rating: newRatings.length > 0 ? newRatings : undefined 
    });
  }, [filters.rating, onFiltersChange]);

  // Status filter handlers
  const handleStatusFilter = useCallback((status: ReviewStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    onFiltersChange({ 
      status: newStatuses.length > 0 ? newStatuses : undefined 
    });
  }, [filters.status, onFiltersChange]);

  // Target type filter handlers
  const handleTargetTypeFilter = useCallback((targetType: string) => {
    const currentTypes = filters.targetType || [];
    const newTypes = currentTypes.includes(targetType as any)
      ? currentTypes.filter(t => t !== targetType)
      : [...currentTypes, targetType as any];
    
    onFiltersChange({ 
      targetType: newTypes.length > 0 ? newTypes : undefined 
    });
  }, [filters.targetType, onFiltersChange]);

  // Tag filter handlers
  const handleTagFilter = useCallback((tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    
    onFiltersChange({ 
      tags: newTags.length > 0 ? newTags : undefined 
    });
  }, [filters.tags, onFiltersChange]);

  // Sort handlers
  const handleSortChange = useCallback((sortBy: ReviewSortOption) => {
    onFiltersChange({ sortBy });
  }, [onFiltersChange]);

  const handleSortOrderToggle = useCallback(() => {
    onFiltersChange({ 
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
    });
  }, [filters.sortOrder, onFiltersChange]);

  // Author filter
  const handleAuthorChange = useCallback((author: string) => {
    onFiltersChange({ author: author || undefined });
  }, [onFiltersChange]);

  // Date range filter
  const handleDateRangeChange = useCallback((field: 'start' | 'end', value: string) => {
    const currentRange = filters.dateRange || { start: new Date(), end: new Date() };
    const newRange = {
      ...currentRange,
      [field]: new Date(value)
    };
    
    onFiltersChange({ dateRange: newRange });
  }, [filters.dateRange, onFiltersChange]);

  // Clear individual filters
  const clearFilter = useCallback((filterKey: keyof ReviewFilters) => {
    onFiltersChange({ [filterKey]: undefined });
  }, [onFiltersChange]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.rating?.length) count++;
    if (filters.status?.length) count++;
    if (filters.targetType?.length) count++;
    if (filters.tags?.length) count++;
    if (filters.author) count++;
    if (filters.search) count++;
    if (filters.dateRange) count++;
    return count;
  }, [filters]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Filter Reviews
            </h3>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onReset && activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
              >
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Show Less' : 'Show More'}
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="p-4 space-y-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Reviews
          </label>
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by title, content, or author..."
            className="w-full"
          />
        </div>

        {/* Sort */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <Select
              options={SORT_OPTIONS}
              value={filters.sortBy}
              onChange={(e) => handleSortChange(e.target.value as ReviewSortOption)}
              placeholder="Select sort option"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order
            </label>
            <Button
              variant="ghost"
              onClick={handleSortOrderToggle}
              className="w-full justify-between"
            >
              {filters.sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              <span className="text-gray-400">
                {filters.sortOrder === 'desc' ? '↓' : '↑'}
              </span>
            </Button>
          </div>
        </div>

        {/* Rating Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rating
          </label>
          <div className="flex flex-wrap gap-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const isSelected = filters.rating?.includes(rating) || false;
              const count = statistics?.ratingDistribution[rating as keyof typeof statistics.ratingDistribution] || 0;
              
              return (
                <button
                  key={rating}
                  onClick={() => handleRatingFilter(rating)}
                  className={`
                    flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors
                    ${isSelected 
                      ? 'bg-blue-50 border-blue-200 text-blue-800' 
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <DisplayRating rating={rating} size="sm" showValue={false} />
                  <span className="text-sm font-medium">{rating}</span>
                  <span className="text-xs text-gray-500">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-100 space-y-6">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {STATUS_OPTIONS.map(({ value, label }) => {
                const isSelected = filters.status?.includes(value as ReviewStatus) || false;
                const count = statistics?.statusDistribution[value as ReviewStatus] || 0;
                
                return (
                  <div key={value} className="flex items-center">
                    <Checkbox
                      id={`status-${value}`}
                      checked={isSelected}
                      onChange={() => handleStatusFilter(value as ReviewStatus)}
                    />
                    <label htmlFor={`status-${value}`} className="ml-2 text-sm text-gray-700">
                      {label} ({count})
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Review Target
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {TARGET_TYPE_OPTIONS.map(({ value, label }) => {
                const isSelected = filters.targetType?.includes(value as any) || false;
                
                return (
                  <div key={value} className="flex items-center">
                    <Checkbox
                      id={`target-${value}`}
                      checked={isSelected}
                      onChange={() => handleTargetTypeFilter(value)}
                    />
                    <label htmlFor={`target-${value}`} className="ml-2 text-sm text-gray-700">
                      {label}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tags Filter */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = filters.tags?.includes(tag) || false;
                  const tagStat = statistics?.topTags.find(t => t.tag === tag);
                  const count = tagStat?.count || 0;
                  
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagFilter(tag)}
                      className={`
                        inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors
                        ${isSelected
                          ? 'bg-blue-100 border-blue-200 text-blue-800'
                          : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      #{tag}
                      {count > 0 && <span className="ml-1">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Author Filter */}
          {availableAuthors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Author
              </label>
              <Select
                options={[
                  { value: '', label: 'All Authors' },
                  ...availableAuthors.map(author => ({
                    value: author.id,
                    label: `${author.name} (${author.reviewCount || 0} reviews)`
                  }))
                ]}
                value={filters.author || ''}
                onChange={(e) => handleAuthorChange(e.target.value)}
                placeholder="Select author"
              />
            </div>
          )}

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <Input
                  type="date"
                  value={filters.dateRange?.start.toISOString().split('T')[0] || ''}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <Input
                  type="date"
                  value={filters.dateRange?.end.toISOString().split('T')[0] || ''}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                />
              </div>
            </div>
            {filters.dateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearFilter('dateRange')}
                className="mt-2"
              >
                Clear Date Range
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {activeFilterCount > 0 && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing filtered results
            </span>
            <div className="flex flex-wrap gap-1">
              {filters.search && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                  Search: "{filters.search}"
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      clearFilter('search');
                    }}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.rating && filters.rating.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                  Ratings: {filters.rating.join(', ')}
                  <button
                    onClick={() => clearFilter('rating')}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.status && filters.status.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                  Status: {filters.status.join(', ')}
                  <button
                    onClick={() => clearFilter('status')}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};