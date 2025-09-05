"""
Form Router - REST API endpoints for form management
Handles form schema creation, management, and response collection.
"""

import logging
from typing import Dict, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.connection import get_db_session
from ...models.workflow import FormSchema, FormResponse
from ...services.cache_manager import CacheManager, CacheNamespace
from ...auth.security import SecurityManager, get_current_user
from ...schemas.form import FormSchemaCreate, FormSchemaUpdate, FormSchemaResponse, FormResponseCreate

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize dependencies
cache_manager = CacheManager()
security_manager = SecurityManager()


@router.post("/", response_model=FormSchemaResponse, status_code=status.HTTP_201_CREATED)
async def create_form_schema(
    form_data: FormSchemaCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create new form schema"""
    try:
        # Create form schema
        form_schema = FormSchema(
            name=form_data.name,
            version=form_data.version or "1.0.0",
            fields=form_data.fields,
            validation_rules=form_data.validation_rules or {},
            metadata=form_data.metadata or {},
            created_by=current_user.id
        )
        
        db.add(form_schema)
        await db.commit()
        await db.refresh(form_schema)
        
        # Cache the form schema
        await cache_manager.cache_form_schema(
            str(form_schema.id),
            {
                "id": str(form_schema.id),
                "name": form_schema.name,
                "version": form_schema.version,
                "fields": form_schema.fields,
                "validation_rules": form_schema.validation_rules,
                "metadata": form_schema.metadata
            }
        )
        
        logger.info(f"Created form schema {form_schema.id}: {form_schema.name}")
        
        return FormSchemaResponse.from_orm(form_schema)
        
    except Exception as e:
        logger.error(f"Failed to create form schema: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create form schema"
        )


@router.get("/", response_model=List[FormSchemaResponse])
async def list_form_schemas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List form schemas with filtering and pagination"""
    try:
        from sqlalchemy import select, func, or_
        
        # Build query
        query = select(FormSchema)
        
        # Add search filter if provided
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    FormSchema.name.ilike(search_pattern),
                    FormSchema.metadata['description'].astext.ilike(search_pattern)
                )
            )
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        query = query.order_by(FormSchema.created_at.desc())
        
        # Execute query
        result = await db.execute(query)
        form_schemas = result.scalars().all()
        
        return [FormSchemaResponse.from_orm(form) for form in form_schemas]
        
    except Exception as e:
        logger.error(f"Failed to list form schemas: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list form schemas"
        )


@router.get("/{form_id}", response_model=FormSchemaResponse)
async def get_form_schema(
    form_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get form schema by ID"""
    try:
        # Try cache first
        cached_form = await cache_manager.get_form_schema(str(form_id))
        if cached_form:
            return FormSchemaResponse(**cached_form)
        
        # Query database
        from sqlalchemy import select
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_id)
        )
        form_schema = result.scalar_one_or_none()
        
        if not form_schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form schema not found"
            )
        
        # Cache the result
        await cache_manager.cache_form_schema(
            str(form_schema.id),
            {
                "id": str(form_schema.id),
                "name": form_schema.name,
                "version": form_schema.version,
                "fields": form_schema.fields,
                "validation_rules": form_schema.validation_rules,
                "metadata": form_schema.metadata
            }
        )
        
        return FormSchemaResponse.from_orm(form_schema)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get form schema {form_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get form schema"
        )


@router.put("/{form_id}", response_model=FormSchemaResponse)
async def update_form_schema(
    form_id: UUID,
    form_data: FormSchemaUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Update form schema"""
    try:
        # Get existing form schema
        from sqlalchemy import select
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_id)
        )
        form_schema = result.scalar_one_or_none()
        
        if not form_schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form schema not found"
            )
        
        # Update fields
        if form_data.name is not None:
            form_schema.name = form_data.name
        if form_data.fields is not None:
            form_schema.fields = form_data.fields
        if form_data.validation_rules is not None:
            form_schema.validation_rules = form_data.validation_rules
        if form_data.metadata is not None:
            form_schema.metadata = form_data.metadata
        
        await db.commit()
        await db.refresh(form_schema)
        
        # Invalidate cache
        await cache_manager.delete(CacheNamespace.FORM_DEFINITIONS, str(form_id))
        
        logger.info(f"Updated form schema {form_id}")
        
        return FormSchemaResponse.from_orm(form_schema)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update form schema {form_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update form schema"
        )


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_form_schema(
    form_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Delete form schema"""
    try:
        # Get existing form schema
        from sqlalchemy import select
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_id)
        )
        form_schema = result.scalar_one_or_none()
        
        if not form_schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form schema not found"
            )
        
        # Delete from database
        await db.delete(form_schema)
        await db.commit()
        
        # Invalidate cache
        await cache_manager.delete(CacheNamespace.FORM_DEFINITIONS, str(form_id))
        
        logger.info(f"Deleted form schema {form_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete form schema {form_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete form schema"
        )


@router.post("/{form_id}/responses", status_code=status.HTTP_201_CREATED)
async def submit_form_response(
    form_id: UUID,
    response_data: FormResponseCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Submit form response"""
    try:
        # Get form schema to validate against
        from sqlalchemy import select
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_id)
        )
        form_schema = result.scalar_one_or_none()
        
        if not form_schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form schema not found"
            )
        
        # Validate form data against schema (basic validation)
        validation_errors = await _validate_form_response(
            response_data.data,
            form_schema.fields,
            form_schema.validation_rules
        )
        
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"errors": validation_errors}
            )
        
        # Create form response
        form_response = FormResponse(
            form_schema_id=form_id,
            data=response_data.data,
            metadata=response_data.metadata or {},
            workflow_run_id=response_data.workflow_run_id
        )
        
        db.add(form_response)
        await db.commit()
        await db.refresh(form_response)
        
        logger.info(f"Submitted form response {form_response.id} for form {form_id}")
        
        return {
            "response_id": str(form_response.id),
            "status": "submitted",
            "submitted_at": form_response.submitted_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit form response: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit form response"
        )


