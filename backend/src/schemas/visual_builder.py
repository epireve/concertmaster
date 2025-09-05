"""
Visual Builder API Schemas
Pydantic models for request/response validation
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from uuid import UUID
from enum import Enum


class FrameworkType(str, Enum):
    """Supported frontend frameworks"""
    REACT = "react"
    VUE = "vue"
    ANGULAR = "angular"
    VANILLA = "vanilla"


class ComponentCategory(str, Enum):
    """Component categories"""
    LAYOUT = "layout"
    INPUT = "input"
    DISPLAY = "display"
    NAVIGATION = "navigation"
    FEEDBACK = "feedback"
    DATA = "data"
    MEDIA = "media"


class ExportType(str, Enum):
    """Project export types"""
    CODE = "code"
    TEMPLATE = "template"
    BACKUP = "backup"


class JobStatus(str, Enum):
    """Job status values"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# Base schemas
class TimestampMixin(BaseModel):
    """Mixin for timestamp fields"""
    created_at: datetime
    updated_at: datetime


class UserMixin(BaseModel):
    """Mixin for user tracking fields"""
    created_by: UUID


# Project schemas
class VisualBuilderProjectBase(BaseModel):
    """Base project data"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    target_framework: FrameworkType
    framework_version: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    theme_config: Dict[str, Any] = Field(default_factory=dict)
    project_structure: Dict[str, Any] = Field(default_factory=dict)
    is_template: bool = False
    version: str = "1.0.0"


class VisualBuilderProjectCreate(VisualBuilderProjectBase):
    """Schema for creating a new project"""
    pass


class VisualBuilderProjectUpdate(BaseModel):
    """Schema for updating a project"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    theme_config: Optional[Dict[str, Any]] = None
    project_structure: Optional[Dict[str, Any]] = None
    version: Optional[str] = None


class VisualBuilderProjectResponse(VisualBuilderProjectBase, TimestampMixin, UserMixin):
    """Schema for project responses"""
    id: UUID
    is_active: bool
    
    class Config:
        from_attributes = True


# Page schemas
class VisualBuilderPageBase(BaseModel):
    """Base page data"""
    name: str = Field(..., min_length=1, max_length=255)
    title: Optional[str] = None
    description: Optional[str] = None
    path: str = Field(..., min_length=1, max_length=500)
    is_dynamic: bool = False
    layout_definition: Dict[str, Any] = Field(default_factory=dict)
    component_instances: List[Dict[str, Any]] = Field(default_factory=list)
    meta_tags: Dict[str, Any] = Field(default_factory=dict)
    access_control: Dict[str, Any] = Field(default_factory=dict)
    is_home_page: bool = False


class VisualBuilderPageCreate(VisualBuilderPageBase):
    """Schema for creating a new page"""
    project_id: UUID


class VisualBuilderPageUpdate(BaseModel):
    """Schema for updating a page"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    title: Optional[str] = None
    description: Optional[str] = None
    path: Optional[str] = Field(None, min_length=1, max_length=500)
    is_dynamic: Optional[bool] = None
    layout_definition: Optional[Dict[str, Any]] = None
    component_instances: Optional[List[Dict[str, Any]]] = None
    meta_tags: Optional[Dict[str, Any]] = None
    access_control: Optional[Dict[str, Any]] = None
    is_home_page: Optional[bool] = None


class VisualBuilderPageResponse(VisualBuilderPageBase, TimestampMixin):
    """Schema for page responses"""
    id: UUID
    project_id: UUID
    is_active: bool
    
    class Config:
        from_attributes = True


# Component schemas
class VisualBuilderComponentBase(BaseModel):
    """Base component data"""
    name: str = Field(..., min_length=1, max_length=255)
    component_type: str = Field(..., min_length=1, max_length=100)
    category: Optional[ComponentCategory] = None
    definition: Dict[str, Any] = Field(..., min_items=1)
    props_schema: Dict[str, Any] = Field(default_factory=dict)
    default_props: Dict[str, Any] = Field(default_factory=dict)
    styles: Dict[str, Any] = Field(default_factory=dict)
    css_classes: List[str] = Field(default_factory=list)
    events: Dict[str, Any] = Field(default_factory=dict)
    state_management: Dict[str, Any] = Field(default_factory=dict)
    framework_config: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    version: str = "1.0.0"
    is_global: bool = False


class VisualBuilderComponentCreate(VisualBuilderComponentBase):
    """Schema for creating a new component"""
    project_id: Optional[UUID] = None


class VisualBuilderComponentUpdate(BaseModel):
    """Schema for updating a component"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    component_type: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[ComponentCategory] = None
    definition: Optional[Dict[str, Any]] = None
    props_schema: Optional[Dict[str, Any]] = None
    default_props: Optional[Dict[str, Any]] = None
    styles: Optional[Dict[str, Any]] = None
    css_classes: Optional[List[str]] = None
    events: Optional[Dict[str, Any]] = None
    state_management: Optional[Dict[str, Any]] = None
    framework_config: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    version: Optional[str] = None


