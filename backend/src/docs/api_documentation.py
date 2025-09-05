"""
Form System API Documentation
OpenAPI specification and documentation for the Form System backend APIs.
"""

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from typing import Dict, Any

def get_custom_openapi(app: FastAPI) -> Dict[str, Any]:
    """
    Generate custom OpenAPI schema for Form System API.
    """
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Form System API",
        version="3.0.0",
        description="""
        Comprehensive Form System API for creating, managing, and processing dynamic forms.
        
        ## Features
        - Dynamic form schema creation and management
        - Real-time form validation and processing
        - File attachment handling with security scanning
        - Analytics and reporting
        - Webhook integration for external systems
        - Rate limiting and security measures
        
        ## Authentication
        Most endpoints require JWT authentication. Include the token in the Authorization header:
        ```
        Authorization: Bearer <your-jwt-token>
        ```
        
        ## Rate Limiting
        API endpoints are rate-limited based on action type:
        - Form submission: 10 requests per minute
        - Schema creation: 5 requests per minute  
        - File upload: 3 requests per minute
        - General API: 100 requests per minute
        
        ## Error Handling
        The API uses standard HTTP status codes and returns detailed error messages:
        - 400: Bad Request - Invalid input data
        - 401: Unauthorized - Authentication required
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Resource not found
        - 422: Unprocessable Entity - Validation errors
        - 429: Too Many Requests - Rate limit exceeded
        - 500: Internal Server Error - Server error
        """,
        routes=app.routes,
        servers=[
            {"url": "http://localhost:8000", "description": "Development server"},
            {"url": "https://api.example.com", "description": "Production server"},
        ],
    )
    
    # Add custom schema definitions
    openapi_schema["components"]["schemas"].update({
        "FormField": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique field identifier"},
                "type": {
                    "type": "string", 
                    "enum": ["text", "email", "number", "date", "select", "checkbox", "radio", "textarea", "file"],
                    "description": "Field input type"
                },
                "label": {"type": "string", "description": "Human-readable field label"},
                "required": {"type": "boolean", "description": "Whether field is required"},
                "validation": {"type": "object", "description": "Field validation rules"},
                "options": {"type": "array", "items": {"type": "string"}, "description": "Options for select/radio fields"},
                "placeholder": {"type": "string", "description": "Field placeholder text"},
                "help_text": {"type": "string", "description": "Help text for the field"}
            },
            "required": ["id", "type", "label"]
        },
        "ValidationRule": {
            "type": "object",
            "properties": {
                "min_length": {"type": "integer", "minimum": 0},
                "max_length": {"type": "integer", "minimum": 1},
                "pattern": {"type": "string", "description": "Regex pattern for validation"},
                "min_value": {"type": "number", "description": "Minimum numeric value"},
                "max_value": {"type": "number", "description": "Maximum numeric value"},
                "allowed_extensions": {"type": "array", "items": {"type": "string"}, "description": "Allowed file extensions"},
                "max_file_size": {"type": "integer", "description": "Maximum file size in bytes"},
                "custom_validator": {"type": "string", "description": "Custom validation function name"}
            }
        },
        "FormSchemaRequest": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Form title"},
                "description": {"type": "string", "description": "Form description"},
                "fields": {
                    "type": "array", 
                    "items": {"$ref": "#/components/schemas/FormField"},
                    "description": "Form fields definition"
                },
                "settings": {"type": "object", "description": "Form configuration settings"},
                "notifications": {"type": "object", "description": "Notification settings"},
                "webhooks": {"type": "array", "items": {"type": "string"}, "description": "Webhook URLs"},
                "styling": {"type": "object", "description": "Form styling configuration"}
            },
            "required": ["title", "fields"]
        },
        "FormResponseRequest": {
            "type": "object",
            "properties": {
                "form_id": {"type": "string", "description": "Form schema ID"},
                "response_data": {"type": "object", "description": "Form field responses"},
                "metadata": {"type": "object", "description": "Additional response metadata"}
            },
            "required": ["form_id", "response_data"]
        },
        "ValidationError": {
            "type": "object",
            "properties": {
                "field": {"type": "string", "description": "Field that failed validation"},
                "message": {"type": "string", "description": "Validation error message"},
                "code": {"type": "string", "description": "Error code"},
                "value": {"description": "Invalid value that caused the error"}
            },
            "required": ["field", "message", "code"]
        },
        "ApiResponse": {
            "type": "object",
            "properties": {
                "success": {"type": "boolean", "description": "Operation success status"},
                "data": {"description": "Response data"},
                "message": {"type": "string", "description": "Response message"},
                "errors": {
                    "type": "array", 
                    "items": {"$ref": "#/components/schemas/ValidationError"},
                    "description": "Validation errors"
                }
            },
            "required": ["success"]
        }
    })
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        },
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key"
        }
    }
    
    # Add tags for endpoint organization
    openapi_schema["tags"] = [
        {
            "name": "Form Schemas",
            "description": "Operations for managing form schemas and templates"
        },
        {
            "name": "Form Responses",
            "description": "Operations for submitting and managing form responses"
        },
        {
            "name": "File Management",
            "description": "File upload and attachment operations"
        },
        {
            "name": "Validation",
            "description": "Form and data validation endpoints"
        },
        {
            "name": "Analytics",
            "description": "Form analytics and reporting"
        },
        {
            "name": "Templates",
            "description": "Pre-built form templates and management"
        }
    ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


def setup_api_docs(app: FastAPI) -> None:
    """
    Setup API documentation endpoints and custom OpenAPI schema.
    """
    # Custom OpenAPI schema
    app.openapi = lambda: get_custom_openapi(app)
    
    # Add example responses to routes
    add_example_responses(app)


def add_example_responses(app: FastAPI) -> None:
    """
    Add example responses to API endpoints for better documentation.
    """
    examples = {
        "/api/forms/schema": {
            "post": {
                "example_request": {
                    "title": "Contact Form",
                    "description": "A simple contact form for customer inquiries",
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
                            "required": True,
                            "validation": {"pattern": r"^[^\s@]+@[^\s@]+\.[^\s@]+$"}
                        },
                        {
                            "id": "message",
                            "type": "textarea",
                            "label": "Message",
                            "required": True,
                            "validation": {"min_length": 10, "max_length": 1000}
                        }
                    ],
                    "settings": {
                        "allow_multiple_submissions": False,
                        "require_authentication": False,
                        "auto_save": True
                    },
                    "notifications": {
                        "admin_email": "admin@example.com",
                        "send_confirmation": True,
                        "confirmation_template": "contact_confirmation"
                    }
                },
                "example_response": {
                    "success": True,
                    "data": {
                        "id": "form_123456789",
                        "title": "Contact Form",
                        "status": "active",
                        "created_at": "2025-01-09T10:00:00Z",
                        "fields_count": 3,
                        "public_url": "https://forms.example.com/contact-form-123456789"
                    },
                    "message": "Form schema created successfully"
                }
            }
        },
        "/api/forms/response": {
            "post": {
                "example_request": {
                    "form_id": "form_123456789",
                    "response_data": {
                        "name": "John Doe",
                        "email": "john@example.com",
                        "message": "I would like to know more about your services."
                    },
                    "metadata": {
                        "user_agent": "Mozilla/5.0...",
                        "ip_address": "192.168.1.100",
                        "referrer": "https://example.com/contact"
                    }
                },
                "example_response": {
                    "success": True,
                    "data": {
                        "response_id": "resp_987654321",
                        "form_id": "form_123456789",
                        "status": "submitted",
                        "submitted_at": "2025-01-09T10:30:00Z",
                        "validation_passed": True
                    },
                    "message": "Form response submitted successfully"
                }
            }
        },
        "/api/forms/validate": {
            "post": {
                "example_request": {
                    "form_id": "form_123456789",
                    "field_data": {
                        "name": "Jo",
                        "email": "invalid-email",
                        "message": "Hi"
                    }
                },
                "example_response": {
                    "success": False,
                    "data": {
                        "valid": False,
                        "field_results": {
                            "name": {"valid": False, "errors": ["Name must be at least 2 characters long"]},
                            "email": {"valid": False, "errors": ["Please enter a valid email address"]},
                            "message": {"valid": False, "errors": ["Message must be at least 10 characters long"]}
                        }
                    },
                    "errors": [
                        {"field": "name", "message": "Name must be at least 2 characters long", "code": "MIN_LENGTH"},
                        {"field": "email", "message": "Please enter a valid email address", "code": "INVALID_EMAIL"},
                        {"field": "message", "message": "Message must be at least 10 characters long", "code": "MIN_LENGTH"}
                    ]
                }
            }
        }
    }
    
    # Store examples in app state for use by documentation
    app.state.api_examples = examples


