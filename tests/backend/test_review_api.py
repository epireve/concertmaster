"""
Test suite for Review API endpoints
Tests all CRUD operations, filtering, assignment workflow, and approval process
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json

from backend.src.main import app
from backend.src.models.reviews import Review, ReviewStatus, ReviewType, ReviewPriority
from backend.src.database.connection import get_db_session
from tests.conftest import override_get_db


class TestReviewAPI:
    """Test class for Review API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self, test_db_session: Session):
        """Setup test database and client"""
        app.dependency_overrides[get_db_session] = lambda: test_db_session
        self.client = TestClient(app)
        self.db = test_db_session
        
        # Mock authentication
        self.auth_headers = {"Authorization": "Bearer test-token"}
        
        # Test data
        self.test_review_data = {
            "title": "Test Form Review",
            "description": "This is a test review for form validation",
            "review_type": "form_review",
            "priority": "medium",
            "form_id": "test-form-123",
            "due_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
        }
    
    def test_create_review_success(self):
        """Test successful review creation"""
        response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["title"] == self.test_review_data["title"]
        assert data["description"] == self.test_review_data["description"]
        assert data["review_type"] == self.test_review_data["review_type"]
        assert data["priority"] == self.test_review_data["priority"]
        assert data["status"] == "pending"
        assert data["form_id"] == self.test_review_data["form_id"]
        assert "id" in data
        assert "created_at" in data
    
    def test_create_review_validation_error(self):
        """Test review creation with validation errors"""
        invalid_data = {
            "title": "",  # Empty title should fail
            "review_type": "invalid_type",  # Invalid enum
            "priority": "invalid_priority"  # Invalid enum
        }
        
        response = self.client.post(
            "/api/v1/reviews/",
            json=invalid_data,
            headers=self.auth_headers
        )
        
        assert response.status_code == 400
        assert "detail" in response.json()
    
    def test_get_review_success(self):
        """Test successful review retrieval"""
        # Create a review first
        create_response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        review_id = create_response.json()["id"]
        
        # Get the review
        response = self.client.get(
            f"/api/v1/reviews/{review_id}",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == review_id
        assert data["title"] == self.test_review_data["title"]
    
    def test_get_review_not_found(self):
        """Test getting non-existent review"""
        response = self.client.get(
            "/api/v1/reviews/non-existent-id",
            headers=self.auth_headers
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_list_reviews_success(self):
        """Test listing reviews with pagination"""
        # Create multiple reviews
        reviews = []
        for i in range(3):
            data = {**self.test_review_data, "title": f"Test Review {i+1}"}
            response = self.client.post(
                "/api/v1/reviews/",
                json=data,
                headers=self.auth_headers
            )
            reviews.append(response.json())
        
        # List reviews
        response = self.client.get(
            "/api/v1/reviews/?limit=2",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "reviews" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert len(data["reviews"]) == 2
        assert data["total"] == 3
        assert data["limit"] == 2
        assert data["skip"] == 0
    
    def test_list_reviews_with_filters(self):
        """Test listing reviews with status and type filters"""
        # Create reviews with different statuses and types
        workflow_review = {
            **self.test_review_data,
            "title": "Workflow Review",
            "review_type": "workflow_review",
            "priority": "high"
        }
        
        self.client.post("/api/v1/reviews/", json=self.test_review_data, headers=self.auth_headers)
        self.client.post("/api/v1/reviews/", json=workflow_review, headers=self.auth_headers)
        
        # Filter by type
        response = self.client.get(
            "/api/v1/reviews/?type_filter=workflow_review",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["reviews"]) == 1
        assert data["reviews"][0]["review_type"] == "workflow_review"
        
        # Filter by priority
        response = self.client.get(
            "/api/v1/reviews/?priority_filter=high",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["reviews"]) == 1
        assert data["reviews"][0]["priority"] == "high"
    
    def test_update_review_success(self):
        """Test successful review update"""
        # Create a review first
        create_response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        review_id = create_response.json()["id"]
        
        # Update the review
        update_data = {
            "title": "Updated Review Title",
            "priority": "high",
            "rating": 4.5,
            "comments": "Updated comments"
        }
        
        response = self.client.put(
            f"/api/v1/reviews/{review_id}",
            json=update_data,
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"] == update_data["title"]
        assert data["priority"] == update_data["priority"]
        assert data["rating"] == update_data["rating"]
        assert data["comments"] == update_data["comments"]
        assert "updated_at" in data
    
    def test_assign_review_success(self):
        """Test successful review assignment"""
        # Create a review first
        create_response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        review_id = create_response.json()["id"]
        
        # Assign the review
        assignment_data = {
            "assigned_to": "reviewer@example.com",
            "assignment_notes": "Please review by end of week"
        }
        
        response = self.client.post(
            f"/api/v1/reviews/{review_id}/assign",
            json=assignment_data,
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["assigned_to"] == assignment_data["assigned_to"]
        assert data["assignment_notes"] == assignment_data["assignment_notes"]
        assert "assigned_at" in data
        assert "assigned_by" in data
        
        # Verify review status changed to in_progress
        review_response = self.client.get(
            f"/api/v1/reviews/{review_id}",
            headers=self.auth_headers
        )
        review_data = review_response.json()
        assert review_data["status"] == "in_progress"
        assert review_data["assigned_to"] == assignment_data["assigned_to"]
    
    def test_approve_review_success(self):
        """Test successful review approval"""
        # Create and assign a review
        create_response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        review_id = create_response.json()["id"]
        
        # Assign it first
        self.client.post(
            f"/api/v1/reviews/{review_id}/assign",
            json={"assigned_to": "reviewer@example.com"},
            headers=self.auth_headers
        )
        
        # Approve the review
        response = self.client.post(
            f"/api/v1/reviews/{review_id}/approve",
            json={"comments": "Looks good, approved!"},
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "approved"
        assert data["comments"] == "Looks good, approved!"
        assert "completed_at" in data
    
    def test_reject_review_success(self):
        """Test successful review rejection"""
        # Create and assign a review
        create_response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        review_id = create_response.json()["id"]
        
        # Assign it first
        self.client.post(
            f"/api/v1/reviews/{review_id}/assign",
            json={"assigned_to": "reviewer@example.com"},
            headers=self.auth_headers
        )
        
        # Reject the review
        response = self.client.post(
            f"/api/v1/reviews/{review_id}/reject",
            json={"comments": "Needs more work before approval"},
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "rejected"
        assert data["comments"] == "Needs more work before approval"
        assert "completed_at" in data
    
    def test_get_review_history(self):
        """Test getting review history"""
        # Create a review
        create_response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        review_id = create_response.json()["id"]
        
        # Assign and approve to create history
        self.client.post(
            f"/api/v1/reviews/{review_id}/assign",
            json={"assigned_to": "reviewer@example.com"},
            headers=self.auth_headers
        )
        self.client.post(
            f"/api/v1/reviews/{review_id}/approve",
            json={"comments": "Approved"},
            headers=self.auth_headers
        )
        
        # Get history
        response = self.client.get(
            f"/api/v1/reviews/{review_id}/history",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        history = response.json()
        
        assert isinstance(history, list)
        assert len(history) >= 3  # created, assigned, approved
        
        # Check history entries have required fields
        for entry in history:
            assert "id" in entry
            assert "action" in entry
            assert "performed_by" in entry
            assert "performed_at" in entry
    
    def test_add_review_criteria(self):
        """Test adding criteria to a review"""
        # Create a review first
        create_response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        review_id = create_response.json()["id"]
        
        # Add criteria
        criteria_data = {
            "name": "Code Quality",
            "description": "Assess overall code quality and standards",
            "weight": 2.0,
            "max_score": 10.0,
            "is_required": True
        }
        
        response = self.client.post(
            f"/api/v1/reviews/{review_id}/criteria",
            json=criteria_data,
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == criteria_data["name"]
        assert data["description"] == criteria_data["description"]
        assert data["weight"] == criteria_data["weight"]
        assert data["max_score"] == criteria_data["max_score"]
        assert data["is_required"] == criteria_data["is_required"]
        assert data["review_id"] == review_id
    
    def test_get_review_stats(self):
        """Test getting review statistics"""
        # Create multiple reviews with different statuses
        reviews_data = [
            {**self.test_review_data, "title": "Review 1", "priority": "low"},
            {**self.test_review_data, "title": "Review 2", "priority": "high", "review_type": "workflow_review"},
            {**self.test_review_data, "title": "Review 3", "priority": "critical"}
        ]
        
        review_ids = []
        for data in reviews_data:
            response = self.client.post("/api/v1/reviews/", json=data, headers=self.auth_headers)
            review_ids.append(response.json()["id"])
        
        # Assign and approve one review
        self.client.post(f"/api/v1/reviews/{review_ids[0]}/assign", 
                        json={"assigned_to": "reviewer@example.com"}, headers=self.auth_headers)
        self.client.post(f"/api/v1/reviews/{review_ids[0]}/approve", 
                        json={"comments": "Approved"}, headers=self.auth_headers)
        
        # Get statistics
        response = self.client.get("/api/v1/reviews/stats/summary", headers=self.auth_headers)
        
        assert response.status_code == 200
        stats = response.json()
        
        # Check required fields
        required_fields = [
            "total_reviews", "pending_reviews", "in_progress_reviews", 
            "completed_reviews", "approved_reviews", "rejected_reviews",
            "form_reviews", "workflow_reviews", "low_priority", "high_priority", "critical_priority"
        ]
        
        for field in required_fields:
            assert field in stats
        
        assert stats["total_reviews"] == 3
        assert stats["approved_reviews"] == 1
        assert stats["form_reviews"] == 2
        assert stats["workflow_reviews"] == 1
        assert stats["low_priority"] == 1
        assert stats["high_priority"] == 1
        assert stats["critical_priority"] == 1
    
    def test_delete_review_success(self):
        """Test successful review deletion"""
        # Create a review first
        create_response = self.client.post(
            "/api/v1/reviews/",
            json=self.test_review_data,
            headers=self.auth_headers
        )
        review_id = create_response.json()["id"]
        
        # Delete the review
        response = self.client.delete(
            f"/api/v1/reviews/{review_id}",
            headers=self.auth_headers
        )
        
        assert response.status_code == 204
        
        # Verify review is deleted
        get_response = self.client.get(
            f"/api/v1/reviews/{review_id}",
            headers=self.auth_headers
        )
        assert get_response.status_code == 404
    
    def test_get_form_reviews(self):
        """Test getting reviews for a specific form"""
        form_id = "test-form-456"
        
        # Create reviews for different forms
        form_review_data = {**self.test_review_data, "form_id": form_id, "title": "Form Review"}
        other_review_data = {**self.test_review_data, "form_id": "other-form", "title": "Other Review"}
        
        self.client.post("/api/v1/reviews/", json=form_review_data, headers=self.auth_headers)
        self.client.post("/api/v1/reviews/", json=other_review_data, headers=self.auth_headers)
        
        # Get reviews for specific form
        response = self.client.get(
            f"/api/v1/reviews/form/{form_id}/reviews",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        reviews = response.json()
        
        assert isinstance(reviews, list)
        assert len(reviews) == 1
        assert reviews[0]["form_id"] == form_id
        assert reviews[0]["title"] == "Form Review"
    
    def test_get_workflow_reviews(self):
        """Test getting reviews for a specific workflow"""
        workflow_id = "test-workflow-789"
        
        # Create reviews for different workflows
        workflow_review_data = {
            **self.test_review_data, 
            "workflow_id": workflow_id, 
            "title": "Workflow Review",
            "review_type": "workflow_review"
        }
        other_review_data = {
            **self.test_review_data, 
            "workflow_id": "other-workflow", 
            "title": "Other Workflow Review",
            "review_type": "workflow_review"
        }
        
        self.client.post("/api/v1/reviews/", json=workflow_review_data, headers=self.auth_headers)
        self.client.post("/api/v1/reviews/", json=other_review_data, headers=self.auth_headers)
        
        # Get reviews for specific workflow
        response = self.client.get(
            f"/api/v1/reviews/workflow/{workflow_id}/reviews",
            headers=self.auth_headers
        )
        
        assert response.status_code == 200
        reviews = response.json()
        
        assert isinstance(reviews, list)
        assert len(reviews) == 1
        assert reviews[0]["workflow_id"] == workflow_id
        assert reviews[0]["title"] == "Workflow Review"
    
    def teardown_method(self):
        """Clean up after each test"""
        # Remove dependency override
        if get_db_session in app.dependency_overrides:
            del app.dependency_overrides[get_db_session]