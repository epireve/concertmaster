/**
 * ReviewCard Component Tests
 * Tests the ReviewCard component functionality and interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReviewCard } from '../../frontend/src/components/reviews/ReviewCard';
import { Review, ReviewStatus, ReviewType, ReviewPriority } from '../../frontend/src/types/reviews';

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Calendar: ({ className }: { className?: string }) => <div className={className} data-testid="calendar-icon" />,
  User: ({ className }: { className?: string }) => <div className={className} data-testid="user-icon" />,
  Clock: ({ className }: { className?: string }) => <div className={className} data-testid="clock-icon" />,
  Star: ({ className }: { className?: string }) => <div className={className} data-testid="star-icon" />,
  Edit3: ({ className }: { className?: string }) => <div className={className} data-testid="edit-icon" />,
  Trash2: ({ className }: { className?: string }) => <div className={className} data-testid="trash-icon" />,
  UserPlus: ({ className }: { className?: string }) => <div className={className} data-testid="userplus-icon" />,
  CheckCircle: ({ className }: { className?: string }) => <div className={className} data-testid="check-icon" />,
  XCircle: ({ className }: { className?: string }) => <div className={className} data-testid="x-icon" />,
  Eye: ({ className }: { className?: string }) => <div className={className} data-testid="eye-icon" />,
  AlertCircle: ({ className }: { className?: string }) => <div className={className} data-testid="alert-icon" />,
}));

describe('ReviewCard', () => {
  const mockReview: Review = {
    id: 'test-review-1',
    title: 'Test Form Review',
    description: 'This is a test review for form validation',
    review_type: ReviewType.FORM_REVIEW,
    status: ReviewStatus.PENDING,
    priority: ReviewPriority.MEDIUM,
    form_id: 'test-form-123',
    workflow_id: undefined,
    rating: 4.5,
    comments: 'Review looks good so far',
    reviewer_notes: 'Some notes from reviewer',
    assigned_to: 'reviewer@example.com',
    assigned_at: '2024-01-15T10:30:00Z',
    completed_at: undefined,
    due_date: '2024-01-22T10:30:00Z',
    created_by: 'creator@example.com',
    updated_by: 'updater@example.com',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T11:00:00Z',
    is_completed: false,
    is_overdue: false
  };

  const mockProps = {
    review: mockReview,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onAssign: jest.fn(),
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onView: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders review basic information correctly', () => {
    render(<ReviewCard {...mockProps} />);

    // Check title
    expect(screen.getByText('Test Form Review')).toBeInTheDocument();
    
    // Check description
    expect(screen.getByText('This is a test review for form validation')).toBeInTheDocument();
    
    // Check status badge
    expect(screen.getByText('Pending')).toBeInTheDocument();
    
    // Check priority badge  
    expect(screen.getByText('Medium')).toBeInTheDocument();
    
    // Check type
    expect(screen.getByText('Form Review')).toBeInTheDocument();
    
    // Check creator
    expect(screen.getByText(/Created by: creator@example.com/)).toBeInTheDocument();
    
    // Check assignee
    expect(screen.getByText(/Assigned to: reviewer@example.com/)).toBeInTheDocument();
  });

  it('displays rating correctly', () => {
    render(<ReviewCard {...mockProps} />);
    
    // Check that star icons are rendered (5 stars total)
    const stars = screen.getAllByTestId('star-icon');
    expect(stars).toHaveLength(5);
    
    // Check rating number
    expect(screen.getByText('(4.5)')).toBeInTheDocument();
  });

  it('shows overdue indicator when review is overdue', () => {
    const overdueReview = { ...mockReview, is_overdue: true };
    render(<ReviewCard review={overdueReview} {...mockProps} />);
    
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('calls onView when title is clicked', () => {
    render(<ReviewCard {...mockProps} />);
    
    const title = screen.getByText('Test Form Review');
    fireEvent.click(title);
    
    expect(mockProps.onView).toHaveBeenCalledWith(mockReview);
  });

  it('calls onEdit when edit button is clicked', () => {
    render(<ReviewCard {...mockProps} />);
    
    const editButton = screen.getByTestId('edit-icon').closest('button');
    fireEvent.click(editButton!);
    
    expect(mockProps.onEdit).toHaveBeenCalledWith(mockReview);
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<ReviewCard {...mockProps} />);
    
    const deleteButton = screen.getByTestId('trash-icon').closest('button');
    fireEvent.click(deleteButton!);
    
    expect(mockProps.onDelete).toHaveBeenCalledWith(mockReview);
  });

  it('shows assign button for pending reviews', () => {
    const pendingReview = { ...mockReview, status: ReviewStatus.PENDING, assigned_to: undefined };
    render(<ReviewCard review={pendingReview} {...mockProps} />);
    
    const assignButton = screen.getByTestId('userplus-icon').closest('button');
    expect(assignButton).toBeInTheDocument();
    
    fireEvent.click(assignButton!);
    expect(mockProps.onAssign).toHaveBeenCalledWith(pendingReview);
  });

  it('shows approve and reject buttons for in-progress reviews', () => {
    const inProgressReview = { ...mockReview, status: ReviewStatus.IN_PROGRESS };
    render(<ReviewCard review={inProgressReview} {...mockProps} />);
    
    // Check approve button
    const approveButton = screen.getByTestId('check-icon').closest('button');
    expect(approveButton).toBeInTheDocument();
    
    // Check reject button
    const rejectButton = screen.getByTestId('x-icon').closest('button');
    expect(rejectButton).toBeInTheDocument();
    
    // Test approve action
    fireEvent.click(approveButton!);
    expect(mockProps.onApprove).toHaveBeenCalledWith(inProgressReview);
    
    // Test reject action
    fireEvent.click(rejectButton!);
    expect(mockProps.onReject).toHaveBeenCalledWith(inProgressReview);
  });

  it('does not show action buttons when showActions is false', () => {
    render(<ReviewCard {...mockProps} showActions={false} />);
    
    // Check that action buttons are not rendered
    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trash-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('userplus-icon')).not.toBeInTheDocument();
  });

  it('renders in compact mode correctly', () => {
    render(<ReviewCard {...mockProps} compact={true} />);
    
    // Title should be smaller in compact mode
    const title = screen.getByText('Test Form Review');
    expect(title).toHaveClass('text-sm');
    
    // Description should not be shown in compact mode
    expect(screen.queryByText('This is a test review for form validation')).not.toBeInTheDocument();
  });

  it('displays comments preview when available', () => {
    render(<ReviewCard {...mockProps} />);
    
    expect(screen.getByText(/Comments:/)).toBeInTheDocument();
    expect(screen.getByText(/Review looks good so far/)).toBeInTheDocument();
  });

  it('shows form and workflow links when available', () => {
    render(<ReviewCard {...mockProps} />);
    
    // Check form link
    expect(screen.getByText(/Form: test-form/)).toBeInTheDocument();
    
    // Add workflow to review and test
    const reviewWithWorkflow = { ...mockReview, workflow_id: 'test-workflow-456' };
    render(<ReviewCard review={reviewWithWorkflow} {...mockProps} />);
    
    expect(screen.getByText(/Workflow: test-work/)).toBeInTheDocument();
  });

  it('displays completion date when review is completed', () => {
    const completedReview = {
      ...mockReview,
      status: ReviewStatus.COMPLETED,
      completed_at: '2024-01-20T14:30:00Z',
      is_completed: true
    };
    
    render(<ReviewCard review={completedReview} {...mockProps} />);
    
    expect(screen.getByText(/Completed:/)).toBeInTheDocument();
  });

  it('shows priority icon for high and critical priorities', () => {
    const highPriorityReview = { ...mockReview, priority: ReviewPriority.HIGH };
    render(<ReviewCard review={highPriorityReview} {...mockProps} />);
    
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
  });

  it('handles missing optional data gracefully', () => {
    const minimalReview: Review = {
      id: 'minimal-review',
      title: 'Minimal Review',
      review_type: ReviewType.FORM_REVIEW,
      status: ReviewStatus.PENDING,
      priority: ReviewPriority.LOW,
      created_by: 'creator@example.com',
      created_at: '2024-01-15T09:00:00Z',
      is_completed: false,
      is_overdue: false
    };
    
    render(<ReviewCard review={minimalReview} {...mockProps} />);
    
    // Should still render basic information
    expect(screen.getByText('Minimal Review')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    
    // Should handle missing data gracefully
    expect(screen.queryByText(/Assigned to:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ReviewCard {...mockProps} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows different status colors correctly', () => {
    const statuses = [
      ReviewStatus.PENDING,
      ReviewStatus.IN_PROGRESS,
      ReviewStatus.COMPLETED,
      ReviewStatus.APPROVED,
      ReviewStatus.REJECTED,
      ReviewStatus.CANCELLED
    ];
    
    statuses.forEach(status => {
      const reviewWithStatus = { ...mockReview, status };
      const { rerender } = render(<ReviewCard review={reviewWithStatus} {...mockProps} />);
      
      // Each status should have different styling
      const statusBadge = screen.getByText(status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
      expect(statusBadge).toBeInTheDocument();
      
      rerender(<div />); // Clean up
    });
  });
});