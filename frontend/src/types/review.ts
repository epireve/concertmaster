// Review System Types and Interfaces

export interface Review {
  id: string;
  title: string;
  content: string;
  rating: number; // 1-5 stars
  author: ReviewAuthor;
  target: ReviewTarget;
  status: ReviewStatus;
  tags: string[];
  attachments?: ReviewAttachment[];
  metadata: ReviewMetadata;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  moderatedAt?: Date;
  moderatedBy?: string;
  moderationNotes?: string;
}

export interface ReviewAuthor {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  verified: boolean;
  reputation?: number;
  reviewCount?: number;
}

export interface ReviewTarget {
  type: 'form' | 'workflow' | 'template' | 'component' | 'system';
  id: string;
  name: string;
  version?: string;
  url?: string;
}

export type ReviewStatus = 
  | 'draft'
  | 'pending'
  | 'published'
  | 'flagged'
  | 'hidden'
  | 'deleted';

export interface ReviewAttachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'screenshot';
  url: string;
  size: number;
  uploadedAt: Date;
}

export interface ReviewMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  location?: {
    country: string;
    city?: string;
  };
  source?: string; // Where the review originated
  language: string;
  helpful: number; // Count of helpful votes
  notHelpful: number; // Count of not helpful votes
  reports: number; // Count of reports/flags
}

// Review Form Types
export interface ReviewFormData {
  title: string;
  content: string;
  rating: number;
  tags: string[];
  targetType: ReviewTarget['type'];
  targetId: string;
  attachments: File[];
  anonymous?: boolean;
}

export interface ReviewFormValidation {
  title?: string;
  content?: string;
  rating?: string;
  targetId?: string;
}

// Review List and Filter Types
export interface ReviewFilters {
  rating?: number[];
  status?: ReviewStatus[];
  targetType?: ReviewTarget['type'][];
  tags?: string[];
  author?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
  sortBy: ReviewSortOption;
  sortOrder: 'asc' | 'desc';
}

export type ReviewSortOption = 
  | 'createdAt'
  | 'updatedAt'
  | 'rating'
  | 'helpful'
  | 'author'
  | 'title';

export interface ReviewListResponse {
  reviews: Review[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
  filters: ReviewFilters;
}

// Review Statistics and Analytics
export interface ReviewStatistics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  statusDistribution: Record<ReviewStatus, number>;
  topTags: Array<{ tag: string; count: number }>;
  recentActivity: Array<{
    date: Date;
    count: number;
    averageRating: number;
  }>;
  topAuthors: Array<{
    author: ReviewAuthor;
    reviewCount: number;
    averageRating: number;
  }>;
}

// Review Actions and Events
export interface ReviewAction {
  type: 'vote_helpful' | 'vote_not_helpful' | 'report' | 'moderate' | 'reply';
  reviewId: string;
  userId: string;
  data?: any;
  timestamp: Date;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  content: string;
  author: ReviewAuthor;
  createdAt: Date;
  updatedAt: Date;
  parentId?: string; // For nested comments
  status: 'visible' | 'hidden' | 'deleted';
}

// Review Notifications
export interface ReviewNotification {
  id: string;
  type: 'new_review' | 'review_reply' | 'review_moderated' | 'review_helpful';
  reviewId: string;
  recipientId: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

// Review Templates and Presets
export interface ReviewTemplate {
  id: string;
  name: string;
  description: string;
  targetType: ReviewTarget['type'];
  fields: ReviewTemplateField[];
  suggestedTags: string[];
  minRating?: number;
  maxRating?: number;
  required: string[]; // Required field names
}

export interface ReviewTemplateField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'rating';
  placeholder?: string;
  options?: string[];
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

// Review Moderation
export interface ReviewModerationRule {
  id: string;
  name: string;
  description: string;
  conditions: ReviewModerationCondition[];
  actions: ReviewModerationAction[];
  enabled: boolean;
  priority: number;
}

export interface ReviewModerationCondition {
  field: keyof Review | keyof ReviewMetadata;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches';
  value: any;
}

export interface ReviewModerationAction {
  type: 'flag' | 'hide' | 'delete' | 'notify_moderator' | 'auto_approve';
  parameters?: Record<string, any>;
}

// API Response Types
export interface ReviewApiResponse<T = Review> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    requestId: string;
    timestamp: Date;
    version: string;
  };
}

export interface ReviewBulkApiResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
  meta?: {
    requestId: string;
    timestamp: Date;
  };
}

// Component Props Types
export interface ReviewFormProps {
  review?: Review;
  targetType?: ReviewTarget['type'];
  targetId?: string;
  template?: ReviewTemplate;
  onSubmit: (data: ReviewFormData) => void;
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export interface ReviewCardProps {
  review: Review;
  showActions?: boolean;
  compact?: boolean;
  onVote?: (reviewId: string, helpful: boolean) => void;
  onReport?: (reviewId: string) => void;
  onEdit?: (reviewId: string) => void;
  onDelete?: (reviewId: string) => void;
  onReply?: (reviewId: string) => void;
}

export interface ReviewListProps {
  reviews: Review[];
  loading?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters?: ReviewFilters;
  onPageChange?: (page: number) => void;
  onFiltersChange?: (filters: Partial<ReviewFilters>) => void;
  onReviewAction?: (action: ReviewAction) => void;
}

export interface RatingSystemProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  showCount?: boolean;
  reviewCount?: number;
  onChange?: (rating: number) => void;
  disabled?: boolean;
  precision?: 'full' | 'half';
}

export interface ReviewFiltersProps {
  filters: ReviewFilters;
  statistics?: ReviewStatistics;
  onFiltersChange: (filters: Partial<ReviewFilters>) => void;
  onReset?: () => void;
  availableTags?: string[];
  availableAuthors?: ReviewAuthor[];
}

export interface ReviewModalProps {
  review?: Review;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: string) => void;
  onVote?: (reviewId: string, helpful: boolean) => void;
  onReport?: (reviewId: string) => void;
}

export interface ReviewSummaryProps {
  statistics: ReviewStatistics;
  targetId?: string;
  targetType?: ReviewTarget['type'];
  showTrends?: boolean;
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
}