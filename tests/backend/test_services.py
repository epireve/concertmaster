"""
Service Layer Unit Tests
Test business logic and service classes with proper mocking
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Mock the services since we're testing in isolation
pytest.importorskip("backend.src.services.cache_manager")
pytest.importorskip("backend.src.services.workflow_engine") 
pytest.importorskip("backend.src.services.workflow_scheduler")
pytest.importorskip("backend.src.services.form_processor")
pytest.importorskip("backend.src.services.notification_service")


@pytest.mark.unit
class TestCacheManager:
    """Test cache manager service"""
    
    @pytest.fixture
    def mock_redis_client(self):
        """Mock Redis client"""
        mock = AsyncMock()
        mock.get.return_value = None
        mock.set.return_value = True
        mock.delete.return_value = True
        mock.exists.return_value = False
        mock.expire.return_value = True
        return mock
    
    @pytest.fixture
    def cache_manager(self, mock_redis_client):
        """Create cache manager with mocked Redis"""
        from backend.src.services.cache_manager import CacheManager
        
        manager = CacheManager()
        manager._redis = mock_redis_client
        manager._initialized = True
        return manager
    
    async def test_cache_set_and_get(self, cache_manager, mock_redis_client):
        """Test setting and getting cache values"""
        # Mock Redis responses
        mock_redis_client.set.return_value = True
        mock_redis_client.get.return_value = b'{"data": "test_value"}'
        
        # Test set
        result = await cache_manager.set("test_key", {"data": "test_value"}, ttl=300)
        assert result is True
        
        mock_redis_client.set.assert_called_once()
        call_args = mock_redis_client.set.call_args
        assert call_args[0][0] == "concertmaster:test_key"
        assert call_args[1]["ex"] == 300
        
        # Test get
        value = await cache_manager.get("test_key")
        assert value == {"data": "test_value"}
        
        mock_redis_client.get.assert_called_once_with("concertmaster:test_key")
    
    async def test_cache_delete(self, cache_manager, mock_redis_client):
        """Test cache deletion"""
        mock_redis_client.delete.return_value = 1
        
        result = await cache_manager.delete("test_key")
        assert result is True
        
        mock_redis_client.delete.assert_called_once_with("concertmaster:test_key")
    
    async def test_cache_exists(self, cache_manager, mock_redis_client):
        """Test checking cache existence"""
        mock_redis_client.exists.return_value = 1
        
        result = await cache_manager.exists("test_key")
        assert result is True
        
        mock_redis_client.exists.assert_called_once_with("concertmaster:test_key")
    
    async def test_cache_with_namespace(self, cache_manager, mock_redis_client):
        """Test cache operations with namespace"""
        from backend.src.services.cache_manager import CacheNamespace
        
        mock_redis_client.set.return_value = True
        
        await cache_manager.set("user_123", {"name": "John"}, namespace=CacheNamespace.USER_SESSIONS)
        
        expected_key = "concertmaster:user_sessions:user_123"
        mock_redis_client.set.assert_called_once()
        assert mock_redis_client.set.call_args[0][0] == expected_key
    
    async def test_cache_form_schema(self, cache_manager, mock_redis_client):
        """Test form schema caching helper"""
        mock_redis_client.set.return_value = True
        
        form_data = {
            "id": str(uuid4()),
            "name": "test_form",
            "fields": [{"id": "name", "type": "text"}]
        }
        
        await cache_manager.cache_form_schema("form_123", form_data)
        
        expected_key = "concertmaster:form_definitions:form_123"
        mock_redis_client.set.assert_called_once()
        assert mock_redis_client.set.call_args[0][0] == expected_key
    
    async def test_cache_error_handling(self, cache_manager, mock_redis_client):
        """Test cache error handling"""
        mock_redis_client.get.side_effect = Exception("Redis connection error")
        
        # Should return None on error, not raise exception
        result = await cache_manager.get("test_key")
        assert result is None


@pytest.mark.unit
class TestWorkflowEngine:
    """Test workflow execution engine"""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session"""
        return AsyncMock()
    
    @pytest.fixture
    def mock_cache_manager(self):
        """Mock cache manager"""
        mock = AsyncMock()
        mock.get.return_value = None
        mock.set.return_value = True
        return mock
    
    @pytest.fixture
    def workflow_engine(self, mock_db_session, mock_cache_manager):
        """Create workflow engine with mocked dependencies"""
        from backend.src.services.workflow_engine import WorkflowEngine
        
        engine = WorkflowEngine(mock_db_session)
        engine._cache_manager = mock_cache_manager
        return engine
    
    @pytest.fixture
    def sample_workflow_definition(self):
        """Sample workflow definition for testing"""
        return {
            "nodes": [
                {
                    "id": "start",
                    "type": "trigger",
                    "data": {"trigger_type": "manual"},
                    "position": {"x": 0, "y": 0}
                },
                {
                    "id": "process",
                    "type": "transform",
                    "data": {"operation": "uppercase", "field": "message"},
                    "position": {"x": 200, "y": 0}
                },
                {
                    "id": "end",
                    "type": "action",
                    "data": {"action_type": "webhook", "url": "https://api.example.com/notify"},
                    "position": {"x": 400, "y": 0}
                }
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "process"},
                {"id": "e2", "source": "process", "target": "end"}
            ]
        }
    
    async def test_validate_workflow_definition_valid(self, workflow_engine, sample_workflow_definition):
        """Test validating a valid workflow definition"""
        result = await workflow_engine.validate_workflow_definition(sample_workflow_definition)
        
        assert result["valid"] is True
        assert len(result["errors"]) == 0
        assert len(result["warnings"]) == 0
    
    async def test_validate_workflow_definition_invalid(self, workflow_engine):
        """Test validating an invalid workflow definition"""
        invalid_definition = {
            "nodes": [
                {
                    "id": "start",
                    "type": "trigger",
                    # Missing required data
                    "position": {"x": 0, "y": 0}
                }
            ],
            "edges": [
                {
                    "id": "e1",
                    "source": "start",
                    "target": "nonexistent"  # Invalid target
                }
            ]
        }
        
        result = await workflow_engine.validate_workflow_definition(invalid_definition)
        
        assert result["valid"] is False
        assert len(result["errors"]) > 0
    
    async def test_execute_workflow_success(self, workflow_engine, sample_workflow_definition, mock_db_session):
        """Test successful workflow execution"""
        execution_id = uuid4()
        context = {"input_data": {"message": "hello world"}}
        
        # Mock database operations
        mock_execution = MagicMock()
        mock_execution.id = execution_id
        mock_execution.workflow_id = uuid4()
        mock_execution.definition = sample_workflow_definition
        
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_execution
        
        with patch.object(workflow_engine, '_execute_node', new_callable=AsyncMock) as mock_execute_node:
            mock_execute_node.return_value = {"status": "completed", "output": {"processed": True}}
            
            result = await workflow_engine.execute_workflow(execution_id, context)
            
            assert result["status"] == "completed"
            assert result["execution_id"] == execution_id
            assert mock_execute_node.call_count == 3  # 3 nodes in workflow
    
    async def test_execute_node_transform(self, workflow_engine):
        """Test executing a transform node"""
        node = {
            "id": "transform1",
            "type": "transform",
            "data": {"operation": "uppercase", "field": "message"}
        }
        
        input_data = {"message": "hello world"}
        
        with patch.object(workflow_engine, '_apply_transform', new_callable=AsyncMock) as mock_transform:
            mock_transform.return_value = {"message": "HELLO WORLD"}
            
            result = await workflow_engine._execute_node(node, input_data, {})
            
            assert result["status"] == "completed"
            assert result["output"]["message"] == "HELLO WORLD"
            mock_transform.assert_called_once_with("uppercase", "message", input_data)
    
    async def test_execute_node_error_handling(self, workflow_engine):
        """Test node execution error handling"""
        node = {
            "id": "failing_node",
            "type": "action",
            "data": {"action_type": "webhook", "url": "invalid-url"}
        }
        
        with patch.object(workflow_engine, '_execute_action', new_callable=AsyncMock) as mock_action:
            mock_action.side_effect = Exception("Network error")
            
            result = await workflow_engine._execute_node(node, {}, {})
            
            assert result["status"] == "failed"
            assert "Network error" in result["error_message"]
    
    async def test_workflow_execution_with_conditions(self, workflow_engine):
        """Test workflow execution with conditional logic"""
        workflow_with_condition = {
            "nodes": [
                {"id": "start", "type": "trigger", "data": {"trigger_type": "manual"}},
                {"id": "condition", "type": "condition", "data": {"expression": "input.value > 10"}},
                {"id": "action_true", "type": "action", "data": {"action_type": "log", "message": "Value is high"}},
                {"id": "action_false", "type": "action", "data": {"action_type": "log", "message": "Value is low"}}
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "condition"},
                {"id": "e2", "source": "condition", "target": "action_true", "condition": "true"},
                {"id": "e3", "source": "condition", "target": "action_false", "condition": "false"}
            ]
        }
        
        with patch.object(workflow_engine, '_evaluate_condition', new_callable=AsyncMock) as mock_condition:
            mock_condition.return_value = True
            
            with patch.object(workflow_engine, '_get_next_nodes') as mock_next_nodes:
                mock_next_nodes.return_value = [{"id": "action_true", "type": "action"}]
                
                context = {"input": {"value": 15}}
                result = await workflow_engine._execute_workflow_step("condition", workflow_with_condition, context)
                
                mock_condition.assert_called_once()
                assert result["next_nodes"][0]["id"] == "action_true"
    
    async def test_workflow_execution_timeout(self, workflow_engine, sample_workflow_definition):
        """Test workflow execution timeout handling"""
        execution_id = uuid4()
        
        with patch.object(workflow_engine, '_execute_node', new_callable=AsyncMock) as mock_execute_node:
            mock_execute_node.side_effect = asyncio.TimeoutError("Execution timed out")
            
            result = await workflow_engine.execute_workflow(execution_id, {}, timeout=1)
            
            assert result["status"] == "failed"
            assert "timeout" in result["error_message"].lower()


