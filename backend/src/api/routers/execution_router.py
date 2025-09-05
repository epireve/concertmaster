"""
Execution Router - REST API endpoints for workflow execution management
Handles workflow runs, execution monitoring, and result retrieval.
"""

import logging
from typing import Dict, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.connection import get_db_session
from ...models.workflow import WorkflowRun, NodeExecution, ExecutionStatus
from ...services.workflow_engine import WorkflowEngine
from ...services.state_manager import StateManager
from ...services.worker_manager import WorkerManager, TaskPriority
from ...auth.security import get_current_user
from ...schemas.execution import ExecutionRequest, ExecutionResponse, ExecutionStatusResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize services
workflow_engine = None
state_manager = StateManager()
worker_manager = WorkerManager()


async def get_workflow_engine():
    """Get workflow engine instance"""
    global workflow_engine
    if not workflow_engine:
        from ...database.connection import db_manager
        workflow_engine = WorkflowEngine(db_manager, state_manager)
    return workflow_engine


@router.post("/", response_model=ExecutionResponse, status_code=status.HTTP_201_CREATED)
async def start_workflow_execution(
    execution_request: ExecutionRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Start workflow execution"""
    try:
        engine = await get_workflow_engine()
        
        # Start workflow execution
        workflow_run = await engine.execute_workflow(
            workflow_id=execution_request.workflow_id,
            trigger_data=execution_request.trigger_data or {},
            user_id=current_user.id
        )
        
        logger.info(f"Started workflow execution {workflow_run.id}")
        
        return ExecutionResponse(
            execution_id=workflow_run.id,
            workflow_id=workflow_run.workflow_id,
            status=workflow_run.status,
            started_at=workflow_run.started_at,
            started_by=workflow_run.started_by
        )
        
    except Exception as e:
        logger.error(f"Failed to start workflow execution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start workflow execution: {str(e)}"
        )


@router.get("/", response_model=List[ExecutionResponse])
async def list_workflow_executions(
    workflow_id: Optional[UUID] = Query(None),
    status_filter: Optional[ExecutionStatus] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List workflow executions with filtering"""
    try:
        from sqlalchemy import select
        
        # Build query
        query = select(WorkflowRun)
        
        # Add filters
        if workflow_id:
            query = query.where(WorkflowRun.workflow_id == workflow_id)
        
        if status_filter:
            query = query.where(WorkflowRun.status == status_filter)
        
        # Add pagination and ordering
        query = query.offset(skip).limit(limit)
        query = query.order_by(WorkflowRun.started_at.desc())
        
        # Execute query
        result = await db.execute(query)
        executions = result.scalars().all()
        
        return [
            ExecutionResponse(
                execution_id=execution.id,
                workflow_id=execution.workflow_id,
                status=execution.status,
                started_at=execution.started_at,
                completed_at=execution.completed_at,
                started_by=execution.started_by,
                error=execution.error
            )
            for execution in executions
        ]
        
    except Exception as e:
        logger.error(f"Failed to list workflow executions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list workflow executions"
        )


@router.get("/{execution_id}", response_model=ExecutionStatusResponse)
async def get_execution_status(
    execution_id: UUID,
    include_nodes: bool = Query(True),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get detailed execution status"""
    try:
        engine = await get_workflow_engine()
        
        # Get workflow status from engine
        status_data = await engine.get_workflow_status(execution_id)
        
        if not status_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution not found"
            )
        
        # Get additional details if requested
        node_executions = []
        if include_nodes:
            from sqlalchemy import select
            result = await db.execute(
                select(NodeExecution)
                .where(NodeExecution.workflow_run_id == execution_id)
                .order_by(NodeExecution.started_at)
            )
            nodes = result.scalars().all()
            
            node_executions = [
                {
                    "node_id": node.node_id,
                    "status": node.status,
                    "started_at": node.started_at,
                    "completed_at": node.completed_at,
                    "error": node.error,
                    "execution_time": (
                        (node.completed_at - node.started_at).total_seconds()
                        if node.completed_at and node.started_at
                        else None
                    )
                }
                for node in nodes
            ]
        
        return ExecutionStatusResponse(
            execution_id=execution_id,
            workflow_id=status_data["workflow_id"],
            status=status_data["status"],
            started_at=status_data["started_at"],
            completed_at=status_data["completed_at"],
            error=status_data["error"],
            node_executions=node_executions,
            progress={
                "completed_nodes": len([n for n in node_executions if n["status"] == ExecutionStatus.COMPLETED]),
                "total_nodes": len(node_executions),
                "current_node": next(
                    (n["node_id"] for n in node_executions if n["status"] == ExecutionStatus.RUNNING),
                    None
                )
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution status {execution_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get execution status"
        )


@router.post("/{execution_id}/stop", status_code=status.HTTP_200_OK)
async def stop_workflow_execution(
    execution_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Stop running workflow execution"""
    try:
        engine = await get_workflow_engine()
        
        # Stop the workflow
        success = await engine.stop_workflow(execution_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution not found or not running"
            )
        
        logger.info(f"Stopped workflow execution {execution_id}")
        
        return {"message": "Workflow execution stopped", "execution_id": str(execution_id)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stop workflow execution {execution_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop workflow execution"
        )


@router.get("/{execution_id}/logs")
async def get_execution_logs(
    execution_id: UUID,
    node_id: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    current_user = Depends(get_current_user)
):
    """Get execution logs"""
    try:
        # Get logs from state manager
        logs = []  # Placeholder - would implement log retrieval
        
        # Filter by node_id if specified
        if node_id:
            logs = [log for log in logs if log.get("node_id") == node_id]
        
        # Filter by log level if specified
        if level:
            logs = [log for log in logs if log.get("level") == level]
        
        # Apply limit
        logs = logs[:limit]
        
        return {
            "execution_id": str(execution_id),
            "logs": logs,
            "total": len(logs)
        }
        
    except Exception as e:
        logger.error(f"Failed to get execution logs {execution_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get execution logs"
        )


@router.get("/{execution_id}/state")
async def get_execution_state(
    execution_id: UUID,
    current_user = Depends(get_current_user)
):
    """Get workflow execution state and variables"""
    try:
        # Get state from state manager
        workflow_state = await state_manager.get_workflow_state(execution_id)
        
        if not workflow_state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution state not found"
            )
        
        return {
            "execution_id": str(execution_id),
            "state": workflow_state.get("variables", {}),
            "node_outputs": workflow_state.get("node_outputs", {}),
            "execution_path": workflow_state.get("execution_path", []),
            "status": workflow_state.get("status"),
            "updated_at": workflow_state.get("updated_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution state {execution_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get execution state"
        )


@router.post("/{execution_id}/retry", status_code=status.HTTP_201_CREATED)
async def retry_workflow_execution(
    execution_id: UUID,
    retry_from_node: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Retry failed workflow execution"""
    try:
        # Get original execution
        from sqlalchemy import select
        result = await db.execute(
            select(WorkflowRun).where(WorkflowRun.id == execution_id)
        )
        original_run = result.scalar_one_or_none()
        
        if not original_run:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Original execution not found"
            )
        
        if original_run.status not in [ExecutionStatus.FAILED, ExecutionStatus.CANCELLED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only retry failed or cancelled executions"
            )
        
        engine = await get_workflow_engine()
        
        # Start new execution with same parameters
        new_run = await engine.execute_workflow(
            workflow_id=original_run.workflow_id,
            trigger_data=original_run.trigger_data or {},
            user_id=current_user.id
        )
        
        logger.info(f"Retried workflow execution {execution_id} as {new_run.id}")
        
        return {
            "message": "Workflow execution retried",
            "original_execution_id": str(execution_id),
            "new_execution_id": str(new_run.id),
            "retry_from_node": retry_from_node
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retry workflow execution {execution_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry workflow execution"
        )


@router.get("/{execution_id}/metrics")
async def get_execution_metrics(
    execution_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get execution performance metrics"""
    try:
        from sqlalchemy import select, func
        
        # Get execution details
        execution_result = await db.execute(
            select(WorkflowRun).where(WorkflowRun.id == execution_id)
        )
        execution = execution_result.scalar_one_or_none()
        
        if not execution:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution not found"
            )
        
        # Get node execution metrics
        nodes_result = await db.execute(
            select(
                NodeExecution.node_id,
                NodeExecution.status,
                NodeExecution.started_at,
                NodeExecution.completed_at
            )
            .where(NodeExecution.workflow_run_id == execution_id)
            .order_by(NodeExecution.started_at)
        )
        nodes = nodes_result.all()
        
        # Calculate metrics
        total_duration = None
        if execution.started_at and execution.completed_at:
            total_duration = (execution.completed_at - execution.started_at).total_seconds()
        
        node_metrics = []
        for node in nodes:
            duration = None
            if node.started_at and node.completed_at:
                duration = (node.completed_at - node.started_at).total_seconds()
            
            node_metrics.append({
                "node_id": node.node_id,
                "status": node.status,
                "duration_seconds": duration,
                "started_at": node.started_at.isoformat() if node.started_at else None,
                "completed_at": node.completed_at.isoformat() if node.completed_at else None
            })
        
        # Summary statistics
        completed_nodes = [n for n in node_metrics if n["status"] == ExecutionStatus.COMPLETED]
        failed_nodes = [n for n in node_metrics if n["status"] == ExecutionStatus.FAILED]
        
        avg_node_duration = None
        if completed_nodes:
            durations = [n["duration_seconds"] for n in completed_nodes if n["duration_seconds"]]
            if durations:
                avg_node_duration = sum(durations) / len(durations)
        
        return {
            "execution_id": str(execution_id),
            "workflow_id": str(execution.workflow_id),
            "total_duration_seconds": total_duration,
            "status": execution.status,
            "node_count": len(node_metrics),
            "completed_nodes": len(completed_nodes),
            "failed_nodes": len(failed_nodes),
            "average_node_duration": avg_node_duration,
            "node_metrics": node_metrics,
            "started_at": execution.started_at.isoformat() if execution.started_at else None,
            "completed_at": execution.completed_at.isoformat() if execution.completed_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution metrics {execution_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get execution metrics"
        )


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def batch_execute_workflows(
    batch_request: List[ExecutionRequest],
    priority: TaskPriority = TaskPriority.NORMAL,
    current_user = Depends(get_current_user)
):
    """Execute multiple workflows in batch"""
    try:
        if len(batch_request) > 100:  # Limit batch size
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch size cannot exceed 100 workflows"
            )
        
        # Submit batch execution tasks
        task_ids = []
        for req in batch_request:
            task_id = await worker_manager.execute_workflow(
                workflow_id=req.workflow_id,
                trigger_data=req.trigger_data or {},
                user_id=current_user.id,
                priority=priority
            )
            task_ids.append(task_id)
        
        logger.info(f"Submitted batch execution of {len(batch_request)} workflows")
        
        return {
            "message": f"Batch execution of {len(batch_request)} workflows submitted",
            "task_ids": task_ids,
            "workflow_count": len(batch_request)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to batch execute workflows: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to batch execute workflows"
        )


async def get_active_count() -> int:
    """Get count of active executions (used by main.py)"""
    try:
        # This would query the database or state manager for active executions
        # For now, return 0 as placeholder
        return 0
    except Exception:
        return 0