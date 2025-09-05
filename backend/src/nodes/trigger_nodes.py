"""
ConcertMaster Trigger Nodes
Nodes that initiate workflow execution based on various triggers
"""

from typing import Dict, Any, List
import asyncio
from datetime import datetime, timedelta
import json
import logging
from email.utils import parseaddr
import re

from ..services.node_executor import TriggerNode
from ..services.cache_manager import CacheManager

logger = logging.getLogger(__name__)

class ScheduleTriggerNode(TriggerNode):
    """
    Trigger workflow execution based on cron schedule
    
    Configuration:
    - cron: Cron expression for scheduling
    - timezone: Timezone for schedule (default: UTC)
    - enabled: Whether trigger is active
    """
    
    node_type = "ScheduleTrigger"
    description = "Trigger workflow execution on a schedule using cron expressions"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute schedule trigger"""
        
        # This node doesn't execute during normal workflow run
        # It's handled by the scheduler service
        current_time = datetime.utcnow()
        
        return {
            "trigger_type": "schedule",
            "triggered_at": current_time.isoformat(),
            "cron_expression": self.config.get("cron", ""),
            "timezone": self.config.get("timezone", "UTC"),
            "input_data": input_data
        }
    
    async def should_trigger(self, context: Dict[str, Any]) -> bool:
        """Check if schedule trigger should fire"""
        
        # This would be called by the scheduler
        enabled = self.config.get("enabled", True)
        
        if not enabled:
            return False
        
        # Schedule checking is handled by WorkflowScheduler
        # This method is for manual trigger checks
        return True
    
    async def validate_config(self) -> List[str]:
        """Validate schedule trigger configuration"""
        
        errors = []
        
        cron_expr = self.config.get("cron") or self.config.get("cron_expression")
        if not cron_expr:
            errors.append("Schedule trigger requires 'cron' or 'cron_expression' field")
        else:
            # Validate cron expression format
            try:
                from croniter import croniter
                croniter(cron_expr)
            except Exception as e:
                errors.append(f"Invalid cron expression: {str(e)}")
        
        # Validate timezone if provided
        timezone = self.config.get("timezone", "UTC")
        if timezone:
            try:
                import pytz
                pytz.timezone(timezone)
            except Exception:
                errors.append(f"Invalid timezone: {timezone}")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "cron": {
                    "type": "string",
                    "title": "Cron Expression",
                    "description": "Cron expression for scheduling (e.g., '0 9 * * MON-FRI' for weekdays at 9 AM)",
                    "examples": [
                        "0 9 * * MON-FRI",  # Weekdays at 9 AM
                        "0 */6 * * *",       # Every 6 hours
                        "0 0 1 * *"          # First day of month
                    ]
                },
                "timezone": {
                    "type": "string",
                    "title": "Timezone",
                    "description": "Timezone for schedule execution",
                    "default": "UTC",
                    "examples": ["UTC", "America/New_York", "Europe/London"]
                },
                "enabled": {
                    "type": "boolean",
                    "title": "Enabled",
                    "description": "Whether the trigger is active",
                    "default": True
                }
            },
            "required": ["cron"],
            "additionalProperties": False
        }


class FormTriggerNode(TriggerNode):
    """
    Trigger workflow when form is submitted
    
    Configuration:
    - form_id: ID of the form to monitor
    - validation_rules: Additional validation rules
    - auto_approve: Whether to auto-approve valid submissions
    """
    
    node_type = "FormTrigger"
    description = "Trigger workflow execution when a form is submitted"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute form trigger"""
        
        form_id = self.config.get("form_id")
        form_response = input_data.get("form_response", {})
        
        # Apply additional validation if configured
        validation_result = await self._validate_form_response(form_response)
        
        return {
            "trigger_type": "form_submission",
            "form_id": form_id,
            "form_response": form_response,
            "validation_result": validation_result,
            "triggered_at": datetime.utcnow().isoformat(),
            "auto_approved": validation_result.get("is_valid", False) and self.config.get("auto_approve", False)
        }
    
    async def _validate_form_response(self, form_response: Dict[str, Any]) -> Dict[str, Any]:
        """Validate form response against additional rules"""
        
        validation_rules = self.config.get("validation_rules", {})
        errors = []
        warnings = []
        
        # Required field validation
        required_fields = validation_rules.get("required_fields", [])
        for field in required_fields:
            if field not in form_response or not form_response[field]:
                errors.append(f"Required field '{field}' is missing or empty")
        
        # Data type validation
        field_types = validation_rules.get("field_types", {})
        for field, expected_type in field_types.items():
            if field in form_response:
                value = form_response[field]
                if expected_type == "number" and not isinstance(value, (int, float)):
                    try:
                        float(value)
                    except (ValueError, TypeError):
                        errors.append(f"Field '{field}' must be a number")
                elif expected_type == "email" and not self._is_valid_email(str(value)):
                    errors.append(f"Field '{field}' must be a valid email address")
        
        # Range validation
        field_ranges = validation_rules.get("field_ranges", {})
        for field, range_config in field_ranges.items():
            if field in form_response:
                value = form_response[field]
                try:
                    numeric_value = float(value)
                    min_val = range_config.get("min")
                    max_val = range_config.get("max")
                    
                    if min_val is not None and numeric_value < min_val:
                        errors.append(f"Field '{field}' must be at least {min_val}")
                    if max_val is not None and numeric_value > max_val:
                        errors.append(f"Field '{field}' must be at most {max_val}")
                        
                except (ValueError, TypeError):
                    warnings.append(f"Could not validate range for non-numeric field '{field}'")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "validated_at": datetime.utcnow().isoformat()
        }
    
    def _is_valid_email(self, email: str) -> bool:
        """Basic email validation"""
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(email_pattern, email) is not None
    
    async def validate_config(self) -> List[str]:
        """Validate form trigger configuration"""
        
        errors = []
        
        form_id = self.config.get("form_id")
        if not form_id:
            errors.append("Form trigger requires 'form_id' field")
        
        # Validate validation rules structure
        validation_rules = self.config.get("validation_rules", {})
        if not isinstance(validation_rules, dict):
            errors.append("'validation_rules' must be an object")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "form_id": {
                    "type": "string",
                    "title": "Form ID",
                    "description": "ID of the form to monitor for submissions"
                },
                "validation_rules": {
                    "type": "object",
                    "title": "Validation Rules",
                    "description": "Additional validation rules for form responses",
                    "properties": {
                        "required_fields": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of required field names"
                        },
                        "field_types": {
                            "type": "object",
                            "description": "Expected data types for fields",
                            "additionalProperties": {
                                "enum": ["string", "number", "email", "boolean"]
                            }
                        },
                        "field_ranges": {
                            "type": "object",
                            "description": "Numeric range validation for fields",
                            "additionalProperties": {
                                "type": "object",
                                "properties": {
                                    "min": {"type": "number"},
                                    "max": {"type": "number"}
                                }
                            }
                        }
                    }
                },
                "auto_approve": {
                    "type": "boolean",
                    "title": "Auto Approve",
                    "description": "Automatically approve valid form submissions",
                    "default": False
                }
            },
            "required": ["form_id"],
            "additionalProperties": False
        }


