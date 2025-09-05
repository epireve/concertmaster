"""
Review System Database Models
SQLAlchemy models for the comprehensive review and approval system.
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Literal
from enum import Enum

from sqlalchemy import (
    Column, String, Text, DateTime, Boolean, Integer, Float, 
    ForeignKey, CheckConstraint, UniqueConstraint, Index, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from sqlalchemy.ext.hybrid import hybrid_property

from .base import Base


class ReviewStatus(str, Enum):
    """Review status enumeration"""
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_CHANGES = "requires_changes"
    CANCELLED = "cancelled"


class StageType(str, Enum):
    """Review stage type enumeration"""
    APPROVAL = "approval"
    REVIEW = "review"
    VALIDATION = "validation"
    SIGN_OFF = "sign_off"
    NOTIFICATION = "notification"


class AssignmentStatus(str, Enum):
    """Assignment status enumeration"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DECLINED = "declined"
    DELEGATED = "delegated"
    EXPIRED = "expired"


class ReviewDecision(str, Enum):
    """Review decision enumeration"""
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_CHANGES = "requires_changes"
    ABSTAIN = "abstain"


class CommentType(str, Enum):
    """Comment type enumeration"""
    COMMENT = "comment"
    QUESTION = "question"
    SUGGESTION = "suggestion"
    CONCERN = "concern"
    APPROVAL_NOTE = "approval_note"
    REJECTION_REASON = "rejection_reason"


class NotificationType(str, Enum):
    """Notification type enumeration"""
    ASSIGNMENT_CREATED = "assignment_created"
    ASSIGNMENT_DUE_SOON = "assignment_due_soon"
    ASSIGNMENT_OVERDUE = "assignment_overdue"
    REVIEW_COMPLETED = "review_completed"
    COMMENT_ADDED = "comment_added"
    MENTION_ADDED = "mention_added"
    STATUS_CHANGED = "status_changed"
    DELEGATION_REQUESTED = "delegation_requested"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"


class Priority(int, Enum):
    """Priority level enumeration"""
    LOWEST = 1
    LOW = 2
    NORMAL = 3
    HIGH = 4
    CRITICAL = 5


