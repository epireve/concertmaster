// Types for the Phase 4 Review System
// Comprehensive TypeScript definitions for review workflow management

export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'requires_changes' | 'cancelled';

export type StageType = 'approval' | 'review' | 'validation' | 'sign_off' | 'notification';

export type AssignmentStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'delegated' | 'expired';

export type ReviewDecision = 'approved' | 'rejected' | 'requires_changes' | 'abstain';

export type CommentType = 'comment' | 'question' | 'suggestion' | 'concern' | 'approval_note' | 'rejection_reason';

export type NotificationType = 
  | 'assignment_created'
  | 'assignment_due_soon'
  | 'assignment_overdue'
  | 'review_completed'
  | 'comment_added'
  | 'mention_added'
  | 'status_changed'
  | 'delegation_requested'
  | 'review_approved'
  | 'review_rejected';

export type Priority = 1 | 2 | 3 | 4 | 5; // 1 = Lowest, 5 = Critical

export type Urgency = 'low' | 'normal' | 'high' | 'critical';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'dismissed' | 'failed';

// Core Review Models
export interface ReviewableItem {
  id: string;
  itemType: string;
  itemId: string;
  organizationId: string;
  title: string;
  description?: string;
  priority: Priority;
  urgency: Urgency;
  reviewStatus: ReviewStatus;
  reviewTemplateId?: string;
  currentStageId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  reviewStartedAt?: string;
  reviewCompletedAt?: string;
  dueDate?: string;
  metadata: Record<string, any>;
  tags: string[];
  
  // Computed properties
  isOverdue?: boolean;
  daysUntilDue?: number;
  
  // Related data (populated based on query)
  stages?: ReviewStage[];
  assignments?: ReviewAssignment[];
  comments?: ReviewComment[];
  notifications?: ReviewNotification[];
  template?: ReviewTemplate;
  createdByUser?: UserSummary;
  organization?: OrganizationSummary;
}

export interface ReviewTemplate {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  itemTypes: string[];
  workflowDefinition: WorkflowDefinition;
  autoAssignmentRules: AssignmentRule[];
  defaultDueDays: number;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  
  // Related data
  createdByUser?: UserSummary;
  organization?: OrganizationSummary;
  usageCount?: number;
}

export interface WorkflowDefinition {
  stages: StageDefinition[];
  conditions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface StageDefinition {
  id: string;
  name: string;
  type: StageType;
  order: number;
  isParallel?: boolean;
  requiredApprovals?: number;
  entryConditions?: Record<string, any>;
  exitConditions?: Record<string, any>;
  autoAssignmentRules?: AssignmentRule[];
  dueDaysFromStart?: number;
  dueDaysFromPrevious?: number;
  metadata?: Record<string, any>;
}

export interface AssignmentRule {
  type: 'user' | 'role' | 'group' | 'conditional';
  value: string | string[];
  conditions?: Record<string, any>;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface ReviewStage {
  id: string;
  reviewableItemId: string;
  templateStageId: string;
  stageName: string;
  stageOrder: number;
  stageType: StageType;
  isParallel: boolean;
  requiredApprovals: number;
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'failed';
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  entryConditions: Record<string, any>;
  exitConditions: Record<string, any>;
  metadata: Record<string, any>;
  
  // Computed properties
  isOverdue?: boolean;
  
  // Related data
  assignments?: ReviewAssignment[];
  reviewableItem?: ReviewableItem;
}

export interface ReviewAssignment {
  id: string;
  reviewStageId: string;
  assignedToUserId?: string;
  assignedToRole?: string;
  assignedBy: string;
  status: AssignmentStatus;
  decision?: ReviewDecision;
  assignedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  dueDate?: string;
  comments?: string;
  attachments: AttachmentReference[];
  reviewData: Record<string, any>;
  delegatedTo?: string;
  delegationReason?: string;
  
  // Computed properties
  isOverdue?: boolean;
  daysUntilDue?: number;
  
  // Related data
  reviewStage?: ReviewStage;
  assignedToUser?: UserSummary;
  assignedByUser?: UserSummary;
  delegatedToUser?: UserSummary;
}

export interface ReviewComment {
  id: string;
  reviewableItemId: string;
  reviewStageId?: string;
  parentCommentId?: string;
  content: string;
  commentType: CommentType;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  threadDepth: number;
  mentions: string[];
  attachments: AttachmentReference[];
  metadata: Record<string, any>;
  