class APIDocumentationGenerator:
    """
    Generate comprehensive API documentation including examples, tutorials, and integration guides.
    """
    
    @staticmethod
    def generate_integration_guide() -> str:
        """
        Generate integration guide for developers.
        """
        return """
# Form System API Integration Guide

## Quick Start

### 1. Authentication
First, obtain a JWT token from the authentication endpoint:

```python
import requests

response = requests.post('http://localhost:8000/api/auth/login', json={
    'username': 'your_username',
    'password': 'your_password'
})
token = response.json()['access_token']

headers = {'Authorization': f'Bearer {token}'}
```

### 2. Create a Form Schema

```python
form_schema = {
    "title": "Customer Feedback Form",
    "description": "Collect customer feedback and suggestions",
    "fields": [
        {
            "id": "rating",
            "type": "select",
            "label": "Overall Rating",
            "required": True,
            "options": ["Excellent", "Good", "Fair", "Poor"]
        },
        {
            "id": "feedback",
            "type": "textarea",
            "label": "Your Feedback",
            "required": True,
            "validation": {"min_length": 10, "max_length": 500}
        }
    ]
}

response = requests.post(
    'http://localhost:8000/api/forms/schema',
    json=form_schema,
    headers=headers
)
form_id = response.json()['data']['id']
```

### 3. Submit Form Response

```python
form_response = {
    "form_id": form_id,
    "response_data": {
        "rating": "Excellent",
        "feedback": "Great service and quick response time!"
    }
}

response = requests.post(
    'http://localhost:8000/api/forms/response',
    json=form_response,
    headers=headers
)
```

### 4. Handle File Uploads

```python
files = {'file': open('document.pdf', 'rb')}
data = {'form_id': form_id, 'field_id': 'attachment'}

response = requests.post(
    'http://localhost:8000/api/forms/upload',
    files=files,
    data=data,
    headers=headers
)
```

## Error Handling

Always check the response status and handle errors appropriately:

```python
def submit_form(form_data):
    try:
        response = requests.post('/api/forms/response', json=form_data, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        if result['success']:
            return result['data']
        else:
            # Handle validation errors
            for error in result.get('errors', []):
                print(f"Field {error['field']}: {error['message']}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None
```

## Rate Limiting

The API implements rate limiting. Handle 429 responses with exponential backoff:

```python
import time
import random

def api_request_with_retry(url, data, max_retries=3):
    for attempt in range(max_retries):
        response = requests.post(url, json=data, headers=headers)
        
        if response.status_code != 429:
            return response
            
        # Exponential backoff with jitter
        delay = (2 ** attempt) + random.uniform(0, 1)
        time.sleep(delay)
    
    return response
```

## Webhooks

Configure webhooks to receive real-time notifications:

```python
# In your form schema
"webhooks": [
    "https://your-server.com/webhook/form-submitted"
]

# Webhook handler example (Flask)
from flask import Flask, request
import hmac
import hashlib

app = Flask(__name__)

@app.route('/webhook/form-submitted', methods=['POST'])
def handle_form_submission():
    # Verify webhook signature
    signature = request.headers.get('X-Form-Signature')
    payload = request.get_data()
    
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, f'sha256={expected_signature}'):
        return 'Invalid signature', 401
    
    # Process form submission
    data = request.get_json()
    print(f"New form submission: {data['response_id']}")
    
    return 'OK', 200
```
        """
    
    @staticmethod
    def generate_sdk_examples() -> Dict[str, str]:
        """
        Generate SDK examples for different programming languages.
        """
        return {
            "javascript": """
// JavaScript SDK Example
class FormAPI {
    constructor(apiKey, baseUrl = 'http://localhost:8000') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    
    async createForm(schema) {
        const response = await fetch(`${this.baseUrl}/api/forms/schema`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(schema)
        });
        return response.json();
    }
    
    async submitResponse(formId, data) {
        const response = await fetch(`${this.baseUrl}/api/forms/response`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                form_id: formId,
                response_data: data
            })
        });
        return response.json();
    }
}

// Usage
const api = new FormAPI('your-api-key');
const form = await api.createForm({
    title: 'Survey',
    fields: [/* field definitions */]
});
""",
            "python": """
# Python SDK Example
import requests
from typing import Dict, Any, Optional

class FormAPI:
    def __init__(self, api_key: str, base_url: str = 'http://localhost:8000'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {api_key}'}
    
    def create_form(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        response = requests.post(
            f'{self.base_url}/api/forms/schema',
            json=schema,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def submit_response(self, form_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        response = requests.post(
            f'{self.base_url}/api/forms/response',
            json={'form_id': form_id, 'response_data': data},
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def validate_data(self, form_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        response = requests.post(
            f'{self.base_url}/api/forms/validate',
            json={'form_id': form_id, 'field_data': data},
            headers=self.headers
        )
        return response.json()

# Usage
api = FormAPI('your-api-key')
form = api.create_form({
    'title': 'Customer Survey',
    'fields': [/* field definitions */]
})
""",
            "curl": """
# cURL Examples

# Create Form Schema
curl -X POST http://localhost:8000/api/forms/schema \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "title": "Contact Form",
    "fields": [
      {
        "id": "name",
        "type": "text",
        "label": "Name",
        "required": true
      }
    ]
  }'

# Submit Form Response
curl -X POST http://localhost:8000/api/forms/response \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "form_id": "form_123",
    "response_data": {
      "name": "John Doe"
    }
  }'

# Upload File
curl -X POST http://localhost:8000/api/forms/upload \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -F "file=@document.pdf" \\
  -F "form_id=form_123" \\
  -F "field_id=attachment"
"""
        }