"""
Execution Schema Definitions
Pydantic models for workflow execution API requests and responses.
"""

from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field
from ..models.workflow import ExecutionStatus


class ExecutionRequest(BaseModel):
    """Schema for workflow execution requests"""
    
    workflow_id: UUID = Field(..., description="ID of the workflow to execute")
    trigger_data: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Data to pass to the workflow trigger"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "workflow_id": "123e4567-e89b-12d3-a456-426614174000",
                "trigger_data": {
                    "source": "manual",
                    "user_input": "test data",
                    "parameters": {
                        "environment": "production"
                    }
                }
            }
        }


class ExecutionResponse(BaseModel):
    """Schema for workflow execution responses"""
    
    execution_id: UUID
    workflow_id: UUID
    status: ExecutionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    started_by: Optional[UUID] = None
    error: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "execution_id": "123e4567-e89b-12d3-a456-426614174001",
                "workflow_id": "123e4567-e89b-12d3-a456-426614174000", 
                "status": "RUNNING",
                "started_at": "2025-01-05T04:30:00Z",
                "completed_at": None,
                "started_by": "123e4567-e89b-12d3-a456-426614174002",
                "error": None
            }
        }


class NodeExecutionInfo(BaseModel):
    """Schema for node execution information"""
    
    node_id: str
    status: ExecutionStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None


class ExecutionProgress(BaseModel):
    """Schema for execution progress information"""
    
    completed_nodes: int = Field(ge=0)
    total_nodes: int = Field(ge=0)
    current_node: Optional[str] = None


class ExecutionStatusResponse(BaseModel):
    """Schema for detailed execution status responses"""
    
    execution_id: UUID
    workflow_id: UUID
    status: ExecutionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    node_executions: List[NodeExecutionInfo] = Field(default_factory=list)
    progress: ExecutionProgress
    
    class Config:
        schema_extra = {
            "example": {
                "execution_id": "123e4567-e89b-12d3-a456-426614174001",
                "workflow_id": "123e4567-e89b-12d3-a456-426614174000",
                "status": "RUNNING",
                "started_at": "2025-01-05T04:30:00Z",
                "completed_at": None,
                "error": None,
                "node_executions": [
                    {
                        "node_id": "trigger_1",
                        "status": "COMPLETED",
                        "started_at": "2025-01-05T04:30:00Z",
                        "completed_at": "2025-01-05T04:30:02Z",
                        "error": None,
                        "execution_time": 2.1
                    },
                    {
                        "node_id": "process_1", 
                        "status": "RUNNING",
                        "started_at": "2025-01-05T04:30:02Z",
                        "completed_at": None,
                        "error": None,
                        "execution_time": None
                    }
                ],
                "progress": {
                    "completed_nodes": 1,
                    "total_nodes": 3,
                    "current_node": "process_1"
                }
            }
        }