  // Related data
  author?: UserSummary;
  resolvedByUser?: UserSummary;
  parentComment?: ReviewComment;
  replies?: ReviewComment[];
}

export interface ReviewNotification {
  id: string;
  recipientId: string;
  reviewableItemId: string;
  reviewAssignmentId?: string;
  notificationType: NotificationType;
  title: string;
  message?: string;
  status: NotificationStatus;
  channels: string[];
  createdAt: string;
  scheduledFor: string;
  sentAt?: string;
  readAt?: string;
  metadata: Record<string, any>;
  
  // Related data
  recipient?: UserSummary;
  reviewableItem?: ReviewableItem;
  reviewAssignment?: ReviewAssignment;
}

export interface ReviewAnalytics {
  id: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly';
  totalReviews: number;
  completedReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  avgReviewTimeHours: number;
  medianReviewTimeHours: number;
  avgStageTimeHours: number;
  overdueCount: number;
  firstPassApprovalRate: number;
  revisionCountAvg: number;
  reviewerEngagementScore: number;
  metricsByType: Record<string, any>;
  metricsByReviewer: Record<string, any>;
  metricsByTemplate: Record<string, any>;
  generatedAt: string;
}

// Supporting Types
export interface AttachmentReference {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface UserSummary {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  avatar?: string;
  role?: string;
  isActive: boolean;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

// API Request/Response Types
export interface CreateReviewRequest {
  itemType: string;
  itemId: string;
  title: string;
  description?: string;
  priority?: Priority;
  urgency?: Urgency;
  reviewTemplateId?: string;
  dueDate?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateReviewRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  urgency?: Urgency;
  dueDate?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SubmitDecisionRequest {
  assignmentId: string;
  decision: ReviewDecision;
  comments?: string;
  attachments?: AttachmentReference[];
  reviewData?: Record<string, any>;
}

export interface CreateAssignmentRequest {
  reviewStageId: string;
  assignedToUserId?: string;
  assignedToRole?: string;
  dueDate?: string;
  comments?: string;
}

export interface AcceptAssignmentRequest {
  comments?: string;
  estimatedCompletionDate?: string;
}

export interface DelegateAssignmentRequest {
  delegateToUserId: string;
  reason?: string;
  dueDate?: string;
}

export interface CreateCommentRequest {
  content: string;
  commentType?: CommentType;
  reviewStageId?: string;
  parentCommentId?: string;
  mentions?: string[];
  attachments?: AttachmentReference[];
}

export interface UpdateCommentRequest {
  content?: string;
  isResolved?: boolean;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  itemTypes: string[];
  workflowDefinition: WorkflowDefinition;
  autoAssignmentRules?: AssignmentRule[];
  defaultDueDays?: number;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  workflowDefinition?: WorkflowDefinition;
  autoAssignmentRules?: AssignmentRule[];
  isActive?: boolean;
  defaultDueDays?: number;
}

// Query Types for API endpoints
export interface ReviewListQuery {
  status?: ReviewStatus[];
  assignedTo?: string;
  itemType?: string;
  organizationId?: string;
  dueDate?: DateRange;
  priority?: Priority[];
  urgency?: Urgency[];
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'due_date' | 'priority' | 'status' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
}

export interface AssignmentListQuery {
  userId?: string;
  status?: AssignmentStatus[];
  dueDate?: DateRange;
  reviewId?: string;
  priority?: Priority[];
  urgency?: Urgency[];
  limit?: number;
  offset?: number;
  sortBy?: 'assigned_at' | 'due_date' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CommentListQuery {
  reviewId?: string;
  stageId?: string;
  authorId?: string;
  commentType?: CommentType[];
  resolved?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface TemplateListQuery {
  organizationId?: string;
  itemTypes?: string[];
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'created_at' | 'usage_count';
  sortOrder?: 'asc' | 'desc';
}

export interface NotificationListQuery {
  userId?: string;
  status?: NotificationStatus[];
  notificationType?: NotificationType[];
  reviewId?: string;
  read?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'scheduled_for';
  sortOrder?: 'asc' | 'desc';
}

export interface DateRange {
  start?: string;
  end?: string;
}

// Response wrapper types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  message?: string;
  timestamp: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// WebSocket Event Types
export interface ReviewWebSocketEvents {
  // Client -> Server
  join_review: { reviewId: string };
  leave_review: { reviewId: string };
  typing_start: { reviewId: string; commentContext?: string };
  typing_stop: { reviewId: string };
  
  // Server -> Client
  review_updated: ReviewableItem;
  assignment_changed: ReviewAssignment;
  comment_added: ReviewComment;
  comment_updated: ReviewComment;
  user_typing: { userId: string; userName: string; context?: string };
  stage_completed: ReviewStage;
  review_completed: ReviewSummary;
  notification: ReviewNotification;
}

export interface ReviewSummary {
  id: string;
  title: string;
  status: ReviewStatus;
  completedAt: string;
  finalDecision: ReviewDecision;
  totalStages: number;
  completedStages: number;
  totalReviewers: number;
  participantCount: number;
}

export interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
  context?: string;
}

// UI State Types
export interface ReviewFilters {
  status: ReviewStatus[];
  assignedTo?: string;
  priority: Priority[];
  urgency: Urgency[];
  itemType?: string;
  tags: string[];
  dueDate?: DateRange;
  search?: string;
}

export interface ReviewDashboardAnalytics {
  totalAssigned: number;
  dueToday: number;
  overdue: number;
  completedThisWeek: number;
  avgReviewTime: number;
  approvalRate: number;
  engagementScore: number;
  trendingUp: boolean;
}

export interface ReviewMetrics {
  totalReviews: number;
  completedReviews: number;
  completionRate: number;
  approvalRate: number;
  avgReviewTimeHours: number;
  overdueCount: number;
  firstPassApprovalRate: number;
  reviewerEngagementScore: number;
}

// Form Integration Types
export interface FormReviewConfig {
  enabled: boolean;
  templateId?: string;
  autoCreateReview: boolean;
  requiredForSubmission: boolean;
  assignmentRules?: AssignmentRule[];
  dueDate?: string;
  priority?: Priority;
  urgency?: Urgency;
}

export interface FormSubmissionWithReview {
  submissionId: string;
  formId: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
  submittedAt: string;
  review?: ReviewableItem;
  reviewRequired: boolean;
}

// Workflow Integration Types
export interface WorkflowReviewGate {
  nodeId: string;
  reviewType: StageType;
  reviewTemplateId: string;
  blockExecution: boolean;
  autoAssignmentRules?: AssignmentRule[];
  conditions?: Record<string, any>;
}

export interface WorkflowWithReviewGates {
  id: string;
  name: string;
  description?: string;
  definition: Record<string, any>;
  reviewGates: WorkflowReviewGate[];
  createdAt: string;
  updatedAt: string;
}

// Permission Types
export interface ReviewPermissions {
  // Review management
  canCreateReview: boolean;
  canViewReview: boolean;
  canEditReview: boolean;
  canDeleteReview: boolean;
  canCancelReview: boolean;
  
