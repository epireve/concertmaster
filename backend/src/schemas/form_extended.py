"""
Extended Form Schema Definitions
Additional Pydantic models for form system API responses and complex operations.
"""

from typing import Dict, Any, List, Optional, Union
from uuid import UUID
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, validator


class FormValidationResult(BaseModel):
    """Form validation result model"""
    is_valid: bool
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    

class FormSubmissionResult(BaseModel):
    """Form submission result model"""
    success: bool
    response_id: Optional[str] = None
    errors: Optional[List[Dict[str, str]]] = None
    message: Optional[str] = None
    

class FormAttachmentResponse(BaseModel):
    """Form attachment response model"""
    id: UUID
    form_response_id: Optional[UUID]
    field_id: str
    filename: str
    original_filename: str
    file_size: int
    content_type: str
    uploaded_at: datetime
    uploaded_by: Optional[UUID]
    is_processed: bool = False
    
    class Config:
        from_attributes = True


class FormAnalyticsResponse(BaseModel):
    """Form analytics response model"""
    form_schema_id: UUID
    total_responses: int
    response_rate: float
    average_completion_time: float
    field_analytics: List[Dict[str, Any]] = []
    created_at: datetime
    
    class Config:
        from_attributes = True


class FormTemplateResponse(BaseModel):
    """Form template response model"""
    id: UUID
    name: str
    display_name: str
    description: Optional[str]
    category: str
    tags: List[str] = []
    template_config: Dict[str, Any]
    default_settings: Dict[str, Any] = {}
    usage_count: int = 0
    rating: float = 0.0
    is_active: bool = True
    is_featured: bool = False
    is_public: bool = True
    created_by: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class FormIntegrationResponse(BaseModel):
    """Form integration response model"""
    id: UUID
    form_id: UUID
    type: str
    config: Dict[str, Any]
    enabled: bool = True
    created_at: datetime
    
    class Config:
        from_attributes = True


# Enums for form system
class FormFieldType(str, Enum):
    """Form field types"""
    TEXT = "text"
    TEXTAREA = "textarea"
    EMAIL = "email"
    NUMBER = "number"
    INTEGER = "integer"
    FLOAT = "float"
    SELECT = "select"
    MULTISELECT = "multiselect"
    RADIO = "radio"
    CHECKBOX = "checkbox"
    DATE = "date"
    DATETIME = "datetime"
    FILE = "file"
    URL = "url"
    PHONE = "phone"
    CURRENCY = "currency"
    RATING = "rating"
    MATRIX = "matrix"
    SIGNATURE = "signature"
    LOCATION = "location"


class ProcessingStatus(str, Enum):
    """Form processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRY = "retry"


class ResponseStatus(str, Enum):
    """Form response status"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PROCESSED = "processed"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    REJECTED = "rejected"


# Complex request/response models
class BulkFormResponseCreate(BaseModel):
    """Bulk form response creation"""
    form_schema_id: UUID
    responses: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    validate_all: bool = True
    stop_on_error: bool = False
    

class BulkFormResponseResult(BaseModel):
    """Bulk form response result"""
    total_submitted: int
    successful_responses: List[str] = []
    failed_responses: List[Dict[str, Any]] = []
    validation_errors: List[Dict[str, Any]] = []
    processing_time_seconds: float
    

class FormExportRequest(BaseModel):
    """Form export request"""
    form_schema_id: UUID
    export_format: str = Field(..., regex="^(csv|json|xlsx|xml)$")
    date_range: Optional[Dict[str, datetime]] = None
    include_metadata: bool = True
    filter_conditions: Optional[Dict[str, Any]] = None
    

class FormExportResult(BaseModel):
    """Form export result"""
    export_id: UUID
    download_url: str
    file_size: int
    record_count: int
    export_format: str
    expires_at: datetime
    created_at: datetime
    

