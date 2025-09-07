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
  const [announceFilters, setAnnounceFilters] = useState('');
  
  // Announce filter changes to screen readers
  React.useEffect(() => {
    const activeFiltersCount = [
      filters.search,
      filters.status?.length,
      filters.priority?.length,
      filters.itemType,
      filters.dueDate,
      filters.assignedTo,
      filters.tags?.length
    ].filter(Boolean).length;
    
    if (activeFiltersCount > 0) {
      setAnnounceFilters(`${activeFiltersCount} filter${activeFiltersCount !== 1 ? 's' : ''} applied`);
    } else {
      setAnnounceFilters('No filters applied');
    }
  }, [filters]);

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
    <div className="space-y-6" role="form" aria-label="Review filters">
      {/* Screen reader announcement */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announceFilters}
      </div>
      
      {/* Search */}
      <div>
        <label htmlFor="search-input" className="block text-xs font-medium text-gray-700 mb-2">
          <Search className="h-3 w-3 inline mr-1" aria-hidden="true" />
          Search
        </label>
        <input
          id="search-input"
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search reviews..."
          disabled={loading}
          aria-describedby="search-description"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
        <div id="search-description" className="sr-only">
          Search through review titles, descriptions, and content
        </div>
      </div>

      {/* Status Filter */}
      <fieldset>
        <legend className="block text-xs font-medium text-gray-700 mb-2">
          Status
        </legend>
        <div className="space-y-1" role="group" aria-labelledby="status-group-label">
          <div id="status-group-label" className="sr-only">Select review statuses to filter by</div>
          {statusOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded focus-within:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={filters.status?.includes(option.value) || false}
                onChange={() => handleStatusToggle(option.value)}
                disabled={loading}
                aria-describedby={`status-${option.value}-description`}
                className="h-3 w-3 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className={`ml-2 text-xs flex items-center text-${option.color}-700`}>
                <span className={`inline-block w-2 h-2 rounded-full bg-${option.color}-400 mr-2`} aria-hidden="true"></span>
                {option.label}
              </span>
              <div id={`status-${option.value}-description`} className="sr-only">
                Filter by {option.label.toLowerCase()} reviews
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Priority Filter */}
      <fieldset>
        <legend className="block text-xs font-medium text-gray-700 mb-2">
          Priority
        </legend>
        <div className="space-y-1" role="group" aria-labelledby="priority-group-label">
          <div id="priority-group-label" className="sr-only">Select priority levels to filter by</div>
          {priorityOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded focus-within:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={filters.priority?.includes(option.value) || false}
                onChange={() => handlePriorityToggle(option.value)}
                disabled={loading}
                aria-describedby={`priority-${option.value}-description`}
                className="h-3 w-3 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className={`ml-2 text-xs flex items-center text-${option.color}-700`}>
                <span className={`inline-block w-2 h-2 rounded-full bg-${option.color}-400 mr-2`} aria-hidden="true"></span>
                {option.label}
              </span>
              <div id={`priority-${option.value}-description`} className="sr-only">
                Filter by {option.label.toLowerCase()} priority reviews
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Item Type Filter */}
      <div>
        <label htmlFor="item-type-select" className="block text-xs font-medium text-gray-700 mb-2">
          <Tag className="h-3 w-3 inline mr-1" aria-hidden="true" />
          Item Type
        </label>
        <select
          id="item-type-select"
          value={filters.itemType || ''}
          onChange={(e) => handleItemTypeChange(e.target.value || undefined)}
          disabled={loading}
          aria-describedby="item-type-description"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">All Types</option>
          {itemTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div id="item-type-description" className="sr-only">
          Filter reviews by the type of item being reviewed
        </div>
      </div>

      {/* Due Date Filter */}
      <fieldset>
        <legend className="block text-xs font-medium text-gray-700 mb-2">
          <Calendar className="h-3 w-3 inline mr-1" aria-hidden="true" />
          Due Date
        </legend>
        
        {/* Preset Options */}
        <div className="space-y-1 mb-3" role="group" aria-labelledby="date-presets-label">
          <div id="date-presets-label" className="sr-only">Quick date range options</div>
          {dueDatePresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleDueDatePreset(preset)}
              disabled={loading}
              aria-describedby={`preset-${preset.label.replace(/\s+/g, '-').toLowerCase()}-description`}
              className="w-full text-left px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-50"
            >
              {preset.label}
              <div id={`preset-${preset.label.replace(/\s+/g, '-').toLowerCase()}-description`} className="sr-only">
                Filter reviews due {preset.label.toLowerCase()}
              </div>
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        <div className="space-y-2">
          <label htmlFor="start-date" className="block text-xs font-medium text-gray-600">From date</label>
          <input
            id="start-date"
            type="date"
            value={filters.dueDate?.start ? filters.dueDate.start.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const start = e.target.value ? new Date(e.target.value) : undefined;
              handleCustomDateRange(
                start ? { start, end: filters.dueDate?.end || start } : undefined
              );
            }}
            disabled={loading}
            aria-describedby="start-date-description"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <div id="start-date-description" className="sr-only">Select the start date for the due date range filter</div>
          
          <label htmlFor="end-date" className="block text-xs font-medium text-gray-600">To date</label>
          <input
            id="end-date"
            type="date"
            value={filters.dueDate?.end ? filters.dueDate.end.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const end = e.target.value ? new Date(e.target.value) : undefined;
              handleCustomDateRange(
                end ? { start: filters.dueDate?.start || end, end } : undefined
              );
            }}
            disabled={loading}
            aria-describedby="end-date-description"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <div id="end-date-description" className="sr-only">Select the end date for the due date range filter</div>
        </div>

        {filters.dueDate && (
          <button
            type="button"
            onClick={() => handleCustomDateRange(undefined)}
            disabled={loading}
            aria-label="Clear due date filter"
            className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:text-gray-700 disabled:opacity-50"
          >
            Clear Date Filter
          </button>
        )}
      </fieldset>

      {/* Assignee Filter */}
      <div>
        <label htmlFor="assignee-input" className="block text-xs font-medium text-gray-700 mb-2">
          <User className="h-3 w-3 inline mr-1" aria-hidden="true" />
          Assigned To
        </label>
        <input
          id="assignee-input"
          type="text"
          value={filters.assignedTo || ''}
          onChange={(e) => onFiltersChange({ assignedTo: e.target.value || undefined })}
          placeholder="Enter user ID or email..."
          disabled={loading}
          aria-describedby="assignee-description"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
        <div id="assignee-description" className="sr-only">
          Filter reviews by the assigned user ID or email address
        </div>
      </div>

      {/* Tags Filter */}
      <div>
        <label htmlFor="tags-input" className="block text-xs font-medium text-gray-700 mb-2">
          Tags
        </label>
        <input
          id="tags-input"
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
          aria-describedby="tags-description"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
        <div id="tags-description" className="sr-only">
          Filter reviews by tags. Enter multiple tags separated by commas
        </div>
      </div>
    </div>
  );
};