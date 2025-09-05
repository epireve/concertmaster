"""
Comprehensive Tests for Form System Backend
Unit and integration tests for form API, validation, and processing.
"""

import pytest
import uuid
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock, patch
from typing import Dict, Any

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import AsyncClient

from ..main import app
from ..database.connection import get_db_session
from ..models.forms import FormSchema, FormResponse, FormAttachment
from ..services.form_validator import FormValidationService
from ..services.file_handler import FileUploadService
from ..services.form_processor import FormProcessingService
from ..services.form_security import FormSecurityService


# Test fixtures
@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
async def db_session():
    """Mock database session"""
    session = AsyncMock(spec=AsyncSession)
    return session


@pytest.fixture
def sample_form_schema():
    """Sample form schema for testing"""
    return {
        "name": "Contact Form",
        "version": "1.0.0",
        "fields": [
            {
                "id": "name",
                "type": "text",
                "label": "Full Name",
                "required": True,
                "validation": {
                    "min_length": 2,
                    "max_length": 100
                }
            },
            {
                "id": "email",
                "type": "email",
                "label": "Email Address",
                "required": True
            },
            {
                "id": "message",
                "type": "textarea",
                "label": "Message",
                "required": True,
                "validation": {
                    "min_length": 10,
                    "max_length": 1000
                }
            }
        ],
        "validation_rules": {},
        "metadata": {
            "description": "Contact form for customer inquiries"
        }
    }


@pytest.fixture
def sample_form_data():
    """Sample form response data for testing"""
    return {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "message": "Hello, this is a test message with sufficient length."
    }


# Form Schema API Tests
class TestFormSchemaAPI:
    """Test form schema API endpoints"""
    
    @pytest.mark.asyncio
    async def test_create_form_schema_success(self, client, sample_form_schema):
        """Test successful form schema creation"""
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            mock_auth.return_value = Mock(id=str(uuid.uuid4()))
            
            response = client.post("/api/v1/forms/schemas", json=sample_form_schema)
            assert response.status_code == 201
            
            data = response.json()
            assert data["name"] == sample_form_schema["name"]
            assert data["version"] == sample_form_schema["version"]
            assert len(data["fields"]) == len(sample_form_schema["fields"])
    
    @pytest.mark.asyncio
    async def test_create_form_schema_validation_error(self, client):
        """Test form schema creation with validation errors"""
        invalid_schema = {
            "name": "",  # Empty name should fail
            "fields": []  # Empty fields should fail
        }
        
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            mock_auth.return_value = Mock(id=str(uuid.uuid4()))
            
            response = client.post("/api/v1/forms/schemas", json=invalid_schema)
            assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_get_form_schema_success(self, client):
        """Test successful form schema retrieval"""
        schema_id = str(uuid.uuid4())
        
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            mock_auth.return_value = Mock(id=str(uuid.uuid4()))
            
            with patch('backend.src.database.connection.get_db_session') as mock_db:
                mock_session = AsyncMock()
                mock_db.return_value.__aenter__.return_value = mock_session
                
                # Mock database response
                mock_result = Mock()
                mock_result.scalar_one_or_none.return_value = Mock(
                    id=schema_id,
                    name="Test Form",
                    version="1.0.0",
                    fields=[],
                    validation_rules={},
                    metadata={},
                    created_by=str(uuid.uuid4()),
                    created_at=datetime.now(timezone.utc),
                    updated_at=None
                )
                mock_session.execute.return_value = mock_result
                
                response = client.get(f"/api/v1/forms/schemas/{schema_id}")
                assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_form_schema_not_found(self, client):
        """Test form schema retrieval when schema doesn't exist"""
        schema_id = str(uuid.uuid4())
        
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            mock_auth.return_value = Mock(id=str(uuid.uuid4()))
            
            with patch('backend.src.database.connection.get_db_session') as mock_db:
                mock_session = AsyncMock()
                mock_db.return_value.__aenter__.return_value = mock_session
                
                # Mock database response - no result
                mock_result = Mock()
                mock_result.scalar_one_or_none.return_value = None
                mock_session.execute.return_value = mock_result
                
                response = client.get(f"/api/v1/forms/schemas/{schema_id}")
                assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_list_form_schemas_with_pagination(self, client):
        """Test form schema listing with pagination"""
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            mock_auth.return_value = Mock(id=str(uuid.uuid4()))
            
            with patch('backend.src.database.connection.get_db_session') as mock_db:
                mock_session = AsyncMock()
                mock_db.return_value.__aenter__.return_value = mock_session
                
                # Mock database response
                mock_result = Mock()
                mock_result.scalars.return_value.all.return_value = []
                mock_session.execute.return_value = mock_result
                
                response = client.get("/api/v1/forms/schemas?offset=0&limit=10")
                assert response.status_code == 200
                
                data = response.json()
                assert isinstance(data, list)


