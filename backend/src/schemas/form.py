"""
Form Schema Definitions
Pydantic models for form-related API requests and responses.
"""

from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class FormSchemaCreate(BaseModel):
    """Schema for creating a new form schema"""
    
    name: str = Field(..., min_length=1, max_length=255)
    version: Optional[str] = Field("1.0.0", max_length=50)
    fields: List[Dict[str, Any]] = Field(..., min_items=1)
    validation_rules: Optional[Dict[str, Any]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    class Config:
        schema_extra = {
            "example": {
                "name": "Customer Feedback Form",
                "version": "1.0.0",
                "fields": [
                    {
                        "id": "name",
                        "type": "text",
                        "label": "Full Name",
                        "required": True
                    },
                    {
                        "id": "email",
                        "type": "email", 
                        "label": "Email Address",
                        "required": True
                    },
                    {
                        "id": "rating",
                        "type": "number",
                        "label": "Rating (1-5)",
                        "required": True,
                        "min": 1,
                        "max": 5
                    },
                    {
                        "id": "comments",
                        "type": "textarea",
                        "label": "Comments",
                        "required": False
                    }
                ],
                "validation_rules": {
                    "name": {
                        "min_length": 2,
                        "max_length": 100
                    },
                    "comments": {
                        "max_length": 1000
                    }
                },
                "metadata": {
                    "description": "Collect customer feedback and ratings",
                    "category": "feedback"
                }
            }
        }


class FormSchemaUpdate(BaseModel):
    """Schema for updating an existing form schema"""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    fields: Optional[List[Dict[str, Any]]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class FormSchemaResponse(BaseModel):
    """Schema for form schema responses"""
    
    id: UUID
    name: str
    version: str
    fields: List[Dict[str, Any]]
    validation_rules: Dict[str, Any]
    metadata: Dict[str, Any]
    created_by: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Customer Feedback Form",
                "version": "1.0.0",
                "fields": [
                    {
                        "id": "name",
                        "type": "text",
                        "label": "Full Name",
                        "required": True
                    }
                ],
                "validation_rules": {},
                "metadata": {},
                "created_by": "123e4567-e89b-12d3-a456-426614174001",
                "created_at": "2025-01-05T04:30:00Z",
                "updated_at": None
            }
        }


class FormResponseCreate(BaseModel):
    """Schema for creating a form response"""
    
    data: Dict[str, Any] = Field(..., description="Form field data")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    workflow_run_id: Optional[UUID] = None
    
    class Config:
        schema_extra = {
            "example": {
                "data": {
                    "name": "John Doe",
                    "email": "john@example.com",
                    "rating": 5,
                    "comments": "Great service!"
                },
                "metadata": {
                    "source": "web_form",
                    "user_agent": "Mozilla/5.0...",
                    "ip_address": "192.168.1.1"
                }
            }
        }


class FormResponseResponse(BaseModel):
    """Schema for form response responses"""
    
    id: UUID
    form_schema_id: UUID
    data: Dict[str, Any]
    metadata: Dict[str, Any]
    workflow_run_id: Optional[UUID] = None
    submitted_at: datetime
    
    class Config:
        from_attributes = True