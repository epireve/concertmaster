"""
Form System Database Models
SQLAlchemy models for form schemas, responses, and attachments.
"""

import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, Float, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func

from .base import Base


class FormSchema(Base):
    """Form schema definition model"""
    
    __tablename__ = "form_schemas"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Basic information
    name = Column(String(255), nullable=False, index=True)
    version = Column(String(50), nullable=False, default="1.0.0")
    
    # Schema definition
    fields = Column(JSON, nullable=False)  # Field definitions
    validation_rules = Column(JSON, nullable=False, default=dict)  # Validation rules
    metadata = Column(JSON, nullable=False, default=dict)  # Additional metadata
    
    # Audit fields
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    is_published = Column(Boolean, nullable=False, default=False)
    
    # Statistics
    response_count = Column(Integer, nullable=False, default=0)
    
    # Relationships
    responses = relationship("FormResponse", back_populates="schema", cascade="all, delete-orphan")
    
    @validates('fields')
    def validate_fields(self, key, value):
        """Validate fields structure"""
        if not isinstance(value, list) or len(value) == 0:
            raise ValueError("Fields must be a non-empty list")
        
        # Validate each field has required properties
        for field in value:
            if not isinstance(field, dict):
                raise ValueError("Each field must be a dictionary")
            
            required_keys = {'id', 'type', 'label', 'required'}
            if not all(key in field for key in required_keys):
                raise ValueError(f"Field must have keys: {required_keys}")
        
        return value
    
    @validates('name')
    def validate_name(self, key, value):
        """Validate form name"""
        if not value or not value.strip():
            raise ValueError("Form name cannot be empty")
        if len(value.strip()) > 255:
            raise ValueError("Form name cannot exceed 255 characters")
        return value.strip()
    
    def __repr__(self):
        return f"<FormSchema(id='{self.id}', name='{self.name}', version='{self.version}')>"


class FormResponse(Base):
    """Form response model"""
    
    __tablename__ = "form_responses"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign keys
    form_schema_id = Column(UUID(as_uuid=True), ForeignKey("form_schemas.id"), nullable=False, index=True)
    workflow_run_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Optional workflow integration
    
    # Response data
    data = Column(JSON, nullable=False)  # Form field values
    metadata = Column(JSON, nullable=False, default=dict)  # Request metadata, IP, etc.
    
    # Status and processing
    status = Column(String(50), nullable=False, default="submitted")  # submitted, processed, failed
    processing_status = Column(String(50), nullable=True)  # additional processing status
    processing_error = Column(Text, nullable=True)  # processing error details
    
    # Timestamps
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # User information
    submitted_by = Column(UUID(as_uuid=True), nullable=True, index=True)  # User ID if authenticated
    
    # Data validation
    validation_errors = Column(JSON, nullable=True)  # Validation error details
    is_valid = Column(Boolean, nullable=False, default=True)
    
    # Response metrics
    completion_time_seconds = Column(Float, nullable=True)  # Time to complete form
    
    # Relationships
    schema = relationship("FormSchema", back_populates="responses")
    attachments = relationship("FormAttachment", back_populates="response", cascade="all, delete-orphan")
    
    @validates('data')
    def validate_data(self, key, value):
        """Validate response data structure"""
        if not isinstance(value, dict):
            raise ValueError("Response data must be a dictionary")
        return value
    
    @validates('status')
    def validate_status(self, key, value):
        """Validate response status"""
        allowed_statuses = ["submitted", "processed", "failed", "pending"]
        if value not in allowed_statuses:
            raise ValueError(f"Status must be one of: {allowed_statuses}")
        return value
    
    def __repr__(self):
        return f"<FormResponse(id='{self.id}', schema_id='{self.form_schema_id}', status='{self.status}')>"


