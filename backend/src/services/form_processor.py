"""
Form Processing Service
Background processing for form responses including integrations, notifications, and workflows.
"""

import json
import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from enum import Enum

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from ..database.connection import db_manager
from ..models.forms import FormResponse, FormSchema, FormIntegration
from ..services.notification_service import NotificationService
from ..services.webhook_service import WebhookService
from ..config import settings

logger = logging.getLogger(__name__)


class ProcessingStatus(str, Enum):
    """Form response processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRY = "retry"


class FormProcessingService:
    """Service for processing form responses"""
    
    def __init__(self):
        self.notification_service = NotificationService()
        self.webhook_service = WebhookService()
        self.max_retries = 3
        self.retry_delays = [60, 300, 900]  # 1min, 5min, 15min
        
    async def process_form_response(self, response_id: str, schema: FormSchema) -> bool:
        """Process form response with all integrations"""
        try:
            logger.info(f"Processing form response: {response_id}")
            
            async with db_manager.get_session() as db:
                # Get form response
                result = await db.execute(
                    select(FormResponse).where(FormResponse.id == response_id)
                )
                response = result.scalar_one_or_none()
                
                if not response:
                    logger.error(f"Form response not found: {response_id}")
                    return False
                
                # Update processing status
                response.processing_status = ProcessingStatus.PROCESSING
                response.processed_at = datetime.now(timezone.utc)
                await db.commit()
                
                # Process all integrations
                processing_results = []
                
                # 1. Send notifications
                notification_result = await self._send_notifications(response, schema, db)
                processing_results.append(notification_result)
                
                # 2. Execute webhooks
                webhook_result = await self._execute_webhooks(response, schema, db)
                processing_results.append(webhook_result)
                
                # 3. Run workflow integrations
                workflow_result = await self._trigger_workflows(response, schema, db)
                processing_results.append(workflow_result)
                
                # 4. Update analytics
                analytics_result = await self._update_analytics(response, schema, db)
                processing_results.append(analytics_result)
                
                # 5. Custom processing rules
                custom_result = await self._apply_custom_processing(response, schema, db)
                processing_results.append(custom_result)
                
                # Determine overall status
                if all(processing_results):
                    response.processing_status = ProcessingStatus.COMPLETED
                    response.status = "processed"
                    logger.info(f"✅ Form response processed successfully: {response_id}")
                else:
                    response.processing_status = ProcessingStatus.FAILED
                    response.processing_error = "One or more processing steps failed"
                    logger.error(f"❌ Form response processing failed: {response_id}")
                
                await db.commit()
                return all(processing_results)
                
        except Exception as e:
            logger.error(f"❌ Form processing failed for {response_id}: {e}")
            
            # Update error status
            try:
                async with db_manager.get_session() as db:
                    await db.execute(
                        update(FormResponse)
                        .where(FormResponse.id == response_id)
                        .values(
                            processing_status=ProcessingStatus.FAILED,
                            processing_error=str(e),
                            processed_at=datetime.now(timezone.utc)
                        )
                    )
                    await db.commit()
            except Exception as db_error:
                logger.error(f"Failed to update error status: {db_error}")
            
            return False
    
    async def _send_notifications(self, response: FormResponse, schema: FormSchema, db: AsyncSession) -> bool:
        """Send email and other notifications"""
        try:
            logger.info(f"Sending notifications for response: {response.id}")
            
            # Extract notification settings from schema metadata
            notification_settings = schema.metadata.get('notifications', {})
            
            if not notification_settings.get('enabled', False):
                logger.info("Notifications disabled for this form")
                return True
            
            # Prepare notification data
            notification_data = {
                'form_name': schema.name,
                'form_id': str(schema.id),
                'response_id': str(response.id),
                'submitted_at': response.submitted_at.isoformat(),
                'form_data': response.data,
                'metadata': response.metadata
            }
            
            # Send admin notifications
            admin_emails = notification_settings.get('admin_emails', [])
            if admin_emails:
                await self.notification_service.send_admin_notification(
                    emails=admin_emails,
                    form_name=schema.name,
                    response_data=notification_data
                )
            
            # Send user confirmation
            user_email_field = notification_settings.get('user_email_field')
            if user_email_field and user_email_field in response.data:
                user_email = response.data[user_email_field]
                if user_email and '@' in user_email:
                    await self.notification_service.send_user_confirmation(
                        email=user_email,
                        form_name=schema.name,
                        response_data=notification_data
                    )
            
            # Send custom notifications
            custom_notifications = notification_settings.get('custom', [])
            for notification in custom_notifications:
                await self.notification_service.send_custom_notification(
                    notification_config=notification,
                    response_data=notification_data
                )
            
            logger.info(f"✅ Notifications sent for response: {response.id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send notifications: {e}")
            return False
    
    async def _execute_webhooks(self, response: FormResponse, schema: FormSchema, db: AsyncSession) -> bool:
        """Execute webhook integrations"""
        try:
            logger.info(f"Executing webhooks for response: {response.id}")
            
            # Get webhook integrations for this form
            webhook_result = await db.execute(
                select(FormIntegration).where(
                    and_(
                        FormIntegration.form_id == schema.id,
                        FormIntegration.type == "webhook",
                        FormIntegration.enabled == True
                    )
                )
            )
            webhooks = webhook_result.scalars().all()
            
            if not webhooks:
                logger.info("No webhooks configured for this form")
                return True
            
            # Prepare webhook payload
            webhook_payload = {
                'event': 'form.submitted',
                'form': {
                    'id': str(schema.id),
                    'name': schema.name,
                    'version': schema.version
                },
                'response': {
                    'id': str(response.id),
                    'data': response.data,
                    'metadata': response.metadata,
                    'submitted_at': response.submitted_at.isoformat()
                },
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            # Execute each webhook
            webhook_results = []
            for webhook in webhooks:
                try:
                    result = await self.webhook_service.execute_webhook(
                        webhook_config=webhook.config,
                        payload=webhook_payload
                    )
                    webhook_results.append(result)
                    
                    logger.info(f"Webhook executed: {webhook.id} -> {result}")
                    
                except Exception as e:
                    logger.error(f"Webhook execution failed: {webhook.id} -> {e}")
                    webhook_results.append(False)
            
            success_rate = sum(webhook_results) / len(webhook_results)
            logger.info(f"Webhook execution success rate: {success_rate:.2%}")
            
            return success_rate > 0.5  # Consider successful if >50% of webhooks succeeded
            
        except Exception as e:
            logger.error(f"❌ Failed to execute webhooks: {e}")
            return False
    
    async def _trigger_workflows(self, response: FormResponse, schema: FormSchema, db: AsyncSession) -> bool:
        """Trigger workflow executions"""
        try:
            logger.info(f"Triggering workflows for response: {response.id}")
            
            # Check if this response is already part of a workflow
            if response.workflow_run_id:
                logger.info(f"Response already part of workflow: {response.workflow_run_id}")
                return True
            
            # Get workflow integrations
            workflow_settings = schema.metadata.get('workflows', {})
            if not workflow_settings.get('enabled', False):
                logger.info("Workflows disabled for this form")
                return True
            
            # Prepare workflow trigger data
            trigger_data = {
                'trigger_type': 'form_submission',
                'form_id': str(schema.id),
                'response_id': str(response.id),
                'form_data': response.data,
                'metadata': response.metadata
            }
            
            # Get workflow templates to trigger
            trigger_workflows = workflow_settings.get('trigger_workflows', [])
            
            workflow_results = []
            for workflow_config in trigger_workflows:
                try:
                    # Check trigger conditions
                    if await self._check_workflow_conditions(workflow_config, response.data):
                        # Trigger workflow execution
                        workflow_result = await self._execute_workflow_trigger(
                            workflow_config,
                            trigger_data
                        )
                        workflow_results.append(workflow_result)
                        
                        logger.info(f"Workflow triggered: {workflow_config.get('id')} -> {workflow_result}")
                    else:
                        logger.info(f"Workflow conditions not met: {workflow_config.get('id')}")
                        workflow_results.append(True)  # Not an error, just conditions not met
                        
                except Exception as e:
                    logger.error(f"Failed to trigger workflow {workflow_config.get('id')}: {e}")
                    workflow_results.append(False)
            
            if not workflow_results:
                return True  # No workflows to trigger
                
            success_rate = sum(workflow_results) / len(workflow_results)
            logger.info(f"Workflow trigger success rate: {success_rate:.2%}")
            
            return success_rate > 0.5
            
        except Exception as e:
            logger.error(f"❌ Failed to trigger workflows: {e}")
            return False
    
    async def _check_workflow_conditions(self, workflow_config: Dict[str, Any], form_data: Dict[str, Any]) -> bool:
        """Check if workflow trigger conditions are met"""
        try:
            conditions = workflow_config.get('conditions', [])
            
            if not conditions:
                return True  # No conditions = always trigger
            
            # Evaluate each condition
            for condition in conditions:
                field = condition.get('field')
                operator = condition.get('operator')
                value = condition.get('value')
                
                if field not in form_data:
                    return False
                
                field_value = form_data[field]
                
                # Evaluate condition based on operator
                if operator == 'equals':
                    if field_value != value:
                        return False
                elif operator == 'not_equals':
                    if field_value == value:
                        return False
                elif operator == 'contains':
                    if isinstance(field_value, str) and value not in field_value:
                        return False
                elif operator == 'greater_than':
                    try:
                        if float(field_value) <= float(value):
                            return False
                    except (ValueError, TypeError):
                        return False
                elif operator == 'less_than':
                    try:
                        if float(field_value) >= float(value):
                            return False
                    except (ValueError, TypeError):
                        return False
                elif operator == 'in':
                    if isinstance(value, list) and field_value not in value:
                        return False
                elif operator == 'not_in':
                    if isinstance(value, list) and field_value in value:
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to check workflow conditions: {e}")
            return False
    
    async def _execute_workflow_trigger(self, workflow_config: Dict[str, Any], trigger_data: Dict[str, Any]) -> bool:
        """Execute workflow trigger (placeholder for workflow engine integration)"""
        try:
            workflow_id = workflow_config.get('workflow_id')
            workflow_endpoint = workflow_config.get('endpoint', '/api/v1/workflows/trigger')
            
            # Prepare workflow execution request
            workflow_request = {
                'workflow_id': workflow_id,
                'trigger_data': trigger_data,
                'execution_mode': 'async'
            }
            
            # Make HTTP request to workflow service
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://localhost:8000{workflow_endpoint}",
                    json=workflow_request,
                    timeout=30
                )
                
                if response.status_code in [200, 201, 202]:
                    logger.info(f"Workflow triggered successfully: {workflow_id}")
                    return True
                else:
                    logger.error(f"Workflow trigger failed: {response.status_code} {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to execute workflow trigger: {e}")
            return False
    
    async def _update_analytics(self, response: FormResponse, schema: FormSchema, db: AsyncSession) -> bool:
        """Update form analytics"""
        try:
            logger.info(f"Updating analytics for response: {response.id}")
            
            # Update form schema response count
            schema.response_count = (schema.response_count or 0) + 1
            
            # Calculate completion time if metadata has start time
            if 'started_at' in response.metadata:
                try:
                    started_at = datetime.fromisoformat(response.metadata['started_at'])
                    completion_time = (response.submitted_at - started_at).total_seconds()
                    response.completion_time_seconds = completion_time
                except (ValueError, TypeError):
                    logger.warning("Failed to calculate completion time")
            
            # Update field-level analytics
            await self._update_field_analytics(response, schema, db)
            
            await db.commit()
            
            logger.info(f"✅ Analytics updated for response: {response.id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to update analytics: {e}")
            return False
    
    async def _update_field_analytics(self, response: FormResponse, schema: FormSchema, db: AsyncSession) -> bool:
        """Update field-level analytics"""
        try:
            # This would integrate with a proper analytics service
            # For now, we'll just log field completion rates
            
            field_completion = {}
            total_fields = len(schema.fields)
            completed_fields = 0
            
            for field in schema.fields:
                field_id = field.get('id')
                if field_id in response.data and response.data[field_id] not in [None, '', []]:
                    completed_fields += 1
                    field_completion[field_id] = True
                else:
                    field_completion[field_id] = False
            
            completion_rate = completed_fields / total_fields if total_fields > 0 else 0
            
            logger.info(f"Form completion rate: {completion_rate:.2%} ({completed_fields}/{total_fields})")
            
            # Store analytics in metadata for now
            analytics_metadata = {
                'field_completion': field_completion,
                'completion_rate': completion_rate,
                'completed_fields': completed_fields,
                'total_fields': total_fields,
                'analyzed_at': datetime.now(timezone.utc).isoformat()
            }
            
            # Add to response metadata
            if not response.metadata:
                response.metadata = {}
            
            response.metadata['analytics'] = analytics_metadata
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update field analytics: {e}")
            return False
    
    async def _apply_custom_processing(self, response: FormResponse, schema: FormSchema, db: AsyncSession) -> bool:
        """Apply custom processing rules"""
        try:
            logger.info(f"Applying custom processing for response: {response.id}")
            
            # Get custom processing rules from schema metadata
            custom_rules = schema.metadata.get('custom_processing', {})
            
            if not custom_rules.get('enabled', False):
                logger.info("Custom processing disabled for this form")
                return True
            
            # Data transformation rules
            transformation_rules = custom_rules.get('transformations', [])
            for rule in transformation_rules:
                await self._apply_data_transformation(response, rule)
            
            # Data validation rules
            validation_rules = custom_rules.get('validations', [])
            for rule in validation_rules:
                validation_result = await self._apply_custom_validation(response, rule)
                if not validation_result:
                    logger.warning(f"Custom validation failed: {rule.get('name')}")
            
            # Data enrichment rules
            enrichment_rules = custom_rules.get('enrichments', [])
            for rule in enrichment_rules:
                await self._apply_data_enrichment(response, rule)
            
            await db.commit()
            
            logger.info(f"✅ Custom processing completed for response: {response.id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to apply custom processing: {e}")
            return False
    
    async def _apply_data_transformation(self, response: FormResponse, rule: Dict[str, Any]) -> bool:
        """Apply data transformation rule"""
        try:
            rule_type = rule.get('type')
            target_field = rule.get('field')
            
            if target_field not in response.data:
                return True
            
            if rule_type == 'uppercase':
                if isinstance(response.data[target_field], str):
                    response.data[target_field] = response.data[target_field].upper()
            
            elif rule_type == 'lowercase':
                if isinstance(response.data[target_field], str):
                    response.data[target_field] = response.data[target_field].lower()
            
            elif rule_type == 'trim':
                if isinstance(response.data[target_field], str):
                    response.data[target_field] = response.data[target_field].strip()
            
            elif rule_type == 'format_phone':
                if isinstance(response.data[target_field], str):
                    # Simple phone formatting
                    phone = ''.join(c for c in response.data[target_field] if c.isdigit())
                    if len(phone) == 10:
                        response.data[target_field] = f"({phone[:3]}) {phone[3:6]}-{phone[6:]}"
            
            elif rule_type == 'calculate':
                # Simple calculation based on other fields
                formula = rule.get('formula')
                if formula:
                    # This would need a safe expression evaluator
                    logger.info(f"Calculate transformation: {formula}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to apply data transformation: {e}")
            return False
    
    async def _apply_custom_validation(self, response: FormResponse, rule: Dict[str, Any]) -> bool:
        """Apply custom validation rule"""
        try:
            rule_type = rule.get('type')
            target_field = rule.get('field')
            
            if target_field not in response.data:
                return True
            
            field_value = response.data[target_field]
            
            if rule_type == 'business_logic':
                # Custom business logic validation
                logic = rule.get('logic')
                # This would implement specific business rules
                return True
            
            elif rule_type == 'external_validation':
                # Call external API for validation
                api_url = rule.get('api_url')
                if api_url:
                    async with httpx.AsyncClient() as client:
                        response_data = await client.post(
                            api_url,
                            json={'field': target_field, 'value': field_value},
                            timeout=10
                        )
                        return response_data.status_code == 200
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to apply custom validation: {e}")
            return False
    
    async def _apply_data_enrichment(self, response: FormResponse, rule: Dict[str, Any]) -> bool:
        """Apply data enrichment rule"""
        try:
            rule_type = rule.get('type')
            
            if rule_type == 'geolocation':
                # Enrich with geolocation data based on IP
                ip_address = response.metadata.get('ip_address')
                if ip_address:
                    # This would call a geolocation service
                    geo_data = {
                        'country': 'Unknown',
                        'city': 'Unknown',
                        'coordinates': [0, 0]
                    }
                    response.metadata['geolocation'] = geo_data
            
            elif rule_type == 'user_agent_parsing':
                # Parse user agent for device/browser info
                user_agent = response.metadata.get('user_agent')
                if user_agent:
                    # This would use a user agent parser
                    device_info = {
                        'device_type': 'desktop',
                        'browser': 'unknown',
                        'os': 'unknown'
                    }
                    response.metadata['device_info'] = device_info
            
            elif rule_type == 'timestamp_enrichment':
                # Add various timestamp formats
                submitted_at = response.submitted_at
                response.metadata['timestamps'] = {
                    'iso': submitted_at.isoformat(),
                    'unix': int(submitted_at.timestamp()),
                    'date_only': submitted_at.date().isoformat(),
                    'time_only': submitted_at.time().isoformat()
                }
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to apply data enrichment: {e}")
            return False
    
    async def retry_failed_processing(self, max_age_hours: int = 24) -> int:
        """Retry failed form response processing"""
        try:
            logger.info("Starting retry of failed form processing")
            
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
            
            async with db_manager.get_session() as db:
                # Find failed responses to retry
                result = await db.execute(
                    select(FormResponse).where(
                        and_(
                            FormResponse.processing_status == ProcessingStatus.FAILED,
                            FormResponse.submitted_at >= cutoff_time
                        )
                    ).limit(100)  # Process in batches
                )
                failed_responses = result.scalars().all()
                
                if not failed_responses:
                    logger.info("No failed responses to retry")
                    return 0
                
                retry_count = 0
                for response in failed_responses:
                    try:
                        # Get form schema
                        schema_result = await db.execute(
                            select(FormSchema).where(FormSchema.id == response.form_schema_id)
                        )
                        schema = schema_result.scalar_one_or_none()
                        
                        if schema:
                            success = await self.process_form_response(str(response.id), schema)
                            if success:
                                retry_count += 1
                                logger.info(f"✅ Retry successful: {response.id}")
                            else:
                                logger.error(f"❌ Retry failed: {response.id}")
                        
                    except Exception as e:
                        logger.error(f"Retry processing failed for {response.id}: {e}")
                
                logger.info(f"Retry processing completed: {retry_count}/{len(failed_responses)} successful")
                return retry_count
                
        except Exception as e:
            logger.error(f"❌ Failed to retry processing: {e}")
            return 0