"""
Form Versioning Service
Advanced versioning system for form schemas with migration support.
"""

import uuid
import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from ..models.forms import FormSchema, FormResponse
from ..database.connection import get_db_session

logger = logging.getLogger(__name__)


class VersionChangeType(str, Enum):
    """Types of version changes"""
    MAJOR = "major"  # Breaking changes
    MINOR = "minor"  # New features, backwards compatible
    PATCH = "patch"  # Bug fixes, no feature changes


class FormVersionDiff(BaseModel):
    """Represents differences between form versions"""
    change_type: VersionChangeType
    added_fields: List[Dict[str, Any]] = []
    removed_fields: List[Dict[str, Any]] = []
    modified_fields: List[Dict[str, Any]] = []
    field_mappings: Dict[str, str] = {}  # old_field_id -> new_field_id


class FormMigrationPlan(BaseModel):
    """Migration plan for form version upgrade"""
    from_version: str
    to_version: str
    diff: FormVersionDiff
    data_migration_required: bool
    backward_compatible: bool
    migration_steps: List[str] = []
    warnings: List[str] = []


class FormVersioningService:
    """Service for managing form schema versions"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    async def create_new_version(
        self,
        db: AsyncSession,
        schema_id: uuid.UUID,
        new_fields: List[Dict[str, Any]],
        version_notes: Optional[str] = None,
        change_type: VersionChangeType = VersionChangeType.MINOR
    ) -> FormSchema:
        """Create a new version of a form schema"""
        try:
            # Get current schema
            result = await db.execute(
                select(FormSchema).where(FormSchema.id == schema_id)
            )
            current_schema = result.scalar_one_or_none()
            
            if not current_schema:
                raise ValueError(f"Form schema not found: {schema_id}")
            
            # Calculate version differences
            diff = self._calculate_diff(current_schema.fields, new_fields)
            
            # Generate new version number
            new_version = self._increment_version(current_schema.version, change_type)
            
            # Create new schema version
            new_schema = FormSchema(
                id=uuid.uuid4(),
                name=current_schema.name,
                version=new_version,
                fields=new_fields,
                validation_rules=current_schema.validation_rules.copy(),
                metadata={
                    **current_schema.metadata,
                    "version_notes": version_notes,
                    "parent_version": current_schema.version,
                    "parent_id": str(current_schema.id),
                    "change_type": change_type.value,
                    "diff": diff.dict()
                },
                created_by=current_schema.created_by,
                created_at=datetime.now(timezone.utc)
            )
            
            # Deactivate previous version
            current_schema.is_active = False
            
            db.add(new_schema)
            await db.commit()
            await db.refresh(new_schema)
            
            self.logger.info(f"✅ Created new form version: {new_version}")
            return new_schema
            
        except Exception as e:
            self.logger.error(f"❌ Failed to create new version: {e}")
            await db.rollback()
            raise
    
    async def get_version_history(
        self,
        db: AsyncSession,
        schema_name: str
    ) -> List[FormSchema]:
        """Get version history for a form schema"""
        try:
            result = await db.execute(
                select(FormSchema)
                .where(FormSchema.name == schema_name)
                .order_by(desc(FormSchema.created_at))
            )
            return result.scalars().all()
            
        except Exception as e:
            self.logger.error(f"❌ Failed to get version history: {e}")
            raise
    
    async def create_migration_plan(
        self,
        from_schema: FormSchema,
        to_schema: FormSchema
    ) -> FormMigrationPlan:
        """Create migration plan between two form versions"""
        try:
            diff = self._calculate_diff(from_schema.fields, to_schema.fields)
            
            # Determine if data migration is required
            data_migration_required = bool(
                diff.removed_fields or 
                diff.modified_fields or 
                any(field.get('required', False) for field in diff.added_fields)
            )
            
            # Check backward compatibility
            backward_compatible = not diff.removed_fields and not any(
                field.get('type') != self._find_field_by_id(from_schema.fields, field['id']).get('type')
                for field in diff.modified_fields
                if self._find_field_by_id(from_schema.fields, field['id'])
            )
            
            # Generate migration steps
            steps = self._generate_migration_steps(diff)
            
            # Generate warnings
            warnings = self._generate_migration_warnings(diff, backward_compatible)
            
            return FormMigrationPlan(
                from_version=from_schema.version,
                to_version=to_schema.version,
                diff=diff,
                data_migration_required=data_migration_required,
                backward_compatible=backward_compatible,
                migration_steps=steps,
                warnings=warnings
            )
            
        except Exception as e:
            self.logger.error(f"❌ Failed to create migration plan: {e}")
            raise
    
    async def migrate_responses(
        self,
        db: AsyncSession,
        from_schema_id: uuid.UUID,
        to_schema_id: uuid.UUID,
        migration_plan: FormMigrationPlan
    ) -> int:
        """Migrate form responses from old schema to new schema"""
        try:
            if not migration_plan.data_migration_required:
                self.logger.info("No data migration required")
                return 0
            
            # Get responses to migrate
            result = await db.execute(
                select(FormResponse)
                .where(FormResponse.form_schema_id == from_schema_id)
                .where(FormResponse.status == "submitted")
            )
            responses = result.scalars().all()
            
            migrated_count = 0
            
            for response in responses:
                try:
                    # Apply field mappings and transformations
                    migrated_data = self._migrate_response_data(
                        response.data,
                        migration_plan.diff
                    )
                    
                    # Update response
                    response.data = migrated_data
                    response.form_schema_id = to_schema_id
                    response.metadata = {
                        **response.metadata,
                        "migrated_from": str(from_schema_id),
                        "migration_date": datetime.now(timezone.utc).isoformat()
                    }
                    
                    migrated_count += 1
                    
                except Exception as e:
                    self.logger.warning(f"Failed to migrate response {response.id}: {e}")
            
            await db.commit()
            
            self.logger.info(f"✅ Migrated {migrated_count} responses")
            return migrated_count
            
        except Exception as e:
            self.logger.error(f"❌ Failed to migrate responses: {e}")
            await db.rollback()
            raise
    
    def _calculate_diff(
        self,
        old_fields: List[Dict[str, Any]],
        new_fields: List[Dict[str, Any]]
    ) -> FormVersionDiff:
        """Calculate differences between field sets"""
        old_field_ids = {field['id']: field for field in old_fields}
        new_field_ids = {field['id']: field for field in new_fields}
        
        # Find changes
        added_fields = [
            field for field_id, field in new_field_ids.items()
            if field_id not in old_field_ids
        ]
        
        removed_fields = [
            field for field_id, field in old_field_ids.items()
            if field_id not in new_field_ids
        ]
        
        modified_fields = []
        field_mappings = {}
        
        for field_id, new_field in new_field_ids.items():
            if field_id in old_field_ids:
                old_field = old_field_ids[field_id]
                if self._fields_differ(old_field, new_field):
                    modified_fields.append({
                        'id': field_id,
                        'old': old_field,
                        'new': new_field
                    })
                field_mappings[field_id] = field_id
        
        # Determine change type
        if removed_fields or any(
            mod['old']['type'] != mod['new']['type'] 
            for mod in modified_fields
        ):
            change_type = VersionChangeType.MAJOR
        elif added_fields or modified_fields:
            change_type = VersionChangeType.MINOR
        else:
            change_type = VersionChangeType.PATCH
        
        return FormVersionDiff(
            change_type=change_type,
            added_fields=added_fields,
            removed_fields=removed_fields,
            modified_fields=modified_fields,
            field_mappings=field_mappings
        )
    
    def _increment_version(self, current_version: str, change_type: VersionChangeType) -> str:
        """Increment version number based on change type"""
        try:
            parts = current_version.split('.')
            major, minor, patch = map(int, parts)
            
            if change_type == VersionChangeType.MAJOR:
                major += 1
                minor = 0
                patch = 0
            elif change_type == VersionChangeType.MINOR:
                minor += 1
                patch = 0
            else:  # PATCH
                patch += 1
            
            return f"{major}.{minor}.{patch}"
            
        except Exception:
            # Fallback for invalid version strings
            return "1.0.0"
    
    def _fields_differ(self, old_field: Dict[str, Any], new_field: Dict[str, Any]) -> bool:
        """Check if two fields are different"""
        # Compare key properties that affect structure
        key_properties = ['type', 'required', 'label', 'validation', 'options']
        
        for prop in key_properties:
            if old_field.get(prop) != new_field.get(prop):
                return True
        
        return False
    
    def _find_field_by_id(self, fields: List[Dict[str, Any]], field_id: str) -> Optional[Dict[str, Any]]:
        """Find field by ID in field list"""
        return next((field for field in fields if field['id'] == field_id), None)
    
    def _generate_migration_steps(self, diff: FormVersionDiff) -> List[str]:
        """Generate human-readable migration steps"""
        steps = []
        
        if diff.added_fields:
            steps.append(f"Add {len(diff.added_fields)} new fields")
        
        if diff.removed_fields:
            steps.append(f"Remove {len(diff.removed_fields)} obsolete fields")
        
        if diff.modified_fields:
            steps.append(f"Update {len(diff.modified_fields)} existing fields")
        
        if diff.change_type == VersionChangeType.MAJOR:
            steps.append("Validate data compatibility for breaking changes")
        
        return steps
    
    def _generate_migration_warnings(self, diff: FormVersionDiff, backward_compatible: bool) -> List[str]:
        """Generate migration warnings"""
        warnings = []
        
        if not backward_compatible:
            warnings.append("This migration contains breaking changes")
        
        if diff.removed_fields:
            warnings.append(f"Data for {len(diff.removed_fields)} fields will be lost")
        
        if any(field.get('required', False) for field in diff.added_fields):
            warnings.append("New required fields may cause validation failures")
        
        return warnings
    
    def _migrate_response_data(
        self,
        response_data: Dict[str, Any],
        diff: FormVersionDiff
    ) -> Dict[str, Any]:
        """Migrate response data based on schema diff"""
        migrated_data = {}
        
        # Apply field mappings
        for old_id, new_id in diff.field_mappings.items():
            if old_id in response_data:
                migrated_data[new_id] = response_data[old_id]
        
        # Handle removed fields (data is lost)
        # Handle added fields (use default values if available)
        for field in diff.added_fields:
            field_id = field['id']
            if field_id not in migrated_data:
                default_value = field.get('defaultValue')
                if default_value is not None:
                    migrated_data[field_id] = default_value
        
        return migrated_data