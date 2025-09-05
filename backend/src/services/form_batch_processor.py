"""
Form Batch Processing Service
Handles bulk operations for forms including batch submissions, imports, exports, and processing.
"""

import csv
import json
import uuid
import logging
import asyncio
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timezone
from io import StringIO, BytesIO
from pathlib import Path

import pandas as pd
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from pydantic import BaseModel, ValidationError

from ..database.connection import db_manager
from ..models.forms import FormSchema, FormResponse
from ..services.form_validator import FormValidationService
from ..services.form_processor import FormProcessingService
from ..services.notification_service import NotificationService
from ..config import settings

logger = logging.getLogger(__name__)


class BatchOperation(BaseModel):
    """Batch operation tracking model"""
    operation_id: str
    operation_type: str  # import, export, bulk_submit, bulk_process
    form_id: str
    status: str  # pending, processing, completed, failed
    total_records: int
    processed_records: int
    failed_records: int
    errors: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}
    started_at: datetime
    completed_at: Optional[datetime] = None
    processing_time_seconds: Optional[float] = None


class BatchImportResult(BaseModel):
    """Batch import operation result"""
    operation_id: str
    total_records: int
    imported_records: int
    failed_records: int
    validation_errors: List[Dict[str, Any]] = []
    processing_time_seconds: float
    success_rate: float


class BatchExportResult(BaseModel):
    """Batch export operation result"""
    operation_id: str
    export_file_path: str
    total_records: int
    file_size_bytes: int
    processing_time_seconds: float
    format: str