class Urgency(str, Enum):
    """Urgency level enumeration"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class ReviewableItem(Base):
    """
    Core reviewable item model that can represent any item requiring review
    (form submissions, workflows, templates, etc.)
    """
    
    __tablename__ = "reviewable_items"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Core identification
    item_type = Column(String(50), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Review metadata
    title = Column(String(255), nullable=False)
    description = Column(Text)
    priority = Column(Integer, nullable=False, default=Priority.NORMAL.value)
    urgency = Column(String(20), nullable=False, default=Urgency.NORMAL.value)
    
    # Status tracking
    review_status = Column(String(20), nullable=False, default=ReviewStatus.PENDING.value, index=True)
    
    # Workflow integration
    review_template_id = Column(UUID(as_uuid=True), ForeignKey("review_templates.id"), nullable=True, index=True)
    current_stage_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Audit fields
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # Review tracking
    review_started_at = Column(DateTime(timezone=True), nullable=True)
    review_completed_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Additional metadata
    metadata = Column(JSONB, nullable=False, default=dict)
    tags = Column(ARRAY(String), nullable=False, default=list)
    
    # Relationships
    stages = relationship("ReviewStage", back_populates="reviewable_item", cascade="all, delete-orphan")
    comments = relationship("ReviewComment", back_populates="reviewable_item", cascade="all, delete-orphan")
    notifications = relationship("ReviewNotification", back_populates="reviewable_item", cascade="all, delete-orphan")
    template = relationship("ReviewTemplate", back_populates="reviews")
    created_by_user = relationship("User")
    organization = relationship("Organization")
    
    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint("item_type", "item_id", name="uq_reviewable_item_type_id"),
        CheckConstraint(
            f"review_status IN ('{ReviewStatus.PENDING.value}', '{ReviewStatus.IN_REVIEW.value}', "
            f"'{ReviewStatus.APPROVED.value}', '{ReviewStatus.REJECTED.value}', "
            f"'{ReviewStatus.REQUIRES_CHANGES.value}', '{ReviewStatus.CANCELLED.value}')",
            name="ck_review_status"
        ),
        CheckConstraint(
            f"urgency IN ('{Urgency.LOW.value}', '{Urgency.NORMAL.value}', "
            f"'{Urgency.HIGH.value}', '{Urgency.CRITICAL.value}')",
            name="ck_urgency"
        ),
        CheckConstraint("priority BETWEEN 1 AND 5", name="ck_priority"),
        Index("idx_reviewable_items_status_due", "review_status", "due_date"),
        Index("idx_reviewable_items_org_created", "organization_id", "created_at"),
        Index("idx_reviewable_items_type_status", "item_type", "review_status")
    )
    
    @validates('title')
    def validate_title(self, key, value):
        """Validate review title"""
        if not value or not value.strip():
            raise ValueError("Title cannot be empty")
        if len(value.strip()) > 255:
            raise ValueError("Title cannot exceed 255 characters")
        return value.strip()
    
    @validates('priority')
    def validate_priority(self, key, value):
        """Validate priority value"""
        if not isinstance(value, int) or value < 1 or value > 5:
            raise ValueError("Priority must be between 1 and 5")
        return value
    
    @hybrid_property
    def is_overdue(self) -> bool:
        """Check if the review is overdue"""
        if not self.due_date:
            return False
        return datetime.utcnow() > self.due_date and self.review_status not in [
            ReviewStatus.APPROVED.value, ReviewStatus.REJECTED.value, ReviewStatus.CANCELLED.value
        ]
    
    @hybrid_property
    def days_until_due(self) -> Optional[int]:
        """Calculate days until due date"""
        if not self.due_date:
            return None
        delta = self.due_date - datetime.utcnow()
        return delta.days
    
    def __repr__(self):
        return f"<ReviewableItem(id='{self.id}', type='{self.item_type}', status='{self.review_status}')>"


class ReviewTemplate(Base):
    """
    Review template model for reusable review workflow definitions
    """
    
    __tablename__ = "review_templates"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Template definition
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Template configuration
    item_types = Column(ARRAY(String), nullable=False)
    workflow_definition = Column(JSONB, nullable=False)
    
    # Auto-assignment rules
    auto_assignment_rules = Column(JSONB, nullable=False, default=dict)
    default_due_days = Column(Integer, nullable=False, default=7)
    
    # Template settings
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_default = Column(Boolean, nullable=False, default=False)
    version = Column(Integer, nullable=False, default=1)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # Relationships
    reviews = relationship("ReviewableItem", back_populates="template")
    created_by_user = relationship("User")
    organization = relationship("Organization")
    
    # Constraints and indexes
    __table_args__ = (
        Index("idx_review_templates_org_active", "organization_id", "is_active"),
        Index("idx_review_templates_types", "item_types"),
        CheckConstraint("default_due_days > 0", name="ck_default_due_days")
    )
    
    @validates('name')
    def validate_name(self, key, value):
        """Validate template name"""
        if not value or not value.strip():
            raise ValueError("Template name cannot be empty")
        if len(value.strip()) > 255:
            raise ValueError("Template name cannot exceed 255 characters")
        return value.strip()
    
    @validates('workflow_definition')
    def validate_workflow_definition(self, key, value):
        """Validate workflow definition structure"""
        if not isinstance(value, dict):
            raise ValueError("Workflow definition must be a dictionary")
        
        if 'stages' not in value or not isinstance(value['stages'], list):
            raise ValueError("Workflow definition must contain a 'stages' list")
        
        if len(value['stages']) == 0:
            raise ValueError("Workflow must have at least one stage")
        
        # Validate each stage
        for i, stage in enumerate(value['stages']):
            if not isinstance(stage, dict):
                raise ValueError(f"Stage {i} must be a dictionary")
            
            required_fields = {'id', 'name', 'type', 'order'}
            if not all(field in stage for field in required_fields):
                raise ValueError(f"Stage {i} missing required fields: {required_fields}")
        
        return value
    
    def __repr__(self):
        return f"<ReviewTemplate(id='{self.id}', name='{self.name}', active={self.is_active})>"


class ReviewStage(Base):
    """
    Review stage model representing individual stages in a review workflow
    """
    
    __tablename__ = "review_stages"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Stage identification
    reviewable_item_id = Column(UUID(as_uuid=True), ForeignKey("reviewable_items.id", ondelete="CASCADE"), nullable=False, index=True)
    template_stage_id = Column(String(100), nullable=False)
    stage_name = Column(String(255), nullable=False)
    stage_order = Column(Integer, nullable=False)
    
    # Stage configuration
    stage_type = Column(String(50), nullable=False, default=StageType.APPROVAL.value)
    is_parallel = Column(Boolean, nullable=False, default=False)
    required_approvals = Column(Integer, nullable=False, default=1)
    
    # Status and timing
    status = Column(String(20), nullable=False, default="pending", index=True)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    due_date = Column(DateTime(timezone=True), index=True)
    
    # Stage conditions
    entry_conditions = Column(JSONB, nullable=False, default=dict)
    exit_conditions = Column(JSONB, nullable=False, default=dict)
    
    # Metadata
    metadata = Column(JSONB, nullable=False, default=dict)
    
    # Relationships
    reviewable_item = relationship("ReviewableItem", back_populates="stages")
    assignments = relationship("ReviewAssignment", back_populates="review_stage", cascade="all, delete-orphan")
    
    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            f"stage_type IN ('{StageType.APPROVAL.value}', '{StageType.REVIEW.value}', "
            f"'{StageType.VALIDATION.value}', '{StageType.SIGN_OFF.value}', '{StageType.NOTIFICATION.value}')",
            name="ck_stage_type"
        ),
        CheckConstraint(
            "status IN ('pending', 'active', 'completed', 'skipped', 'failed')",
            name="ck_stage_status"
        ),
        CheckConstraint("required_approvals > 0", name="ck_required_approvals"),
        Index("idx_review_stages_item_order", "reviewable_item_id", "stage_order"),
        Index("idx_review_stages_status_due", "status", "due_date")
    )
    
    @validates('stage_name')
    def validate_stage_name(self, key, value):
        """Validate stage name"""
        if not value or not value.strip():
            raise ValueError("Stage name cannot be empty")
        return value.strip()
    
    @hybrid_property
    def is_overdue(self) -> bool:
        """Check if the stage is overdue"""
        if not self.due_date or self.status == "completed":
            return False
        return datetime.utcnow() > self.due_date
    
    def __repr__(self):
        return f"<ReviewStage(id='{self.id}', name='{self.stage_name}', status='{self.status}')>"


class ReviewAssignment(Base):
    """
    Review assignment model representing individual reviewer assignments within stages
    """
    
    __tablename__ = "review_assignments"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Assignment details
    review_stage_id = Column(UUID(as_uuid=True), ForeignKey("review_stages.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    assigned_to_role = Column(String(100), nullable=True)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Assignment status
    status = Column(String(20), nullable=False, default=AssignmentStatus.PENDING.value, index=True)
    decision = Column(String(20), nullable=True)
    
    # Timing
    assigned_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    accepted_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    due_date = Column(DateTime(timezone=True), index=True)
    
    # Review outcome
    comments = Column(Text)
    attachments = Column(JSONB, nullable=False, default=list)
    review_data = Column(JSONB, nullable=False, default=dict)
    
    # Delegation support
    delegated_to = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    delegation_reason = Column(Text)
    
    # Relationships
    review_stage = relationship("ReviewStage", back_populates="assignments")
    assigned_to_user = relationship("User", foreign_keys=[assigned_to_user_id])
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])
    delegated_to_user = relationship("User", foreign_keys=[delegated_to])
    
    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            f"status IN ('{AssignmentStatus.PENDING.value}', '{AssignmentStatus.ACCEPTED.value}', "
            f"'{AssignmentStatus.IN_PROGRESS.value}', '{AssignmentStatus.COMPLETED.value}', "
            f"'{AssignmentStatus.DECLINED.value}', '{AssignmentStatus.DELEGATED.value}', "
            f"'{AssignmentStatus.EXPIRED.value}')",
            name="ck_assignment_status"
        ),
        CheckConstraint(
            f"decision IS NULL OR decision IN ('{ReviewDecision.APPROVED.value}', "
            f"'{ReviewDecision.REJECTED.value}', '{ReviewDecision.REQUIRES_CHANGES.value}', "
            f"'{ReviewDecision.ABSTAIN.value}')",
            name="ck_decision"
        ),
        CheckConstraint(
            "assigned_to_user_id IS NOT NULL OR assigned_to_role IS NOT NULL",
            name="ck_assignment_target"
        ),
        Index("idx_review_assignments_user_status", "assigned_to_user_id", "status"),
        Index("idx_review_assignments_stage_status", "review_stage_id", "status"),
        Index("idx_review_assignments_due_date", "due_date")
    )
    
    @hybrid_property
    def is_overdue(self) -> bool:
        """Check if the assignment is overdue"""
        if not self.due_date or self.status == AssignmentStatus.COMPLETED.value:
            return False
        return datetime.utcnow() > self.due_date
    
    @hybrid_property
    def days_until_due(self) -> Optional[int]:
        """Calculate days until due date"""
        if not self.due_date:
            return None
        delta = self.due_date - datetime.utcnow()
        return delta.days
    
    def __repr__(self):
        return f"<ReviewAssignment(id='{self.id}', status='{self.status}', decision='{self.decision}')>"


class ReviewComment(Base):
    """
    Review comment model for collaborative discussions within reviews
    """
    
    __tablename__ = "review_comments"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Comment association
    reviewable_item_id = Column(UUID(as_uuid=True), ForeignKey("reviewable_items.id", ondelete="CASCADE"), nullable=False, index=True)
    review_stage_id = Column(UUID(as_uuid=True), ForeignKey("review_stages.id"), nullable=True, index=True)
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey("review_comments.id"), nullable=True, index=True)
    
    # Comment content
    content = Column(Text, nullable=False)
    comment_type = Column(String(20), nullable=False, default=CommentType.COMMENT.value)
    
    # Author and timing
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # Comment state
    is_resolved = Column(Boolean, nullable=False, default=False, index=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    
    # Threading and context
    thread_depth = Column(Integer, nullable=False, default=0)
    mentions = Column(JSONB, nullable=False, default=list)
    attachments = Column(JSONB, nullable=False, default=list)
    
    # Metadata
    metadata = Column(JSONB, nullable=False, default=dict)
    
    # Relationships
    reviewable_item = relationship("ReviewableItem", back_populates="comments")
    review_stage = relationship("ReviewStage")
    author = relationship("User", foreign_keys=[author_id])
    resolved_by_user = relationship("User", foreign_keys=[resolved_by])
    parent_comment = relationship("ReviewComment", remote_side=[id])
    replies = relationship("ReviewComment", back_populates="parent_comment")
    
    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            f"comment_type IN ('{CommentType.COMMENT.value}', '{CommentType.QUESTION.value}', "
            f"'{CommentType.SUGGESTION.value}', '{CommentType.CONCERN.value}', "
            f"'{CommentType.APPROVAL_NOTE.value}', '{CommentType.REJECTION_REASON.value}')",
            name="ck_comment_type"
        ),
        CheckConstraint("thread_depth >= 0", name="ck_thread_depth"),
        Index("idx_review_comments_item_created", "reviewable_item_id", "created_at"),
        Index("idx_review_comments_author_created", "author_id", "created_at"),
        Index("idx_review_comments_resolved", "is_resolved", "resolved_at"),
        Index("idx_review_comments_thread", "parent_comment_id", "thread_depth")
    )
    
    @validates('content')
    def validate_content(self, key, value):
        """Validate comment content"""
        if not value or not value.strip():
            raise ValueError("Comment content cannot be empty")
        if len(value) > 10000:  # 10k character limit
            raise ValueError("Comment content cannot exceed 10,000 characters")
        return value.strip()
    
    def __repr__(self):
        return f"<ReviewComment(id='{self.id}', type='{self.comment_type}', resolved={self.is_resolved})>"


class ReviewNotification(Base):
    """
    Review notification model for managing user notifications
    """
    
    __tablename__ = "review_notifications"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Notification details
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    reviewable_item_id = Column(UUID(as_uuid=True), ForeignKey("reviewable_items.id", ondelete="CASCADE"), nullable=False, index=True)
    review_assignment_id = Column(UUID(as_uuid=True), ForeignKey("review_assignments.id"), nullable=True)
    
    # Notification content
    notification_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    
    # Delivery and status
    status = Column(String(20), nullable=False, default="pending", index=True)
    channels = Column(ARRAY(String), nullable=False, default=["in_app"])
    
    # Timing
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    sent_at = Column(DateTime(timezone=True))
    read_at = Column(DateTime(timezone=True))
    
    # Metadata
    metadata = Column(JSONB, nullable=False, default=dict)
    
    # Relationships
    recipient = relationship("User")
    reviewable_item = relationship("ReviewableItem", back_populates="notifications")
    review_assignment = relationship("ReviewAssignment")
    
    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            f"notification_type IN ('{NotificationType.ASSIGNMENT_CREATED.value}', "
            f"'{NotificationType.ASSIGNMENT_DUE_SOON.value}', '{NotificationType.ASSIGNMENT_OVERDUE.value}', "
            f"'{NotificationType.REVIEW_COMPLETED.value}', '{NotificationType.COMMENT_ADDED.value}', "
            f"'{NotificationType.MENTION_ADDED.value}', '{NotificationType.STATUS_CHANGED.value}', "
            f"'{NotificationType.DELEGATION_REQUESTED.value}', '{NotificationType.REVIEW_APPROVED.value}', "
            f"'{NotificationType.REVIEW_REJECTED.value}')",
            name="ck_notification_type"
        ),
        CheckConstraint(
            "status IN ('pending', 'sent', 'delivered', 'read', 'dismissed', 'failed')",
            name="ck_notification_status"
        ),
        Index("idx_review_notifications_recipient_status", "recipient_id", "status"),
        Index("idx_review_notifications_type_scheduled", "notification_type", "scheduled_for"),
        Index("idx_review_notifications_item_created", "reviewable_item_id", "created_at")
    )
    
    def __repr__(self):
        return f"<ReviewNotification(id='{self.id}', type='{self.notification_type}', status='{self.status}')>"


class ReviewAnalytics(Base):
    """
    Review analytics model for performance tracking and reporting
    """
    
    __tablename__ = "review_analytics"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Analytics scope
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False, index=True)
    period_end = Column(DateTime(timezone=True), nullable=False, index=True)
    granularity = Column(String(20), nullable=False, default="daily")
    
    # Performance metrics
    total_reviews = Column(Integer, nullable=False, default=0)
    completed_reviews = Column(Integer, nullable=False, default=0)
    approved_reviews = Column(Integer, nullable=False, default=0)
    rejected_reviews = Column(Integer, nullable=False, default=0)
    
    # Timing metrics
    avg_review_time_hours = Column(Float, nullable=False, default=0.0)
    median_review_time_hours = Column(Float, nullable=False, default=0.0)
    avg_stage_time_hours = Column(Float, nullable=False, default=0.0)
    overdue_count = Column(Integer, nullable=False, default=0)
    
    # Quality metrics
    first_pass_approval_rate = Column(Float, nullable=False, default=0.0)
    revision_count_avg = Column(Float, nullable=False, default=0.0)
    reviewer_engagement_score = Column(Float, nullable=False, default=0.0)
    
    # Breakdown by dimensions
    metrics_by_type = Column(JSONB, nullable=False, default=dict)
    metrics_by_reviewer = Column(JSONB, nullable=False, default=dict)
    metrics_by_template = Column(JSONB, nullable=False, default=dict)
    
    # Generated timestamp
    generated_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    
    # Relationships
    organization = relationship("Organization")
    
    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            "granularity IN ('hourly', 'daily', 'weekly', 'monthly')",
            name="ck_granularity"
        ),
        CheckConstraint("period_start < period_end", name="ck_period_order"),
        CheckConstraint("first_pass_approval_rate >= 0 AND first_pass_approval_rate <= 100", name="ck_approval_rate"),
        CheckConstraint("reviewer_engagement_score >= 0 AND reviewer_engagement_score <= 100", name="ck_engagement_score"),
        Index("idx_review_analytics_org_period", "organization_id", "period_start", "period_end"),
        Index("idx_review_analytics_granularity", "granularity", "period_start")
    )
    
    def __repr__(self):
        return f"<ReviewAnalytics(org='{self.organization_id}', period='{self.granularity}', reviews={self.total_reviews})>"


# Additional utility functions for model operations
def create_review_from_template(
    template: ReviewTemplate,
    reviewable_item: ReviewableItem
) -> List[ReviewStage]:
    """
    Create review stages from a template definition
    """
    stages = []
    workflow_definition = template.workflow_definition
    
    for stage_def in workflow_definition.get('stages', []):
        stage = ReviewStage(
            reviewable_item_id=reviewable_item.id,
            template_stage_id=stage_def['id'],
            stage_name=stage_def['name'],
            stage_order=stage_def['order'],
            stage_type=stage_def['type'],
            is_parallel=stage_def.get('is_parallel', False),
            required_approvals=stage_def.get('required_approvals', 1),
            entry_conditions=stage_def.get('entry_conditions', {}),
            exit_conditions=stage_def.get('exit_conditions', {}),
            metadata=stage_def.get('metadata', {})
        )
        
        # Set due date based on template configuration
        if template.default_due_days:
            stage.due_date = reviewable_item.created_at + timedelta(days=template.default_due_days)
        
        stages.append(stage)
    
    return stages


def calculate_review_metrics(reviews: List[ReviewableItem]) -> Dict[str, Any]:
    """
    Calculate performance metrics for a set of reviews
    """
    if not reviews:
        return {
            'total_reviews': 0,
            'completion_rate': 0.0,
            'avg_review_time_hours': 0.0,
            'approval_rate': 0.0
        }
    
    completed_reviews = [r for r in reviews if r.review_status in [ReviewStatus.APPROVED.value, ReviewStatus.REJECTED.value]]
    approved_reviews = [r for r in reviews if r.review_status == ReviewStatus.APPROVED.value]
    
    # Calculate average review time for completed reviews
    review_times = []
    for review in completed_reviews:
        if review.review_started_at and review.review_completed_at:
            delta = review.review_completed_at - review.review_started_at
            review_times.append(delta.total_seconds() / 3600)  # Convert to hours
    
    avg_review_time = sum(review_times) / len(review_times) if review_times else 0.0
    
    return {
        'total_reviews': len(reviews),
        'completed_reviews': len(completed_reviews),
        'completion_rate': len(completed_reviews) / len(reviews) * 100,
        'approval_rate': len(approved_reviews) / len(completed_reviews) * 100 if completed_reviews else 0.0,
        'avg_review_time_hours': round(avg_review_time, 2),
        'overdue_count': len([r for r in reviews if r.is_overdue])
    }