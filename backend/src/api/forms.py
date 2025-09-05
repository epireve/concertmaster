"""
Form System API Endpoints
Comprehensive REST API for form operations including validation, submission, and management.
"""

import os
import uuid
import logging
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload

from ..database.connection import get_db_session
from ..models.forms import FormSchema, FormResponse, FormAttachment
from ..schemas.form import (
    FormSchemaCreate, FormSchemaUpdate, FormSchemaResponse,
    FormResponseCreate, FormResponseResponse, FormValidationError,
    FormSubmissionResult, FormAnalyticsResponse, FormAttachmentResponse
)
from ..services.form_validator import FormValidationService
from ..services.file_handler import FileUploadService
from ..services.form_processor import FormProcessingService
from ..middleware.rate_limiting import RateLimitingMiddleware
from ..auth.security import get_current_user, require_permissions
from ..config import settings

router = APIRouter(prefix="/api/v1/forms", tags=["forms"])
logger = logging.getLogger(__name__)

# Initialize services
validation_service = FormValidationService()
file_service = FileUploadService()
processing_service = FormProcessingService()


@router.post("/schemas", response_model=FormSchemaResponse, status_code=201)
async def create_form_schema(
    schema_data: FormSchemaCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Create a new form schema with comprehensive validation"""
    try:
        logger.info(f"Creating form schema: {schema_data.name}")
        
        # Validate form schema structure
        validation_result = await validation_service.validate_schema(schema_data.fields)
        if not validation_result.is_valid:
            raise HTTPException(
                status_code=422, 
                detail={
                    "error": "Schema validation failed",
                    "errors": validation_result.errors
                }
            )
        
        # Create form schema
        form_schema = FormSchema(
            id=uuid.uuid4(),
            name=schema_data.name,
            version=schema_data.version,
            fields=schema_data.fields,
            validation_rules=schema_data.validation_rules,
            metadata=schema_data.metadata,
            created_by=current_user.id,
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(form_schema)
        await db.commit()
        await db.refresh(form_schema)
        
        logger.info(f"✅ Form schema created: {form_schema.id}")
        return FormSchemaResponse.from_orm(form_schema)
        
    except Exception as e:
        logger.error(f"❌ Failed to create form schema: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/schemas", response_model=List[FormSchemaResponse])
async def list_form_schemas(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    created_by: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """List form schemas with filtering and pagination"""
    try:
        query = select(FormSchema)
        
        # Apply filters
        if search:
            query = query.where(or_(
                FormSchema.name.ilike(f"%{search}%"),
                FormSchema.metadata["description"].astext.ilike(f"%{search}%")
            ))
        
        if created_by:
            query = query.where(FormSchema.created_by == created_by)
        
        # Add pagination
        query = query.offset(offset).limit(limit).order_by(desc(FormSchema.created_at))
        
        result = await db.execute(query)
        schemas = result.scalars().all()
        
        return [FormSchemaResponse.from_orm(schema) for schema in schemas]
        
    except Exception as e:
        logger.error(f"❌ Failed to list form schemas: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/schemas/{schema_id}", response_model=FormSchemaResponse)
async def get_form_schema(
    schema_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Get a specific form schema by ID"""
    try:
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == schema_id)
        )
        schema = result.scalar_one_or_none()
        
        if not schema:
            raise HTTPException(status_code=404, detail="Form schema not found")
        
        return FormSchemaResponse.from_orm(schema)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get form schema: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/schemas/{schema_id}", response_model=FormSchemaResponse)
async def update_form_schema(
    schema_id: str,
    update_data: FormSchemaUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Update an existing form schema"""
    try:
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == schema_id)
        )
        schema = result.scalar_one_or_none()
        
        if not schema:
            raise HTTPException(status_code=404, detail="Form schema not found")
        
        # Check permissions
        if schema.created_by != current_user.id:
            await require_permissions(current_user, ["forms:edit_all"])
        
        # Validate updated fields if provided
        if update_data.fields:
            validation_result = await validation_service.validate_schema(update_data.fields)
            if not validation_result.is_valid:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "error": "Schema validation failed",
                        "errors": validation_result.errors
                    }
                )
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(schema, field, value)
        
        schema.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(schema)
        
        logger.info(f"✅ Form schema updated: {schema_id}")
        return FormSchemaResponse.from_orm(schema)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update form schema: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/schemas/{schema_id}", status_code=204)
async def delete_form_schema(
    schema_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Delete a form schema"""
    try:
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == schema_id)
        )
        schema = result.scalar_one_or_none()
        
        if not schema:
            raise HTTPException(status_code=404, detail="Form schema not found")
        
        # Check permissions
        if schema.created_by != current_user.id:
            await require_permissions(current_user, ["forms:delete_all"])
        
        await db.delete(schema)
        await db.commit()
        
        logger.info(f"✅ Form schema deleted: {schema_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete form schema: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/schemas/{schema_id}/validate", response_model=FormValidationResult)
async def validate_form_data(
    schema_id: str,
    form_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session)
):
    """Validate form data against schema"""
    try:
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == schema_id)
        )
        schema = result.scalar_one_or_none()
        
        if not schema:
            raise HTTPException(status_code=404, detail="Form schema not found")
        
        validation_result = await validation_service.validate_form_data(
            schema.fields,
            form_data,
            schema.validation_rules
        )
        
        return validation_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to validate form data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/schemas/{schema_id}/responses", response_model=FormResponseResponse, status_code=201)
