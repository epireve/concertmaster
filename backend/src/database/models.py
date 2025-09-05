"""
ConcertMaster SQLAlchemy Models
Database models for the workflow orchestration platform
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, DECIMAL, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY, INET
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List

Base = declarative_base()

class BaseModel(Base):
    """Base model with common fields"""
    __abstract__ = True
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class User(BaseModel):
    """User model for authentication and authorization"""
    __tablename__ = "users"
    
    email = Column(String(255), nullable=False, unique=True)
    username = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    last_login_at = Column(DateTime(timezone=True))
    metadata = Column(JSONB, default={})
    
    # Relationships
    organizations = relationship("UserOrganization", back_populates="user")
    workflows = relationship("Workflow", back_populates="created_by_user")
    forms = relationship("Form", back_populates="created_by_user")
    integrations = relationship("Integration", back_populates="created_by_user")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"
    
    @property
    def full_name(self) -> str:
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username

class Organization(BaseModel):
    """Organization model for multi-tenancy"""
    __tablename__ = "organizations"
    
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    settings = Column(JSONB, default={})
    
    # Relationships
    users = relationship("UserOrganization", back_populates="organization")
    workflows = relationship("Workflow", back_populates="organization")
    forms = relationship("Form", back_populates="organization")
    integrations = relationship("Integration", back_populates="organization")
    
    def __repr__(self):
        return f"<Organization(id={self.id}, name={self.name})>"

class UserOrganization(BaseModel):
    """Many-to-many relationship between users and organizations"""
    __tablename__ = "user_organizations"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="member")
    permissions = Column(JSONB, default=[])
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="organizations")
    organization = relationship("Organization", back_populates="users")
    
    __table_args__ = (
        CheckConstraint("role IN ('owner', 'admin', 'member', 'viewer')", name="check_role"),
    )

class Workflow(BaseModel):
    """Workflow model for visual workflow definitions"""
    __tablename__ = "workflows"
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    version = Column(Integer, default=1)
    status = Column(String(20), default="draft")
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    definition = Column(JSONB, nullable=False)  # React Flow nodes and edges
    settings = Column(JSONB, default={})
    tags = Column(ARRAY(String), default=[])
    is_template = Column(Boolean, default=False)
    execution_count = Column(Integer, default=0)
    success_rate = Column(DECIMAL(5, 2), default=0.00)
    avg_execution_time = Column(Integer, default=0)  # milliseconds
    published_at = Column(DateTime(timezone=True))
    
    # Relationships
    organization = relationship("Organization", back_populates="workflows")
    created_by_user = relationship("User", back_populates="workflows")
    executions = relationship("WorkflowExecution", back_populates="workflow")
    webhooks = relationship("Webhook", back_populates="workflow")
    
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'active', 'inactive', 'archived')", name="check_workflow_status"),
    )
    
    def __repr__(self):
        return f"<Workflow(id={self.id}, name={self.name}, status={self.status})>"

class WorkflowNodeType(BaseModel):
    """Node type definitions for the plugin system"""
    __tablename__ = "workflow_node_types"
    
    name = Column(String(100), nullable=False, unique=True)
    category = Column(String(50), nullable=False)  # trigger, transform, action, condition
    display_name = Column(String(255), nullable=False)
    description = Column(Text)
    icon = Column(String(100))
    color = Column(String(7))  # hex color
    schema = Column(JSONB, nullable=False)  # JSON schema for configuration
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    plugin_id = Column(UUID(as_uuid=True))  # reference to plugin system
    
    __table_args__ = (
        CheckConstraint("category IN ('trigger', 'transform', 'action', 'condition')", name="check_node_category"),
    )
    
    def __repr__(self):
        return f"<WorkflowNodeType(name={self.name}, category={self.category})>"

class Form(BaseModel):
    """Form model for the form builder"""
    __tablename__ = "forms"
    
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    schema = Column(JSONB, nullable=False)  # form schema with fields, validation
    settings = Column(JSONB, default={})  # styling, behavior settings
    status = Column(String(20), default="draft")
    is_public = Column(Boolean, default=False)
    submission_count = Column(Integer, default=0)
    published_at = Column(DateTime(timezone=True))
    
    # Relationships
    organization = relationship("Organization", back_populates="forms")
    created_by_user = relationship("User", back_populates="forms")
    submissions = relationship("FormSubmission", back_populates="form")
    
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'active', 'inactive', 'archived')", name="check_form_status"),
    )
    
    def __repr__(self):
        return f"<Form(id={self.id}, name={self.name}, status={self.status})>"

class FormSubmission(BaseModel):
    """Form submission model"""
    __tablename__ = "form_submissions"
    
    form_id = Column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="SET NULL"))
    data = Column(JSONB, nullable=False)
    metadata = Column(JSONB, default={})  # IP, user agent, etc.
    status = Column(String(20), default="received")
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    # Relationships
    form = relationship("Form", back_populates="submissions")
    workflow = relationship("Workflow")
    submitted_by_user = relationship("User")
    
    __table_args__ = (
        CheckConstraint("status IN ('received', 'processing', 'completed', 'failed')", name="check_submission_status"),
    )

class WorkflowExecution(BaseModel):
    """Workflow execution tracking"""
    __tablename__ = "workflow_executions"
    
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    trigger_type = Column(String(50), nullable=False)
    trigger_data = Column(JSONB, default={})
    status = Column(String(20), default="pending")
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    execution_time = Column(Integer)  # milliseconds
    error_message = Column(Text)
    context = Column(JSONB, default={})  # execution context and variables
    triggered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    priority = Column(Integer, default=5)
    
    # Relationships
    workflow = relationship("Workflow", back_populates="executions")
    triggered_by_user = relationship("User")
    node_executions = relationship("NodeExecution", back_populates="workflow_execution")
    
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'running', 'completed', 'failed', 'cancelled')", name="check_execution_status"),
        CheckConstraint("priority BETWEEN 1 AND 10", name="check_priority_range"),
    )
    
    def __repr__(self):
        return f"<WorkflowExecution(id={self.id}, workflow_id={self.workflow_id}, status={self.status})>"

class NodeExecution(BaseModel):
    """Individual node execution within workflow"""
    __tablename__ = "node_executions"
    
    workflow_execution_id = Column(UUID(as_uuid=True), ForeignKey("workflow_executions.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(String(255), nullable=False)  # node ID from workflow definition
    node_type = Column(String(100), nullable=False)
    status = Column(String(20), default="pending")
    input_data = Column(JSONB, default={})
    output_data = Column(JSONB, default={})
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    execution_time = Column(Integer)  # milliseconds
    retry_count = Column(Integer, default=0)
    metadata = Column(JSONB, default={})
    
    # Relationships
    workflow_execution = relationship("WorkflowExecution", back_populates="node_executions")
    
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'running', 'completed', 'failed', 'skipped')", name="check_node_execution_status"),
    )

class Integration(BaseModel):
    """Integration and connection management"""
    __tablename__ = "integrations"
    
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)  # webhook, email, database, api, etc.
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    configuration = Column(JSONB, nullable=False)  # encrypted configuration
    credentials = Column(JSONB, default={})  # encrypted credentials
    status = Column(String(20), default="active")
    last_used_at = Column(DateTime(timezone=True))
    usage_count = Column(Integer, default=0)
    
    # Relationships
    organization = relationship("Organization", back_populates="integrations")
    created_by_user = relationship("User", back_populates="integrations")
    
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive', 'error')", name="check_integration_status"),
    )

class Webhook(BaseModel):
    """Webhook management for workflow triggers"""
    __tablename__ = "webhooks"
    
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    url_path = Column(String(255), nullable=False, unique=True)  # unique webhook URL path
    secret_key = Column(String(255))
    is_active = Column(Boolean, default=True)
    request_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime(timezone=True))
    
    # Relationships
    workflow = relationship("Workflow", back_populates="webhooks")

class AuditLog(Base):
    """Audit trail for tracking changes"""
    __tablename__ = "audit_log"
    __table_args__ = {"schema": "audit"}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_name = Column(String(100), nullable=False)
    record_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(20), nullable=False)
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(INET)
    user_agent = Column(Text)
    
    # Relationships
    changed_by_user = relationship("User")
    
    __table_args__ = (
        CheckConstraint("action IN ('INSERT', 'UPDATE', 'DELETE')", name="check_audit_action"),
        {"schema": "audit"}
    )

class PerformanceMetric(BaseModel):
    """Performance tracking and metrics"""
    __tablename__ = "performance_metrics"
    
    metric_type = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)  # workflow, form, integration
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(DECIMAL(15, 6), nullable=False)
    unit = Column(String(20))
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    metadata = Column(JSONB, default={})