class FormBatchProcessor:
    """Service for batch form operations"""
    
    def __init__(self):
        self.validation_service = FormValidationService()
        self.processing_service = FormProcessingService()
        self.notification_service = NotificationService()
        
        # Batch processing limits
        self.max_batch_size = 10000
        self.chunk_size = 100
        self.max_concurrent_operations = 5
        
        # Export directory
        self.export_dir = Path(settings.upload_path) / "exports"
        self.export_dir.mkdir(parents=True, exist_ok=True)
    
    async def bulk_import_responses(
        self,
        form_id: str,
        import_data: List[Dict[str, Any]],
        validation_mode: str = "strict",  # strict, lenient, skip
        user_id: Optional[str] = None
    ) -> BatchImportResult:
        """Import multiple form responses in batch"""
        try:
            operation_id = str(uuid.uuid4())
            start_time = datetime.now(timezone.utc)
            
            logger.info(f"Starting bulk import: {operation_id} for form {form_id}")
            
            if len(import_data) > self.max_batch_size:
                raise ValueError(f"Batch size {len(import_data)} exceeds maximum {self.max_batch_size}")
            
            # Get form schema
            async with db_manager.get_session() as db:
                result = await db.execute(
                    select(FormSchema).where(FormSchema.id == form_id)
                )
                form_schema = result.scalar_one_or_none()
                
                if not form_schema:
                    raise ValueError(f"Form {form_id} not found")
            
            # Initialize counters
            total_records = len(import_data)
            imported_records = 0
            failed_records = 0
            validation_errors = []
            
            # Process in chunks to avoid memory issues
            for i in range(0, total_records, self.chunk_size):
                chunk = import_data[i:i + self.chunk_size]
                
                chunk_results = await self._process_import_chunk(
                    form_schema, chunk, validation_mode, user_id
                )
                
                imported_records += chunk_results["imported"]
                failed_records += chunk_results["failed"]
                validation_errors.extend(chunk_results["errors"])
                
                # Log progress
                processed = i + len(chunk)
                logger.info(f"Import progress: {processed}/{total_records} records processed")
            
            # Calculate metrics
            processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            success_rate = (imported_records / total_records * 100) if total_records > 0 else 0
            
            logger.info(f"✅ Bulk import completed: {imported_records}/{total_records} records imported")
            
            return BatchImportResult(
                operation_id=operation_id,
                total_records=total_records,
                imported_records=imported_records,
                failed_records=failed_records,
                validation_errors=validation_errors,
                processing_time_seconds=processing_time,
                success_rate=success_rate
            )
            
        except Exception as e:
            logger.error(f"❌ Bulk import failed: {e}")
            raise
    
    async def _process_import_chunk(
        self,
        form_schema: FormSchema,
        chunk: List[Dict[str, Any]],
        validation_mode: str,
        user_id: Optional[str]
    ) -> Dict[str, Any]:
        """Process a chunk of import data"""
        try:
            imported = 0
            failed = 0
            errors = []
            
            async with db_manager.get_session() as db:
                for record_index, record_data in enumerate(chunk):
                    try:
                        # Validate form data
                        if validation_mode in ["strict", "lenient"]:
                            validation_result = await self.validation_service.validate_form_data(
                                form_schema.fields,
                                record_data,
                                form_schema.validation_rules
                            )
                            
                            if not validation_result.is_valid:
                                if validation_mode == "strict":
                                    # Fail the record
                                    failed += 1
                                    errors.append({
                                        "record_index": record_index,
                                        "errors": validation_result.errors,
                                        "data": record_data
                                    })
                                    continue
                                else:  # lenient mode - log warnings but continue
                                    logger.warning(f"Validation warnings for record {record_index}: {validation_result.errors}")
                        
                        # Create form response
                        form_response = FormResponse(
                            id=uuid.uuid4(),
                            form_schema_id=form_schema.id,
                            data=record_data,
                            metadata={
                                "imported": True,
                                "import_timestamp": datetime.now(timezone.utc).isoformat(),
                                "imported_by": user_id
                            },
                            submitted_at=datetime.now(timezone.utc),
                            submitted_by=user_id,
                            status="submitted",
                            is_valid=True
                        )
                        
                        db.add(form_response)
                        imported += 1
                        
                    except Exception as e:
                        failed += 1
                        errors.append({
                            "record_index": record_index,
                            "error": str(e),
                            "data": record_data
                        })
                        logger.error(f"Failed to import record {record_index}: {e}")
                
                # Commit the chunk
                await db.commit()
            
            return {
                "imported": imported,
                "failed": failed,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Chunk processing failed: {e}")
            raise
    
    async def bulk_export_responses(
        self,
        form_id: str,
        export_format: str = "csv",  # csv, json, xlsx
        filters: Optional[Dict[str, Any]] = None,
        include_metadata: bool = True,
        date_range: Optional[Dict[str, datetime]] = None
    ) -> BatchExportResult:
        """Export form responses in batch"""
        try:
            operation_id = str(uuid.uuid4())
            start_time = datetime.now(timezone.utc)
            
            logger.info(f"Starting bulk export: {operation_id} for form {form_id}")
            
            # Build query for responses
            async with db_manager.get_session() as db:
                query = select(FormResponse).where(FormResponse.form_schema_id == form_id)
                
                # Apply date range filter
                if date_range:
                    if "start_date" in date_range:
                        query = query.where(FormResponse.submitted_at >= date_range["start_date"])
                    if "end_date" in date_range:
                        query = query.where(FormResponse.submitted_at <= date_range["end_date"])
                
                # Apply additional filters
                if filters:
                    # Add custom filter logic here
                    pass
                
                # Execute query
                result = await db.execute(query)
                responses = result.scalars().all()
                
                # Get form schema for field names
                schema_result = await db.execute(
                    select(FormSchema).where(FormSchema.id == form_id)
                )
                form_schema = schema_result.scalar_one_or_none()
            
            if not form_schema:
                raise ValueError(f"Form {form_id} not found")
            
            # Generate export file
            file_path = await self._generate_export_file(
                responses, form_schema, export_format, operation_id, include_metadata
            )
            
            # Calculate file size
            file_size = file_path.stat().st_size if file_path.exists() else 0
            processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            
            logger.info(f"✅ Bulk export completed: {len(responses)} records exported")
            
            return BatchExportResult(
                operation_id=operation_id,
                export_file_path=str(file_path),
                total_records=len(responses),
                file_size_bytes=file_size,
                processing_time_seconds=processing_time,
                format=export_format
            )
            
        except Exception as e:
            logger.error(f"❌ Bulk export failed: {e}")
            raise
    
    async def _generate_export_file(
        self,
        responses: List[FormResponse],
        form_schema: FormSchema,
        export_format: str,
        operation_id: str,
        include_metadata: bool
    ) -> Path:
        """Generate export file in specified format"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"form_export_{form_schema.name}_{timestamp}_{operation_id}.{export_format}"
            file_path = self.export_dir / filename
            
            if export_format == "csv":
                await self._export_to_csv(responses, form_schema, file_path, include_metadata)
            elif export_format == "json":
                await self._export_to_json(responses, form_schema, file_path, include_metadata)
            elif export_format == "xlsx":
                await self._export_to_excel(responses, form_schema, file_path, include_metadata)
            else:
                raise ValueError(f"Unsupported export format: {export_format}")
            
            return file_path
            
        except Exception as e:
            logger.error(f"Export file generation failed: {e}")
            raise
    
    async def _export_to_csv(
        self,
        responses: List[FormResponse],
        form_schema: FormSchema,
        file_path: Path,
        include_metadata: bool
    ):
        """Export responses to CSV format"""
        try:
            field_names = [field.get("id") for field in form_schema.fields if field.get("id")]
            
            # Add metadata columns if requested
            additional_columns = ["response_id", "submitted_at", "is_valid", "status"]
            if include_metadata:
                additional_columns.extend(["completion_time", "submitted_by", "ip_address"])
            
            all_columns = field_names + additional_columns
            
            with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=all_columns)
                writer.writeheader()
                
                for response in responses:
                    row = {}
                    
                    # Add form field data
                    for field_name in field_names:
                        row[field_name] = response.data.get(field_name, "")
                    
                    # Add metadata
                    row["response_id"] = str(response.id)
                    row["submitted_at"] = response.submitted_at.isoformat()
                    row["is_valid"] = response.is_valid
                    row["status"] = response.status
                    
                    if include_metadata:
                        row["completion_time"] = response.completion_time_seconds or ""
                        row["submitted_by"] = str(response.submitted_by) if response.submitted_by else ""
                        row["ip_address"] = response.metadata.get("ip_address", "") if response.metadata else ""
                    
                    writer.writerow(row)
            
            logger.info(f"CSV export completed: {file_path}")
            
        except Exception as e:
            logger.error(f"CSV export failed: {e}")
            raise
    
    async def _export_to_json(
        self,
        responses: List[FormResponse],
        form_schema: FormSchema,
        file_path: Path,
        include_metadata: bool
    ):
        """Export responses to JSON format"""
        try:
            export_data = {
                "form_info": {
                    "id": str(form_schema.id),
                    "name": form_schema.name,
                    "version": form_schema.version,
                    "fields": form_schema.fields
                },
                "export_info": {
                    "exported_at": datetime.now(timezone.utc).isoformat(),
                    "total_responses": len(responses),
                    "include_metadata": include_metadata
                },
                "responses": []
            }
            
            for response in responses:
                response_data = {
                    "id": str(response.id),
                    "data": response.data,
                    "submitted_at": response.submitted_at.isoformat(),
                    "is_valid": response.is_valid,
                    "status": response.status
                }
                
                if include_metadata:
                    response_data["metadata"] = response.metadata
                    response_data["completion_time_seconds"] = response.completion_time_seconds
                    response_data["submitted_by"] = str(response.submitted_by) if response.submitted_by else None
                    response_data["validation_errors"] = response.validation_errors
                
                export_data["responses"].append(response_data)
            
            with open(file_path, 'w', encoding='utf-8') as jsonfile:
                json.dump(export_data, jsonfile, indent=2, ensure_ascii=False)
            
            logger.info(f"JSON export completed: {file_path}")
            
        except Exception as e:
            logger.error(f"JSON export failed: {e}")
            raise
    
    async def _export_to_excel(
        self,
        responses: List[FormResponse],
        form_schema: FormSchema,
        file_path: Path,
        include_metadata: bool
    ):
        """Export responses to Excel format"""
        try:
            # Prepare data for DataFrame
            field_names = [field.get("id") for field in form_schema.fields if field.get("id")]
            
            data_rows = []
            for response in responses:
                row = {}
                
                # Add form field data
                for field_name in field_names:
                    value = response.data.get(field_name, "")
                    # Convert complex data types to strings
                    if isinstance(value, (dict, list)):
                        value = json.dumps(value)
                    row[field_name] = value
                
                # Add metadata
                row["response_id"] = str(response.id)
                row["submitted_at"] = response.submitted_at
                row["is_valid"] = response.is_valid
                row["status"] = response.status
                
                if include_metadata:
                    row["completion_time"] = response.completion_time_seconds
                    row["submitted_by"] = str(response.submitted_by) if response.submitted_by else ""
                    row["ip_address"] = response.metadata.get("ip_address", "") if response.metadata else ""
                
                data_rows.append(row)
            
            # Create DataFrame and export to Excel
            df = pd.DataFrame(data_rows)
            
            with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                # Main responses sheet
                df.to_excel(writer, sheet_name='Responses', index=False)
                
                # Form schema sheet
                schema_df = pd.DataFrame(form_schema.fields)
                schema_df.to_excel(writer, sheet_name='Form Schema', index=False)
                
                # Summary sheet
                summary_data = {
                    "Metric": ["Total Responses", "Valid Responses", "Invalid Responses", "Completion Rate"],
                    "Value": [
                        len(responses),
                        sum(1 for r in responses if r.is_valid),
                        sum(1 for r in responses if not r.is_valid),
                        f"{sum(1 for r in responses if r.is_valid) / len(responses) * 100:.2f}%" if responses else "0%"
                    ]
                }
                summary_df = pd.DataFrame(summary_data)
                summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            logger.info(f"Excel export completed: {file_path}")
            
        except Exception as e:
            logger.error(f"Excel export failed: {e}")
            raise
    
    async def import_from_file(
        self,
        form_id: str,
        file: UploadFile,
        mapping_config: Optional[Dict[str, str]] = None,
        validation_mode: str = "strict",
        user_id: Optional[str] = None
    ) -> BatchImportResult:
        """Import form responses from uploaded file"""
        try:
            logger.info(f"Starting file import for form: {form_id}")
            
            # Determine file format
            file_ext = Path(file.filename).suffix.lower()
            
            if file_ext == ".csv":
                import_data = await self._parse_csv_file(file, mapping_config)
            elif file_ext == ".json":
                import_data = await self._parse_json_file(file, mapping_config)
            elif file_ext in [".xlsx", ".xls"]:
                import_data = await self._parse_excel_file(file, mapping_config)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}")
            
            # Process the imported data
            return await self.bulk_import_responses(
                form_id, import_data, validation_mode, user_id
            )
            
        except Exception as e:
            logger.error(f"❌ File import failed: {e}")
            raise
    
    async def _parse_csv_file(
        self,
        file: UploadFile,
        mapping_config: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Parse CSV file for import"""
        try:
            content = await file.read()
            csv_text = content.decode('utf-8')
            
            csv_reader = csv.DictReader(StringIO(csv_text))
            import_data = []
            
            for row in csv_reader:
                # Apply field mapping if provided
                if mapping_config:
                    mapped_row = {}
                    for csv_field, form_field in mapping_config.items():
                        if csv_field in row:
                            mapped_row[form_field] = row[csv_field]
                    import_data.append(mapped_row)
                else:
                    import_data.append(dict(row))
            
            return import_data
            
        except Exception as e:
            logger.error(f"CSV parsing failed: {e}")
            raise
    
    async def _parse_json_file(
        self,
        file: UploadFile,
        mapping_config: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Parse JSON file for import"""
        try:
            content = await file.read()
            json_data = json.loads(content.decode('utf-8'))
            
            # Handle different JSON structures
            if isinstance(json_data, list):
                import_data = json_data
            elif isinstance(json_data, dict) and "responses" in json_data:
                import_data = json_data["responses"]
            else:
                raise ValueError("Invalid JSON structure - expected array or object with 'responses' key")
            
            # Apply field mapping if provided
            if mapping_config:
                mapped_data = []
                for record in import_data:
                    mapped_record = {}
                    for json_field, form_field in mapping_config.items():
                        if json_field in record:
                            mapped_record[form_field] = record[json_field]
                    mapped_data.append(mapped_record)
                return mapped_data
            
            return import_data
            
        except Exception as e:
            logger.error(f"JSON parsing failed: {e}")
            raise
    
    async def _parse_excel_file(
        self,
        file: UploadFile,
        mapping_config: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Parse Excel file for import"""
        try:
            content = await file.read()
            
            # Read Excel file
            df = pd.read_excel(BytesIO(content))
            
            # Convert to dictionary records
            import_data = df.to_dict('records')
            
            # Apply field mapping if provided
            if mapping_config:
                mapped_data = []
                for record in import_data:
                    mapped_record = {}
                    for excel_field, form_field in mapping_config.items():
                        if excel_field in record and pd.notna(record[excel_field]):
                            mapped_record[form_field] = record[excel_field]
                    mapped_data.append(mapped_record)
                return mapped_data
            
            # Clean up NaN values
            cleaned_data = []
            for record in import_data:
                cleaned_record = {k: v for k, v in record.items() if pd.notna(v)}
                cleaned_data.append(cleaned_record)
            
            return cleaned_data
            
        except Exception as e:
            logger.error(f"Excel parsing failed: {e}")
            raise
    
    async def bulk_process_responses(
        self,
        form_id: str,
        response_ids: List[str],
        processing_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process multiple form responses in batch"""
        try:
            operation_id = str(uuid.uuid4())
            start_time = datetime.now(timezone.utc)
            
            logger.info(f"Starting bulk processing: {operation_id} for {len(response_ids)} responses")
            
            # Get form schema
            async with db_manager.get_session() as db:
                schema_result = await db.execute(
                    select(FormSchema).where(FormSchema.id == form_id)
                )
                form_schema = schema_result.scalar_one_or_none()
                
                if not form_schema:
                    raise ValueError(f"Form {form_id} not found")
            
            # Process responses in chunks
            successful_responses = 0
            failed_responses = 0
            processing_errors = []
            
            for i in range(0, len(response_ids), self.chunk_size):
                chunk_ids = response_ids[i:i + self.chunk_size]
                
                # Process chunk
                for response_id in chunk_ids:
                    try:
                        success = await self.processing_service.process_form_response(
                            response_id, form_schema
                        )
                        if success:
                            successful_responses += 1
                        else:
                            failed_responses += 1
                            processing_errors.append({
                                "response_id": response_id,
                                "error": "Processing failed"
                            })
                    except Exception as e:
                        failed_responses += 1
                        processing_errors.append({
                            "response_id": response_id,
                            "error": str(e)
                        })
                        logger.error(f"Failed to process response {response_id}: {e}")
                
                # Log progress
                processed = i + len(chunk_ids)
                logger.info(f"Processing progress: {processed}/{len(response_ids)} responses processed")
            
            processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            
            logger.info(f"✅ Bulk processing completed: {successful_responses}/{len(response_ids)} responses processed successfully")
            
            return {
                "operation_id": operation_id,
                "total_responses": len(response_ids),
                "successful_responses": successful_responses,
                "failed_responses": failed_responses,
                "processing_errors": processing_errors,
                "processing_time_seconds": processing_time,
                "success_rate": (successful_responses / len(response_ids) * 100) if response_ids else 0
            }
            
        except Exception as e:
            logger.error(f"❌ Bulk processing failed: {e}")
            raise