@pytest.mark.unit
class TestFormProcessor:
    """Test form processing service"""
    
    @pytest.fixture
    def mock_db_session(self):
        return AsyncMock()
    
    @pytest.fixture
    def mock_validation_service(self):
        mock = AsyncMock()
        mock.validate_form_data.return_value = {"valid": True, "errors": []}
        return mock
    
    @pytest.fixture
    def form_processor(self, mock_db_session, mock_validation_service):
        from backend.src.services.form_processor import FormProcessor
        
        processor = FormProcessor(mock_db_session)
        processor._validation_service = mock_validation_service
        return processor
    
    @pytest.fixture
    def sample_form_schema(self):
        return {
            "fields": [
                {
                    "id": "name",
                    "type": "text",
                    "label": "Full Name",
                    "required": True,
                    "validation": {"min_length": 2, "max_length": 100}
                },
                {
                    "id": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": True
                },
                {
                    "id": "age",
                    "type": "number",
                    "label": "Age",
                    "required": False,
                    "validation": {"min": 0, "max": 120}
                }
            ]
        }
    
    async def test_process_form_submission_valid(
        self, form_processor, sample_form_schema, mock_validation_service
    ):
        """Test processing valid form submission"""
        form_data = {
            "name": "John Doe",
            "email": "john@example.com",
            "age": 30
        }
        
        mock_validation_service.validate_form_data.return_value = {
            "valid": True,
            "errors": [],
            "sanitized_data": form_data
        }
        
        result = await form_processor.process_submission(
            form_schema=sample_form_schema,
            form_data=form_data,
            metadata={"ip": "192.168.1.1"}
        )
        
        assert result["status"] == "success"
        assert result["data"] == form_data
        assert "submission_id" in result
        
        mock_validation_service.validate_form_data.assert_called_once_with(
            form_data, sample_form_schema
        )
    
    async def test_process_form_submission_invalid(
        self, form_processor, sample_form_schema, mock_validation_service
    ):
        """Test processing invalid form submission"""
        form_data = {
            "name": "",  # Required field missing
            "email": "invalid-email",  # Invalid email format
            "age": 150  # Exceeds maximum
        }
        
        mock_validation_service.validate_form_data.return_value = {
            "valid": False,
            "errors": [
                "Name is required",
                "Email format is invalid",
                "Age must be between 0 and 120"
            ]
        }
        
        result = await form_processor.process_submission(
            form_schema=sample_form_schema,
            form_data=form_data
        )
        
        assert result["status"] == "error"
        assert len(result["errors"]) == 3
        assert "Name is required" in result["errors"]
    
    async def test_sanitize_form_data(self, form_processor):
        """Test form data sanitization"""
        dirty_data = {
            "name": "  John Doe  ",  # Extra whitespace
            "email": "JOHN@EXAMPLE.COM",  # Uppercase
            "message": "<script>alert('xss')</script>Hello",  # XSS attempt
            "phone": "(555) 123-4567"  # Formatted phone
        }
        
        with patch.object(form_processor, '_sanitize_field') as mock_sanitize:
            mock_sanitize.side_effect = lambda value, field_type: {
                "text": value.strip(),
                "email": value.lower().strip(),
                "textarea": value.replace("<script>", "").replace("</script>", ""),
                "phone": value.replace("(", "").replace(")", "").replace(" ", "").replace("-", "")
            }.get(field_type, value)
            
            schema = {
                "fields": [
                    {"id": "name", "type": "text"},
                    {"id": "email", "type": "email"},
                    {"id": "message", "type": "textarea"},
                    {"id": "phone", "type": "phone"}
                ]
            }
            
            sanitized = await form_processor.sanitize_data(dirty_data, schema)
            
            assert sanitized["name"] == "John Doe"
            assert sanitized["email"] == "john@example.com"
            assert "script" not in sanitized["message"]
            assert sanitized["phone"] == "5551234567"
    
    async def test_trigger_workflow_on_submission(self, form_processor, mock_db_session):
        """Test triggering workflow on form submission"""
        form_id = uuid4()
        workflow_id = uuid4()
        submission_data = {"name": "Test User", "email": "test@example.com"}
        
        # Mock form with workflow trigger
        mock_form = MagicMock()
        mock_form.id = form_id
        mock_form.settings = {"trigger_workflow": str(workflow_id)}
        
        with patch.object(form_processor, '_trigger_workflow', new_callable=AsyncMock) as mock_trigger:
            mock_trigger.return_value = {"execution_id": uuid4(), "status": "queued"}
            
            result = await form_processor.trigger_workflow_if_configured(
                mock_form, submission_data
            )
            
            assert result is not None
            assert result["status"] == "queued"
            
            mock_trigger.assert_called_once_with(
                workflow_id, {"form_data": submission_data, "form_id": str(form_id)}
            )
    
    async def test_batch_form_processing(self, form_processor, sample_form_schema):
        """Test batch processing multiple form submissions"""
        submissions = [
            {"name": f"User {i}", "email": f"user{i}@example.com", "age": 20 + i}
            for i in range(5)
        ]
        
        with patch.object(form_processor, 'process_submission', new_callable=AsyncMock) as mock_process:
            mock_process.return_value = {"status": "success", "submission_id": uuid4()}
            
            results = await form_processor.process_batch_submissions(
                sample_form_schema, submissions
            )
            
            assert len(results) == 5
            assert all(result["status"] == "success" for result in results)
            assert mock_process.call_count == 5
    
    async def test_form_analytics_tracking(self, form_processor, mock_db_session):
        """Test form analytics and metrics tracking"""
        form_id = uuid4()
        submission_data = {"name": "Test", "email": "test@example.com"}
        
        with patch.object(form_processor, '_track_form_metrics', new_callable=AsyncMock) as mock_metrics:
            await form_processor.track_submission_metrics(form_id, submission_data)
            
            mock_metrics.assert_called_once_with(
                form_id, "submission", {"field_count": 2, "completion_time": pytest.approx(0, abs=100)}
            )


