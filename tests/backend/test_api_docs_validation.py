"""
API Documentation and Schema Validation Tests
Test OpenAPI schema validation, documentation accuracy, and API contract compliance
"""

import pytest
import json
from httpx import AsyncClient
from fastapi import status
from fastapi.testclient import TestClient
from jsonschema import validate, ValidationError
from typing import Dict, Any


@pytest.mark.api
class TestOpenAPIDocumentation:
    """Test OpenAPI documentation generation and accuracy"""
    
    async def test_openapi_schema_generation(self, async_client: AsyncClient):
        """Test OpenAPI schema is generated correctly"""
        response = await async_client.get("/openapi.json")
        
        assert response.status_code == status.HTTP_200_OK
        
        openapi_schema = response.json()
        
        # Verify required OpenAPI fields
        assert "openapi" in openapi_schema
        assert "info" in openapi_schema
        assert "paths" in openapi_schema
        assert "components" in openapi_schema
        
        # Verify API info
        info = openapi_schema["info"]
        assert info["title"] == "ConcertMaster API"
        assert "version" in info
        assert "description" in info
    
    async def test_docs_ui_accessibility(self, async_client: AsyncClient):
        """Test that documentation UI is accessible"""
        # Test Swagger UI
        response = await async_client.get("/api/docs")
        assert response.status_code == status.HTTP_200_OK
        assert "swagger" in response.text.lower()
        
        # Test ReDoc UI
        response = await async_client.get("/api/redoc")
        assert response.status_code == status.HTTP_200_OK
        assert "redoc" in response.text.lower()
    
    async def test_api_endpoints_documented(self, async_client: AsyncClient):
        """Test that all API endpoints are documented in OpenAPI schema"""
        response = await async_client.get("/openapi.json")
        openapi_schema = response.json()
        
        paths = openapi_schema["paths"]
        
        # Expected API endpoints
        expected_endpoints = [
            "/health",
            "/api/v1/status",
            "/api/v1/workflows/",
            "/api/v1/workflows/{workflow_id}",
            "/api/v1/workflows/{workflow_id}/execute",
            "/api/v1/workflows/{workflow_id}/executions",
            "/api/v1/forms/",
            "/api/v1/forms/{form_id}",
            "/api/v1/forms/{form_id}/responses",
            "/api/v1/executions/",
            "/api/v1/nodes/types",
            "/api/v1/integrations/",
        ]
        
        for endpoint in expected_endpoints:
            assert endpoint in paths, f"Endpoint {endpoint} not documented"
    
    async def test_schema_components_defined(self, async_client: AsyncClient):
        """Test that schema components are properly defined"""
        response = await async_client.get("/openapi.json")
        openapi_schema = response.json()
        
        components = openapi_schema.get("components", {})
        schemas = components.get("schemas", {})
        
        # Expected schema components
        expected_schemas = [
            "HTTPValidationError",
            "ValidationError",
        ]
        
        # Verify schemas exist (actual schemas depend on implementation)
        for schema in expected_schemas:
            if schema in schemas:
                # Verify schema structure
                schema_def = schemas[schema]
                assert "type" in schema_def or "$ref" in schema_def
    
    async def test_security_schemes_documented(self, async_client: AsyncClient):
        """Test that security schemes are properly documented"""
        response = await async_client.get("/openapi.json")
        openapi_schema = response.json()
        
        components = openapi_schema.get("components", {})
        security_schemes = components.get("securitySchemes", {})
        
        # Should have authentication scheme documented
        if security_schemes:
            for scheme_name, scheme_def in security_schemes.items():
                assert "type" in scheme_def
                if scheme_def["type"] == "http":
                    assert "scheme" in scheme_def
                elif scheme_def["type"] == "apiKey":
                    assert "in" in scheme_def
                    assert "name" in scheme_def


