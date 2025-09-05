"""
ConcertMaster Workflow Database Models
SQLAlchemy models for workflow-related entities
"""

from sqlalchemy import (
    Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import uuid

Base = declarative_base()

class Workflow(Base):
    """
    Workflow definition and metadata
    
    Stores the workflow template, configuration, and metadata
    """
    __tablename__ = "workflows"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Basic info
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    
    # Workflow definition (nodes, edges, configuration)
    definition = Column(JSONB, nullable=False)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Status flags
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_template = Column(Boolean, default=False, nullable=False, index=True)
    
    # Version info
    version = Column(String(50), default="1.0.0")
    
    # Tags and categories for organization
    tags = Column(JSONB, default=list)
    category = Column(String(100), index=True)
    
    # Relationships
    workflow_runs = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_workflows_created_by_active', 'created_by', 'is_active'),
        Index('ix_workflows_category_active', 'category', 'is_active'),
        Index('ix_workflows_updated_at_desc', 'updated_at'),
    )
    
    def __repr__(self):
        return f"<Workflow(id={self.id}, name='{self.name}', active={self.is_active})>"


class WorkflowRun(Base):
    """
    Workflow execution instance
    
    Tracks individual workflow executions with status and results
    """
    __tablename__ = "workflow_runs"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key to workflow
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False, index=True)
    
    # Execution status
    status = Column(String(50), nullable=False, default="pending", index=True)
    # Status values: pending, running, completed, failed, paused, cancelled
    
    # Execution data
    trigger_data = Column(JSONB, default=dict)  # Data that triggered the workflow
    context_data = Column(JSONB, default=dict)  # Additional context and variables
    result_data = Column(JSONB, default=dict)   # Final workflow results
    error = Column(JSONB)  # Error information if failed
    
    # Timing
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True))
    
    # Execution metadata
    created_by = Column(UUID(as_uuid=True), index=True)  # User who triggered execution
    execution_mode = Column(String(50), default="normal")  # normal, test, debug
    priority = Column(Integer, default=5, index=True)  # 1-10, higher = more priority
    
    # Resource tracking
    execution_time_seconds = Column(Integer)  # Total execution time
    estimated_cost = Column(Integer)  # Cost in credits or similar units
    
    # Relationships
    workflow = relationship("Workflow", back_populates="workflow_runs")
    node_executions = relationship("NodeExecution", back_populates="workflow_run", cascade="all, delete-orphan")
    workflow_state = relationship("WorkflowState", back_populates="workflow_run", uselist=False)
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_workflow_runs_workflow_status', 'workflow_id', 'status'),
        Index('ix_workflow_runs_started_at_desc', 'started_at'),
        Index('ix_workflow_runs_status_priority', 'status', 'priority'),
    )
    
    def __repr__(self):
        return f"<WorkflowRun(id={self.id}, workflow_id={self.workflow_id}, status='{self.status}')>"


class NodeExecution(Base):
    """
    Individual node execution within a workflow run
    
    Tracks execution of each node with inputs, outputs, and timing
    """
    __tablename__ = "node_executions"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key to workflow run
    workflow_run_id = Column(UUID(as_uuid=True), ForeignKey("workflow_runs.id"), nullable=False, index=True)
    
    # Node identification
    node_id = Column(String(100), nullable=False, index=True)  # Node ID from workflow definition
    node_type = Column(String(100), nullable=False, index=True)  # Node type (e.g., "ScheduleTrigger")
    
    # Execution status
    status = Column(String(50), nullable=False, default="pending", index=True)
    # Status values: pending, running, completed, failed, skipped, cancelled
    
    # Node data
    input_data = Column(JSONB, default=dict)   # Input data for the node
    output_data = Column(JSONB, default=dict)  # Output data from the node
    config_data = Column(JSONB, default=dict)  # Node configuration at execution time
    error = Column(JSONB)  # Error information if failed
    
    # Timing
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True))
    
    # Execution metadata
    execution_order = Column(Integer, index=True)  # Order of execution in workflow
    retry_count = Column(Integer, default=0)  # Number of retries attempted
    
    # Resource tracking
    execution_time_ms = Column(Integer)  # Execution time in milliseconds
    memory_used_mb = Column(Integer)     # Peak memory usage
    
    # Relationships
    workflow_run = relationship("WorkflowRun", back_populates="node_executions")
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_node_executions_workflow_run_node', 'workflow_run_id', 'node_id'),
        Index('ix_node_executions_status_type', 'status', 'node_type'),
        Index('ix_node_executions_started_at', 'started_at'),
    )
    
    def __repr__(self):
        return f"<NodeExecution(id={self.id}, node_id='{self.node_id}', status='{self.status}')>"


class WorkflowState(Base):
    """
    Workflow execution state storage
    
    Stores workflow-level state and variables during execution
    """
    __tablename__ = "workflow_states"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key to workflow run
    workflow_run_id = Column(UUID(as_uuid=True), ForeignKey("workflow_runs.id"), nullable=False, unique=True, index=True)
    
    # State data
    state_data = Column(JSONB, nullable=False, default=dict)  # Complete workflow state
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    workflow_run = relationship("WorkflowRun", back_populates="workflow_state")
    
    def __repr__(self):
        return f"<WorkflowState(id={self.id}, workflow_run_id={self.workflow_run_id})>"