class FormAttachment(Base):
    """Form attachment model for file uploads"""
    
    __tablename__ = "form_attachments"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign keys
    form_response_id = Column(UUID(as_uuid=True), ForeignKey("form_responses.id"), nullable=True, index=True)
    field_id = Column(String(255), nullable=False, index=True)  # Field ID from form schema
    
    # File information
    filename = Column(String(255), nullable=False)  # Generated filename
    original_filename = Column(String(255), nullable=False)  # User's original filename
    file_path = Column(String(500), nullable=False)  # File system path
    file_size = Column(Integer, nullable=False)  # File size in bytes
    content_type = Column(String(100), nullable=False)  # MIME type
    file_hash = Column(String(64), nullable=True)  # SHA-256 hash for deduplication
    
    # Upload metadata
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    uploaded_by = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Processing status
    is_processed = Column(Boolean, nullable=False, default=False)
    processing_error = Column(Text, nullable=True)
    
    # Security scanning
    is_scanned = Column(Boolean, nullable=False, default=False)
    scan_result = Column(String(50), nullable=True)  # clean, infected, suspicious
    scan_details = Column(JSON, nullable=True)
    
    # Relationships
    response = relationship("FormResponse", back_populates="attachments")
    
    @validates('filename', 'original_filename')
    def validate_filename(self, key, value):
        """Validate filename"""
        if not value or not value.strip():
            raise ValueError("Filename cannot be empty")
        if len(value) > 255:
            raise ValueError("Filename cannot exceed 255 characters")
        return value.strip()
    
    @validates('file_size')
    def validate_file_size(self, key, value):
        """Validate file size"""
        if value < 0:
            raise ValueError("File size cannot be negative")
        if value > 100 * 1024 * 1024:  # 100MB limit
            raise ValueError("File size cannot exceed 100MB")
        return value
    
    @validates('content_type')
    def validate_content_type(self, key, value):
        """Validate content type"""
        if not value or not value.strip():
            raise ValueError("Content type cannot be empty")
        return value.strip()
    
    def __repr__(self):
        return f"<FormAttachment(id='{self.id}', filename='{self.filename}', size={self.file_size})>"


class FormTemplate(Base):
    """Form template model for reusable form designs"""
    
    __tablename__ = "form_templates"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Template information
    name = Column(String(255), nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, index=True)
    tags = Column(JSON, nullable=False, default=list)
    
    # Template definition
    template_config = Column(JSON, nullable=False)  # Form schema template
    default_settings = Column(JSON, nullable=False, default=dict)  # Default form settings
    
    # Usage and popularity
    usage_count = Column(Integer, nullable=False, default=0)
    rating = Column(Float, nullable=False, default=0.0)  # Average rating
    rating_count = Column(Integer, nullable=False, default=0)
    
    # Template status
    is_active = Column(Boolean, nullable=False, default=True)
    is_featured = Column(Boolean, nullable=False, default=False)
    is_public = Column(Boolean, nullable=False, default=True)
    
    # Audit fields
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    
    @validates('name', 'display_name')
    def validate_names(self, key, value):
        """Validate template names"""
        if not value or not value.strip():
            raise ValueError(f"{key} cannot be empty")
        if len(value.strip()) > 255:
            raise ValueError(f"{key} cannot exceed 255 characters")
        return value.strip()
    
    @validates('rating')
    def validate_rating(self, key, value):
        """Validate rating value"""
        if value < 0.0 or value > 5.0:
            raise ValueError("Rating must be between 0.0 and 5.0")
        return value
    
    def __repr__(self):
        return f"<FormTemplate(id='{self.id}', name='{self.name}', category='{self.category}')>"


class FormAnalytics(Base):
    """Form analytics and metrics model"""
    
    __tablename__ = "form_analytics"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key
    form_schema_id = Column(UUID(as_uuid=True), ForeignKey("form_schemas.id"), nullable=False, index=True)
    
    # Analytics period
    period_start = Column(DateTime(timezone=True), nullable=False, index=True)
    period_end = Column(DateTime(timezone=True), nullable=False, index=True)
    period_type = Column(String(20), nullable=False)  # daily, weekly, monthly
    
    # Metrics
    total_views = Column(Integer, nullable=False, default=0)
    total_responses = Column(Integer, nullable=False, default=0)
    conversion_rate = Column(Float, nullable=False, default=0.0)
    abandonment_rate = Column(Float, nullable=False, default=0.0)
    
    # Performance metrics
    average_completion_time = Column(Float, nullable=False, default=0.0)  # seconds
    median_completion_time = Column(Float, nullable=False, default=0.0)  # seconds
    
    # Field-specific analytics
    field_analytics = Column(JSON, nullable=False, default=dict)
    
    # Device and location metrics
    device_breakdown = Column(JSON, nullable=False, default=dict)
    location_breakdown = Column(JSON, nullable=False, default=dict)
    
    # Error metrics
    validation_error_rate = Column(Float, nullable=False, default=0.0)
    common_errors = Column(JSON, nullable=False, default=list)
    
    # Timestamps
    generated_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    
    @validates('period_type')
    def validate_period_type(self, key, value):
        """Validate analytics period type"""
        allowed_types = ["hourly", "daily", "weekly", "monthly"]
        if value not in allowed_types:
            raise ValueError(f"Period type must be one of: {allowed_types}")
        return value
    
    @validates('conversion_rate', 'abandonment_rate')
    def validate_rates(self, key, value):
        """Validate rate percentages"""
        if value < 0.0 or value > 100.0:
            raise ValueError(f"{key} must be between 0.0 and 100.0")
        return value
    
    def __repr__(self):
        return f"<FormAnalytics(schema_id='{self.form_schema_id}', period='{self.period_type}')>"