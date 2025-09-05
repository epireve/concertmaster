import React from 'react';
import { 
  Plus, 
  Template, 
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
      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-sm"
    >
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 p-2 rounded-md ${getColorClasses(color)}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              {label}
            </h4>
            {count !== undefined && (
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                color === 'red' 
                  ? 'bg-red-100 text-red-800'
                  : color === 'yellow'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {count}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
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
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            Quick Actions
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {primaryActions.map((action, index) => (
            <QuickActionButton
              key={index}
              {...action}
            />
          ))}
        </div>
      </div>

      {/* Status Overview */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            Review Status
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {statusActions.map((action, index) => (
            <QuickActionButton
              key={index}
              {...action}
            />
          ))}
        </div>
      </div>

      {/* Management */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            Management
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {managementActions.map((action, index) => (
            <QuickActionButton
              key={index}
              {...action}
            />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            Recent Activity
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3 text-xs text-gray-500">
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-2 h-2 mt-1 bg-green-400 rounded-full"></div>
              <div className="flex-1">
                <span className="text-gray-900">John Smith</span> completed review for Form #1234
                <div className="text-gray-400">2 minutes ago</div>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-2 h-2 mt-1 bg-blue-400 rounded-full"></div>
              <div className="flex-1">
                <span className="text-gray-900">Sarah Johnson</span> was assigned to Workflow Review #5678
                <div className="text-gray-400">1 hour ago</div>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-2 h-2 mt-1 bg-yellow-400 rounded-full"></div>
              <div className="flex-1">
                <span className="text-gray-900">New review</span> created for Template #9012
                <div className="text-gray-400">3 hours ago</div>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-2 h-2 mt-1 bg-red-400 rounded-full"></div>
              <div className="flex-1">
                <span className="text-gray-900">Review #3456</span> is now overdue
                <div className="text-gray-400">5 hours ago</div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Button
              variant="ghost"
              size="xs"
              className="w-full text-xs"
            >
              <FileText className="h-3 w-3 mr-1" />
              View All Activity
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};