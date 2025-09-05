"""
Visual Builder Router - REST API endpoints for Visual Builder operations
Provides comprehensive API for visual component design, project management, and code generation
"""

import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.connection import get_db_session
from ...auth.security import get_current_active_user
from ...models.user import User
from ...services.visual_builder_service import VisualBuilderService
from ...schemas.visual_builder import (
    # Project schemas
    VisualBuilderProjectCreate, VisualBuilderProjectUpdate, VisualBuilderProjectResponse,
    ProjectListResponse, ProjectFilters,
    # Component schemas  
    VisualBuilderComponentCreate, VisualBuilderComponentUpdate, VisualBuilderComponentResponse,
    ComponentListResponse, ComponentFilters, ComponentValidationRequest, ComponentValidationResponse,
    # Page schemas
    VisualBuilderPageCreate, VisualBuilderPageUpdate, VisualBuilderPageResponse,
    # Template schemas
    ComponentTemplateCreate, ComponentTemplateUpdate, ComponentTemplateResponse,
    TemplateListResponse, TemplateFilters,
    # Export schemas
    ProjectExportRequest, ProjectExportResponse,
    # Code generation schemas
    CodeGenerationRequest, CodeGenerationResponse,
    # Import schemas
    ProjectImportRequest, ProjectImportResponse,
    # Enums
    FrameworkType, ComponentCategory, ExportType
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/visual-builder", tags=["Visual Builder"])

# Initialize service
visual_builder_service = VisualBuilderService()


# Project endpoints
@router.post("/projects", response_model=VisualBuilderProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: VisualBuilderProjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new Visual Builder project"""
    try:
        project = await visual_builder_service.create_project(project_data, current_user.id, db)
        return VisualBuilderProjectResponse.model_validate(project)
        
    except ValueError as e:
        logger.warning(f"Project creation validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project"
        )


@router.get("/projects", response_model=ProjectListResponse)
async def list_projects(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    target_framework: Optional[FrameworkType] = Query(None),
    is_template: Optional[bool] = Query(None),
    search_query: Optional[str] = Query(None, max_length=255),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List Visual Builder projects with filtering and pagination"""
    try:
        filters = ProjectFilters(
            target_framework=target_framework,
            is_template=is_template,
            search_query=search_query
        )
        
        projects, total = await visual_builder_service.list_projects(
            current_user.id, filters, offset, limit, db
        )
        
        project_responses = [
            VisualBuilderProjectResponse.model_validate(project) 
            for project in projects
        ]
        
        return ProjectListResponse(
            projects=project_responses,
            total=total,
            offset=offset,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list projects"
        )


@router.get("/projects/{project_id}", response_model=VisualBuilderProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get a specific Visual Builder project"""
    try:
        project = await visual_builder_service.get_project(project_id, current_user.id, db)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        return VisualBuilderProjectResponse.model_validate(project)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get project"
        )


@router.put("/projects/{project_id}", response_model=VisualBuilderProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: VisualBuilderProjectUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Update a Visual Builder project"""
    try:
        project = await visual_builder_service.update_project(
            project_id, project_data, current_user.id, db
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        return VisualBuilderProjectResponse.model_validate(project)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project"
        )


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Delete a Visual Builder project"""
    try:
        success = await visual_builder_service.delete_project(project_id, current_user.id, db)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project"
        )


@router.get("/projects/{project_id}/statistics")
async def get_project_statistics(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get statistics for a Visual Builder project"""
    try:
        stats = await visual_builder_service.get_project_statistics(project_id, current_user.id, db)
        return stats
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get project statistics for {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get project statistics"
        )


# Component endpoints
@router.post("/components", response_model=VisualBuilderComponentResponse, status_code=status.HTTP_201_CREATED)
async def create_component(
    component_data: VisualBuilderComponentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new Visual Builder component"""
    try:
        component = await visual_builder_service.create_component(component_data, current_user.id, db)
        return VisualBuilderComponentResponse.model_validate(component)
        
    except ValueError as e:
        logger.warning(f"Component creation validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create component: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create component"
        )


@router.get("/components", response_model=ComponentListResponse)
async def list_components(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    component_type: Optional[str] = Query(None),
    category: Optional[ComponentCategory] = Query(None),
    is_global: Optional[bool] = Query(None),
    project_id: Optional[UUID] = Query(None),
    search_query: Optional[str] = Query(None, max_length=255),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List Visual Builder components with filtering and pagination"""
    try:
        filters = ComponentFilters(
            component_type=component_type,
            category=category,
            is_global=is_global,
            project_id=project_id,
            search_query=search_query
        )
        
        components, total = await visual_builder_service.list_components(
            current_user.id, filters, offset, limit, db
        )
        
        component_responses = [
            VisualBuilderComponentResponse.model_validate(component) 
            for component in components
        ]
        
        return ComponentListResponse(
            components=component_responses,
            total=total,
            offset=offset,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"Failed to list components: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list components"
        )


@router.get("/components/{component_id}", response_model=VisualBuilderComponentResponse)
async def get_component(
    component_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get a specific Visual Builder component"""
    try:
        component = await visual_builder_service.get_component(component_id, current_user.id, db)
        if not component:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Component not found"
            )
        
        return VisualBuilderComponentResponse.model_validate(component)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get component {component_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get component"
        )


@router.post("/components/validate", response_model=ComponentValidationResponse)
async def validate_component(
    validation_request: ComponentValidationRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Validate a component definition"""
    try:
        result = await visual_builder_service.component_validator.validate_component(
            validation_request.component_type,
            validation_request.definition,
            validation_request.target_framework,
            validation_request.validate_props,
            validation_request.validate_events
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Component validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Component validation failed"
        )


# Template endpoints
@router.post("/templates", response_model=ComponentTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: ComponentTemplateCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new component template"""
    try:
        template = await visual_builder_service.create_template(template_data, current_user.id, db)
        return ComponentTemplateResponse.model_validate(template)
        
    except Exception as e:
        logger.error(f"Failed to create template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template"
        )


@router.get("/templates", response_model=TemplateListResponse)
async def list_templates(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[ComponentCategory] = Query(None),
    supported_framework: Optional[FrameworkType] = Query(None),
    is_premium: Optional[bool] = Query(None),
    search_query: Optional[str] = Query(None, max_length=255),
    db: AsyncSession = Depends(get_db_session)
):
    """List component templates with filtering and pagination"""
    try:
        filters = TemplateFilters(
            category=category,
            supported_framework=supported_framework,
            is_premium=is_premium,
            search_query=search_query
        )
        
        templates, total = await visual_builder_service.list_templates(
            filters, offset, limit, db
        )
        
        template_responses = [
            ComponentTemplateResponse.model_validate(template) 
            for template in templates
        ]
        
        return TemplateListResponse(
            templates=template_responses,
            total=total,
            offset=offset,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"Failed to list templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list templates"
        )


# Page endpoints
@router.post("/projects/{project_id}/pages", response_model=VisualBuilderPageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(
    project_id: UUID,
    page_data: VisualBuilderPageCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new page in a Visual Builder project"""
    try:
        # Set project_id from URL
        page_data.project_id = project_id
        
        page = await visual_builder_service.create_page(page_data, current_user.id, db)
        return VisualBuilderPageResponse.model_validate(page)
        
    except ValueError as e:
        logger.warning(f"Page creation validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create page: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create page"
        )


# Export/Import endpoints
@router.post("/projects/{project_id}/export", response_model=ProjectExportResponse, status_code=status.HTTP_201_CREATED)
async def export_project(
    project_id: UUID,
    export_request: ProjectExportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Export a Visual Builder project"""
    try:
        export = await visual_builder_service.export_project(
            project_id, export_request, current_user.id, db
        )
        
        # TODO: Add background task for actual export processing
        # background_tasks.add_task(process_export, export.id)
        
        return ProjectExportResponse.model_validate(export)
        
    except ValueError as e:
        logger.warning(f"Project export validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to export project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export project"
        )


@router.post("/projects/import", response_model=ProjectImportResponse, status_code=status.HTTP_201_CREATED)
async def import_project(
    import_request: ProjectImportRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Import a Visual Builder project"""
    try:
        # TODO: Implement project import logic
        return ProjectImportResponse(
            success=True,
            project_id=None,
            errors=["Import functionality not yet implemented"],
            warnings=[]
        )
        
    except Exception as e:
        logger.error(f"Failed to import project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to import project"
        )


# Code generation endpoints
@router.post("/projects/{project_id}/generate", response_model=CodeGenerationResponse, status_code=status.HTTP_201_CREATED)
async def generate_code(
    project_id: UUID,
    generation_request: CodeGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Generate code for a Visual Builder project"""
    try:
        job = await visual_builder_service.generate_code(
            project_id, generation_request, current_user.id, db
        )
        
        # TODO: Add background task for actual code generation
        # background_tasks.add_task(process_code_generation, job.id)
        
        return CodeGenerationResponse.model_validate(job)
        
    except ValueError as e:
        logger.warning(f"Code generation validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to generate code: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate code"
        )


# Utility endpoints
@router.get("/frameworks")
async def get_supported_frameworks():
    """Get list of supported frameworks"""
    return {
        "frameworks": [
            {
                "value": framework.value,
                "name": framework.value.title(),
                "description": f"{framework.value.title()} framework support"
            }
            for framework in FrameworkType
        ]
    }


@router.get("/component-categories")
async def get_component_categories():
    """Get list of component categories"""
    return {
        "categories": [
            {
                "value": category.value,
                "name": category.value.title(),
                "description": f"{category.value.title()} components"
            }
            for category in ComponentCategory
        ]
    }


@router.get("/health")
async def health_check():
    """Health check endpoint for Visual Builder service"""
    return {
        "status": "healthy",
        "service": "visual-builder",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }