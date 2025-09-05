import React, { useState } from 'react';
import { CommentItem } from './CommentItem';
import { CommentEditor } from './CommentEditor';
import { useReviewStore } from '../../../store/reviewStore';
import { Button } from '../../shared';
import { ChevronDown, ChevronRight, Reply } from 'lucide-react';
import type { ReviewComment } from '../../../types/reviews';

interface CommentThreadProps {
  comment: ReviewComment;
  replies: ReviewComment[];
  reviewId: string;
  depth?: number;
  maxDepth?: number;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  replies,
  reviewId,
  depth = 0,
  maxDepth = 3
}) => {
  const [showReplies, setShowReplies] = useState(depth === 0 || replies.length <= 3);
  const [showReplyEditor, setShowReplyEditor] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const { createComment, updateComment } = useReviewStore();
  
  const sortedReplies = [...replies].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const handleReply = async (content: string, mentions: string[]) => {
    try {
      await createComment(reviewId, {
        content,
        parentId: comment.id,
        mentions: mentions.length > 0 ? mentions : undefined
      });
      setShowReplyEditor(false);
      if (!showReplies && replies.length === 0) {
        setShowReplies(true);
      }
    } catch (error) {
      console.error('Failed to create reply:', error);
    }
  };

  const handleEdit = async (content: string) => {
    try {
      await updateComment(comment.id, { content });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const canReply = depth < maxDepth;
  const hasReplies = sortedReplies.length > 0;

  return (
    <div className={`${depth > 0 ? 'ml-8' : ''}`}>
      {/* Main Comment */}
      <div className="relative">
        {/* Thread Line */}
        {depth > 0 && (
          <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        )}
        
        <CommentItem
          comment={comment}
          onEdit={handleEdit}
          isEditing={isEditing}
          onToggleEdit={() => setIsEditing(!isEditing)}
          depth={depth}
        />
        
        {/* Reply Actions */}
        {canReply && (
          <div className="mt-2 ml-12 flex items-center space-x-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setShowReplyEditor(!showReplyEditor)}
              className={showReplyEditor ? 'bg-blue-50 text-blue-700' : ''}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
            
            {hasReplies && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                {sortedReplies.length} {sortedReplies.length === 1 ? 'reply' : 'replies'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Reply Editor */}
      {showReplyEditor && canReply && (
        <div className="mt-3 ml-12">
          <div className="bg-gray-50 rounded-lg p-3">
            <CommentEditor
              placeholder={`Reply to ${comment.author.name || comment.authorId}...`}
              onSubmit={handleReply}
              onCancel={() => setShowReplyEditor(false)}
              showCancel={true}
              size="sm"
            />
          </div>
        </div>
      )}

      {/* Replies */}
      {showReplies && hasReplies && (
        <div className="mt-4 space-y-4">
          {sortedReplies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              replies={[]} // Nested replies would need to be passed here if supporting deeper nesting
              reviewId={reviewId}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}

      {/* Show More Replies */}
      {!showReplies && hasReplies && (
        <div className="mt-3 ml-12">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReplies(true)}
            className="text-blue-600 hover:text-blue-700"
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            Show {sortedReplies.length} {sortedReplies.length === 1 ? 'reply' : 'replies'}
          </Button>
        </div>
      )}
    </div>
  );
};