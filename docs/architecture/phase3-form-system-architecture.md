# Phase 3 Form System - Comprehensive Architecture Design

## Executive Summary

The Phase 3 Form System is a comprehensive form management solution featuring a visual form builder, dynamic form renderer, and robust validation engine. This architecture follows modern software design principles with emphasis on scalability, security, and user experience.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                         │
├─────────────────────┬───────────────────┬──────────────────────┤
│   Form Builder UI   │   Form Renderer   │   Management UI      │
│   (React+TanStack)  │   (Dynamic Forms) │   (Analytics/Admin)  │
└─────────────────────┴───────────────────┴──────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                          │
├─────────────────────┬───────────────────┬──────────────────────┤
│   Form Services     │   Validation      │   Integration Hub    │
│   (CRUD, Logic)     │   Engine          │   (Webhooks, APIs)   │
└─────────────────────┴───────────────────┴──────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                       Domain Layer                              │
├─────────────────────┬───────────────────┬──────────────────────┤
│   Form Schema       │   Response        │   Validation Rules   │
│   Management        │   Processing      │   Engine             │
└─────────────────────┴───────────────────┴──────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                          │
├─────────────────────┬───────────────────┬──────────────────────┤
│   PostgreSQL        │   Redis Cache     │   File Storage       │
│   (Primary DB)      │   (Sessions)      │   (S3 Compatible)    │
└─────────────────────┴───────────────────┴──────────────────────┘
```

## Core Components

### 1. Form Builder Engine

**Purpose**: Visual form creation with drag-and-drop interface

**Key Features**:
- Field palette with 20+ field types
- Visual form designer with real-time preview
- Advanced field configuration (validation, styling, logic)
- Template system with predefined forms
- Version management and form history

**Technology Stack**:
- React 18 with TypeScript
- TanStack Form for form state management
- React DnD for drag-and-drop functionality
- Monaco Editor for advanced configurations
- React Query for data synchronization

### 2. Dynamic Form Renderer

**Purpose**: Runtime form rendering with progressive enhancement

**Key Features**:
- Server-side rendering capable
- Progressive enhancement for JavaScript-disabled clients
- Dynamic field visibility based on conditions
- Multi-step form support
- Auto-save and draft management
- Mobile-responsive design

**Architecture**:
```typescript
interface FormRendererProps {
  schema: FormSchema;
  mode: 'edit' | 'view' | 'preview';
  onSubmit: (data: FormData) => Promise<void>;
  onSave?: (data: Partial<FormData>) => Promise<void>;
  initialData?: Partial<FormData>;
  validationMode: 'onChange' | 'onBlur' | 'onSubmit';
}
```

### 3. Validation Engine

**Purpose**: Multi-layer validation system (client + server)

**Validation Layers**:
1. **Client-side Validation**: Real-time user feedback
2. **Server-side Validation**: Security and data integrity
3. **Business Logic Validation**: Custom rules and constraints
4. **Integration Validation**: External system compatibility

**Validation Rules Engine**:
```typescript
interface ValidationRule {
  id: string;
  type: 'required' | 'pattern' | 'length' | 'range' | 'custom';
  config: Record<string, any>;
  message: string;
  async?: boolean;
}

interface ValidationContext {
  field: FormField;
  value: any;
  formData: Record<string, any>;
  user?: User;
  environment: 'client' | 'server';
}
```

## Backend API Architecture

### 1. Core Endpoints

```yaml
# Form Schema Management
POST   /api/forms/schemas           # Create form schema
GET    /api/forms/schemas           # List schemas (paginated)
GET    /api/forms/schemas/{id}      # Get specific schema
PUT    /api/forms/schemas/{id}      # Update schema
DELETE /api/forms/schemas/{id}      # Delete schema (soft delete)
POST   /api/forms/schemas/{id}/versions  # Create new version

# Form Rendering
GET    /api/forms/{id}/render       # Get rendered form definition
POST   /api/forms/{id}/validate     # Validate form data
GET    /api/forms/{id}/preview      # Preview mode data

# Form Submission
POST   /api/forms/{id}/responses    # Submit form response
PATCH  /api/forms/{id}/responses/{responseId}  # Update draft response
GET    /api/forms/{id}/responses    # List responses (admin)
GET    /api/forms/responses/{id}    # Get specific response
DELETE /api/forms/responses/{id}    # Delete response (GDPR)

# Form Analytics
GET    /api/forms/{id}/analytics    # Form performance metrics
GET    /api/forms/{id}/analytics/fields  # Field-level analytics
POST   /api/forms/{id}/analytics/events  # Track user interactions

# Form Templates
GET    /api/forms/templates         # List available templates
POST   /api/forms/templates/{id}/apply   # Apply template to new form
```

### 2. Request/Response Schemas

```python
# Form Schema Creation
class FormSchemaCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    version: str = Field(default="1.0.0")
    fields: List[FormFieldDefinition]
    sections: List[FormSectionDefinition] = []
    settings: FormSettings
    styling: FormStyling
    layout: FormLayout
    metadata: Dict[str, Any] = {}