class WebhookTriggerNode(TriggerNode):
    """
    Trigger workflow via HTTP webhook
    
    Configuration:
    - endpoint_path: Webhook endpoint path
    - authentication: Authentication configuration
    - allowed_methods: HTTP methods to accept
    """
    
    node_type = "WebhookTrigger"
    description = "Trigger workflow execution via HTTP webhook"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute webhook trigger"""
        
        webhook_data = input_data.get("webhook", {})
        
        # Validate authentication if required
        auth_result = await self._validate_authentication(webhook_data)
        
        return {
            "trigger_type": "webhook",
            "endpoint_path": self.config.get("endpoint_path"),
            "method": webhook_data.get("method", "POST"),
            "headers": webhook_data.get("headers", {}),
            "body": webhook_data.get("body", {}),
            "query_params": webhook_data.get("query_params", {}),
            "authentication": auth_result,
            "triggered_at": datetime.utcnow().isoformat()
        }
    
    async def _validate_authentication(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate webhook authentication"""
        
        auth_config = self.config.get("authentication", {})
        auth_type = auth_config.get("type", "none")
        
        if auth_type == "none":
            return {"type": "none", "valid": True}
        
        headers = webhook_data.get("headers", {})
        
        if auth_type == "bearer":
            auth_header = headers.get("Authorization", "")
            expected_token = auth_config.get("token", "")
            
            if auth_header.startswith("Bearer "):
                provided_token = auth_header[7:]  # Remove "Bearer " prefix
                is_valid = provided_token == expected_token
            else:
                is_valid = False
            
            return {
                "type": "bearer",
                "valid": is_valid,
                "token_provided": bool(auth_header)
            }
        
        elif auth_type == "api_key":
            key_header = auth_config.get("header", "X-API-Key")
            expected_key = auth_config.get("key", "")
            provided_key = headers.get(key_header, "")
            
            return {
                "type": "api_key",
                "valid": provided_key == expected_key,
                "key_provided": bool(provided_key)
            }
        
        elif auth_type == "signature":
            # HMAC signature validation (simplified)
            signature_header = auth_config.get("header", "X-Signature")
            provided_signature = headers.get(signature_header, "")
            
            # In real implementation, would validate HMAC signature
            return {
                "type": "signature",
                "valid": bool(provided_signature),  # Simplified validation
                "signature_provided": bool(provided_signature)
            }
        
        return {"type": auth_type, "valid": False, "error": "Unknown authentication type"}
    
    async def validate_config(self) -> List[str]:
        """Validate webhook trigger configuration"""
        
        errors = []
        
        endpoint_path = self.config.get("endpoint_path")
        if not endpoint_path:
            errors.append("Webhook trigger requires 'endpoint_path' field")
        elif not endpoint_path.startswith("/"):
            errors.append("Endpoint path must start with '/'")
        
        # Validate allowed methods
        allowed_methods = self.config.get("allowed_methods", ["POST"])
        valid_methods = {"GET", "POST", "PUT", "PATCH", "DELETE"}
        
        for method in allowed_methods:
            if method not in valid_methods:
                errors.append(f"Invalid HTTP method: {method}")
        
        # Validate authentication config
        auth_config = self.config.get("authentication", {})
        if auth_config:
            auth_type = auth_config.get("type", "none")
            
            if auth_type not in ["none", "bearer", "api_key", "signature"]:
                errors.append(f"Invalid authentication type: {auth_type}")
            
            if auth_type == "bearer" and not auth_config.get("token"):
                errors.append("Bearer authentication requires 'token' field")
            
            if auth_type == "api_key" and not auth_config.get("key"):
                errors.append("API key authentication requires 'key' field")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "endpoint_path": {
                    "type": "string",
                    "title": "Endpoint Path",
                    "description": "Webhook endpoint path (e.g., '/webhook/workflow-trigger')",
                    "pattern": "^/"
                },
                "allowed_methods": {
                    "type": "array",
                    "title": "Allowed Methods",
                    "description": "HTTP methods to accept",
                    "items": {
                        "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"]
                    },
                    "default": ["POST"]
                },
                "authentication": {
                    "type": "object",
                    "title": "Authentication",
                    "description": "Authentication configuration for webhook",
                    "properties": {
                        "type": {
                            "enum": ["none", "bearer", "api_key", "signature"],
                            "description": "Authentication method"
                        },
                        "token": {
                            "type": "string",
                            "description": "Bearer token (for bearer auth)"
                        },
                        "key": {
                            "type": "string", 
                            "description": "API key (for api_key auth)"
                        },
                        "header": {
                            "type": "string",
                            "description": "Header name for API key or signature",
                            "default": "X-API-Key"
                        }
                    },
                    "required": ["type"]
                }
            },
            "required": ["endpoint_path"],
            "additionalProperties": False
        }


