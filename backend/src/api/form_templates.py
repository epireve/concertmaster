"""
Form Template Management API
REST API endpoints for managing form templates and presets.
"""

import uuid
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload

from ..database.connection import get_db_session
from ..models.forms import FormTemplate, FormSchema
from ..schemas.form_extended import FormTemplateResponse
from ..services.form_validator import FormValidationService
from ..auth.security import get_current_user, require_permissions
from ..config import settings

router = APIRouter(prefix="/api/v1/form-templates", tags=["form-templates"])
logger = logging.getLogger(__name__)

# Initialize services
validation_service = FormValidationService()


@router.get("/", response_model=List[FormTemplateResponse])
async def list_form_templates(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = Query(None),
    featured: Optional[bool] = Query(None),
    public_only: bool = Query(True),
    search: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    sort_by: str = Query("usage_count", regex="^(name|usage_count|rating|created_at)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db_session)
):
    """List form templates with filtering and pagination"""
    try:
        query = select(FormTemplate)
        
        # Apply filters
        filters = []
        
        if public_only:
            filters.append(FormTemplate.is_public == True)
        
        filters.append(FormTemplate.is_active == True)
        
        if category:
            filters.append(FormTemplate.category == category)
        
        if featured is not None:
            filters.append(FormTemplate.is_featured == featured)
        
        if search:
            search_filter = or_(
                FormTemplate.name.ilike(f"%{search}%"),
                FormTemplate.display_name.ilike(f"%{search}%"),
                FormTemplate.description.ilike(f"%{search}%")
            )
            filters.append(search_filter)
        
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',')]
            # Use JSON contains operator for tag filtering
            for tag in tag_list:
                filters.append(FormTemplate.tags.contains([tag]))
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply sorting
        if sort_order == "desc":
            query = query.order_by(desc(getattr(FormTemplate, sort_by)))
        else:
            query = query.order_by(getattr(FormTemplate, sort_by))
        
        # Add pagination
        query = query.offset(offset).limit(limit)
        
        result = await db.execute(query)
        templates = result.scalars().all()
        
        return [FormTemplateResponse.from_orm(template) for template in templates]
        
    except Exception as e:
        logger.error(f"❌ Failed to list form templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/categories")
async def get_template_categories(
    db: AsyncSession = Depends(get_db_session)
):
    """Get available template categories"""
    try:
        result = await db.execute(
            select(FormTemplate.category, func.count(FormTemplate.id))
            .where(and_(FormTemplate.is_active == True, FormTemplate.is_public == True))
            .group_by(FormTemplate.category)
            .order_by(FormTemplate.category)
        )
        
        categories = [
            {"name": category, "count": count}
            for category, count in result.all()
        ]
        
        return {"categories": categories}
        
    except Exception as e:
        logger.error(f"❌ Failed to get template categories: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/popular")
async def get_popular_templates(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session)
):
    """Get most popular form templates"""
    try:
        result = await db.execute(
            select(FormTemplate)
            .where(and_(
                FormTemplate.is_active == True,
                FormTemplate.is_public == True,
                FormTemplate.usage_count > 0
            ))
            .order_by(desc(FormTemplate.usage_count), desc(FormTemplate.rating))
            .limit(limit)
        )
        
        templates = result.scalars().all()
        
        return [FormTemplateResponse.from_orm(template) for template in templates]
        
    except Exception as e:
        logger.error(f"❌ Failed to get popular templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/featured")
async def get_featured_templates(
    db: AsyncSession = Depends(get_db_session)
):
    """Get featured form templates"""
    try:
        result = await db.execute(
            select(FormTemplate)
            .where(and_(
                FormTemplate.is_active == True,
                FormTemplate.is_public == True,
                FormTemplate.is_featured == True
            ))
            .order_by(desc(FormTemplate.rating), desc(FormTemplate.usage_count))
        )
        
        templates = result.scalars().all()
        
        return [FormTemplateResponse.from_orm(template) for template in templates]
        
    except Exception as e:
        logger.error(f"❌ Failed to get featured templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{template_id}", response_model=FormTemplateResponse)
