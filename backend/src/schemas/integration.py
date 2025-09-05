"""
Integration Schema Definitions
Pydantic models for integration API requests and responses.
"""

from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class IntegrationCreate(BaseModel):
    """Schema for creating a new integration"""
    
    name: str = Field(..., min_length=1, max_length=255)
    integration_type: str = Field(..., description="Type of integration (sap, api, database, webhook)")
    config: Dict[str, Any] = Field(..., description="Integration-specific configuration")
    credentials: Optional[Dict[str, Any]] = Field(None, description="Authentication credentials")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    class Config:
        schema_extra = {
            "example": {
                "name": "SAP Production System",
                "integration_type": "sap",
                "config": {
                    "host": "sap.example.com",
                    "system": "PRD",
                    "client": "100",
                    "language": "EN"
                },
                "credentials": {
                    "username": "sap_user",
                    "password": "secure_password"
                },
                "metadata": {
                    "description": "Production SAP system for financial data",
                    "environment": "production",
                    "contact": "sap-admin@example.com"
                }
            }
        }


class IntegrationUpdate(BaseModel):
    """Schema for updating an existing integration"""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    config: Optional[Dict[str, Any]] = None
    credentials: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class IntegrationResponse(BaseModel):
    """Schema for integration responses"""
    
    id: str
    name: str
    type: str = Field(alias="integration_type")
    config: Dict[str, Any]
    metadata: Dict[str, Any]
    created_by: str
    created_at: str  # Using string for now since we're using placeholders
    updated_at: Optional[str] = None
    status: str
    
    class Config:
        allow_population_by_field_name = True
        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "SAP Production System",
                "type": "sap",
                "config": {
                    "host": "sap.example.com",
                    "system": "PRD",
                    "client": "100"
                },
                "metadata": {
                    "description": "Production SAP system",
                    "environment": "production"
                },
                "created_by": "123e4567-e89b-12d3-a456-426614174001",
                "created_at": "2025-01-05T04:30:00Z",
                "updated_at": None,
                "status": "active"
            }
        }


class ConnectionTestResponse(BaseModel):
    """Schema for integration connection test responses"""
    
    integration_id: UUID
    success: bool
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    tested_at: str
    
    class Config:
        schema_extra = {
            "example": {
                "integration_id": "123e4567-e89b-12d3-a456-426614174000",
                "success": True,
                "message": "Connection test successful",
                "details": {
                    "server": "sap.example.com",
                    "system": "PRD",
                    "response_time_ms": 145,
                    "version": "7.5.2"
                },
                "tested_at": "2025-01-05T04:30:00Z"
            }
        }