"""
Worker Manager - Celery worker management and task orchestration
Handles distributed task execution, worker health monitoring, and task queuing.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone
from uuid import UUID, uuid4
from enum import Enum

from celery import Celery
from celery.result import AsyncResult
from celery.exceptions import WorkerLostError, Retry, Ignore
from kombu import Queue

from ..config import settings
from .cache_manager import CacheManager

logger = logging.getLogger(__name__)


class TaskPriority(str, Enum):
    """Task priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    """Task execution status"""
    PENDING = "PENDING"
    STARTED = "STARTED"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    RETRY = "RETRY"
    REVOKED = "REVOKED"


class WorkerManager:
    """Celery worker management and task orchestration"""
    
    def __init__(self):
        self.celery_app: Optional[Celery] = None
        self.cache_manager: Optional[CacheManager] = None
        self._is_initialized = False
        self._task_registry: Dict[str, Callable] = {}
        
    async def initialize(self) -> None:
        """Initialize Celery worker manager"""
        try:
            logger.info("Initializing worker manager...")
            
            # Create Celery app
            self.celery_app = Celery('concertmaster')
            
            # Configure Celery
            celery_config = settings.get_celery_config()
            self.celery_app.conf.update(celery_config)
            
            # Configure queues with priorities
            self.celery_app.conf.task_routes = {
                'concertmaster.tasks.workflow_execution.*': {'queue': 'workflow'},
                'concertmaster.tasks.form_processing.*': {'queue': 'forms'},
                'concertmaster.tasks.integration.*': {'queue': 'integration'},
                'concertmaster.tasks.notification.*': {'queue': 'notifications'},
                'concertmaster.tasks.system.*': {'queue': 'system'}
            }
            
            # Define queues with priorities
            self.celery_app.conf.task_queues = (
                Queue('workflow', priority=3),
                Queue('forms', priority=2),
                Queue('integration', priority=2),
                Queue('notifications', priority=1),
                Queue('system', priority=0)
            )
            
            # Initialize cache manager for task results
            self.cache_manager = CacheManager()
            await self.cache_manager.initialize()
            
            # Register core tasks
            self._register_core_tasks()
            
            self._is_initialized = True
            logger.info("✅ Worker manager initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize worker manager: {e}")
            raise
    
    async def close(self) -> None:
        """Close worker manager connections"""
        try:
            if self.cache_manager:
                await self.cache_manager.close()
                
            if self.celery_app:
                self.celery_app.control.shutdown()
                
            self._is_initialized = False
            logger.info("✅ Worker manager closed")
            
        except Exception as e:
            logger.error(f"Error closing worker manager: {e}")
    
    def _ensure_initialized(self):
        """Ensure worker manager is initialized"""
        if not self._is_initialized or not self.celery_app:
            raise RuntimeError("WorkerManager not initialized")
    
    def _register_core_tasks(self):
        """Register core Celery tasks"""
        
        @self.celery_app.task(bind=True, name='concertmaster.tasks.workflow_execution.execute_workflow')
        def execute_workflow_task(task_self, workflow_id: str, trigger_data: dict, user_id: str = None):
            """Execute workflow task"""
            try:
                from ..services.workflow_engine import WorkflowEngine
                from ..database.connection import db_manager
                from .state_manager import StateManager
                
                # This would be implemented to run the workflow
                # For now, it's a placeholder
                logger.info(f"Executing workflow {workflow_id}")
                return {
                    "workflow_id": workflow_id,
                    "status": "completed",
                    "result": "Workflow executed successfully"
                }
                
            except Exception as e:
                logger.error(f"Workflow execution task failed: {e}")
                raise task_self.retry(exc=e, countdown=60, max_retries=3)
        
        @self.celery_app.task(bind=True, name='concertmaster.tasks.form_processing.process_form_submission')
        def process_form_submission_task(task_self, form_id: str, submission_data: dict):
            """Process form submission task"""
            try:
                logger.info(f"Processing form submission for form {form_id}")
                # Form processing logic would go here
                return {
                    "form_id": form_id,
                    "status": "processed",
                    "submission_id": str(uuid4())
                }
                
            except Exception as e:
                logger.error(f"Form processing task failed: {e}")
                raise task_self.retry(exc=e, countdown=30, max_retries=3)
        
        @self.celery_app.task(bind=True, name='concertmaster.tasks.integration.sync_data')
        def sync_data_task(task_self, integration_id: str, sync_config: dict):
            """Data synchronization task"""
            try:
                logger.info(f"Syncing data for integration {integration_id}")
                # Data sync logic would go here
                return {
                    "integration_id": integration_id,
                    "status": "synced",
                    "records_processed": 0
                }
                
            except Exception as e:
                logger.error(f"Data sync task failed: {e}")
                raise task_self.retry(exc=e, countdown=120, max_retries=3)
        
        @self.celery_app.task(bind=True, name='concertmaster.tasks.notification.send_notification')
        def send_notification_task(task_self, recipient: str, message: dict, channel: str = "email"):
            """Send notification task"""
            try:
                logger.info(f"Sending {channel} notification to {recipient}")
                # Notification sending logic would go here
                return {
                    "recipient": recipient,
                    "channel": channel,
                    "status": "sent",
                    "message_id": str(uuid4())
                }
                
            except Exception as e:
                logger.error(f"Notification task failed: {e}")
                raise task_self.retry(exc=e, countdown=60, max_retries=3)
        
        @self.celery_app.task(bind=True, name='concertmaster.tasks.system.cleanup_expired_data')
        def cleanup_expired_data_task(task_self):
            """System cleanup task"""
            try:
                logger.info("Running system cleanup")
                # Cleanup logic would go here
                return {
                    "status": "completed",
                    "cleaned_records": 0
                }
                
            except Exception as e:
                logger.error(f"System cleanup task failed: {e}")
                raise
        
        # Store task references
        self._task_registry = {
            'execute_workflow': execute_workflow_task,
            'process_form_submission': process_form_submission_task,
            'sync_data': sync_data_task,
            'send_notification': send_notification_task,
            'cleanup_expired_data': cleanup_expired_data_task
        }
    
    async def submit_task(
        self,
        task_name: str,
        args: tuple = (),
        kwargs: dict = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        queue: str = None,
        countdown: int = None,
        eta: datetime = None,
        expires: datetime = None,
        retry_policy: dict = None
    ) -> str:
        """Submit task for execution"""
        try:
            self._ensure_initialized()
            
            if kwargs is None:
                kwargs = {}
            
            # Get task from registry
            if task_name not in self._task_registry:
                raise ValueError(f"Task {task_name} not found in registry")
            
            task = self._task_registry[task_name]
            
            # Prepare task options
            task_options = {
                'priority': self._get_priority_value(priority)
            }
            
            if queue:
                task_options['queue'] = queue
            if countdown:
                task_options['countdown'] = countdown
            if eta:
                task_options['eta'] = eta
            if expires:
                task_options['expires'] = expires
            if retry_policy:
                task_options['retry_policy'] = retry_policy
            
            # Submit task
            result = task.apply_async(args=args, kwargs=kwargs, **task_options)
            
            # Cache task metadata
            await self._cache_task_metadata(result.id, task_name, args, kwargs, priority)
            
            logger.info(f"Submitted task {task_name} with ID {result.id}")
            return result.id
            
        except Exception as e:
            logger.error(f"Failed to submit task {task_name}: {e}")
            raise
    
    def _get_priority_value(self, priority: TaskPriority) -> int:
        """Convert priority enum to numeric value"""
        priority_map = {
            TaskPriority.LOW: 1,
            TaskPriority.NORMAL: 5,
            TaskPriority.HIGH: 8,
            TaskPriority.CRITICAL: 10
        }
        return priority_map.get(priority, 5)
    
    async def _cache_task_metadata(
        self,
        task_id: str,
        task_name: str,
        args: tuple,
        kwargs: dict,
        priority: TaskPriority
    ):
        """Cache task metadata for tracking"""
        try:
            metadata = {
                "task_name": task_name,
                "args": args,
                "kwargs": kwargs,
                "priority": priority.value,
                "submitted_at": datetime.now(timezone.utc).isoformat(),
                "status": TaskStatus.PENDING.value
            }
            
            from .cache_manager import CacheNamespace
            await self.cache_manager.set(
                CacheNamespace.GLOBAL,
                f"task_metadata:{task_id}",
                metadata,
                86400  # 24 hours
            )
            
        except Exception as e:
            logger.error(f"Failed to cache task metadata: {e}")
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get task execution status"""
        try:
            self._ensure_initialized()
            
            # Get Celery result
            result = AsyncResult(task_id, app=self.celery_app)
            
            # Get cached metadata
            from .cache_manager import CacheNamespace
            metadata = await self.cache_manager.get(
                CacheNamespace.GLOBAL,
                f"task_metadata:{task_id}"
            ) or {}
            
            return {
                "task_id": task_id,
                "status": result.status,
                "result": result.result if result.successful() else None,
                "error": str(result.result) if result.failed() else None,
                "traceback": result.traceback if result.failed() else None,
                "metadata": metadata,
                "ready": result.ready(),
                "successful": result.successful(),
                "failed": result.failed()
            }
            
        except Exception as e:
            logger.error(f"Failed to get task status for {task_id}: {e}")
            return {"task_id": task_id, "error": str(e)}
    
    async def cancel_task(self, task_id: str, terminate: bool = False) -> bool:
        """Cancel running task"""
        try:
            self._ensure_initialized()
            
            if terminate:
                self.celery_app.control.terminate(task_id)
            else:
                self.celery_app.control.revoke(task_id, terminate=False)
            
            logger.info(f"Cancelled task {task_id} (terminate={terminate})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cancel task {task_id}: {e}")
            return False
    
    async def get_active_tasks(self) -> List[Dict[str, Any]]:
        """Get list of active tasks"""
        try:
            self._ensure_initialized()
            
            # Get active tasks from workers
            inspect = self.celery_app.control.inspect()
            active_tasks = inspect.active()
            
            if not active_tasks:
                return []
            
            # Flatten tasks from all workers
            all_tasks = []
            for worker, tasks in active_tasks.items():
                for task in tasks:
                    all_tasks.append({
                        "worker": worker,
                        **task
                    })
            
            return all_tasks
            
        except Exception as e:
            logger.error(f"Failed to get active tasks: {e}")
            return []
    
    async def get_worker_stats(self) -> Dict[str, Any]:
        """Get worker statistics"""
        try:
            self._ensure_initialized()
            
            inspect = self.celery_app.control.inspect()
            
            # Get various stats
            stats = inspect.stats()
            active = inspect.active()
            registered = inspect.registered()
            reserved = inspect.reserved()
            
            return {
                "workers": list(stats.keys()) if stats else [],
                "total_workers": len(stats) if stats else 0,
                "stats": stats or {},
                "active_tasks": sum(len(tasks) for tasks in active.values()) if active else 0,
                "registered_tasks": registered or {},
                "reserved_tasks": sum(len(tasks) for tasks in reserved.values()) if reserved else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get worker stats: {e}")
            return {"error": str(e)}
    
    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        try:
            self._ensure_initialized()
            
            with self.celery_app.connection_or_acquire() as conn:
                queues_info = {}
                
                # Get info for each queue
                queue_names = ['workflow', 'forms', 'integration', 'notifications', 'system']
                
                for queue_name in queue_names:
                    try:
                        queue = conn.SimpleQueue(queue_name)
                        queue_info = queue.qsize()  # Get approximate queue size
                        queues_info[queue_name] = {
                            "name": queue_name,
                            "size": queue_info,
                            "status": "active"
                        }
                        queue.close()
                    except Exception as e:
                        queues_info[queue_name] = {
                            "name": queue_name,
                            "size": 0,
                            "status": "error",
                            "error": str(e)
                        }
                
                return queues_info
                
        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            return {"error": str(e)}
    
    async def purge_queue(self, queue_name: str) -> int:
        """Purge all tasks from a queue"""
        try:
            self._ensure_initialized()
            
            with self.celery_app.connection_or_acquire() as conn:
                queue = conn.SimpleQueue(queue_name)
                purged = queue.clear()
                queue.close()
                
                logger.warning(f"Purged {purged} tasks from queue {queue_name}")
                return purged
                
        except Exception as e:
            logger.error(f"Failed to purge queue {queue_name}: {e}")
            return 0
    
    async def health_check(self) -> Dict[str, Any]:
        """Check worker manager health"""
        try:
            if not self._is_initialized:
                return {"status": "not_initialized"}
            
            # Test broker connection
            try:
                with self.celery_app.connection_or_acquire() as conn:
                    conn.ensure_connection(max_retries=3)
                broker_status = "healthy"
            except Exception as e:
                broker_status = f"unhealthy: {str(e)}"
            
            # Get worker count
            inspect = self.celery_app.control.inspect()
            stats = inspect.stats()
            worker_count = len(stats) if stats else 0
            
            # Get queue stats
            queue_stats = await self.get_queue_stats()
            total_queued = sum(
                q.get("size", 0) for q in queue_stats.values() 
                if isinstance(q, dict) and "size" in q
            )
            
            return {
                "status": "healthy" if broker_status == "healthy" else "degraded",
                "broker_status": broker_status,
                "worker_count": worker_count,
                "total_queued_tasks": total_queued,
                "registered_tasks": len(self._task_registry)
            }
            
        except Exception as e:
            logger.error(f"Worker manager health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive worker manager statistics"""
        try:
            health = await self.health_check()
            worker_stats = await self.get_worker_stats()
            queue_stats = await self.get_queue_stats()
            active_tasks = await self.get_active_tasks()
            
            return {
                **health,
                "worker_stats": worker_stats,
                "queue_stats": queue_stats,
                "active_tasks_count": len(active_tasks),
                "active_tasks": active_tasks[:10]  # Limit to first 10 for performance
            }
            
        except Exception as e:
            logger.error(f"Failed to get worker manager stats: {e}")
            return {"status": "error", "error": str(e)}
    
    # Convenience methods for common tasks
    
    async def execute_workflow(
        self,
        workflow_id: UUID,
        trigger_data: Dict[str, Any],
        user_id: UUID = None,
        priority: TaskPriority = TaskPriority.HIGH
    ) -> str:
        """Execute workflow asynchronously"""
        return await self.submit_task(
            'execute_workflow',
            args=(str(workflow_id), trigger_data, str(user_id) if user_id else None),
            priority=priority,
            queue='workflow'
        )
    
    async def process_form_submission(
        self,
        form_id: str,
        submission_data: Dict[str, Any],
        priority: TaskPriority = TaskPriority.NORMAL
    ) -> str:
        """Process form submission asynchronously"""
        return await self.submit_task(
            'process_form_submission',
            args=(form_id, submission_data),
            priority=priority,
            queue='forms'
        )
    
    async def send_notification(
        self,
        recipient: str,
        message: Dict[str, Any],
        channel: str = "email",
        priority: TaskPriority = TaskPriority.LOW
    ) -> str:
        """Send notification asynchronously"""
        return await self.submit_task(
            'send_notification',
            args=(recipient, message, channel),
            priority=priority,
            queue='notifications'
        )