  // Assignment management
  canAssignReviews: boolean;
  canAcceptAssignments: boolean;
  canDelegateAssignments: boolean;
  canViewAllAssignments: boolean;
  
  // Review actions
  canApprove: boolean;
  canReject: boolean;
  canRequestChanges: boolean;
  canOverrideDecisions: boolean;
  canCompleteStages: boolean;
  
  // Comments and collaboration
  canViewComments: boolean;
  canAddComments: boolean;
  canEditOwnComments: boolean;
  canEditAllComments: boolean;
  canResolveComments: boolean;
  canDeleteComments: boolean;
  
  // Template management
  canCreateTemplates: boolean;
  canEditTemplates: boolean;
  canDeleteTemplates: boolean;
  canManageTemplates: boolean;
  canUseTemplates: boolean;
  
  // Analytics and reporting
  canViewAnalytics: boolean;
  canExportReports: boolean;
  canViewAuditLogs: boolean;
  
  // System administration
  canManageNotifications: boolean;
  canManageIntegrations: boolean;
  canManageSystemSettings: boolean;
}

// Utility Types
export type ReviewItemType = 'form_submission' | 'workflow' | 'form_template' | 'integration' | 'document' | 'user_request';

export type SortableReviewFields = 'created_at' | 'due_date' | 'priority' | 'status' | 'updated_at' | 'title';

export type SortableAssignmentFields = 'assigned_at' | 'due_date' | 'priority' | 'status' | 'completed_at';

export type SortOrder = 'asc' | 'desc';

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ReviewValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

// Export helper functions type definitions
export type ReviewStatusColor = 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'orange';
export type PriorityColor = 'gray' | 'blue' | 'yellow' | 'orange' | 'red';
export type UrgencyColor = 'gray' | 'blue' | 'yellow' | 'orange' | 'red';

// Component Props Types (for reference)
export interface ReviewCardProps {
  review: ReviewableItem;
  showAssignments?: boolean;
  showComments?: boolean;
  compact?: boolean;
  onStatusChange?: (reviewId: string, status: ReviewStatus) => void;
  onPriorityChange?: (reviewId: string, priority: Priority) => void;
  onClick?: (review: ReviewableItem) => void;
}

export interface ReviewStageProps {
  stage: ReviewStage;
  assignments: ReviewAssignment[];
  isActive: boolean;
  canEdit: boolean;
  onStageComplete?: (stageId: string) => void;
  onAssignmentChange?: (assignment: ReviewAssignment) => void;
}

export interface CommentThreadProps {
  comments: ReviewComment[];
  reviewId: string;
  stageId?: string;
  canReply: boolean;
  canResolve: boolean;
  onCommentAdd?: (comment: CreateCommentRequest) => void;
  onCommentUpdate?: (commentId: string, update: UpdateCommentRequest) => void;
  onCommentResolve?: (commentId: string) => void;
}

export interface ReviewDashboardProps {
  userId?: string;
  organizationId?: string;
  defaultFilters?: Partial<ReviewFilters>;
  viewMode?: 'list' | 'kanban' | 'calendar';
  showAnalytics?: boolean;
}

// Store types for state management
export interface ReviewStore {
  // State
  reviews: ReviewableItem[];
  currentReview: ReviewableItem | null;
  assignments: ReviewAssignment[];
  comments: Record<string, ReviewComment[]>;
  notifications: ReviewNotification[];
  templates: ReviewTemplate[];
  analytics: ReviewAnalytics | null;
  filters: ReviewFilters;
  loading: boolean;
  error: string | null;
  