@pytest.mark.api
class TestAPISchemaValidation:
    """Test API request/response schema validation"""
    
    @pytest.fixture
    def workflow_request_schema(self):
        """JSON schema for workflow creation request"""
        return {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 255},
                "description": {"type": "string", "maxLength": 2000},
                "definition": {
                    "type": "object",
                    "properties": {
                        "nodes": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "type": {"type": "string"},
                                    "position": {
                                        "type": "object",
                                        "properties": {
                                            "x": {"type": "number"},
                                            "y": {"type": "number"}
                                        },
                                        "required": ["x", "y"]
                                    },
                                    "data": {"type": "object"}
                                },
                                "required": ["id", "type", "position"]
                            }
                        },
                        "edges": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "source": {"type": "string"},
                                    "target": {"type": "string"}
                                },
                                "required": ["source", "target"]
                            }
                        }
                    },
                    "required": ["nodes", "edges"]
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "settings": {"type": "object"}
            },
            "required": ["name", "definition"]
        }
    
    @pytest.fixture
    def form_request_schema(self):
        """JSON schema for form creation request"""
        return {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 255},
                "version": {"type": "string", "pattern": r"^\d+\.\d+\.\d+$"},
                "fields": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "minLength": 1},
                            "type": {
                                "type": "string",
                                "enum": ["text", "email", "number", "textarea", "select", "checkbox", "radio"]
                            },
                            "label": {"type": "string", "minLength": 1},
                            "required": {"type": "boolean"},
                            "validation": {"type": "object"},
                            "options": {"type": "array"}
                        },
                        "required": ["id", "type", "label"]
                    }
                },
                "validation_rules": {"type": "object"},
                "metadata": {"type": "object"}
            },
            "required": ["name", "fields"]
        }
    
    async def test_workflow_request_validation(
        self, async_client: AsyncClient, auth_headers, workflow_request_schema
    ):
        """Test workflow creation request against schema"""
        valid_workflow_data = {
            "name": "Valid Workflow",
            "description": "A valid workflow for testing",
            "definition": {
                "nodes": [
                    {
                        "id": "node1",
                        "type": "trigger",
                        "position": {"x": 100, "y": 100},
                        "data": {"trigger_type": "manual"}
                    }
                ],
                "edges": []
            },
            "tags": ["test", "validation"],
            "settings": {"timeout": 300}
        }
        
        # Validate against schema
        validate(instance=valid_workflow_data, schema=workflow_request_schema)
        
        # Test API accepts valid data
        response = await async_client.post(
            "/api/v1/workflows/",
            json=valid_workflow_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_201_CREATED
    
    async def test_workflow_request_invalid_schema(
        self, async_client: AsyncClient, auth_headers, workflow_request_schema
    ):
        """Test workflow creation with invalid schema"""
        invalid_workflows = [
            # Missing required name
            {
                "description": "Missing name",
                "definition": {"nodes": [], "edges": []}
            },
            
            # Missing required definition
            {
                "name": "Missing definition"
            },
            
            # Invalid node structure
            {
                "name": "Invalid nodes",
                "definition": {
                    "nodes": [
                        {"type": "trigger"}  # Missing id and position
                    ],
                    "edges": []
                }
            },
            
            # Invalid edge structure
            {
                "name": "Invalid edges",
                "definition": {
                    "nodes": [],
                    "edges": [
                        {"source": "a"}  # Missing target
                    ]
                }
            }
        ]
        
        for invalid_data in invalid_workflows:
            # Should fail schema validation
            with pytest.raises(ValidationError):
                validate(instance=invalid_data, schema=workflow_request_schema)
            
            # API should reject invalid data
            response = await async_client.post(
                "/api/v1/workflows/",
                json=invalid_data,
                headers=auth_headers
            )
            
            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_form_request_validation(
        self, async_client: AsyncClient, auth_headers, form_request_schema
    ):
        """Test form creation request against schema"""
        valid_form_data = {
            "name": "Contact Form",
            "version": "1.0.0",
            "fields": [
                {
                    "id": "name",
                    "type": "text",
                    "label": "Full Name",
                    "required": True,
                    "validation": {"min_length": 2, "max_length": 100}
                },
                {
                    "id": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": True
                },
                {
                    "id": "country",
                    "type": "select",
                    "label": "Country",
                    "required": False,
                    "options": ["USA", "Canada", "Mexico"]
                }
            ],
            "validation_rules": {
                "name": {"min_length": 2},
                "email": {"format": "email"}
            },
            "metadata": {
                "description": "Contact form for customer inquiries"
            }
        }
        
        # Validate against schema
        validate(instance=valid_form_data, schema=form_request_schema)
        
        # Test API accepts valid data
        response = await async_client.post(
            "/api/v1/forms/",
            json=valid_form_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_201_CREATED
    
    async def test_response_schema_compliance(self, async_client: AsyncClient, auth_headers):
        """Test API responses comply with documented schemas"""
        # Create a workflow to test response schema
        workflow_data = {
            "name": "Schema Test Workflow",
            "definition": {"nodes": [], "edges": []}
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=workflow_data,
            headers=auth_headers
        )
        
        if response.status_code == status.HTTP_201_CREATED:
            data = response.json()
            
            # Verify response contains expected fields
            expected_fields = ["id", "name", "definition", "status", "created_at", "updated_at"]
            
            for field in expected_fields:
                assert field in data, f"Response missing field: {field}"
            
            # Verify field types
            assert isinstance(data["id"], str)
            assert isinstance(data["name"], str)
            assert isinstance(data["definition"], dict)
            assert isinstance(data["status"], str)
            assert isinstance(data["created_at"], str)
    
    async def test_error_response_schema(self, async_client: AsyncClient, auth_headers):
        """Test error responses follow consistent schema"""
        # Trigger validation error
        response = await async_client.post(
            "/api/v1/workflows/",
            json={"invalid": "data"},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        error_data = response.json()
        
        # Standard FastAPI error response structure
        assert "detail" in error_data
        
        # If detail is a list (validation errors)
        if isinstance(error_data["detail"], list):
            for error in error_data["detail"]:
                assert "loc" in error  # Field location
                assert "msg" in error  # Error message
                assert "type" in error  # Error type
    
    async def test_pagination_schema(self, async_client: AsyncClient, auth_headers):
        """Test pagination response schema consistency"""
        response = await async_client.get(
            "/api/v1/workflows/?skip=0&limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        
        # Should be a list for paginated responses
        assert isinstance(data, list)
        
        # Each item should have consistent structure
        if data:
            workflow = data[0]
            expected_fields = ["id", "name", "status", "created_at"]
            
            for field in expected_fields:
                assert field in workflow


@pytest.mark.api
class TestAPIContractCompliance:
    """Test API contract compliance and versioning"""
    
    async def test_content_type_headers(self, async_client: AsyncClient, auth_headers):
        """Test proper content type handling"""
        workflow_data = {
            "name": "Content Type Test",
            "definition": {"nodes": [], "edges": []}
        }
        
        # Test JSON content type
        response = await async_client.post(
            "/api/v1/workflows/",
            json=workflow_data,
            headers={**auth_headers, "Content-Type": "application/json"}
        )
        
        if response.status_code == status.HTTP_201_CREATED:
            # Response should also be JSON
            assert "application/json" in response.headers.get("content-type", "")
    
    async def test_http_method_compliance(self, async_client: AsyncClient, auth_headers):
        """Test HTTP method compliance"""
        # Test OPTIONS method (CORS preflight)
        response = await async_client.options("/api/v1/workflows/")
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_405_METHOD_NOT_ALLOWED]
        
        # Test unsupported methods
        unsupported_methods = ["PATCH", "HEAD"]
        
        for method in unsupported_methods:
            if hasattr(async_client, method.lower()):
                method_func = getattr(async_client, method.lower())
                response = await method_func("/api/v1/workflows/", headers=auth_headers)
                # Should return 405 Method Not Allowed or be supported
                assert response.status_code in [
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                    status.HTTP_200_OK,
                    status.HTTP_404_NOT_FOUND
                ]
    
    async def test_api_versioning(self, async_client: AsyncClient):
        """Test API versioning compliance"""
        # Test that v1 endpoints exist
        v1_endpoints = [
            "/api/v1/workflows/",
            "/api/v1/forms/",
            "/api/v1/executions/",
            "/api/v1/integrations/"
        ]
        
        for endpoint in v1_endpoints:
            response = await async_client.get(endpoint)
            # Should not return 404 (endpoint exists)
            # May return 401 (unauthorized) which is acceptable
            assert response.status_code != status.HTTP_404_NOT_FOUND
    
    async def test_cors_headers(self, async_client: AsyncClient):
        """Test CORS header compliance"""
        response = await async_client.options("/api/v1/workflows/")
        
        if response.status_code == status.HTTP_200_OK:
            headers = response.headers
            
            # Check for CORS headers
            cors_headers = [
                "access-control-allow-origin",
                "access-control-allow-methods",
                "access-control-allow-headers"
            ]
            
            # At least one CORS header should be present if CORS is configured
            has_cors = any(header in headers for header in cors_headers)
            
            if has_cors:
                # If CORS is configured, verify proper setup
                assert "access-control-allow-origin" in headers
    
    async def test_security_headers(self, async_client: AsyncClient):
        """Test security header presence"""
        response = await async_client.get("/health")
        
        assert response.status_code == status.HTTP_200_OK
        
        headers = response.headers
        
        # Recommended security headers
        security_headers = [
            "x-content-type-options",
            "x-frame-options",
            "x-xss-protection",
        ]
        
        # Not all security headers may be implemented, but check if any exist
        present_headers = [h for h in security_headers if h in headers]
        
        # At least basic security measures should be in place
        # This is informational - not all headers are required for all APIs
        if present_headers:
            for header in present_headers:
                assert headers[header] is not None


@pytest.mark.api
class TestAPIDocumentationAccuracy:
    """Test that API documentation matches actual implementation"""
    
    async def test_parameter_documentation_accuracy(self, async_client: AsyncClient):
        """Test that documented parameters match actual API behavior"""
        # Get OpenAPI schema
        schema_response = await async_client.get("/openapi.json")
        openapi_schema = schema_response.json()
        
        # Test workflow list endpoint parameters
        workflow_path = "/api/v1/workflows/"
        if workflow_path in openapi_schema["paths"]:
            get_spec = openapi_schema["paths"][workflow_path].get("get", {})
            parameters = get_spec.get("parameters", [])
            
            # Extract query parameters
            query_params = [
                param for param in parameters 
                if param.get("in") == "query"
            ]
            
            # Test with documented parameters
            test_params = {}
            for param in query_params:
                param_name = param["name"]
                if param_name == "skip":
                    test_params["skip"] = 0
                elif param_name == "limit":
                    test_params["limit"] = 10
                elif param_name == "search":
                    test_params["search"] = "test"
            
            # API should accept documented parameters
            response = await async_client.get(workflow_path, params=test_params)
            # Should not return 400 Bad Request for valid parameters
            assert response.status_code != status.HTTP_400_BAD_REQUEST
    
    async def test_response_example_accuracy(self, async_client: AsyncClient, auth_headers):
        """Test that response examples match actual responses"""
        # Create a real workflow to compare against documentation
        workflow_data = {
            "name": "Documentation Test",
            "definition": {"nodes": [], "edges": []}
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=workflow_data,
            headers=auth_headers
        )
        
        if response.status_code == status.HTTP_201_CREATED:
            actual_response = response.json()
            
            # Get documented response schema
            schema_response = await async_client.get("/openapi.json")
            openapi_schema = schema_response.json()
            
            # Verify actual response structure matches documentation
            # This is a basic structural check
            required_fields = ["id", "name", "created_at", "updated_at"]
            
            for field in required_fields:
                assert field in actual_response, f"Response missing documented field: {field}"
    
    async def test_status_code_documentation_accuracy(self, async_client: AsyncClient, auth_headers):
        """Test that documented status codes match actual responses"""
        # Test successful creation (should return 201)
        workflow_data = {
            "name": "Status Code Test",
            "definition": {"nodes": [], "edges": []}
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=workflow_data,
            headers=auth_headers
        )
        
        # Should return 201 Created as documented
        assert response.status_code == status.HTTP_201_CREATED
        
        # Test validation error (should return 422)
        invalid_data = {"invalid": "data"}
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=invalid_data,
            headers=auth_headers
        )
        
        # Should return 422 Unprocessable Entity as documented
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test not found (should return 404)
        fake_id = "550e8400-e29b-41d4-a716-446655440000"  # Valid UUID format
        
        response = await async_client.get(
            f"/api/v1/workflows/{fake_id}",
            headers=auth_headers
        )
        
        # Should return 404 Not Found as documented
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.api
class TestAPIDeprecationAndChanges:
    """Test API deprecation handling and backward compatibility"""
    
    async def test_deprecated_endpoint_warnings(self, async_client: AsyncClient):
        """Test that deprecated endpoints return proper warnings"""
        # This would test deprecated endpoints if any exist
        # For now, this is a placeholder for future deprecations
        pass
    
    async def test_api_version_backward_compatibility(self, async_client: AsyncClient):
        """Test backward compatibility across API versions"""
        # Test that v1 API remains stable
        # This is important for client applications
        
        v1_health_response = await async_client.get("/health")
        assert v1_health_response.status_code == status.HTTP_200_OK
        
        # Health endpoint should maintain consistent structure
        health_data = v1_health_response.json()
        essential_fields = ["status", "version"]
        
        for field in essential_fields:
            assert field in health_data, f"Health check missing essential field: {field}"
    
    async def test_content_negotiation(self, async_client: AsyncClient):
        """Test content negotiation support"""
        # Test Accept header handling
        headers = {"Accept": "application/json"}
        
        response = await async_client.get("/health", headers=headers)
        
        assert response.status_code == status.HTTP_200_OK
        assert "application/json" in response.headers.get("content-type", "")
        
        # Test that JSON is returned when requested
        assert response.headers.get("content-type", "").startswith("application/json")


@pytest.mark.api
@pytest.mark.performance
class TestAPIPerformanceContract:
    """Test API performance contracts and SLA compliance"""
    
    async def test_response_time_contract(self, async_client: AsyncClient, performance_timer):
        """Test API response time contracts"""
        # Health check should be very fast
        performance_timer.start()
        response = await async_client.get("/health")
        performance_timer.stop()
        
        assert response.status_code == status.HTTP_200_OK
        assert performance_timer.elapsed_ms < 500  # Should respond within 500ms
    
    async def test_concurrent_request_handling(self, async_client: AsyncClient, auth_headers):
        """Test API can handle concurrent requests"""
        import asyncio
        
        # Make concurrent requests
        tasks = [
            async_client.get("/health")
            for _ in range(20)
        ]
        
        responses = await asyncio.gather(*tasks)
        
        # All requests should succeed
        for response in responses:
            assert response.status_code == status.HTTP_200_OK
    
    async def test_payload_size_limits(self, async_client: AsyncClient, auth_headers):
        """Test API payload size limit compliance"""
        # Test reasonable-sized payload (should work)
        normal_payload = {
            "name": "Normal Workflow",
            "definition": {
                "nodes": [
                    {"id": f"node_{i}", "type": "transform", "position": {"x": i, "y": 0}}
                    for i in range(10)  # 10 nodes
                ],
                "edges": []
            }
        }
        
        response = await async_client.post(
            "/api/v1/workflows/",
            json=normal_payload,
            headers=auth_headers
        )
        
        # Should accept reasonable payload
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_422_UNPROCESSABLE_ENTITY  # Validation might fail, but not due to size
        ]