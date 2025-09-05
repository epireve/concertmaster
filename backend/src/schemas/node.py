"""
Node Schema Definitions
Pydantic models for workflow node API requests and responses.
"""

from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field


class NodeTypeResponse(BaseModel):
    """Schema for node type information responses"""
    
    type: str = Field(..., description="Unique node type identifier")
    category: str = Field(..., description="Node category (trigger, transform, logic, output)")
    description: str = Field(..., description="Human-readable description of the node")
    version: str = Field(..., description="Node implementation version")
    class_name: str = Field(..., description="Python class name for the node")
    
    class Config:
        schema_extra = {
            "example": {
                "type": "ScheduleTriggerNode",
                "category": "trigger",
                "description": "Trigger workflow execution on a schedule",
                "version": "1.0.0",
                "class_name": "ScheduleTriggerNode"
            }
        }


class NodeSchemaResponse(BaseModel):
    """Schema for node configuration schema responses"""
    
    node_type: str = Field(..., description="Node type identifier")
    schema: Dict[str, Any] = Field(..., description="JSON schema for node configuration")
    category: str = Field(..., description="Node category")
    description: str = Field(..., description="Node description")
    version: str = Field(..., description="Node version")
    
    class Config:
        schema_extra = {
            "example": {
                "node_type": "ScheduleTriggerNode",
                "schema": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "Unique node identifier"
                        },
                        "cron": {
                            "type": "string", 
                            "description": "Cron expression for schedule",
                            "pattern": "^[0-9\\*\\-\\,\\/\\s]+$"
                        },
                        "timezone": {
                            "type": "string",
                            "description": "Timezone for schedule",
                            "default": "UTC"
                        }
                    },
                    "required": ["id", "cron"]
                },
                "category": "trigger",
                "description": "Trigger workflow execution on a schedule",
                "version": "1.0.0"
            }
        }


class NodeValidationRequest(BaseModel):
    """Schema for node configuration validation requests"""
    
    node_type: str = Field(..., description="Node type to validate")
    config: Dict[str, Any] = Field(..., description="Node configuration to validate")
    
    class Config:
        schema_extra = {
            "example": {
                "node_type": "ScheduleTriggerNode",
                "config": {
                    "id": "daily_trigger",
                    "cron": "0 9 * * *",
                    "timezone": "America/New_York"
                }
            }
        }


class NodeValidationResponse(BaseModel):
    """Schema for node configuration validation responses"""
    
    node_type: str = Field(..., description="Node type that was validated")
    config: Dict[str, Any] = Field(..., description="Configuration that was validated")
    is_valid: bool = Field(..., description="Whether the configuration is valid")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    
    class Config:
        schema_extra = {
            "example": {
                "node_type": "ScheduleTriggerNode",
                "config": {
                    "id": "daily_trigger",
                    "cron": "0 9 * * *",
                    "timezone": "America/New_York"
                },
                "is_valid": True,
                "errors": [],
                "warnings": []
            }
        }


class NodeConfig(BaseModel):
    """Base schema for node configuration"""
    
    id: str = Field(..., description="Unique node identifier within workflow")
    
    class Config:
        extra = "allow"  # Allow additional fields for node-specific config


class NodeResult(BaseModel):
    """Schema for node execution results"""
    
    success: bool = Field(..., description="Whether node execution was successful")
    data: Optional[Dict[str, Any]] = Field(None, description="Output data from node")
    error: Optional[str] = Field(None, description="Error message if execution failed")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "processed_records": 150,
                    "output_file": "/tmp/processed_data.json",
                    "timestamp": "2025-01-05T04:30:00Z"
                },
                "error": None,
                "metadata": {
                    "execution_time_ms": 1247,
                    "memory_used_mb": 45.2
                }
            }
        }