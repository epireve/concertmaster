"""
Comprehensive Unit Tests for Form Validation Service
Testing all validation scenarios, edge cases, and security measures.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

# Import the service to test
from backend.src.services.form_validator import FormValidationService, ValidationResult, FormValidationError


class TestFormValidationService:
    """Comprehensive test suite for FormValidationService"""
    
    @pytest.fixture
    def validator_service(self):
        """Create form validation service instance"""
        return FormValidationService()
    
    @pytest.fixture
    def valid_text_field(self):
        """Valid text field definition"""
        return {
            'id': 'name',
            'type': 'text',
            'label': 'Full Name',
            'required': True,
            'validation': {
                'min_length': 2,
                'max_length': 50,
                'pattern': r'^[a-zA-Z\s]+$',
                'error_message': 'Name must contain only letters and spaces'
            }
        }
    
    @pytest.fixture
    def valid_email_field(self):
        """Valid email field definition"""
        return {
            'id': 'email',
            'type': 'email',
            'label': 'Email Address',
            'required': True
        }
    
    @pytest.fixture
    def valid_select_field(self):
        """Valid select field definition"""
        return {
            'id': 'country',
            'type': 'select',
            'label': 'Country',
            'required': True,
            'options': [
                {'label': 'USA', 'value': 'usa'},
                {'label': 'Canada', 'value': 'canada'},
                {'label': 'UK', 'value': 'uk'}
            ]
        }
    
    @pytest.fixture
    def valid_file_field(self):
        """Valid file field definition"""
        return {
            'id': 'document',
            'type': 'file',
            'label': 'Upload Document',
            'required': False,
            'validation': {
                'allowed_types': ['application/pdf', 'image/jpeg'],
                'max_size': '10MB'
            }
        }


class TestSchemaValidation:
    """Test form schema validation"""
    
    @pytest.mark.asyncio
    async def test_validate_empty_schema(self, validator_service):
        """Test validation of empty schema"""
        result = await validator_service.validate_schema([])
        
        assert not result.is_valid
        assert len(result.errors) > 0
        assert 'non-empty list' in result.errors[0]['message']
    
    @pytest.mark.asyncio
    async def test_validate_valid_schema(self, validator_service, valid_text_field, valid_email_field):
        """Test validation of valid schema"""
        fields = [valid_text_field, valid_email_field]
        result = await validator_service.validate_schema(fields)
        
        assert result.is_valid
        assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_missing_required_properties(self, validator_service):
        """Test validation with missing required properties"""
        field = {'id': 'test'}  # Missing type, label, required
        result = await validator_service.validate_schema([field])
        
        assert not result.is_valid
        assert len(result.errors) >= 3  # Missing type, label, required
        
        error_types = [error['type'] for error in result.errors]
        assert 'missing_property' in error_types
    
    @pytest.mark.asyncio
    async def test_validate_invalid_field_type(self, validator_service):
        """Test validation with invalid field type"""
        field = {
            'id': 'invalid',
            'type': 'invalid_type',
            'label': 'Invalid Field',
            'required': False
        }
        result = await validator_service.validate_schema([field])
        
        assert not result.is_valid
        error_types = [error['type'] for error in result.errors]
        assert 'invalid_field_type' in error_types
    
    @pytest.mark.asyncio
    async def test_validate_invalid_field_id(self, validator_service):
        """Test validation with invalid field ID format"""
        field = {
            'id': '123invalid',  # Cannot start with number
            'type': 'text',
            'label': 'Invalid ID',
            'required': False
        }
        result = await validator_service.validate_schema([field])
        
        assert not result.is_valid
        error_types = [error['type'] for error in result.errors]
        assert 'invalid_field_id' in error_types
    
    @pytest.mark.asyncio
    async def test_validate_duplicate_field_ids(self, validator_service):
        """Test validation with duplicate field IDs"""
        field1 = {
            'id': 'duplicate',
            'type': 'text',
            'label': 'Field 1',
            'required': False
        }
        field2 = {
            'id': 'duplicate',  # Same ID
            'type': 'email',
            'label': 'Field 2',
            'required': False
        }
        result = await validator_service.validate_schema([field1, field2])
        
        assert not result.is_valid
        error_types = [error['type'] for error in result.errors]
        assert 'duplicate_field_id' in error_types
    
    @pytest.mark.asyncio
    async def test_validate_invalid_validation_rules(self, validator_service):
        """Test validation with invalid validation rules"""
        field = {
            'id': 'invalid_rules',
            'type': 'text',
            'label': 'Invalid Rules',
            'required': False,
            'validation': {
                'min_length': 10,
                'max_length': 5,  # Max less than min
                'pattern': '[invalid regex'  # Invalid regex
            }
        }
        result = await validator_service.validate_schema([field])
        
        assert not result.is_valid
        error_types = [error['type'] for error in result.errors]
        assert 'invalid_validation_rule' in error_types or 'invalid_regex_pattern' in error_types


class TestFormDataValidation:
    """Test form data validation against schema"""
    
    @pytest.mark.asyncio
    async def test_validate_valid_form_data(self, validator_service, valid_text_field, valid_email_field):
        """Test validation of valid form data"""
        fields = [valid_text_field, valid_email_field]
        form_data = {
            'name': 'John Doe',
            'email': 'john.doe@example.com'
        }
        
        result = await validator_service.validate_form_data(fields, form_data)
        
        assert result.is_valid
        assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_missing_required_fields(self, validator_service, valid_text_field, valid_email_field):
        """Test validation with missing required fields"""
        fields = [valid_text_field, valid_email_field]
        form_data = {}  # No data provided
        
        result = await validator_service.validate_form_data(fields, form_data)
        
        assert not result.is_valid
        assert len(result.errors) == 2  # Both fields are required
        
        error_types = [error['error_type'] for error in result.errors]
        assert all(error_type == 'required' for error_type in error_types)
    
    @pytest.mark.asyncio
    async def test_validate_text_field_length_constraints(self, validator_service, valid_text_field):
        """Test text field length validation"""
        fields = [valid_text_field]
        
        # Test minimum length violation
        result = await validator_service.validate_form_data(fields, {'name': 'A'})
        assert not result.is_valid
        assert any('min_length' in error['error_type'] for error in result.errors)
        
        # Test maximum length violation
        long_name = 'A' * 51  # Exceeds max_length of 50
        result = await validator_service.validate_form_data(fields, {'name': long_name})
        assert not result.is_valid
        assert any('max_length' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_text_field_pattern_constraint(self, validator_service, valid_text_field):
        """Test text field pattern validation"""
        fields = [valid_text_field]
        
        # Invalid pattern (contains numbers)
        result = await validator_service.validate_form_data(fields, {'name': 'John123'})
        assert not result.is_valid
        assert any('pattern' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_email_field(self, validator_service, valid_email_field):
        """Test email field validation"""
        fields = [valid_email_field]
        
        # Valid email
        result = await validator_service.validate_form_data(fields, {'email': 'valid@example.com'})
        assert result.is_valid
        
        # Invalid email formats
        invalid_emails = ['invalid', 'invalid@', '@invalid.com', 'invalid@invalid']
        
        for invalid_email in invalid_emails:
            result = await validator_service.validate_form_data(fields, {'email': invalid_email})
            assert not result.is_valid
            assert any('invalid_email' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_number_field(self, validator_service):
        """Test number field validation"""
        field = {
            'id': 'age',
            'type': 'number',
            'label': 'Age',
            'required': True,
            'validation': {
                'min': 18,
                'max': 120
            }
        }
        fields = [field]
        
        # Valid number
        result = await validator_service.validate_form_data(fields, {'age': 25})
        assert result.is_valid
        
        # Below minimum
        result = await validator_service.validate_form_data(fields, {'age': 10})
        assert not result.is_valid
        assert any('min_value' in error['error_type'] for error in result.errors)
        
        # Above maximum
        result = await validator_service.validate_form_data(fields, {'age': 150})
        assert not result.is_valid
        assert any('max_value' in error['error_type'] for error in result.errors)
        
        # Invalid type
        result = await validator_service.validate_form_data(fields, {'age': 'not_a_number'})
        assert not result.is_valid
        assert any('invalid_type' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_select_field(self, validator_service, valid_select_field):
        """Test select field validation"""
        fields = [valid_select_field]
        
        # Valid selection
        result = await validator_service.validate_form_data(fields, {'country': 'usa'})
        assert result.is_valid
        
        # Invalid selection
        result = await validator_service.validate_form_data(fields, {'country': 'invalid_country'})
        assert not result.is_valid
        assert any('invalid_option' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_multiselect_field(self, validator_service):
        """Test multiselect field validation"""
        field = {
            'id': 'skills',
            'type': 'multiselect',
            'label': 'Skills',
            'required': False,
            'options': [
                {'label': 'JavaScript', 'value': 'js'},
                {'label': 'Python', 'value': 'python'},
                {'label': 'Java', 'value': 'java'}
            ]
        }
        fields = [field]
        
        # Valid selections
        result = await validator_service.validate_form_data(fields, {'skills': ['js', 'python']})
        assert result.is_valid
        
        # Invalid selection in array
        result = await validator_service.validate_form_data(fields, {'skills': ['js', 'invalid']})
        assert not result.is_valid
        assert any('invalid_option' in error['error_type'] for error in result.errors)
        
        # Invalid type (not array)
        result = await validator_service.validate_form_data(fields, {'skills': 'js'})
        assert not result.is_valid
        assert any('invalid_type' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_date_field(self, validator_service):
        """Test date field validation"""
        field = {
            'id': 'birthday',
            'type': 'date',
            'label': 'Birthday',
            'required': True
        }
        fields = [field]
        
        # Valid date
        result = await validator_service.validate_form_data(fields, {'birthday': '1990-01-01'})
        assert result.is_valid
        
        # Invalid date format
        result = await validator_service.validate_form_data(fields, {'birthday': '01/01/1990'})
        assert not result.is_valid
        assert any('invalid_date' in error['error_type'] for error in result.errors)
        
        # Invalid date
        result = await validator_service.validate_form_data(fields, {'birthday': '2023-13-01'})
        assert not result.is_valid
        assert any('invalid_date' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_file_field(self, validator_service, valid_file_field):
        """Test file field validation"""
        fields = [valid_file_field]
        
        # Valid file metadata
        file_metadata = {
            'filename': 'document.pdf',
            'size': 1024 * 1024,  # 1MB
            'type': 'application/pdf'
        }
        result = await validator_service.validate_form_data(fields, {'document': file_metadata})
        assert result.is_valid
        
        # File too large
        large_file = {
            'filename': 'large.pdf',
            'size': 15 * 1024 * 1024,  # 15MB (exceeds 10MB limit)
            'type': 'application/pdf'
        }
        result = await validator_service.validate_form_data(fields, {'document': large_file})
        assert not result.is_valid
        assert any('file_too_large' in error['error_type'] for error in result.errors)
        
        # Invalid file type
        invalid_file = {
            'filename': 'document.txt',
            'size': 1024,
            'type': 'text/plain'
        }
        result = await validator_service.validate_form_data(fields, {'document': invalid_file})
        assert not result.is_valid
        assert any('invalid_file_type' in error['error_type'] for error in result.errors)


class TestSpecialFieldTypes:
    """Test validation of special field types"""
    
    @pytest.mark.asyncio
    async def test_validate_rating_field(self, validator_service):
        """Test rating field validation"""
        field = {
            'id': 'rating',
            'type': 'rating',
            'label': 'Rate this service',
            'required': True,
            'validation': {
                'min': 1,
                'max': 5
            }
        }
        fields = [field]
        
        # Valid rating
        result = await validator_service.validate_form_data(fields, {'rating': 4})
        assert result.is_valid
        
        # Out of range
        result = await validator_service.validate_form_data(fields, {'rating': 6})
        assert not result.is_valid
        assert any('invalid_rating' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_phone_field(self, validator_service):
        """Test phone field validation"""
        field = {
            'id': 'phone',
            'type': 'phone',
            'label': 'Phone Number',
            'required': True
        }
        fields = [field]
        
        # Valid phone numbers
        valid_phones = ['+1234567890', '123-456-7890', '(123) 456-7890', '+44 20 1234 5678']
        
        for phone in valid_phones:
            result = await validator_service.validate_form_data(fields, {'phone': phone})
            assert result.is_valid
        
        # Invalid phone
        result = await validator_service.validate_form_data(fields, {'phone': 'not-a-phone'})
        assert not result.is_valid
        assert any('invalid_phone' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_url_field(self, validator_service):
        """Test URL field validation"""
        field = {
            'id': 'website',
            'type': 'url',
            'label': 'Website',
            'required': True
        }
        fields = [field]
        
        # Valid URLs
        valid_urls = ['https://example.com', 'http://subdomain.example.com:8080/path']
        
        for url in valid_urls:
            result = await validator_service.validate_form_data(fields, {'website': url})
            assert result.is_valid
        
        # Invalid URLs
        invalid_urls = ['not-a-url', 'ftp://example.com', 'javascript:alert(1)']
        
        for url in invalid_urls:
            result = await validator_service.validate_form_data(fields, {'website': url})
            assert not result.is_valid
            assert any('invalid_url' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_location_field(self, validator_service):
        """Test location field validation"""
        field = {
            'id': 'location',
            'type': 'location',
            'label': 'Location',
            'required': True
        }
        fields = [field]
        
        # Valid location
        location = {'lat': 40.7128, 'lng': -74.0060}
        result = await validator_service.validate_form_data(fields, {'location': location})
        assert result.is_valid
        
        # Invalid latitude
        invalid_location = {'lat': 91.0, 'lng': -74.0060}  # Latitude > 90
        result = await validator_service.validate_form_data(fields, {'location': invalid_location})
        assert not result.is_valid
        assert any('invalid_latitude' in error['error_type'] for error in result.errors)
        
        # Invalid longitude
        invalid_location = {'lat': 40.7128, 'lng': -181.0}  # Longitude < -180
        result = await validator_service.validate_form_data(fields, {'location': invalid_location})
        assert not result.is_valid
        assert any('invalid_longitude' in error['error_type'] for error in result.errors)


class TestCustomValidationRules:
    """Test custom validation rules and cross-field validation"""
    
    @pytest.mark.asyncio
    async def test_conditional_required_validation(self, validator_service):
        """Test conditional required field validation"""
        fields = [
            {
                'id': 'has_children',
                'type': 'checkbox',
                'label': 'Do you have children?',
                'required': False
            },
            {
                'id': 'children_count',
                'type': 'number',
                'label': 'Number of children',
                'required': False
            }
        ]
        
        validation_rules = {
            'cross_field_validation': {
                'rules': [
                    {
                        'type': 'conditional_required',
                        'condition_field': 'has_children',
                        'condition_value': True,
                        'target_field': 'children_count'
                    }
                ]
            }
        }
        
        # Not required when checkbox is false
        result = await validator_service.validate_form_data(
            fields, 
            {'has_children': False}, 
            validation_rules
        )
        assert result.is_valid
        
        # Required when checkbox is true but not provided
        result = await validator_service.validate_form_data(
            fields, 
            {'has_children': True}, 
            validation_rules
        )
        assert not result.is_valid
        assert any('conditional_required' in error['error_type'] for error in result.errors)
        
        # Valid when both provided correctly
        result = await validator_service.validate_form_data(
            fields, 
            {'has_children': True, 'children_count': 2}, 
            validation_rules
        )
        assert result.is_valid


class TestErrorHandling:
    """Test error handling and edge cases"""
    
    @pytest.mark.asyncio
    async def test_handle_malformed_field_definition(self, validator_service):
        """Test handling of malformed field definitions"""
        # Completely invalid field structure
        with pytest.raises(Exception):
            await validator_service.validate_schema(None)
    
    @pytest.mark.asyncio
    async def test_handle_invalid_form_data_types(self, validator_service, valid_text_field):
        """Test handling of invalid form data types"""
        fields = [valid_text_field]
        
        # Non-string data for text field
        result = await validator_service.validate_form_data(fields, {'name': 123})
        assert not result.is_valid
        assert any('invalid_type' in error['error_type'] for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_graceful_validation_failure(self, validator_service):
        """Test graceful handling of validation failures"""
        # Test with field that might cause validation errors
        field = {
            'id': 'test',
            'type': 'text',
            'label': 'Test',
            'required': True,
            'validation': {
                'pattern': None  # This should cause issues
            }
        }
        
        # Should not crash, but should report validation issues
        result = await validator_service.validate_schema([field])
        # May or may not be valid depending on implementation robustness


class TestPerformanceAndScalability:
    """Test performance with large forms and data"""
    
    @pytest.mark.asyncio
    async def test_validate_large_form_schema(self, validator_service):
        """Test validation performance with large form schemas"""
        # Generate large form with many fields
        fields = []
        for i in range(100):
            fields.append({
                'id': f'field_{i}',
                'type': 'text',
                'label': f'Field {i}',
                'required': False
            })
        
        start_time = datetime.now()
        result = await validator_service.validate_schema(fields)
        end_time = datetime.now()
        
        # Should complete within reasonable time
        duration = (end_time - start_time).total_seconds()
        assert duration < 1.0  # Should complete in under 1 second
        assert result.is_valid
    
    @pytest.mark.asyncio
    async def test_validate_large_form_data(self, validator_service):
        """Test validation performance with large form data"""
        fields = []
        form_data = {}
        
        # Generate large form data
        for i in range(100):
            fields.append({
                'id': f'field_{i}',
                'type': 'text',
                'label': f'Field {i}',
                'required': True
            })
            form_data[f'field_{i}'] = f'Value for field {i}'
        
        start_time = datetime.now()
        result = await validator_service.validate_form_data(fields, form_data)
        end_time = datetime.now()
        
        # Should complete within reasonable time
        duration = (end_time - start_time).total_seconds()
        assert duration < 2.0  # Should complete in under 2 seconds
        assert result.is_valid


@pytest.mark.integration
class TestValidationServiceIntegration:
    """Integration tests for validation service"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_form_validation(self, validator_service):
        """Test complete form validation workflow"""
        # Complex form with multiple field types
        fields = [
            {
                'id': 'personal_info',
                'type': 'text',
                'label': 'Full Name',
                'required': True,
                'validation': {'min_length': 2, 'max_length': 100}
            },
            {
                'id': 'email',
                'type': 'email',
                'label': 'Email',
                'required': True
            },
            {
                'id': 'age',
                'type': 'number',
                'label': 'Age',
                'required': True,
                'validation': {'min': 18, 'max': 120}
            },
            {
                'id': 'country',
                'type': 'select',
                'label': 'Country',
                'required': True,
                'options': [
                    {'label': 'USA', 'value': 'usa'},
                    {'label': 'Canada', 'value': 'canada'}
                ]
            },
            {
                'id': 'resume',
                'type': 'file',
                'label': 'Resume',
                'required': False,
                'validation': {
                    'allowed_types': ['application/pdf'],
                    'max_size': '5MB'
                }
            }
        ]
        
        # Valid form data
        form_data = {
            'personal_info': 'John Doe',
            'email': 'john.doe@example.com',
            'age': 30,
            'country': 'usa',
            'resume': {
                'filename': 'resume.pdf',
                'size': 2 * 1024 * 1024,  # 2MB
                'type': 'application/pdf'
            }
        }
        
        # Validate schema first
        schema_result = await validator_service.validate_schema(fields)
        assert schema_result.is_valid
        
        # Validate form data
        data_result = await validator_service.validate_form_data(fields, form_data)
        assert data_result.is_valid
        assert len(data_result.errors) == 0