# Form Response Submission
class FormResponseSubmitRequest(BaseModel):
    data: Dict[str, Any]
    metadata: FormResponseMetadata
    draft: bool = False
    workflow_context: Optional[Dict[str, Any]] = None

class FormResponseSubmitResponse(BaseModel):
    id: UUID
    status: ResponseStatus
    validation_errors: List[ValidationError] = []
    next_action: Optional[str] = None
    redirect_url: Optional[str] = None
```

### 3. Service Layer Architecture

```python
# Form Schema Service
class FormSchemaService:
    def __init__(self, db: Database, cache: Cache, validator: ValidationEngine):
        self.db = db
        self.cache = cache
        self.validator = validator
    
    async def create_schema(self, schema_data: FormSchemaCreateRequest, 
                          user_id: UUID) -> FormSchema:
        # Validate schema structure
        # Generate unique form ID
        # Store in database
        # Cache compiled schema
        # Trigger webhook notifications
        
    async def get_compiled_schema(self, form_id: UUID) -> CompiledFormSchema:
        # Check cache first
        # Compile schema with current context
        # Cache compiled result
        
    async def validate_response(self, form_id: UUID, 
                              response_data: Dict[str, Any]) -> ValidationResult:
        # Load schema and validation rules
        # Run client-side validation rules
        # Execute server-side validations
        # Check business logic constraints
        # Return comprehensive validation result

# Form Response Service  
class FormResponseService:
    async def submit_response(self, form_id: UUID, 
                            response_data: FormResponseSubmitRequest,
                            user_context: Optional[UserContext]) -> FormResponseSubmitResponse:
        # Validate response data
        # Check submission limits and permissions
        # Process file uploads
        # Store response
        # Trigger integrations
        # Send notifications
        # Return submission result
```

## Frontend Component Architecture

### 1. Form Builder Components

```typescript
// Core Builder Component
const FormBuilder: React.FC<FormBuilderProps> = ({
  initialSchema,
  onSave,
  onPublish,
  readonly = false
}) => {
  const [schema, setSchema] = useState<FormSchema>(initialSchema);
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  
  return (
    <div className="form-builder">
      <FormBuilderToolbar 
        onSave={handleSave}
        onPreview={() => setPreviewMode(!previewMode)}
        onPublish={handlePublish}
      />
      
      <div className="builder-workspace">
        <FieldPalette onFieldAdd={handleFieldAdd} />
        
        <FormCanvas
          schema={schema}
          selectedField={selectedField}
          onFieldSelect={setSelectedField}
          onFieldUpdate={handleFieldUpdate}
          onFieldDelete={handleFieldDelete}
        />
        
        <PropertyPanel
          selectedField={selectedField}
          onFieldUpdate={handleFieldUpdate}
        />
      </div>
      
      {previewMode && (
        <FormPreview
          schema={schema}
          onClose={() => setPreviewMode(false)}
        />
      )}
    </div>
  );
};

// Field Configuration Panel
const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedField,
  onFieldUpdate
}) => {
  if (!selectedField) return <EmptyState />;
  
  return (
    <div className="property-panel">
      <FieldBasicSettings
        field={selectedField}
        onChange={onFieldUpdate}
      />
      
      <FieldValidationSettings
        field={selectedField}
        onChange={onFieldUpdate}
      />
      
      <FieldStylingSettings
        field={selectedField}
        onChange={onFieldUpdate}
      />
      
      <FieldAdvancedSettings
        field={selectedField}
        onChange={onFieldUpdate}
      />
    </div>
  );
};
```

### 2. Dynamic Form Renderer Components

```typescript
// Main Form Renderer
const FormRenderer: React.FC<FormRendererProps> = ({
  schema,
  mode,
  initialData,
  onSubmit,
  onSave
}) => {
  const form = useForm<FormData>({
    resolver: createResolver(schema),
    defaultValues: initialData,
    mode: 'onChange'
  });
  
  const { mutate: submitForm } = useFormSubmission({
    onSuccess: handleSubmissionSuccess,
    onError: handleSubmissionError
  });
  
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="dynamic-form">
        <FormHeader schema={schema} />
        
        {schema.sections.map(section => (
          <FormSection
            key={section.id}
            section={section}
            fields={getFieldsForSection(schema.fields, section.id)}
            mode={mode}
          />
        ))}
        
        <FormActions
          mode={mode}
          onSave={onSave}
          loading={form.formState.isSubmitting}
        />
      </form>
    </FormProvider>
  );
};

