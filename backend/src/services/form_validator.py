"""
Form Validation Service
Comprehensive server-side validation for form schemas and data.
"""

import re
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, date
from email_validator import validate_email, EmailNotValidError
from pydantic import BaseModel, ValidationError
from jsonschema import validate, ValidationError as JsonSchemaValidationError

logger = logging.getLogger(__name__)


class ValidationResult(BaseModel):
    """Validation result model"""
    is_valid: bool
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    

class FormValidationError(BaseModel):
    """Form validation error model"""
    field_id: str
    error_type: str
    message: str
    value: Any = None
    

class FormValidationService:
    """Service for validating form schemas and data"""
    
    def __init__(self):
        self.field_validators = {
            'text': self._validate_text_field,
            'textarea': self._validate_textarea_field,
            'email': self._validate_email_field,
            'number': self._validate_number_field,
            'integer': self._validate_integer_field,
            'float': self._validate_float_field,
            'select': self._validate_select_field,
            'multiselect': self._validate_multiselect_field,
            'radio': self._validate_radio_field,
            'checkbox': self._validate_checkbox_field,
            'date': self._validate_date_field,
            'datetime': self._validate_datetime_field,
            'file': self._validate_file_field,
            'url': self._validate_url_field,
            'phone': self._validate_phone_field,
            'currency': self._validate_currency_field,
            'rating': self._validate_rating_field,
            'matrix': self._validate_matrix_field,
            'signature': self._validate_signature_field,
            'location': self._validate_location_field,
        }
    
    async def validate_schema(self, fields: List[Dict[str, Any]]) -> ValidationResult:
        """Validate form schema structure"""
        errors = []
        warnings = []
        
        try:
            # Validate basic structure
            if not isinstance(fields, list) or len(fields) == 0:
                errors.append({
                    "type": "schema_structure",
                    "message": "Fields must be a non-empty list"
                })
                return ValidationResult(is_valid=False, errors=errors)
            
            field_ids = set()
            
            # Validate each field
            for i, field in enumerate(fields):
                field_errors = await self._validate_field_definition(field, i)
                errors.extend(field_errors)
                
                # Check for duplicate field IDs
                field_id = field.get('id')
                if field_id:
                    if field_id in field_ids:
                        errors.append({
                            "type": "duplicate_field_id",
                            "message": f"Duplicate field ID: {field_id}",
                            "field_index": i
                        })
                    field_ids.add(field_id)
            
            # Validate conditional logic references
            conditional_errors = await self._validate_conditional_logic(fields)
            errors.extend(conditional_errors)
            
            return ValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"Schema validation failed: {e}")
            errors.append({
                "type": "validation_error",
                "message": f"Schema validation failed: {str(e)}"
            })
            return ValidationResult(is_valid=False, errors=errors)
    
    async def _validate_field_definition(self, field: Dict[str, Any], index: int) -> List[Dict[str, Any]]:
        """Validate individual field definition"""
        errors = []
        
        # Required properties
        required_props = ['id', 'type', 'label', 'required']
        for prop in required_props:
            if prop not in field:
                errors.append({
                    "type": "missing_property",
                    "message": f"Field missing required property: {prop}",
                    "field_index": index,
                    "property": prop
                })
        
        # Validate field type
        field_type = field.get('type')
        if field_type and field_type not in self.field_validators:
            errors.append({
                "type": "invalid_field_type",
                "message": f"Invalid field type: {field_type}",
                "field_index": index,
                "field_type": field_type
            })
        
        # Validate field ID format
        field_id = field.get('id')
        if field_id and not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', field_id):
            errors.append({
                "type": "invalid_field_id",
                "message": f"Field ID must start with letter and contain only letters, numbers, and underscores: {field_id}",
                "field_index": index,
                "field_id": field_id
            })
        
        # Validate validation rules if present
        if 'validation' in field:
            validation_errors = await self._validate_field_validation_rules(field, index)
            errors.extend(validation_errors)
        
        return errors
    
    async def _validate_field_validation_rules(self, field: Dict[str, Any], index: int) -> List[Dict[str, Any]]:
        """Validate field-specific validation rules"""
        errors = []
        validation = field.get('validation', {})
        field_type = field.get('type')
        
        # Type-specific validation rule checks
        if field_type in ['text', 'textarea']:
            if 'min_length' in validation and 'max_length' in validation:
                if validation['min_length'] > validation['max_length']:
                    errors.append({
                        "type": "invalid_validation_rule",
                        "message": "min_length cannot be greater than max_length",
                        "field_index": index,
                        "field_id": field.get('id')
                    })
        
        if field_type == 'number':
            if 'min' in validation and 'max' in validation:
                if validation['min'] > validation['max']:
                    errors.append({
                        "type": "invalid_validation_rule",
                        "message": "min value cannot be greater than max value",
                        "field_index": index,
                        "field_id": field.get('id')
                    })
        
        # Validate regex pattern if present
        if 'pattern' in validation:
            try:
                re.compile(validation['pattern'])
            except re.error as e:
                errors.append({
                    "type": "invalid_regex_pattern",
                    "message": f"Invalid regex pattern: {str(e)}",
                    "field_index": index,
                    "field_id": field.get('id')
                })
        
        return errors
    
    async def _validate_conditional_logic(self, fields: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate conditional logic references"""
        errors = []
        field_ids = {field.get('id') for field in fields if field.get('id')}
        
        for i, field in enumerate(fields):
            if 'conditional' in field:
                conditional = field['conditional']
                if 'field_id' in conditional:
                    ref_field_id = conditional['field_id']
                    if ref_field_id not in field_ids:
                        errors.append({
                            "type": "invalid_conditional_reference",
                            "message": f"Conditional logic references non-existent field: {ref_field_id}",
                            "field_index": i,
                            "field_id": field.get('id')
                        })
        
        return errors
    
    async def validate_form_data(
        self,
        fields: List[Dict[str, Any]],
        form_data: Dict[str, Any],
        validation_rules: Dict[str, Any] = None
    ) -> ValidationResult:
        """Validate form data against schema"""
        errors = []
        warnings = []
        
        try:
            # Create field lookup
            field_lookup = {field['id']: field for field in fields if field.get('id')}
            
            # Validate required fields
            for field in fields:
                field_id = field.get('id')
                is_required = field.get('required', False)
                
                if is_required and (field_id not in form_data or form_data[field_id] in [None, '', []]):
                    errors.append({
                        "field_id": field_id,
                        "error_type": "required",
                        "message": f"Field '{field.get('label', field_id)}' is required"
                    })
            
            # Validate each submitted field
            for field_id, value in form_data.items():
                if field_id in field_lookup:
                    field = field_lookup[field_id]
                    field_errors = await self._validate_field_value(field, value)
                    errors.extend(field_errors)
            
            # Apply custom validation rules
            if validation_rules:
                custom_errors = await self._apply_custom_validation_rules(
                    form_data, validation_rules, field_lookup
                )
                errors.extend(custom_errors)
            
            return ValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"Form data validation failed: {e}")
            errors.append({
                "field_id": "",
                "error_type": "validation_error",
                "message": f"Form validation failed: {str(e)}"
            })
            return ValidationResult(is_valid=False, errors=errors)
    
    async def _validate_field_value(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate individual field value"""
        field_type = field.get('type')
        field_id = field.get('id')
        
        validator = self.field_validators.get(field_type)
        if not validator:
            return [{
                "field_id": field_id,
                "error_type": "unknown_field_type",
                "message": f"Unknown field type: {field_type}"
            }]
        
        try:
            return await validator(field, value)
        except Exception as e:
            logger.error(f"Field validation failed for {field_id}: {e}")
            return [{
                "field_id": field_id,
                "error_type": "validation_error",
                "message": f"Field validation failed: {str(e)}"
            }]
    
    # Field-specific validators
    async def _validate_text_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate text field"""
        errors = []
        field_id = field.get('id')
        validation = field.get('validation', {})
        
        if value is None or value == '':
            return errors  # Required validation handled separately
        
        if not isinstance(value, str):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Value must be a string"
            })
            return errors
        
        # Length validation
        if 'min_length' in validation and len(value) < validation['min_length']:
            errors.append({
                "field_id": field_id,
                "error_type": "min_length",
                "message": f"Minimum length is {validation['min_length']} characters"
            })
        
        if 'max_length' in validation and len(value) > validation['max_length']:
            errors.append({
                "field_id": field_id,
                "error_type": "max_length",
                "message": f"Maximum length is {validation['max_length']} characters"
            })
        
        # Pattern validation
        if 'pattern' in validation:
            try:
                if not re.match(validation['pattern'], value):
                    errors.append({
                        "field_id": field_id,
                        "error_type": "pattern",
                        "message": validation.get('error_message', "Value doesn't match required pattern")
                    })
            except re.error:
                errors.append({
                    "field_id": field_id,
                    "error_type": "pattern_error",
                    "message": "Invalid pattern in field validation"
                })
        
        return errors
    
    async def _validate_textarea_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate textarea field (same as text field)"""
        return await self._validate_text_field(field, value)
    
    async def _validate_email_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate email field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == '':
            return errors
        
        if not isinstance(value, str):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Email must be a string"
            })
            return errors
        
        try:
            validate_email(value)
        except EmailNotValidError as e:
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_email",
                "message": "Invalid email address format"
            })
        
        return errors
    
    async def _validate_number_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate number field"""
        errors = []
        field_id = field.get('id')
        validation = field.get('validation', {})
        
        if value is None or value == '':
            return errors
        
        try:
            num_value = float(value) if not isinstance(value, (int, float)) else value
        except (ValueError, TypeError):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Value must be a number"
            })
            return errors
        
        # Range validation
        if 'min' in validation and num_value < validation['min']:
            errors.append({
                "field_id": field_id,
                "error_type": "min_value",
                "message": f"Minimum value is {validation['min']}"
            })
        
        if 'max' in validation and num_value > validation['max']:
            errors.append({
                "field_id": field_id,
                "error_type": "max_value",
                "message": f"Maximum value is {validation['max']}"
            })
        
        return errors
    
    async def _validate_integer_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate integer field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == '':
            return errors
        
        try:
            int_value = int(value) if not isinstance(value, int) else value
            if isinstance(value, str) and '.' in value:
                raise ValueError("Not an integer")
        except (ValueError, TypeError):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Value must be an integer"
            })
            return errors
        
        # Use number validation for range checks
        return await self._validate_number_field(field, int_value)
    
    async def _validate_float_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate float field (same as number)"""
        return await self._validate_number_field(field, value)
    
    async def _validate_select_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate select field"""
        errors = []
        field_id = field.get('id')
        options = field.get('options', [])
        
        if value is None or value == '':
            return errors
        
        if not isinstance(value, str):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Selected value must be a string"
            })
            return errors
        
        # Check if value is in options
        valid_values = [option.get('value') if isinstance(option, dict) else option for option in options]
        if value not in valid_values:
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_option",
                "message": "Selected value is not a valid option"
            })
        
        return errors
    
    async def _validate_multiselect_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate multiselect field"""
        errors = []
        field_id = field.get('id')
        options = field.get('options', [])
        
        if value is None or value == [] or value == '':
            return errors
        
        if not isinstance(value, list):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Selected values must be an array"
            })
            return errors
        
        # Check each selected value
        valid_values = [option.get('value') if isinstance(option, dict) else option for option in options]
        for selected_value in value:
            if selected_value not in valid_values:
                errors.append({
                    "field_id": field_id,
                    "error_type": "invalid_option",
                    "message": f"Selected value '{selected_value}' is not a valid option"
                })
                break  # Don't spam errors for multiple invalid values
        
        return errors
    
    async def _validate_radio_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate radio field (same as select)"""
        return await self._validate_select_field(field, value)
    
    async def _validate_checkbox_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate checkbox field"""
        errors = []
        field_id = field.get('id')
        
        if value is None:
            return errors
        
        if not isinstance(value, bool):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Checkbox value must be true or false"
            })
        
        return errors
    
    async def _validate_date_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate date field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == '':
            return errors
        
        try:
            if isinstance(value, str):
                datetime.strptime(value, '%Y-%m-%d')
            elif not isinstance(value, (datetime, date)):
                raise ValueError("Invalid date format")
        except ValueError:
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_date",
                "message": "Invalid date format. Expected YYYY-MM-DD"
            })
        
        return errors
    
    async def _validate_datetime_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate datetime field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == '':
            return errors
        
        try:
            if isinstance(value, str):
                # Try multiple datetime formats
                formats = ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%SZ']
                parsed = False
                for fmt in formats:
                    try:
                        datetime.strptime(value, fmt)
                        parsed = True
                        break
                    except ValueError:
                        continue
                if not parsed:
                    raise ValueError("Invalid datetime format")
            elif not isinstance(value, datetime):
                raise ValueError("Invalid datetime format")
        except ValueError:
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_datetime",
                "message": "Invalid datetime format. Expected ISO format"
            })
        
        return errors
    
    async def _validate_file_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate file field"""
        errors = []
        field_id = field.get('id')
        validation = field.get('validation', {})
        
        if value is None or value == '':
            return errors
        
        # For file fields, value should be file metadata or file ID
        if isinstance(value, dict):
            # File metadata validation
            required_keys = ['filename', 'size', 'type']
            for key in required_keys:
                if key not in value:
                    errors.append({
                        "field_id": field_id,
                        "error_type": "invalid_file_metadata",
                        "message": f"File metadata missing: {key}"
                    })
                    return errors
            
            # Validate file size
            if 'max_size' in validation:
                max_size_bytes = self._parse_size_string(validation['max_size'])
                if value['size'] > max_size_bytes:
                    errors.append({
                        "field_id": field_id,
                        "error_type": "file_too_large",
                        "message": f"File size exceeds limit of {validation['max_size']}"
                    })
            
            # Validate file type
            if 'allowed_types' in validation:
                file_type = value.get('type', '')
                if file_type not in validation['allowed_types']:
                    errors.append({
                        "field_id": field_id,
                        "error_type": "invalid_file_type",
                        "message": f"File type '{file_type}' not allowed"
                    })
        
        return errors
    
    async def _validate_url_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate URL field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == '':
            return errors
        
        if not isinstance(value, str):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "URL must be a string"
            })
            return errors
        
        # Basic URL validation
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        if not url_pattern.match(value):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_url",
                "message": "Invalid URL format"
            })
        
        return errors
    
    async def _validate_phone_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate phone field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == '':
            return errors
        
        if not isinstance(value, str):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Phone number must be a string"
            })
            return errors
        
        # Basic phone validation (international format)
        phone_pattern = re.compile(r'^\+?[\d\s\-\(\)]{10,15}$')
        if not phone_pattern.match(value):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_phone",
                "message": "Invalid phone number format"
            })
        
        return errors
    
    async def _validate_currency_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate currency field"""
        return await self._validate_number_field(field, value)
    
    async def _validate_rating_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate rating field"""
        errors = []
        field_id = field.get('id')
        validation = field.get('validation', {})
        
        if value is None or value == '':
            return errors
        
        try:
            rating_value = float(value) if not isinstance(value, (int, float)) else value
        except (ValueError, TypeError):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Rating must be a number"
            })
            return errors
        
        # Default rating range
        min_rating = validation.get('min', 1)
        max_rating = validation.get('max', 5)
        
        if rating_value < min_rating or rating_value > max_rating:
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_rating",
                "message": f"Rating must be between {min_rating} and {max_rating}"
            })
        
        return errors
    
    async def _validate_matrix_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate matrix field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == {}:
            return errors
        
        if not isinstance(value, dict):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Matrix value must be an object"
            })
        
        return errors
    
    async def _validate_signature_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate signature field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == '':
            return errors
        
        if not isinstance(value, str):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Signature must be a string (base64)"
            })
            return errors
        
        # Basic base64 validation
        if not re.match(r'^data:image/[a-zA-Z]+;base64,', value):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_signature",
                "message": "Invalid signature format"
            })
        
        return errors
    
    async def _validate_location_field(self, field: Dict[str, Any], value: Any) -> List[Dict[str, Any]]:
        """Validate location field"""
        errors = []
        field_id = field.get('id')
        
        if value is None or value == {}:
            return errors
        
        if not isinstance(value, dict):
            errors.append({
                "field_id": field_id,
                "error_type": "invalid_type",
                "message": "Location must be an object"
            })
            return errors
        
        # Validate latitude and longitude
        if 'lat' in value and 'lng' in value:
            try:
                lat = float(value['lat'])
                lng = float(value['lng'])
                
                if lat < -90 or lat > 90:
                    errors.append({
                        "field_id": field_id,
                        "error_type": "invalid_latitude",
                        "message": "Latitude must be between -90 and 90"
                    })
                
                if lng < -180 or lng > 180:
                    errors.append({
                        "field_id": field_id,
                        "error_type": "invalid_longitude",
                        "message": "Longitude must be between -180 and 180"
                    })
                    
            except (ValueError, TypeError):
                errors.append({
                    "field_id": field_id,
                    "error_type": "invalid_coordinates",
                    "message": "Coordinates must be numbers"
                })
        
        return errors
    
    async def _apply_custom_validation_rules(
        self,
        form_data: Dict[str, Any],
        validation_rules: Dict[str, Any],
        field_lookup: Dict[str, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Apply custom validation rules"""
        errors = []
        
        # Apply cross-field validation rules
        for rule_name, rule_config in validation_rules.items():
            if rule_name == 'cross_field_validation':
                for rule in rule_config.get('rules', []):
                    rule_errors = await self._validate_cross_field_rule(rule, form_data, field_lookup)
                    errors.extend(rule_errors)
        
        return errors
    
    async def _validate_cross_field_rule(
        self,
        rule: Dict[str, Any],
        form_data: Dict[str, Any],
        field_lookup: Dict[str, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Validate cross-field validation rule"""
        errors = []
        
        rule_type = rule.get('type')
        if rule_type == 'conditional_required':
            # Field is required if another field has specific value
            target_field = rule.get('target_field')
            condition_field = rule.get('condition_field')
            condition_value = rule.get('condition_value')
            
            if condition_field in form_data and form_data[condition_field] == condition_value:
                if target_field not in form_data or form_data[target_field] in [None, '', []]:
                    field_label = field_lookup.get(target_field, {}).get('label', target_field)
                    errors.append({
                        "field_id": target_field,
                        "error_type": "conditional_required",
                        "message": f"Field '{field_label}' is required"
                    })
        
        return errors
    
    def _parse_size_string(self, size_str: str) -> int:
        """Parse size string like '10MB' to bytes"""
        size_str = size_str.upper().strip()
        
        multipliers = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 ** 2,
            'GB': 1024 ** 3,
            'TB': 1024 ** 4
        }
        
        for unit, multiplier in multipliers.items():
            if size_str.endswith(unit):
                try:
                    size_num = float(size_str[:-len(unit)])
                    return int(size_num * multiplier)
                except ValueError:
                    break
        
        # Default to bytes if no unit specified
        try:
            return int(float(size_str))
        except ValueError:
            return 0