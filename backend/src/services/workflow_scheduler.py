"""
ConcertMaster Workflow Scheduler
Celery-based scheduling for trigger nodes and recurring workflows
"""

from typing import Dict, Any, List, Optional, Union
from uuid import UUID
import logging
from datetime import datetime, timedelta
from croniter import croniter
import json

from celery import Celery
from celery.schedules import crontab
from redis import Redis

from ..config import settings, CeleryConfig

logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery("concertmaster-scheduler")
celery_app.config_from_object(CeleryConfig)

class WorkflowScheduler:
    """
    Manages scheduling of workflow executions based on trigger nodes
    
    Features:
    - Cron-based scheduling for ScheduleTrigger nodes
    - Dynamic schedule updates
    - Schedule persistence in Redis
    - Integration with Celery Beat
    """
    
    def __init__(self):
        self.redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.schedule_prefix = "scheduler:workflow:"
        
        logger.info("WorkflowScheduler initialized")
    
    async def schedule_workflow(
        self,
        workflow_id: UUID,
        workflow_definition: Dict[str, Any]
    ):
        """
        Schedule workflow based on trigger nodes in definition
        
        Args:
            workflow_id: Workflow ID to schedule
            workflow_definition: Workflow definition containing nodes and edges
        """
        
        workflow_id_str = str(workflow_id)
        
        # Find schedule trigger nodes
        schedule_triggers = self._find_schedule_triggers(workflow_definition)
        
        if not schedule_triggers:
            logger.debug(f"No schedule triggers found for workflow: {workflow_id}")
            return
        
        # Create schedules for each trigger
        for trigger in schedule_triggers:
            await self._create_schedule(workflow_id_str, trigger)
        
        logger.info(f"Scheduled workflow {workflow_id} with {len(schedule_triggers)} triggers")
    
    async def reschedule_workflow(
        self,
        workflow_id: UUID,
        workflow_definition: Dict[str, Any]
    ):
        """
        Update workflow schedule when definition changes
        
        Args:
            workflow_id: Workflow ID to reschedule
            workflow_definition: Updated workflow definition
        """
        
        # Remove existing schedules
        await self.unschedule_workflow(workflow_id)
        
        # Create new schedules
        await self.schedule_workflow(workflow_id, workflow_definition)
        
        logger.info(f"Rescheduled workflow: {workflow_id}")
    
    async def unschedule_workflow(self, workflow_id: UUID):
        """
        Remove all schedules for a workflow
        
        Args:
            workflow_id: Workflow ID to unschedule
        """
        
        workflow_id_str = str(workflow_id)
        
        # Find existing schedules
        pattern = f"{self.schedule_prefix}{workflow_id_str}:*"
        schedule_keys = self.redis_client.keys(pattern)
        
        # Remove from Redis
        if schedule_keys:
            self.redis_client.delete(*schedule_keys)
        
        # Remove from Celery Beat (would require celery beat restart or dynamic update)
        # For now, we mark them as inactive in Redis
        
        logger.info(f"Unscheduled workflow: {workflow_id}")
    
    async def _create_schedule(
        self,
        workflow_id: str,
        trigger: Dict[str, Any]
    ):
        """Create a schedule entry for a trigger node"""
        
        trigger_id = trigger['id']
        trigger_config = trigger.get('config', {})
        
        # Parse cron expression
        cron_expr = trigger_config.get('cron') or trigger_config.get('cron_expression')
        if not cron_expr:
            logger.warning(f"No cron expression found for trigger: {trigger_id}")
            return
        
        # Validate cron expression
        try:
            croniter(cron_expr)
        except Exception as e:
            logger.error(f"Invalid cron expression '{cron_expr}' for trigger {trigger_id}: {str(e)}")
            return
        
        # Create schedule entry
        schedule_key = f"{self.schedule_prefix}{workflow_id}:{trigger_id}"
        schedule_data = {
            "workflow_id": workflow_id,
            "trigger_id": trigger_id,
            "cron_expression": cron_expr,
            "timezone": trigger_config.get('timezone', 'UTC'),
            "enabled": True,
            "created_at": datetime.utcnow().isoformat(),
            "last_run": None,
            "next_run": None,
            "run_count": 0
        }
        
        # Calculate next run time
        cron = croniter(cron_expr, datetime.utcnow())
        schedule_data["next_run"] = cron.get_next(datetime).isoformat()
        
        # Store in Redis
        self.redis_client.setex(
            schedule_key,
            timedelta(days=365).total_seconds(),  # Keep for 1 year
            json.dumps(schedule_data)
        )
        
        logger.info(f"Created schedule for workflow {workflow_id}, trigger {trigger_id}: {cron_expr}")
    
    def _find_schedule_triggers(self, workflow_definition: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Find all ScheduleTrigger nodes in workflow definition"""
        
        nodes = workflow_definition.get('nodes', [])
        schedule_triggers = []
        
        for node in nodes:
            if node.get('type') == 'ScheduleTrigger':
                schedule_triggers.append(node)
        
        return schedule_triggers
    
    async def get_workflow_schedules(self, workflow_id: UUID) -> List[Dict[str, Any]]:
        """
        Get all schedules for a workflow
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            List of schedule information
        """
        
        workflow_id_str = str(workflow_id)
        pattern = f"{self.schedule_prefix}{workflow_id_str}:*"
        schedule_keys = self.redis_client.keys(pattern)
        
        schedules = []
        for key in schedule_keys:
            schedule_data = self.redis_client.get(key)
            if schedule_data:
                try:
                    schedules.append(json.loads(schedule_data))
                except json.JSONDecodeError:
                    logger.error(f"Failed to decode schedule data for key: {key}")
        
        return schedules
    
    async def get_all_active_schedules(self) -> List[Dict[str, Any]]:
        """Get all active workflow schedules"""
        
        pattern = f"{self.schedule_prefix}*"
        schedule_keys = self.redis_client.keys(pattern)
        
        active_schedules = []
        for key in schedule_keys:
            schedule_data = self.redis_client.get(key)
            if schedule_data:
                try:
                    schedule = json.loads(schedule_data)
                    if schedule.get('enabled', False):
                        active_schedules.append(schedule)
                except json.JSONDecodeError:
                    continue
        
        return active_schedules
    
    async def update_schedule_status(
        self,
        workflow_id: UUID,
        trigger_id: str,
        last_run: datetime,
        success: bool
    ):
        """
        Update schedule status after execution
        
        Args:
            workflow_id: Workflow ID
            trigger_id: Trigger node ID
            last_run: Last execution time
            success: Whether execution was successful
        """
        
        workflow_id_str = str(workflow_id)
        schedule_key = f"{self.schedule_prefix}{workflow_id_str}:{trigger_id}"
        
        schedule_data = self.redis_client.get(schedule_key)
        if not schedule_data:
            return
        
        try:
            schedule = json.loads(schedule_data)
            
            # Update run information
            schedule["last_run"] = last_run.isoformat()
            schedule["run_count"] = schedule.get("run_count", 0) + 1
            
            # Calculate next run
            cron = croniter(schedule["cron_expression"], last_run)
            schedule["next_run"] = cron.get_next(datetime).isoformat()
            
            # Update success/failure tracking
            if "success_count" not in schedule:
                schedule["success_count"] = 0
                schedule["failure_count"] = 0
            
            if success:
                schedule["success_count"] += 1
            else:
                schedule["failure_count"] += 1
                
            # Store updated schedule
            self.redis_client.setex(
                schedule_key,
                timedelta(days=365).total_seconds(),
                json.dumps(schedule)
            )
            
        except json.JSONDecodeError:
            logger.error(f"Failed to update schedule for key: {schedule_key}")
    
    async def enable_schedule(self, workflow_id: UUID, trigger_id: str):
        """Enable a specific schedule"""
        await self._toggle_schedule(workflow_id, trigger_id, True)
    
    async def disable_schedule(self, workflow_id: UUID, trigger_id: str):
        """Disable a specific schedule"""
        await self._toggle_schedule(workflow_id, trigger_id, False)
    
    async def _toggle_schedule(self, workflow_id: UUID, trigger_id: str, enabled: bool):
        """Toggle schedule enabled status"""
        
        workflow_id_str = str(workflow_id)
        schedule_key = f"{self.schedule_prefix}{workflow_id_str}:{trigger_id}"
        
        schedule_data = self.redis_client.get(schedule_key)
        if not schedule_data:
            logger.warning(f"Schedule not found: {schedule_key}")
            return
        
        try:
            schedule = json.loads(schedule_data)
            schedule["enabled"] = enabled
            
            self.redis_client.setex(
                schedule_key,
                timedelta(days=365).total_seconds(),
                json.dumps(schedule)
            )
            
            action = "enabled" if enabled else "disabled"
            logger.info(f"Schedule {action}: {workflow_id}:{trigger_id}")
            
        except json.JSONDecodeError:
            logger.error(f"Failed to toggle schedule for key: {schedule_key}")
    
    async def cleanup_expired_schedules(self, max_age_days: int = 90):
        """Clean up old/expired schedules"""
        
        cutoff_date = datetime.utcnow() - timedelta(days=max_age_days)
        
        pattern = f"{self.schedule_prefix}*"
        schedule_keys = self.redis_client.keys(pattern)
        
        removed_count = 0
        for key in schedule_keys:
            schedule_data = self.redis_client.get(key)
            if schedule_data:
                try:
                    schedule = json.loads(schedule_data)
                    created_at_str = schedule.get("created_at")
                    
                    if created_at_str:
                        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                        if created_at < cutoff_date and not schedule.get("enabled", False):
                            self.redis_client.delete(key)
                            removed_count += 1
                except (json.JSONDecodeError, ValueError):
                    # Remove corrupted entries
                    self.redis_client.delete(key)
                    removed_count += 1
        
        logger.info(f"Cleaned up {removed_count} expired schedules")
    
    async def get_schedule_stats(self) -> Dict[str, Any]:
        """Get scheduling statistics"""
        
        pattern = f"{self.schedule_prefix}*"
        schedule_keys = self.redis_client.keys(pattern)
        
        total_schedules = len(schedule_keys)
        enabled_schedules = 0
        total_runs = 0
        total_successes = 0
        total_failures = 0
        
        for key in schedule_keys:
            schedule_data = self.redis_client.get(key)
            if schedule_data:
                try:
                    schedule = json.loads(schedule_data)
                    
                    if schedule.get("enabled", False):
                        enabled_schedules += 1
                    
                    total_runs += schedule.get("run_count", 0)
                    total_successes += schedule.get("success_count", 0)
                    total_failures += schedule.get("failure_count", 0)
                    
                except json.JSONDecodeError:
                    continue
        
        return {
            "total_schedules": total_schedules,
            "enabled_schedules": enabled_schedules,
            "disabled_schedules": total_schedules - enabled_schedules,
            "total_runs": total_runs,
            "total_successes": total_successes,
            "total_failures": total_failures,
            "success_rate": total_successes / total_runs if total_runs > 0 else 0.0
        }


# Celery tasks for scheduled workflow execution
@celery_app.task(bind=True, name="execute_scheduled_workflow")
def execute_scheduled_workflow(self, workflow_id: str, trigger_id: str, trigger_data: Dict[str, Any] = None):
    """
    Celery task to execute a scheduled workflow
    
    Args:
        workflow_id: Workflow ID to execute
        trigger_id: Trigger node ID that initiated the execution
        trigger_data: Additional trigger data
    """
    
    logger.info(f"Executing scheduled workflow: {workflow_id}, trigger: {trigger_id}")
    
    try:
        # Import here to avoid circular imports
        from .workflow_engine import WorkflowEngine
        
        # Create workflow engine instance
        engine = WorkflowEngine()
        
        # Prepare trigger data
        if trigger_data is None:
            trigger_data = {}
        
        trigger_data.update({
            "trigger_type": "schedule",
            "trigger_id": trigger_id,
            "scheduled_at": datetime.utcnow().isoformat()
        })
        
        # Execute workflow (this would be async in real implementation)
        # For now, we'll use asyncio to run the async function
        import asyncio
        
        async def run_workflow():
            workflow_run = await engine.execute_workflow(
                UUID(workflow_id),
                trigger_data=trigger_data
            )
            return workflow_run
        
        # Run the async workflow execution
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            workflow_run = loop.run_until_complete(run_workflow())
            logger.info(f"Scheduled workflow execution started: {workflow_run.id}")
            return str(workflow_run.id)
        finally:
            loop.close()
        
    except Exception as e:
        logger.error(f"Failed to execute scheduled workflow {workflow_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=3)


@celery_app.task(name="cleanup_scheduler_data")
def cleanup_scheduler_data():
    """Periodic task to clean up expired scheduler data"""
    
    try:
        scheduler = WorkflowScheduler()
        
        # Run cleanup asynchronously
        import asyncio
        
        async def run_cleanup():
            await scheduler.cleanup_expired_schedules()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_cleanup())
            logger.info("Scheduler cleanup completed")
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Failed to cleanup scheduler data: {str(e)}")


# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    'cleanup-scheduler-data': {
        'task': 'cleanup_scheduler_data',
        'schedule': crontab(hour=2, minute=0),  # Run daily at 2:00 AM
    },
}

celery_app.conf.timezone = 'UTC'