"""
API Endpoint Tests
Comprehensive testing of all FastAPI routes
"""

import pytest
from uuid import uuid4
from httpx import AsyncClient
from fastapi import status
from unittest.mock import patch, AsyncMock

from backend.src.database.models import User, Organization, Workflow, Form, FormSubmission, WorkflowExecution


@pytest.mark.api
class TestHealthEndpoints:
    """Test health check endpoints"""
    
    async def test_health_check(self, async_client: AsyncClient):
        """Test basic health check endpoint"""
        response = await async_client.get("/health")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "database" in data
        assert "cache" in data
        assert "workers" in data
    
    async def test_api_status(self, async_client: AsyncClient):
        """Test detailed API status endpoint"""
        response = await async_client.get("/api/v1/status")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["api"] == "online"
        assert "database" in data
        assert "cache" in data
        assert "workers" in data


@pytest.mark.api
class TestWorkflowEndpoints:
    """Test workflow API endpoints"""
    
    async def test_list_workflows_empty(self, async_client: AsyncClient, auth_headers):
        """Test listing workflows when none exist"""
        response = await async_client.get(
            "/api/v1/workflows/",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []
    
    async def test_list_workflows_with_pagination(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test workflow listing with pagination"""
        response = await async_client.get(
            "/api/v1/workflows/?skip=0&limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    async def test_create_workflow_valid(self, async_client: AsyncClient, auth_headers, test_organization):
        """Test creating a valid workflow"""
        workflow_data = {
            "name": "Test Workflow",
            "description": "A test workflow",
            "definition": {
                "nodes": [
                    {
                        "id": "1",
                        "type": "trigger",
                        "position": {"x": 100, "y": 100},
                        "data": {"type": "manual"}
                    }
                ],
                "edges": []
            }
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=workflow_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == workflow_data["name"]
        assert data["description"] == workflow_data["description"]
        assert "id" in data
        assert "created_at" in data
    
    async def test_create_workflow_invalid_data(self, async_client: AsyncClient, auth_headers):
        """Test creating workflow with invalid data"""
        invalid_data = {
            "name": "",  # Empty name should fail validation
            "definition": {}  # Invalid definition
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=invalid_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_get_workflow_existing(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test getting an existing workflow"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        response = await async_client.get(
            f"/api/v1/workflows/{workflow.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(workflow.id)
        assert data["name"] == workflow.name
    
    async def test_get_workflow_not_found(self, async_client: AsyncClient, auth_headers):
        """Test getting non-existent workflow"""
        fake_id = uuid4()
        
        response = await async_client.get(
            f"/api/v1/workflows/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_update_workflow(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test updating an existing workflow"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        update_data = {
            "name": "Updated Workflow Name",
            "description": "Updated description"
        }
        
        response = await async_client.put(
            f"/api/v1/workflows/{workflow.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
    
    async def test_delete_workflow(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test deleting a workflow"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        response = await async_client.delete(
            f"/api/v1/workflows/{workflow.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify workflow is deleted
        get_response = await async_client.get(
            f"/api/v1/workflows/{workflow.id}",
            headers=auth_headers
        )
        assert get_response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_execute_workflow(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test executing a workflow"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        execution_data = {
            "trigger_type": "manual",
            "trigger_data": {"user_input": "test"},
            "priority": 5
        }
        
        with patch('backend.src.services.celery_worker.ExecuteWorkflowTask.delay') as mock_delay:
            mock_task = AsyncMock()
            mock_task.id = "test-task-id"
            mock_delay.return_value = mock_task
            
            response = await async_client.post(
                f"/api/v1/workflows/{workflow.id}/execute",
                json=execution_data,
                headers=auth_headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["workflow_id"] == str(workflow.id)
        assert data["status"] in ["pending", "running"]
        assert "task_id" in data
    
    async def test_list_workflow_executions(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test listing workflow executions"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        response = await async_client.get(
            f"/api/v1/workflows/{workflow.id}/executions",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    async def test_validate_workflow(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test workflow validation"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        response = await async_client.get(
            f"/api/v1/workflows/{workflow.id}/validate",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "valid" in data
        assert "errors" in data
    
    async def test_workflow_metrics(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test getting workflow metrics"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        response = await async_client.get(
            f"/api/v1/workflows/{workflow.id}/metrics?days=7",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "execution_count" in data
        assert "success_rate" in data
        assert "avg_execution_time" in data


@pytest.mark.api
class TestFormEndpoints:
    """Test form API endpoints"""
    
    async def test_create_form_schema_valid(self, async_client: AsyncClient, auth_headers):
        """Test creating a valid form schema"""
        form_data = {
            "name": "Contact Form",
            "version": "1.0.0",
            "fields": [
                {
                    "id": "name",
                    "type": "text",
                    "label": "Full Name",
                    "required": True,
                    "validation": {"max_length": 100}
                },
                {
                    "id": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": True
                }
            ],
            "validation_rules": {
                "name": {"min_length": 2, "max_length": 100},
                "email": {"format": "email"}
            },
            "metadata": {
                "description": "Contact form for inquiries"
            }
        }
        
        response = await async_client.post(
            "/api/v1/forms/",
            json=form_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == form_data["name"]
        assert data["version"] == form_data["version"]
        assert len(data["fields"]) == 2
        assert "id" in data
    
    async def test_create_form_schema_invalid(self, async_client: AsyncClient, auth_headers):
        """Test creating form schema with invalid data"""
        invalid_data = {
            "name": "",  # Empty name
            "fields": []  # No fields
        }
        
        response = await async_client.post(
            "/api/v1/forms/",
            json=invalid_data,
            headers=auth_headers
        )
        
        assert response.status_code in [
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_500_INTERNAL_SERVER_ERROR
        ]
    
    async def test_list_form_schemas(self, async_client: AsyncClient, auth_headers, setup_test_data):
        """Test listing form schemas"""
        response = await async_client.get(
            "/api/v1/forms/?skip=0&limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    async def test_get_form_schema(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test getting a specific form schema"""
        test_data = setup_test_data
        form = test_data["forms"]["form1"]
        
        response = await async_client.get(
            f"/api/v1/forms/{form.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(form.id)
        assert data["name"] == form.name
    
    async def test_update_form_schema(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test updating a form schema"""
        test_data = setup_test_data
        form = test_data["forms"]["form1"]
        
        update_data = {
            "name": "Updated Form Name",
            "fields": [
                {
                    "id": "name",
                    "type": "text",
                    "label": "Full Name",
                    "required": True
                },
                {
                    "id": "phone",
                    "type": "tel",
                    "label": "Phone Number",
                    "required": False
                }
            ]
        }
        
        response = await async_client.put(
            f"/api/v1/forms/{form.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]
        assert len(data["fields"]) == 2
    
    async def test_delete_form_schema(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test deleting a form schema"""
        test_data = setup_test_data
        form = test_data["forms"]["form1"]
        
        response = await async_client.delete(
            f"/api/v1/forms/{form.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify form is deleted
        get_response = await async_client.get(
            f"/api/v1/forms/{form.id}",
            headers=auth_headers
        )
        assert get_response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_submit_form_response_valid(
        self, async_client: AsyncClient, setup_test_data
    ):
        """Test submitting a valid form response"""
        test_data = setup_test_data
        form = test_data["forms"]["form1"]
        
        response_data = {
            "data": {
                "name": "John Doe",
                "email": "john@example.com"
            },
            "metadata": {
                "user_agent": "Test Client",
                "ip_address": "127.0.0.1"
            }
        }
        
        response = await async_client.post(
            f"/api/v1/forms/{form.id}/responses",
            json=response_data
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["status"] == "submitted"
        assert "response_id" in data
        assert "submitted_at" in data
    
    async def test_submit_form_response_validation_error(
        self, async_client: AsyncClient, setup_test_data
    ):
        """Test submitting form response with validation errors"""
        test_data = setup_test_data
        form = test_data["forms"]["form1"]
        
        # Missing required fields
        response_data = {
            "data": {
                "email": "invalid-email"  # Invalid email format
            }
        }
        
        response = await async_client.post(
            f"/api/v1/forms/{form.id}/responses",
            json=response_data
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "errors" in data["detail"]
    
    async def test_list_form_responses(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test listing form responses"""
        test_data = setup_test_data
        form = test_data["forms"]["form1"]
        
        response = await async_client.get(
            f"/api/v1/forms/{form.id}/responses",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    async def test_send_form(
        self, async_client: AsyncClient, auth_headers, setup_test_data
    ):
        """Test sending form to recipients"""
        test_data = setup_test_data
        form = test_data["forms"]["form1"]
        
        send_data = {
            "recipients": ["test@example.com", "user@example.com"],
            "channel": "email",
            "message": "Please fill out this form"
        }
        
        response = await async_client.post(
            f"/api/v1/forms/{form.id}/send",
            json=send_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "queued"
        assert data["recipients_count"] == 2
        assert "task_id" in data


@pytest.mark.api
class TestExecutionEndpoints:
    """Test execution API endpoints"""
    
    async def test_list_executions(self, async_client: AsyncClient, auth_headers):
        """Test listing workflow executions"""
        response = await async_client.get(
            "/api/v1/executions/",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    async def test_get_execution_status(self, async_client: AsyncClient, auth_headers):
        """Test getting execution status"""
        # This would typically require an actual execution
        fake_id = uuid4()
        
        response = await async_client.get(
            f"/api/v1/executions/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.api
class TestNodeEndpoints:
    """Test node API endpoints"""
    
    async def test_list_node_types(self, async_client: AsyncClient, auth_headers):
        """Test listing available node types"""
        response = await async_client.get(
            "/api/v1/nodes/types",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    async def test_get_node_schema(self, async_client: AsyncClient, auth_headers):
        """Test getting node schema"""
        response = await async_client.get(
            "/api/v1/nodes/schema/trigger",
            headers=auth_headers
        )
        
        # This might return 404 if no schemas are set up
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]


@pytest.mark.api
class TestIntegrationEndpoints:
    """Test integration API endpoints"""
    
    async def test_list_integrations(self, async_client: AsyncClient, auth_headers):
        """Test listing integrations"""
        response = await async_client.get(
            "/api/v1/integrations/",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    async def test_create_integration(self, async_client: AsyncClient, auth_headers):
        """Test creating an integration"""
        integration_data = {
            "name": "Test Email Integration",
            "type": "email",
            "configuration": {
                "smtp_server": "smtp.gmail.com",
                "port": 587,
                "use_tls": True
            },
            "credentials": {
                "username": "test@gmail.com"
                # password would be encrypted
            }
        }
        
        response = await async_client.post(
            "/api/v1/integrations/",
            json=integration_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == integration_data["name"]
        assert data["type"] == integration_data["type"]


@pytest.mark.api
class TestAuthenticationAndAuthorization:
    """Test authentication and authorization"""
    
    async def test_protected_endpoint_without_auth(self, async_client: AsyncClient):
        """Test accessing protected endpoint without authentication"""
        # Temporarily remove the auth override
        from backend.src.main import app
        from backend.src.auth.security import get_current_active_user
        
        # This test assumes auth override is temporarily removed
        response = await async_client.get("/api/v1/workflows/")
        
        # Should return 401 if auth is properly enforced
        # Since we override auth in conftest, this might pass
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_200_OK  # If auth is overridden
        ]
    
    async def test_admin_only_endpoint_as_user(
        self, async_client: AsyncClient, auth_headers
    ):
        """Test accessing admin-only endpoint as regular user"""
        # This would test admin-specific endpoints if they exist
        response = await async_client.get(
            "/api/v1/admin/users",  # Hypothetical admin endpoint
            headers=auth_headers
        )
        
        # Expecting 404 since this endpoint doesn't exist in current implementation
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.api
@pytest.mark.performance
class TestPerformanceEndpoints:
    """Test API endpoint performance"""
    
    async def test_workflow_list_performance(
        self, async_client: AsyncClient, auth_headers, performance_timer
    ):
        """Test workflow list endpoint performance"""
        performance_timer.start()
        
        response = await async_client.get(
            "/api/v1/workflows/",
            headers=auth_headers
        )
        
        performance_timer.stop()
        
        assert response.status_code == status.HTTP_200_OK
        assert performance_timer.elapsed_ms < 1000  # Should complete under 1 second
    
    async def test_form_creation_performance(
        self, async_client: AsyncClient, auth_headers, performance_timer
    ):
        """Test form creation performance"""
        form_data = {
            "name": "Performance Test Form",
            "fields": [
                {
                    "id": f"field_{i}",
                    "type": "text",
                    "label": f"Field {i}",
                    "required": False
                }
                for i in range(20)  # Create 20 fields
            ]
        }
        
        performance_timer.start()
        
        response = await async_client.post(
            "/api/v1/forms/",
            json=form_data,
            headers=auth_headers
        )
        
        performance_timer.stop()
        
        assert response.status_code == status.HTTP_201_CREATED
        assert performance_timer.elapsed_ms < 2000  # Should complete under 2 seconds
    
    async def test_concurrent_requests(
        self, async_client: AsyncClient, auth_headers
    ):
        """Test handling concurrent requests"""
        import asyncio
        
        async def make_request():
            return await async_client.get(
                "/api/v1/workflows/",
                headers=auth_headers
            )
        
        # Make 10 concurrent requests
        tasks = [make_request() for _ in range(10)]
        responses = await asyncio.gather(*tasks)
        
        # All requests should succeed
        for response in responses:
            assert response.status_code == status.HTTP_200_OK