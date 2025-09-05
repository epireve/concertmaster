import React, { useMemo } from 'react';
import { ReviewSummaryProps } from '../../types/review';
import { DisplayRating } from './RatingSystem';

export const ReviewSummary: React.FC<ReviewSummaryProps> = ({
  statistics,
  targetId,
  targetType,
  showTrends = true,
  timeRange = 'month'
}) => {
  // Calculate percentages for rating distribution
  const ratingPercentages = useMemo(() => {
    const total = statistics.totalReviews;
    if (total === 0) return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    return {
      5: Math.round((statistics.ratingDistribution[5] / total) * 100),
      4: Math.round((statistics.ratingDistribution[4] / total) * 100),
      3: Math.round((statistics.ratingDistribution[3] / total) * 100),
      2: Math.round((statistics.ratingDistribution[2] / total) * 100),
      1: Math.round((statistics.ratingDistribution[1] / total) * 100)
    };
  }, [statistics]);

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Calculate trend indicators
  const recentActivity = statistics.recentActivity.slice(-7); // Last 7 data points
  const currentAverage = recentActivity[recentActivity.length - 1]?.averageRating || 0;
  const previousAverage = recentActivity[recentActivity.length - 2]?.averageRating || 0;
  const trend = currentAverage - previousAverage;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Review Summary
        </h3>
        {(targetId || targetType) && (
          <p className="text-sm text-gray-600 mt-1">
            {targetType && <span className="capitalize">{targetType}</span>}
            {targetId && targetType && <span> • </span>}
            {targetId && <code className="text-xs">{targetId}</code>}
          </p>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Overall Rating */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-4 mb-2">
            <span className="text-4xl font-bold text-gray-900">
              {statistics.averageRating.toFixed(1)}
            </span>
            <div className="text-center">
              <DisplayRating 
                rating={statistics.averageRating} 
                size="lg" 
                showValue={false}
              />
              <p className="text-sm text-gray-600 mt-1">
                {formatNumber(statistics.totalReviews)} reviews
              </p>
            </div>
          </div>

          {/* Trend Indicator */}
          {showTrends && trend !== 0 && (
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              trend > 0 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <span className="mr-1">
                {trend > 0 ? '↗️' : '↘️'}
              </span>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)} from last period
            </div>
          )}
        </div>

        {/* Rating Distribution */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Rating Distribution</h4>
          {[5, 4, 3, 2, 1].map((rating) => (
            <div key={rating} className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 w-12">
                <span className="text-sm text-gray-600">{rating}</span>
                <span className="text-yellow-400">★</span>
              </div>
              
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-yellow-400 h-2 transition-all duration-500"
                    style={{ width: `${ratingPercentages[rating as keyof typeof ratingPercentages]}%` }}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2 min-w-[80px]">
                <span className="text-sm text-gray-600 w-8 text-right">
                  {ratingPercentages[rating as keyof typeof ratingPercentages]}%
                </span>
                <span className="text-xs text-gray-500">
                  ({formatNumber(statistics.ratingDistribution[rating as keyof typeof statistics.ratingDistribution])})
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-semibold text-blue-600">
              {Math.round((statistics.ratingDistribution[4] + statistics.ratingDistribution[5]) / statistics.totalReviews * 100)}%
            </div>
            <div className="text-sm text-blue-700">Positive</div>
            <div className="text-xs text-gray-600">4-5 stars</div>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-semibold text-red-600">
              {Math.round((statistics.ratingDistribution[1] + statistics.ratingDistribution[2]) / statistics.totalReviews * 100)}%
            </div>
            <div className="text-sm text-red-700">Negative</div>
            <div className="text-xs text-gray-600">1-2 stars</div>
          </div>
        </div>

        {/* Top Tags */}
        {statistics.topTags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Common Topics</h4>
            <div className="flex flex-wrap gap-2">
              {statistics.topTags.slice(0, 8).map(({ tag, count }) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  #{tag}
                  <span className="ml-1 text-gray-500">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity Trend */}
        {showTrends && recentActivity.length > 1 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Recent Activity ({timeRange})
            </h4>
            <div className="relative h-16 bg-gray-50 rounded-lg p-3">
              {/* Simple line chart representation */}
              <div className="relative h-full flex items-end space-x-1">
                {recentActivity.map((activity, index) => {
                  const height = (activity.count / Math.max(...recentActivity.map(a => a.count))) * 100;
                  const isLast = index === recentActivity.length - 1;
                  
                  return (
                    <div
                      key={activity.date.toISOString()}
                      className={`flex-1 rounded-t ${
                        isLast ? 'bg-blue-500' : 'bg-blue-300'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${activity.date.toLocaleDateString()}: ${activity.count} reviews (avg ${activity.averageRating.toFixed(1)}★)`}
                    />
                  );
                })}
              </div>
              
              {/* Trend line overlay could go here */}
              <div className="absolute bottom-0 left-3 right-3 text-xs text-gray-500 flex justify-between pt-1">
                <span>{recentActivity[0]?.date.toLocaleDateString()}</span>
                <span>{recentActivity[recentActivity.length - 1]?.date.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Top Reviewers */}
        {statistics.topAuthors.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Top Reviewers</h4>
            <div className="space-y-2">
              {statistics.topAuthors.slice(0, 5).map((authorStat, index) => (
                <div key={authorStat.author.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 w-4">
                      {index + 1}.
                    </span>
                    {authorStat.author.avatar ? (
                      <img
                        src={authorStat.author.avatar}
                        alt={authorStat.author.name}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {authorStat.author.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-1">
                        <span className="text-sm font-medium text-gray-900">
                          {authorStat.author.name}
                        </span>
                        {authorStat.author.verified && (
                          <span className="text-blue-500 text-xs" title="Verified reviewer">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {authorStat.reviewCount} reviews
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {authorStat.averageRating.toFixed(1)}★
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Distribution */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Review Status</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(statistics.statusDistribution)
              .filter(([_, count]) => count > 0)
              .map(([status, count]) => (
                <div key={status} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 capitalize">{status}:</span>
                  <span className="font-medium text-gray-900">
                    {formatNumber(count)}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};

// Compact version for dashboards
export const CompactReviewSummary: React.FC<Omit<ReviewSummaryProps, 'showTrends'>> = ({
  statistics,
  targetId,
  targetType
}) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {statistics.averageRating.toFixed(1)}
          </div>
          <DisplayRating 
            rating={statistics.averageRating} 
            size="sm" 
            showValue={false}
          />
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-900">
            {statistics.totalReviews} reviews
          </p>
          <p className="text-xs text-gray-500">
            {Math.round((statistics.ratingDistribution[4] + statistics.ratingDistribution[5]) / statistics.totalReviews * 100)}% positive
          </p>
        </div>
      </div>
      
      <div className="text-right">
        <button className="text-sm text-blue-600 hover:text-blue-700">
          View Details →
        </button>
      </div>
    </div>
  </div>
);