// Field Renderer with Dynamic Types
const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  mode
}) => {
  const { register, formState, watch } = useFormContext();
  const fieldValue = watch(field.name);
  
  // Dynamic field visibility
  const isVisible = useMemo(() => 
    evaluateVisibilityRules(field.visibility, watch()), 
    [field.visibility, watch()]
  );
  
  if (!isVisible) return null;
  
  const FieldComponent = getFieldComponent(field.type);
  
  return (
    <div className={`field-container field-${field.type}`}>
      <FieldLabel field={field} />
      
      <FieldComponent
        {...register(field.name, getValidationRules(field))}
        field={field}
        value={fieldValue}
        error={formState.errors[field.name]}
        disabled={mode === 'view'}
      />
      
      <FieldError error={formState.errors[field.name]} />
      <FieldDescription field={field} />
    </div>
  );
};
```

## Data Persistence Strategy

### 1. Database Schema Design

```sql
-- Form Schemas with versioning
CREATE TABLE form_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    schema_definition JSONB NOT NULL,
    compiled_schema JSONB NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    styling JSONB NOT NULL DEFAULT '{}',
    layout JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Form schema versioning
CREATE TABLE form_schema_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_schema_id UUID NOT NULL,
    version VARCHAR(50) NOT NULL,
    schema_definition JSONB NOT NULL,
    compiled_schema JSONB NOT NULL,
    change_summary TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_form_schema FOREIGN KEY (form_schema_id) REFERENCES form_schemas(id) ON DELETE CASCADE,
    CONSTRAINT unique_form_version UNIQUE (form_schema_id, version)
);

-- Form Responses with rich metadata
CREATE TABLE form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_schema_id UUID NOT NULL,
    form_version VARCHAR(50) NOT NULL,
    workflow_run_id UUID,
    user_id UUID,
    session_id VARCHAR(255),
    data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    validation_errors JSONB,
    draft_data JSONB,
    submitted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_form_schema FOREIGN KEY (form_schema_id) REFERENCES form_schemas(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved', 'rejected'))
);

-- Form Analytics Events
CREATE TABLE form_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_schema_id UUID NOT NULL,
    response_id UUID,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    user_agent TEXT,
    ip_address INET,
    session_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_form_schema FOREIGN KEY (form_schema_id) REFERENCES form_schemas(id),
    CONSTRAINT fk_response FOREIGN KEY (response_id) REFERENCES form_responses(id)
);

-- Indexes for performance
CREATE INDEX idx_form_schemas_created_by ON form_schemas(created_by);
CREATE INDEX idx_form_schemas_status ON form_schemas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_form_responses_form_schema ON form_responses(form_schema_id);
CREATE INDEX idx_form_responses_status ON form_responses(status);
CREATE INDEX idx_form_responses_submitted_at ON form_responses(submitted_at);
CREATE INDEX idx_form_analytics_form_timestamp ON form_analytics_events(form_schema_id, timestamp);
```

### 2. Caching Strategy

```python
class FormCacheManager:
    def __init__(self, redis_client: Redis, ttl: int = 3600):
        self.redis = redis_client
        self.ttl = ttl
    
    async def cache_compiled_schema(self, form_id: UUID, compiled_schema: dict):
        """Cache compiled form schema for fast rendering"""
        cache_key = f"form_schema:{form_id}:compiled"
        await self.redis.setex(
            cache_key,
            self.ttl,
            json.dumps(compiled_schema, default=str)
        )
    
    async def cache_validation_rules(self, form_id: UUID, rules: dict):
        """Cache validation rules for quick validation"""
        cache_key = f"form_validation:{form_id}"
        await self.redis.setex(cache_key, self.ttl, json.dumps(rules))
    
    async def cache_form_analytics(self, form_id: UUID, analytics: dict):
        """Cache analytics data with shorter TTL"""
        cache_key = f"form_analytics:{form_id}"
        await self.redis.setex(cache_key, 300, json.dumps(analytics))  # 5 min TTL
```

### 3. File Storage Strategy

```python
class FormFileManager:
    def __init__(self, s3_client, bucket_name: str):
        self.s3 = s3_client
        self.bucket = bucket_name
    
    async def upload_form_file(self, form_id: UUID, response_id: UUID, 
                              field_name: str, file_data: bytes, 
                              filename: str) -> str:
        """Upload form file with organized path structure"""
        file_path = f"forms/{form_id}/responses/{response_id}/{field_name}/{filename}"
        
        # Upload with metadata
        await self.s3.upload_fileobj(
            io.BytesIO(file_data),
            self.bucket,
            file_path,
            ExtraArgs={
                'Metadata': {
                    'form_id': str(form_id),
                    'response_id': str(response_id),
                    'field_name': field_name,
                    'original_filename': filename,
                    'upload_timestamp': datetime.utcnow().isoformat()
                },
                'ServerSideEncryption': 'AES256'
            }
        )
        
        return file_path
    
    async def generate_signed_url(self, file_path: str, expires_in: int = 3600) -> str:
        """Generate secure download URL"""
        return await self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': file_path},
            ExpiresIn=expires_in
        )
```

## Validation System Architecture

### 1. Multi-Layer Validation

```typescript
// Client-side validation with Zod
const createFormValidator = (schema: FormSchema) => {
  const validators: Record<string, z.ZodType> = {};
  
  schema.fields.forEach(field => {
    let validator = createFieldValidator(field);
    
    // Add conditional validation
    if (field.visibility) {
      validator = validator.refine(
        (value, ctx) => evaluateVisibilityRules(field.visibility, ctx.path),
        { message: 'Field not visible' }
      );
    }
    
    validators[field.name] = validator;
  });
  
  return z.object(validators);
};

