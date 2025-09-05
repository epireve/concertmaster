import React, { useState } from 'react';
import { Search, Calendar, User, Tag } from 'lucide-react';
import { Button } from '../../shared';
import type { 
  ReviewFilters as ReviewFiltersType, 
  ReviewStatus, 
  Priority,
  DateRange
} from '../../../types/reviews';

interface ReviewFiltersProps {
  filters: ReviewFiltersType;
  onFiltersChange: (filters: Partial<ReviewFiltersType>) => void;
  loading?: boolean;
}

const statusOptions: { value: ReviewStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'in_progress', label: 'In Progress', color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'purple' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'completed', label: 'Completed', color: 'emerald' },
  { value: 'archived', label: 'Archived', color: 'slate' }
];

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'green' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'red' },
  { value: 'critical', label: 'Critical', color: 'red' }
];

const itemTypeOptions = [
  { value: 'form_submission', label: 'Form Submission' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'template', label: 'Template' },
  { value: 'document', label: 'Document' },
  { value: 'code_review', label: 'Code Review' },
  { value: 'design_review', label: 'Design Review' },
  { value: 'other', label: 'Other' }
];

const dueDatePresets = [
  { label: 'Today', getValue: () => ({ start: new Date(), end: new Date() }) },
  { label: 'Tomorrow', getValue: () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: tomorrow, end: tomorrow };
  }},
  { label: 'This Week', getValue: () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }},
  { label: 'Next Week', getValue: () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() + 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }},
  { label: 'Overdue', getValue: () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: new Date('2020-01-01'), end: yesterday };
  }}
];

export const ReviewFilters: React.FC<ReviewFiltersProps> = ({
  filters,
  onFiltersChange,
  loading = false
}) => {
  const [searchValue, setSearchValue] = useState(filters.search || '');

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    // Debounce search
    const timer = setTimeout(() => {
      onFiltersChange({ search: value || undefined });
    }, 300);
    return () => clearTimeout(timer);
  };

  const handleStatusToggle = (status: ReviewStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    onFiltersChange({ 
      status: newStatuses.length > 0 ? newStatuses : undefined 
    });
  };

  const handlePriorityToggle = (priority: Priority) => {
    const currentPriorities = filters.priority || [];
    const newPriorities = currentPriorities.includes(priority)
      ? currentPriorities.filter(p => p !== priority)
      : [...currentPriorities, priority];
    
    onFiltersChange({ 
      priority: newPriorities.length > 0 ? newPriorities : undefined 
    });
  };

  const handleItemTypeChange = (itemType: string | undefined) => {
    onFiltersChange({ itemType });
  };

  const handleDueDatePreset = (preset: typeof dueDatePresets[0]) => {
    const dateRange = preset.getValue();
    onFiltersChange({ dueDate: dateRange });
  };

  const handleCustomDateRange = (range: DateRange | undefined) => {
    onFiltersChange({ dueDate: range });
  };

  const getStatusColor = (status: ReviewStatus) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.color || 'gray';
  };

  const getPriorityColor = (priority: Priority) => {
    const option = priorityOptions.find(opt => opt.value === priority);
    return option?.color || 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          <Search className="h-3 w-3 inline mr-1" />
          Search
        </label>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search reviews..."
          disabled={loading}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Status Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Status
        </label>
        <div className="space-y-1">
          {statusOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                checked={filters.status?.includes(option.value) || false}
                onChange={() => handleStatusToggle(option.value)}
                disabled={loading}
                className="h-3 w-3 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className={`ml-2 text-xs flex items-center text-${option.color}-700`}>
                <span className={`inline-block w-2 h-2 rounded-full bg-${option.color}-400 mr-2`}></span>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Priority Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Priority
        </label>
        <div className="space-y-1">
          {priorityOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                checked={filters.priority?.includes(option.value) || false}
                onChange={() => handlePriorityToggle(option.value)}
                disabled={loading}
                className="h-3 w-3 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className={`ml-2 text-xs flex items-center text-${option.color}-700`}>
                <span className={`inline-block w-2 h-2 rounded-full bg-${option.color}-400 mr-2`}></span>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Item Type Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          <Tag className="h-3 w-3 inline mr-1" />
          Item Type
        </label>
        <select
          value={filters.itemType || ''}
          onChange={(e) => handleItemTypeChange(e.target.value || undefined)}
          disabled={loading}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">All Types</option>
          {itemTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Due Date Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          <Calendar className="h-3 w-3 inline mr-1" />
          Due Date
        </label>
        
        {/* Preset Options */}
        <div className="space-y-1 mb-3">
          {dueDatePresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleDueDatePreset(preset)}
              disabled={loading}
              className="w-full text-left px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 rounded disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        <div className="space-y-2">
          <input
            type="date"
            value={filters.dueDate?.start ? filters.dueDate.start.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const start = e.target.value ? new Date(e.target.value) : undefined;
              handleCustomDateRange(
                start ? { start, end: filters.dueDate?.end || start } : undefined
              );
            }}
            disabled={loading}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <input
            type="date"
            value={filters.dueDate?.end ? filters.dueDate.end.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const end = e.target.value ? new Date(e.target.value) : undefined;
              handleCustomDateRange(
                end ? { start: filters.dueDate?.start || end, end } : undefined
              );
            }}
            disabled={loading}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        {filters.dueDate && (
          <button
            type="button"
            onClick={() => handleCustomDateRange(undefined)}
            disabled={loading}
            className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Clear Date Filter
          </button>
        )}
      </div>

      {/* Assignee Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          <User className="h-3 w-3 inline mr-1" />
          Assigned To
        </label>
        <input
          type="text"
          value={filters.assignedTo || ''}
          onChange={(e) => onFiltersChange({ assignedTo: e.target.value || undefined })}
          placeholder="Enter user ID or email..."
          disabled={loading}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Tags Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Tags
        </label>
        <input
          type="text"
          value={filters.tags?.join(', ') || ''}
          onChange={(e) => {
            const tags = e.target.value
              .split(',')
              .map(tag => tag.trim())
              .filter(Boolean);
            onFiltersChange({ tags: tags.length > 0 ? tags : undefined });
          }}
          placeholder="Enter comma-separated tags..."
          disabled={loading}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
      </div>
    </div>
  );
};