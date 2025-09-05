import React, { useState, useCallback, useEffect } from 'react';
import { Button, ErrorBoundary } from '../shared';
import {
  ReviewForm,
  ReviewList,
  ReviewFilters,
  ReviewSummary,
  ReviewModal
} from './index';
import { 
  Review, 
  ReviewFilters as ReviewFiltersType, 
  ReviewStatistics,
  ReviewFormData,
  ReviewListResponse
} from '../../types/review';

// Mock data for development - this would be replaced with API calls
const MOCK_STATISTICS: ReviewStatistics = {
  totalReviews: 127,
  averageRating: 4.2,
  ratingDistribution: {
    5: 45,
    4: 38,
    3: 28,
    2: 12,
    1: 4
  },
  statusDistribution: {
    published: 115,
    pending: 8,
    draft: 3,
    flagged: 1,
    hidden: 0,
    deleted: 0
  },
  topTags: [
    { tag: 'user-friendly', count: 34 },
    { tag: 'intuitive', count: 28 },
    { tag: 'fast', count: 22 },
    { tag: 'reliable', count: 19 },
    { tag: 'well-designed', count: 16 }
  ],
  recentActivity: [
    { date: new Date('2024-01-01'), count: 8, averageRating: 4.1 },
    { date: new Date('2024-01-02'), count: 12, averageRating: 4.3 },
    { date: new Date('2024-01-03'), count: 6, averageRating: 3.9 },
    { date: new Date('2024-01-04'), count: 15, averageRating: 4.4 },
    { date: new Date('2024-01-05'), count: 9, averageRating: 4.2 }
  ],
  topAuthors: [
    {
      author: {
        id: '1',
        name: 'John Smith',
        email: 'john@example.com',
        verified: true,
        reviewCount: 15
      },
      reviewCount: 15,
      averageRating: 4.5
    },
    {
      author: {
        id: '2',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        verified: true,
        reviewCount: 12
      },
      reviewCount: 12,
      averageRating: 4.3
    }
  ]
};

const MOCK_REVIEWS: Review[] = [
  {
    id: '1',
    title: 'Excellent form builder with great UX',
    content: 'This form builder has been a game-changer for our team. The interface is intuitive, and the drag-and-drop functionality works flawlessly. We\'ve been able to create complex forms in minutes rather than hours.',
    rating: 5,
    author: {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      verified: true,
      reviewCount: 15
    },
    target: {
      type: 'form',
      id: 'contact-form-v2',
      name: 'Contact Form Builder',
      version: '2.1'
    },
    status: 'published',
    tags: ['user-friendly', 'intuitive', 'fast'],
    metadata: {
      deviceType: 'desktop',
      helpful: 12,
      notHelpful: 1,
      reports: 0,
      language: 'en'
    },
    createdAt: new Date('2024-01-05T10:30:00Z'),
    updatedAt: new Date('2024-01-05T10:30:00Z')
  },
  {
    id: '2',
    title: 'Good but could use more templates',
    content: 'The core functionality is solid and the performance is good. However, I wish there were more pre-built templates available. The customization options are decent but take some time to master.',
    rating: 4,
    author: {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      verified: true,
      reviewCount: 12
    },
    target: {
      type: 'template',
      id: 'survey-template',
      name: 'Survey Template Pack',
      version: '1.3'
    },
    status: 'published',
    tags: ['reliable', 'needs-improvement'],
    metadata: {
      deviceType: 'mobile',
      helpful: 8,
      notHelpful: 2,
      reports: 0,
      language: 'en'
    },
    createdAt: new Date('2024-01-04T15:45:00Z'),
    updatedAt: new Date('2024-01-04T15:45:00Z')
  },
  {
    id: '3',
    title: 'Complex but powerful workflow system',
    content: 'The workflow builder has a steep learning curve, but once you get the hang of it, it\'s incredibly powerful. The automation features have saved us countless hours of manual work.',
    rating: 4,
    author: {
      id: '3',
      name: 'Mike Chen',
      email: 'mike@example.com',
      verified: false,
      reviewCount: 3
    },
    target: {
      type: 'workflow',
      id: 'automation-workflow',
      name: 'Automation Workflow Engine',
      version: '3.0'
    },
    status: 'published',
    tags: ['powerful', 'complex', 'automation'],
    metadata: {
      deviceType: 'desktop',
      helpful: 15,
      notHelpful: 3,
      reports: 0,
      language: 'en'
    },
    createdAt: new Date('2024-01-03T09:20:00Z'),
    updatedAt: new Date('2024-01-03T09:20:00Z')
  }
];

