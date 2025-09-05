"""
Review System Pydantic Schemas
Request/Response models for review API endpoints
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

from ..models.reviews import ReviewStatus, ReviewType, ReviewPriority


class ReviewBase(BaseModel):
    """Base review schema"""
    title: str = Field(..., min_length=1, max_length=255, description="Review title")
    description: Optional[str] = Field(None, description="Review description")
    review_type: ReviewType = Field(ReviewType.FORM_REVIEW, description="Type of review")
    priority: ReviewPriority = Field(ReviewPriority.MEDIUM, description="Review priority")
    form_id: Optional[str] = Field(None, description="Associated form ID")
    workflow_id: Optional[str] = Field(None, description="Associated workflow ID")
    due_date: Optional[datetime] = Field(None, description="Review due date")


class ReviewCreate(ReviewBase):
    """Schema for creating a review"""
    pass

    @validator('title')
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()


class ReviewUpdate(BaseModel):
    """Schema for updating a review"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    priority: Optional[ReviewPriority] = None
    status: Optional[ReviewStatus] = None
    rating: Optional[float] = Field(None, ge=0, le=5, description="Rating 0-5")
    comments: Optional[str] = None
    reviewer_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None

    @validator('rating')
    def validate_rating(cls, v):
        if v is not None and (v < 0 or v > 5):
            raise ValueError('Rating must be between 0 and 5')
        return v


class ReviewResponse(BaseModel):
    """Schema for review responses"""
    id: str
    title: str
    description: Optional[str]
    review_type: ReviewType
    status: ReviewStatus
    priority: ReviewPriority
    form_id: Optional[str]
    workflow_id: Optional[str]
    rating: Optional[float]
    comments: Optional[str]
    reviewer_notes: Optional[str]
    assigned_to: Optional[str]
    assigned_at: Optional[datetime]
    completed_at: Optional[datetime]
    due_date: Optional[datetime]
    created_by: str
    updated_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    is_completed: bool
    is_overdue: bool

    class Config:
        from_attributes = True


class ReviewListResponse(BaseModel):
    """Schema for paginated review list responses"""
    reviews: List[ReviewResponse]
    total: int
    skip: int
    limit: int
    
    @property
    def has_next(self) -> bool:
        return self.skip + self.limit < self.total
    
    @property
    def has_prev(self) -> bool:
        return self.skip > 0


class ReviewCriteriaBase(BaseModel):
    """Base review criteria schema"""
    name: str = Field(..., min_length=1, max_length=255, description="Criteria name")
    description: Optional[str] = Field(None, description="Criteria description")
    weight: float = Field(1.0, ge=0, description="Criteria weight/importance")
    max_score: float = Field(5.0, gt=0, description="Maximum possible score")
    is_required: bool = Field(False, description="Whether this criteria is required")


class ReviewCriteriaCreate(ReviewCriteriaBase):
    """Schema for creating review criteria"""
    pass