class FormImportRequest(BaseModel):
    """Form import request"""
    form_schema_id: UUID
    import_format: str = Field(..., regex="^(csv|json|xlsx)$")
    file_content: str  # Base64 encoded file content
    mapping_config: Optional[Dict[str, str]] = None  # Field mapping
    validation_mode: str = Field("strict", regex="^(strict|lenient|skip)$")
    

class FormImportResult(BaseModel):
    """Form import result"""
    import_id: UUID
    total_records: int
    imported_records: int
    failed_records: int
    validation_errors: List[Dict[str, Any]] = []
    processing_time_seconds: float
    

class FormSearchRequest(BaseModel):
    """Form search request"""
    query: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    sort_by: Optional[str] = None
    sort_order: str = Field("desc", regex="^(asc|desc)$")
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=100)
    include_responses: bool = False
    

class FormSearchResult(BaseModel):
    """Form search result"""
    forms: List[Dict[str, Any]]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool
    

class FormResponseSearchRequest(BaseModel):
    """Form response search request"""
    form_schema_id: UUID
    query: Optional[str] = None
    field_filters: Optional[Dict[str, Any]] = None
    date_range: Optional[Dict[str, datetime]] = None
    status_filter: Optional[List[ResponseStatus]] = None
    sort_by: Optional[str] = None
    sort_order: str = Field("desc", regex="^(asc|desc)$")
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=100)
    

class FormResponseSearchResult(BaseModel):
    """Form response search result"""
    responses: List[Dict[str, Any]]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    facets: Optional[Dict[str, Any]] = None  # Aggregated statistics
    

class FormWebhookDelivery(BaseModel):
    """Webhook delivery status"""
    webhook_id: str
    delivery_id: UUID
    url: str
    status: str
    attempts: int
    last_attempt_at: Optional[datetime]
    next_retry_at: Optional[datetime]
    response_status: Optional[int]
    error_message: Optional[str]
    

class FormNotificationStatus(BaseModel):
    """Notification delivery status"""
    notification_id: UUID
    type: str  # email, webhook, slack
    recipient: str
    status: str  # sent, failed, pending
    sent_at: Optional[datetime]
    error_message: Optional[str]
    

class FormProcessingReport(BaseModel):
    """Form processing comprehensive report"""
    response_id: UUID
    form_schema_id: UUID
    processing_status: ProcessingStatus
    started_at: datetime
    completed_at: Optional[datetime]
    processing_time_seconds: Optional[float]
    
    # Processing results
    validation_passed: bool
    notifications_sent: int
    webhooks_delivered: int
    workflows_triggered: int
    
    # Detailed results
    validation_errors: List[Dict[str, Any]] = []
    notification_statuses: List[FormNotificationStatus] = []
    webhook_deliveries: List[FormWebhookDelivery] = []
    workflow_executions: List[Dict[str, Any]] = []
    
    error_details: Optional[str] = None
    

class FormSystemHealthCheck(BaseModel):
    """Form system health check result"""
    status: str  # healthy, degraded, unhealthy
    timestamp: datetime
    version: str
    
    # Component health
    database_status: str
    redis_status: str
    email_status: str
    file_storage_status: str
    
    # Metrics
    total_forms: int
    total_responses: int
    active_processing_jobs: int
    pending_notifications: int
    failed_webhooks: int
    
    # Performance metrics
    average_response_time_ms: float
    error_rate_percentage: float
    uptime_seconds: int
    

class FormQuotaStatus(BaseModel):
    """Form system quota/usage status"""
    user_id: Optional[UUID] = None
    organization_id: Optional[UUID] = None
    
    # Current usage
    forms_created: int
    responses_received: int
    storage_used_bytes: int
    bandwidth_used_bytes: int
    
    # Quota limits
    max_forms: int
    max_responses_per_month: int
    max_storage_bytes: int
    max_bandwidth_per_month: int
    
    # Status
    forms_quota_percentage: float
    responses_quota_percentage: float
    storage_quota_percentage: float
    bandwidth_quota_percentage: float
    
    quota_exceeded: bool
    warnings: List[str] = []