export const ReviewSystem: React.FC = () => {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'summary'>('list');
  const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
  const [statistics, setStatistics] = useState<ReviewStatistics>(MOCK_STATISTICS);
  const [filters, setFilters] = useState<ReviewFiltersType>({
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [loading, setLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter and sort reviews
  const filteredReviews = React.useMemo(() => {
    let filtered = [...reviews];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(review => 
        review.title.toLowerCase().includes(searchTerm) ||
        review.content.toLowerCase().includes(searchTerm) ||
        review.author.name.toLowerCase().includes(searchTerm)
      );
    }

    // Apply rating filter
    if (filters.rating && filters.rating.length > 0) {
      filtered = filtered.filter(review => filters.rating!.includes(review.rating));
    }

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(review => filters.status!.includes(review.status));
    }

    // Apply target type filter
    if (filters.targetType && filters.targetType.length > 0) {
      filtered = filtered.filter(review => filters.targetType!.includes(review.target.type));
    }

    // Apply tags filter
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(review => 
        filters.tags!.some(tag => review.tags.includes(tag))
      );
    }

    // Apply author filter
    if (filters.author) {
      filtered = filtered.filter(review => review.author.id === filters.author);
    }

    // Apply date range filter
    if (filters.dateRange) {
      filtered = filtered.filter(review => {
        const reviewDate = review.createdAt;
        return reviewDate >= filters.dateRange!.start && reviewDate <= filters.dateRange!.end;
      });
    }

    // Sort reviews
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case 'rating':
          aValue = a.rating;
          bValue = b.rating;
          break;
        case 'helpful':
          aValue = a.metadata.helpful;
          bValue = b.metadata.helpful;
          break;
        case 'author':
          aValue = a.author.name;
          bValue = b.author.name;
          break;
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'updatedAt':
          aValue = a.updatedAt;
          bValue = b.updatedAt;
          break;
        default: // createdAt
          aValue = a.createdAt;
          bValue = b.createdAt;
      }

      if (typeof aValue === 'string') {
        return filters.sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return filters.sortOrder === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
    });

    return filtered;
  }, [reviews, filters]);

  // Paginate reviews
  const paginatedReviews = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredReviews.slice(start, end);
  }, [filteredReviews, currentPage, pageSize]);

  // Handle form submission
  const handleReviewSubmit = useCallback(async (formData: ReviewFormData) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newReview: Review = {
        id: Date.now().toString(),
        title: formData.title,
        content: formData.content,
        rating: formData.rating,
        author: {
          id: 'current-user',
          name: 'Current User',
          email: 'user@example.com',
          verified: false
        },
        target: {
          type: formData.targetType,
          id: formData.targetId,
          name: `${formData.targetType.charAt(0).toUpperCase() + formData.targetType.slice(1)} ${formData.targetId}`
        },
        status: 'published',
        tags: formData.tags,
        metadata: {
          deviceType: 'desktop',
          helpful: 0,
          notHelpful: 0,
          reports: 0,
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      setReviews(prev => [newReview, ...prev]);
      setCurrentView('list');
      
      // Update statistics
      setStatistics(prev => ({
        ...prev,
        totalReviews: prev.totalReviews + 1,
        averageRating: ((prev.averageRating * prev.totalReviews) + formData.rating) / (prev.totalReviews + 1),
        ratingDistribution: {
          ...prev.ratingDistribution,
          [formData.rating]: prev.ratingDistribution[formData.rating as keyof typeof prev.ratingDistribution] + 1
        }
      }));
      
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: Partial<ReviewFiltersType>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle review actions
  const handleReviewAction = useCallback(async (action: any) => {
    // Handle vote, report, edit, delete actions
    console.log('Review action:', action);
  }, []);

  // Handle review selection
  const handleReviewSelect = useCallback((review: Review) => {
    setSelectedReview(review);
    setModalOpen(true);
  }, []);

  const availableTags = React.useMemo(() => {
    const tagCounts = new Map<string, number>();
    reviews.forEach(review => {
      review.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.keys());
  }, [reviews]);

  const availableAuthors = React.useMemo(() => {
    const authorMap = new Map();
    reviews.forEach(review => {
      if (!authorMap.has(review.author.id)) {
        authorMap.set(review.author.id, {
          ...review.author,
          reviewCount: reviews.filter(r => r.author.id === review.author.id).length
        });
      }
    });
    return Array.from(authorMap.values());
  }, [reviews]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Review System
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Share feedback and help others make informed decisions
                  </p>
                </div>
                
                <nav className="flex items-center space-x-1">
                  <Button
                    variant={currentView === 'summary' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('summary')}
                  >
                    📊 Summary
                  </Button>
                  <Button
                    variant={currentView === 'list' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('list')}
                  >
                    📝 Reviews ({statistics.totalReviews})
                  </Button>
                  <Button
                    variant={currentView === 'create' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('create')}
                  >
                    ✍️ Write Review
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {currentView === 'summary' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <ReviewSummary
                  statistics={statistics}
                  showTrends={true}
                  timeRange="month"
                />
              </div>
              <div className="space-y-6">
                <div className="bg-white p-4 border border-gray-200 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setCurrentView('create')}
                      className="w-full"
                    >
                      Write a Review
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentView('list')}
                      className="w-full"
                    >
                      Browse Reviews
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'list' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Filters Sidebar */}
              <div className="lg:col-span-1">
                <ReviewFilters
                  filters={filters}
                  statistics={statistics}
                  onFiltersChange={handleFiltersChange}
                  onReset={() => handleFiltersChange({
                    search: undefined,
                    rating: undefined,
                    status: undefined,
                    targetType: undefined,
                    tags: undefined,
                    author: undefined,
                    dateRange: undefined
                  })}
                  availableTags={availableTags}
                  availableAuthors={availableAuthors}
                />
              </div>

              {/* Reviews List */}
              <div className="lg:col-span-3">
                <ReviewList
                  reviews={paginatedReviews}
                  loading={loading}
                  pagination={{
                    page: currentPage,
                    pageSize,
                    total: filteredReviews.length,
                    hasNext: currentPage * pageSize < filteredReviews.length,
                    hasPrevious: currentPage > 1
                  }}
                  filters={filters}
                  onPageChange={handlePageChange}
                  onFiltersChange={handleFiltersChange}
                  onReviewAction={handleReviewAction}
                />
              </div>
            </div>
          )}

          {currentView === 'create' && (
            <div className="max-w-4xl mx-auto">
              <ReviewForm
                onSubmit={handleReviewSubmit}
                onCancel={() => setCurrentView('list')}
                loading={loading}
              />
            </div>
          )}
        </div>

        {/* Review Modal */}
        <ReviewModal
          review={selectedReview}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedReview(null);
          }}
          onEdit={(review) => console.log('Edit review:', review)}
          onDelete={(reviewId) => console.log('Delete review:', reviewId)}
          onVote={(reviewId, helpful) => console.log('Vote:', reviewId, helpful)}
          onReport={(reviewId) => console.log('Report:', reviewId)}
        />
      </div>
    </ErrorBoundary>
  );
};