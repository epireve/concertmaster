import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../../store/reviewStore';
import { ReviewHeader } from './ReviewHeader';
import { ReviewTimeline } from './ReviewTimeline';
import { ReviewStages } from './ReviewStages';
import { ReviewAssignments } from './ReviewAssignments';
import { ReviewActions } from './ReviewActions';
import { CommentSection } from '../Comments/CommentSection';
import { Button, ErrorBoundary } from '../../shared';
import { ArrowLeft, Edit, Share2, MoreHorizontal, Loader2 } from 'lucide-react';
import type { ReviewableItem } from '../../../types/reviews';

interface ReviewDetailsPageProps {
  reviewId?: string;
  onBack?: () => void;
  onEdit?: (review: ReviewableItem) => void;
}

export const ReviewDetailsPage: React.FC<ReviewDetailsPageProps> = ({
  reviewId: propReviewId,
  onBack,
  onEdit
}) => {
  const { id: paramReviewId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const reviewId = propReviewId || paramReviewId;
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'history'>('overview');

  const {
    selectedReview,
    assignments,
    comments,
    loading,
    errors,
    fetchReview,
    fetchAssignments,
    fetchComments,
    connectWebSocket,
    disconnectWebSocket,
    isConnected
  } = useReviewStore();

  // Load review data
  useEffect(() => {
    if (reviewId) {
      fetchReview(reviewId);
      fetchAssignments(reviewId);
      fetchComments(reviewId);
      
      // Connect to WebSocket for real-time updates
      const token = localStorage.getItem('token');
      if (token) {
        connectWebSocket(token);
      }
    }

    return () => {
      disconnectWebSocket();
    };
  }, [reviewId, fetchReview, fetchAssignments, fetchComments, connectWebSocket, disconnectWebSocket]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/reviews');
    }
  };

  const handleEdit = () => {
    if (selectedReview && onEdit) {
      onEdit(selectedReview);
    }
  };

  const handleShare = async () => {
    if (selectedReview) {
      try {
        await navigator.share({
          title: `Review: ${selectedReview.title}`,
          text: selectedReview.description,
          url: window.location.href
        });
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href);
        // Could show a toast notification here
        console.log('Link copied to clipboard');
      }
    }
  };

  if (loading.review) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="text-lg text-gray-600">Loading review...</span>
        </div>
      </div>
    );
  }

  if (errors.review) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Failed to load review</h1>
          <p className="text-gray-600 mb-4">{errors.review}</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reviews
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedReview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review not found</h1>
          <p className="text-gray-600 mb-4">The review you're looking for doesn't exist.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reviews
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', count: undefined },
    { id: 'comments' as const, label: 'Comments', count: comments.length },
    { id: 'history' as const, label: 'History', count: undefined }
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  
                  <div className="h-6 border-l border-gray-300"></div>
                  
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">
                      {selectedReview.title}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                      Review #{selectedReview.id.slice(-8)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {/* Connection Status */}
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    <span className="text-xs text-gray-500">
                      {isConnected ? 'Live' : 'Offline'}
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Review Header */}
              <ReviewHeader review={selectedReview} />
              
              {/* Tabs */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {tab.label}
                        {tab.count !== undefined && (
                          <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                            activeTab === tab.id
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </nav>
                </div>
                
                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Review Stages */}
                      <ReviewStages 
                        review={selectedReview}
                        assignments={assignments}
                      />
                      
                      {/* Review Timeline */}
                      <ReviewTimeline review={selectedReview} />
                    </div>
                  )}
                  
                  {activeTab === 'comments' && (
                    <CommentSection 
                      reviewId={selectedReview.id}
                      comments={comments}
                      loading={loading.comments}
                      error={errors.comments}
                    />
                  )}
                  
                  {activeTab === 'history' && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">History view coming soon...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Review Assignments */}
              <ReviewAssignments 
                review={selectedReview}
                assignments={assignments}
                loading={loading.assignments}
                error={errors.assignments}
              />
              
              {/* Review Actions */}
              <ReviewActions 
                review={selectedReview}
                assignments={assignments}
              />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};