@pytest.mark.unit
class TestNotificationService:
    """Test notification service"""
    
    @pytest.fixture
    def mock_email_client(self):
        mock = AsyncMock()
        mock.send_email.return_value = {"status": "sent", "message_id": "msg_123"}
        return mock
    
    @pytest.fixture
    def mock_webhook_client(self):
        mock = AsyncMock()
        mock.post.return_value.status_code = 200
        mock.post.return_value.json.return_value = {"received": True}
        return mock
    
    @pytest.fixture
    def notification_service(self, mock_email_client, mock_webhook_client):
        from backend.src.services.notification_service import NotificationService
        
        service = NotificationService()
        service._email_client = mock_email_client
        service._webhook_client = mock_webhook_client
        return service
    
    async def test_send_email_notification(self, notification_service, mock_email_client):
        """Test sending email notification"""
        notification_data = {
            "type": "email",
            "recipients": ["user@example.com"],
            "subject": "Test Notification",
            "template": "form_submission",
            "data": {"name": "John Doe", "form_name": "Contact Form"}
        }
        
        result = await notification_service.send_notification(notification_data)
        
        assert result["status"] == "sent"
        assert result["message_id"] == "msg_123"
        
        mock_email_client.send_email.assert_called_once()
        call_args = mock_email_client.send_email.call_args[1]
        assert call_args["to"] == ["user@example.com"]
        assert call_args["subject"] == "Test Notification"
    
    async def test_send_webhook_notification(self, notification_service, mock_webhook_client):
        """Test sending webhook notification"""
        notification_data = {
            "type": "webhook",
            "url": "https://api.example.com/webhook",
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "payload": {"event": "form_submitted", "data": {"form_id": "123"}}
        }
        
        mock_webhook_client.post.return_value.status_code = 200
        
        result = await notification_service.send_notification(notification_data)
        
        assert result["status"] == "sent"
        assert result["response_code"] == 200
        
        mock_webhook_client.post.assert_called_once_with(
            "https://api.example.com/webhook",
            json={"event": "form_submitted", "data": {"form_id": "123"}},
            headers={"Content-Type": "application/json"}
        )
    
    async def test_batch_notifications(self, notification_service):
        """Test sending batch notifications"""
        notifications = [
            {
                "type": "email",
                "recipients": [f"user{i}@example.com"],
                "subject": f"Notification {i}",
                "template": "generic",
                "data": {"message": f"Message {i}"}
            }
            for i in range(3)
        ]
        
        with patch.object(notification_service, 'send_notification', new_callable=AsyncMock) as mock_send:
            mock_send.return_value = {"status": "sent", "message_id": "msg_123"}
            
            results = await notification_service.send_batch_notifications(notifications)
            
            assert len(results) == 3
            assert all(result["status"] == "sent" for result in results)
            assert mock_send.call_count == 3
    
    async def test_notification_retry_logic(self, notification_service, mock_email_client):
        """Test notification retry logic on failure"""
        notification_data = {
            "type": "email",
            "recipients": ["user@example.com"],
            "subject": "Test",
            "template": "generic",
            "data": {}
        }
        
        # First two calls fail, third succeeds
        mock_email_client.send_email.side_effect = [
            Exception("SMTP error"),
            Exception("Connection timeout"),
            {"status": "sent", "message_id": "msg_123"}
        ]
        
        with patch.object(notification_service, '_should_retry') as mock_should_retry:
            mock_should_retry.return_value = True
            
            result = await notification_service.send_notification_with_retry(
                notification_data, max_retries=3
            )
            
            assert result["status"] == "sent"
            assert mock_email_client.send_email.call_count == 3
    
    async def test_notification_template_rendering(self, notification_service):
        """Test notification template rendering"""
        template_data = {
            "user_name": "John Doe",
            "form_name": "Contact Form",
            "submission_date": "2023-12-01"
        }
        
        template_content = "Hello {user_name}, your submission to {form_name} on {submission_date} was received."
        
        with patch.object(notification_service, '_load_template') as mock_load:
            mock_load.return_value = template_content
            
            rendered = await notification_service.render_template("form_submission", template_data)
            
            expected = "Hello John Doe, your submission to Contact Form on 2023-12-01 was received."
            assert rendered == expected
    
    async def test_notification_queue_management(self, notification_service):
        """Test notification queue management"""
        notifications = [
            {"type": "email", "priority": "high", "recipients": ["urgent@example.com"]},
            {"type": "email", "priority": "low", "recipients": ["normal@example.com"]},
            {"type": "email", "priority": "high", "recipients": ["urgent2@example.com"]}
        ]
        
        with patch.object(notification_service, '_queue_notification', new_callable=AsyncMock) as mock_queue:
            await notification_service.queue_notifications(notifications)
            
            # Verify high priority notifications are queued first
            calls = mock_queue.call_args_list
            assert len(calls) == 3
            
            # High priority notifications should be queued with higher priority
            high_priority_calls = [call for call in calls if call[1].get("priority") == "high"]
            assert len(high_priority_calls) == 2