class VisualBuilderComponentResponse(VisualBuilderComponentBase, TimestampMixin, UserMixin):
    """Schema for component responses"""
    id: UUID
    project_id: Optional[UUID]
    is_active: bool
    usage_count: int
    
    class Config:
        from_attributes = True


# Template schemas
class ComponentTemplateBase(BaseModel):
    """Base template data"""
    name: str = Field(..., min_length=1, max_length=255)
    display_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ComponentCategory] = None
    template_config: Dict[str, Any] = Field(..., min_items=1)
    supported_frameworks: List[FrameworkType] = Field(default_factory=list)
    customizable_props: List[str] = Field(default_factory=list)
    style_variants: List[Dict[str, Any]] = Field(default_factory=list)
    preview_config: Dict[str, Any] = Field(default_factory=dict)
    documentation: Dict[str, Any] = Field(default_factory=dict)
    is_premium: bool = False
    version: str = "1.0.0"


class ComponentTemplateCreate(ComponentTemplateBase):
    """Schema for creating a new template"""
    pass


class ComponentTemplateUpdate(BaseModel):
    """Schema for updating a template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    display_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ComponentCategory] = None
    template_config: Optional[Dict[str, Any]] = None
    supported_frameworks: Optional[List[FrameworkType]] = None
    customizable_props: Optional[List[str]] = None
    style_variants: Optional[List[Dict[str, Any]]] = None
    preview_config: Optional[Dict[str, Any]] = None
    documentation: Optional[Dict[str, Any]] = None
    version: Optional[str] = None


class ComponentTemplateResponse(ComponentTemplateBase, TimestampMixin, UserMixin):
    """Schema for template responses"""
    id: UUID
    is_active: bool
    usage_count: int
    rating: int
    
    class Config:
        from_attributes = True


# Export schemas
class ProjectExportRequest(BaseModel):
    """Schema for project export requests"""
    export_type: ExportType
    export_format: str = Field(..., regex="^(zip|tar|json)$")
    export_config: Dict[str, Any] = Field(default_factory=dict)
    included_components: List[UUID] = Field(default_factory=list)


class ProjectExportResponse(BaseModel):
    """Schema for export responses"""
    id: UUID
    project_id: UUID
    export_type: ExportType
    export_format: str
    status: JobStatus
    file_path: Optional[str]
    file_size: Optional[int]
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Code generation schemas
class CodeGenerationRequest(BaseModel):
    """Schema for code generation requests"""
    generation_type: str = Field(..., regex="^(component|page|project)$")
    target_framework: FrameworkType
    generation_config: Dict[str, Any] = Field(default_factory=dict)


class CodeGenerationResponse(BaseModel):
    """Schema for code generation responses"""
    id: UUID
    project_id: UUID
    generation_type: str
    target_framework: FrameworkType
    status: JobStatus
    progress_percentage: int
    generated_files: List[Dict[str, Any]]
    generation_log: List[Dict[str, Any]]
    error_details: Optional[Dict[str, Any]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


# List response schemas
class ProjectListResponse(BaseModel):
    """Schema for project list responses"""
    projects: List[VisualBuilderProjectResponse]
    total: int
    offset: int
    limit: int


class ComponentListResponse(BaseModel):
    """Schema for component list responses"""
    components: List[VisualBuilderComponentResponse]
    total: int
    offset: int
    limit: int


class TemplateListResponse(BaseModel):
    """Schema for template list responses"""
    templates: List[ComponentTemplateResponse]
    total: int
    offset: int
    limit: int


# Validation schemas
class ComponentValidationRequest(BaseModel):
    """Schema for component validation requests"""
    component_type: str
    definition: Dict[str, Any]
    target_framework: FrameworkType
    validate_props: bool = True
    validate_events: bool = True


class ComponentValidationResponse(BaseModel):
    """Schema for component validation responses"""
    is_valid: bool
    errors: List[Dict[str, str]] = Field(default_factory=list)
    warnings: List[Dict[str, str]] = Field(default_factory=list)
    suggestions: List[Dict[str, str]] = Field(default_factory=list)


# Search and filter schemas
class ProjectFilters(BaseModel):
    """Schema for project search filters"""
    target_framework: Optional[FrameworkType] = None
    is_template: Optional[bool] = None
    created_by: Optional[UUID] = None
    search_query: Optional[str] = None


class ComponentFilters(BaseModel):
    """Schema for component search filters"""
    component_type: Optional[str] = None
    category: Optional[ComponentCategory] = None
    is_global: Optional[bool] = None
    project_id: Optional[UUID] = None
    search_query: Optional[str] = None


class TemplateFilters(BaseModel):
    """Schema for template search filters"""
    category: Optional[ComponentCategory] = None
    supported_framework: Optional[FrameworkType] = None
    is_premium: Optional[bool] = None
    search_query: Optional[str] = None


# Import schemas
class ProjectImportRequest(BaseModel):
    """Schema for project import requests"""
    import_data: Dict[str, Any]
    import_config: Dict[str, Any] = Field(default_factory=dict)
    overwrite_existing: bool = False


class ProjectImportResponse(BaseModel):
    """Schema for project import responses"""
    success: bool
    project_id: Optional[UUID]
    imported_components: List[UUID] = Field(default_factory=list)
    imported_pages: List[UUID] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)