// Server-side validation engine
class ValidationEngine:
    def __init__(self, db: Database):
        self.db = db
        self.validators = {
            'required': RequiredValidator(),
            'email': EmailValidator(),
            'phone': PhoneValidator(),
            'url': URLValidator(),
            'pattern': PatternValidator(),
            'range': RangeValidator(),
            'length': LengthValidator(),
            'custom': CustomValidator(),
            'async': AsyncValidator(db)
        }
    
    async def validate_response(self, form_schema: FormSchema, 
                              response_data: dict) -> ValidationResult:
        errors = []
        
        for field in form_schema.fields:
            field_value = response_data.get(field.name)
            
            # Check field visibility first
            if not self._is_field_visible(field, response_data):
                continue
            
            # Run validation rules
            for rule in field.validation:
                validator = self.validators[rule.type]
                result = await validator.validate(
                    field_value, 
                    rule.config, 
                    ValidationContext(field, response_data)
                )
                
                if not result.valid:
                    errors.append(ValidationError(
                        field=field.name,
                        rule=rule.type,
                        message=rule.message or result.message,
                        code=result.code
                    ))
        
        return ValidationResult(valid=len(errors) == 0, errors=errors)
```

### 2. Custom Validation Rules

```python
class CustomValidationEngine:
    """Support for custom validation logic"""
    
    def __init__(self):
        self.custom_rules = {}
    
    def register_rule(self, rule_name: str, validator_func: callable):
        """Register custom validation rule"""
        self.custom_rules[rule_name] = validator_func
    
    async def execute_custom_rule(self, rule_name: str, 
                                 value: any, config: dict, 
                                 context: ValidationContext) -> ValidationResult:
        """Execute custom validation rule safely"""
        if rule_name not in self.custom_rules:
            raise ValidationError(f"Unknown custom rule: {rule_name}")
        
        try:
            # Execute in sandboxed environment
            result = await self.custom_rules[rule_name](value, config, context)
            return ValidationResult(
                valid=result.get('valid', True),
                message=result.get('message', ''),
                code=result.get('code', 'custom_validation_failed')
            )
        except Exception as e:
            logger.error(f"Custom validation rule error: {e}")
            return ValidationResult(
                valid=False,
                message="Custom validation failed",
                code="custom_rule_error"
            )

# Example custom rules
@custom_rule('business_email')
async def validate_business_email(email: str, config: dict, 
                                context: ValidationContext) -> dict:
    """Validate that email is from business domain"""
    domain = email.split('@')[1].lower()
    blocked_domains = ['gmail.com', 'yahoo.com', 'hotmail.com']
    
    if domain in blocked_domains:
        return {
            'valid': False,
            'message': 'Please use a business email address',
            'code': 'business_email_required'
        }
    
    return {'valid': True}

@custom_rule('unique_email')
async def validate_unique_email(email: str, config: dict, 
                               context: ValidationContext) -> dict:
    """Async validation for email uniqueness"""
    existing = await context.db.execute(
        "SELECT id FROM users WHERE email = $1", email
    )
    
    if existing:
        return {
            'valid': False,
            'message': 'Email address already exists',
            'code': 'email_duplicate'
        }
    
    return {'valid': True}
```

## Error Handling & User Feedback

### 1. Error Classification System

```typescript
interface FormError {
  id: string;
  type: 'validation' | 'submission' | 'network' | 'permission' | 'system';
  severity: 'error' | 'warning' | 'info';
  field?: string;
  message: string;
  code: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: Date;
}

class FormErrorHandler {
  private errors: Map<string, FormError> = new Map();
  private listeners: Set<(errors: FormError[]) => void> = new Set();
  
  addError(error: Omit<FormError, 'id' | 'timestamp'>) {
    const formError: FormError = {
      ...error,
      id: generateId(),
      timestamp: new Date()
    };
    
    this.errors.set(formError.id, formError);
    this.notifyListeners();
    
    // Auto-clear non-critical errors
    if (formError.severity !== 'error') {
      setTimeout(() => this.clearError(formError.id), 5000);
    }
  }
  
  clearError(errorId: string) {
    this.errors.delete(errorId);
    this.notifyListeners();
  }
  
  getFieldErrors(fieldName: string): FormError[] {
    return Array.from(this.errors.values())
      .filter(error => error.field === fieldName);
  }
}
```

### 2. User Feedback Components

```typescript
// Toast notification system
const FormNotificationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [notifications, setNotifications] = useState<FormNotification[]>([]);
  
  const addNotification = useCallback((notification: FormNotification) => {
    setNotifications(prev => [...prev, {...notification, id: generateId()}]);
  }, []);
  
  return (
    <FormNotificationContext.Provider value={{addNotification}}>
      {children}
      <NotificationContainer notifications={notifications} />
    </FormNotificationContext.Provider>
  );
};