@pytest.mark.unit
class TestWorkflowScheduler:
    """Test workflow scheduler service"""
    
    @pytest.fixture
    def mock_celery_app(self):
        mock = MagicMock()
        mock.send_task.return_value.id = "task_123"
        return mock
    
    @pytest.fixture
    def workflow_scheduler(self, mock_celery_app):
        from backend.src.services.workflow_scheduler import WorkflowScheduler
        
        scheduler = WorkflowScheduler()
        scheduler._celery_app = mock_celery_app
        return scheduler
    
    async def test_schedule_workflow_execution(self, workflow_scheduler, mock_celery_app):
        """Test scheduling immediate workflow execution"""
        workflow_id = uuid4()
        execution_data = {"trigger_type": "manual", "input": {"test": "data"}}
        
        result = await workflow_scheduler.schedule_execution(workflow_id, execution_data)
        
        assert result["task_id"] == "task_123"
        assert result["status"] == "queued"
        
        mock_celery_app.send_task.assert_called_once_with(
            "execute_workflow",
            args=[str(workflow_id), execution_data],
            queue="workflow"
        )
    
    async def test_schedule_delayed_workflow_execution(self, workflow_scheduler, mock_celery_app):
        """Test scheduling delayed workflow execution"""
        workflow_id = uuid4()
        execution_data = {"trigger_type": "scheduled"}
        delay_seconds = 3600  # 1 hour
        
        result = await workflow_scheduler.schedule_execution(
            workflow_id, execution_data, delay=delay_seconds
        )
        
        assert result["status"] == "scheduled"
        
        mock_celery_app.send_task.assert_called_once()
        call_kwargs = mock_celery_app.send_task.call_args[1]
        assert "countdown" in call_kwargs
        assert call_kwargs["countdown"] == delay_seconds
    
    async def test_schedule_recurring_workflow(self, workflow_scheduler):
        """Test scheduling recurring workflow execution"""
        workflow_id = uuid4()
        schedule_config = {
            "type": "cron",
            "cron_expression": "0 9 * * 1-5",  # 9 AM on weekdays
            "timezone": "UTC"
        }
        
        with patch.object(workflow_scheduler, '_create_periodic_task', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = {"schedule_id": "schedule_123", "status": "active"}
            
            result = await workflow_scheduler.schedule_recurring_execution(
                workflow_id, schedule_config
            )
            
            assert result["schedule_id"] == "schedule_123"
            assert result["status"] == "active"
            
            mock_create.assert_called_once_with(workflow_id, schedule_config)
    
    async def test_cancel_scheduled_execution(self, workflow_scheduler, mock_celery_app):
        """Test canceling scheduled workflow execution"""
        task_id = "task_123"
        
        mock_celery_app.control.revoke.return_value = True
        
        result = await workflow_scheduler.cancel_execution(task_id)
        
        assert result["status"] == "cancelled"
        
        mock_celery_app.control.revoke.assert_called_once_with(
            task_id, terminate=True
        )
    
    async def test_get_execution_status(self, workflow_scheduler, mock_celery_app):
        """Test getting execution status"""
        task_id = "task_123"
        
        mock_result = MagicMock()
        mock_result.state = "SUCCESS"
        mock_result.result = {"execution_id": uuid4(), "status": "completed"}
        mock_celery_app.AsyncResult.return_value = mock_result
        
        status = await workflow_scheduler.get_execution_status(task_id)
        
        assert status["state"] == "SUCCESS"
        assert status["result"]["status"] == "completed"
    
    async def test_workflow_execution_metrics(self, workflow_scheduler):
        """Test collecting workflow execution metrics"""
        workflow_id = uuid4()
        
        with patch.object(workflow_scheduler, '_get_execution_history', new_callable=AsyncMock) as mock_history:
            mock_history.return_value = [
                {"execution_time": 1500, "status": "completed"},
                {"execution_time": 2000, "status": "completed"},
                {"execution_time": 1800, "status": "failed"}
            ]
            
            metrics = await workflow_scheduler.get_workflow_metrics(workflow_id, days=7)
            
            assert metrics["total_executions"] == 3
            assert metrics["success_rate"] == 66.67  # 2/3 * 100
            assert metrics["avg_execution_time"] == 1750  # (1500 + 2000 + 1800) / 3
            assert metrics["failed_executions"] == 1