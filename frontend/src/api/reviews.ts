/**
 * Review API Client
 * Handles all HTTP requests to the review system backend
 */

import { 
  Review, 
  ReviewListResponse,
  ReviewStats,
  ReviewHistory,
  ReviewCriteria,
  ReviewAssignment,
  CreateReviewRequest,
  UpdateReviewRequest,
  AssignReviewRequest,
  CreateCriteriaRequest,
  ReviewSearchParams
} from '../types/reviews';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const REVIEWS_ENDPOINT = `${API_BASE_URL}/api/v1/reviews`;

// Request helper with authentication and error handling
async function apiRequest<T>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  try {
    // Get auth token from storage (implement your auth logic)
    const token = localStorage.getItem('auth_token');
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || 
        errorData.message || 
        `HTTP error! status: ${response.status}`
      );
    }
    
    // Handle no-content responses
    if (response.status === 204) {
      return {} as T;
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Build query string from search parameters
function buildQueryString(params: ReviewSearchParams): string {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          queryParams.append(key, item.toString());
        });
      } else {
        queryParams.set(key, value.toString());
      }
    }
  });
  
  return queryParams.toString();
}

export const reviewApi = {
  // Core CRUD operations
  async createReview(data: CreateReviewRequest): Promise<Review> {
    return apiRequest<Review>(REVIEWS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getReviews(params: ReviewSearchParams = {}): Promise<ReviewListResponse> {
    const queryString = buildQueryString(params);
    const url = queryString ? `${REVIEWS_ENDPOINT}?${queryString}` : REVIEWS_ENDPOINT;
    
    return apiRequest<ReviewListResponse>(url);
  },

  async getReview(id: string): Promise<Review> {
    return apiRequest<Review>(`${REVIEWS_ENDPOINT}/${id}`);
  },

  async updateReview(id: string, data: UpdateReviewRequest): Promise<Review> {
    return apiRequest<Review>(`${REVIEWS_ENDPOINT}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteReview(id: string): Promise<void> {
    return apiRequest<void>(`${REVIEWS_ENDPOINT}/${id}`, {
      method: 'DELETE',
    });
  },

  // Review workflow operations
  async assignReview(id: string, data: AssignReviewRequest): Promise<ReviewAssignment> {
    return apiRequest<ReviewAssignment>(`${REVIEWS_ENDPOINT}/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveReview(id: string, comments?: string): Promise<Review> {
    return apiRequest<Review>(`${REVIEWS_ENDPOINT}/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  },

  async rejectReview(id: string, comments: string): Promise<Review> {
    return apiRequest<Review>(`${REVIEWS_ENDPOINT}/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  },

  // Review history and audit
  async getReviewHistory(id: string): Promise<ReviewHistory[]> {
    return apiRequest<ReviewHistory[]>(`${REVIEWS_ENDPOINT}/${id}/history`);
  },

  // Review criteria management
  async getReviewCriteria(id: string): Promise<ReviewCriteria[]> {
    // Note: This endpoint might need to be implemented in the backend
    return apiRequest<ReviewCriteria[]>(`${REVIEWS_ENDPOINT}/${id}/criteria`);
  },

  async addReviewCriteria(id: string, data: CreateCriteriaRequest): Promise<ReviewCriteria> {
    return apiRequest<ReviewCriteria>(`${REVIEWS_ENDPOINT}/${id}/criteria`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateReviewCriteria(
    reviewId: string, 
    criteriaId: string, 
    data: Partial<CreateCriteriaRequest>
  ): Promise<ReviewCriteria> {
    return apiRequest<ReviewCriteria>(`${REVIEWS_ENDPOINT}/${reviewId}/criteria/${criteriaId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteReviewCriteria(reviewId: string, criteriaId: string): Promise<void> {
    return apiRequest<void>(`${REVIEWS_ENDPOINT}/${reviewId}/criteria/${criteriaId}`, {
      method: 'DELETE',
    });
  },

  // Statistics and analytics
  async getReviewStats(): Promise<ReviewStats> {
    return apiRequest<ReviewStats>(`${REVIEWS_ENDPOINT}/stats/summary`);
  },

  // Form and workflow specific reviews
  async getFormReviews(formId: string): Promise<Review[]> {
    return apiRequest<Review[]>(`${REVIEWS_ENDPOINT}/form/${formId}/reviews`);
  },

  async getWorkflowReviews(workflowId: string): Promise<Review[]> {
    return apiRequest<Review[]>(`${REVIEWS_ENDPOINT}/workflow/${workflowId}/reviews`);
  },

  // Bulk operations (if implemented in backend)
  async bulkUpdateReviews(
    reviewIds: string[], 
    action: string, 
    parameters?: Record<string, any>
  ): Promise<void> {
    return apiRequest<void>(`${REVIEWS_ENDPOINT}/bulk`, {
      method: 'POST',
      body: JSON.stringify({
        review_ids: reviewIds,
        action,
        parameters,
      }),
    });
  },

  // Search and filtering
  async searchReviews(query: string, filters?: Partial<ReviewSearchParams>): Promise<ReviewListResponse> {
    const params: ReviewSearchParams = {
      query,
      ...filters,
    };
    
    return this.getReviews(params);
  },

  // User-specific reviews
  async getUserReviews(userId: string, params?: Partial<ReviewSearchParams>): Promise<ReviewListResponse> {
    const searchParams: ReviewSearchParams = {
      created_by: userId,
      ...params,
    };
    
    return this.getReviews(searchParams);
  },

  async getAssignedReviews(userId: string, params?: Partial<ReviewSearchParams>): Promise<ReviewListResponse> {
    const searchParams: ReviewSearchParams = {
      assigned_to: userId,
      ...params,
    };
    
    return this.getReviews(searchParams);
  },

  // Export functionality (if needed)
  async exportReviews(params: ReviewSearchParams = {}): Promise<Blob> {
    const queryString = buildQueryString({ ...params, format: 'csv' });
    const url = `${REVIEWS_ENDPOINT}/export?${queryString}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    return response.blob();
  },

  // Real-time updates (if using WebSocket or Server-Sent Events)
  subscribeToReviewUpdates(callback: (review: Review) => void): () => void {
    // Implement WebSocket or EventSource connection here
    // This is a placeholder implementation
    
    const eventSource = new EventSource(`${API_BASE_URL}/api/v1/reviews/events`, {
      // Add authentication headers if supported by your SSE implementation
    });
    
    eventSource.addEventListener('review-updated', (event) => {
      try {
        const review: Review = JSON.parse(event.data);
        callback(review);
      } catch (error) {
        console.error('Failed to parse review update:', error);
      }
    });
    
    // Return cleanup function
    return () => {
      eventSource.close();
    };
  },

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return apiRequest<{ status: string }>(`${API_BASE_URL}/health`);
  },
};

// Utility functions for API client
export const reviewApiUtils = {
  // Format date for API requests
  formatDateForAPI(date: Date): string {
    return date.toISOString();
  },

  // Parse date from API responses
  parseDateFromAPI(dateString: string): Date {
    return new Date(dateString);
  },

  // Validate review data before sending to API
  validateReviewData(data: CreateReviewRequest | UpdateReviewRequest): string[] {
    const errors: string[] = [];
    
    if ('title' in data && (!data.title || data.title.trim().length === 0)) {
      errors.push('Title is required');
    }
    
    if ('title' in data && data.title && data.title.length > 255) {
      errors.push('Title must be less than 255 characters');
    }
    
    if ('rating' in data && data.rating !== undefined) {
      if (data.rating < 0 || data.rating > 5) {
        errors.push('Rating must be between 0 and 5');
      }
    }
    
    return errors;
  },

  // Format error messages for display
  formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    return 'An unexpected error occurred';
  },
};