async def submit_form_response(
    schema_id: str,
    response_data: FormResponseCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Submit a form response with comprehensive validation and processing"""
    try:
        logger.info(f"Submitting form response for schema: {schema_id}")
        
        # Get form schema
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == schema_id)
        )
        schema = result.scalar_one_or_none()
        
        if not schema:
            raise HTTPException(status_code=404, detail="Form schema not found")
        
        # Validate form data
        validation_result = await validation_service.validate_form_data(
            schema.fields,
            response_data.data,
            schema.validation_rules
        )
        
        if not validation_result.is_valid:
            return FormSubmissionResult(
                success=False,
                errors=validation_result.errors,
                message="Form validation failed"
            )
        
        # Create form response
        form_response = FormResponse(
            id=uuid.uuid4(),
            form_schema_id=schema_id,
            data=response_data.data,
            metadata=response_data.metadata,
            workflow_run_id=response_data.workflow_run_id,
            submitted_at=datetime.now(timezone.utc),
            submitted_by=current_user.id if current_user else None
        )
        
        db.add(form_response)
        await db.commit()
        await db.refresh(form_response)
        
        # Queue background processing
        background_tasks.add_task(
            processing_service.process_form_response,
            form_response.id,
            schema
        )
        
        logger.info(f"✅ Form response submitted: {form_response.id}")
        
        return FormSubmissionResult(
            success=True,
            response_id=str(form_response.id),
            message="Form submitted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to submit form response: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/schemas/{schema_id}/responses", response_model=List[FormResponseResponse])
async def list_form_responses(
    schema_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    submitted_by: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """List form responses with filtering"""
    try:
        query = select(FormResponse).where(FormResponse.form_schema_id == schema_id)
        
        # Apply filters
        if submitted_by:
            query = query.where(FormResponse.submitted_by == submitted_by)
        
        if start_date:
            query = query.where(FormResponse.submitted_at >= start_date)
        
        if end_date:
            query = query.where(FormResponse.submitted_at <= end_date)
        
        # Add pagination
        query = query.offset(offset).limit(limit).order_by(desc(FormResponse.submitted_at))
        
        result = await db.execute(query)
        responses = result.scalars().all()
        
        return [FormResponseResponse.from_orm(response) for response in responses]
        
    except Exception as e:
        logger.error(f"❌ Failed to list form responses: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/responses/{response_id}", response_model=FormResponseResponse)
async def get_form_response(
    response_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Get a specific form response by ID"""
    try:
        result = await db.execute(
            select(FormResponse).where(FormResponse.id == response_id)
        )
        response = result.scalar_one_or_none()
        
        if not response:
            raise HTTPException(status_code=404, detail="Form response not found")
        
        return FormResponseResponse.from_orm(response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get form response: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/attachments", response_model=FormAttachmentResponse, status_code=201)
async def upload_form_attachment(
    file: UploadFile = File(...),
    form_response_id: Optional[str] = Form(None),
    field_id: str = Form(...),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Upload file attachment for form field"""
    try:
        logger.info(f"Uploading form attachment: {file.filename}")
        
        # Validate file
        validation_result = await file_service.validate_file(file)
        if not validation_result.is_valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "File validation failed",
                    "errors": validation_result.errors
                }
            )
        
        # Upload file
        upload_result = await file_service.upload_file(file, "forms")
        
        # Create attachment record
        attachment = FormAttachment(
            id=uuid.uuid4(),
            form_response_id=form_response_id,
            field_id=field_id,
            filename=file.filename,
            original_filename=file.filename,
            file_path=upload_result.file_path,
            file_size=upload_result.file_size,
            content_type=file.content_type,
            uploaded_by=current_user.id if current_user else None,
            uploaded_at=datetime.now(timezone.utc)
        )
        
        db.add(attachment)
        await db.commit()
        await db.refresh(attachment)
        
        logger.info(f"✅ Form attachment uploaded: {attachment.id}")
        return FormAttachmentResponse.from_orm(attachment)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to upload form attachment: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/attachments/{attachment_id}")
async def download_form_attachment(
    attachment_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Download form attachment file"""
    try:
        result = await db.execute(
            select(FormAttachment).where(FormAttachment.id == attachment_id)
        )
        attachment = result.scalar_one_or_none()
        
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        file_path = Path(attachment.file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            path=file_path,
            filename=attachment.original_filename,
            media_type=attachment.content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to download attachment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/schemas/{schema_id}/analytics", response_model=FormAnalyticsResponse)
async def get_form_analytics(
    schema_id: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Get form analytics and statistics"""
    try:
        # Verify schema exists
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == schema_id)
        )
        schema = result.scalar_one_or_none()
        
        if not schema:
            raise HTTPException(status_code=404, detail="Form schema not found")
        
        # Build query for responses
        query = select(FormResponse).where(FormResponse.form_schema_id == schema_id)
        
        if start_date:
            query = query.where(FormResponse.submitted_at >= start_date)
        if end_date:
            query = query.where(FormResponse.submitted_at <= end_date)
        
        responses_result = await db.execute(query)
        responses = responses_result.scalars().all()
        
        # Calculate analytics
        total_responses = len(responses)
        
        analytics = FormAnalyticsResponse(
            form_schema_id=schema_id,
            total_responses=total_responses,
            response_rate=100.0 if total_responses > 0 else 0.0,
            average_completion_time=0,  # Calculate from metadata
            field_analytics=[],  # Calculate per field
            created_at=datetime.now(timezone.utc)
        )
        
        return analytics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get form analytics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/health")
async def health_check():
    """Form API health check"""
    return {
        "status": "healthy",
        "service": "forms-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }