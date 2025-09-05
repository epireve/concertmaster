import React, { useState, useCallback } from 'react';
import { ReviewCardProps, ReviewStatus } from '../../types/review';
import { DisplayRating } from './RatingSystem';
import { Button } from '../shared';

const STATUS_STYLES: Record<ReviewStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Review' },
  published: { bg: 'bg-green-100', text: 'text-green-800', label: 'Published' },
  flagged: { bg: 'bg-red-100', text: 'text-red-800', label: 'Flagged' },
  hidden: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Hidden' },
  deleted: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Deleted' }
};

const TARGET_TYPE_ICONS: Record<string, string> = {
  form: '📝',
  workflow: '⚡',
  template: '📋',
  component: '🧩',
  system: '⚙️'
};

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  showActions = true,
  compact = false,
  onVote,
  onReport,
  onEdit,
  onDelete,
  onReply
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [voteLoading, setVoteLoading] = useState<'helpful' | 'not_helpful' | null>(null);
  
  const statusStyle = STATUS_STYLES[review.status];
  const targetIcon = TARGET_TYPE_ICONS[review.target.type] || '📄';
  
  // Format dates
  const formatDate = useCallback((date: Date) => {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes} minutes ago`;
      }
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  // Handle vote actions
  const handleVote = useCallback(async (helpful: boolean) => {
    if (!onVote || voteLoading) return;
    
    setVoteLoading(helpful ? 'helpful' : 'not_helpful');
    try {
      await onVote(review.id, helpful);
    } finally {
      setVoteLoading(null);
    }
  }, [onVote, review.id, voteLoading]);

  // Truncate content for compact view
  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  };

  const shouldTruncate = compact && review.content.length > 150;
  const displayContent = shouldTruncate && !isExpanded 
    ? truncateContent(review.content)
    : review.content;

  return (
    <div className={`
      bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow
      ${compact ? 'p-4' : 'p-6'}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Title and Rating */}
          <div className="flex items-start justify-between mb-2">
            <h3 className={`font-semibold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>
              {review.title}
            </h3>
            <div className="flex items-center space-x-2 ml-4">
              <DisplayRating 
                rating={review.rating} 
                size={compact ? 'sm' : 'md'}
                showValue={false}
              />
              <span className="text-sm font-medium text-gray-700">
                {review.rating}/5
              </span>
            </div>
          </div>

          {/* Target Info */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>{targetIcon}</span>
            <span className="capitalize">{review.target.type}</span>
            <span>•</span>
            <span className="font-medium">{review.target.name}</span>
            {review.target.version && (
              <>
                <span>•</span>
                <span className="text-gray-500">v{review.target.version}</span>
              </>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className={`
          px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}
        `}>
          {statusStyle.label}
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <p className={`text-gray-700 leading-relaxed ${compact ? 'text-sm' : ''}`}>
          {displayContent}
        </p>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-1"
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Tags */}
      {review.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Attachments */}
      {review.attachments && review.attachments.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Attachments:</p>
          <div className="flex flex-wrap gap-2">
            {review.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200 hover:bg-blue-100"
              >
                <span className="mr-1">
                  {attachment.type === 'image' ? '🖼️' : 
                   attachment.type === 'video' ? '🎥' : 
                   attachment.type === 'document' ? '📄' : '📎'}
                </span>
                {attachment.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        {/* Author and Date */}
        <div className="flex items-center space-x-3">
          {review.author.avatar ? (
            <img
              src={review.author.avatar}
              alt={review.author.name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {review.author.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="text-sm">
            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-900">
                {review.author.name}
              </span>
              {review.author.verified && (
                <span className="text-blue-500" title="Verified reviewer">
                  ✓
                </span>
              )}
            </div>
            <div className="text-gray-500">
              {formatDate(review.createdAt)}
              {review.updatedAt.getTime() !== review.createdAt.getTime() && (
                <span className="ml-1">(edited)</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center space-x-2">
            {/* Vote buttons */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleVote(true)}
                disabled={voteLoading === 'helpful'}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                title="Mark as helpful"
              >
                <span>👍</span>
                <span>{review.metadata.helpful}</span>
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={voteLoading === 'not_helpful'}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Mark as not helpful"
              >
                <span>👎</span>
                <span>{review.metadata.notHelpful}</span>
              </button>
            </div>

            {/* More actions */}
            <div className="flex items-center space-x-1">
              {onReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReply(review.id)}
                >
                  Reply
                </Button>
              )}
              
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(review.id)}
                >
                  Edit
                </Button>
              )}

              {/* Report/Flag */}
              {onReport && (
                <button
                  onClick={() => onReport(review.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Report this review"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </button>
              )}

              {/* Delete */}
              {onDelete && (
                <button
                  onClick={() => onDelete(review.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete review"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Moderation info (if applicable) */}
      {review.moderatedAt && review.moderationNotes && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-start space-x-2">
            <span className="text-yellow-600 text-sm">⚠️</span>
            <div className="text-sm">
              <p className="text-yellow-800 font-medium">Moderation Note:</p>
              <p className="text-yellow-700 mt-1">{review.moderationNotes}</p>
              <p className="text-yellow-600 text-xs mt-2">
                Moderated on {formatDate(review.moderatedAt)}
                {review.moderatedBy && ` by ${review.moderatedBy}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};