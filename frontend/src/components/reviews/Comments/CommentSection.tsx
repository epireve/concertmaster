import React, { useState } from 'react';
import { useReviewStore } from '../../../store/reviewStore';
import { CommentThread } from './CommentThread';
import { CommentEditor } from './CommentEditor';
import { Button } from '../../shared';
import { MessageSquare, Plus, Filter, SortAsc } from 'lucide-react';
import type { ReviewComment } from '../../../types/reviews';

interface CommentSectionProps {
  reviewId: string;
  comments: ReviewComment[];
  loading?: boolean;
  error?: string | null;
}

type SortOrder = 'newest' | 'oldest' | 'most_replies';

const sortComments = (comments: ReviewComment[], sortOrder: SortOrder): ReviewComment[] => {
  const sorted = [...comments].sort((a, b) => {
    switch (sortOrder) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'most_replies':
        return (b.replies?.length || 0) - (a.replies?.length || 0);
      default:
        return 0;
    }
  });
  return sorted;
};

export const CommentSection: React.FC<CommentSectionProps> = ({
  reviewId,
  comments,
  loading = false,
  error = null
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showResolved, setShowResolved] = useState(true);
  
  const { createComment } = useReviewStore();
  
  // Filter out replies (they'll be shown within threads)
  const rootComments = comments.filter(comment => !comment.parentId);
  
  // Apply sorting
  const sortedComments = sortComments(rootComments, sortOrder);
  
  // Apply resolved filter
  const filteredComments = showResolved 
    ? sortedComments 
    : sortedComments.filter(comment => !comment.isResolved);

  const handleSubmitComment = async (content: string, mentions: string[]) => {
    try {
      await createComment(reviewId, {
        content,
        mentions: mentions.length > 0 ? mentions : undefined
      });
      setShowEditor(false);
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const totalCommentsCount = comments.length;
  const unresolvedCount = comments.filter(c => !c.isResolved).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="text-sm text-gray-500">Loading comments...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">
              Comments
            </h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {totalCommentsCount}
            </span>
            {unresolvedCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {unresolvedCount} unresolved
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sort Options */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most_replies">Most replies</option>
          </select>

          {/* Filter Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResolved(!showResolved)}
            className={showResolved ? '' : 'bg-yellow-50 text-yellow-700'}
          >
            <Filter className="h-4 w-4 mr-1" />
            {showResolved ? 'All' : 'Unresolved'}
          </Button>

          {/* Add Comment Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowEditor(!showEditor)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Comment
          </Button>
        </div>
      </div>

      {/* New Comment Editor */}
      {showEditor && (
        <div className="bg-gray-50 rounded-lg p-4">
          <CommentEditor
            placeholder="Add a comment..."
            onSubmit={handleSubmitComment}
            onCancel={() => setShowEditor(false)}
            showCancel={true}
            autoFocus={true}
          />
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {filteredComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h4 className="mt-2 text-sm font-medium text-gray-900">
              {showResolved ? 'No comments yet' : 'No unresolved comments'}
            </h4>
            <p className="mt-1 text-sm text-gray-500">
              {showResolved 
                ? 'Be the first to comment on this review.'
                : 'All comments have been resolved.'}
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={comments.filter(c => c.parentId === comment.id)}
              reviewId={reviewId}
            />
          ))
        )}
      </div>

      {/* Load More */}
      {filteredComments.length > 0 && filteredComments.length < totalCommentsCount && (
        <div className="text-center pt-4">
          <Button variant="ghost" size="sm">
            Load more comments
          </Button>
        </div>
      )}
    </div>
  );
};