// Inline field validation feedback
const FieldValidationFeedback: React.FC<{
  field: FormField;
  error?: FieldError;
  touched: boolean;
}> = ({field, error, touched}) => {
  if (!touched || !error) return null;
  
  return (
    <div className={`field-feedback field-feedback--${error.severity}`}>
      <div className="feedback-icon">
        {error.severity === 'error' ? <ErrorIcon /> : <WarningIcon />}
      </div>
      <div className="feedback-message">
        {error.message}
        {error.retryable && (
          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};
```

### 3. Progressive Enhancement Strategy

```typescript
// Form with progressive enhancement
const ProgressiveForm: React.FC<ProgressiveFormProps> = ({
  schema,
  fallbackAction,
  enhancedSubmit
}) => {
  const [isJSEnabled, setIsJSEnabled] = useState(false);
  
  useEffect(() => {
    setIsJSEnabled(true);
  }, []);
  
  if (!isJSEnabled) {
    // Server-side form submission
    return (
      <form method="POST" action={fallbackAction}>
        <input type="hidden" name="form_id" value={schema.id} />
        {schema.fields.map(field => (
          <StaticFieldRenderer key={field.id} field={field} />
        ))}
        <button type="submit">Submit</button>
      </form>
    );
  }
  
  // Enhanced JavaScript version
  return <DynamicFormRenderer schema={schema} onSubmit={enhancedSubmit} />;
};
```

## Accessibility & Internationalization

### 1. Accessibility Features

```typescript
// WCAG 2.1 AA compliant form builder
const AccessibleFormField: React.FC<AccessibleFormFieldProps> = ({
  field,
  value,
  onChange,
  error
}) => {
  const fieldId = `field-${field.id}`;
  const errorId = `error-${field.id}`;
  const descriptionId = `desc-${field.id}`;
  
  return (
    <div className="form-field" role="group">
      <label 
        htmlFor={fieldId}
        className="form-label"
        id={`label-${field.id}`}
      >
        {field.label}
        {field.required && (
          <span className="required-indicator" aria-label="required">*</span>
        )}
      </label>
      
      {field.description && (
        <div id={descriptionId} className="field-description">
          {field.description}
        </div>
      )}
      
      <input
        id={fieldId}
        type={field.type}
        value={value}
        onChange={onChange}
        aria-labelledby={`label-${field.id}`}
        aria-describedby={[
          field.description ? descriptionId : '',
          error ? errorId : ''
        ].filter(Boolean).join(' ')}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={field.required}
      />
      
      {error && (
        <div 
          id={errorId}
          className="field-error"
          role="alert"
          aria-live="polite"
        >
          {error.message}
        </div>
      )}
    </div>
  );
};

// Keyboard navigation support
const useFormKeyboardNavigation = (formRef: RefObject<HTMLFormElement>) => {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // Custom tab navigation logic
        const focusableElements = form.querySelectorAll(
          'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
        );
        // Implementation for enhanced keyboard navigation
      }
    };
    
    form.addEventListener('keydown', handleKeyDown);
    return () => form.removeEventListener('keydown', handleKeyDown);
  }, [formRef]);
};
```

### 2. Internationalization Support

```typescript
// i18n configuration
const formI18nConfig = {
  fallbackLanguage: 'en',
  supportedLanguages: ['en', 'es', 'fr', 'de', 'ja', 'zh'],
  namespaces: ['forms', 'validation', 'common'],
  
  // Dynamic loading of translations
  loadTranslations: async (language: string, namespace: string) => {
    const translations = await import(`../locales/${language}/${namespace}.json`);
    return translations.default;
  }
};

// Multilingual form schema
interface MultilingualFormSchema extends FormSchema {
  translations: Record<string, {
    title: string;
    description?: string;
    fields: Record<string, {
      label: string;
      placeholder?: string;
      description?: string;
      validation: Record<string, string>; // Validation error messages
    }>;
  }>;
}

