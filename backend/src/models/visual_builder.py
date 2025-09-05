"""
ConcertMaster Visual Builder Database Models
SQLAlchemy models for visual builder components, templates, and projects
"""

from sqlalchemy import (
    Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from .workflow import Base


class VisualBuilderProject(Base):
    """
    Visual Builder project container
    
    Contains the complete visual builder project with components, layouts, and configuration
    """
    __tablename__ = "visual_builder_projects"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Project info
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    
    # Project configuration
    config = Column(JSONB, nullable=False, default=dict)  # Project-wide settings
    theme_config = Column(JSONB, default=dict)            # Theme and styling configuration
    
    # Framework configuration
    target_framework = Column(String(50), nullable=False, index=True)  # react, vue, angular, vanilla
    framework_version = Column(String(20))
    
    # Project structure
    project_structure = Column(JSONB, default=dict)  # Directory structure and file organization
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_template = Column(Boolean, default=False, nullable=False)
    
    # Version control
    version = Column(String(50), default="1.0.0")
    
    # Relationships
    components = relationship("VisualBuilderComponent", back_populates="project", cascade="all, delete-orphan")
    pages = relationship("VisualBuilderPage", back_populates="project", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_vb_projects_framework_active', 'target_framework', 'is_active'),
        Index('ix_vb_projects_created_by_active', 'created_by', 'is_active'),
    )
    
    def __repr__(self):
        return f"<VisualBuilderProject(id={self.id}, name='{self.name}', framework='{self.target_framework}')>"


class VisualBuilderPage(Base):
    """
    Visual Builder page definition
    
    Represents a single page/route in the visual builder project
    """
    __tablename__ = "visual_builder_pages"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key to project
    project_id = Column(UUID(as_uuid=True), ForeignKey("visual_builder_projects.id"), nullable=False, index=True)
    
    # Page info
    name = Column(String(255), nullable=False)
    title = Column(String(255))
    description = Column(Text)
    
    # Route configuration
    path = Column(String(500), nullable=False)  # URL path
    is_dynamic = Column(Boolean, default=False)  # Dynamic routes with parameters
    
    # Page layout and components
    layout_definition = Column(JSONB, nullable=False, default=dict)  # Page layout structure
    component_instances = Column(JSONB, default=list)  # Components used on this page
    
    # Page metadata
    meta_tags = Column(JSONB, default=dict)  # SEO and meta information
    access_control = Column(JSONB, default=dict)  # Page access permissions
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_home_page = Column(Boolean, default=False)
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    project = relationship("VisualBuilderProject", back_populates="pages")
    
    # Indexes
    __table_args__ = (
        Index('ix_vb_pages_project_path', 'project_id', 'path'),
        Index('ix_vb_pages_project_active', 'project_id', 'is_active'),
    )
    
    def __repr__(self):
        return f"<VisualBuilderPage(id={self.id}, name='{self.name}', path='{self.path}')>"


class VisualBuilderComponent(Base):
    """
    Visual Builder component definition
    
    Stores reusable UI components with their properties and configurations
    """
    __tablename__ = "visual_builder_components"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key to project (optional - can be global components)
    project_id = Column(UUID(as_uuid=True), ForeignKey("visual_builder_projects.id"), index=True)
    
    # Component identification
    name = Column(String(255), nullable=False, index=True)
    component_type = Column(String(100), nullable=False, index=True)  # button, form, card, etc.
    category = Column(String(100), index=True)  # layout, input, display, navigation
    
    # Component definition
    definition = Column(JSONB, nullable=False)  # Complete component structure
    props_schema = Column(JSONB, default=dict)  # Property definitions and validation
    default_props = Column(JSONB, default=dict)  # Default property values
    
    # Styling
    styles = Column(JSONB, default=dict)  # Component-specific styles
    css_classes = Column(JSONB, default=list)  # CSS class assignments
    
    # Behavior
    events = Column(JSONB, default=dict)  # Event handlers and interactions
    state_management = Column(JSONB, default=dict)  # State configuration
    
    # Framework-specific data
    framework_config = Column(JSONB, default=dict)  # Framework-specific configurations
    
    # Metadata
    description = Column(Text)
    tags = Column(JSONB, default=list)
    
    # Versioning and status
    version = Column(String(50), default="1.0.0")
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_global = Column(Boolean, default=False, index=True)  # Available across all projects
    
    # Creation info
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    
    # Relationships
    project = relationship("VisualBuilderProject", back_populates="components")
    
    # Indexes
    __table_args__ = (
        Index('ix_vb_components_type_category', 'component_type', 'category'),
        Index('ix_vb_components_project_active', 'project_id', 'is_active'),
        Index('ix_vb_components_global_active', 'is_global', 'is_active'),
    )
    
    def __repr__(self):
        return f"<VisualBuilderComponent(id={self.id}, name='{self.name}', type='{self.component_type}')>"


class ComponentTemplate(Base):
    """
    Predefined component templates
    
    Pre-built component configurations that can be instantiated in projects
    """
    __tablename__ = "component_templates"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Template info
    name = Column(String(255), nullable=False, index=True)
    display_name = Column(String(255))  # User-friendly name
    description = Column(Text)
    category = Column(String(100), index=True)
    
    # Template definition
    template_config = Column(JSONB, nullable=False)  # Complete template configuration
    supported_frameworks = Column(JSONB, default=list)  # Supported target frameworks
    
    # Customization options
    customizable_props = Column(JSONB, default=list)  # Properties that can be customized
    style_variants = Column(JSONB, default=list)  # Available style variations
    
    # Preview and documentation
    preview_config = Column(JSONB, default=dict)  # Preview configuration
    documentation = Column(JSONB, default=dict)  # Usage documentation
    
    # Status and metadata
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_premium = Column(Boolean, default=False, index=True)
    
    # Creation and versioning
    version = Column(String(50), default="1.0.0")
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    rating = Column(Integer, default=0)  # Average rating (0-5)
    
    # Indexes
    __table_args__ = (
        Index('ix_component_templates_category_active', 'category', 'is_active'),
        Index('ix_component_templates_usage_rating', 'usage_count', 'rating'),
    )
    
    def __repr__(self):
        return f"<ComponentTemplate(id={self.id}, name='{self.name}', category='{self.category}')>"


class ProjectExport(Base):
    """
    Visual Builder project export records
    
    Tracks project exports for version control and deployment
    """
    __tablename__ = "project_exports"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key to project
    project_id = Column(UUID(as_uuid=True), ForeignKey("visual_builder_projects.id"), nullable=False, index=True)
    
    # Export info
    export_type = Column(String(50), nullable=False, index=True)  # code, template, backup
    export_format = Column(String(50), nullable=False)  # zip, tar, json
    
    # Export configuration
    export_config = Column(JSONB, default=dict)  # Export settings and options
    included_components = Column(JSONB, default=list)  # Components included in export
    
    # Export data
    export_data = Column(JSONB)  # Actual exported data (for small exports)
    file_path = Column(String(500))  # Path to export file (for large exports)
    file_size = Column(Integer)  # Export file size in bytes
    
    # Status
    status = Column(String(50), default="pending", index=True)  # pending, completed, failed
    error_message = Column(Text)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    project = relationship("VisualBuilderProject")
    
    # Indexes
    __table_args__ = (
        Index('ix_project_exports_project_status', 'project_id', 'status'),
        Index('ix_project_exports_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f"<ProjectExport(id={self.id}, project_id={self.project_id}, type='{self.export_type}')>"


class CodeGenerationJob(Base):
    """
    Code generation job tracking
    
    Tracks code generation requests and their status
    """
    __tablename__ = "code_generation_jobs"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key to project
    project_id = Column(UUID(as_uuid=True), ForeignKey("visual_builder_projects.id"), nullable=False, index=True)
    
    # Job configuration
    generation_type = Column(String(50), nullable=False, index=True)  # component, page, project
    target_framework = Column(String(50), nullable=False)
    generation_config = Column(JSONB, default=dict)
    
    # Job status
    status = Column(String(50), default="pending", index=True)  # pending, running, completed, failed
    progress_percentage = Column(Integer, default=0)
    
    # Results
    generated_files = Column(JSONB, default=list)  # List of generated files
    generation_log = Column(JSONB, default=list)  # Generation process log
    error_details = Column(JSONB)  # Error information if failed
    
    # Timing
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    estimated_duration = Column(Integer)  # Estimated duration in seconds
    
    # Relationships
    project = relationship("VisualBuilderProject")
    
    # Indexes
    __table_args__ = (
        Index('ix_code_gen_jobs_project_status', 'project_id', 'status'),
        Index('ix_code_gen_jobs_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f"<CodeGenerationJob(id={self.id}, type='{self.generation_type}', status='{self.status}')>"