# Form Response API Tests
class TestFormResponseAPI:
    """Test form response API endpoints"""
    
    @pytest.mark.asyncio
    async def test_submit_form_response_success(self, client, sample_form_data):
        """Test successful form response submission"""
        schema_id = str(uuid.uuid4())
        
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            mock_auth.return_value = Mock(id=str(uuid.uuid4()))
            
            with patch('backend.src.database.connection.get_db_session') as mock_db:
                mock_session = AsyncMock()
                mock_db.return_value.__aenter__.return_value = mock_session
                
                # Mock schema retrieval
                mock_schema = Mock()
                mock_schema.fields = [
                    {"id": "name", "type": "text", "required": True},
                    {"id": "email", "type": "email", "required": True},
                    {"id": "message", "type": "textarea", "required": True}
                ]
                mock_schema.validation_rules = {}
                
                mock_result = Mock()
                mock_result.scalar_one_or_none.return_value = mock_schema
                mock_session.execute.return_value = mock_result
                
                # Mock validation service
                with patch('backend.src.services.form_validator.FormValidationService') as mock_validator:
                    validator_instance = mock_validator.return_value
                    validator_instance.validate_form_data.return_value = Mock(
                        is_valid=True,
                        errors=[]
                    )
                    
                    response = client.post(
                        f"/api/v1/forms/schemas/{schema_id}/responses",
                        json={"data": sample_form_data, "metadata": {}}
                    )
                    assert response.status_code == 201
                    
                    data = response.json()
                    assert data["success"] is True
                    assert "response_id" in data
    
    @pytest.mark.asyncio
    async def test_submit_form_response_validation_error(self, client):
        """Test form response submission with validation errors"""
        schema_id = str(uuid.uuid4())
        invalid_data = {
            "email": "invalid-email",  # Invalid email format
            "message": "Hi"  # Too short message
        }
        
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            mock_auth.return_value = Mock(id=str(uuid.uuid4()))
            
            with patch('backend.src.database.connection.get_db_session') as mock_db:
                mock_session = AsyncMock()
                mock_db.return_value.__aenter__.return_value = mock_session
                
                # Mock schema retrieval
                mock_schema = Mock()
                mock_schema.fields = [
                    {"id": "name", "type": "text", "required": True},
                    {"id": "email", "type": "email", "required": True},
                    {"id": "message", "type": "textarea", "required": True}
                ]
                mock_schema.validation_rules = {}
                
                mock_result = Mock()
                mock_result.scalar_one_or_none.return_value = mock_schema
                mock_session.execute.return_value = mock_result
                
                # Mock validation service with errors
                with patch('backend.src.services.form_validator.FormValidationService') as mock_validator:
                    validator_instance = mock_validator.return_value
                    validator_instance.validate_form_data.return_value = Mock(
                        is_valid=False,
                        errors=[
                            {"field_id": "email", "error_type": "invalid_email", "message": "Invalid email format"},
                            {"field_id": "message", "error_type": "min_length", "message": "Message too short"}
                        ]
                    )
                    
                    response = client.post(
                        f"/api/v1/forms/schemas/{schema_id}/responses",
                        json={"data": invalid_data, "metadata": {}}
                    )
                    assert response.status_code == 201  # Still creates response but marks as invalid
                    
                    data = response.json()
                    assert data["success"] is False
                    assert len(data["errors"]) == 2