@router.get("/{form_id}/responses")
async def list_form_responses(
    form_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List form responses"""
    try:
        from sqlalchemy import select
        
        # Verify form exists
        form_result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_id)
        )
        if not form_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form schema not found"
            )
        
        # Get responses
        query = select(FormResponse).where(FormResponse.form_schema_id == form_id)
        query = query.offset(skip).limit(limit)
        query = query.order_by(FormResponse.submitted_at.desc())
        
        result = await db.execute(query)
        responses = result.scalars().all()
        
        return [
            {
                "response_id": str(response.id),
                "data": response.data,
                "metadata": response.metadata,
                "submitted_at": response.submitted_at.isoformat(),
                "workflow_run_id": str(response.workflow_run_id) if response.workflow_run_id else None
            }
            for response in responses
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list form responses: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list form responses"
        )


@router.get("/{form_id}/responses/{response_id}")
async def get_form_response(
    form_id: UUID,
    response_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get specific form response"""
    try:
        from sqlalchemy import select
        
        result = await db.execute(
            select(FormResponse).where(
                FormResponse.id == response_id,
                FormResponse.form_schema_id == form_id
            )
        )
        response = result.scalar_one_or_none()
        
        if not response:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form response not found"
            )
        
        return {
            "response_id": str(response.id),
            "form_id": str(response.form_schema_id),
            "data": response.data,
            "metadata": response.metadata,
            "submitted_at": response.submitted_at.isoformat(),
            "workflow_run_id": str(response.workflow_run_id) if response.workflow_run_id else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get form response {response_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get form response"
        )


@router.post("/{form_id}/send")
async def send_form(
    form_id: UUID,
    send_request: Dict[str, Any],
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Send form to recipients via email or other channels"""
    try:
        # This would integrate with the worker manager to send forms
        # For now, return a placeholder response
        
        recipients = send_request.get("recipients", [])
        channel = send_request.get("channel", "email")
        
        if not recipients:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recipients are required"
            )
        
        # Queue form sending task (would use worker manager)
        task_id = "placeholder-task-id"
        
        logger.info(f"Queued form {form_id} to be sent to {len(recipients)} recipients via {channel}")
        
        return {
            "task_id": task_id,
            "status": "queued",
            "recipients_count": len(recipients),
            "channel": channel
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send form {form_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send form"
        )


async def _validate_form_response(
    data: Dict[str, Any],
    fields: List[Dict[str, Any]],
    validation_rules: Dict[str, Any]
) -> List[str]:
    """Validate form response data against schema"""
    errors = []
    
    # Create field lookup
    field_lookup = {field["id"]: field for field in fields}
    
    # Check required fields
    for field in fields:
        field_id = field["id"]
        if field.get("required", False) and field_id not in data:
            errors.append(f"Field '{field_id}' is required")
    
    # Check field types and constraints
    for field_id, value in data.items():
        if field_id not in field_lookup:
            continue
            
        field = field_lookup[field_id]
        field_type = field.get("type", "text")
        
        # Basic type validation
        if field_type == "number" and not isinstance(value, (int, float)):
            try:
                float(value)
            except (ValueError, TypeError):
                errors.append(f"Field '{field_id}' must be a number")
        
        elif field_type == "email" and value:
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, str(value)):
                errors.append(f"Field '{field_id}' must be a valid email address")
        
        # Check field-specific validation rules
        if field_id in validation_rules:
            field_rules = validation_rules[field_id]
            
            if "min_length" in field_rules and len(str(value)) < field_rules["min_length"]:
                errors.append(f"Field '{field_id}' must be at least {field_rules['min_length']} characters")
            
            if "max_length" in field_rules and len(str(value)) > field_rules["max_length"]:
                errors.append(f"Field '{field_id}' must be no more than {field_rules['max_length']} characters")
    
    return errors