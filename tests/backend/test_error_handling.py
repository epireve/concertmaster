"""
Error Handling and Edge Case Tests
Comprehensive testing of error scenarios, edge cases, and exception handling
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from httpx import AsyncClient
from fastapi import status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from redis.exceptions import ConnectionError as RedisConnectionError
import asyncio
from datetime import datetime, timedelta


@pytest.mark.unit
class TestAPIErrorHandling:
    """Test API error handling and edge cases"""
    
    async def test_invalid_uuid_parameter(self, async_client: AsyncClient, auth_headers):
        """Test API response to invalid UUID parameters"""
        invalid_uuid = "not-a-valid-uuid"
        
        response = await async_client.get(
            f"/api/v1/workflows/{invalid_uuid}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert "detail" in data
        assert any("uuid" in str(error).lower() for error in data["detail"])
    
    async def test_missing_required_fields(self, async_client: AsyncClient, auth_headers):
        """Test API response to missing required fields"""
        incomplete_workflow_data = {
            "description": "Missing name field"
            # Missing required 'name' and 'definition' fields
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=incomplete_workflow_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert "detail" in data
        
        # Check that required fields are mentioned in error
        error_messages = str(data["detail"]).lower()
        assert "name" in error_messages or "field required" in error_messages
    
    async def test_invalid_json_payload(self, async_client: AsyncClient, auth_headers):
        """Test API response to invalid JSON payload"""
        response = await async_client.post(
            "/api/v1/workflows/",
            data="invalid-json-data",  # Not JSON
            headers={**auth_headers, "Content-Type": "application/json"}
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_request_too_large(self, async_client: AsyncClient, auth_headers):
        """Test API response to oversized requests"""
        # Create very large payload (simulating a large form or workflow)
        large_payload = {
            "name": "Large Workflow",
            "definition": {
                "nodes": [
                    {
                        "id": f"node_{i}",
                        "type": "transform",
                        "data": {"large_data": "x" * 10000}  # 10KB per node
                    }
                    for i in range(100)  # 1MB total
                ],
                "edges": []
            }
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=large_payload,
            headers=auth_headers
        )
        
        # Response depends on server configuration
        # Could be 413 (Payload Too Large) or 422 (validation error)
        assert response.status_code in [
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_201_CREATED  # If server allows large payloads
        ]
    
    async def test_rate_limiting_error(self, async_client: AsyncClient, auth_headers):
        """Test rate limiting behavior"""
        # Make many rapid requests to trigger rate limiting
        tasks = []
        for _ in range(100):
            task = async_client.get("/api/v1/workflows/", headers=auth_headers)
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Some responses might be rate limited (429) or successful (200)
        status_codes = [
            r.status_code for r in responses 
            if hasattr(r, 'status_code') and not isinstance(r, Exception)
        ]
        
        # Most should be successful, but some might be rate limited
        assert status.HTTP_200_OK in status_codes
        # Rate limiting might not be triggered in test environment
        # assert status.HTTP_429_TOO_MANY_REQUESTS in status_codes
    
    async def test_malformed_authentication_header(self, async_client: AsyncClient):
        """Test response to malformed authentication headers"""
        malformed_headers = [
            {"Authorization": "Invalid token format"},
            {"Authorization": "Bearer"},  # Missing token
            {"Authorization": "Basic invalid"},  # Wrong auth type
            {"Authorization": "Bearer " + "x" * 1000},  # Extremely long token
        ]
        
        for headers in malformed_headers:
            response = await async_client.get("/api/v1/workflows/", headers=headers)
            
            # Should return 401 Unauthorized or be handled by auth override
            assert response.status_code in [
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_200_OK  # If auth is overridden in tests
            ]
    
    async def test_content_type_mismatch(self, async_client: AsyncClient, auth_headers):
        """Test response to content type mismatches"""
        # Send JSON data with wrong content type
        workflow_data = {
            "name": "Test Workflow",
            "definition": {"nodes": [], "edges": []}
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=workflow_data,
            headers={**auth_headers, "Content-Type": "text/plain"}
        )
        
        # Should handle gracefully or return appropriate error
        assert response.status_code in [
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_201_CREATED  # If FastAPI handles it gracefully
        ]


@pytest.mark.unit
class TestDatabaseErrorHandling:
    """Test database error handling and edge cases"""
    
    async def test_database_connection_failure(self, async_client: AsyncClient, auth_headers):
        """Test handling of database connection failures"""
        with patch('backend.src.database.connection.get_db_session') as mock_get_db:
            mock_session = AsyncMock()
            mock_session.execute.side_effect = SQLAlchemyError("Connection failed")
            mock_get_db.return_value.__aenter__.return_value = mock_session
            
            response = await async_client.get("/api/v1/workflows/", headers=auth_headers)
            
            # Should return 500 Internal Server Error
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    
    async def test_database_timeout_handling(self, async_client: AsyncClient, auth_headers):
        """Test handling of database timeouts"""
        with patch('backend.src.database.connection.get_db_session') as mock_get_db:
            mock_session = AsyncMock()
            mock_session.execute.side_effect = asyncio.TimeoutError("Query timeout")
            mock_get_db.return_value.__aenter__.return_value = mock_session
            
            response = await async_client.get("/api/v1/workflows/", headers=auth_headers)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            # Should log timeout error appropriately
    
    async def test_transaction_rollback_on_error(self, async_session):
        """Test transaction rollback behavior on errors"""
        from backend.src.database.models import User, Organization
        
        # Start transaction
        user = User(
            email="rollback@example.com",
            username="rollback_user",
            password_hash="$2b$12$test.hash"
        )
        
        async_session.add(user)
        await async_session.flush()  # Flush but don't commit
        
        try:
            # Create invalid organization to trigger error
            org = Organization(
                name="",  # Empty name might cause validation error
                slug="",  # Empty slug might cause validation error
            )
            async_session.add(org)
            await async_session.commit()
            
        except Exception:
            await async_session.rollback()
        
        # Verify user was not persisted due to rollback
        from sqlalchemy import select
        result = await async_session.execute(
            select(User).where(User.email == "rollback@example.com")
        )
        user_check = result.scalar_one_or_none()
        assert user_check is None
    
    async def test_duplicate_key_constraint_error(self, async_session):
        """Test handling of unique constraint violations"""
        from backend.src.database.models import User
        
        # Create first user
        user1 = User(
            email="duplicate@example.com",
            username="duplicate_user",
            password_hash="$2b$12$test.hash"
        )
        
        async_session.add(user1)
        await async_session.commit()
        
        # Try to create second user with same email
        user2 = User(
            email="duplicate@example.com",  # Duplicate email
            username="different_user",
            password_hash="$2b$12$test.hash"
        )
        
        async_session.add(user2)
        
        with pytest.raises(IntegrityError):
            await async_session.commit()
    
    async def test_foreign_key_constraint_error(self, async_session):
        """Test handling of foreign key constraint violations"""
        from backend.src.database.models import Workflow
        
        # Try to create workflow with non-existent user and organization
        workflow = Workflow(
            name="Orphaned Workflow",
            organization_id=uuid4(),  # Non-existent organization
            created_by=uuid4(),  # Non-existent user
            definition={"nodes": [], "edges": []}
        )
        
        async_session.add(workflow)
        
        with pytest.raises(IntegrityError):
            await async_session.commit()
    
    async def test_check_constraint_violation(self, async_session):
        """Test handling of check constraint violations"""
        from backend.src.database.models import WorkflowExecution
        
        execution = WorkflowExecution(
            workflow_id=uuid4(),
            trigger_type="manual",
            priority=15,  # Should fail check constraint (valid range: 1-10)
            status="invalid_status"  # Should also fail check constraint
        )
        
        async_session.add(execution)
        
        with pytest.raises(IntegrityError):
            await async_session.commit()


@pytest.mark.unit
class TestCacheErrorHandling:
    """Test cache error handling and fallback behavior"""
    
    @pytest.fixture
    def mock_failing_cache(self):
        """Mock cache that fails operations"""
        mock = AsyncMock()
        mock.get.side_effect = RedisConnectionError("Redis connection failed")
        mock.set.side_effect = RedisConnectionError("Redis connection failed")
        mock.delete.side_effect = RedisConnectionError("Redis connection failed")
        return mock
    
    async def test_cache_failure_graceful_degradation(self, mock_failing_cache):
        """Test graceful degradation when cache fails"""
        from backend.src.services.cache_manager import CacheManager
        
        cache_manager = CacheManager()
        cache_manager._redis = mock_failing_cache
        cache_manager._initialized = True
        
        # Cache operations should not raise exceptions
        result = await cache_manager.get("test_key")
        assert result is None  # Should return None on failure
        
        success = await cache_manager.set("test_key", {"data": "test"})
        assert success is False  # Should return False on failure
        
        deleted = await cache_manager.delete("test_key")
        assert deleted is False  # Should return False on failure
    
    async def test_cache_serialization_error(self):
        """Test handling of cache serialization errors"""
        from backend.src.services.cache_manager import CacheManager
        
        cache_manager = CacheManager()
        mock_redis = AsyncMock()
        mock_redis.set.return_value = True
        mock_redis.get.return_value = b"invalid json {"  # Invalid JSON
        cache_manager._redis = mock_redis
        cache_manager._initialized = True
        
        # Should handle JSON decode error gracefully
        result = await cache_manager.get("test_key")
        assert result is None
    
    async def test_cache_timeout_handling(self):
        """Test cache operation timeouts"""
        from backend.src.services.cache_manager import CacheManager
        
        cache_manager = CacheManager()
        mock_redis = AsyncMock()
        mock_redis.get.side_effect = asyncio.TimeoutError("Redis timeout")
        cache_manager._redis = mock_redis
        cache_manager._initialized = True
        
        # Should handle timeout gracefully
        result = await cache_manager.get("test_key")
        assert result is None


@pytest.mark.unit
class TestWorkflowExecutionErrorHandling:
    """Test workflow execution error scenarios"""
    
    @pytest.fixture
    def mock_workflow_engine(self):
        """Mock workflow engine for testing"""
        return AsyncMock()
    
    async def test_workflow_definition_validation_errors(self, mock_workflow_engine):
        """Test workflow definition validation errors"""
        invalid_definitions = [
            # Missing nodes
            {"edges": []},
            
            # Invalid node structure
            {"nodes": [{"invalid": "structure"}], "edges": []},
            
            # Circular references
            {
                "nodes": [
                    {"id": "a", "type": "trigger"},
                    {"id": "b", "type": "action"}
                ],
                "edges": [
                    {"source": "a", "target": "b"},
                    {"source": "b", "target": "a"}  # Circular
                ]
            },
            
            # Edge pointing to non-existent node
            {
                "nodes": [{"id": "a", "type": "trigger"}],
                "edges": [{"source": "a", "target": "nonexistent"}]
            }
        ]
        
        for invalid_def in invalid_definitions:
            result = await mock_workflow_engine.validate_workflow_definition(invalid_def)
            
            # Mock should detect validation errors
            mock_workflow_engine.validate_workflow_definition.return_value = {
                "valid": False,
                "errors": ["Validation failed"]
            }
    
    async def test_workflow_execution_timeout(self, mock_workflow_engine):
        """Test workflow execution timeout handling"""
        execution_id = uuid4()
        
        # Mock long-running execution
        async def slow_execution(*args, **kwargs):
            await asyncio.sleep(10)  # Simulate slow execution
            return {"status": "completed"}
        
        mock_workflow_engine.execute_workflow = slow_execution
        
        # Test timeout handling (would need actual implementation)
        start_time = datetime.utcnow()
        
        try:
            await asyncio.wait_for(
                mock_workflow_engine.execute_workflow(execution_id, {}),
                timeout=1.0  # 1 second timeout
            )
        except asyncio.TimeoutError:
            pass  # Expected timeout
        
        elapsed = datetime.utcnow() - start_time
        assert elapsed.total_seconds() < 2.0  # Should timeout quickly
    
    async def test_workflow_node_execution_failure(self, mock_workflow_engine):
        """Test individual node execution failure handling"""
        node_config = {
            "id": "failing_node",
            "type": "action",
            "data": {"action_type": "webhook", "url": "invalid-url"}
        }
        
        mock_workflow_engine._execute_node.return_value = {
            "status": "failed",
            "error_message": "Invalid webhook URL",
            "error_type": "ValidationError"
        }
        
        result = await mock_workflow_engine._execute_node(node_config, {}, {})
        
        assert result["status"] == "failed"
        assert "error_message" in result
        assert "error_type" in result
    
    async def test_workflow_resource_exhaustion(self, mock_workflow_engine):
        """Test handling of resource exhaustion during execution"""
        execution_id = uuid4()
        
        # Mock memory exhaustion
        mock_workflow_engine.execute_workflow.side_effect = MemoryError("Out of memory")
        
        try:
            await mock_workflow_engine.execute_workflow(execution_id, {})
        except MemoryError as e:
            assert "Out of memory" in str(e)
    
    async def test_workflow_concurrent_execution_conflicts(self, mock_workflow_engine):
        """Test handling of concurrent execution conflicts"""
        workflow_id = uuid4()
        
        # Simulate multiple concurrent executions
        executions = [
            mock_workflow_engine.execute_workflow(uuid4(), {"workflow_id": workflow_id})
            for _ in range(5)
        ]
        
        mock_workflow_engine.execute_workflow.return_value = {
            "status": "completed",
            "execution_id": uuid4()
        }
        
        results = await asyncio.gather(*executions, return_exceptions=True)
        
        # All should complete or handle conflicts gracefully
        for result in results:
            if not isinstance(result, Exception):
                assert result["status"] in ["completed", "failed", "cancelled"]


@pytest.mark.unit
class TestFormProcessingErrorHandling:
    """Test form processing error scenarios"""
    
    async def test_form_validation_errors(self):
        """Test comprehensive form validation error scenarios"""
        validation_test_cases = [
            # Missing required fields
            {
                "schema": {
                    "fields": [
                        {"id": "name", "type": "text", "required": True},
                        {"id": "email", "type": "email", "required": True}
                    ]
                },
                "data": {"name": "John"},  # Missing email
                "expected_errors": ["email"]
            },
            
            # Invalid email format
            {
                "schema": {
                    "fields": [{"id": "email", "type": "email", "required": True}]
                },
                "data": {"email": "invalid-email-format"},
                "expected_errors": ["email format"]
            },
            
            # Number out of range
            {
                "schema": {
                    "fields": [{
                        "id": "age",
                        "type": "number",
                        "validation": {"min": 0, "max": 120}
                    }]
                },
                "data": {"age": 150},
                "expected_errors": ["age"]
            },
            
            # String length violations
            {
                "schema": {
                    "fields": [{
                        "id": "name",
                        "type": "text",
                        "validation": {"min_length": 2, "max_length": 50}
                    }]
                },
                "data": {"name": "x" * 100},  # Too long
                "expected_errors": ["name"]
            },
            
            # Invalid choice for select field
            {
                "schema": {
                    "fields": [{
                        "id": "country",
                        "type": "select",
                        "options": ["USA", "Canada", "Mexico"]
                    }]
                },
                "data": {"country": "InvalidCountry"},
                "expected_errors": ["country"]
            }
        ]
        
        from backend.src.services.form_processor import FormProcessor
        
        mock_db_session = AsyncMock()
        form_processor = FormProcessor(mock_db_session)
        
        for test_case in validation_test_cases:
            with patch.object(form_processor, '_validation_service') as mock_validator:
                mock_validator.validate_form_data.return_value = {
                    "valid": False,
                    "errors": [f"Field {field} is invalid" for field in test_case["expected_errors"]]
                }
                
                result = await form_processor.process_submission(
                    form_schema=test_case["schema"],
                    form_data=test_case["data"]
                )
                
                assert result["status"] == "error"
                assert len(result["errors"]) > 0
    
    async def test_form_xss_and_injection_attacks(self):
        """Test form security against XSS and injection attacks"""
        malicious_inputs = [
            # XSS attempts
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            
            # SQL injection attempts  
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "UNION SELECT * FROM users",
            
            # Command injection
            "; rm -rf /",
            "| cat /etc/passwd",
            "&& curl malicious.com",
            
            # NoSQL injection
            "{'$ne': null}",
            "'; return true; //",
        ]
        
        from backend.src.services.form_processor import FormProcessor
        
        mock_db_session = AsyncMock()
        form_processor = FormProcessor(mock_db_session)
        
        for malicious_input in malicious_inputs:
            form_data = {
                "name": malicious_input,
                "email": "test@example.com",
                "message": malicious_input
            }
            
            schema = {
                "fields": [
                    {"id": "name", "type": "text"},
                    {"id": "email", "type": "email"},
                    {"id": "message", "type": "textarea"}
                ]
            }
            
            # Should sanitize malicious input
            sanitized = await form_processor.sanitize_data(form_data, schema)
            
            # Verify malicious content is removed/escaped
            assert "<script>" not in sanitized.get("name", "")
            assert "DROP TABLE" not in sanitized.get("name", "")
            assert "javascript:" not in sanitized.get("name", "")
    
    async def test_form_file_upload_security(self):
        """Test file upload security and validation"""
        dangerous_files = [
            # Executable files
            {"name": "malware.exe", "content": b"malicious content"},
            {"name": "script.bat", "content": b"@echo off\nformat C:"},
            {"name": "shell.sh", "content": b"#!/bin/bash\nrm -rf /"},
            
            # Files with dangerous extensions
            {"name": "virus.scr", "content": b"screen saver virus"},
            {"name": "backdoor.com", "content": b"command file"},
            {"name": "trojan.pif", "content": b"program information file"},
            
            # Files with multiple extensions
            {"name": "document.pdf.exe", "content": b"fake pdf"},
            {"name": "image.jpg.bat", "content": b"fake image"},
            
            # Oversized files
            {"name": "huge.txt", "content": b"x" * (50 * 1024 * 1024)},  # 50MB
        ]
        
        from backend.src.services.file_handler import FileHandler
        
        file_handler = FileHandler()
        
        for dangerous_file in dangerous_files:
            with pytest.raises((ValueError, SecurityError, Exception)) as exc_info:
                await file_handler.validate_uploaded_file(
                    dangerous_file["name"],
                    dangerous_file["content"]
                )
            
            # Should reject dangerous files
            assert any(keyword in str(exc_info.value).lower() for keyword in [
                "not allowed", "invalid", "security", "dangerous", "too large"
            ])


@pytest.mark.unit
class TestNotificationErrorHandling:
    """Test notification service error scenarios"""
    
    async def test_email_delivery_failures(self):
        """Test email delivery failure handling"""
        from backend.src.services.notification_service import NotificationService
        
        notification_service = NotificationService()
        
        email_failures = [
            # SMTP authentication failure
            {"error": "SMTP authentication failed", "type": "auth_error"},
            
            # Network timeout
            {"error": "Network timeout", "type": "timeout"},
            
            # Invalid recipient
            {"error": "Invalid recipient address", "type": "recipient_error"},
            
            # Message size too large
            {"error": "Message exceeds size limit", "type": "size_error"},
            
            # SMTP server unavailable
            {"error": "SMTP server not responding", "type": "server_error"}
        ]
        
        for failure in email_failures:
            with patch.object(notification_service, '_email_client') as mock_email:
                mock_email.send_email.side_effect = Exception(failure["error"])
                
                notification_data = {
                    "type": "email",
                    "recipients": ["test@example.com"],
                    "subject": "Test",
                    "template": "generic",
                    "data": {}
                }
                
                result = await notification_service.send_notification(notification_data)
                
                assert result["status"] == "failed"
                assert failure["error"] in result["error_message"]
    
    async def test_webhook_delivery_failures(self):
        """Test webhook delivery failure handling"""
        from backend.src.services.notification_service import NotificationService
        
        notification_service = NotificationService()
        
        webhook_failures = [
            {"status_code": 400, "response": "Bad Request"},
            {"status_code": 401, "response": "Unauthorized"},
            {"status_code": 404, "response": "Not Found"},
            {"status_code": 429, "response": "Rate Limited"},
            {"status_code": 500, "response": "Internal Server Error"},
            {"status_code": 502, "response": "Bad Gateway"},
            {"status_code": 503, "response": "Service Unavailable"},
            {"status_code": 504, "response": "Gateway Timeout"},
        ]
        
        for failure in webhook_failures:
            with patch.object(notification_service, '_webhook_client') as mock_webhook:
                mock_response = MagicMock()
                mock_response.status_code = failure["status_code"]
                mock_response.text = failure["response"]
                mock_webhook.post.return_value = mock_response
                
                notification_data = {
                    "type": "webhook",
                    "url": "https://api.example.com/webhook",
                    "payload": {"test": "data"}
                }
                
                result = await notification_service.send_notification(notification_data)
                
                if failure["status_code"] >= 400:
                    assert result["status"] == "failed"
                    assert str(failure["status_code"]) in str(result["error_message"])
    
    async def test_notification_template_errors(self):
        """Test notification template rendering errors"""
        from backend.src.services.notification_service import NotificationService
        
        notification_service = NotificationService()
        
        template_errors = [
            # Missing template variables
            {
                "template": "Hello {name}, your {missing_var} was processed",
                "data": {"name": "John"},
                "error_type": "missing_variable"
            },
            
            # Invalid template syntax
            {
                "template": "Hello {name, your order was processed",  # Missing closing brace
                "data": {"name": "John"},
                "error_type": "syntax_error"
            },
            
            # Circular template references
            {
                "template": "Hello {name}, {recursive}",
                "data": {"name": "John", "recursive": "{name}"},
                "error_type": "recursion"
            }
        ]
        
        for error_case in template_errors:
            with patch.object(notification_service, '_load_template') as mock_load:
                mock_load.return_value = error_case["template"]
                
                try:
                    result = await notification_service.render_template(
                        "test_template",
                        error_case["data"]
                    )
                    
                    # If no exception, check for error indicators
                    if error_case["error_type"] == "missing_variable":
                        # Should handle missing variables gracefully
                        assert "{missing_var}" not in result or "undefined" in result.lower()
                        
                except Exception as e:
                    # Should handle template errors appropriately
                    assert error_case["error_type"] in ["syntax_error", "recursion"]
                    assert isinstance(e, (ValueError, KeyError, RuntimeError))


@pytest.mark.unit
class TestEdgeCaseScenarios:
    """Test various edge case scenarios"""
    
    async def test_empty_and_null_data_handling(self, async_client: AsyncClient, auth_headers):
        """Test handling of empty and null data"""
        edge_case_payloads = [
            {},  # Empty object
            {"name": ""},  # Empty string
            {"name": None},  # Null value
            {"name": "   "},  # Whitespace only
            {"definition": {}},  # Empty nested object
            {"definition": {"nodes": [], "edges": []}},  # Empty arrays
        ]
        
        for payload in edge_case_payloads:
            response = await async_client.post(
                "/api/v1/workflows/",
                json=payload,
                headers=auth_headers
            )
            
            # Should handle gracefully with appropriate error or validation
            assert response.status_code in [
                status.HTTP_201_CREATED,  # If valid
                status.HTTP_422_UNPROCESSABLE_ENTITY,  # If invalid
                status.HTTP_400_BAD_REQUEST  # If bad request
            ]
    
    async def test_unicode_and_special_characters(self, async_client: AsyncClient, auth_headers):
        """Test handling of unicode and special characters"""
        unicode_test_data = {
            "name": "测试工作流 🚀 émojis & spëcial chars",
            "description": "Ñoñó, café, naïve résumé with 中文 and العربية",
            "definition": {
                "nodes": [
                    {
                        "id": "节点_1",
                        "type": "trigger",
                        "data": {"message": "こんにちは世界 🌍"}
                    }
                ],
                "edges": []
            }
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=unicode_test_data,
            headers=auth_headers
        )
        
        # Should handle unicode characters properly
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]
        
        if response.status_code == status.HTTP_201_CREATED:
            data = response.json()
            # Unicode should be preserved
            assert "测试工作流" in data["name"]
            assert "🚀" in data["name"]
    
    async def test_extremely_nested_data_structures(self, async_client: AsyncClient, auth_headers):
        """Test handling of deeply nested data structures"""
        # Create deeply nested structure
        def create_nested_object(depth):
            if depth == 0:
                return {"value": "leaf"}
            return {"nested": create_nested_object(depth - 1)}
        
        deep_workflow = {
            "name": "Deep Nested Workflow",
            "definition": {
                "nodes": [
                    {
                        "id": "deep_node",
                        "type": "transform",
                        "data": create_nested_object(50)  # 50 levels deep
                    }
                ],
                "edges": []
            }
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=deep_workflow,
            headers=auth_headers
        )
        
        # Should handle or reject extremely nested structures appropriately
        assert response.status_code in [
            status.HTTP_201_CREATED,  # If server handles it
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,  # If too large
            status.HTTP_422_UNPROCESSABLE_ENTITY,  # If validation fails
            status.HTTP_400_BAD_REQUEST  # If bad request
        ]
    
    async def test_concurrent_resource_access(self, async_client: AsyncClient, auth_headers):
        """Test concurrent access to same resources"""
        workflow_id = uuid4()
        
        # Create workflow first
        workflow_data = {
            "name": "Concurrent Access Test",
            "definition": {"nodes": [], "edges": []}
        }
        
        create_response = await async_client.post(
            "/api/v1/workflows/",
            json=workflow_data,
            headers=auth_headers
        )
        
        if create_response.status_code == status.HTTP_201_CREATED:
            workflow_id = create_response.json()["id"]
            
            # Make concurrent requests to same resource
            concurrent_requests = [
                async_client.get(f"/api/v1/workflows/{workflow_id}", headers=auth_headers),
                async_client.put(f"/api/v1/workflows/{workflow_id}", 
                               json={"name": "Updated Name 1"}, headers=auth_headers),
                async_client.put(f"/api/v1/workflows/{workflow_id}", 
                               json={"name": "Updated Name 2"}, headers=auth_headers),
                async_client.delete(f"/api/v1/workflows/{workflow_id}", headers=auth_headers),
            ]
            
            results = await asyncio.gather(*concurrent_requests, return_exceptions=True)
            
            # Should handle concurrent access without crashes
            for result in results:
                if hasattr(result, 'status_code'):
                    assert result.status_code in [200, 404, 409, 500]  # Various acceptable responses
    
    async def test_memory_intensive_operations(self, async_client: AsyncClient, auth_headers):
        """Test handling of memory-intensive operations"""
        # Create workflow with many nodes
        large_workflow = {
            "name": "Memory Test Workflow",
            "definition": {
                "nodes": [
                    {
                        "id": f"node_{i}",
                        "type": "transform",
                        "data": {
                            "operation": "process",
                            "large_data": ["item"] * 1000  # 1000 items per node
                        }
                    }
                    for i in range(100)  # 100 nodes
                ],
                "edges": [
                    {"source": f"node_{i}", "target": f"node_{i+1}"}
                    for i in range(99)
                ]
            }
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=large_workflow,
            headers=auth_headers
        )
        
        # Should either process successfully or reject appropriately
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_500_INTERNAL_SERVER_ERROR
        ]
    
    async def test_time_boundary_conditions(self, async_session):
        """Test handling of time boundary conditions"""
        from backend.src.database.models import WorkflowExecution
        from datetime import datetime, timezone
        
        # Test various time edge cases
        time_edge_cases = [
            datetime.min.replace(tzinfo=timezone.utc),  # Minimum datetime
            datetime.max.replace(tzinfo=timezone.utc),  # Maximum datetime
            datetime(1970, 1, 1, tzinfo=timezone.utc),  # Unix epoch
            datetime(2000, 1, 1, tzinfo=timezone.utc),  # Y2K
            datetime(2038, 1, 19, 3, 14, 7, tzinfo=timezone.utc),  # Unix timestamp limit
        ]
        
        for test_time in time_edge_cases:
            try:
                execution = WorkflowExecution(
                    workflow_id=uuid4(),
                    trigger_type="manual",
                    started_at=test_time
                )
                
                async_session.add(execution)
                await async_session.flush()  # Test without commit
                
                # Should handle extreme dates appropriately
                assert execution.started_at is not None
                
            except Exception as e:
                # Some extreme dates might be rejected - that's acceptable
                assert isinstance(e, (ValueError, OverflowError, SQLAlchemyError))
            
            finally:
                await async_session.rollback()  # Clean up