  // Computed
  myAssignments: ReviewAssignment[];
  overdueAssignments: ReviewAssignment[];
  dueToday: ReviewAssignment[];
  
  // Actions - Review Management
  loadReviews: (filters?: ReviewFilters) => Promise<void>;
  loadReview: (id: string) => Promise<void>;
  createReview: (data: CreateReviewRequest) => Promise<string>;
  updateReview: (id: string, data: UpdateReviewRequest) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  
  // Actions - Assignment Management
  loadAssignments: (userId?: string) => Promise<void>;
  acceptAssignment: (id: string, data?: AcceptAssignmentRequest) => Promise<void>;
  delegateAssignment: (id: string, data: DelegateAssignmentRequest) => Promise<void>;
  submitDecision: (data: SubmitDecisionRequest) => Promise<void>;
  
  // Actions - Comments
  loadComments: (reviewId: string) => Promise<void>;
  addComment: (reviewId: string, comment: CreateCommentRequest) => Promise<void>;
  updateComment: (id: string, data: UpdateCommentRequest) => Promise<void>;
  resolveComment: (id: string) => Promise<void>;
  
  // Actions - Templates
  loadTemplates: () => Promise<void>;
  createTemplate: (data: CreateTemplateRequest) => Promise<string>;
  updateTemplate: (id: string, data: UpdateTemplateRequest) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  
  // Actions - Notifications
  loadNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  
  // Actions - Analytics
  loadAnalytics: (organizationId: string, period?: string) => Promise<void>;
  
  // Actions - Filters and Search
  setFilters: (filters: Partial<ReviewFilters>) => void;
  clearFilters: () => void;
  setSearch: (search: string) => void;
  
  // Actions - Real-time
  subscribeToReview: (reviewId: string) => void;
  unsubscribeFromReview: (reviewId: string) => void;
  
  // Actions - Utility
  clearError: () => void;
  reset: () => void;
}

// Helper type for creating mock data
export type MockReviewData = Partial<ReviewableItem> & {
  id: string;
  title: string;
  itemType: string;
  itemId: string;
};

export type MockAssignmentData = Partial<ReviewAssignment> & {
  id: string;
  reviewStageId: string;
  status: AssignmentStatus;
};

export type MockCommentData = Partial<ReviewComment> & {
  id: string;
  reviewableItemId: string;
  content: string;
  authorId: string;
};