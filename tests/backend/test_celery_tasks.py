"""
Celery Background Task Tests
Test Celery workers and background task execution
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timedelta
import asyncio
from typing import Dict, Any

# Celery testing configuration
pytest_plugins = ["celery.contrib.pytest"]


@pytest.fixture(scope='session')
def celery_config():
    """Celery configuration for testing"""
    return {
        'broker_url': 'memory://',
        'result_backend': 'cache+memory://',
        'task_always_eager': True,
        'task_eager_propagates': True,
        'task_store_eager_result': True,
        'accept_content': ['json'],
        'task_serializer': 'json',
        'result_serializer': 'json',
        'timezone': 'UTC',
        'enable_utc': True,
    }


@pytest.fixture
def mock_db_session():
    """Mock database session for Celery tasks"""
    mock = AsyncMock()
    mock.execute.return_value.scalar_one_or_none.return_value = None
    mock.execute.return_value.scalars.return_value.all.return_value = []
    mock.commit.return_value = None
    mock.rollback.return_value = None
    return mock


@pytest.fixture
def mock_workflow_engine():
    """Mock workflow engine"""
    mock = AsyncMock()
    mock.execute_workflow.return_value = {
        "status": "completed",
        "execution_id": uuid4(),
        "execution_time": 1500
    }
    mock.validate_workflow_definition.return_value = {
        "valid": True,
        "errors": []
    }
    return mock


@pytest.fixture
def mock_notification_service():
    """Mock notification service"""
    mock = AsyncMock()
    mock.send_notification.return_value = {
        "status": "sent",
        "message_id": "msg_123"
    }
    return mock


@pytest.mark.celery
class TestWorkflowExecutionTasks:
    """Test workflow execution background tasks"""
    
    def test_execute_workflow_task_success(
        self, celery_app, celery_worker, mock_workflow_engine, mock_db_session
    ):
        """Test successful workflow execution task"""
        from backend.src.services.celery_worker import ExecuteWorkflowTask
        
        execution_id = uuid4()
        workflow_data = {
            "workflow_id": uuid4(),
            "trigger_data": {"input": "test"},
            "priority": 5
        }
        
        # Mock the workflow execution
        mock_execution = MagicMock()
        mock_execution.id = execution_id
        mock_execution.workflow_id = workflow_data["workflow_id"]
        mock_execution.status = "pending"
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_execution
            
            with patch('backend.src.services.celery_worker.WorkflowEngine') as mock_engine_class:
                mock_engine_class.return_value = mock_workflow_engine
                
                # Execute the task
                task = ExecuteWorkflowTask()
                result = task.run(str(execution_id))
                
                assert result["status"] == "completed"
                assert result["execution_id"] == execution_id
                
                # Verify workflow engine was called
                mock_workflow_engine.execute_workflow.assert_called_once()
    
    def test_execute_workflow_task_failure(
        self, celery_app, celery_worker, mock_workflow_engine, mock_db_session
    ):
        """Test workflow execution task failure handling"""
        from backend.src.services.celery_worker import ExecuteWorkflowTask
        
        execution_id = uuid4()
        
        mock_execution = MagicMock()
        mock_execution.id = execution_id
        mock_execution.status = "pending"
        
        # Mock workflow engine to raise exception
        mock_workflow_engine.execute_workflow.side_effect = Exception("Execution failed")
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_execution
            
            with patch('backend.src.services.celery_worker.WorkflowEngine') as mock_engine_class:
                mock_engine_class.return_value = mock_workflow_engine
                
                task = ExecuteWorkflowTask()
                result = task.run(str(execution_id))
                
                assert result["status"] == "failed"
                assert "Execution failed" in result["error_message"]
    
    def test_execute_workflow_task_timeout(
        self, celery_app, celery_worker, mock_workflow_engine, mock_db_session
    ):
        """Test workflow execution task timeout"""
        from backend.src.services.celery_worker import ExecuteWorkflowTask
        
        execution_id = uuid4()
        
        mock_execution = MagicMock()
        mock_execution.id = execution_id
        mock_execution.status = "pending"
        
        # Mock workflow engine to simulate timeout
        async def slow_execution(*args, **kwargs):
            await asyncio.sleep(10)  # Simulate long-running task
            return {"status": "completed"}
        
        mock_workflow_engine.execute_workflow = slow_execution
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_execution
            
            with patch('backend.src.services.celery_worker.WorkflowEngine') as mock_engine_class:
                mock_engine_class.return_value = mock_workflow_engine
                
                task = ExecuteWorkflowTask()
                task.time_limit = 5  # 5 second timeout
                
                # This should timeout and be handled gracefully
                result = task.run(str(execution_id))
                
                # Task should handle timeout appropriately
                assert result["status"] in ["failed", "timeout"]
    
    def test_execute_workflow_task_retry_logic(
        self, celery_app, celery_worker, mock_workflow_engine, mock_db_session
    ):
        """Test workflow execution task retry logic"""
        from backend.src.services.celery_worker import ExecuteWorkflowTask
        
        execution_id = uuid4()
        
        mock_execution = MagicMock()
        mock_execution.id = execution_id
        mock_execution.status = "pending"
        
        # Mock transient failure that should trigger retry
        mock_workflow_engine.execute_workflow.side_effect = [
            ConnectionError("Database connection lost"),
            {"status": "completed", "execution_id": execution_id}
        ]
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_execution
            
            with patch('backend.src.services.celery_worker.WorkflowEngine') as mock_engine_class:
                mock_engine_class.return_value = mock_workflow_engine
                
                task = ExecuteWorkflowTask()
                
                # Mock retry functionality
                with patch.object(task, 'retry') as mock_retry:
                    mock_retry.side_effect = Exception("Retry triggered")
                    
                    with pytest.raises(Exception, match="Retry triggered"):
                        task.run(str(execution_id))
                    
                    mock_retry.assert_called_once()


@pytest.mark.celery
class TestFormProcessingTasks:
    """Test form processing background tasks"""
    
    def test_process_form_submission_task(
        self, celery_app, celery_worker, mock_db_session
    ):
        """Test form submission processing task"""
        from backend.src.services.celery_worker import ProcessFormSubmissionTask
        
        submission_id = uuid4()
        form_data = {
            "name": "John Doe",
            "email": "john@example.com",
            "message": "Test message"
        }
        
        mock_submission = MagicMock()
        mock_submission.id = submission_id
        mock_submission.data = form_data
        mock_submission.status = "received"
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_submission
            
            with patch('backend.src.services.celery_worker.FormProcessor') as mock_processor_class:
                mock_processor = AsyncMock()
                mock_processor.process_submission.return_value = {
                    "status": "success",
                    "submission_id": submission_id
                }
                mock_processor_class.return_value = mock_processor
                
                task = ProcessFormSubmissionTask()
                result = task.run(str(submission_id))
                
                assert result["status"] == "success"
                assert result["submission_id"] == submission_id
                
                mock_processor.process_submission.assert_called_once()
    
    def test_send_form_notifications_task(
        self, celery_app, celery_worker, mock_notification_service
    ):
        """Test form notification sending task"""
        from backend.src.services.celery_worker import SendFormNotificationsTask
        
        form_id = uuid4()
        submission_data = {
            "name": "John Doe",
            "email": "john@example.com"
        }
        
        notification_config = {
            "email_notifications": [
                {
                    "recipients": ["admin@example.com"],
                    "template": "form_submission_admin",
                    "subject": "New Form Submission"
                }
            ],
            "webhook_notifications": [
                {
                    "url": "https://api.example.com/webhook",
                    "payload": {"form_id": str(form_id), "data": submission_data}
                }
            ]
        }
        
        with patch('backend.src.services.celery_worker.NotificationService') as mock_service_class:
            mock_service_class.return_value = mock_notification_service
            
            task = SendFormNotificationsTask()
            result = task.run(str(form_id), submission_data, notification_config)
            
            assert result["status"] == "completed"
            assert result["notifications_sent"] > 0
            
            # Verify notifications were sent
            call_count = mock_notification_service.send_notification.call_count
            assert call_count == 2  # Email + Webhook
    
    def test_batch_form_processing_task(
        self, celery_app, celery_worker, mock_db_session
    ):
        """Test batch form processing task"""
        from backend.src.services.celery_worker import BatchProcessFormsTask
        
        form_ids = [uuid4() for _ in range(3)]
        
        # Mock multiple form submissions
        mock_submissions = []
        for form_id in form_ids:
            mock_sub = MagicMock()
            mock_sub.id = uuid4()
            mock_sub.form_id = form_id
            mock_sub.status = "received"
            mock_submissions.append(mock_sub)
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalars.return_value.all.return_value = mock_submissions
            
            with patch('backend.src.services.celery_worker.FormProcessor') as mock_processor_class:
                mock_processor = AsyncMock()
                mock_processor.process_batch_submissions.return_value = [
                    {"status": "success", "submission_id": sub.id} for sub in mock_submissions
                ]
                mock_processor_class.return_value = mock_processor
                
                task = BatchProcessFormsTask()
                result = task.run([str(fid) for fid in form_ids])
                
                assert result["status"] == "completed"
                assert result["processed_count"] == 3
                
                mock_processor.process_batch_submissions.assert_called_once()


@pytest.mark.celery
class TestNotificationTasks:
    """Test notification background tasks"""
    
    def test_send_email_task(
        self, celery_app, celery_worker, mock_notification_service
    ):
        """Test email sending task"""
        from backend.src.services.celery_worker import SendEmailTask
        
        email_data = {
            "recipients": ["user@example.com"],
            "subject": "Test Email",
            "template": "generic",
            "data": {"name": "John Doe", "message": "Hello World"}
        }
        
        with patch('backend.src.services.celery_worker.NotificationService') as mock_service_class:
            mock_service_class.return_value = mock_notification_service
            
            task = SendEmailTask()
            result = task.run(email_data)
            
            assert result["status"] == "sent"
            assert result["message_id"] == "msg_123"
            
            mock_notification_service.send_notification.assert_called_once_with({
                "type": "email",
                **email_data
            })
    
    def test_send_webhook_task(
        self, celery_app, celery_worker, mock_notification_service
    ):
        """Test webhook sending task"""
        from backend.src.services.celery_worker import SendWebhookTask
        
        webhook_data = {
            "url": "https://api.example.com/webhook",
            "method": "POST",
            "payload": {"event": "test", "data": {"id": "123"}},
            "headers": {"Content-Type": "application/json"}
        }
        
        mock_notification_service.send_notification.return_value = {
            "status": "sent",
            "response_code": 200
        }
        
        with patch('backend.src.services.celery_worker.NotificationService') as mock_service_class:
            mock_service_class.return_value = mock_notification_service
            
            task = SendWebhookTask()
            result = task.run(webhook_data)
            
            assert result["status"] == "sent"
            assert result["response_code"] == 200
    
    def test_bulk_notification_task(
        self, celery_app, celery_worker, mock_notification_service
    ):
        """Test bulk notification sending task"""
        from backend.src.services.celery_worker import BulkNotificationTask
        
        notifications = [
            {
                "type": "email",
                "recipients": [f"user{i}@example.com"],
                "subject": f"Notification {i}",
                "template": "generic",
                "data": {"message": f"Message {i}"}
            }
            for i in range(5)
        ]
        
        mock_notification_service.send_batch_notifications.return_value = [
            {"status": "sent", "message_id": f"msg_{i}"} for i in range(5)
        ]
        
        with patch('backend.src.services.celery_worker.NotificationService') as mock_service_class:
            mock_service_class.return_value = mock_notification_service
            
            task = BulkNotificationTask()
            result = task.run(notifications)
            
            assert result["status"] == "completed"
            assert result["sent_count"] == 5
            assert result["failed_count"] == 0
            
            mock_notification_service.send_batch_notifications.assert_called_once_with(
                notifications
            )


@pytest.mark.celery
class TestIntegrationSyncTasks:
    """Test integration synchronization background tasks"""
    
    def test_sync_integration_data_task(
        self, celery_app, celery_worker, mock_db_session
    ):
        """Test integration data synchronization task"""
        from backend.src.services.celery_worker import SyncIntegrationDataTask
        
        integration_id = uuid4()
        sync_config = {
            "type": "database",
            "source": "external_api",
            "destination": "local_db",
            "schedule": "hourly"
        }
        
        mock_integration = MagicMock()
        mock_integration.id = integration_id
        mock_integration.type = "database"
        mock_integration.configuration = sync_config
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_integration
            
            with patch('backend.src.services.celery_worker.IntegrationSyncService') as mock_sync_class:
                mock_sync_service = AsyncMock()
                mock_sync_service.sync_data.return_value = {
                    "status": "success",
                    "records_synced": 150,
                    "sync_duration": 45.5
                }
                mock_sync_class.return_value = mock_sync_service
                
                task = SyncIntegrationDataTask()
                result = task.run(str(integration_id))
                
                assert result["status"] == "success"
                assert result["records_synced"] == 150
                assert result["sync_duration"] == 45.5
                
                mock_sync_service.sync_data.assert_called_once_with(
                    mock_integration
                )
    
    def test_validate_integration_task(
        self, celery_app, celery_worker, mock_db_session
    ):
        """Test integration validation task"""
        from backend.src.services.celery_worker import ValidateIntegrationTask
        
        integration_id = uuid4()
        
        mock_integration = MagicMock()
        mock_integration.id = integration_id
        mock_integration.type = "email"
        mock_integration.configuration = {
            "smtp_server": "smtp.gmail.com",
            "port": 587
        }
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_integration
            
            with patch('backend.src.services.celery_worker.IntegrationValidator') as mock_validator_class:
                mock_validator = AsyncMock()
                mock_validator.validate_integration.return_value = {
                    "valid": True,
                    "connection_test": "passed",
                    "last_validated": datetime.utcnow().isoformat()
                }
                mock_validator_class.return_value = mock_validator
                
                task = ValidateIntegrationTask()
                result = task.run(str(integration_id))
                
                assert result["valid"] is True
                assert result["connection_test"] == "passed"
                
                mock_validator.validate_integration.assert_called_once_with(
                    mock_integration
                )


@pytest.mark.celery
class TestScheduledTasks:
    """Test scheduled/periodic background tasks"""
    
    def test_cleanup_expired_sessions_task(
        self, celery_app, celery_worker, mock_db_session
    ):
        """Test cleanup of expired sessions task"""
        from backend.src.services.celery_worker import CleanupExpiredSessionsTask
        
        # Mock expired sessions
        expired_sessions = [MagicMock() for _ in range(3)]
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            mock_db_session.execute.return_value.scalars.return_value.all.return_value = expired_sessions
            
            task = CleanupExpiredSessionsTask()
            result = task.run()
            
            assert result["status"] == "completed"
            assert result["cleaned_sessions"] == 3
            
            # Verify delete was called for each session
            assert mock_db_session.delete.call_count == 3
    
    def test_generate_analytics_reports_task(
        self, celery_app, celery_worker, mock_db_session
    ):
        """Test analytics report generation task"""
        from backend.src.services.celery_worker import GenerateAnalyticsReportsTask
        
        report_config = {
            "type": "daily",
            "include_metrics": ["workflow_executions", "form_submissions"],
            "date_range": {"start": "2023-12-01", "end": "2023-12-02"}
        }
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_get_db.return_value.__aenter__.return_value = mock_db_session
            
            with patch('backend.src.services.celery_worker.AnalyticsService') as mock_analytics_class:
                mock_analytics = AsyncMock()
                mock_analytics.generate_report.return_value = {
                    "report_id": "report_123",
                    "data": {
                        "workflow_executions": 45,
                        "form_submissions": 123
                    },
                    "generated_at": datetime.utcnow().isoformat()
                }
                mock_analytics_class.return_value = mock_analytics
                
                task = GenerateAnalyticsReportsTask()
                result = task.run(report_config)
                
                assert result["status"] == "completed"
                assert result["report_id"] == "report_123"
                
                mock_analytics.generate_report.assert_called_once_with(
                    report_config
                )
    
    def test_backup_database_task(
        self, celery_app, celery_worker
    ):
        """Test database backup task"""
        from backend.src.services.celery_worker import BackupDatabaseTask
        
        backup_config = {
            "backup_type": "incremental",
            "retention_days": 30,
            "storage_location": "s3://backup-bucket/db-backups/"
        }
        
        with patch('backend.src.services.celery_worker.DatabaseBackupService') as mock_backup_class:
            mock_backup_service = AsyncMock()
            mock_backup_service.create_backup.return_value = {
                "backup_id": "backup_123",
                "size": "2.5GB",
                "duration": 180,
                "location": "s3://backup-bucket/db-backups/backup_123.sql"
            }
            mock_backup_class.return_value = mock_backup_service
            
            task = BackupDatabaseTask()
            result = task.run(backup_config)
            
            assert result["status"] == "completed"
            assert result["backup_id"] == "backup_123"
            assert result["size"] == "2.5GB"
            
            mock_backup_service.create_backup.assert_called_once_with(
                backup_config
            )


@pytest.mark.celery
class TestTaskChaining:
    """Test task chaining and workflow orchestration"""
    
    def test_workflow_with_form_processing_chain(
        self, celery_app, celery_worker
    ):
        """Test chained tasks: form submission -> processing -> notifications"""
        from backend.src.services.celery_worker import (
            ProcessFormSubmissionTask, 
            SendFormNotificationsTask,
            ExecuteWorkflowTask
        )
        
        # Mock the task chain
        submission_id = uuid4()
        form_id = uuid4()
        workflow_id = uuid4()
        
        with patch.multiple(
            'backend.src.services.celery_worker',
            get_db_session=AsyncMock(),
            FormProcessor=MagicMock(),
            NotificationService=MagicMock(),
            WorkflowEngine=MagicMock()
        ):
            # Create task chain
            chain_result = (
                ProcessFormSubmissionTask.si(str(submission_id)) |
                SendFormNotificationsTask.si(str(form_id), {}, {}) |
                ExecuteWorkflowTask.si(str(workflow_id))
            )
            
            # Execute chain (in eager mode, this will run synchronously)
            result = chain_result.apply()
            
            # Verify chain executed
            assert result.successful()
    
    def test_parallel_task_execution(
        self, celery_app, celery_worker
    ):
        """Test parallel task execution using groups"""
        from backend.src.services.celery_worker import SendEmailTask
        from celery import group
        
        # Create multiple email tasks to run in parallel
        email_tasks = [
            SendEmailTask.si({
                "recipients": [f"user{i}@example.com"],
                "subject": f"Email {i}",
                "template": "generic",
                "data": {"message": f"Message {i}"}
            })
            for i in range(5)
        ]
        
        with patch('backend.src.services.celery_worker.NotificationService') as mock_service_class:
            mock_service = AsyncMock()
            mock_service.send_notification.return_value = {
                "status": "sent",
                "message_id": "msg_123"
            }
            mock_service_class.return_value = mock_service
            
            # Execute tasks in parallel
            job = group(email_tasks)
            result = job.apply()
            
            # Verify all tasks completed
            assert result.successful()
            assert len(result.results) == 5
    
    def test_conditional_task_execution(
        self, celery_app, celery_worker
    ):
        """Test conditional task execution based on results"""
        from backend.src.services.celery_worker import (
            ProcessFormSubmissionTask,
            SendFormNotificationsTask
        )
        
        submission_id = uuid4()
        form_id = uuid4()
        
        with patch('backend.src.services.celery_worker.FormProcessor') as mock_processor_class:
            mock_processor = AsyncMock()
            
            # Mock successful processing
            mock_processor.process_submission.return_value = {
                "status": "success",
                "submission_id": submission_id,
                "send_notifications": True
            }
            mock_processor_class.return_value = mock_processor
            
            # Create conditional workflow
            process_task = ProcessFormSubmissionTask()
            process_result = process_task.run(str(submission_id))
            
            # Check if notifications should be sent based on result
            if process_result.get("send_notifications"):
                with patch('backend.src.services.celery_worker.NotificationService') as mock_notification_class:
                    mock_notification = AsyncMock()
                    mock_notification.send_notification.return_value = {
                        "status": "sent"
                    }
                    mock_notification_class.return_value = mock_notification
                    
                    notify_task = SendFormNotificationsTask()
                    notify_result = notify_task.run(str(form_id), {}, {})
                    
                    assert notify_result["status"] == "completed"


@pytest.mark.celery
@pytest.mark.slow
class TestTaskPerformance:
    """Test task performance and resource usage"""
    
    def test_bulk_task_performance(
        self, celery_app, celery_worker, performance_timer
    ):
        """Test performance of bulk task processing"""
        from backend.src.services.celery_worker import BatchProcessFormsTask
        
        # Create large batch of form IDs
        form_ids = [str(uuid4()) for _ in range(100)]
        
        with patch('backend.src.services.celery_worker.get_db_session') as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db
            
            # Mock batch processing to return quickly
            mock_submissions = [MagicMock() for _ in range(100)]
            mock_db.execute.return_value.scalars.return_value.all.return_value = mock_submissions
            
            with patch('backend.src.services.celery_worker.FormProcessor') as mock_processor_class:
                mock_processor = AsyncMock()
                mock_processor.process_batch_submissions.return_value = [
                    {"status": "success"} for _ in range(100)
                ]
                mock_processor_class.return_value = mock_processor
                
                performance_timer.start()
                
                task = BatchProcessFormsTask()
                result = task.run(form_ids)
                
                performance_timer.stop()
                
                assert result["status"] == "completed"
                assert result["processed_count"] == 100
                
                # Task should complete within reasonable time
                assert performance_timer.elapsed_ms < 5000  # 5 seconds
    
    def test_memory_usage_during_task_execution(
        self, celery_app, celery_worker
    ):
        """Test memory usage during large task execution"""
        import psutil
        import os
        
        from backend.src.services.celery_worker import BulkNotificationTask
        
        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Create large notification batch
        notifications = [
            {
                "type": "email",
                "recipients": [f"user{i}@example.com"],
                "subject": f"Notification {i}",
                "data": {"large_data": "x" * 1000}  # 1KB per notification
            }
            for i in range(1000)  # 1000 notifications
        ]
        
        with patch('backend.src.services.celery_worker.NotificationService') as mock_service_class:
            mock_service = AsyncMock()
            mock_service.send_batch_notifications.return_value = [
                {"status": "sent"} for _ in range(1000)
            ]
            mock_service_class.return_value = mock_service
            
            task = BulkNotificationTask()
            result = task.run(notifications)
            
            # Check memory usage after task
            final_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_increase = final_memory - initial_memory
            
            assert result["status"] == "completed"
            # Memory increase should be reasonable (less than 100MB)
            assert memory_increase < 100
    
    def test_concurrent_task_handling(
        self, celery_app, celery_worker
    ):
        """Test handling of concurrent task execution"""
        from backend.src.services.celery_worker import SendEmailTask
        from celery import group
        
        # Create many concurrent email tasks
        email_tasks = [
            SendEmailTask.si({
                "recipients": [f"user{i}@example.com"],
                "subject": f"Concurrent Email {i}",
                "template": "generic",
                "data": {"id": i}
            })
            for i in range(50)
        ]
        
        with patch('backend.src.services.celery_worker.NotificationService') as mock_service_class:
            mock_service = AsyncMock()
            mock_service.send_notification.return_value = {
                "status": "sent",
                "message_id": "msg_123"
            }
            mock_service_class.return_value = mock_service
            
            # Execute all tasks concurrently
            job = group(email_tasks)
            result = job.apply()
            
            # All tasks should complete successfully
            assert result.successful()
            assert all(task_result.status == "SUCCESS" for task_result in result.results)
            
            # Verify all notifications were sent
            assert mock_service.send_notification.call_count == 50