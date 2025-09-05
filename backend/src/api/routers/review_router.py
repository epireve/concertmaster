"""
Review System API Router
RESTful API endpoints for the comprehensive review and approval system.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, asc, func
from sqlalchemy.orm import joinedload, selectinload

from ...database.connection import get_db_session
from ...models.reviews import (
    ReviewableItem, ReviewTemplate, ReviewStage, ReviewAssignment,
    ReviewComment, ReviewNotification, ReviewAnalytics,
    ReviewStatus, StageType, AssignmentStatus, ReviewDecision,
    CommentType, NotificationType, Priority, Urgency,
    create_review_from_template, calculate_review_metrics
)
from ...services.cache_manager import CacheManager, CacheNamespace
from ...auth.security import SecurityManager, get_current_user
from ...schemas.review import (
    ReviewableItemResponse, ReviewTemplateResponse, ReviewStageResponse,
    ReviewAssignmentResponse, ReviewCommentResponse, ReviewNotificationResponse,
    ReviewAnalyticsResponse, CreateReviewRequest, UpdateReviewRequest,
    SubmitDecisionRequest, CreateAssignmentRequest, AcceptAssignmentRequest,
    DelegateAssignmentRequest, CreateCommentRequest, UpdateCommentRequest,
    CreateTemplateRequest, UpdateTemplateRequest, ReviewListQuery,
    AssignmentListQuery, CommentListQuery, TemplateListQuery,
    NotificationListQuery, PaginatedResponse
)
from ...services.review_websocket_manager import ReviewWebSocketManager
from ...services.review_notification_service import ReviewNotificationService
from ...services.review_permission_service import ReviewPermissionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])

# Initialize dependencies
cache_manager = CacheManager()
security_manager = SecurityManager()
websocket_manager = ReviewWebSocketManager()
notification_service = ReviewNotificationService()
permission_service = ReviewPermissionService()


# ==================== REVIEW ITEMS ENDPOINTS ====================

@router.post("/", response_model=ReviewableItemResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: CreateReviewRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new reviewable item"""
    try:
        # Validate permissions
        await permission_service.validate_create_review_permission(
            user=current_user,
            item_type=review_data.item_type,
            item_id=review_data.item_id,
            db=db
        )
        
        # Validate referenced item exists
        item_exists = await _validate_reviewable_item_exists(
            review_data.item_type,
            review_data.item_id,
            db
        )
        if not item_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Referenced item {review_data.item_type}:{review_data.item_id} does not exist"
            )
        
        # Check for existing review
        existing_review = await _find_existing_review(
            review_data.item_type,
            review_data.item_id,
            db
        )
        if existing_review:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Review already exists for this item"
            )
        
        # Create review item
        review = ReviewableItem(
            item_type=review_data.item_type,
            item_id=review_data.item_id,
            organization_id=current_user.organization_id,
            title=review_data.title,
            description=review_data.description,
            priority=review_data.priority or Priority.NORMAL.value,
            urgency=review_data.urgency or Urgency.NORMAL.value,
            created_by=current_user.id,
            due_date=review_data.due_date,
            metadata=review_data.metadata or {},
            tags=review_data.tags or []
        )
        
        # Apply template if specified
        if review_data.review_template_id:
            template = await _get_review_template(review_data.review_template_id, db)
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Review template not found"
                )
            
            if review_data.item_type not in template.item_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Template is not applicable for this item type"
                )
            
            review.review_template_id = template.id
        
        db.add(review)
        await db.flush()  # Get the ID
        
        # Create stages from template
        if review.review_template_id:
            stages = create_review_from_template(template, review)
            db.add_all(stages)
            
            # Set current stage to first stage
            if stages:
                first_stage = min(stages, key=lambda s: s.stage_order)
                review.current_stage_id = first_stage.id
                first_stage.status = "active"
                
                # Create initial assignments
                await _create_initial_assignments(first_stage, template, db)
        
        await db.commit()
        await db.refresh(review)
        
        # Cache the review
        await cache_manager.cache_review(review.id, review)
        
        # Send notifications
        await notification_service.notify_review_created(review, db)
        
        # Notify websocket subscribers
        await websocket_manager.notify_review_created(review)
        
        logger.info(f"Created review {review.id} for item {review_data.item_type}:{review_data.item_id}")
        
        return ReviewableItemResponse.from_orm(review)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create review: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create review"
        )