class NodeState(Base):
    """
    Node-specific state storage
    
    Stores node-level state data during execution
    """
    __tablename__ = "node_states"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign keys
    workflow_run_id = Column(UUID(as_uuid=True), ForeignKey("workflow_runs.id"), nullable=False, index=True)
    node_id = Column(String(100), nullable=False, index=True)
    
    # State information
    state_type = Column(String(50), nullable=False, index=True)  # input, output, intermediate, config
    state_data = Column(JSONB, nullable=False, default=dict)
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_node_states_workflow_node_type', 'workflow_run_id', 'node_id', 'state_type'),
    )
    
    def __repr__(self):
        return f"<NodeState(id={self.id}, node_id='{self.node_id}', type='{self.state_type}')>"


class FormSchema(Base):
    """
    Form schema definitions for form-based data collection
    
    Defines form structure, fields, and validation rules
    """
    __tablename__ = "form_schemas"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Basic info
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    
    # Schema version
    version = Column(String(50), nullable=False, default="1.0.0")
    
    # Form definition
    fields = Column(JSONB, nullable=False, default=list)  # Field definitions
    validation_rules = Column(JSONB, default=dict)        # Validation configuration
    ui_schema = Column(JSONB, default=dict)               # UI rendering configuration
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Relationships
    form_responses = relationship("FormResponse", back_populates="form_schema", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_form_schemas_name_version', 'name', 'version'),
        Index('ix_form_schemas_created_by_active', 'created_by', 'is_active'),
    )
    
    def __repr__(self):
        return f"<FormSchema(id={self.id}, name='{self.name}', version='{self.version}')>"


class FormResponse(Base):
    """
    Form response data
    
    Stores submitted form responses with metadata
    """
    __tablename__ = "form_responses"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign keys
    form_schema_id = Column(UUID(as_uuid=True), ForeignKey("form_schemas.id"), nullable=False, index=True)
    workflow_run_id = Column(UUID(as_uuid=True), ForeignKey("workflow_runs.id"), index=True)  # Optional link to workflow
    
    # Response data
    data = Column(JSONB, nullable=False, default=dict)  # Form field values
    metadata = Column(JSONB, default=dict)              # Submission metadata (IP, user agent, etc.)
    
    # Validation status
    is_valid = Column(Boolean, index=True)
    validation_errors = Column(JSONB, default=list)
    
    # Submission info
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    submitted_by = Column(UUID(as_uuid=True), index=True)  # Optional user ID
    
    # Review status
    review_status = Column(String(50), default="pending", index=True)
    # Status values: pending, approved, rejected, requires_changes
    reviewed_by = Column(UUID(as_uuid=True), index=True)
    reviewed_at = Column(DateTime(timezone=True))
    review_notes = Column(Text)
    
    # Relationships
    form_schema = relationship("FormSchema", back_populates="form_responses")
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_form_responses_schema_submitted', 'form_schema_id', 'submitted_at'),
        Index('ix_form_responses_review_status', 'review_status', 'submitted_at'),
        Index('ix_form_responses_workflow_run', 'workflow_run_id'),
    )
    
    def __repr__(self):
        return f"<FormResponse(id={self.id}, form_schema_id={self.form_schema_id}, status='{self.review_status}')>"


class WorkflowTemplate(Base):
    """
    Workflow templates for quick workflow creation
    
    Pre-defined workflow configurations that can be instantiated
    """
    __tablename__ = "workflow_templates"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Template info
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    category = Column(String(100), index=True)
    
    # Template definition
    template_definition = Column(JSONB, nullable=False)  # Workflow template structure
    default_config = Column(JSONB, default=dict)         # Default configuration values
    
    # Template metadata
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Status and visibility
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    
    # Usage tracking
    usage_count = Column(Integer, default=0, nullable=False)
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_workflow_templates_category_public', 'category', 'is_public'),
        Index('ix_workflow_templates_usage_count', 'usage_count'),
    )
    
    def __repr__(self):
        return f"<WorkflowTemplate(id={self.id}, name='{self.name}', category='{self.category}')>"


class Integration(Base):
    """
    External system integrations
    
    Configuration for connecting to external systems (ERP, CRM, etc.)
    """
    __tablename__ = "integrations"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Integration info
    name = Column(String(255), nullable=False, index=True)
    integration_type = Column(String(100), nullable=False, index=True)  # sap, salesforce, api, database
    description = Column(Text)
    
    # Configuration
    config = Column(JSONB, nullable=False, default=dict)  # Integration-specific configuration
    credentials = Column(JSONB, default=dict)             # Encrypted credentials
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    last_tested_at = Column(DateTime(timezone=True))
    test_status = Column(String(50), default="unknown")   # success, failed, unknown
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_integrations_type_active', 'integration_type', 'is_active'),
    )
    
    def __repr__(self):
        return f"<Integration(id={self.id}, name='{self.name}', type='{self.integration_type}')>"