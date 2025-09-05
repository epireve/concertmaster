"""
ConcertMaster Celery Worker
Asynchronous task processing for workflow execution
"""

from celery import Celery, Task
from celery.signals import worker_init, worker_shutdown, task_prerun, task_postrun
from celery.exceptions import Retry, WorkerLostError
import asyncio
import json
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging

from ..config import settings, CeleryConfig
from ..database.connection import DatabaseManager
from .plugin_system import plugin_manager, NodeExecutionResult, NodeExecutionStatus
from .cache_manager import CacheManager
from .notification_service import NotificationService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery('concertmaster')
celery_app.config_from_object(CeleryConfig)

# Global instances (initialized in worker_init)
db_manager: Optional[DatabaseManager] = None
cache_manager: Optional[CacheManager] = None
notification_service: Optional[NotificationService] = None

class AsyncTask(Task):
    """Base task class with async support"""
    
    def __call__(self, *args, **kwargs):
        """Handle async task execution"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.run_async(*args, **kwargs))
        finally:
            loop.close()
    
    async def run_async(self, *args, **kwargs):
        """Override this method for async tasks"""
        raise NotImplementedError("Async tasks must implement run_async method")

# Worker lifecycle handlers
@worker_init.connect
def worker_init_handler(sender, **kwargs):
    """Initialize worker resources"""
    global db_manager, cache_manager, notification_service
    
    logger.info("Initializing Celery worker...")
    
    # Initialize database connection
    db_manager = DatabaseManager()
    asyncio.run(db_manager.initialize())
    
    # Initialize cache
    cache_manager = CacheManager()
    asyncio.run(cache_manager.initialize())
    
    # Initialize notification service
    notification_service = NotificationService()
    
    logger.info("Celery worker initialized")

@worker_shutdown.connect
def worker_shutdown_handler(sender, **kwargs):
    """Cleanup worker resources"""
    global db_manager, cache_manager
    
    logger.info("Shutting down Celery worker...")
    
    if db_manager:
        asyncio.run(db_manager.close())
    
    if cache_manager:
        asyncio.run(cache_manager.close())
    
    logger.info("Celery worker shutdown complete")

# Task execution tracking
@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """Pre-task execution logging"""
    logger.info(f"Starting task {task.name} with ID {task_id}")

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **kwds):
    """Post-task execution logging"""
    logger.info(f"Task {task.name} with ID {task_id} completed with state {state}")

# Workflow execution tasks
@celery_app.task(bind=True, base=AsyncTask, queue='workflow')
class ExecuteWorkflowTask(AsyncTask):
    """Execute a complete workflow"""
    
    async def run_async(self, workflow_execution_id: str):
        """Execute workflow asynchronously"""
        try:
            execution_engine = WorkflowExecutionEngine()
            result = await execution_engine.execute_workflow(workflow_execution_id)
            
            logger.info(f"Workflow execution {workflow_execution_id} completed: {result}")
            return result
            
        except Exception as e:
            logger.exception(f"Workflow execution {workflow_execution_id} failed")
            await self._handle_workflow_failure(workflow_execution_id, str(e))
            raise
    
    async def _handle_workflow_failure(self, workflow_execution_id: str, error_message: str):
        """Handle workflow execution failure"""
        if db_manager:
            async with db_manager.get_session() as session:
                # Update execution status
                await session.execute(
                    "UPDATE workflow_executions SET status = 'failed', error_message = %s, completed_at = NOW() WHERE id = %s",
                    (error_message, workflow_execution_id)
                )
                await session.commit()

@celery_app.task(bind=True, base=AsyncTask, queue='workflow')
class ExecuteNodeTask(AsyncTask):
    """Execute a single workflow node"""
    
    async def run_async(self, node_execution_id: str, node_type: str, node_config: Dict[str, Any], 
                       input_data: Dict[str, Any], context: Dict[str, Any]):
        """Execute a single node"""
        start_time = time.time()
        
        try:
            # Update node execution status to running
            await self._update_node_status(node_execution_id, NodeExecutionStatus.RUNNING.value, start_time)
            
            # Execute the node
            result = await plugin_manager.execute_node(
                node_type=node_type,
                node_id=node_execution_id,
                config=node_config,
                input_data=input_data,
                context=context
            )
            
            execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            result.execution_time = execution_time
            
            # Update node execution with result
            await self._update_node_result(node_execution_id, result)
            
            return {
                'status': result.status.value,
                'output_data': result.output_data,
                'error_message': result.error_message,
                'execution_time': execution_time
            }
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            logger.exception(f"Node execution {node_execution_id} failed")
            
            await self._update_node_status(
                node_execution_id, 
                NodeExecutionStatus.FAILED.value, 
                start_time, 
                str(e),
                execution_time
            )
            raise
    
    async def _update_node_status(self, node_execution_id: str, status: str, 
                                 start_time: float, error_message: str = None,
                                 execution_time: float = None):
        """Update node execution status in database"""
        if not db_manager:
            return
        
        async with db_manager.get_session() as session:
            update_data = {
                'status': status,
                'started_at': datetime.fromtimestamp(start_time) if status == 'running' else None,
                'completed_at': datetime.now() if status in ['completed', 'failed'] else None,
                'error_message': error_message,
                'execution_time': int(execution_time) if execution_time else None
            }
            
            # Filter out None values
            update_data = {k: v for k, v in update_data.items() if v is not None}
            
            # Build update query
            set_clauses = [f"{k} = %s" for k in update_data.keys()]
            values = list(update_data.values()) + [node_execution_id]
            
            query = f"UPDATE node_executions SET {', '.join(set_clauses)} WHERE id = %s"
            await session.execute(query, values)
            await session.commit()
    
    async def _update_node_result(self, node_execution_id: str, result: NodeExecutionResult):
        """Update node execution with complete result"""
        if not db_manager:
            return
        
        async with db_manager.get_session() as session:
            await session.execute(
                """UPDATE node_executions 
                   SET status = %s, output_data = %s, error_message = %s, 
                       completed_at = NOW(), execution_time = %s 
                   WHERE id = %s""",
                (result.status.value, json.dumps(result.output_data), 
                 result.error_message, int(result.execution_time or 0), node_execution_id)
            )
            await session.commit()

# Form processing tasks
@celery_app.task(bind=True, base=AsyncTask, queue='forms')
class ProcessFormSubmissionTask(AsyncTask):
    """Process form submission and trigger workflows"""
    
    async def run_async(self, form_submission_id: str):
        """Process form submission"""
        try:
            form_processor = FormProcessor()
            result = await form_processor.process_submission(form_submission_id)
            
            logger.info(f"Form submission {form_submission_id} processed: {result}")
            return result
            
        except Exception as e:
            logger.exception(f"Form submission processing {form_submission_id} failed")
            raise

# Integration tasks
@celery_app.task(bind=True, base=AsyncTask, queue='integration')
class SyncIntegrationTask(AsyncTask):
    """Synchronize data with external integrations"""
    
    async def run_async(self, integration_id: str, sync_type: str, data: Dict[str, Any]):
        """Sync with external integration"""
        try:
            integration_manager = IntegrationManager()
            result = await integration_manager.sync_data(integration_id, sync_type, data)
            
            logger.info(f"Integration sync {integration_id} completed: {result}")
            return result
            
        except Exception as e:
            logger.exception(f"Integration sync {integration_id} failed")
            raise

# Notification tasks
@celery_app.task(bind=True, base=AsyncTask, queue='notifications')
class SendNotificationTask(AsyncTask):
    """Send notifications (email, webhook, etc.)"""
    
    async def run_async(self, notification_type: str, recipient: str, 
                       subject: str, content: str, metadata: Dict[str, Any] = None):
        """Send notification"""
        try:
            if notification_service:
                result = await notification_service.send_notification(
                    notification_type, recipient, subject, content, metadata or {}
                )
                
                logger.info(f"Notification sent to {recipient}: {result}")
                return result
            else:
                logger.error("Notification service not initialized")
                return False
                
        except Exception as e:
            logger.exception(f"Notification sending failed for {recipient}")
            raise

# Workflow execution engine
class WorkflowExecutionEngine:
    """Engine for executing complete workflows"""
    
    async def execute_workflow(self, workflow_execution_id: str) -> Dict[str, Any]:
        """Execute a workflow end-to-end"""
        if not db_manager:
            raise RuntimeError("Database manager not initialized")
        
        async with db_manager.get_session() as session:
            # Get workflow execution details
            result = await session.execute(
                """SELECT we.*, w.definition 
                   FROM workflow_executions we 
                   JOIN workflows w ON we.workflow_id = w.id 
                   WHERE we.id = %s""",
                (workflow_execution_id,)
            )
            execution_data = result.fetchone()
            
            if not execution_data:
                raise ValueError(f"Workflow execution {workflow_execution_id} not found")
            
            workflow_definition = json.loads(execution_data['definition'])
            
            # Update execution status to running
            await session.execute(
                "UPDATE workflow_executions SET status = 'running', started_at = NOW() WHERE id = %s",
                (workflow_execution_id,)
            )
            await session.commit()
        
        try:
            # Execute workflow nodes in topological order
            execution_context = {
                'workflow_execution_id': workflow_execution_id,
                'variables': {},
                'metadata': {}
            }
            
            nodes = workflow_definition.get('nodes', [])
            edges = workflow_definition.get('edges', [])
            
            # Build execution plan
            execution_plan = self._build_execution_plan(nodes, edges)
            
            # Execute nodes according to plan
            for node_batch in execution_plan:
                batch_tasks = []
                
                for node in node_batch:
                    # Create node execution record
                    node_execution_id = await self._create_node_execution(
                        workflow_execution_id, node, session
                    )
                    
                    # Queue node execution task
                    task = ExecuteNodeTask.delay(
                        node_execution_id=node_execution_id,
                        node_type=node['type'],
                        node_config=node['data'].get('config', {}),
                        input_data=execution_context['variables'],
                        context=execution_context
                    )
                    batch_tasks.append(task)
                
                # Wait for all nodes in batch to complete
                for task in batch_tasks:
                    task_result = task.get(timeout=settings.CELERY_TASK_TIMEOUT)
                    # Update execution context with node outputs
                    if task_result.get('output_data'):
                        execution_context['variables'].update(task_result['output_data'])
            
            # Update workflow execution status to completed
            await session.execute(
                "UPDATE workflow_executions SET status = 'completed', completed_at = NOW() WHERE id = %s",
                (workflow_execution_id,)
            )
            await session.commit()
            
            return {
                'status': 'completed',
                'execution_id': workflow_execution_id,
                'final_context': execution_context
            }
            
        except Exception as e:
            # Update execution status to failed
            await session.execute(
                "UPDATE workflow_executions SET status = 'failed', error_message = %s, completed_at = NOW() WHERE id = %s",
                (str(e), workflow_execution_id)
            )
            await session.commit()
            raise
    
    def _build_execution_plan(self, nodes: List[Dict], edges: List[Dict]) -> List[List[Dict]]:
        """Build topologically sorted execution plan"""
        # Simple implementation - in production, use proper topological sort
        trigger_nodes = [n for n in nodes if n['type'] in ['webhook_trigger', 'form_trigger']]
        other_nodes = [n for n in nodes if n['type'] not in ['webhook_trigger', 'form_trigger']]
        
        # Return simple sequential plan for now
        plan = []
        if trigger_nodes:
            plan.append(trigger_nodes)
        if other_nodes:
            # Group by levels for parallel execution
            plan.append(other_nodes)
        
        return plan
    
    async def _create_node_execution(self, workflow_execution_id: str, 
                                   node: Dict[str, Any], session) -> str:
        """Create node execution record"""
        node_execution_id = str(uuid.uuid4())
        
        await session.execute(
            """INSERT INTO node_executions (id, workflow_execution_id, node_id, node_type, status)
               VALUES (%s, %s, %s, %s, 'pending')""",
            (node_execution_id, workflow_execution_id, node['id'], node['type'])
        )
        await session.commit()
        
        return node_execution_id

# Placeholder classes for referenced services
class FormProcessor:
    """Form submission processor"""
    
    async def process_submission(self, form_submission_id: str) -> Dict[str, Any]:
        """Process form submission and trigger workflows"""
        # Implementation would handle form processing logic
        return {'processed': True, 'submission_id': form_submission_id}

class IntegrationManager:
    """Integration synchronization manager"""
    
    async def sync_data(self, integration_id: str, sync_type: str, 
                       data: Dict[str, Any]) -> Dict[str, Any]:
        """Sync data with external integration"""
        # Implementation would handle integration sync logic
        return {'synced': True, 'integration_id': integration_id}

# Task routing and monitoring
def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get task execution status"""
    task_result = celery_app.AsyncResult(task_id)
    return {
        'id': task_id,
        'status': task_result.status,
        'result': task_result.result,
        'traceback': task_result.traceback
    }

def cancel_task(task_id: str) -> bool:
    """Cancel a running task"""
    celery_app.control.revoke(task_id, terminate=True)
    return True

# Health check
@celery_app.task(queue='monitoring')
def health_check():
    """Worker health check task"""
    return {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'worker_id': celery_app.control.inspect().active()
    }

if __name__ == '__main__':
    celery_app.start()