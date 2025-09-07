import React from 'react';
import { Plus, Filter, Download, RefreshCw, BarChart3 } from '../../../utils/iconFallbacks';

interface ReviewDashboardProps {
  onCreateReview?: () => void;
  onViewReview?: (reviewId: string) => void;
}

export const ReviewDashboardSimple: React.FC<ReviewDashboardProps> = ({
  onCreateReview,
  onViewReview
}) => {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header - Consistent with WorkflowToolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-medium text-gray-900">
              Review Management System
            </h2>
            <span className="text-sm text-gray-500">
              Manage and track review processes across your organization
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter Button */}
            <button
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Filter size={16} className="mr-2" />
              Filter
            </button>

            {/* Action Controls */}
            <div className="flex items-center space-x-1 border border-gray-300 rounded-md">
              <button
                className="p-2 hover:bg-gray-50 rounded-l-md"
                title="Refresh Data"
              >
                <RefreshCw size={16} />
              </button>
              <button
                className="p-2 hover:bg-gray-50"
                title="Export Data"
              >
                <Download size={16} />
              </button>
              <button
                className="p-2 hover:bg-gray-50 rounded-r-md"
                title="View Analytics"
              >
                <BarChart3 size={16} />
              </button>
            </div>

            {/* New Review Button */}
            <button
              onClick={onCreateReview}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus size={16} className="mr-2" />
              New Review
            </button>
          </div>
        </div>

        {/* Quick Actions - Similar to WorkflowToolbar */}
        <div className="mt-3 flex items-center space-x-2">
          <button
            onClick={() => console.log('Create code review')}
            className="inline-flex items-center px-2 py-1 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100"
          >
            Code Review
          </button>
          <button
            onClick={() => console.log('Create design review')}
            className="inline-flex items-center px-2 py-1 border border-green-300 text-xs font-medium rounded text-green-700 bg-green-50 hover:bg-green-100"
          >
            Design Review
          </button>
          <button
            onClick={() => console.log('Create security review')}
            className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100"
          >
            Security Review
          </button>
          <button
            onClick={() => console.log('Create performance review')}
            className="inline-flex items-center px-2 py-1 border border-purple-300 text-xs font-medium rounded text-purple-700 bg-purple-50 hover:bg-purple-100"
          >
            Performance Review
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4">
        {/* Summary Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Reviews</h3>
            <p className="text-2xl font-bold text-gray-900">127</p>
            <p className="text-xs text-green-600 mt-1">↑ 12% from last month</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Average Rating</h3>
            <p className="text-2xl font-bold text-gray-900">4.2</p>
            <p className="text-xs text-green-600 mt-1">↑ 0.3 from last month</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Pending Reviews</h3>
            <p className="text-2xl font-bold text-gray-900">8</p>
            <p className="text-xs text-yellow-600 mt-1">⚡ Requires attention</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Completion Rate</h3>
            <p className="text-2xl font-bold text-gray-900">94%</p>
            <p className="text-xs text-green-600 mt-1">↑ 2% from last month</p>
          </div>
        </div>

        {/* Reviews List */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Recent Reviews</h2>
              <span className="text-sm text-gray-500">127 total</span>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {/* Mock Review Items */}
              {[
                { id: 1, type: 'Code Review', title: 'User Authentication Module', status: 'approved', rating: 5, reviewer: 'John Doe' },
                { id: 2, type: 'Design Review', title: 'Dashboard UI Components', status: 'pending', rating: 4, reviewer: 'Jane Smith' },
                { id: 3, type: 'Security Review', title: 'API Security Assessment', status: 'in-review', rating: 4, reviewer: 'Mike Johnson' },
                { id: 4, type: 'Performance Review', title: 'Database Query Optimization', status: 'approved', rating: 5, reviewer: 'Sarah Chen' },
              ].map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          review.type === 'Code Review' ? 'bg-blue-100 text-blue-800' :
                          review.type === 'Design Review' ? 'bg-green-100 text-green-800' :
                          review.type === 'Security Review' ? 'bg-red-100 text-red-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {review.type}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          review.status === 'approved' ? 'bg-green-100 text-green-800' :
                          review.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {review.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 mt-2">
                        {review.title}
                      </h4>
                      <div className="flex items-center mt-2 space-x-4">
                        <div className="flex items-center">
                          <span className="text-yellow-400">
                            {'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}
                          </span>
                          <span className="ml-1 text-xs text-gray-500">{review.rating}.0</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          Reviewed by {review.reviewer}
                        </span>
                      </div>
                    </div>
                    <button
                      className="ml-4 inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      onClick={() => onViewReview?.(`review-${review.id}`)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};