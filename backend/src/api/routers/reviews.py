"""
ConcertMaster Review API Router
REST API endpoints for review operations
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import logging

from ...database.connection import get_db_session
from ...auth.security import get_current_active_user
from ...services.review_service import ReviewService
from ...schemas.reviews import (
    ReviewCreate, ReviewUpdate, ReviewResponse, ReviewFilters,
    RatingCreate, RatingUpdate, RatingResponse,
    CommentCreate, CommentUpdate, CommentResponse,
    ReviewVoteCreate, CommentVoteCreate, VoteResponse,
    ReviewSummaryResponse, PaginationParams, PaginatedResponse,
    ReviewSort, BulkReviewOperation, BulkOperationResponse,
    ReviewAnalytics
)
from ...models.reviews import ReviewType

logger = logging.getLogger(__name__)
security = HTTPBearer()

router = APIRouter()


# Review CRUD endpoints
@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Create a new review"""
    try:
        service = ReviewService(db)
        review = await service.create_review(
            review_data=review_data,
            author_id=current_user["id"],
            author_name=current_user["name"]
        )
        return review
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create review: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(
    review_id: UUID,
    include_deleted: bool = Query(False, description="Include deleted comments (admin only)"),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Get a specific review by ID"""
    service = ReviewService(db)
    review = await service.get_review(
        review_id=review_id, 
        include_deleted_comments=include_deleted and current_user.get("is_admin", False)
    )
    
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    return review


@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: UUID,
    review_data: ReviewUpdate,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Update a review (only by author)"""
    try:
        service = ReviewService(db)
        review = await service.update_review(
            review_id=review_id,
            review_data=review_data,
            author_id=current_user["id"]
        )
        
        if not review:
            raise HTTPException(status_code=404, detail="Review not found or not authorized")
        
        return review
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update review {review_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: UUID,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Delete a review (only by author)"""
    service = ReviewService(db)
    success = await service.delete_review(
        review_id=review_id,
        author_id=current_user["id"]
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Review not found or not authorized")


# Review listing and search
@router.get("/", response_model=PaginatedResponse)
async def list_reviews(
    # Pagination
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort: ReviewSort = Query(ReviewSort.NEWEST),
    
    # Filters
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[UUID] = Query(None),
    author_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None, ge=1.0, le=5.0),
    max_rating: Optional[float] = Query(None, ge=1.0, le=5.0),
    is_verified: Optional[bool] = Query(None),
    tags: Optional[List[str]] = Query(None),
    search_query: Optional[str] = Query(None, max_length=100),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """List reviews with filtering and pagination"""
    try:
        # Build filters
        from datetime import datetime
        filters = ReviewFilters(
            entity_type=entity_type,
            entity_id=entity_id,
            author_id=author_id,
            status=status,
            min_rating=min_rating,
            max_rating=max_rating,
            is_verified=is_verified,
            tags=tags,
            search_query=search_query,
            date_from=datetime.fromisoformat(date_from) if date_from else None,
            date_to=datetime.fromisoformat(date_to) if date_to else None
        )
        
        pagination = PaginationParams(
            page=page,
            per_page=per_page,
            sort=sort
        )
        
        service = ReviewService(db)
        reviews, total = await service.list_reviews(filters, pagination)
        
        # Calculate pagination metadata
        pages = (total + per_page - 1) // per_page
        has_next = page < pages
        has_prev = page > 1
        
        return PaginatedResponse(
            items=reviews,
            total=total,
            page=page,
            per_page=per_page,
            pages=pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to list reviews: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Vote endpoints
@router.post("/{review_id}/vote", response_model=dict, status_code=status.HTTP_201_CREATED)
async def vote_on_review(
    review_id: UUID,
    vote_data: ReviewVoteCreate,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Vote on review helpfulness"""
    try:
        service = ReviewService(db)
        success = await service.vote_on_review(
            review_id=review_id,
            user_id=current_user["id"],
            vote_data=vote_data
        )
        
        if success:
            return {"message": "Vote recorded successfully"}
        else:
            raise HTTPException(status_code=404, detail="Review not found")
            
    except Exception as e:
        logger.error(f"Failed to vote on review {review_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Comment endpoints
@router.post("/{review_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    review_id: UUID,
    comment_data: CommentCreate,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Add a comment to a review"""
    try:
        service = ReviewService(db)
        comment = await service.add_comment(
            review_id=review_id,
            comment_data=comment_data,
            author_id=current_user["id"],
            author_name=current_user["name"]
        )
        return comment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to add comment to review {review_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/comments/{comment_id}/vote", response_model=dict, status_code=status.HTTP_201_CREATED)
async def vote_on_comment(
    comment_id: UUID,
    vote_data: CommentVoteCreate,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Vote on a comment"""
    try:
        service = ReviewService(db)
        success = await service.vote_on_comment(
            comment_id=comment_id,
            user_id=current_user["id"],
            vote_data=vote_data
        )
        
        if success:
            return {"message": "Vote recorded successfully"}
        else:
            raise HTTPException(status_code=404, detail="Comment not found")
            
    except Exception as e:
        logger.error(f"Failed to vote on comment {comment_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Entity summary endpoints
@router.get("/entities/{entity_type}/{entity_id}/summary", response_model=ReviewSummaryResponse)
async def get_entity_summary(
    entity_type: str,
    entity_id: UUID,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Get review summary for a specific entity"""
    try:
        # Validate entity type
        try:
            entity_type_enum = ReviewType(entity_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid entity type")
        
        service = ReviewService(db)
        summary = await service.get_entity_summary(entity_type_enum, entity_id)
        
        if not summary:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get entity summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Trending and analytics endpoints
@router.get("/trending", response_model=List[ReviewResponse])
async def get_trending_reviews(
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Get trending reviews based on recent engagement"""
    service = ReviewService(db)
    reviews = await service.get_trending_reviews(days=days, limit=limit)
    return reviews


@router.get("/users/{user_id}/reviews", response_model=List[ReviewResponse])
async def get_user_reviews(
    user_id: UUID,
    include_drafts: bool = Query(False),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Get all reviews by a specific user"""
    # Users can only see their own drafts
    if include_drafts and user_id != current_user["id"] and not current_user.get("is_admin", False):
        include_drafts = False
    
    service = ReviewService(db)
    reviews = await service.get_user_reviews(user_id=user_id, include_drafts=include_drafts)
    return reviews


# Admin endpoints
@router.post("/bulk", response_model=BulkOperationResponse)
async def bulk_review_operation(
    operation: BulkReviewOperation,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Perform bulk operations on reviews (admin only)"""
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # This would implement bulk operations like archive, delete, flag, etc.
    # For now, return a placeholder response
    return BulkOperationResponse(
        success_count=0,
        failed_count=len(operation.review_ids),
        failed_items=[{"id": str(rid), "error": "Not implemented"} for rid in operation.review_ids]
    )


@router.get("/analytics", response_model=ReviewAnalytics)
async def get_review_analytics(
    entity_type: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """Get review analytics (admin only)"""
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # This would implement analytics calculations
    # For now, return a placeholder response
    return ReviewAnalytics(
        total_reviews=0,
        average_rating=0.0,
        rating_trend=[],
        top_reviewers=[],
        popular_entities=[],
        engagement_metrics={}
    )