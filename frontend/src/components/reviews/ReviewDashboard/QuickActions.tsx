import React from 'react';
import { 
  Plus, 
  FileText as Template, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Users,
  Settings,
  BarChart3,
  FileText
} from 'lucide-react';
import { Button } from '../../shared';

interface QuickActionsProps {
  onCreateReview?: () => void;
  onManageTemplates?: () => void;
  onViewPending?: () => void;
  onViewOverdue?: () => void;
  onViewCompleted?: () => void;
  onManageUsers?: () => void;
  onViewReports?: () => void;
  onSettings?: () => void;
}

interface QuickActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick?: () => void;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  count?: number;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon: Icon,
  label,
  description,
  onClick,
  color,
  count
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'text-blue-600 bg-blue-50 hover:bg-blue-100';
      case 'green':
        return 'text-green-600 bg-green-50 hover:bg-green-100';
      case 'yellow':
        return 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100';
      case 'red':
        return 'text-red-600 bg-red-50 hover:bg-red-100';
      case 'purple':
        return 'text-purple-600 bg-purple-50 hover:bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-50 hover:bg-gray-100';
    }
  };

  return (
    <button
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 hover:shadow-sm"
      aria-describedby={`action-${label.replace(/\s+/g, '-').toLowerCase()}-description`}
    >
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 p-2 rounded-md ${getColorClasses(color)}`} aria-hidden="true">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              {label}
            </h4>
            {count !== undefined && (
              <span 
                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                  color === 'red' 
                    ? 'bg-red-100 text-red-800'
                    : color === 'yellow'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
                aria-label={`${count} ${label.toLowerCase()}`}
              >
                {count}
              </span>
            )}
          </div>
          <p 
            id={`action-${label.replace(/\s+/g, '-').toLowerCase()}-description`} 
            className="text-xs text-gray-500 mt-1"
          >
            {description}
          </p>
        </div>
      </div>
    </button>
  );
};

export const QuickActions: React.FC<QuickActionsProps> = ({
  onCreateReview,
  onManageTemplates,
  onViewPending,
  onViewOverdue,
  onViewCompleted,
  onManageUsers,
  onViewReports,
  onSettings
}) => {
  // Mock counts - in real implementation, these would come from props or store
  const mockCounts = {
    pending: 23,
    overdue: 5,
    completed: 147
  };

  const primaryActions = [
    {
      icon: Plus,
      label: 'New Review',
      description: 'Create a new review request',
      onClick: onCreateReview,
      color: 'blue' as const
    },
    {
      icon: Template,
      label: 'Templates',
      description: 'Manage review templates',
      onClick: onManageTemplates,
      color: 'purple' as const
    }
  ];

  const statusActions = [
    {
      icon: Clock,
      label: 'Pending Reviews',
      description: 'Reviews awaiting action',
      onClick: onViewPending,
      color: 'yellow' as const,
      count: mockCounts.pending
    },
    {
      icon: AlertTriangle,
      label: 'Overdue Reviews',
      description: 'Past due date',
      onClick: onViewOverdue,
      color: 'red' as const,
      count: mockCounts.overdue
    },
    {
      icon: CheckCircle,
      label: 'Completed',
      description: 'Finished reviews',
      onClick: onViewCompleted,
      color: 'green' as const,
      count: mockCounts.completed
    }
  ];

  const managementActions = [
    {
      icon: Users,
      label: 'Manage Users',
      description: 'User roles and permissions',
      onClick: onManageUsers,
      color: 'blue' as const
    },
    {
      icon: BarChart3,
      label: 'Reports',
      description: 'Analytics and insights',
      onClick: onViewReports,
      color: 'purple' as const
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Configure review system',
      onClick: onSettings,
      color: 'gray' as const
    }
  ];

  return (
    <div className="space-y-6">
      {/* Primary Actions */}
      <section className="bg-white rounded-lg border border-gray-200" aria-labelledby="primary-actions-heading">
        <div className="p-4 border-b border-gray-200">
          <h3 id="primary-actions-heading" className="text-sm font-medium text-gray-900">
            Quick Actions
          </h3>
        </div>
        <div className="p-4 space-y-3" role="group" aria-labelledby="primary-actions-heading">
          {primaryActions.map((action, index) => (
            <QuickActionButton
              key={index}
              {...action}
            />
          ))}
        </div>
      </section>

      {/* Status Overview */}
      <section className="bg-white rounded-lg border border-gray-200" aria-labelledby="status-overview-heading">
        <div className="p-4 border-b border-gray-200">
          <h3 id="status-overview-heading" className="text-sm font-medium text-gray-900">
            Review Status
          </h3>
        </div>
        <div className="p-4 space-y-3" role="group" aria-labelledby="status-overview-heading">
          {statusActions.map((action, index) => (
            <QuickActionButton
              key={index}
              {...action}
            />
          ))}
        </div>
      </section>

      {/* Management */}
      <section className="bg-white rounded-lg border border-gray-200" aria-labelledby="management-heading">
        <div className="p-4 border-b border-gray-200">
          <h3 id="management-heading" className="text-sm font-medium text-gray-900">
            Management
          </h3>
        </div>
        <div className="p-4 space-y-3" role="group" aria-labelledby="management-heading">
          {managementActions.map((action, index) => (
            <QuickActionButton
              key={index}
              {...action}
            />
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="bg-white rounded-lg border border-gray-200" aria-labelledby="recent-activity-heading">
        <div className="p-4 border-b border-gray-200">
          <h3 id="recent-activity-heading" className="text-sm font-medium text-gray-900">
            Recent Activity
          </h3>
        </div>
        <div className="p-4">
          <ol className="space-y-3 text-xs text-gray-500" aria-label="Recent activity feed">
            <li className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-2 h-2 mt-1 bg-green-400 rounded-full" aria-label="Completed" role="img"></div>
              <div className="flex-1">
                <span className="text-gray-900">John Smith</span> completed review for Form #1234
                <time className="block text-gray-400" dateTime="2025-01-06T02:47:00">2 minutes ago</time>
              </div>
            </li>
            <li className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-2 h-2 mt-1 bg-blue-400 rounded-full" aria-label="Assigned" role="img"></div>
              <div className="flex-1">
                <span className="text-gray-900">Sarah Johnson</span> was assigned to Workflow Review #5678
                <time className="block text-gray-400" dateTime="2025-01-06T01:49:00">1 hour ago</time>
              </div>
            </li>
            <li className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-2 h-2 mt-1 bg-yellow-400 rounded-full" aria-label="Created" role="img"></div>
              <div className="flex-1">
                <span className="text-gray-900">New review</span> created for Template #9012
                <time className="block text-gray-400" dateTime="2025-01-05T23:49:00">3 hours ago</time>
              </div>
            </li>
            <li className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-2 h-2 mt-1 bg-red-400 rounded-full" aria-label="Overdue" role="img"></div>
              <div className="flex-1">
                <span className="text-gray-900">Review #3456</span> is now overdue
                <time className="block text-gray-400" dateTime="2025-01-05T21:49:00">5 hours ago</time>
              </div>
            </li>
          </ol>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Button
              variant="ghost"
              size="xs"
              className="w-full text-xs"
              aria-label="View complete activity history"
            >
              <FileText className="h-3 w-3 mr-1" aria-hidden="true" />
              View All Activity
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};