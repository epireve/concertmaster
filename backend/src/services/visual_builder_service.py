"""
Visual Builder Service Layer
Business logic for Visual Builder operations
"""

import logging
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.exc import IntegrityError

from ..models.visual_builder import (
    VisualBuilderProject, VisualBuilderPage, VisualBuilderComponent,
    ComponentTemplate, ProjectExport, CodeGenerationJob
)
from ..schemas.visual_builder import (
    VisualBuilderProjectCreate, VisualBuilderProjectUpdate,
    VisualBuilderPageCreate, VisualBuilderPageUpdate,
    VisualBuilderComponentCreate, VisualBuilderComponentUpdate,
    ComponentTemplateCreate, ComponentTemplateUpdate,
    ProjectExportRequest, CodeGenerationRequest,
    ProjectFilters, ComponentFilters, TemplateFilters,
    FrameworkType
)
from .code_generation.framework_generators import FrameworkGeneratorFactory
from .component_validator import ComponentValidator
from ..database.connection import get_db_session

logger = logging.getLogger(__name__)


class VisualBuilderService:
    """Service class for Visual Builder operations"""
    
    def __init__(self):
        self.component_validator = ComponentValidator()
        self.generator_factory = FrameworkGeneratorFactory()
    
    # Project operations
    async def create_project(
        self,
        project_data: VisualBuilderProjectCreate,
        user_id: uuid.UUID,
        db: AsyncSession
    ) -> VisualBuilderProject:
        """Create a new Visual Builder project"""
        try:
            # Validate project structure
            self._validate_project_structure(project_data.project_structure)
            
            project = VisualBuilderProject(
                **project_data.model_dump(exclude={'created_by'}),
                created_by=user_id
            )
            
            db.add(project)
            await db.commit()
            await db.refresh(project)
            
            logger.info(f"Created Visual Builder project: {project.id}")
            return project
            
        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Project creation failed due to integrity error: {e}")
            raise ValueError("Project name already exists for this user")
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create project: {e}")
            raise
    
    async def get_project(self, project_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Optional[VisualBuilderProject]:
        """Get a Visual Builder project by ID"""
        try:
            stmt = select(VisualBuilderProject).options(
                selectinload(VisualBuilderProject.components),
                selectinload(VisualBuilderProject.pages)
            ).where(
                and_(
                    VisualBuilderProject.id == project_id,
                    VisualBuilderProject.created_by == user_id,
                    VisualBuilderProject.is_active == True
                )
            )
            
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"Failed to get project {project_id}: {e}")
            raise
    
    async def list_projects(
        self,
        user_id: uuid.UUID,
        filters: Optional[ProjectFilters] = None,
        offset: int = 0,
        limit: int = 50,
        db: AsyncSession = None
    ) -> Tuple[List[VisualBuilderProject], int]:
        """List Visual Builder projects with filtering"""
        try:
            # Build query conditions
            conditions = [
                VisualBuilderProject.created_by == user_id,
                VisualBuilderProject.is_active == True
            ]
            
            if filters:
                if filters.target_framework:
                    conditions.append(VisualBuilderProject.target_framework == filters.target_framework)
                if filters.is_template is not None:
                    conditions.append(VisualBuilderProject.is_template == filters.is_template)
                if filters.search_query:
                    search_pattern = f"%{filters.search_query}%"
                    conditions.append(
                        or_(
                            VisualBuilderProject.name.ilike(search_pattern),
                            VisualBuilderProject.description.ilike(search_pattern)
                        )
                    )
            
            # Count total
            count_stmt = select(func.count(VisualBuilderProject.id)).where(and_(*conditions))
            count_result = await db.execute(count_stmt)
            total = count_result.scalar()
            
            # Get projects
            stmt = select(VisualBuilderProject).where(
                and_(*conditions)
            ).order_by(desc(VisualBuilderProject.updated_at)).offset(offset).limit(limit)
            
            result = await db.execute(stmt)
            projects = result.scalars().all()
            
            return list(projects), total
            
        except Exception as e:
            logger.error(f"Failed to list projects: {e}")
            raise
    
    async def update_project(
        self,
        project_id: uuid.UUID,
        project_data: VisualBuilderProjectUpdate,
        user_id: uuid.UUID,
        db: AsyncSession
    ) -> Optional[VisualBuilderProject]:
        """Update a Visual Builder project"""
        try:
            # Get existing project
            project = await self.get_project(project_id, user_id, db)
            if not project:
                return None
            
            # Update fields
            update_data = project_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(project, field):
                    setattr(project, field, value)
            
            await db.commit()
            await db.refresh(project)
            
            logger.info(f"Updated Visual Builder project: {project_id}")
            return project
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update project {project_id}: {e}")
            raise
    
    async def delete_project(self, project_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> bool:
        """Soft delete a Visual Builder project"""
        try:
            project = await self.get_project(project_id, user_id, db)
            if not project:
                return False
            
            project.is_active = False
            await db.commit()
            
            logger.info(f"Deleted Visual Builder project: {project_id}")
            return True
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete project {project_id}: {e}")
            raise
    
    # Component operations
    async def create_component(
        self,
        component_data: VisualBuilderComponentCreate,
        user_id: uuid.UUID,
        db: AsyncSession
    ) -> VisualBuilderComponent:
        """Create a new Visual Builder component"""
        try:
            # Validate component definition
            validation_result = await self.component_validator.validate_component(
                component_data.component_type,
                component_data.definition,
                FrameworkType.REACT  # Default for validation
            )
            
            if not validation_result.is_valid:
                raise ValueError(f"Component validation failed: {validation_result.errors}")
            
            component = VisualBuilderComponent(
                **component_data.model_dump(exclude={'created_by'}),
                created_by=user_id
            )
            
            db.add(component)
            await db.commit()
            await db.refresh(component)
            
            logger.info(f"Created Visual Builder component: {component.id}")
            return component
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create component: {e}")
            raise
    
    async def get_component(
        self,
        component_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession
    ) -> Optional[VisualBuilderComponent]:
        """Get a Visual Builder component by ID"""
        try:
            stmt = select(VisualBuilderComponent).where(
                and_(
                    VisualBuilderComponent.id == component_id,
                    or_(
                        VisualBuilderComponent.created_by == user_id,
                        VisualBuilderComponent.is_global == True
                    ),
                    VisualBuilderComponent.is_active == True
                )
            )
            
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"Failed to get component {component_id}: {e}")
            raise
    
    async def list_components(
        self,
        user_id: uuid.UUID,
        filters: Optional[ComponentFilters] = None,
        offset: int = 0,
        limit: int = 50,
        db: AsyncSession = None
    ) -> Tuple[List[VisualBuilderComponent], int]:
        """List Visual Builder components with filtering"""
        try:
            # Build query conditions
            conditions = [
                or_(
                    VisualBuilderComponent.created_by == user_id,
                    VisualBuilderComponent.is_global == True
                ),
                VisualBuilderComponent.is_active == True
            ]
            
            if filters:
                if filters.component_type:
                    conditions.append(VisualBuilderComponent.component_type == filters.component_type)
                if filters.category:
                    conditions.append(VisualBuilderComponent.category == filters.category)
                if filters.is_global is not None:
                    conditions.append(VisualBuilderComponent.is_global == filters.is_global)
                if filters.project_id:
                    conditions.append(VisualBuilderComponent.project_id == filters.project_id)
                if filters.search_query:
                    search_pattern = f"%{filters.search_query}%"
                    conditions.append(
                        or_(
                            VisualBuilderComponent.name.ilike(search_pattern),
                            VisualBuilderComponent.description.ilike(search_pattern)
                        )
                    )
            
            # Count total
            count_stmt = select(func.count(VisualBuilderComponent.id)).where(and_(*conditions))
            count_result = await db.execute(count_stmt)
            total = count_result.scalar()
            
            # Get components
            stmt = select(VisualBuilderComponent).where(
                and_(*conditions)
            ).order_by(desc(VisualBuilderComponent.usage_count), desc(VisualBuilderComponent.updated_at)).offset(offset).limit(limit)
            
            result = await db.execute(stmt)
            components = result.scalars().all()
            
            return list(components), total
            
        except Exception as e:
            logger.error(f"Failed to list components: {e}")
            raise
    
    # Template operations
    async def create_template(
        self,
        template_data: ComponentTemplateCreate,
        user_id: uuid.UUID,
        db: AsyncSession
    ) -> ComponentTemplate:
        """Create a new component template"""
        try:
            template = ComponentTemplate(
                **template_data.model_dump(exclude={'created_by'}),
                created_by=user_id
            )
            
            db.add(template)
            await db.commit()
            await db.refresh(template)
            
            logger.info(f"Created component template: {template.id}")
            return template
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create template: {e}")
            raise
    
    async def list_templates(
        self,
        filters: Optional[TemplateFilters] = None,
        offset: int = 0,
        limit: int = 50,
        db: AsyncSession = None
    ) -> Tuple[List[ComponentTemplate], int]:
        """List component templates with filtering"""
        try:
            conditions = [ComponentTemplate.is_active == True]
            
            if filters:
                if filters.category:
                    conditions.append(ComponentTemplate.category == filters.category)
                if filters.supported_framework:
                    conditions.append(ComponentTemplate.supported_frameworks.contains([filters.supported_framework]))
                if filters.is_premium is not None:
                    conditions.append(ComponentTemplate.is_premium == filters.is_premium)
                if filters.search_query:
                    search_pattern = f"%{filters.search_query}%"
                    conditions.append(
                        or_(
                            ComponentTemplate.name.ilike(search_pattern),
                            ComponentTemplate.description.ilike(search_pattern)
                        )
                    )
            
            # Count total
            count_stmt = select(func.count(ComponentTemplate.id)).where(and_(*conditions))
            count_result = await db.execute(count_stmt)
            total = count_result.scalar()
            
            # Get templates
            stmt = select(ComponentTemplate).where(
                and_(*conditions)
            ).order_by(desc(ComponentTemplate.usage_count), desc(ComponentTemplate.rating)).offset(offset).limit(limit)
            
            result = await db.execute(stmt)
            templates = result.scalars().all()
            
            return list(templates), total
            
        except Exception as e:
            logger.error(f"Failed to list templates: {e}")
            raise
    
    # Page operations
    async def create_page(
        self,
        page_data: VisualBuilderPageCreate,
        user_id: uuid.UUID,
        db: AsyncSession
    ) -> VisualBuilderPage:
        """Create a new page in a Visual Builder project"""
        try:
            # Verify project ownership
            project = await self.get_project(page_data.project_id, user_id, db)
            if not project:
                raise ValueError("Project not found or access denied")
            
            page = VisualBuilderPage(**page_data.model_dump())
            
            db.add(page)
            await db.commit()
            await db.refresh(page)
            
            logger.info(f"Created page: {page.id} for project: {project.id}")
            return page
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create page: {e}")
            raise
    
    # Export operations
    async def export_project(
        self,
        project_id: uuid.UUID,
        export_request: ProjectExportRequest,
        user_id: uuid.UUID,
        db: AsyncSession
    ) -> ProjectExport:
        """Export a Visual Builder project"""
        try:
            # Verify project ownership
            project = await self.get_project(project_id, user_id, db)
            if not project:
                raise ValueError("Project not found or access denied")
            
            export = ProjectExport(
                project_id=project_id,
                export_type=export_request.export_type,
                export_format=export_request.export_format,
                export_config=export_request.export_config,
                included_components=export_request.included_components,
                created_by=user_id
            )
            
            db.add(export)
            await db.commit()
            await db.refresh(export)
            
            # TODO: Trigger async export job
            logger.info(f"Created export job: {export.id} for project: {project_id}")
            return export
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create export job: {e}")
            raise
    
    # Code generation operations
    async def generate_code(
        self,
        project_id: uuid.UUID,
        generation_request: CodeGenerationRequest,
        user_id: uuid.UUID,
        db: AsyncSession
    ) -> CodeGenerationJob:
        """Generate code for a Visual Builder project"""
        try:
            # Verify project ownership
            project = await self.get_project(project_id, user_id, db)
            if not project:
                raise ValueError("Project not found or access denied")
            
            job = CodeGenerationJob(
                project_id=project_id,
                generation_type=generation_request.generation_type,
                target_framework=generation_request.target_framework,
                generation_config=generation_request.generation_config,
                created_by=user_id
            )
            
            db.add(job)
            await db.commit()
            await db.refresh(job)
            
            # TODO: Trigger async code generation job
            logger.info(f"Created code generation job: {job.id} for project: {project_id}")
            return job
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create code generation job: {e}")
            raise
    
    # Utility methods
    def _validate_project_structure(self, structure: Dict[str, Any]) -> None:
        """Validate project structure configuration"""
        if not isinstance(structure, dict):
            raise ValueError("Project structure must be a dictionary")
        
        # Basic validation - can be extended
        allowed_keys = {
            'directories', 'files', 'assets', 'routes', 'components',
            'services', 'utils', 'config', 'styles'
        }
        
        invalid_keys = set(structure.keys()) - allowed_keys
        if invalid_keys:
            logger.warning(f"Unknown project structure keys: {invalid_keys}")
    
    async def get_project_statistics(self, project_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Dict[str, Any]:
        """Get statistics for a Visual Builder project"""
        try:
            project = await self.get_project(project_id, user_id, db)
            if not project:
                raise ValueError("Project not found or access denied")
            
            # Count components
            component_count_stmt = select(func.count(VisualBuilderComponent.id)).where(
                and_(
                    VisualBuilderComponent.project_id == project_id,
                    VisualBuilderComponent.is_active == True
                )
            )
            component_count_result = await db.execute(component_count_stmt)
            component_count = component_count_result.scalar() or 0
            
            # Count pages
            page_count_stmt = select(func.count(VisualBuilderPage.id)).where(
                and_(
                    VisualBuilderPage.project_id == project_id,
                    VisualBuilderPage.is_active == True
                )
            )
            page_count_result = await db.execute(page_count_stmt)
            page_count = page_count_result.scalar() or 0
            
            # Count exports
            export_count_stmt = select(func.count(ProjectExport.id)).where(
                ProjectExport.project_id == project_id
            )
            export_count_result = await db.execute(export_count_stmt)
            export_count = export_count_result.scalar() or 0
            
            return {
                "project_id": project_id,
                "component_count": component_count,
                "page_count": page_count,
                "export_count": export_count,
                "target_framework": project.target_framework,
                "version": project.version,
                "created_at": project.created_at,
                "updated_at": project.updated_at
            }
            
        except Exception as e:
            logger.error(f"Failed to get project statistics for {project_id}: {e}")
            raise