// Translation-aware form renderer
const MultilingualFormRenderer: React.FC<MultilingualFormRendererProps> = ({
  schema,
  language = 'en',
  onLanguageChange
}) => {
  const { t, changeLanguage } = useTranslation(['forms', 'validation']);
  
  const getFieldTranslation = (field: FormField, key: string): string => {
    const translations = schema.translations?.[language];
    return translations?.fields?.[field.id]?.[key] || field[key] || '';
  };
  
  useEffect(() => {
    changeLanguage(language);
  }, [language, changeLanguage]);
  
  return (
    <div className="multilingual-form" data-language={language}>
      <LanguageSelector
        currentLanguage={language}
        availableLanguages={Object.keys(schema.translations)}
        onChange={onLanguageChange}
      />
      
      <form>
        <h1>{schema.translations[language]?.title || schema.title}</h1>
        {schema.fields.map(field => (
          <FieldRenderer
            key={field.id}
            field={{
              ...field,
              label: getFieldTranslation(field, 'label'),
              placeholder: getFieldTranslation(field, 'placeholder'),
              description: getFieldTranslation(field, 'description')
            }}
            validationMessages={schema.translations[language]?.fields[field.id]?.validation}
          />
        ))}
      </form>
    </div>
  );
};
```

## Security Architecture

### 1. Input Sanitization & Validation

```python
class SecurityValidator:
    """Security-focused validation for form inputs"""
    
    def __init__(self):
        self.xss_patterns = [
            r'<script.*?>.*?</script>',
            r'javascript:',
            r'onload=',
            r'onerror=',
            # ... more XSS patterns
        ]
        self.sql_injection_patterns = [
            r'union\s+select',
            r'drop\s+table',
            r'insert\s+into',
            # ... more SQL injection patterns
        ]
    
    def sanitize_input(self, value: str, field_type: str) -> str:
        """Sanitize input based on field type"""
        if field_type == 'html':
            # Allow specific HTML tags only
            return bleach.clean(
                value,
                tags=['b', 'i', 'u', 'em', 'strong', 'p', 'br'],
                attributes={},
                strip=True
            )
        else:
            # Standard text sanitization
            return html.escape(value)
    
    def validate_security(self, value: str) -> List[SecurityViolation]:
        """Check for security violations"""
        violations = []
        
        # Check for XSS attempts
        for pattern in self.xss_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                violations.append(SecurityViolation(
                    type='xss_attempt',
                    message='Potential XSS attack detected',
                    pattern=pattern
                ))
        
        # Check for SQL injection
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                violations.append(SecurityViolation(
                    type='sql_injection_attempt',
                    message='Potential SQL injection detected',
                    pattern=pattern
                ))
        
        return violations
