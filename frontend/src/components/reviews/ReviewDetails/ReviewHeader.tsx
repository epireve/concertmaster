import React from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Tag, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Layers,
  Target
} from 'lucide-react';
import type { ReviewableItem, ReviewStatus, Priority } from '../../../types/reviews';

interface ReviewHeaderProps {
  review: ReviewableItem;
}

const StatusBadge: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const getStatusConfig = (status: ReviewStatus) => {
    switch (status) {
      case 'draft':
        return { color: 'bg-gray-100 text-gray-800', icon: FileText, label: 'Draft' };
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' };
      case 'in_progress':
        return { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'In Progress' };
      case 'under_review':
        return { color: 'bg-purple-100 text-purple-800', icon: User, label: 'Under Review' };
      case 'approved':
        return { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' };
      case 'rejected':
        return { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' };
      case 'completed':
        return { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Completed' };
      case 'archived':
        return { color: 'bg-slate-100 text-slate-800', icon: FileText, label: 'Archived' };
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: FileText, label: status };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
      <Icon className="h-4 w-4 mr-2" />
      {config.label}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const getPriorityConfig = (priority: Priority) => {
    switch (priority) {
      case 'low':
        return { color: 'bg-green-100 text-green-800 border-green-200', label: 'Low Priority' };
      case 'medium':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Medium Priority' };
      case 'high':
        return { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'High Priority' };
      case 'urgent':
        return { color: 'bg-red-100 text-red-800 border-red-200', label: 'Urgent' };
      case 'critical':
        return { color: 'bg-red-200 text-red-900 border-red-300', label: 'Critical' };
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', label: priority };
    }
  };

  const config = getPriorityConfig(priority);
  const showIcon = priority === 'urgent' || priority === 'critical';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium border ${config.color}`}>
      {showIcon && <AlertTriangle className="h-4 w-4 mr-2" />}
      {config.label}
    </span>
  );
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateShort = (date: string | Date) => {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getTimeUntilDue = (dueDate: string | Date) => {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)} days overdue`, isOverdue: true };
  } else if (diffDays === 0) {
    return { text: 'Due today', isOverdue: false };
  } else if (diffDays === 1) {
    return { text: 'Due tomorrow', isOverdue: false };
  } else {
    return { text: `Due in ${diffDays} days`, isOverdue: false };
  }
};

export const ReviewHeader: React.FC<ReviewHeaderProps> = ({ review }) => {
  const dueDateInfo = review.dueDate ? getTimeUntilDue(review.dueDate) : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Status and Priority */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <StatusBadge status={review.status} />
          <PriorityBadge priority={review.priority} />
        </div>
        
        {/* Item Type */}
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Layers className="h-4 w-4" />
          <span>{review.itemType.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Title and Description */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {review.title}
        </h2>
        {review.description && (
          <p className="text-gray-700 leading-relaxed">
            {review.description}
          </p>
        )}
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Created */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 p-2 bg-gray-50 rounded-md">
            <Calendar className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <dt className="text-sm font-medium text-gray-900">Created</dt>
            <dd className="text-sm text-gray-500 mt-1">
              {formatDate(review.createdAt)}
            </dd>
            <dd className="text-xs text-gray-400">
              by {review.createdBy}
            </dd>
          </div>
        </div>

        {/* Due Date */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 p-2 bg-gray-50 rounded-md">
            <Target className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <dt className="text-sm font-medium text-gray-900">Due Date</dt>
            {review.dueDate ? (
              <>
                <dd className="text-sm text-gray-500 mt-1">
                  {formatDateShort(review.dueDate)}
                </dd>
                <dd className={`text-xs mt-1 ${
                  dueDateInfo?.isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'
                }`}>
                  {dueDateInfo?.text}
                </dd>
              </>
            ) : (
              <dd className="text-sm text-gray-400 mt-1">No due date set</dd>
            )}
          </div>
        </div>

        {/* Current Assignment */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 p-2 bg-gray-50 rounded-md">
            <User className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <dt className="text-sm font-medium text-gray-900">Assigned To</dt>
            {review.currentAssignment ? (
              <>
                <dd className="text-sm text-gray-500 mt-1">
                  {review.currentAssignment.assignedUser?.name || review.currentAssignment.assignedTo}
                </dd>
                <dd className="text-xs text-gray-400">
                  Stage: {review.currentAssignment.stage?.name || 'Unknown'}
                </dd>
              </>
            ) : (
              <dd className="text-sm text-gray-400 mt-1">Unassigned</dd>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 p-2 bg-gray-50 rounded-md">
            <Clock className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <dt className="text-sm font-medium text-gray-900">Progress</dt>
            <dd className="text-sm text-gray-500 mt-1">
              Stage {review.currentStageIndex + 1} of {review.totalStages}
            </dd>
            <dd className="text-xs text-gray-400">
              {Math.round(((review.currentStageIndex + 1) / review.totalStages) * 100)}% complete
            </dd>
          </div>
        </div>
      </div>

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 p-2 bg-gray-50 rounded-md">
              <Tag className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <dt className="text-sm font-medium text-gray-900 mb-2">Tags</dt>
              <div className="flex flex-wrap gap-2">
                {review.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Additional Metadata */}
      {review.metadata && Object.keys(review.metadata).length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Additional Information</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {Object.entries(review.metadata).map(([key, value]) => (
              <div key={key}>
                <dt className="font-medium text-gray-500">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </dt>
                <dd className="text-gray-900 mt-1">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
};