# Form Validation Service Tests
class TestFormValidationService:
    """Test form validation service"""
    
    @pytest.fixture
    def validation_service(self):
        """Validation service fixture"""
        return FormValidationService()
    
    @pytest.mark.asyncio
    async def test_validate_text_field_success(self, validation_service):
        """Test successful text field validation"""
        field = {
            "id": "name",
            "type": "text",
            "required": True,
            "validation": {
                "min_length": 2,
                "max_length": 50
            }
        }
        
        errors = await validation_service._validate_text_field(field, "John Doe")
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_text_field_too_short(self, validation_service):
        """Test text field validation with value too short"""
        field = {
            "id": "name",
            "type": "text",
            "validation": {
                "min_length": 5
            }
        }
        
        errors = await validation_service._validate_text_field(field, "Hi")
        assert len(errors) == 1
        assert errors[0]["error_type"] == "min_length"
    
    @pytest.mark.asyncio
    async def test_validate_email_field_success(self, validation_service):
        """Test successful email field validation"""
        field = {"id": "email", "type": "email"}
        
        errors = await validation_service._validate_email_field(field, "test@example.com")
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_email_field_invalid(self, validation_service):
        """Test email field validation with invalid email"""
        field = {"id": "email", "type": "email"}
        
        errors = await validation_service._validate_email_field(field, "invalid-email")
        assert len(errors) == 1
        assert errors[0]["error_type"] == "invalid_email"
    
    @pytest.mark.asyncio
    async def test_validate_number_field_success(self, validation_service):
        """Test successful number field validation"""
        field = {
            "id": "age",
            "type": "number",
            "validation": {
                "min": 0,
                "max": 120
            }
        }
        
        errors = await validation_service._validate_number_field(field, 25)
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_number_field_out_of_range(self, validation_service):
        """Test number field validation with value out of range"""
        field = {
            "id": "age",
            "type": "number",
            "validation": {
                "min": 18,
                "max": 65
            }
        }
        
        errors = await validation_service._validate_number_field(field, 150)
        assert len(errors) == 1
        assert errors[0]["error_type"] == "max_value"
    
    @pytest.mark.asyncio
    async def test_validate_schema_success(self, validation_service, sample_form_schema):
        """Test successful form schema validation"""
        result = await validation_service.validate_schema(sample_form_schema["fields"])
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_schema_duplicate_field_ids(self, validation_service):
        """Test schema validation with duplicate field IDs"""
        fields = [
            {"id": "name", "type": "text", "label": "Name", "required": True},
            {"id": "name", "type": "email", "label": "Email", "required": True}  # Duplicate ID
        ]
        
        result = await validation_service.validate_schema(fields)
        assert result.is_valid is False
        assert any(error["type"] == "duplicate_field_id" for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_form_data_success(self, validation_service, sample_form_data):
        """Test successful form data validation"""
        fields = [
            {"id": "name", "type": "text", "required": True},
            {"id": "email", "type": "email", "required": True},
            {"id": "message", "type": "textarea", "required": True}
        ]
        
        result = await validation_service.validate_form_data(fields, sample_form_data)
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_form_data_missing_required(self, validation_service):
        """Test form data validation with missing required fields"""
        fields = [
            {"id": "name", "type": "text", "required": True},
            {"id": "email", "type": "email", "required": True}
        ]
        
        incomplete_data = {"name": "John Doe"}  # Missing email
        
        result = await validation_service.validate_form_data(fields, incomplete_data)
        assert result.is_valid is False
        assert any(error["error_type"] == "required" for error in result.errors)


# File Upload Service Tests
class TestFileUploadService:
    """Test file upload service"""
    
    @pytest.fixture
    def file_service(self):
        """File service fixture"""
        return FileUploadService()
    
    @pytest.mark.asyncio
    async def test_validate_file_success(self, file_service):
        """Test successful file validation"""
        # Mock UploadFile
        mock_file = Mock()
        mock_file.filename = "test.pdf"
        mock_file.read.return_value = b"%PDF-1.4\n%test content"
        mock_file.seek = AsyncMock()
        mock_file.content_type = "application/pdf"
        
        with patch('magic.from_buffer') as mock_magic:
            mock_magic.return_value = "application/pdf"
            
            result = await file_service.validate_file(mock_file)
            assert result.is_valid is True
            assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_file_blocked_extension(self, file_service):
        """Test file validation with blocked extension"""
        mock_file = Mock()
        mock_file.filename = "malware.exe"
        
        result = await file_service.validate_file(mock_file)
        assert result.is_valid is False
        assert any("not allowed for security reasons" in error for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_file_too_large(self, file_service):
        """Test file validation with file too large"""
        mock_file = Mock()
        mock_file.filename = "large.pdf"
        mock_file.read.return_value = b"x" * (file_service.max_file_size + 1)
        mock_file.seek = AsyncMock()
        
        result = await file_service.validate_file(mock_file)
        assert result.is_valid is False
        assert any("exceeds maximum allowed size" in error for error in result.errors)


# Form Security Service Tests
class TestFormSecurityService:
    """Test form security service"""
    
    @pytest.fixture
    def security_service(self):
        """Security service fixture"""
        return FormSecurityService()
    
    @pytest.mark.asyncio
    async def test_check_rate_limit_success(self, security_service):
        """Test successful rate limit check"""
        with patch('backend.src.services.cache_manager.cache_manager') as mock_cache:
            mock_cache.get.return_value = 1  # Under limit
            mock_cache.set = AsyncMock()
            
            mock_request = Mock()
            result = await security_service.check_rate_limit("client1", "form_submit", mock_request)
            assert result is True
    
    @pytest.mark.asyncio
    async def test_check_rate_limit_exceeded(self, security_service):
        """Test rate limit exceeded"""
        with patch('backend.src.services.cache_manager.cache_manager') as mock_cache:
            mock_cache.get.return_value = 10  # Over limit
            
            mock_request = Mock()
            result = await security_service.check_rate_limit("client1", "form_submit", mock_request)
            assert result is False
    
    @pytest.mark.asyncio
    async def test_validate_form_data_security_success(self, security_service, sample_form_data):
        """Test successful form data security validation"""
        result = await security_service.validate_form_data_security(sample_form_data)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_validate_form_data_security_xss_attempt(self, security_service):
        """Test form data security validation with XSS attempt"""
        malicious_data = {
            "name": "John Doe",
            "message": "<script>alert('XSS')</script>Test message"
        }
        
        result = await security_service.validate_form_data_security(malicious_data)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_validate_form_data_security_sql_injection_attempt(self, security_service):
        """Test form data security validation with SQL injection attempt"""
        malicious_data = {
            "name": "John Doe",
            "email": "test@example.com",
            "message": "Test'; DROP TABLE users; --"
        }
        
        result = await security_service.validate_form_data_security(malicious_data)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_generate_csrf_token(self, security_service):
        """Test CSRF token generation"""
        with patch('backend.src.services.cache_manager.cache_manager') as mock_cache:
            mock_cache.set = AsyncMock()
            
            token = await security_service.generate_csrf_token("client1")
            assert isinstance(token, str)
            assert len(token) > 0
    
    @pytest.mark.asyncio
    async def test_validate_csrf_token_success(self, security_service):
        """Test successful CSRF token validation"""
        with patch('backend.src.services.cache_manager.cache_manager') as mock_cache:
            mock_cache.get.return_value = {"client_id": "client1"}
            mock_cache.delete = AsyncMock()
            
            result = await security_service.validate_csrf_token("client1", "valid-token")
            assert result is True
    
    @pytest.mark.asyncio
    async def test_validate_csrf_token_invalid(self, security_service):
        """Test CSRF token validation with invalid token"""
        with patch('backend.src.services.cache_manager.cache_manager') as mock_cache:
            mock_cache.get.return_value = None  # Token not found
            
            result = await security_service.validate_csrf_token("client1", "invalid-token")
            assert result is False


# Integration Tests
class TestFormSystemIntegration:
    """Integration tests for form system"""
    
    @pytest.mark.asyncio
    async def test_complete_form_workflow(self, client, sample_form_schema, sample_form_data):
        """Test complete form workflow from creation to submission"""
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            user_id = str(uuid.uuid4())
            mock_auth.return_value = Mock(id=user_id)
            
            with patch('backend.src.database.connection.get_db_session') as mock_db:
                mock_session = AsyncMock()
                mock_db.return_value.__aenter__.return_value = mock_session
                
                # Mock successful database operations
                mock_result = Mock()
                mock_session.execute.return_value = mock_result
                mock_session.add = Mock()
                mock_session.commit = AsyncMock()
                mock_session.refresh = AsyncMock()
                
                # Step 1: Create form schema
                mock_result.scalar_one_or_none.return_value = None  # For creation
                response1 = client.post("/api/v1/forms/schemas", json=sample_form_schema)
                assert response1.status_code == 201
                
                schema_id = str(uuid.uuid4())
                
                # Step 2: Submit form response
                mock_schema = Mock()
                mock_schema.id = schema_id
                mock_schema.fields = sample_form_schema["fields"]
                mock_schema.validation_rules = {}
                mock_result.scalar_one_or_none.return_value = mock_schema
                
                with patch('backend.src.services.form_validator.FormValidationService') as mock_validator:
                    validator_instance = mock_validator.return_value
                    validator_instance.validate_form_data.return_value = Mock(
                        is_valid=True,
                        errors=[]
                    )
                    
                    response2 = client.post(
                        f"/api/v1/forms/schemas/{schema_id}/responses",
                        json={"data": sample_form_data, "metadata": {}}
                    )
                    assert response2.status_code == 201
                    
                    data = response2.json()
                    assert data["success"] is True
    
    @pytest.mark.asyncio
    async def test_file_upload_integration(self, client):
        """Test file upload integration"""
        with patch('backend.src.auth.security.get_current_user') as mock_auth:
            mock_auth.return_value = Mock(id=str(uuid.uuid4()))
            
            # Mock file upload
            test_file_content = b"test file content"
            
            with patch('backend.src.services.file_handler.FileUploadService') as mock_file_service:
                file_service_instance = mock_file_service.return_value
                file_service_instance.validate_file.return_value = Mock(
                    is_valid=True,
                    errors=[],
                    file_info={"size": len(test_file_content), "mime_type": "text/plain"}
                )
                file_service_instance.upload_file.return_value = Mock(
                    success=True,
                    file_path="/uploads/test.txt",
                    file_size=len(test_file_content),
                    content_type="text/plain",
                    file_hash="abc123"
                )
                
                response = client.post(
                    "/api/v1/forms/attachments",
                    files={"file": ("test.txt", test_file_content, "text/plain")},
                    data={"field_id": "attachment"}
                )
                
                assert response.status_code == 201


# Fixtures for test data
@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment"""
    import os
    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = "sqlite:///test.db"
    os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"


@pytest.fixture(autouse=True)
async def cleanup_cache():
    """Clean up cache between tests"""
    with patch('backend.src.services.cache_manager.cache_manager') as mock_cache:
        mock_cache.clear_namespace = AsyncMock()
        yield
        # Cleanup after each test