async def get_form_template(
    template_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Get a specific form template by ID"""
    try:
        result = await db.execute(
            select(FormTemplate).where(FormTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Form template not found")
        
        if not template.is_active:
            raise HTTPException(status_code=404, detail="Form template not available")
        
        return FormTemplateResponse.from_orm(template)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get form template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{template_id}/use")
async def use_template(
    template_id: str,
    template_name: str,
    customizations: Optional[Dict[str, Any]] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Create a form from a template"""
    try:
        logger.info(f"Creating form from template: {template_id}")
        
        # Get template
        result = await db.execute(
            select(FormTemplate).where(FormTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Form template not found")
        
        if not template.is_active:
            raise HTTPException(status_code=404, detail="Form template not available")
        
        # Get template configuration
        template_config = template.template_config
        default_settings = template.default_settings
        
        # Apply customizations if provided
        if customizations:
            # Merge customizations with template config
            fields = template_config.get('fields', [])
            
            # Apply field customizations
            if 'field_customizations' in customizations:
                field_customizations = customizations['field_customizations']
                for field in fields:
                    field_id = field.get('id')
                    if field_id in field_customizations:
                        field.update(field_customizations[field_id])
            
            # Apply metadata customizations
            if 'metadata' in customizations:
                template_config['metadata'] = {
                    **template_config.get('metadata', {}),
                    **customizations['metadata']
                }
        
        # Validate the resulting form schema
        validation_result = await validation_service.validate_schema(fields)
        if not validation_result.is_valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Template customization resulted in invalid schema",
                    "errors": validation_result.errors
                }
            )
        
        # Create new form schema from template
        form_schema = FormSchema(
            id=uuid.uuid4(),
            name=template_name,
            version="1.0.0",
            fields=fields,
            validation_rules=template_config.get('validation_rules', {}),
            metadata={
                **default_settings,
                **template_config.get('metadata', {}),
                'created_from_template': str(template.id),
                'template_name': template.name
            },
            created_by=current_user.id,
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(form_schema)
        
        # Update template usage count
        template.usage_count += 1
        
        await db.commit()
        await db.refresh(form_schema)
        
        # Background task to log template usage analytics
        background_tasks.add_task(
            _log_template_usage,
            str(template.id),
            str(form_schema.id),
            str(current_user.id)
        )
        
        logger.info(f"✅ Form created from template: {form_schema.id}")
        
        return {
            "success": True,
            "form_id": str(form_schema.id),
            "message": f"Form '{template_name}' created successfully from template"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to use template: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/", response_model=FormTemplateResponse, status_code=201)
async def create_form_template(
    template_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Create a new form template"""
    try:
        logger.info(f"Creating form template: {template_data.get('name')}")
        
        # Validate required fields
        required_fields = ['name', 'display_name', 'category', 'template_config']
        for field in required_fields:
            if field not in template_data:
                raise HTTPException(
                    status_code=422,
                    detail=f"Required field '{field}' is missing"
                )
        
        # Validate template configuration
        template_config = template_data['template_config']
        if 'fields' not in template_config:
            raise HTTPException(
                status_code=422,
                detail="Template configuration must include 'fields'"
            )
        
        # Validate form fields
        validation_result = await validation_service.validate_schema(
            template_config['fields']
        )
        if not validation_result.is_valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Template form schema validation failed",
                    "errors": validation_result.errors
                }
            )
        
        # Create template
        form_template = FormTemplate(
            id=uuid.uuid4(),
            name=template_data['name'],
            display_name=template_data['display_name'],
            description=template_data.get('description'),
            category=template_data['category'],
            tags=template_data.get('tags', []),
            template_config=template_config,
            default_settings=template_data.get('default_settings', {}),
            is_public=template_data.get('is_public', False),
            created_by=current_user.id,
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(form_template)
        await db.commit()
        await db.refresh(form_template)
        
        logger.info(f"✅ Form template created: {form_template.id}")
        return FormTemplateResponse.from_orm(form_template)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create form template: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{template_id}", response_model=FormTemplateResponse)
async def update_form_template(
    template_id: str,
    update_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Update an existing form template"""
    try:
        result = await db.execute(
            select(FormTemplate).where(FormTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Form template not found")
        
        # Check permissions
        if template.created_by != current_user.id:
            await require_permissions(current_user, ["templates:edit_all"])
        
        # Validate template config if provided
        if 'template_config' in update_data:
            template_config = update_data['template_config']
            if 'fields' in template_config:
                validation_result = await validation_service.validate_schema(
                    template_config['fields']
                )
                if not validation_result.is_valid:
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "error": "Updated template schema validation failed",
                            "errors": validation_result.errors
                        }
                    )
        
        # Update fields
        for field, value in update_data.items():
            if hasattr(template, field):
                setattr(template, field, value)
        
        template.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(template)
        
        logger.info(f"✅ Form template updated: {template_id}")
        return FormTemplateResponse.from_orm(template)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update form template: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{template_id}/rate")
async def rate_template(
    template_id: str,
    rating: int,
    review: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Rate a form template"""
    try:
        if rating < 1 or rating > 5:
            raise HTTPException(
                status_code=422,
                detail="Rating must be between 1 and 5"
            )
        
        result = await db.execute(
            select(FormTemplate).where(FormTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Form template not found")
        
        # Update template rating
        # Simple average calculation (in production, you'd want a proper rating system)
        total_ratings = template.rating * template.rating_count + rating
        template.rating_count += 1
        template.rating = total_ratings / template.rating_count
        
        await db.commit()
        
        logger.info(f"✅ Template rated: {template_id} - {rating} stars")
        
        return {
            "success": True,
            "message": "Rating submitted successfully",
            "new_average_rating": round(template.rating, 2)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to rate template: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{template_id}", status_code=204)
async def delete_form_template(
    template_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Delete a form template"""
    try:
        result = await db.execute(
            select(FormTemplate).where(FormTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Form template not found")
        
        # Check permissions
        if template.created_by != current_user.id:
            await require_permissions(current_user, ["templates:delete_all"])
        
        # Soft delete by marking as inactive
        template.is_active = False
        template.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        
        logger.info(f"✅ Form template deleted: {template_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete form template: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


async def _log_template_usage(
    template_id: str,
    form_id: str,
    user_id: str
):
    """Background task to log template usage analytics"""
    try:
        logger.info(f"Logging template usage: {template_id} -> {form_id} by {user_id}")
        # In a real implementation, you'd store this in an analytics table
        # or send to an analytics service like Google Analytics, Mixpanel, etc.
    except Exception as e:
        logger.error(f"Failed to log template usage: {e}")