class EmailTriggerNode(TriggerNode):
    """
    Trigger workflow when email is received
    
    Configuration:
    - email_pattern: Pattern to match incoming emails
    - attachment_handling: How to handle email attachments
    - sender_whitelist: Allowed sender email patterns
    """
    
    node_type = "EmailTrigger"
    description = "Trigger workflow execution when matching email is received"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute email trigger"""
        
        email_data = input_data.get("email", {})
        
        # Extract email information
        sender = email_data.get("sender", "")
        subject = email_data.get("subject", "")
        body = email_data.get("body", "")
        attachments = email_data.get("attachments", [])
        
        # Check if email matches pattern
        pattern_match = await self._check_email_pattern(email_data)
        
        # Process attachments if configured
        processed_attachments = await self._process_attachments(attachments)
        
        return {
            "trigger_type": "email",
            "sender": sender,
            "subject": subject,
            "body": body,
            "attachments": processed_attachments,
            "pattern_match": pattern_match,
            "received_at": email_data.get("received_at", datetime.utcnow().isoformat()),
            "triggered_at": datetime.utcnow().isoformat()
        }
    
    async def _check_email_pattern(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check if email matches configured patterns"""
        
        email_pattern = self.config.get("email_pattern", {})
        
        # Check sender whitelist
        sender_whitelist = self.config.get("sender_whitelist", [])
        sender = email_data.get("sender", "")
        sender_allowed = True
        
        if sender_whitelist:
            sender_allowed = any(
                re.search(pattern, sender, re.IGNORECASE) 
                for pattern in sender_whitelist
            )
        
        # Check subject pattern
        subject_pattern = email_pattern.get("subject")
        subject_match = True
        
        if subject_pattern:
            subject = email_data.get("subject", "")
            subject_match = bool(re.search(subject_pattern, subject, re.IGNORECASE))
        
        # Check body pattern
        body_pattern = email_pattern.get("body")
        body_match = True
        
        if body_pattern:
            body = email_data.get("body", "")
            body_match = bool(re.search(body_pattern, body, re.IGNORECASE))
        
        return {
            "sender_allowed": sender_allowed,
            "subject_match": subject_match,
            "body_match": body_match,
            "overall_match": sender_allowed and subject_match and body_match
        }
    
    async def _process_attachments(self, attachments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process email attachments based on configuration"""
        
        attachment_handling = self.config.get("attachment_handling", {})
        save_attachments = attachment_handling.get("save_attachments", True)
        allowed_types = attachment_handling.get("allowed_types", [])
        max_size_mb = attachment_handling.get("max_size_mb", 10)
        
        processed = []
        
        for attachment in attachments:
            filename = attachment.get("filename", "")
            content_type = attachment.get("content_type", "")
            size_bytes = attachment.get("size", 0)
            size_mb = size_bytes / (1024 * 1024)
            
            # Check file type
            type_allowed = True
            if allowed_types:
                file_extension = filename.split(".")[-1].lower()
                type_allowed = file_extension in allowed_types
            
            # Check size
            size_allowed = size_mb <= max_size_mb
            
            processed_attachment = {
                "filename": filename,
                "content_type": content_type,
                "size_bytes": size_bytes,
                "size_mb": round(size_mb, 2),
                "type_allowed": type_allowed,
                "size_allowed": size_allowed,
                "will_process": save_attachments and type_allowed and size_allowed
            }
            
            if processed_attachment["will_process"]:
                # In real implementation, would save attachment to storage
                processed_attachment["storage_path"] = f"attachments/{filename}"
            
            processed.append(processed_attachment)
        
        return processed
    
    async def validate_config(self) -> List[str]:
        """Validate email trigger configuration"""
        
        errors = []
        
        # Validate email pattern
        email_pattern = self.config.get("email_pattern", {})
        if email_pattern:
            subject_pattern = email_pattern.get("subject")
            if subject_pattern:
                try:
                    re.compile(subject_pattern)
                except re.error as e:
                    errors.append(f"Invalid subject pattern regex: {str(e)}")
            
            body_pattern = email_pattern.get("body")
            if body_pattern:
                try:
                    re.compile(body_pattern)
                except re.error as e:
                    errors.append(f"Invalid body pattern regex: {str(e)}")
        
        # Validate sender whitelist
        sender_whitelist = self.config.get("sender_whitelist", [])
        for pattern in sender_whitelist:
            try:
                re.compile(pattern)
            except re.error as e:
                errors.append(f"Invalid sender whitelist pattern '{pattern}': {str(e)}")
        
        # Validate attachment handling
        attachment_handling = self.config.get("attachment_handling", {})
        if attachment_handling:
            max_size_mb = attachment_handling.get("max_size_mb")
            if max_size_mb is not None and (not isinstance(max_size_mb, (int, float)) or max_size_mb <= 0):
                errors.append("max_size_mb must be a positive number")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "email_pattern": {
                    "type": "object",
                    "title": "Email Pattern",
                    "description": "Pattern matching for incoming emails",
                    "properties": {
                        "subject": {
                            "type": "string",
                            "description": "Regex pattern for email subject"
                        },
                        "body": {
                            "type": "string",
                            "description": "Regex pattern for email body"
                        }
                    }
                },
                "sender_whitelist": {
                    "type": "array",
                    "title": "Sender Whitelist",
                    "description": "List of allowed sender email patterns (regex)",
                    "items": {"type": "string"},
                    "examples": [[".*@company\\.com", "support@.*"]]
                },
                "attachment_handling": {
                    "type": "object",
                    "title": "Attachment Handling",
                    "description": "Configuration for email attachment processing",
                    "properties": {
                        "save_attachments": {
                            "type": "boolean",
                            "description": "Whether to save attachments",
                            "default": True
                        },
                        "allowed_types": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Allowed file extensions",
                            "examples": [["pdf", "xlsx", "csv", "json"]]
                        },
                        "max_size_mb": {
                            "type": "number",
                            "description": "Maximum attachment size in MB",
                            "default": 10,
                            "minimum": 0.1,
                            "maximum": 100
                        }
                    }
                }
            },
            "additionalProperties": False
        }