```

### 2. Rate Limiting & CSRF Protection

```python
class FormSecurityMiddleware:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    async def check_rate_limit(self, user_id: str, form_id: str) -> bool:
        """Rate limiting for form submissions"""
        key = f"rate_limit:form:{form_id}:user:{user_id}"
        current = await self.redis.get(key)
        
        if current and int(current) >= 10:  # Max 10 submissions per hour
            return False
        
        await self.redis.incr(key)
        await self.redis.expire(key, 3600)  # 1 hour TTL
        return True
    
    def generate_csrf_token(self, session_id: str, form_id: str) -> str:
        """Generate CSRF token for form"""
        payload = f"{session_id}:{form_id}:{int(time.time())}"
        return hmac.new(
            settings.SECRET_KEY.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    def verify_csrf_token(self, token: str, session_id: str, form_id: str) -> bool:
        """Verify CSRF token"""
        try:
            # Extract timestamp and verify token age
            expected_token = self.generate_csrf_token(session_id, form_id)
            return hmac.compare_digest(token, expected_token)
        except Exception:
            return False
```

## Performance Optimization

### 1. Frontend Performance

```typescript
// Form component lazy loading
const LazyFormBuilder = React.lazy(() => import('./FormBuilder'));
const LazyFormRenderer = React.lazy(() => import('./FormRenderer'));

// Virtual scrolling for large forms
const VirtualizedFormFields: React.FC<{fields: FormField[]}> = ({fields}) => {
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const virtualizer = useVirtual({
    size: fields.length,
    parentRef: { current: containerRef },
    estimateSize: useCallback(() => 120, []), // Estimated field height
  });
  
  return (
    <div ref={setContainerRef} className="virtualized-fields">
      <div style={{ height: virtualizer.totalSize }}>
        {virtualizer.virtualItems.map(virtualRow => {
          const field = fields[virtualRow.index];
          return (
            <div
              key={field.id}
              style={{
                position: 'absolute',
                top: virtualRow.start,
                left: 0,
                right: 0,
                height: virtualRow.size,
              }}
            >
              <FieldRenderer field={field} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Optimized form state management
const useOptimizedFormState = (schema: FormSchema) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // Debounced updates to prevent excessive re-renders
  const debouncedSetField = useMemo(
    () => debounce((fieldName: string, value: any) => {
      setFormData(prev => ({
        ...prev,
        [fieldName]: value
      }));
    }, 100),
    []
  );
  
  // Memoized field visibility calculations
  const fieldVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    schema.fields.forEach(field => {
      visibility[field.id] = evaluateVisibilityRules(field.visibility, formData);
    });
    return visibility;
  }, [schema.fields, formData]);
  
  return {
    formData,
    setField: debouncedSetField,
    fieldVisibility
  };
};
```

### 2. Backend Performance

```python
class FormPerformanceOptimizer:
    def __init__(self, db: AsyncDatabase, cache: AsyncRedis):
        self.db = db
        self.cache = cache
    
    async def get_form_with_cache(self, form_id: UUID) -> FormSchema:
        """Cached form schema retrieval"""
        cache_key = f"form_schema:{form_id}"
        
        # Try cache first
        cached = await self.cache.get(cache_key)
        if cached:
            return FormSchema.parse_raw(cached)
        
        # Database query with optimized joins
        query = """
            SELECT fs.*, u.name as creator_name
            FROM form_schemas fs
            JOIN users u ON fs.created_by = u.id
            WHERE fs.id = $1 AND fs.deleted_at IS NULL
        """
        
        result = await self.db.fetch_one(query, form_id)
        if not result:
            raise FormNotFoundError(f"Form {form_id} not found")
        
        schema = FormSchema.from_orm(result)
        
        # Cache for 1 hour
        await self.cache.setex(cache_key, 3600, schema.json())
        
        return schema
    
    async def batch_validate_responses(self, responses: List[FormResponseData]) -> List[ValidationResult]:
        """Batch validation for better performance"""
        form_schemas = {}
        results = []
        
        # Group by form schema to minimize queries
        for response in responses:
            if response.form_id not in form_schemas:
                form_schemas[response.form_id] = await self.get_form_with_cache(response.form_id)
        
        # Validate all responses
        for response in responses:
            schema = form_schemas[response.form_id]
            result = await self.validate_response(schema, response.data)
            results.append(result)
        
        return results
```

## Integration Architecture

### 1. Webhook System

```python
class WebhookManager:
    def __init__(self, http_client: httpx.AsyncClient, db: Database):
        self.http = http_client
        self.db = db
    
    async def register_webhook(self, form_id: UUID, config: WebhookConfig) -> UUID:
        """Register webhook for form events"""
        webhook_id = uuid4()
        
        await self.db.execute(
            """
            INSERT INTO form_webhooks (id, form_id, url, events, config, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            """,
            webhook_id, form_id, config.url, config.events, config.dict()
        )
        
        return webhook_id
    
    async def trigger_webhooks(self, form_id: UUID, event: str, payload: dict):
        """Trigger all webhooks for form event"""
        webhooks = await self.db.fetch_all(
            "SELECT * FROM form_webhooks WHERE form_id = $1 AND $2 = ANY(events) AND active = true",
            form_id, event
        )
        
        for webhook in webhooks:
            await self._send_webhook(webhook, event, payload)
    
    async def _send_webhook(self, webhook: dict, event: str, payload: dict):
        """Send individual webhook with retry logic"""
        webhook_payload = {
            'event': event,
            'form_id': str(webhook['form_id']),
            'timestamp': datetime.utcnow().isoformat(),
            'data': payload
        }
        
        for attempt in range(3):  # Max 3 retries
            try:
                response = await self.http.post(
                    webhook['url'],
                    json=webhook_payload,
                    headers=webhook['config'].get('headers', {}),
                    timeout=10.0
                )
                
                if response.status_code < 400:
                    await self._log_webhook_success(webhook['id'], attempt + 1)
                    return
                
            except Exception as e:
                await self._log_webhook_error(webhook['id'], attempt + 1, str(e))
                if attempt < 2:  # Wait before retry
                    await asyncio.sleep(2 ** attempt)
        
        # All retries failed
        await self._handle_webhook_failure(webhook['id'])
```

### 2. Third-party Integrations

```python
class IntegrationHub:
    def __init__(self):
        self.integrations = {
            'zapier': ZapierIntegration(),
            'salesforce': SalesforceIntegration(),
            'hubspot': HubSpotIntegration(),
            'mailchimp': MailChimpIntegration(),
            'slack': SlackIntegration(),
        }
    
    async def process_form_submission(self, form_id: UUID, response_data: dict):
        """Process form submission through all active integrations"""
        integrations = await self.get_active_integrations(form_id)
        
        for integration_config in integrations:
            integration = self.integrations[integration_config.type]
            
            try:
                await integration.process_submission(
                    config=integration_config,
                    data=response_data
                )
                
                await self._log_integration_success(
                    form_id, integration_config.id, 'form_submission'
                )
                
            except Exception as e:
                await self._log_integration_error(
                    form_id, integration_config.id, 'form_submission', str(e)
                )
    
    async def get_active_integrations(self, form_id: UUID) -> List[IntegrationConfig]:
        """Get all active integrations for a form"""
        return await self.db.fetch_all(
            "SELECT * FROM form_integrations WHERE form_id = $1 AND active = true",
            form_id
        )
```

## Deployment & Operations

### 1. Container Architecture

```dockerfile
# Multi-stage build for optimized images
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS backend-build
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# Production image
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY --from=backend-build /app ./backend
COPY --from=backend-build /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy frontend build
COPY --from=frontend-build /app/dist ./frontend/dist

# Configure nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

### 2. Kubernetes Deployment

```yaml
# Form system deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: form-system
  labels:
    app: form-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: form-system
  template:
    metadata:
      labels:
        app: form-system
    spec:
      containers:
      - name: form-system
        image: datacollect/form-system:latest
        ports:
        - containerPort: 80
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: form-system-service
spec:
  selector:
    app: form-system
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

## Monitoring & Analytics

### 1. Performance Monitoring

```python
class FormAnalyticsCollector:
    def __init__(self, metrics_client: PrometheusClient):
        self.metrics = metrics_client
        
        # Define metrics
        self.form_submissions = Counter(
            'form_submissions_total',
            'Total form submissions',
            ['form_id', 'status']
        )
        
        self.form_render_time = Histogram(
            'form_render_duration_seconds',
            'Form render time',
            ['form_id']
        )
        
        self.validation_errors = Counter(
            'form_validation_errors_total',
            'Form validation errors',
            ['form_id', 'field_name', 'error_type']
        )
    
    async def track_form_render(self, form_id: UUID, render_time: float):
        """Track form rendering performance"""
        self.form_render_time.labels(form_id=str(form_id)).observe(render_time)
    
    async def track_form_submission(self, form_id: UUID, status: str):
        """Track form submission events"""
        self.form_submissions.labels(
            form_id=str(form_id),
            status=status
        ).inc()
    
    async def track_validation_error(self, form_id: UUID, field_name: str, error_type: str):
        """Track validation errors for analytics"""
        self.validation_errors.labels(
            form_id=str(form_id),
            field_name=field_name,
            error_type=error_type
        ).inc()
```

### 2. User Analytics

```typescript
// Client-side analytics
class FormAnalytics {
  private analytics: AnalyticsClient;
  private sessionStart: number;
  private fieldInteractions: Map<string, FieldInteraction> = new Map();
  
  constructor(formId: string, userId?: string) {
    this.analytics = new AnalyticsClient(formId, userId);
    this.sessionStart = Date.now();
  }
  
  trackFormStart() {
    this.analytics.track('form_started', {
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }
  
  trackFieldInteraction(fieldId: string, event: 'focus' | 'blur' | 'change') {
    const interaction = this.fieldInteractions.get(fieldId) || {
      fieldId,
      focusTime: 0,
      totalTime: 0,
      changes: 0,
      errors: 0
    };
    
    switch (event) {
      case 'focus':
        interaction.focusTime = Date.now();
        break;
      case 'blur':
        if (interaction.focusTime) {
          interaction.totalTime += Date.now() - interaction.focusTime;
        }
        break;
      case 'change':
        interaction.changes++;
        break;
    }
    
    this.fieldInteractions.set(fieldId, interaction);
  }
  
  trackFormSubmit(success: boolean, errors?: ValidationError[]) {
    const sessionTime = Date.now() - this.sessionStart;
    
    this.analytics.track('form_submitted', {
      success,
      session_time: sessionTime,
      field_interactions: Array.from(this.fieldInteractions.values()),
      errors: errors?.map(e => ({
        field: e.field,
        type: e.type,
        code: e.code
      }))
    });
  }
}
```

## Architecture Decision Records (ADRs)

### ADR-001: Form Schema Storage Format

**Status**: Accepted  
**Date**: 2025-01-05  
**Context**: Need to store form schemas in a way that supports versioning, validation, and efficient querying.

**Decision**: Use JSONB in PostgreSQL with separate compiled schema cache in Redis.

**Consequences**:
- ✅ Flexible schema evolution
- ✅ Efficient querying with PostgreSQL JSON operators  
- ✅ Fast rendering with cached compiled schemas
- ❌ Slightly more complex caching logic

### ADR-002: Validation Architecture

**Status**: Accepted  
**Date**: 2025-01-05  
**Context**: Need both client-side and server-side validation with custom rule support.

**Decision**: Multi-layer validation with Zod on client and custom Python validators on server.

**Consequences**:
- ✅ Type safety with TypeScript/Zod
- ✅ Flexible custom validation rules
- ✅ Security through server-side validation
- ❌ Potential duplication of validation logic

### ADR-003: File Upload Strategy

**Status**: Accepted  
**Date**: 2025-01-05  
**Context**: Form fields need to support file uploads with security and performance considerations.

**Decision**: Direct upload to S3-compatible storage with signed URLs and virus scanning.

**Consequences**:
- ✅ Scalable file storage
- ✅ Reduced server load
- ✅ Enhanced security
- ❌ Additional infrastructure complexity

### ADR-004: Real-time Features

**Status**: Proposed  
**Date**: 2025-01-05  
**Context**: Consider WebSockets for real-time form collaboration and live updates.

**Decision**: Implement WebSockets for form builder collaboration, polling for form responses.

**Consequences**:
- ✅ Real-time collaboration experience
- ✅ Reduced server load for responses
- ❌ Additional connection management complexity

## Summary

This comprehensive architecture for the Phase 3 Form System provides:

1. **Scalable Architecture**: Microservices-ready with clear separation of concerns
2. **Modern Tech Stack**: React + TanStack Form + FastAPI + PostgreSQL
3. **Security First**: Multi-layer validation, CSRF protection, input sanitization
4. **Performance Optimized**: Caching, virtualization, efficient database queries
5. **Accessibility Compliant**: WCAG 2.1 AA standards with internationalization
6. **Developer Friendly**: Type-safe APIs, comprehensive error handling, extensive documentation
7. **Operations Ready**: Docker containers, Kubernetes manifests, monitoring integration

The architecture supports the full form lifecycle from creation to submission while maintaining flexibility for future enhancements and integrations.