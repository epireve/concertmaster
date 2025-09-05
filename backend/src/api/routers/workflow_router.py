"""
ConcertMaster Workflow API Router
REST endpoints for workflow management
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from ...database.connection import get_db_session
from ...database.models import Workflow, WorkflowExecution, User
from ...schemas.workflow_schemas import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse, 
    WorkflowExecutionResponse, WorkflowExecuteRequest
)
from ...services.workflow_service import WorkflowService
from ...services.celery_worker import ExecuteWorkflowTask
from ...auth.security import get_current_user

router = APIRouter()

@router.get("/", response_model=List[WorkflowResponse])
async def list_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    status: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """List workflows with filtering and pagination"""
    service = WorkflowService(db)
    workflows = await service.list_workflows(
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        status=status,
        tags=tags,
        search=search
    )
    return workflows

@router.post("/", response_model=WorkflowResponse)
async def create_workflow(
    workflow_data: WorkflowCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow"""
    service = WorkflowService(db)
    workflow = await service.create_workflow(workflow_data, current_user.id)
    return workflow

@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get workflow by ID"""
    service = WorkflowService(db)
    workflow = await service.get_workflow(workflow_id, current_user.id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: uuid.UUID,
    workflow_data: WorkflowUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Update workflow"""
    service = WorkflowService(db)
    workflow = await service.update_workflow(workflow_id, workflow_data, current_user.id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Delete workflow"""
    service = WorkflowService(db)
    success = await service.delete_workflow(workflow_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"message": "Workflow deleted successfully"}

@router.post("/{workflow_id}/execute", response_model=WorkflowExecutionResponse)
async def execute_workflow(
    workflow_id: uuid.UUID,
    execution_data: WorkflowExecuteRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Execute workflow"""
    service = WorkflowService(db)
    
    # Create execution record
    execution = await service.create_execution(
        workflow_id=workflow_id,
        trigger_type=execution_data.trigger_type,
        trigger_data=execution_data.trigger_data,
        user_id=current_user.id,
        priority=execution_data.priority
    )
    
    # Queue workflow execution
    task = ExecuteWorkflowTask.delay(str(execution.id))
    
    return WorkflowExecutionResponse(
        id=execution.id,
        workflow_id=workflow_id,
        status=execution.status,
        trigger_type=execution.trigger_type,
        started_at=execution.started_at,
        task_id=task.id
    )

@router.get("/{workflow_id}/executions", response_model=List[WorkflowExecutionResponse])
async def list_workflow_executions(
    workflow_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """List workflow executions"""
    service = WorkflowService(db)
    executions = await service.list_executions(
        workflow_id=workflow_id,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        status=status
    )
    return executions

@router.post("/{workflow_id}/duplicate", response_model=WorkflowResponse)
async def duplicate_workflow(
    workflow_id: uuid.UUID,
    name: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Duplicate an existing workflow"""
    service = WorkflowService(db)
    workflow = await service.duplicate_workflow(workflow_id, current_user.id, name)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.post("/{workflow_id}/publish")
async def publish_workflow(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Publish workflow (make it active)"""
    service = WorkflowService(db)
    success = await service.publish_workflow(workflow_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"message": "Workflow published successfully"}

@router.post("/{workflow_id}/unpublish")
async def unpublish_workflow(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Unpublish workflow (make it inactive)"""
    service = WorkflowService(db)
    success = await service.unpublish_workflow(workflow_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"message": "Workflow unpublished successfully"}

@router.get("/{workflow_id}/validate")
async def validate_workflow(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Validate workflow definition"""
    service = WorkflowService(db)
    validation_result = await service.validate_workflow(workflow_id, current_user.id)
    if validation_result is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return validation_result

@router.get("/{workflow_id}/metrics")
async def get_workflow_metrics(
    workflow_id: uuid.UUID,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get workflow performance metrics"""
    service = WorkflowService(db)
    metrics = await service.get_workflow_metrics(workflow_id, current_user.id, days)
    if not metrics:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return metrics

@router.post("/{workflow_id}/webhooks")
async def create_webhook(
    workflow_id: uuid.UUID,
    webhook_data: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Create webhook for workflow"""
    service = WorkflowService(db)
    webhook = await service.create_webhook(workflow_id, webhook_data, current_user.id)
    if not webhook:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return webhook

@router.get("/{workflow_id}/export")
async def export_workflow(
    workflow_id: uuid.UUID,
    format: str = Query("json", regex="^(json|yaml)$"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Export workflow definition"""
    service = WorkflowService(db)
    export_data = await service.export_workflow(workflow_id, current_user.id, format)
    if not export_data:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return export_data

@router.post("/import")
async def import_workflow(
    import_data: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Import workflow from definition"""
    service = WorkflowService(db)
    workflow = await service.import_workflow(import_data, current_user.id)
    return workflow