import React from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Calendar,
  Loader2
} from 'lucide-react';

interface Analytics {
  totalReviews: number;
  pendingReviews: number;
  overdueReviews: number;
  completedToday: number;
  averageCompletionTime: number;
  topReviewers: Array<{ userId: string; name: string; count: number }>;
}

interface ReviewSummaryCardsProps {
  analytics: Analytics | null;
  loading?: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  loading = false
}) => {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-500',
          text: 'text-blue-600',
          lightBg: 'bg-blue-50',
          trendPositive: 'text-blue-600',
          trendNegative: 'text-blue-800'
        };
      case 'green':
        return {
          bg: 'bg-green-500',
          text: 'text-green-600',
          lightBg: 'bg-green-50',
          trendPositive: 'text-green-600',
          trendNegative: 'text-green-800'
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-500',
          text: 'text-yellow-600',
          lightBg: 'bg-yellow-50',
          trendPositive: 'text-yellow-600',
          trendNegative: 'text-yellow-800'
        };
      case 'red':
        return {
          bg: 'bg-red-500',
          text: 'text-red-600',
          lightBg: 'bg-red-50',
          trendPositive: 'text-red-600',
          trendNegative: 'text-red-800'
        };
      case 'purple':
        return {
          bg: 'bg-purple-500',
          text: 'text-purple-600',
          lightBg: 'bg-purple-50',
          trendPositive: 'text-purple-600',
          trendNegative: 'text-purple-800'
        };
      default:
        return {
          bg: 'bg-gray-500',
          text: 'text-gray-600',
          lightBg: 'bg-gray-50',
          trendPositive: 'text-gray-600',
          trendNegative: 'text-gray-800'
        };
    }
  };

  const colors = getColorClasses(color);

  return (
    <div className="bg-white overflow-hidden rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`inline-flex items-center justify-center p-3 ${colors.lightBg} rounded-md`}>
              {loading ? (
                <Loader2 className={`h-6 w-6 animate-spin ${colors.text}`} />
              ) : (
                <Icon className={`h-6 w-6 ${colors.text}`} />
              )}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">
                  {loading ? '—' : value}
                </div>
                {trend && !loading && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                    trend.isPositive ? colors.trendPositive : colors.trendNegative
                  }`}>
                    <TrendingUp className={`self-center flex-shrink-0 h-4 w-4 ${
                      trend.isPositive ? '' : 'transform rotate-180'
                    }`} />
                    <span className="sr-only">
                      {trend.isPositive ? 'Increased' : 'Decreased'} by
                    </span>
                    {Math.abs(trend.value)}%
                  </div>
                )}
              </dd>
              {subtitle && (
                <dd className="text-sm text-gray-500 mt-1">
                  {loading ? '—' : subtitle}
                </dd>
              )}
              {trend && !loading && (
                <dd className="text-xs text-gray-400 mt-1">
                  {trend.label}
                </dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReviewSummaryCards: React.FC<ReviewSummaryCardsProps> = ({
  analytics,
  loading = false
}) => {
  // Early return if analytics data is not available
  if (!analytics && !loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  const formatCompletionTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    } else {
      return `${Math.round(hours / 24)}d`;
    }
  };

  const getCompletionRate = () => {
    if (!analytics) return 0;
    const total = analytics.totalReviews;
    const completed = total - analytics.pendingReviews;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const cards: Omit<StatCardProps, 'loading'>[] = [
    {
      title: 'Total Reviews',
      value: analytics?.totalReviews?.toLocaleString() || '0',
      subtitle: `${getCompletionRate()}% completion rate`,
      icon: Clock,
      color: 'blue',
      trend: {
        value: 12,
        isPositive: true,
        label: 'from last week'
      }
    },
    {
      title: 'Pending Reviews',
      value: analytics?.pendingReviews?.toLocaleString() || '0',
      subtitle: 'Awaiting action',
      icon: Calendar,
      color: 'yellow',
      trend: {
        value: 8,
        isPositive: false,
        label: 'from last week'
      }
    },
    {
      title: 'Overdue Reviews',
      value: analytics?.overdueReviews?.toLocaleString() || '0',
      subtitle: 'Past due date',
      icon: AlertTriangle,
      color: 'red',
      trend: analytics && analytics.overdueReviews > 0 ? {
        value: 15,
        isPositive: false,
        label: 'from last week'
      } : undefined
    },
    {
      title: 'Completed Today',
      value: analytics?.completedToday?.toLocaleString() || '0',
      subtitle: 'Reviews finished',
      icon: CheckCircle,
      color: 'green',
      trend: {
        value: 25,
        isPositive: true,
        label: 'from yesterday'
      }
    },
    {
      title: 'Avg Completion Time',
      value: analytics ? formatCompletionTime(analytics.averageCompletionTime) : '—',
      subtitle: 'Time to complete',
      icon: TrendingUp,
      color: 'purple',
      trend: {
        value: 18,
        isPositive: true,
        label: 'improvement from last month'
      }
    },
    {
      title: 'Active Reviewers',
      value: analytics?.topReviewers?.length?.toLocaleString() || '0',
      subtitle: `Top: ${analytics?.topReviewers?.[0]?.name || 'None'}`,
      icon: Users,
      color: 'blue',
      trend: {
        value: 5,
        isPositive: true,
        label: 'from last week'
      }
    }
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card, index) => (
          <StatCard
            key={index}
            {...card}
            loading={loading}
          />
        ))}
      </div>

      {/* Top Reviewers Section */}
      {analytics && analytics.topReviewers.length > 0 && !loading && (
        <div className="mt-8 bg-white overflow-hidden rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Top Reviewers
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Most active reviewers this month
            </p>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-3">
              {analytics.topReviewers.slice(0, 5).map((reviewer, index) => (
                <div key={reviewer.userId} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {reviewer.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {reviewer.userId}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {reviewer.count} reviews
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};