"""
Unit tests for Review System API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import uuid4, UUID
from datetime import datetime, timedelta
import json

from ..main import app
from ..models.base import Base
from ..models.reviews import Review, Rating, Comment, ReviewVote, ReviewType, ReviewStatus, RatingType
from ..database.connection import get_db_session


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_reviews.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database session for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


def override_get_current_user():
    """Override authentication for testing"""
    return {
        "id": uuid4(),
        "name": "Test User",
        "email": "test@example.com",
        "is_admin": False
    }


def override_get_admin_user():
    """Override authentication for admin testing"""
    return {
        "id": uuid4(),
        "name": "Admin User",
        "email": "admin@example.com",
        "is_admin": True
    }


app.dependency_overrides[get_db_session] = override_get_db
app.dependency_overrides[get_current_active_user] = override_get_current_user

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Set up test database"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_review_data():
    """Sample review data for testing"""
    return {
        "title": "Great workflow!",
        "content": "This workflow is really helpful and easy to use. I highly recommend it.",
        "entity_type": "workflow",
        "entity_id": str(uuid4()),
        "overall_rating": 4.5,
        "ratings": [
            {"rating_type": "usability", "value": 5.0, "comment": "Very user-friendly"},
            {"rating_type": "performance", "value": 4.0, "comment": "Fast execution"}
        ],
        "tags": ["helpful", "workflow", "recommended"],
        "metadata": {"version": "1.0.0"}
    }


@pytest.fixture
def sample_comment_data():
    """Sample comment data for testing"""
    return {
        "content": "Thank you for the detailed review! This is very helpful."
    }


class TestReviewCRUD:
    """Test Review CRUD operations"""
    
    def test_create_review_success(self, sample_review_data):
        """Test successful review creation"""
        response = client.post("/api/v1/reviews/", json=sample_review_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["title"] == sample_review_data["title"]
        assert data["content"] == sample_review_data["content"]
        assert data["entity_type"] == sample_review_data["entity_type"]
        assert data["overall_rating"] == sample_review_data["overall_rating"]
        assert data["status"] == "published"
        assert len(data["ratings"]) == 2
        assert data["tags"] == sample_review_data["tags"]
    
    def test_create_review_invalid_rating(self, sample_review_data):
        """Test review creation with invalid rating"""
        sample_review_data["overall_rating"] = 6.0  # Invalid rating
        
        response = client.post("/api/v1/reviews/", json=sample_review_data)
        assert response.status_code == 422  # Validation error
    
    def test_create_review_short_title(self, sample_review_data):
        """Test review creation with too short title"""
        sample_review_data["title"] = "Hi"  # Too short
        
        response = client.post("/api/v1/reviews/", json=sample_review_data)
        assert response.status_code == 422
    
    def test_get_review_success(self, sample_review_data):
        """Test successful review retrieval"""
        # Create review first
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        # Get review
        response = client.get(f"/api/v1/reviews/{review_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == review_id
        assert data["title"] == sample_review_data["title"]
    
    def test_get_review_not_found(self):
        """Test getting non-existent review"""
        fake_id = str(uuid4())
        response = client.get(f"/api/v1/reviews/{fake_id}")
        
        assert response.status_code == 404
    
    def test_update_review_success(self, sample_review_data):
        """Test successful review update"""
        # Create review first
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        # Update review
        update_data = {
            "title": "Updated title",
            "overall_rating": 5.0
        }
        
        response = client.put(f"/api/v1/reviews/{review_id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated title"
        assert data["overall_rating"] == 5.0
    
    def test_delete_review_success(self, sample_review_data):
        """Test successful review deletion"""
        # Create review first
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        # Delete review
        response = client.delete(f"/api/v1/reviews/{review_id}")
        
        assert response.status_code == 204


class TestReviewListing:
    """Test review listing and filtering"""
    
    def test_list_reviews_default(self, sample_review_data):
        """Test default review listing"""
        # Create a few reviews
        for i in range(3):
            review_data = sample_review_data.copy()
            review_data["title"] = f"Review {i}"
            client.post("/api/v1/reviews/", json=review_data)
        
        response = client.get("/api/v1/reviews/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert data["page"] == 1
        assert data["per_page"] == 20
    
    def test_list_reviews_pagination(self, sample_review_data):
        """Test review listing with pagination"""
        # Create reviews
        for i in range(5):
            review_data = sample_review_data.copy()
            review_data["title"] = f"Review {i}"
            client.post("/api/v1/reviews/", json=review_data)
        
        # Test pagination
        response = client.get("/api/v1/reviews/?page=1&per_page=2")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["items"]) <= 2
        assert data["per_page"] == 2
    
    def test_list_reviews_filter_by_entity(self, sample_review_data):
        """Test filtering reviews by entity"""
        entity_id = str(uuid4())
        
        # Create review for specific entity
        sample_review_data["entity_id"] = entity_id
        client.post("/api/v1/reviews/", json=sample_review_data)
        
        # Create review for different entity
        other_review = sample_review_data.copy()
        other_review["entity_id"] = str(uuid4())
        client.post("/api/v1/reviews/", json=other_review)
        
        # Filter by entity
        response = client.get(f"/api/v1/reviews/?entity_id={entity_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only return reviews for the specific entity
        for review in data["items"]:
            assert review["entity_id"] == entity_id
    
    def test_list_reviews_search(self, sample_review_data):
        """Test review search functionality"""
        # Create review with specific content
        sample_review_data["title"] = "Unique search term"
        client.post("/api/v1/reviews/", json=sample_review_data)
        
        # Search for the term
        response = client.get("/api/v1/reviews/?search_query=Unique")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["items"]) >= 1
        assert "Unique" in data["items"][0]["title"]


class TestReviewVoting:
    """Test review voting functionality"""
    
    def test_vote_on_review_helpful(self, sample_review_data):
        """Test voting on review as helpful"""
        # Create review
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        # Vote as helpful
        vote_data = {"is_helpful": True}
        response = client.post(f"/api/v1/reviews/{review_id}/vote", json=vote_data)
        
        assert response.status_code == 201
        assert response.json()["message"] == "Vote recorded successfully"
    
    def test_vote_on_review_not_helpful(self, sample_review_data):
        """Test voting on review as not helpful"""
        # Create review
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        # Vote as not helpful
        vote_data = {"is_helpful": False}
        response = client.post(f"/api/v1/reviews/{review_id}/vote", json=vote_data)
        
        assert response.status_code == 201
    
    def test_vote_on_nonexistent_review(self):
        """Test voting on non-existent review"""
        fake_id = str(uuid4())
        vote_data = {"is_helpful": True}
        
        response = client.post(f"/api/v1/reviews/{fake_id}/vote", json=vote_data)
        assert response.status_code == 404


class TestReviewComments:
    """Test review comment functionality"""
    
    def test_add_comment_success(self, sample_review_data, sample_comment_data):
        """Test successful comment addition"""
        # Create review
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        # Add comment
        response = client.post(f"/api/v1/reviews/{review_id}/comments", json=sample_comment_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["content"] == sample_comment_data["content"]
        assert "author_name" in data
        assert data["upvotes"] == 0
        assert data["downvotes"] == 0
    
    def test_add_comment_short_content(self, sample_review_data):
        """Test adding comment with too short content"""
        # Create review
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        # Add comment with short content
        comment_data = {"content": "Hi"}  # Too short
        response = client.post(f"/api/v1/reviews/{review_id}/comments", json=comment_data)
        
        assert response.status_code == 422
    
    def test_vote_on_comment(self, sample_review_data, sample_comment_data):
        """Test voting on comments"""
        # Create review and comment
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        comment_response = client.post(f"/api/v1/reviews/{review_id}/comments", json=sample_comment_data)
        comment_id = comment_response.json()["id"]
        
        # Vote on comment
        vote_data = {"is_upvote": True}
        response = client.post(f"/api/v1/reviews/comments/{comment_id}/vote", json=vote_data)
        
        assert response.status_code == 201


class TestEntitySummary:
    """Test entity summary functionality"""
    
    def test_get_entity_summary(self, sample_review_data):
        """Test getting entity summary"""
        # Create review
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        entity_type = sample_review_data["entity_type"]
        entity_id = sample_review_data["entity_id"]
        
        # Get summary
        response = client.get(f"/api/v1/reviews/entities/{entity_type}/{entity_id}/summary")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["entity_type"] == entity_type
        assert data["entity_id"] == entity_id
        assert data["total_reviews"] >= 1
        assert data["average_rating"] > 0
    
    def test_get_entity_summary_invalid_type(self):
        """Test getting summary with invalid entity type"""
        fake_id = str(uuid4())
        response = client.get(f"/api/v1/reviews/entities/invalid/{fake_id}/summary")
        
        assert response.status_code == 400


class TestTrendingReviews:
    """Test trending reviews functionality"""
    
    def test_get_trending_reviews(self, sample_review_data):
        """Test getting trending reviews"""
        # Create a few reviews
        for i in range(3):
            review_data = sample_review_data.copy()
            review_data["title"] = f"Trending Review {i}"
            client.post("/api/v1/reviews/", json=review_data)
        
        response = client.get("/api/v1/reviews/trending")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) <= 10  # Default limit
    
    def test_get_trending_reviews_custom_params(self, sample_review_data):
        """Test trending reviews with custom parameters"""
        response = client.get("/api/v1/reviews/trending?days=14&limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) <= 5


class TestUserReviews:
    """Test user-specific review functionality"""
    
    def test_get_user_reviews(self, sample_review_data):
        """Test getting reviews by user"""
        # Get current user ID from override
        user_data = override_get_current_user()
        user_id = user_data["id"]
        
        # Create review (will use the override user)
        client.post("/api/v1/reviews/", json=sample_review_data)
        
        response = client.get(f"/api/v1/reviews/users/{user_id}/reviews")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # All reviews should be by this user
        for review in data:
            assert review["author_id"] == str(user_id)


class TestAdminEndpoints:
    """Test admin-only functionality"""
    
    def test_bulk_operations_non_admin(self, sample_review_data):
        """Test bulk operations without admin access"""
        # Create review
        create_response = client.post("/api/v1/reviews/", json=sample_review_data)
        review_id = create_response.json()["id"]
        
        # Try bulk operation
        bulk_data = {
            "review_ids": [review_id],
            "action": "archive",
            "reason": "Test archival"
        }
        
        response = client.post("/api/v1/reviews/bulk", json=bulk_data)
        assert response.status_code == 403
    
    def test_analytics_non_admin(self):
        """Test analytics without admin access"""
        response = client.get("/api/v1/reviews/analytics")
        assert response.status_code == 403
    
    def test_analytics_admin_access(self):
        """Test analytics with admin access"""
        # Temporarily override to admin user
        app.dependency_overrides[get_current_active_user] = override_get_admin_user
        
        try:
            response = client.get("/api/v1/reviews/analytics")
            assert response.status_code == 200
            
            data = response.json()
            assert "total_reviews" in data
            assert "average_rating" in data
        finally:
            # Restore original override
            app.dependency_overrides[get_current_active_user] = override_get_current_user


class TestValidationAndErrors:
    """Test validation and error handling"""
    
    def test_invalid_uuid_format(self):
        """Test invalid UUID format in URL"""
        response = client.get("/api/v1/reviews/invalid-uuid")
        assert response.status_code == 422
    
    def test_missing_required_fields(self):
        """Test missing required fields in review creation"""
        incomplete_data = {
            "title": "Test"
            # Missing content, entity_type, entity_id, overall_rating
        }
        
        response = client.post("/api/v1/reviews/", json=incomplete_data)
        assert response.status_code == 422
    
    def test_invalid_rating_range(self, sample_review_data):
        """Test invalid rating values"""
        sample_review_data["overall_rating"] = 0.5  # Below minimum
        
        response = client.post("/api/v1/reviews/", json=sample_review_data)
        assert response.status_code == 422
        
        sample_review_data["overall_rating"] = 5.5  # Above maximum
        
        response = client.post("/api/v1/reviews/", json=sample_review_data)
        assert response.status_code == 422
    
    def test_sql_injection_prevention(self, sample_review_data):
        """Test SQL injection prevention in search"""
        # Attempt SQL injection in search query
        malicious_query = "'; DROP TABLE reviews; --"
        
        response = client.get(f"/api/v1/reviews/?search_query={malicious_query}")
        
        # Should not crash and return normal response
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])