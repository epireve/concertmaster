-- ConcertMaster Database Schema
-- PostgreSQL schema for workflow orchestration platform

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS concertmaster;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
SET search_path TO concertmaster, public;

-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Organizations and Teams
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    settings JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    permissions JSONB DEFAULT '[]'::JSONB,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- Workflows
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    definition JSONB NOT NULL, -- React Flow nodes and edges
    settings JSONB DEFAULT '{}'::JSONB,
    tags TEXT[] DEFAULT '{}',
    is_template BOOLEAN DEFAULT FALSE,
    execution_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_execution_time INTEGER DEFAULT 0, -- milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT workflow_name_org_unique UNIQUE(name, organization_id, version)
);

-- Workflow Nodes (for type definitions and plugin system)
CREATE TABLE workflow_node_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- trigger, transform, action, condition
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    color VARCHAR(7), -- hex color
    schema JSONB NOT NULL, -- JSON schema for node configuration
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    plugin_id UUID, -- reference to plugin system
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Forms and Form Builder
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    schema JSONB NOT NULL, -- form schema with fields, validation, etc.
    settings JSONB DEFAULT '{}'::JSONB, -- styling, behavior settings
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
    is_public BOOLEAN DEFAULT FALSE,
    submission_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE
);

-- Form Submissions
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB, -- IP, user agent, etc.
    status VARCHAR(20) DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed')),
    submitted_by UUID REFERENCES users(id),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Workflow Executions
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50) NOT NULL, -- manual, form_submission, webhook, schedule
    trigger_data JSONB DEFAULT '{}'::JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time INTEGER, -- milliseconds
    error_message TEXT,
    context JSONB DEFAULT '{}'::JSONB, -- execution context and variables
    triggered_by UUID REFERENCES users(id),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10)
);

-- Node Executions (individual node runs within workflow execution)
CREATE TABLE node_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL, -- node ID from workflow definition
    node_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    input_data JSONB DEFAULT '{}'::JSONB,
    output_data JSONB DEFAULT '{}'::JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time INTEGER, -- milliseconds
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Integrations and Connections
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- webhook, email, database, api, etc.
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    configuration JSONB NOT NULL, -- encrypted configuration
    credentials JSONB DEFAULT '{}'::JSONB, -- encrypted credentials
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url_path VARCHAR(255) NOT NULL UNIQUE, -- unique webhook URL path
    secret_key VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    request_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Trail
CREATE TABLE audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Performance tracking
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- workflow, form, integration
    entity_id UUID NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    unit VARCHAR(20),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Indexes for performance
CREATE INDEX idx_workflows_org_status ON workflows(organization_id, status);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflows_tags ON workflows USING GIN(tags);
CREATE INDEX idx_workflow_executions_workflow_status ON workflow_executions(workflow_id, status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at DESC);
CREATE INDEX idx_node_executions_workflow_execution ON node_executions(workflow_execution_id);
CREATE INDEX idx_form_submissions_form_status ON form_submissions(form_id, status);
CREATE INDEX idx_form_submissions_submitted_at ON form_submissions(submitted_at DESC);
CREATE INDEX idx_integrations_org_type ON integrations(organization_id, type);
CREATE INDEX idx_audit_log_table_record ON audit.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_at ON audit.audit_log(changed_at DESC);
CREATE INDEX idx_performance_metrics_entity ON performance_metrics(entity_type, entity_id, recorded_at DESC);

-- Full text search indexes
CREATE INDEX idx_workflows_search ON workflows USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_forms_search ON forms USING GIN(to_tsvector('english', name || ' ' || title || ' ' || COALESCE(description, '')));

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log(table_name, record_id, action, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log(table_name, record_id, action, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log(table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for main tables
CREATE TRIGGER audit_workflows AFTER INSERT OR UPDATE OR DELETE ON workflows
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_function();
CREATE TRIGGER audit_forms AFTER INSERT OR UPDATE OR DELETE ON forms
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_function();
CREATE TRIGGER audit_integrations AFTER INSERT OR UPDATE OR DELETE ON integrations
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_function();