class ReviewCriteriaUpdate(BaseModel):
    """Schema for updating review criteria"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    weight: Optional[float] = Field(None, ge=0)
    max_score: Optional[float] = Field(None, gt=0)
    actual_score: Optional[float] = Field(None, ge=0)
    is_required: Optional[bool] = None
    is_completed: Optional[bool] = None

    @validator('actual_score')
    def validate_score(cls, v, values):
        if v is not None and 'max_score' in values and values['max_score'] is not None:
            if v > values['max_score']:
                raise ValueError('Actual score cannot exceed maximum score')
        return v


class ReviewCriteriaResponse(BaseModel):
    """Schema for review criteria responses"""
    id: str
    review_id: str
    name: str
    description: Optional[str]
    weight: float
    max_score: float
    actual_score: Optional[float]
    is_required: bool
    is_completed: bool
    created_by: str
    updated_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReviewAssignmentBase(BaseModel):
    """Base review assignment schema"""
    assigned_to: str = Field(..., description="User ID or email to assign to")
    assignment_notes: Optional[str] = Field(None, description="Assignment notes")


class ReviewAssignmentCreate(ReviewAssignmentBase):
    """Schema for creating review assignments"""
    pass


class ReviewAssignmentResponse(BaseModel):
    """Schema for review assignment responses"""
    id: str
    review_id: str
    assigned_to: str
    assigned_by: str
    assigned_at: datetime
    is_active: bool
    accepted_at: Optional[datetime]
    completed_at: Optional[datetime]
    assignment_notes: Optional[str]
    completion_notes: Optional[str]

    class Config:
        from_attributes = True


class ReviewHistoryResponse(BaseModel):
    """Schema for review history responses"""
    id: str
    review_id: str
    action: str
    old_status: Optional[ReviewStatus]
    new_status: Optional[ReviewStatus]
    comment: Optional[str]
    metadata: Optional[str]
    performed_by: str
    performed_at: datetime

    class Config:
        from_attributes = True


class ReviewStatsResponse(BaseModel):
    """Schema for review statistics"""
    total_reviews: int
    pending_reviews: int
    in_progress_reviews: int
    completed_reviews: int
    approved_reviews: int
    rejected_reviews: int
    overdue_reviews: int
    average_rating: Optional[float]
    completion_rate: float
    average_completion_time_hours: Optional[float]
    
    # Breakdown by type
    form_reviews: int
    workflow_reviews: int
    data_reviews: int
    compliance_reviews: int
    
    # Breakdown by priority
    low_priority: int
    medium_priority: int
    high_priority: int
    critical_priority: int


class ReviewTemplateBase(BaseModel):
    """Base review template schema"""
    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    review_type: ReviewType = Field(ReviewType.FORM_REVIEW, description="Template type")
    criteria_template: Optional[str] = Field(None, description="JSON criteria template")
    default_priority: ReviewPriority = Field(ReviewPriority.MEDIUM, description="Default priority")
    estimated_duration: Optional[int] = Field(None, ge=0, description="Estimated duration in minutes")
    is_active: bool = Field(True, description="Whether template is active")
    is_default: bool = Field(False, description="Whether this is the default template")


class ReviewTemplateCreate(ReviewTemplateBase):
    """Schema for creating review templates"""
    pass


class ReviewTemplateUpdate(BaseModel):
    """Schema for updating review templates"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    criteria_template: Optional[str] = None
    default_priority: Optional[ReviewPriority] = None
    estimated_duration: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class ReviewTemplateResponse(BaseModel):
    """Schema for review template responses"""
    id: str
    name: str
    description: Optional[str]
    review_type: ReviewType
    criteria_template: Optional[str]
    default_priority: ReviewPriority
    estimated_duration: Optional[int]
    is_active: bool
    is_default: bool
    created_by: str
    updated_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReviewNotificationEvent(BaseModel):
    """Schema for review notification events"""
    event_type: str = Field(..., description="Type of notification event")
    review_id: str = Field(..., description="Review ID")
    user_id: str = Field(..., description="Target user ID")
    message: str = Field(..., description="Notification message")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional event metadata")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ReviewSearchRequest(BaseModel):
    """Schema for review search requests"""
    query: Optional[str] = Field(None, description="Search query")
    status: Optional[List[ReviewStatus]] = Field(None, description="Filter by status")
    review_type: Optional[List[ReviewType]] = Field(None, description="Filter by type")
    priority: Optional[List[ReviewPriority]] = Field(None, description="Filter by priority")
    assigned_to: Optional[str] = Field(None, description="Filter by assignee")
    created_by: Optional[str] = Field(None, description="Filter by creator")
    date_from: Optional[datetime] = Field(None, description="Filter from date")
    date_to: Optional[datetime] = Field(None, description="Filter to date")
    form_id: Optional[str] = Field(None, description="Filter by form ID")
    workflow_id: Optional[str] = Field(None, description="Filter by workflow ID")
    sort_by: Optional[str] = Field("created_at", description="Sort field")
    sort_order: Optional[str] = Field("desc", regex="^(asc|desc)$", description="Sort order")
    skip: int = Field(0, ge=0, description="Records to skip")
    limit: int = Field(100, ge=1, le=500, description="Records to return")


class ReviewBulkActionRequest(BaseModel):
    """Schema for bulk review actions"""
    review_ids: List[str] = Field(..., min_items=1, description="List of review IDs")
    action: str = Field(..., description="Action to perform")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Action parameters")
    comment: Optional[str] = Field(None, description="Optional comment")