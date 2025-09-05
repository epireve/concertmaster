# Visual Builder Backend API Contracts

## Overview

The Visual Builder backend provides comprehensive REST API endpoints for managing visual development projects, components, templates, and code generation across multiple frameworks (React, Vue, Angular, Vanilla JavaScript).

## Base URL
```
/api/visual-builder
```

## Authentication
All endpoints require authentication via JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Project Management

#### Create Project
```http
POST /projects
Content-Type: application/json

{
  "name": "My Project",
  "description": "Project description",
  "target_framework": "react",
  "framework_version": "18.2.0",
  "config": {},
  "theme_config": {},
  "project_structure": {},
  "is_template": false,
  "version": "1.0.0"
}

Response: 201 Created
{
  "id": "uuid",
  "name": "My Project",
  "description": "Project description",
  "target_framework": "react",
  "framework_version": "18.2.0",
  "config": {},
  "theme_config": {},
  "project_structure": {},
  "is_active": true,
  "is_template": false,
  "version": "1.0.0",
  "created_by": "uuid",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### List Projects
```http
GET /projects?offset=0&limit=50&target_framework=react&search_query=my

Response: 200 OK
{
  "projects": [
    {
      "id": "uuid",
      "name": "My Project",
      "description": "Project description",
      "target_framework": "react",
      "framework_version": "18.2.0",
      "config": {},
      "theme_config": {},
      "project_structure": {},
      "is_active": true,
      "is_template": false,
      "version": "1.0.0",
      "created_by": "uuid",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 50
}
```

#### Get Project
```http
GET /projects/{project_id}

Response: 200 OK
{
  "id": "uuid",
  "name": "My Project",
  // ... full project details
}
```

#### Update Project
```http
PUT /projects/{project_id}
Content-Type: application/json

{
  "name": "Updated Project Name",
  "description": "Updated description"
}

Response: 200 OK
{
  // Updated project object
}
```

#### Delete Project
```http
DELETE /projects/{project_id}

Response: 204 No Content
```

#### Get Project Statistics
```http
GET /projects/{project_id}/statistics

Response: 200 OK
{
  "project_id": "uuid",
  "component_count": 5,
  "page_count": 3,
  "export_count": 2,
  "target_framework": "react",
  "version": "1.0.0",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Component Management

#### Create Component
```http
POST /components
Content-Type: application/json

{
  "project_id": "uuid",
  "name": "Button",
  "component_type": "button",
  "category": "input",
  "definition": {
    "type": "button",
    "props": {
      "className": "btn btn-primary"
    },
    "children": ["Click me"]
  },
  "props_schema": {
    "variant": {
      "type": "string",
      "default": "primary",
      "required": false
    },
    "size": {
      "type": "string",
      "default": "medium",
      "required": false
    }
  },
  "default_props": {
    "variant": "primary",
    "size": "medium"
  },
  "styles": {
    "backgroundColor": "#007bff",
    "color": "white",
    "padding": "0.5rem 1rem",
    "border": "none",
    "borderRadius": "4px"
  },
  "events": {
    "click": {
      "handler": "console.log('Button clicked')"
    }
  },
  "description": "A customizable button component",
  "tags": ["ui", "interactive"],
  "version": "1.0.0",
  "is_global": false
}

Response: 201 Created
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "Button",
  "component_type": "button",
  "category": "input",
  "definition": { /* component definition */ },
  "props_schema": { /* props schema */ },
  "default_props": { /* default props */ },
  "styles": { /* component styles */ },
  "events": { /* event handlers */ },
  "description": "A customizable button component",
  "tags": ["ui", "interactive"],
  "version": "1.0.0",
  "is_active": true,
  "is_global": false,
  "usage_count": 0,
  "created_by": "uuid",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### List Components
```http
GET /components?offset=0&limit=50&category=input&component_type=button&is_global=false&project_id=uuid&search_query=button

Response: 200 OK
{
  "components": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "name": "Button",
      // ... full component details
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 50
}
```

#### Get Component
```http
GET /components/{component_id}

Response: 200 OK
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "Button",
  // ... full component details
}
```

#### Validate Component
```http
POST /components/validate
Content-Type: application/json

{
  "component_type": "button",
  "definition": {
    "type": "button",
    "props": {
      "className": "btn btn-primary"
    },
    "children": ["Click me"]
  },
  "target_framework": "react",
  "validate_props": true,
  "validate_events": true
}

Response: 200 OK
{
  "is_valid": true,
  "errors": [],
  "warnings": [],
  "suggestions": [
    {
      "type": "accessibility",
      "message": "Add aria-label for better accessibility"
    }
  ]
}
```

### Template Management

#### Create Template
```http
POST /templates
Content-Type: application/json

{
  "name": "Modern Button",
  "display_name": "Modern Button Template",
  "description": "A modern, customizable button template",
  "category": "input",
  "template_config": {
    "component_type": "button",
    "definition": {
      "type": "button",
      "props": {
        "className": "modern-btn"
      }
    },
    "styles": {
      "backgroundColor": "var(--primary-color)",
      "color": "white",
      "border": "none",
      "borderRadius": "8px",
      "padding": "12px 24px",
      "fontSize": "16px",
      "fontWeight": "600",
      "cursor": "pointer",
      "transition": "all 0.2s ease"
    }
  },
  "supported_frameworks": ["react", "vue", "angular"],
  "customizable_props": ["variant", "size", "disabled"],
  "style_variants": [
    {
      "name": "primary",
      "styles": { "backgroundColor": "#007bff" }
    },
    {
      "name": "secondary", 
      "styles": { "backgroundColor": "#6c757d" }
    }
  ],
  "preview_config": {
    "props": { "variant": "primary", "size": "medium" },
    "children": ["Preview Button"]
  },
  "documentation": {
    "usage": "Use this button for primary actions",
    "examples": ["<Button variant='primary'>Click me</Button>"]
  },
  "is_premium": false,
  "version": "1.0.0"
}

Response: 201 Created
{
  "id": "uuid",
  "name": "Modern Button",
  "display_name": "Modern Button Template",
  // ... full template details
  "is_active": true,
  "usage_count": 0,
  "rating": 0,
  "created_by": "uuid",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### List Templates
```http
GET /templates?offset=0&limit=50&category=input&supported_framework=react&is_premium=false&search_query=button

Response: 200 OK
{
  "templates": [
    {
      "id": "uuid",
      "name": "Modern Button",
      // ... template details
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 50
}
```

### Page Management

#### Create Page
```http
POST /projects/{project_id}/pages
Content-Type: application/json

{
  "name": "Home",
  "title": "Home Page",
  "description": "Main landing page",
  "path": "/",
  "is_dynamic": false,
  "layout_definition": {
    "type": "div",
    "props": { "className": "page-container" },
    "children": [
      {
        "type": "header",
        "props": { "className": "page-header" },
        "children": ["Welcome"]
      }
    ]
  },
  "component_instances": [
    {
      "component_id": "uuid",
      "props": { "variant": "primary" },
      "position": { "x": 0, "y": 100 }
    }
  ],
  "meta_tags": {
    "title": "Home - My App",
    "description": "Welcome to my app",
    "keywords": "home, landing"
  },
  "access_control": {
    "public": true,
    "roles": []
  },
  "is_home_page": true
}

Response: 201 Created
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "Home",
  "title": "Home Page",
  "description": "Main landing page",
  "path": "/",
  "is_dynamic": false,
  "layout_definition": { /* layout definition */ },
  "component_instances": [ /* component instances */ ],
  "meta_tags": { /* meta tags */ },
  "access_control": { /* access control */ },
  "is_active": true,
  "is_home_page": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Export/Import Operations

#### Export Project
```http
POST /projects/{project_id}/export
Content-Type: application/json

{
  "export_type": "code",
  "export_format": "zip",
  "export_config": {
    "include_dependencies": true,
    "include_documentation": true,
    "minify_code": false
  },
  "included_components": ["uuid1", "uuid2"]
}

Response: 201 Created
{
  "id": "uuid",
  "project_id": "uuid",
  "export_type": "code",
  "export_format": "zip",
  "status": "pending",
  "file_path": null,
  "file_size": null,
  "error_message": null,
  "created_at": "2024-01-01T00:00:00Z",
  "completed_at": null
}
```

#### Import Project
```http
POST /projects/import
Content-Type: application/json

{
  "import_data": {
    "project": { /* project definition */ },
    "components": [ /* component definitions */ ],
    "pages": [ /* page definitions */ ]
  },
  "import_config": {
    "merge_conflicts": "overwrite",
    "preserve_ids": false
  },
  "overwrite_existing": false
}

Response: 201 Created
{
  "success": true,
  "project_id": "uuid",
  "imported_components": ["uuid1", "uuid2"],
  "imported_pages": ["uuid3"],
  "errors": [],
  "warnings": []
}
```

### Code Generation

#### Generate Code
```http
POST /projects/{project_id}/generate
Content-Type: application/json

{
  "generation_type": "project",
  "target_framework": "react",
  "generation_config": {
    "typescript": true,
    "testing": true,
    "storybook": false,
    "styling": "css-modules",
    "build_tool": "vite",
    "state_management": "redux"
  }
}

Response: 201 Created
{
  "id": "uuid",
  "project_id": "uuid",
  "generation_type": "project",
  "target_framework": "react",
  "status": "pending",
  "progress_percentage": 0,
  "generated_files": [],
  "generation_log": [],
  "error_details": null,
  "started_at": null,
  "completed_at": null,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Utility Endpoints

#### Get Supported Frameworks
```http
GET /frameworks

Response: 200 OK
{
  "frameworks": [
    {
      "value": "react",
      "name": "React",
      "description": "React framework support"
    },
    {
      "value": "vue",
      "name": "Vue",
      "description": "Vue framework support"
    },
    {
      "value": "angular",
      "name": "Angular",
      "description": "Angular framework support"
    },
    {
      "value": "vanilla",
      "name": "Vanilla",
      "description": "Vanilla framework support"
    }
  ]
}
```

#### Get Component Categories
```http
GET /component-categories

Response: 200 OK
{
  "categories": [
    {
      "value": "layout",
      "name": "Layout",
      "description": "Layout components"
    },
    {
      "value": "input",
      "name": "Input",
      "description": "Input components"
    },
    {
      "value": "display",
      "name": "Display",
      "description": "Display components"
    },
    {
      "value": "navigation",
      "name": "Navigation",
      "description": "Navigation components"
    },
    {
      "value": "feedback",
      "name": "Feedback",
      "description": "Feedback components"
    },
    {
      "value": "data",
      "name": "Data",
      "description": "Data components"
    },
    {
      "value": "media",
      "name": "Media",
      "description": "Media components"
    }
  ]
}
```

#### Health Check
```http
GET /health

Response: 200 OK
{
  "status": "healthy",
  "service": "visual-builder",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "detail": "Error description",
  "status_code": 400
}
```

### Common Error Codes

- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate name)
- `422 Unprocessable Entity` - Validation errors
- `500 Internal Server Error` - Server error

## Database Models

### Key Models

#### VisualBuilderProject
- `id`: UUID (Primary Key)
- `name`: String (255) - Project name
- `description`: Text - Project description
- `target_framework`: String (50) - Target framework (react, vue, angular, vanilla)
- `framework_version`: String (20) - Framework version
- `config`: JSONB - Project configuration
- `theme_config`: JSONB - Theme configuration
- `project_structure`: JSONB - Project structure
- `version`: String (50) - Project version
- `is_active`: Boolean - Active status
- `is_template`: Boolean - Template flag
- `created_by`: UUID - User ID
- `created_at`: DateTime - Creation timestamp
- `updated_at`: DateTime - Update timestamp

#### VisualBuilderComponent
- `id`: UUID (Primary Key)
- `project_id`: UUID (Foreign Key) - Project reference
- `name`: String (255) - Component name
- `component_type`: String (100) - Component type
- `category`: String (100) - Component category
- `definition`: JSONB - Component structure
- `props_schema`: JSONB - Props schema
- `default_props`: JSONB - Default props
- `styles`: JSONB - Component styles
- `events`: JSONB - Event handlers
- `framework_config`: JSONB - Framework-specific config
- `description`: Text - Component description
- `tags`: JSONB - Component tags
- `version`: String (50) - Component version
- `is_active`: Boolean - Active status
- `is_global`: Boolean - Global availability
- `usage_count`: Integer - Usage counter
- `created_by`: UUID - User ID
- `created_at`: DateTime - Creation timestamp
- `updated_at`: DateTime - Update timestamp

#### ComponentTemplate
- `id`: UUID (Primary Key)
- `name`: String (255) - Template name
- `display_name`: String (255) - Display name
- `description`: Text - Template description
- `category`: String (100) - Template category
- `template_config`: JSONB - Template configuration
- `supported_frameworks`: JSONB - Supported frameworks list
- `customizable_props`: JSONB - Customizable properties
- `style_variants`: JSONB - Style variations
- `preview_config`: JSONB - Preview configuration
- `documentation`: JSONB - Documentation
- `is_active`: Boolean - Active status
- `is_premium`: Boolean - Premium flag
- `usage_count`: Integer - Usage counter
- `rating`: Integer - Average rating (0-5)
- `version`: String (50) - Template version
- `created_by`: UUID - User ID
- `created_at`: DateTime - Creation timestamp
- `updated_at`: DateTime - Update timestamp

## Code Generation Framework

### Supported Frameworks

#### React Generator
- **Output**: TypeScript/JavaScript React components
- **Features**: Hooks, class components, CSS modules, tests, Storybook
- **Build Tools**: Vite, Create React App, Webpack
- **State Management**: Redux, Zustand, Context API
- **Styling**: CSS Modules, Styled Components, Emotion

#### Vue Generator
- **Output**: Vue 3 components with Composition/Options API
- **Features**: TypeScript support, Scoped styles, Tests
- **Build Tools**: Vite, Vue CLI
- **State Management**: Vuex, Pinia
- **Styling**: Scoped CSS, CSS Modules

#### Angular Generator  
- **Output**: Angular components with TypeScript
- **Features**: Standalone/module components, Services, Tests
- **Build Tools**: Angular CLI, Webpack
- **State Management**: NgRx, Akita
- **Styling**: SCSS, CSS

#### Vanilla Generator
- **Output**: Plain HTML/CSS/JavaScript
- **Features**: ES6+ classes/modules, TypeScript, PWA
- **Build Tools**: Vite, Webpack, None
- **Module Systems**: ES6 Modules, CommonJS
- **Styling**: CSS, SCSS

### Code Generation Process

1. **Component Validation**: Validate component definition against framework requirements
2. **Template Processing**: Apply framework-specific templates
3. **Code Generation**: Generate source code files
4. **Dependency Resolution**: Determine required dependencies
5. **Build Configuration**: Generate build tool configurations
6. **Documentation**: Generate README and API docs
7. **Testing**: Generate test files and configurations

## Integration Points

### Frontend Integration
- Components can be integrated with frontend via REST API
- Real-time updates via WebSocket connections
- File upload/download for project export/import

### Database Integration
- PostgreSQL with JSONB for flexible component storage
- Full-text search on components and projects
- Optimized indexes for performance

### Authentication Integration
- JWT-based authentication
- Role-based access control
- User workspace isolation

## Performance Considerations

- **Pagination**: All list endpoints support offset/limit pagination
- **Filtering**: Efficient filtering with database indexes
- **Caching**: Redis caching for frequently accessed data
- **Background Jobs**: Code generation and export operations run asynchronously
- **File Storage**: Large files stored in S3-compatible storage

## Security Features

- **Input Validation**: All inputs validated with Pydantic schemas
- **SQL Injection Protection**: SQLAlchemy ORM with parameterized queries
- **XSS Protection**: Output sanitization
- **Rate Limiting**: API rate limiting to prevent abuse
- **Access Control**: User-based resource access control