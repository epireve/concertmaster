"""
Review Service
Business logic for review system operations
"""

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc, asc
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timedelta
import logging
import json

from ..models.reviews import (
    Review, ReviewStatus, ReviewType, ReviewPriority,
    ReviewCriteria, ReviewHistory, ReviewAssignment, ReviewTemplate
)
from ..schemas.reviews import (
    ReviewCreate, ReviewUpdate, ReviewCriteriaCreate,
    ReviewAssignmentCreate, ReviewStatsResponse
)
from ..services.notification_service import NotificationService
from ..core.exceptions import ReviewNotFoundError, ReviewPermissionError, ReviewValidationError

logger = logging.getLogger(__name__)


class ReviewService:
    """Service for managing reviews"""
    
    def __init__(self, db: Session):
        self.db = db
        self.notification_service = NotificationService()
    
    async def create_review(self, review_data: ReviewCreate, creator_id: str) -> Review:
        """Create a new review"""
        try:
            # Validate form/workflow existence if provided
            if review_data.form_id:
                # TODO: Add form existence validation
                pass
            if review_data.workflow_id:
                # TODO: Add workflow existence validation
                pass
            
            # Create review
            review = Review(
                title=review_data.title,
                description=review_data.description,
                review_type=review_data.review_type,
                priority=review_data.priority,
                form_id=review_data.form_id,
                workflow_id=review_data.workflow_id,
                due_date=review_data.due_date,
                created_by=creator_id,
                status=ReviewStatus.PENDING
            )
            
            self.db.add(review)
            self.db.commit()
            self.db.refresh(review)
            
            # Create history entry
            await self._add_history_entry(
                review.id,
                "created",
                None,
                ReviewStatus.PENDING,
                f"Review created: {review.title}",
                creator_id
            )
            
            # Send notification
            await self.notification_service.send_review_notification(
                "review_created",
                review.id,
                creator_id,
                f"New review created: {review.title}"
            )
            
            logger.info(f"Review created: {review.id} by {creator_id}")
            return review
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating review: {str(e)}")
            raise ReviewValidationError(f"Failed to create review: {str(e)}")
    
    async def get_review(self, review_id: str, user_id: str) -> Optional[Review]:
        """Get a review by ID"""
        try:
            review = self.db.query(Review).options(
                joinedload(Review.criteria),
                joinedload(Review.history),
                joinedload(Review.form),
                joinedload(Review.workflow)
            ).filter(Review.id == review_id).first()
            
            if not review:
                return None
            
            # Check permissions (basic implementation)
            if not await self._check_review_permission(review, user_id, "read"):
                raise ReviewPermissionError("Insufficient permissions to access review")
            
            return review
            
        except Exception as e:
            logger.error(f"Error getting review {review_id}: {str(e)}")
            raise
    
    async def update_review(self, review_id: str, review_data: ReviewUpdate, user_id: str) -> Optional[Review]:
        """Update a review"""
        try:
            review = await self.get_review(review_id, user_id)
            if not review:
                return None
            
            # Check permissions
            if not await self._check_review_permission(review, user_id, "update"):
                raise ReviewPermissionError("Insufficient permissions to update review")
            
            # Track status change
            old_status = review.status
            
            # Update fields
            update_data = review_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(review, field):
                    setattr(review, field, value)
            
            review.updated_by = user_id
            review.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(review)
            
            # Add history entry if status changed
            if old_status != review.status:
                await self._add_history_entry(
                    review.id,
                    "status_updated",
                    old_status,
                    review.status,
                    f"Status changed from {old_status.value} to {review.status.value}",
                    user_id
                )
            
            logger.info(f"Review updated: {review_id} by {user_id}")
            return review
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating review {review_id}: {str(e)}")
            raise
    
    async def delete_review(self, review_id: str, user_id: str) -> bool:
        """Delete a review"""
        try:
            review = await self.get_review(review_id, user_id)
            if not review:
                return False
            
            # Check permissions
            if not await self._check_review_permission(review, user_id, "delete"):
                raise ReviewPermissionError("Insufficient permissions to delete review")
            
            self.db.delete(review)
            self.db.commit()
            
            logger.info(f"Review deleted: {review_id} by {user_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting review {review_id}: {str(e)}")
            raise
    
    async def list_reviews(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[ReviewStatus] = None,
        review_type: Optional[ReviewType] = None,
        priority: Optional[ReviewPriority] = None,
        assigned_to: Optional[str] = None,
        form_id: Optional[str] = None,
        workflow_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Tuple[List[Review], int]:
        """List reviews with filtering"""
        try:
            query = self.db.query(Review).options(
                joinedload(Review.criteria),
                joinedload(Review.form),
                joinedload(Review.workflow)
            )
            
            # Apply filters
            if status:
                query = query.filter(Review.status == status)
            if review_type:
                query = query.filter(Review.review_type == review_type)
            if priority:
                query = query.filter(Review.priority == priority)
            if assigned_to:
                query = query.filter(Review.assigned_to == assigned_to)
            if form_id:
                query = query.filter(Review.form_id == form_id)
            if workflow_id:
                query = query.filter(Review.workflow_id == workflow_id)
            
            # TODO: Add user permission filtering
            
            # Get total count
            total = query.count()
            
            # Apply pagination and ordering
            reviews = query.order_by(desc(Review.created_at)).offset(skip).limit(limit).all()
            
            return reviews, total
            
        except Exception as e:
            logger.error(f"Error listing reviews: {str(e)}")
            raise
    
    async def assign_review(
        self, 
        review_id: str, 
        assignment_data: ReviewAssignmentCreate, 
        assigner_id: str
    ) -> Optional[ReviewAssignment]:
        """Assign a review to a user"""
        try:
            review = await self.get_review(review_id, assigner_id)
            if not review:
                return None
            
            # Check permissions
            if not await self._check_review_permission(review, assigner_id, "assign"):
                raise ReviewPermissionError("Insufficient permissions to assign review")
            
            # Create assignment
            assignment = ReviewAssignment(
                review_id=review.id,
                assigned_to=assignment_data.assigned_to,
                assigned_by=assigner_id,
                assignment_notes=assignment_data.assignment_notes
            )
            
            # Update review
            review.assigned_to = assignment_data.assigned_to
            review.assigned_at = datetime.utcnow()
            review.status = ReviewStatus.IN_PROGRESS
            review.updated_by = assigner_id
            review.updated_at = datetime.utcnow()
            
            self.db.add(assignment)
            self.db.commit()
            self.db.refresh(assignment)
            
            # Add history entry
            await self._add_history_entry(
                review.id,
                "assigned",
                ReviewStatus.PENDING,
                ReviewStatus.IN_PROGRESS,
                f"Review assigned to {assignment_data.assigned_to}",
                assigner_id
            )
            
            # Send notification
            await self.notification_service.send_review_notification(
                "review_assigned",
                review.id,
                assignment_data.assigned_to,
                f"Review assigned: {review.title}"
            )
            
            logger.info(f"Review assigned: {review_id} to {assignment_data.assigned_to}")
            return assignment
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error assigning review {review_id}: {str(e)}")
            raise
    
    async def approve_review(self, review_id: str, approver_id: str, comments: Optional[str] = None) -> Optional[Review]:
        """Approve a review"""
        try:
            review = await self.get_review(review_id, approver_id)
            if not review:
                return None
            
            # Check permissions
            if not await self._check_review_permission(review, approver_id, "approve"):
                raise ReviewPermissionError("Insufficient permissions to approve review")
            
            # Update review
            old_status = review.status
            review.status = ReviewStatus.APPROVED
            review.completed_at = datetime.utcnow()
            review.updated_by = approver_id
            review.updated_at = datetime.utcnow()
            
            if comments:
                review.comments = comments
            
            self.db.commit()
            self.db.refresh(review)
            
            # Add history entry
            await self._add_history_entry(
                review.id,
                "approved",
                old_status,
                ReviewStatus.APPROVED,
                comments or "Review approved",
                approver_id
            )
            
            # Send notification
            await self.notification_service.send_review_notification(
                "review_approved",
                review.id,
                review.created_by,
                f"Review approved: {review.title}"
            )
            
            logger.info(f"Review approved: {review_id} by {approver_id}")
            return review
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error approving review {review_id}: {str(e)}")
            raise
    
    async def reject_review(self, review_id: str, rejector_id: str, comments: str) -> Optional[Review]:
        """Reject a review"""
        try:
            review = await self.get_review(review_id, rejector_id)
            if not review:
                return None
            
            # Check permissions
            if not await self._check_review_permission(review, rejector_id, "reject"):
                raise ReviewPermissionError("Insufficient permissions to reject review")
            
            # Update review
            old_status = review.status
            review.status = ReviewStatus.REJECTED
            review.completed_at = datetime.utcnow()
            review.comments = comments
            review.updated_by = rejector_id
            review.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(review)
            
            # Add history entry
            await self._add_history_entry(
                review.id,
                "rejected",
                old_status,
                ReviewStatus.REJECTED,
                comments,
                rejector_id
            )
            
            # Send notification
            await self.notification_service.send_review_notification(
                "review_rejected",
                review.id,
                review.created_by,
                f"Review rejected: {review.title}"
            )
            
            logger.info(f"Review rejected: {review_id} by {rejector_id}")
            return review
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error rejecting review {review_id}: {str(e)}")
            raise
    
    async def get_review_history(self, review_id: str, user_id: str) -> List[ReviewHistory]:
        """Get review history"""
        try:
            review = await self.get_review(review_id, user_id)
            if not review:
                return []
            
            history = self.db.query(ReviewHistory).filter(
                ReviewHistory.review_id == review_id
            ).order_by(desc(ReviewHistory.performed_at)).all()
            
            return history
            
        except Exception as e:
            logger.error(f"Error getting review history for {review_id}: {str(e)}")
            raise
    
    async def add_review_criteria(
        self, 
        review_id: str, 
        criteria_data: ReviewCriteriaCreate, 
        user_id: str
    ) -> Optional[ReviewCriteria]:
        """Add criteria to a review"""
        try:
            review = await self.get_review(review_id, user_id)
            if not review:
                return None
            
            # Check permissions
            if not await self._check_review_permission(review, user_id, "update"):
                raise ReviewPermissionError("Insufficient permissions to add criteria")
            
            criteria = ReviewCriteria(
                review_id=review.id,
                name=criteria_data.name,
                description=criteria_data.description,
                weight=criteria_data.weight,
                max_score=criteria_data.max_score,
                is_required=criteria_data.is_required,
                created_by=user_id
            )
            
            self.db.add(criteria)
            self.db.commit()
            self.db.refresh(criteria)
            
            logger.info(f"Criteria added to review: {review_id}")
            return criteria
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error adding criteria to review {review_id}: {str(e)}")
            raise
    
    async def get_review_stats(self, user_id: str) -> ReviewStatsResponse:
        """Get review statistics"""
        try:
            # Base query for user's accessible reviews
            base_query = self.db.query(Review)
            # TODO: Add user permission filtering
            
            # Basic counts
            total_reviews = base_query.count()
            pending_reviews = base_query.filter(Review.status == ReviewStatus.PENDING).count()
            in_progress_reviews = base_query.filter(Review.status == ReviewStatus.IN_PROGRESS).count()
            completed_reviews = base_query.filter(Review.status == ReviewStatus.COMPLETED).count()
            approved_reviews = base_query.filter(Review.status == ReviewStatus.APPROVED).count()
            rejected_reviews = base_query.filter(Review.status == ReviewStatus.REJECTED).count()
            
            # Overdue reviews
            overdue_reviews = base_query.filter(
                and_(
                    Review.due_date < datetime.utcnow(),
                    Review.status.notin_([ReviewStatus.COMPLETED, ReviewStatus.APPROVED])
                )
            ).count()
            
            # Average rating
            avg_rating_result = base_query.filter(Review.rating.isnot(None)).with_entities(
                func.avg(Review.rating)
            ).scalar()
            average_rating = float(avg_rating_result) if avg_rating_result else None
            
            # Completion rate
            total_actionable = total_reviews - rejected_reviews
            completion_rate = (completed_reviews + approved_reviews) / total_actionable if total_actionable > 0 else 0
            
            # Average completion time
            completed_query = base_query.filter(
                and_(
                    Review.completed_at.isnot(None),
                    Review.created_at.isnot(None)
                )
            )
            avg_completion_time = None
            if completed_query.count() > 0:
                # Calculate average time difference in hours
                time_diffs = [
                    (review.completed_at - review.created_at).total_seconds() / 3600
                    for review in completed_query.all()
                ]
                avg_completion_time = sum(time_diffs) / len(time_diffs)
            
            # Breakdown by type
            form_reviews = base_query.filter(Review.review_type == ReviewType.FORM_REVIEW).count()
            workflow_reviews = base_query.filter(Review.review_type == ReviewType.WORKFLOW_REVIEW).count()
            data_reviews = base_query.filter(Review.review_type == ReviewType.DATA_REVIEW).count()
            compliance_reviews = base_query.filter(Review.review_type == ReviewType.COMPLIANCE_REVIEW).count()
            
            # Breakdown by priority
            low_priority = base_query.filter(Review.priority == ReviewPriority.LOW).count()
            medium_priority = base_query.filter(Review.priority == ReviewPriority.MEDIUM).count()
            high_priority = base_query.filter(Review.priority == ReviewPriority.HIGH).count()
            critical_priority = base_query.filter(Review.priority == ReviewPriority.CRITICAL).count()
            
            return ReviewStatsResponse(
                total_reviews=total_reviews,
                pending_reviews=pending_reviews,
                in_progress_reviews=in_progress_reviews,
                completed_reviews=completed_reviews,
                approved_reviews=approved_reviews,
                rejected_reviews=rejected_reviews,
                overdue_reviews=overdue_reviews,
                average_rating=average_rating,
                completion_rate=completion_rate,
                average_completion_time_hours=avg_completion_time,
                form_reviews=form_reviews,
                workflow_reviews=workflow_reviews,
                data_reviews=data_reviews,
                compliance_reviews=compliance_reviews,
                low_priority=low_priority,
                medium_priority=medium_priority,
                high_priority=high_priority,
                critical_priority=critical_priority
            )
            
        except Exception as e:
            logger.error(f"Error getting review stats: {str(e)}")
            raise
    
    async def get_reviews_by_form(self, form_id: str, user_id: str) -> List[Review]:
        """Get all reviews for a specific form"""
        try:
            reviews = self.db.query(Review).filter(Review.form_id == form_id).all()
            # TODO: Filter by user permissions
            return reviews
        except Exception as e:
            logger.error(f"Error getting reviews for form {form_id}: {str(e)}")
            raise
    
    async def get_reviews_by_workflow(self, workflow_id: str, user_id: str) -> List[Review]:
        """Get all reviews for a specific workflow"""
        try:
            reviews = self.db.query(Review).filter(Review.workflow_id == workflow_id).all()
            # TODO: Filter by user permissions
            return reviews
        except Exception as e:
            logger.error(f"Error getting reviews for workflow {workflow_id}: {str(e)}")
            raise
    
    async def _add_history_entry(
        self,
        review_id: str,
        action: str,
        old_status: Optional[ReviewStatus],
        new_status: Optional[ReviewStatus],
        comment: Optional[str],
        user_id: str
    ):
        """Add an entry to review history"""
        try:
            history = ReviewHistory(
                review_id=review_id,
                action=action,
                old_status=old_status,
                new_status=new_status,
                comment=comment,
                performed_by=user_id
            )
            
            self.db.add(history)
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Error adding history entry: {str(e)}")
            # Don't raise - history is not critical
    
    async def _check_review_permission(self, review: Review, user_id: str, action: str) -> bool:
        """Check if user has permission to perform action on review"""
        # Basic permission check - implement proper RBAC here
        
        # Creators can do everything with their reviews
        if review.created_by == user_id:
            return True
        
        # Assignees can read and update their assigned reviews
        if review.assigned_to == user_id and action in ["read", "update"]:
            return True
        
        # TODO: Implement role-based permissions
        # For now, allow all actions for all users
        return True