@router.get("/", response_model=PaginatedResponse[ReviewableItemResponse])
async def list_reviews(
    query: ReviewListQuery = Depends(),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List reviews with filtering and pagination"""
    try:
        # Build base query
        stmt = select(ReviewableItem).options(
            joinedload(ReviewableItem.created_by_user),
            joinedload(ReviewableItem.template),
            selectinload(ReviewableItem.stages).selectinload(ReviewStage.assignments)
        )
        
        # Apply organization filter
        stmt = stmt.where(ReviewableItem.organization_id == current_user.organization_id)
        
        # Apply filters
        if query.status:
            stmt = stmt.where(ReviewableItem.review_status.in_(query.status))
        
        if query.assigned_to:
            # Join with assignments to filter by assigned user
            stmt = stmt.join(ReviewStage).join(ReviewAssignment).where(
                ReviewAssignment.assigned_to_user_id == query.assigned_to
            )
        
        if query.item_type:
            stmt = stmt.where(ReviewableItem.item_type == query.item_type)
        
        if query.priority:
            stmt = stmt.where(ReviewableItem.priority.in_(query.priority))
        
        if query.urgency:
            stmt = stmt.where(ReviewableItem.urgency.in_(query.urgency))
        
        if query.tags:
            for tag in query.tags:
                stmt = stmt.where(ReviewableItem.tags.contains([tag]))
        
        if query.due_date:
            if query.due_date.start:
                stmt = stmt.where(ReviewableItem.due_date >= query.due_date.start)
            if query.due_date.end:
                stmt = stmt.where(ReviewableItem.due_date <= query.due_date.end)
        
        if query.search:
            search_term = f"%{query.search}%"
            stmt = stmt.where(
                or_(
                    ReviewableItem.title.ilike(search_term),
                    ReviewableItem.description.ilike(search_term)
                )
            )
        
        # Apply sorting
        sort_field = getattr(ReviewableItem, query.sort_by, ReviewableItem.created_at)
        if query.sort_order == 'desc':
            stmt = stmt.order_by(desc(sort_field))
        else:
            stmt = stmt.order_by(asc(sort_field))
        
        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar()
        
        # Apply pagination
        stmt = stmt.offset(query.offset).limit(query.limit)
        
        # Execute query
        result = await db.execute(stmt)
        reviews = result.scalars().unique().all()
        
        return PaginatedResponse(
            data=[ReviewableItemResponse.from_orm(review) for review in reviews],
            total=total,
            limit=query.limit,
            offset=query.offset,
            has_more=query.offset + len(reviews) < total
        )
        
    except Exception as e:
        logger.error(f"Failed to list reviews: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list reviews"
        )


@router.get("/{review_id}", response_model=ReviewableItemResponse)
async def get_review(
    review_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get review by ID with full details"""
    try:
        # Try cache first
        cached_review = await cache_manager.get_review(review_id)
        if cached_review:
            # Validate access
            await permission_service.validate_review_access(current_user, cached_review, db)
            return ReviewableItemResponse(**cached_review)
        
        # Query database with all related data
        stmt = select(ReviewableItem).options(
            joinedload(ReviewableItem.created_by_user),
            joinedload(ReviewableItem.template),
            selectinload(ReviewableItem.stages).selectinload(ReviewStage.assignments),
            selectinload(ReviewableItem.comments).selectinload(ReviewComment.author),
            selectinload(ReviewableItem.notifications)
        ).where(ReviewableItem.id == review_id)
        
        result = await db.execute(stmt)
        review = result.scalar_one_or_none()
        
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        # Validate access
        await permission_service.validate_review_access(current_user, review, db)
        
        # Cache the result
        await cache_manager.cache_review(review_id, review)
        
        return ReviewableItemResponse.from_orm(review)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get review {review_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get review"
        )


@router.put("/{review_id}", response_model=ReviewableItemResponse)
async def update_review(
    review_id: UUID,
    update_data: UpdateReviewRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Update review details"""
    try:
        # Get existing review
        stmt = select(ReviewableItem).where(ReviewableItem.id == review_id)
        result = await db.execute(stmt)
        review = result.scalar_one_or_none()
        
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        # Validate permissions
        await permission_service.validate_review_edit_permission(current_user, review, db)
        
        # Update fields
        update_fields = update_data.dict(exclude_unset=True)
        for field, value in update_fields.items():
            setattr(review, field, value)
        
        review.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(review)
        
        # Invalidate cache
        await cache_manager.invalidate_review(review_id)
        
        # Notify subscribers
        await websocket_manager.notify_review_updated(review)
        
        logger.info(f"Updated review {review_id}")
        
        return ReviewableItemResponse.from_orm(review)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update review {review_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update review"
        )


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Delete review (soft delete by setting status to cancelled)"""
    try:
        # Get existing review
        stmt = select(ReviewableItem).where(ReviewableItem.id == review_id)
        result = await db.execute(stmt)
        review = result.scalar_one_or_none()
        
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        # Validate permissions
        await permission_service.validate_review_delete_permission(current_user, review, db)
        
        # Soft delete by setting status to cancelled
        review.review_status = ReviewStatus.CANCELLED.value
        review.updated_at = datetime.utcnow()
        
        await db.commit()
        
        # Invalidate cache
        await cache_manager.invalidate_review(review_id)
        
        # Notify subscribers
        await websocket_manager.notify_review_updated(review)
        
        # Send cancellation notifications
        await notification_service.notify_review_cancelled(review, db)
        
        logger.info(f"Deleted review {review_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete review {review_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete review"
        )


# ==================== REVIEW DECISIONS ENDPOINTS ====================

@router.post("/{review_id}/submit-decision", response_model=ReviewAssignmentResponse)
async def submit_decision(
    review_id: UUID,
    decision_data: SubmitDecisionRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Submit a review decision for an assignment"""
    try:
        # Get assignment with stage and review
        stmt = select(ReviewAssignment).options(
            joinedload(ReviewAssignment.review_stage).joinedload(ReviewStage.reviewable_item)
        ).where(ReviewAssignment.id == decision_data.assignment_id)
        
        result = await db.execute(stmt)
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        # Validate assignment belongs to the review
        if assignment.review_stage.reviewable_item.id != review_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignment does not belong to this review"
            )
        
        # Validate permissions
        await permission_service.validate_submit_decision_permission(
            current_user, assignment, db
        )
        
        # Validate assignment state
        if assignment.status == AssignmentStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignment has already been completed"
            )
        
        if assignment.assigned_to_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this review"
            )
        
        # Update assignment
        assignment.decision = decision_data.decision.value
        assignment.comments = decision_data.comments
        assignment.review_data = decision_data.review_data or {}
        assignment.attachments = [att.dict() for att in (decision_data.attachments or [])]
        assignment.status = AssignmentStatus.COMPLETED.value
        assignment.completed_at = datetime.utcnow()
        
        # Check if stage can be completed
        stage = assignment.review_stage
        await _check_stage_completion(stage, db)
        
        await db.commit()
        await db.refresh(assignment)
        
        # Invalidate caches
        await cache_manager.invalidate_review(review_id)
        
        # Send notifications
        await notification_service.notify_decision_submitted(assignment, db)
        
        # Notify websocket subscribers
        await websocket_manager.notify_assignment_updated(assignment)
        
        logger.info(
            f"Decision '{decision_data.decision}' submitted for assignment {assignment.id} "
            f"by user {current_user.id}"
        )
        
        return ReviewAssignmentResponse.from_orm(assignment)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit decision: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit decision"
        )


# ==================== ASSIGNMENTS ENDPOINTS ====================

@router.get("/assignments", response_model=PaginatedResponse[ReviewAssignmentResponse])
async def list_assignments(
    query: AssignmentListQuery = Depends(),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List review assignments"""
    try:
        # Build base query
        stmt = select(ReviewAssignment).options(
            joinedload(ReviewAssignment.assigned_to_user),
            joinedload(ReviewAssignment.assigned_by_user),
            joinedload(ReviewAssignment.review_stage).joinedload(ReviewStage.reviewable_item)
        )
        
        # Default to current user's assignments if no user specified
        user_id = query.user_id or current_user.id
        
        # Validate permission to view assignments
        if user_id != current_user.id:
            await permission_service.validate_view_all_assignments_permission(current_user, db)
        
        stmt = stmt.where(ReviewAssignment.assigned_to_user_id == user_id)
        
        # Apply filters
        if query.status:
            stmt = stmt.where(ReviewAssignment.status.in_(query.status))
        
        if query.review_id:
            stmt = stmt.join(ReviewStage).where(ReviewStage.reviewable_item_id == query.review_id)
        
        if query.priority:
            stmt = stmt.join(ReviewStage).join(ReviewableItem).where(
                ReviewableItem.priority.in_(query.priority)
            )
        
        if query.urgency:
            stmt = stmt.join(ReviewStage).join(ReviewableItem).where(
                ReviewableItem.urgency.in_(query.urgency)
            )
        
        if query.due_date:
            if query.due_date.start:
                stmt = stmt.where(ReviewAssignment.due_date >= query.due_date.start)
            if query.due_date.end:
                stmt = stmt.where(ReviewAssignment.due_date <= query.due_date.end)
        
        # Apply sorting
        sort_field = getattr(ReviewAssignment, query.sort_by, ReviewAssignment.assigned_at)
        if query.sort_order == 'desc':
            stmt = stmt.order_by(desc(sort_field))
        else:
            stmt = stmt.order_by(asc(sort_field))
        
        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar()
        
        # Apply pagination
        stmt = stmt.offset(query.offset).limit(query.limit)
        
        # Execute query
        result = await db.execute(stmt)
        assignments = result.scalars().unique().all()
        
        return PaginatedResponse(
            data=[ReviewAssignmentResponse.from_orm(assignment) for assignment in assignments],
            total=total,
            limit=query.limit,
            offset=query.offset,
            has_more=query.offset + len(assignments) < total
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list assignments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list assignments"
        )


@router.post("/assignments", response_model=ReviewAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    assignment_data: CreateAssignmentRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new review assignment"""
    try:
        # Get stage
        stmt = select(ReviewStage).options(
            joinedload(ReviewStage.reviewable_item)
        ).where(ReviewStage.id == assignment_data.review_stage_id)
        
        result = await db.execute(stmt)
        stage = result.scalar_one_or_none()
        
        if not stage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review stage not found"
            )
        
        # Validate permissions
        await permission_service.validate_assign_review_permission(current_user, stage, db)
        
        # Create assignment
        assignment = ReviewAssignment(
            review_stage_id=assignment_data.review_stage_id,
            assigned_to_user_id=assignment_data.assigned_to_user_id,
            assigned_to_role=assignment_data.assigned_to_role,
            assigned_by=current_user.id,
            due_date=assignment_data.due_date,
            comments=assignment_data.comments
        )
        
        db.add(assignment)
        await db.commit()
        await db.refresh(assignment)
        
        # Send notification
        await notification_service.notify_assignment_created(assignment, db)
        
        # Notify websocket subscribers
        await websocket_manager.notify_assignment_created(assignment)
        
        logger.info(f"Created assignment {assignment.id} for stage {assignment_data.review_stage_id}")
        
        return ReviewAssignmentResponse.from_orm(assignment)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create assignment: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create assignment"
        )


@router.put("/assignments/{assignment_id}/accept", response_model=ReviewAssignmentResponse)
async def accept_assignment(
    assignment_id: UUID,
    accept_data: AcceptAssignmentRequest = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Accept a review assignment"""
    try:
        # Get assignment
        stmt = select(ReviewAssignment).where(ReviewAssignment.id == assignment_id)
        result = await db.execute(stmt)
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        # Validate assignment belongs to current user
        if assignment.assigned_to_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this review"
            )
        
        # Validate assignment state
        if assignment.status != AssignmentStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignment cannot be accepted in current state"
            )
        
        # Update assignment
        assignment.status = AssignmentStatus.ACCEPTED.value
        assignment.accepted_at = datetime.utcnow()
        
        if accept_data:
            if accept_data.comments:
                assignment.comments = accept_data.comments
            if accept_data.estimated_completion_date:
                assignment.due_date = accept_data.estimated_completion_date
        
        await db.commit()
        await db.refresh(assignment)
        
        # Send notification
        await notification_service.notify_assignment_accepted(assignment, db)
        
        # Notify websocket subscribers
        await websocket_manager.notify_assignment_updated(assignment)
        
        logger.info(f"Assignment {assignment_id} accepted by user {current_user.id}")
        
        return ReviewAssignmentResponse.from_orm(assignment)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to accept assignment {assignment_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to accept assignment"
        )


@router.put("/assignments/{assignment_id}/delegate", response_model=ReviewAssignmentResponse)
async def delegate_assignment(
    assignment_id: UUID,
    delegate_data: DelegateAssignmentRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Delegate a review assignment to another user"""
    try:
        # Get assignment
        stmt = select(ReviewAssignment).where(ReviewAssignment.id == assignment_id)
        result = await db.execute(stmt)
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        # Validate permissions
        await permission_service.validate_delegate_assignment_permission(
            current_user, assignment, db
        )
        
        # Update assignment
        assignment.status = AssignmentStatus.DELEGATED.value
        assignment.delegated_to = delegate_data.delegate_to_user_id
        assignment.delegation_reason = delegate_data.reason
        
        # Create new assignment for delegated user
        new_assignment = ReviewAssignment(
            review_stage_id=assignment.review_stage_id,
            assigned_to_user_id=delegate_data.delegate_to_user_id,
            assigned_by=current_user.id,
            due_date=delegate_data.due_date or assignment.due_date,
            comments=f"Delegated from {current_user.full_name}: {delegate_data.reason or ''}"
        )
        
        db.add(new_assignment)
        await db.commit()
        await db.refresh(assignment)
        await db.refresh(new_assignment)
        
        # Send notifications
        await notification_service.notify_assignment_delegated(assignment, new_assignment, db)
        
        # Notify websocket subscribers
        await websocket_manager.notify_assignment_updated(assignment)
        await websocket_manager.notify_assignment_created(new_assignment)
        
        logger.info(f"Assignment {assignment_id} delegated to user {delegate_data.delegate_to_user_id}")
        
        return ReviewAssignmentResponse.from_orm(assignment)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delegate assignment {assignment_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delegate assignment"
        )


# ==================== COMMENTS ENDPOINTS ====================

@router.get("/{review_id}/comments", response_model=PaginatedResponse[ReviewCommentResponse])
async def list_comments(
    review_id: UUID,
    query: CommentListQuery = Depends(),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List comments for a review"""
    try:
        # Validate review access
        await permission_service.validate_review_comments_access(current_user, review_id, db)
        
        # Build base query
        stmt = select(ReviewComment).options(
            joinedload(ReviewComment.author),
            joinedload(ReviewComment.resolved_by_user)
        ).where(ReviewComment.reviewable_item_id == review_id)
        
        # Apply filters
        if query.stage_id:
            stmt = stmt.where(ReviewComment.review_stage_id == query.stage_id)
        
        if query.author_id:
            stmt = stmt.where(ReviewComment.author_id == query.author_id)
        
        if query.comment_type:
            stmt = stmt.where(ReviewComment.comment_type.in_(query.comment_type))
        
        if query.resolved is not None:
            stmt = stmt.where(ReviewComment.is_resolved == query.resolved)
        
        # Apply sorting
        sort_field = getattr(ReviewComment, query.sort_by, ReviewComment.created_at)
        if query.sort_order == 'desc':
            stmt = stmt.order_by(desc(sort_field))
        else:
            stmt = stmt.order_by(asc(sort_field))
        
        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar()
        
        # Apply pagination
        stmt = stmt.offset(query.offset).limit(query.limit)
        
        # Execute query
        result = await db.execute(stmt)
        comments = result.scalars().unique().all()
        
        return PaginatedResponse(
            data=[ReviewCommentResponse.from_orm(comment) for comment in comments],
            total=total,
            limit=query.limit,
            offset=query.offset,
            has_more=query.offset + len(comments) < total
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list comments for review {review_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list comments"
        )


@router.post("/{review_id}/comments", response_model=ReviewCommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    review_id: UUID,
    comment_data: CreateCommentRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new comment on a review"""
    try:
        # Validate review access
        await permission_service.validate_add_comment_permission(current_user, review_id, db)
        
        # Calculate thread depth if replying to a comment
        thread_depth = 0
        if comment_data.parent_comment_id:
            stmt = select(ReviewComment).where(ReviewComment.id == comment_data.parent_comment_id)
            result = await db.execute(stmt)
            parent_comment = result.scalar_one_or_none()
            
            if not parent_comment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent comment not found"
                )
            
            if parent_comment.reviewable_item_id != review_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent comment does not belong to this review"
                )
            
            thread_depth = parent_comment.thread_depth + 1
        
        # Create comment
        comment = ReviewComment(
            reviewable_item_id=review_id,
            review_stage_id=comment_data.review_stage_id,
            parent_comment_id=comment_data.parent_comment_id,
            content=comment_data.content,
            comment_type=comment_data.comment_type or CommentType.COMMENT.value,
            author_id=current_user.id,
            thread_depth=thread_depth,
            mentions=comment_data.mentions or [],
            attachments=[att.dict() for att in (comment_data.attachments or [])]
        )
        
        db.add(comment)
        await db.commit()
        await db.refresh(comment)
        
        # Send notifications
        await notification_service.notify_comment_added(comment, db)
        
        # Send mention notifications
        if comment_data.mentions:
            await notification_service.notify_mentioned_users(comment, comment_data.mentions, db)
        
        # Notify websocket subscribers
        await websocket_manager.notify_comment_added(comment)
        
        logger.info(f"Comment {comment.id} created on review {review_id} by user {current_user.id}")
        
        return ReviewCommentResponse.from_orm(comment)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create comment on review {review_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create comment"
        )


@router.put("/comments/{comment_id}", response_model=ReviewCommentResponse)
async def update_comment(
    comment_id: UUID,
    update_data: UpdateCommentRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Update a comment"""
    try:
        # Get comment
        stmt = select(ReviewComment).where(ReviewComment.id == comment_id)
        result = await db.execute(stmt)
        comment = result.scalar_one_or_none()
        
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found"
            )
        
        # Validate permissions
        await permission_service.validate_edit_comment_permission(current_user, comment, db)
        
        # Update fields
        if update_data.content is not None:
            comment.content = update_data.content
        
        if update_data.is_resolved is not None:
            if update_data.is_resolved and not comment.is_resolved:
                # Resolving comment
                comment.is_resolved = True
                comment.resolved_by = current_user.id
                comment.resolved_at = datetime.utcnow()
            elif not update_data.is_resolved and comment.is_resolved:
                # Unresolving comment
                comment.is_resolved = False
                comment.resolved_by = None
                comment.resolved_at = None
        
        comment.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(comment)
        
        # Notify websocket subscribers
        await websocket_manager.notify_comment_updated(comment)
        
        logger.info(f"Comment {comment_id} updated by user {current_user.id}")
        
        return ReviewCommentResponse.from_orm(comment)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update comment {comment_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update comment"
        )


# ==================== WEBSOCKET ENDPOINT ====================

@router.websocket("/ws/{review_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    review_id: UUID,
    current_user=Depends(get_current_user)
):
    """WebSocket endpoint for real-time review updates"""
    try:
        await websocket_manager.connect(websocket, current_user.id, review_id)
        
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            await websocket_manager.handle_message(websocket, current_user.id, data)
            
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket, current_user.id, review_id)
    except Exception as e:
        logger.error(f"WebSocket error for review {review_id}: {e}")
        await websocket_manager.disconnect(websocket, current_user.id, review_id)


# ==================== HELPER FUNCTIONS ====================

async def _validate_reviewable_item_exists(
    item_type: str,
    item_id: UUID,
    db: AsyncSession
) -> bool:
    """Validate that the referenced item exists"""
    # This would check different tables based on item_type
    if item_type == "form_submission":
        from ...models.forms import FormResponse
        stmt = select(FormResponse).where(FormResponse.id == item_id)
    elif item_type == "workflow":
        from ...models.workflow import Workflow
        stmt = select(Workflow).where(Workflow.id == item_id)
    elif item_type == "form_template":
        from ...models.forms import FormSchema
        stmt = select(FormSchema).where(FormSchema.id == item_id)
    else:
        return False  # Unknown item type
    
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def _find_existing_review(
    item_type: str,
    item_id: UUID,
    db: AsyncSession
) -> Optional[ReviewableItem]:
    """Find existing review for an item"""
    stmt = select(ReviewableItem).where(
        and_(
            ReviewableItem.item_type == item_type,
            ReviewableItem.item_id == item_id,
            ReviewableItem.review_status != ReviewStatus.CANCELLED.value
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _get_review_template(
    template_id: UUID,
    db: AsyncSession
) -> Optional[ReviewTemplate]:
    """Get review template by ID"""
    stmt = select(ReviewTemplate).where(ReviewTemplate.id == template_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _create_initial_assignments(
    stage: ReviewStage,
    template: ReviewTemplate,
    db: AsyncSession
) -> None:
    """Create initial assignments for a stage based on template rules"""
    # This would implement auto-assignment logic based on template rules
    # For now, we'll skip auto-assignment and let users manually assign
    pass


async def _check_stage_completion(stage: ReviewStage, db: AsyncSession) -> None:
    """Check if a stage can be completed and advance to next stage"""
    # Get all assignments for this stage
    stmt = select(ReviewAssignment).where(ReviewAssignment.review_stage_id == stage.id)
    result = await db.execute(stmt)
    assignments = result.scalars().all()
    
    # Count completed assignments with approval decisions
    completed_assignments = [
        a for a in assignments
        if a.status == AssignmentStatus.COMPLETED.value and a.decision in [
            ReviewDecision.APPROVED.value,
            ReviewDecision.REJECTED.value,
            ReviewDecision.REQUIRES_CHANGES.value
        ]
    ]
    
    # Check if stage requirements are met
    if len(completed_assignments) >= stage.required_approvals:
        # Complete the stage
        stage.status = "completed"
        stage.completed_at = datetime.utcnow()
        
        # Check final stage completion
        review = stage.reviewable_item
        
        # Get all stages for the review
        stmt = select(ReviewStage).where(
            ReviewStage.reviewable_item_id == review.id
        ).order_by(ReviewStage.stage_order)
        result = await db.execute(stmt)
        all_stages = result.scalars().all()
        
        # Find next stage
        current_stage_order = stage.stage_order
        next_stage = None
        for s in all_stages:
            if s.stage_order > current_stage_order:
                next_stage = s
                break
        
        if next_stage:
            # Activate next stage
            next_stage.status = "active"
            next_stage.started_at = datetime.utcnow()
            review.current_stage_id = next_stage.id
        else:
            # All stages completed - determine final status
            approved_count = sum(1 for a in completed_assignments if a.decision == ReviewDecision.APPROVED.value)
            rejected_count = sum(1 for a in completed_assignments if a.decision == ReviewDecision.REJECTED.value)
            
            if rejected_count > 0:
                review.review_status = ReviewStatus.REJECTED.value
            elif approved_count > 0:
                review.review_status = ReviewStatus.APPROVED.value
            else:
                review.review_status = ReviewStatus.REQUIRES_CHANGES.value
            
            review.review_completed_at = datetime.utcnow()
            review.current_stage_id = None