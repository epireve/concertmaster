import React, { useState } from 'react';
import { CommentEditor } from './CommentEditor';
import { Button } from '../../shared';
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Flag, 
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Clock
} from 'lucide-react';
import type { ReviewComment } from '../../../types/reviews';

interface CommentItemProps {
  comment: ReviewComment;
  onEdit: (content: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onResolve?: () => Promise<void>;
  onVote?: (helpful: boolean) => Promise<void>;
  onReport?: () => Promise<void>;
  isEditing: boolean;
  onToggleEdit: () => void;
  depth?: number;
}

const formatTimeAgo = (date: string | Date) => {
  const now = new Date();
  const commentDate = new Date(date);
  const diffMs = now.getTime() - commentDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return commentDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: commentDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

const formatFullDate = (date: string | Date) => {
  return new Date(date).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const renderMentions = (content: string, mentions: string[] = []) => {
  let processedContent = content;
  
  mentions.forEach(mention => {
    const regex = new RegExp(`@${mention}\\b`, 'gi');
    processedContent = processedContent.replace(regex, (match) => 
      `<span class="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-blue-100 text-blue-800">${match}</span>`
    );
  });
  
  return <div dangerouslySetInnerHTML={{ __html: processedContent }} />;
};

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onEdit,
  onDelete,
  onResolve,
  onVote,
  onReport,
  isEditing,
  onToggleEdit,
  depth = 0
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleEdit = async (content: string) => {
    setIsSubmitting(true);
    try {
      await onEdit(content);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (helpful: boolean) => {
    if (onVote) {
      await onVote(helpful);
    }
  };

  const canEdit = true; // Would check permissions here
  const canDelete = true; // Would check permissions here
  const canResolve = depth === 0; // Only root comments can be resolved
  
  const isResolved = comment.isResolved;
  const isAuthor = true; // Would check if current user is the author

  if (isEditing) {
    return (
      <div className="bg-yellow-50 rounded-lg p-4">
        <CommentEditor
          initialValue={comment.content}
          onSubmit={handleEdit}
          onCancel={onToggleEdit}
          showCancel={true}
          loading={isSubmitting}
          placeholder="Edit your comment..."
        />
      </div>
    );
  }

  return (
    <div className={`group relative ${isResolved ? 'opacity-75' : ''}`}>
      {/* Resolved Indicator */}
      {isResolved && (
        <div className="absolute -left-2 top-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
          <CheckCircle className="h-3 w-3 text-white" />
        </div>
      )}
      
      <div className="flex space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-600">
              {(comment.author?.name || comment.authorId).charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">
                {comment.author?.name || comment.authorId}
              </span>
              
              {comment.author?.verified && (
                <CheckCircle className="h-4 w-4 text-blue-500" />
              )}
              
              <time 
                className="text-xs text-gray-500"
                title={formatFullDate(comment.createdAt)}
              >
                {formatTimeAgo(comment.createdAt)}
              </time>
              
              {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
            </div>

            {/* Actions Menu */}
            <div className="relative">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowMenu(!showMenu)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              
              {showMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                  <div className="py-1">
                    {canEdit && (
                      <button
                        onClick={() => {
                          onToggleEdit();
                          setShowMenu(false);
                        }}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </button>
                    )}
                    
                    {canResolve && (
                      <button
                        onClick={() => {
                          onResolve?.();
                          setShowMenu(false);
                        }}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        {isResolved ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Unresolve
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Resolve
                          </>
                        )}
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        onReport?.();
                        setShowMenu(false);
                      }}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report
                    </button>
                    
                    {canDelete && (
                      <button
                        onClick={() => {
                          onDelete?.();
                          setShowMenu(false);
                        }}
                        className="flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comment Content */}
          <div className="mt-2 text-sm text-gray-700 leading-relaxed">
            {comment.mentions && comment.mentions.length > 0 
              ? renderMentions(comment.content, comment.mentions)
              : <p>{comment.content}</p>
            }
          </div>

          {/* Attachments */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {comment.attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 p-2 bg-gray-50 rounded border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {attachment.size} • {attachment.type}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    as="a"
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Voting */}
          <div className="mt-3 flex items-center space-x-4">
            {onVote && (
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleVote(true)}
                  className="text-gray-500 hover:text-green-600"
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {comment.helpfulCount || 0}
                </Button>
                
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleVote(false)}
                  className="text-gray-500 hover:text-red-600"
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  {comment.notHelpfulCount || 0}
                </Button>
              </div>
            )}

            {/* Resolution Status */}
            {isResolved && (
              <div className="flex items-center space-x-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span>Resolved</span>
                {comment.resolvedAt && (
                  <time title={formatFullDate(comment.resolvedAt)}>
                    {formatTimeAgo(comment.resolvedAt)}
                  </time>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Click Outside Handler */}
      {showMenu && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};