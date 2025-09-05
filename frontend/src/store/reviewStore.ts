/**
 * Review Store - Zustand State Management
 * Manages review system state and API operations
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { 
  Review, 
  ReviewStats, 
  ReviewFilters, 
  ReviewSortConfig,
  ReviewListResponse,
  CreateReviewRequest,
  UpdateReviewRequest,
  AssignReviewRequest,
  ReviewSearchParams,
  ReviewNotification,
  ReviewHistory,
  ReviewCriteria,
  CreateCriteriaRequest
} from '../types/reviews';
import { reviewApi } from '../api/reviews';

interface ReviewState {
  // Data
  reviews: Review[];
  selectedReview: Review | null;
  reviewStats: ReviewStats | null;
  reviewHistory: ReviewHistory[];
  reviewCriteria: ReviewCriteria[];
  notifications: ReviewNotification[];
  
  // UI State
  loading: boolean;
  error: string | null;
  filters: ReviewFilters;
  sortConfig: ReviewSortConfig;
  pagination: {
    skip: number;
    limit: number;
    total: number;
  };
  
  // Modals and UI flags
  showCreateModal: boolean;
  showEditModal: boolean;
  showAssignModal: boolean;
  showDeleteModal: boolean;
  showHistoryModal: boolean;
  
  // Actions
  fetchReviews: (params?: ReviewSearchParams) => Promise<void>;
  fetchReview: (id: string) => Promise<void>;
  createReview: (data: CreateReviewRequest) => Promise<void>;
  updateReview: (id: string, data: UpdateReviewRequest) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  assignReview: (id: string, data: AssignReviewRequest) => Promise<void>;
  approveReview: (id: string, comments?: string) => Promise<void>;
  rejectReview: (id: string, comments: string) => Promise<void>;
  fetchReviewStats: () => Promise<void>;
  fetchReviewHistory: (reviewId: string) => Promise<void>;
  fetchReviewCriteria: (reviewId: string) => Promise<void>;
  addReviewCriteria: (reviewId: string, data: CreateCriteriaRequest) => Promise<void>;
  
  // UI Actions
  setFilters: (filters: Partial<ReviewFilters>) => void;
  setSortConfig: (config: ReviewSortConfig) => void;
  setPagination: (pagination: Partial<ReviewState['pagination']>) => void;
  setSelectedReview: (review: Review | null) => void;
  clearError: () => void;
  addNotification: (notification: Omit<ReviewNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  
  // Modal Actions
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (review: Review) => void;
  closeEditModal: () => void;
  openAssignModal: (review: Review) => void;
  closeAssignModal: () => void;
  openDeleteModal: (review: Review) => void;
  closeDeleteModal: () => void;
  openHistoryModal: (review: Review) => void;
  closeHistoryModal: () => void;
}

const initialFilters: ReviewFilters = {
  status: [],
  type: [],
  priority: [],
  assignee: undefined,
  dateRange: undefined
};

const initialSortConfig: ReviewSortConfig = {
  field: 'created_at',
  direction: 'desc'
};

const initialPagination = {
  skip: 0,
  limit: 20,
  total: 0
};

export const useReviewStore = create<ReviewState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        reviews: [],
        selectedReview: null,
        reviewStats: null,
        reviewHistory: [],
        reviewCriteria: [],
        notifications: [],
        
        loading: false,
        error: null,
        filters: initialFilters,
        sortConfig: initialSortConfig,
        pagination: initialPagination,
        
        showCreateModal: false,
        showEditModal: false,
        showAssignModal: false,
        showDeleteModal: false,
        showHistoryModal: false,
        
        // Data Actions
        fetchReviews: async (params?: ReviewSearchParams) => {
          set({ loading: true, error: null });
          try {
            const { filters, sortConfig, pagination } = get();
            
            // Merge current state with provided params
            const searchParams: ReviewSearchParams = {
              ...params,
              status: params?.status || (filters.status.length > 0 ? filters.status : undefined),
              review_type: params?.review_type || (filters.type.length > 0 ? filters.type : undefined),
              priority: params?.priority || (filters.priority.length > 0 ? filters.priority : undefined),
              assigned_to: params?.assigned_to || filters.assignee,
              sort_by: params?.sort_by || sortConfig.field,
              sort_order: params?.sort_order || sortConfig.direction,
              skip: params?.skip ?? pagination.skip,
              limit: params?.limit ?? pagination.limit,
            };
            
            const response = await reviewApi.getReviews(searchParams);
            
            set({
              reviews: response.reviews,
              pagination: {
                skip: response.skip,
                limit: response.limit,
                total: response.total
              },
              loading: false
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch reviews',
              loading: false 
            });
          }
        },
        
        fetchReview: async (id: string) => {
          set({ loading: true, error: null });
          try {
            const review = await reviewApi.getReview(id);
            set({ selectedReview: review, loading: false });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch review',
              loading: false 
            });
          }
        },
        
        createReview: async (data: CreateReviewRequest) => {
          set({ loading: true, error: null });
          try {
            const review = await reviewApi.createReview(data);
            const { reviews } = get();
            
            set({ 
              reviews: [review, ...reviews],
              loading: false,
              showCreateModal: false
            });
            
            get().addNotification({
              type: 'success',
              title: 'Review Created',
              message: `Review "${review.title}" has been created successfully.`,
              review_id: review.id
            });
            
            // Refresh stats
            get().fetchReviewStats();
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to create review',
              loading: false 
            });
          }
        },
        
        updateReview: async (id: string, data: UpdateReviewRequest) => {
          set({ loading: true, error: null });
          try {
            const updatedReview = await reviewApi.updateReview(id, data);
            const { reviews } = get();
            
            const updatedReviews = reviews.map(review => 
              review.id === id ? updatedReview : review
            );
            
            set({ 
              reviews: updatedReviews,
              selectedReview: updatedReview,
              loading: false,
              showEditModal: false
            });
            
            get().addNotification({
              type: 'success',
              title: 'Review Updated',
              message: `Review "${updatedReview.title}" has been updated successfully.`,
              review_id: updatedReview.id
            });
            
            get().fetchReviewStats();
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to update review',
              loading: false 
            });
          }
        },
        
        deleteReview: async (id: string) => {
          set({ loading: true, error: null });
          try {
            await reviewApi.deleteReview(id);
            const { reviews } = get();
            
            const review = reviews.find(r => r.id === id);
            const updatedReviews = reviews.filter(review => review.id !== id);
            
            set({ 
              reviews: updatedReviews,
              selectedReview: null,
              loading: false,
              showDeleteModal: false
            });
            
            get().addNotification({
              type: 'success',
              title: 'Review Deleted',
              message: review ? `Review "${review.title}" has been deleted.` : 'Review deleted successfully.'
            });
            
            get().fetchReviewStats();
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to delete review',
              loading: false 
            });
          }
        },
        
        assignReview: async (id: string, data: AssignReviewRequest) => {
          set({ loading: true, error: null });
          try {
            await reviewApi.assignReview(id, data);
            
            // Refetch the review to get updated data
            await get().fetchReview(id);
            
            // Update the review in the list
            const { reviews, selectedReview } = get();
            if (selectedReview) {
              const updatedReviews = reviews.map(review => 
                review.id === id ? selectedReview : review
              );
              set({ reviews: updatedReviews });
            }
            
            set({ loading: false, showAssignModal: false });
            
            get().addNotification({
              type: 'success',
              title: 'Review Assigned',
              message: `Review has been assigned to ${data.assigned_to}.`,
              review_id: id
            });
            
            get().fetchReviewStats();
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to assign review',
              loading: false 
            });
          }
        },
        
        approveReview: async (id: string, comments?: string) => {
          set({ loading: true, error: null });
          try {
            const updatedReview = await reviewApi.approveReview(id, comments);
            const { reviews } = get();
            
            const updatedReviews = reviews.map(review => 
              review.id === id ? updatedReview : review
            );
            
            set({ 
              reviews: updatedReviews,
              selectedReview: updatedReview,
              loading: false
            });
            
            get().addNotification({
              type: 'success',
              title: 'Review Approved',
              message: `Review "${updatedReview.title}" has been approved.`,
              review_id: updatedReview.id
            });
            
            get().fetchReviewStats();
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to approve review',
              loading: false 
            });
          }
        },
        
        rejectReview: async (id: string, comments: string) => {
          set({ loading: true, error: null });
          try {
            const updatedReview = await reviewApi.rejectReview(id, comments);
            const { reviews } = get();
            
            const updatedReviews = reviews.map(review => 
              review.id === id ? updatedReview : review
            );
            
            set({ 
              reviews: updatedReviews,
              selectedReview: updatedReview,
              loading: false
            });
            
            get().addNotification({
              type: 'warning',
              title: 'Review Rejected',
              message: `Review "${updatedReview.title}" has been rejected.`,
              review_id: updatedReview.id
            });
            
            get().fetchReviewStats();
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to reject review',
              loading: false 
            });
          }
        },
        
        fetchReviewStats: async () => {
          try {
            const stats = await reviewApi.getReviewStats();
            set({ reviewStats: stats });
          } catch (error) {
            console.error('Failed to fetch review stats:', error);
          }
        },
        
        fetchReviewHistory: async (reviewId: string) => {
          set({ loading: true });
          try {
            const history = await reviewApi.getReviewHistory(reviewId);
            set({ reviewHistory: history, loading: false });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch review history',
              loading: false 
            });
          }
        },
        
        fetchReviewCriteria: async (reviewId: string) => {
          try {
            const criteria = await reviewApi.getReviewCriteria(reviewId);
            set({ reviewCriteria: criteria });
          } catch (error) {
            console.error('Failed to fetch review criteria:', error);
          }
        },
        
        addReviewCriteria: async (reviewId: string, data: CreateCriteriaRequest) => {
          set({ loading: true, error: null });
          try {
            const criteria = await reviewApi.addReviewCriteria(reviewId, data);
            const { reviewCriteria } = get();
            
            set({ 
              reviewCriteria: [...reviewCriteria, criteria],
              loading: false
            });
            
            get().addNotification({
              type: 'success',
              title: 'Criteria Added',
              message: `Review criteria "${criteria.name}" has been added.`
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to add criteria',
              loading: false 
            });
          }
        },
        
        // UI Actions
        setFilters: (newFilters: Partial<ReviewFilters>) => {
          const { filters } = get();
          const updatedFilters = { ...filters, ...newFilters };
          set({ filters: updatedFilters, pagination: { ...initialPagination } });
          
          // Auto-fetch with new filters
          get().fetchReviews();
        },
        
        setSortConfig: (config: ReviewSortConfig) => {
          set({ sortConfig: config, pagination: { ...initialPagination } });
          
          // Auto-fetch with new sort
          get().fetchReviews();
        },
        
        setPagination: (newPagination: Partial<ReviewState['pagination']>) => {
          const { pagination } = get();
          const updatedPagination = { ...pagination, ...newPagination };
          set({ pagination: updatedPagination });
          
          // Auto-fetch with new pagination
          get().fetchReviews();
        },
        
        setSelectedReview: (review: Review | null) => {
          set({ selectedReview: review });
        },
        
        clearError: () => {
          set({ error: null });
        },
        
        addNotification: (notification: Omit<ReviewNotification, 'id' | 'timestamp' | 'read'>) => {
          const { notifications } = get();
          const newNotification: ReviewNotification = {
            ...notification,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            read: false
          };
          
          set({ notifications: [newNotification, ...notifications] });
        },
        
        markNotificationRead: (id: string) => {
          const { notifications } = get();
          const updatedNotifications = notifications.map(notification =>
            notification.id === id ? { ...notification, read: true } : notification
          );
          set({ notifications: updatedNotifications });
        },
        
        clearNotifications: () => {
          set({ notifications: [] });
        },
        
        // Modal Actions
        openCreateModal: () => set({ showCreateModal: true, error: null }),
        closeCreateModal: () => set({ showCreateModal: false, error: null }),
        
        openEditModal: (review: Review) => {
          set({ selectedReview: review, showEditModal: true, error: null });
        },
        closeEditModal: () => set({ showEditModal: false, error: null }),
        
        openAssignModal: (review: Review) => {
          set({ selectedReview: review, showAssignModal: true, error: null });
        },
        closeAssignModal: () => set({ showAssignModal: false, error: null }),
        
        openDeleteModal: (review: Review) => {
          set({ selectedReview: review, showDeleteModal: true, error: null });
        },
        closeDeleteModal: () => set({ showDeleteModal: false, error: null }),
        
        openHistoryModal: (review: Review) => {
          set({ selectedReview: review, showHistoryModal: true });
          get().fetchReviewHistory(review.id);
        },
        closeHistoryModal: () => set({ showHistoryModal: false, reviewHistory: [] }),
      }),
      {
        name: 'review-store',
        partialize: (state) => ({
          filters: state.filters,
          sortConfig: state.sortConfig,
          pagination: state.pagination,
        }),
      }
    ),
    {
      name: 'review-store',
    }
  )
);