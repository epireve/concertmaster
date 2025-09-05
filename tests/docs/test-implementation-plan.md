# ConcertMaster Testing Implementation Plan

## Phase 1: Testing Infrastructure Setup (Week 1)

### Testing Framework Installation & Configuration

**Backend Testing Setup (FastAPI + pytest)**:
```bash
# Install testing dependencies
pip install pytest pytest-cov pytest-asyncio pytest-mock factory-boy httpx

# pytest.ini configuration
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    --cov=backend
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=90
    --strict-markers
    --disable-warnings
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow running tests
    security: Security tests
```

**Frontend Testing Setup (React + Jest)**:
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install --save-dev jest-environment-jsdom @playwright/test
npm install --save-dev msw  # Mock Service Worker for API mocking

# jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

### Test Database Setup
```python
# conftest.py - Shared test configuration
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.main import app

TEST_DATABASE_URL = "postgresql://test:test@localhost/testdb"

@pytest.fixture(scope="session")
def engine():
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture(scope="function")
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as client:
        yield client
```

## Phase 2: Unit Testing Implementation (Week 2-3)

### Backend Unit Tests

**Workflow Engine Tests**:
```python
# tests/unit/workflow_engine/test_workflow_engine.py
import pytest
from unittest.mock import Mock, AsyncMock
from backend.workflow_engine import WorkflowEngine, WorkflowExecutionError

class TestWorkflowEngine:
    @pytest.fixture
    def workflow_engine(self):
        return WorkflowEngine()
    
    @pytest.fixture
    def sample_workflow(self):
        return {
            "id": "test-workflow",
            "nodes": [
                {"id": "trigger_1", "type": "ScheduleTrigger", "config": {"cron": "0 9 * * 1"}},
                {"id": "form_1", "type": "SendForm", "config": {"form_id": "supplier_form"}},
                {"id": "validate_1", "type": "DataValidator", "config": {"rules": ["required_fields"]}}
            ],
            "edges": [
                {"from": "trigger_1", "to": "form_1"},
                {"from": "form_1", "to": "validate_1"}
            ]
        }
    
    def test_create_workflow_success(self, workflow_engine, sample_workflow, db_session):
        """Test successful workflow creation"""
        # Act
        result = workflow_engine.create_workflow(sample_workflow)
        
        # Assert
        assert result.id == "test-workflow"
        assert len(result.nodes) == 3
        assert result.status == "active"
    
    def test_create_workflow_invalid_dag(self, workflow_engine):
        """Test workflow creation with circular dependency"""
        invalid_workflow = {
            "nodes": [{"id": "a", "type": "Test"}, {"id": "b", "type": "Test"}],
            "edges": [{"from": "a", "to": "b"}, {"from": "b", "to": "a"}]
        }
        
        with pytest.raises(WorkflowExecutionError, match="Circular dependency"):
            workflow_engine.create_workflow(invalid_workflow)
    
    @pytest.mark.asyncio
    async def test_execute_workflow_success(self, workflow_engine, sample_workflow, db_session):
        """Test successful workflow execution"""
        # Arrange
        workflow = workflow_engine.create_workflow(sample_workflow)
        trigger_data = {"timestamp": "2025-01-01T09:00:00Z"}
        
        # Mock node executors
        workflow_engine.node_executor.execute_node = AsyncMock(
            return_value={"status": "success", "data": {"processed": True}}
        )
        
        # Act
        result = await workflow_engine.execute_workflow(workflow.id, trigger_data)
        
        # Assert
        assert result.status == "completed"
        assert workflow_engine.node_executor.execute_node.call_count == 3
    
    def test_workflow_validation_missing_nodes(self, workflow_engine):
        """Test workflow validation with missing node references"""
        invalid_workflow = {
            "nodes": [{"id": "node1", "type": "Test"}],
            "edges": [{"from": "node1", "to": "missing_node"}]
        }
        
        with pytest.raises(WorkflowExecutionError, match="Node 'missing_node' not found"):
            workflow_engine.create_workflow(invalid_workflow)
```

**Node Executor Tests**:
```python
# tests/unit/nodes/test_trigger_nodes.py
import pytest
from unittest.mock import Mock, patch
from datetime import datetime
from backend.nodes.trigger_nodes import ScheduleTrigger, FormTrigger, WebhookTrigger

class TestScheduleTrigger:
    def test_cron_expression_validation(self):
        """Test cron expression validation"""
        # Valid cron expressions
        valid_configs = [
            {"cron": "0 9 * * 1"},  # Every Monday 9 AM
            {"cron": "*/15 * * * *"},  # Every 15 minutes
            {"cron": "0 0 1 * *"}  # First day of month
        ]
        
        for config in valid_configs:
            trigger = ScheduleTrigger(config)
            assert trigger.is_valid_cron(config["cron"])
    
    def test_invalid_cron_expression(self):
        """Test invalid cron expression handling"""
        invalid_config = {"cron": "invalid cron"}
        
        with pytest.raises(ValueError, match="Invalid cron expression"):
            ScheduleTrigger(invalid_config)
    
    @patch('backend.nodes.trigger_nodes.datetime')
    def test_should_trigger_true(self, mock_datetime):
        """Test trigger activation when time matches"""
        # Arrange
        mock_datetime.now.return_value = datetime(2025, 1, 6, 9, 0)  # Monday 9 AM
        trigger = ScheduleTrigger({"cron": "0 9 * * 1"})
        
        # Act & Assert
        assert trigger.should_trigger() is True
    
    def test_should_trigger_false(self, mock_datetime):
        """Test trigger not activated when time doesn't match"""
        # Arrange
        mock_datetime.now.return_value = datetime(2025, 1, 6, 10, 0)  # Monday 10 AM
        trigger = ScheduleTrigger({"cron": "0 9 * * 1"})
        
        # Act & Assert
        assert trigger.should_trigger() is False

class TestFormTrigger:
    def test_form_trigger_configuration(self):
        """Test form trigger configuration"""
        config = {
            "form_id": "supplier_form",
            "validation_rules": ["required_fields", "data_types"]
        }
        
        trigger = FormTrigger(config)
        assert trigger.form_id == "supplier_form"
        assert len(trigger.validation_rules) == 2
    
    @pytest.mark.asyncio
    async def test_form_submission_trigger(self):
        """Test form submission triggers workflow"""
        config = {"form_id": "test_form"}
        trigger = FormTrigger(config)
        
        form_data = {
            "form_id": "test_form",
            "data": {"field1": "value1", "field2": "value2"}
        }
        
        result = await trigger.execute(form_data)
        
        assert result["trigger_type"] == "form_submission"
        assert result["form_id"] == "test_form"
        assert "data" in result
```

### Frontend Unit Tests

**Workflow Canvas Tests**:
```typescript
// tests/unit/components/WorkflowCanvas.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowCanvas } from '@/components/WorkflowCanvas';
import { Workflow } from '@/types/workflow';

const mockWorkflow: Workflow = {
  id: 'test-workflow',
  name: 'Test Workflow',
  nodes: [
    {
      id: 'node-1',
      type: 'ScheduleTrigger',
      position: { x: 100, y: 100 },
      data: { cron: '0 9 * * 1' }
    }
  ],
  edges: []
};

describe('WorkflowCanvas', () => {
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
  });

  test('renders workflow canvas with nodes', () => {
    render(<WorkflowCanvas workflow={mockWorkflow} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument();
  });

  test('adds new node when dragged from palette', async () => {
    render(<WorkflowCanvas workflow={mockWorkflow} onUpdate={mockOnUpdate} />);
    
    const nodeButton = screen.getByTestId('node-SendForm');
    const canvas = screen.getByTestId('workflow-canvas');
    
    // Simulate drag and drop
    fireEvent.dragStart(nodeButton);
    fireEvent.drop(canvas, {
      dataTransfer: {
        getData: () => JSON.stringify({ type: 'SendForm' })
      }
    });
    
    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ type: 'SendForm' })
          ])
        })
      );
    });
  });

  test('connects nodes when edge is created', async () => {
    const workflowWithTwoNodes = {
      ...mockWorkflow,
      nodes: [
        ...mockWorkflow.nodes,
        {
          id: 'node-2',
          type: 'SendForm',
          position: { x: 300, y: 100 },
          data: { form_id: 'test-form' }
        }
      ]
    };

    render(<WorkflowCanvas workflow={workflowWithTwoNodes} onUpdate={mockOnUpdate} />);
    
    // Simulate connecting nodes (this would be more complex in real implementation)
    const sourceHandle = screen.getByTestId('node-1-source');
    const targetHandle = screen.getByTestId('node-2-target');
    
    fireEvent.mouseDown(sourceHandle);
    fireEvent.mouseUp(targetHandle);
    
    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          edges: expect.arrayContaining([
            expect.objectContaining({
              source: 'node-1',
              target: 'node-2'
            })
          ])
        })
      );
    });
  });

  test('validates workflow before saving', async () => {
    const invalidWorkflow = {
      ...mockWorkflow,
      nodes: [
        { id: 'node-1', type: 'ScheduleTrigger', position: { x: 100, y: 100 }, data: {} }
      ]
    };

    render(<WorkflowCanvas workflow={invalidWorkflow} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByTestId('save-workflow');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/validation error/i)).toBeInTheDocument();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });
});
```

**Form Builder Tests**:
```typescript
// tests/unit/components/FormBuilder.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormBuilder } from '@/components/FormBuilder';

describe('FormBuilder', () => {
  test('starts with empty form', () => {
    render(<FormBuilder />);
    
    expect(screen.getByTestId('form-canvas')).toBeEmptyDOMElement();
    expect(screen.getByText('Add your first field')).toBeInTheDocument();
  });

  test('adds text field when text button clicked', async () => {
    const user = userEvent.setup();
    render(<FormBuilder />);
    
    await user.click(screen.getByTestId('add-text-field'));
    
    expect(screen.getByTestId('field-editor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('New text field')).toBeInTheDocument();
  });

  test('configures field properties', async () => {
    const user = userEvent.setup();
    render(<FormBuilder />);
    
    // Add field
    await user.click(screen.getByTestId('add-text-field'));
    
    // Configure field
    const labelInput = screen.getByLabelText('Field Label');
    await user.clear(labelInput);
    await user.type(labelInput, 'Company Name');
    
    const requiredCheckbox = screen.getByLabelText('Required');
    await user.click(requiredCheckbox);
    
    // Verify changes
    expect(screen.getByDisplayValue('Company Name')).toBeInTheDocument();
    expect(requiredCheckbox).toBeChecked();
  });

  test('preview updates when fields change', async () => {
    const user = userEvent.setup();
    render(<FormBuilder />);
    
    await user.click(screen.getByTestId('add-text-field'));
    
    const labelInput = screen.getByLabelText('Field Label');
    await user.clear(labelInput);
    await user.type(labelInput, 'Email Address');
    
    // Check preview updates
    const preview = screen.getByTestId('form-preview');
    expect(preview).toHaveTextContent('Email Address');
  });

  test('validates form schema before save', async () => {
    const user = userEvent.setup();
    render(<FormBuilder />);
    
    // Try to save empty form
    await user.click(screen.getByTestId('save-form'));
    
    expect(screen.getByText(/at least one field required/i)).toBeInTheDocument();
  });

  test('generates correct form schema', async () => {
    const mockOnSave = jest.fn();
    const user = userEvent.setup();
    
    render(<FormBuilder onSave={mockOnSave} />);
    
    // Add fields
    await user.click(screen.getByTestId('add-text-field'));
    await user.clear(screen.getByLabelText('Field Label'));
    await user.type(screen.getByLabelText('Field Label'), 'Company Name');
    
    await user.click(screen.getByTestId('add-number-field'));
    await user.clear(screen.getByLabelText('Field Label'));
    await user.type(screen.getByLabelText('Field Label'), 'Employee Count');
    
    // Save form
    await user.click(screen.getByTestId('save-form'));
    
    expect(mockOnSave).toHaveBeenCalledWith({
      fields: [
        {
          id: expect.any(String),
          type: 'text',
          label: 'Company Name',
          required: false
        },
        {
          id: expect.any(String),
          type: 'number',
          label: 'Employee Count',
          required: false
        }
      ]
    });
  });
});
```

## Phase 3: Integration Testing Implementation (Week 4)

### API Integration Tests

**Workflow API Tests**:
```python
# tests/integration/api/test_workflow_endpoints.py
import pytest
from fastapi.testclient import TestClient
from backend.main import app

class TestWorkflowAPI:
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_create_workflow(self, client, db_session):
        """Test workflow creation via API"""
        workflow_data = {
            "name": "Test Workflow",
            "description": "A test workflow",
            "nodes": [
                {"id": "trigger_1", "type": "ScheduleTrigger", "config": {"cron": "0 9 * * 1"}},
                {"id": "form_1", "type": "SendForm", "config": {"form_id": "test_form"}}
            ],
            "edges": [{"from": "trigger_1", "to": "form_1"}]
        }
        
        response = client.post("/api/workflows", json=workflow_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Workflow"
        assert len(data["nodes"]) == 2
        assert data["id"] is not None
    
    def test_get_workflow(self, client, db_session):
        """Test workflow retrieval"""
        # Create workflow first
        create_response = client.post("/api/workflows", json={
            "name": "Test Workflow",
            "nodes": [],
            "edges": []
        })
        workflow_id = create_response.json()["id"]
        
        # Retrieve workflow
        response = client.get(f"/api/workflows/{workflow_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == workflow_id
        assert data["name"] == "Test Workflow"
    
    def test_execute_workflow(self, client, db_session, mock_celery_task):
        """Test workflow execution"""
        # Create workflow
        workflow_data = {
            "name": "Test Workflow",
            "nodes": [{"id": "trigger_1", "type": "ScheduleTrigger", "config": {"cron": "0 9 * * 1"}}],
            "edges": []
        }
        create_response = client.post("/api/workflows", json=workflow_data)
        workflow_id = create_response.json()["id"]
        
        # Execute workflow
        trigger_data = {"timestamp": "2025-01-01T09:00:00Z"}
        response = client.post(f"/api/workflows/{workflow_id}/run", json=trigger_data)
        
        assert response.status_code == 202  # Accepted for async processing
        data = response.json()
        assert data["workflow_run_id"] is not None
        assert data["status"] == "queued"
        
        # Verify task was queued
        mock_celery_task.delay.assert_called_once_with(workflow_id, trigger_data)
    
    def test_list_workflows(self, client, db_session):
        """Test workflow listing with pagination"""
        # Create multiple workflows
        for i in range(15):
            client.post("/api/workflows", json={
                "name": f"Workflow {i}",
                "nodes": [],
                "edges": []
            })
        
        # Test pagination
        response = client.get("/api/workflows?page=1&size=10")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] == 15
        assert data["page"] == 1
        assert data["pages"] == 2
    
    def test_workflow_validation_errors(self, client):
        """Test workflow validation error handling"""
        invalid_workflow = {
            "name": "",  # Empty name
            "nodes": [{"id": "invalid", "type": "NonExistentType"}],  # Invalid node type
            "edges": [{"from": "missing", "to": "also_missing"}]  # Missing nodes
        }
        
        response = client.post("/api/workflows", json=invalid_workflow)
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("name" in str(error) for error in errors)
        assert any("NonExistentType" in str(error) for error in errors)
```

### Database Integration Tests

**Workflow Persistence Tests**:
```python
# tests/integration/database/test_workflow_persistence.py
import pytest
from sqlalchemy.exc import IntegrityError
from backend.models.workflow import Workflow, WorkflowRun, NodeExecution
from backend.database import SessionLocal

class TestWorkflowPersistence:
    def test_workflow_creation_with_relationships(self, db_session):
        """Test workflow creation with proper relationships"""
        workflow = Workflow(
            name="Test Workflow",
            definition={
                "nodes": [{"id": "node1", "type": "Test"}],
                "edges": []
            }
        )
        
        db_session.add(workflow)
        db_session.commit()
        
        assert workflow.id is not None
        assert workflow.created_at is not None
        assert workflow.updated_at is not None
    
    def test_workflow_run_tracking(self, db_session):
        """Test workflow run creation and tracking"""
        # Create workflow
        workflow = Workflow(name="Test Workflow", definition={"nodes": [], "edges": []})
        db_session.add(workflow)
        db_session.commit()
        
        # Create workflow run
        run = WorkflowRun(
            workflow_id=workflow.id,
            status="running",
            trigger_data={"test": True}
        )
        db_session.add(run)
        db_session.commit()
        
        assert run.id is not None
        assert run.status == "running"
        assert run.trigger_data["test"] is True
        assert run.workflow_id == workflow.id
    
    def test_node_execution_tracking(self, db_session):
        """Test individual node execution tracking"""
        # Create workflow and run
        workflow = Workflow(name="Test", definition={})
        run = WorkflowRun(workflow_id=workflow.id, status="running")
        
        db_session.add_all([workflow, run])
        db_session.commit()
        
        # Create node execution
        execution = NodeExecution(
            workflow_run_id=run.id,
            node_id="test_node",
            status="completed",
            input_data={"input": "test"},
            output_data={"output": "result"}
        )
        db_session.add(execution)
        db_session.commit()
        
        assert execution.id is not None
        assert execution.status == "completed"
        assert execution.input_data["input"] == "test"
        assert execution.output_data["output"] == "result"
    
    def test_concurrent_workflow_execution(self, db_session):
        """Test concurrent workflow execution handling"""
        workflow = Workflow(name="Concurrent Test", definition={})
        db_session.add(workflow)
        db_session.commit()
        
        # Create multiple concurrent runs
        runs = []
        for i in range(10):
            run = WorkflowRun(
                workflow_id=workflow.id,
                status="running",
                trigger_data={"batch": i}
            )
            runs.append(run)
        
        db_session.add_all(runs)
        db_session.commit()
        
        # Verify all runs created successfully
        assert len(runs) == 10
        for i, run in enumerate(runs):
            assert run.trigger_data["batch"] == i
    
    def test_workflow_deletion_cascade(self, db_session):
        """Test proper cascade deletion of workflow relationships"""
        # Create workflow with runs and executions
        workflow = Workflow(name="Delete Test", definition={})
        run = WorkflowRun(workflow_id=workflow.id, status="completed")
        execution = NodeExecution(
            workflow_run_id=run.id,
            node_id="test",
            status="completed"
        )
        
        db_session.add_all([workflow, run, execution])
        db_session.commit()
        
        workflow_id = workflow.id
        run_id = run.id
        execution_id = execution.id
        
        # Delete workflow
        db_session.delete(workflow)
        db_session.commit()
        
        # Verify cascade deletion
        assert db_session.query(Workflow).filter_by(id=workflow_id).first() is None
        assert db_session.query(WorkflowRun).filter_by(id=run_id).first() is None
        assert db_session.query(NodeExecution).filter_by(id=execution_id).first() is None
```

## Phase 4: E2E Testing Implementation (Week 5)

### Playwright E2E Tests

**Critical User Journey Tests**:
```typescript
// tests/e2e/workflow-creation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Workflow Creation Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('Business user creates complete data collection workflow', async ({ page }) => {
    // Navigate to workflow builder
    await page.click('[data-testid="create-workflow"]');
    await expect(page).toHaveURL('/workflows/new');
    
    // Set workflow name
    await page.fill('[data-testid="workflow-name"]', 'Supplier Data Collection');
    
    // Add schedule trigger
    await page.dragAndDrop(
      '[data-testid="node-ScheduleTrigger"]',
      '[data-testid="workflow-canvas"]'
    );
    
    // Configure schedule trigger
    await page.click('[data-node-id="schedule-trigger-1"]');
    await page.fill('[data-testid="cron-expression"]', '0 9 1 * *'); // Monthly on 1st at 9 AM
    await page.click('[data-testid="save-node-config"]');
    
    // Add send form node
    await page.dragAndDrop(
      '[data-testid="node-SendForm"]',
      '[data-testid="workflow-canvas"]',
      { targetPosition: { x: 300, y: 100 } }
    );
    
    // Configure form node
    await page.click('[data-node-id="send-form-1"]');
    await page.selectOption('[data-testid="form-select"]', 'supplier_carbon_form');
    await page.fill('[data-testid="recipient-list"]', 'suppliers@company.com');
    await page.click('[data-testid="save-node-config"]');
    
    // Connect nodes
    await page.hover('[data-node-id="schedule-trigger-1"] [data-handle-type="source"]');
    await page.mouse.down();
    await page.hover('[data-node-id="send-form-1"] [data-handle-type="target"]');
    await page.mouse.up();
    
    // Verify connection created
    await expect(page.locator('[data-testid="workflow-edge"]')).toHaveCount(1);
    
    // Add validation node
    await page.dragAndDrop(
      '[data-testid="node-DataValidator"]',
      '[data-testid="workflow-canvas"]',
      { targetPosition: { x: 600, y: 100 } }
    );
    
    // Configure validation
    await page.click('[data-node-id="data-validator-1"]');
    await page.check('[data-testid="required-fields-validation"]');
    await page.check('[data-testid="outlier-detection"]');
    await page.click('[data-testid="save-node-config"]');
    
    // Connect form to validator
    await page.hover('[data-node-id="send-form-1"] [data-handle-type="source"]');
    await page.mouse.down();
    await page.hover('[data-node-id="data-validator-1"] [data-handle-type="target"]');
    await page.mouse.up();
    
    // Add ERP export
    await page.dragAndDrop(
      '[data-testid="node-ERPExport"]',
      '[data-testid="workflow-canvas"]',
      { targetPosition: { x: 900, y: 100 } }
    );
    
    // Configure ERP export
    await page.click('[data-node-id="erp-export-1"]');
    await page.selectOption('[data-testid="erp-system"]', 'SAP');
    await page.fill('[data-testid="connection-string"]', 'sap://production.company.com');
    await page.selectOption('[data-testid="mapping-template"]', 'carbon_to_sap_v2');
    await page.click('[data-testid="save-node-config"]');
    
    // Connect validator to ERP
    await page.hover('[data-node-id="data-validator-1"] [data-handle-type="source"]');
    await page.mouse.down();
    await page.hover('[data-node-id="erp-export-1"] [data-handle-type="target"]');
    await page.mouse.up();
    
    // Validate workflow
    await page.click('[data-testid="validate-workflow"]');
    await expect(page.locator('[data-testid="validation-success"]')).toBeVisible();
    
    // Save workflow
    await page.click('[data-testid="save-workflow"]');
    await expect(page.locator('[data-testid="save-success-message"]')).toBeVisible();
    
    // Verify workflow appears in list
    await page.goto('/workflows');
    await expect(page.locator('[data-testid="workflow-list-item"]')).toContainText('Supplier Data Collection');
    
    // Test workflow execution
    await page.click('[data-testid="execute-workflow"]');
    await expect(page.locator('[data-testid="execution-started"]')).toBeVisible();
    
    // Verify execution status updates
    await expect(page.locator('[data-testid="execution-status"]')).toHaveText('Running', { timeout: 5000 });
  });

  test('Form recipient completes data submission', async ({ page }) => {
    // Simulate form recipient receiving email link
    await page.goto('/forms/supplier_carbon_form?token=test_token_123');
    
    // Verify form loads correctly
    await expect(page.locator('h1')).toContainText('Carbon Footprint Data Collection');
    await expect(page.locator('[data-testid="form-description"]')).toBeVisible();
    
    // Fill form fields
    await page.fill('[data-field="company_name"]', 'ACME Suppliers Inc');
    await page.fill('[data-field="contact_email"]', 'sustainability@acme.com');
    await page.selectOption('[data-field="industry"]', 'manufacturing');
    await page.fill('[data-field="total_emissions"]', '15000');
    await page.selectOption('[data-field="verification_method"]', 'third_party');
    
    // Upload supporting document
    await page.setInputFiles('[data-field="emissions_report"]', 'tests/fixtures/emissions_report.pdf');
    
    // Add additional data points
    await page.click('[data-testid="add-facility"]');
    await page.fill('[data-field="facility_1_name"]', 'Manufacturing Plant A');
    await page.fill('[data-field="facility_1_emissions"]', '8500');
    
    // Review data before submission
    await page.click('[data-testid="review-data"]');
    await expect(page.locator('[data-testid="review-summary"]')).toContainText('ACME Suppliers Inc');
    await expect(page.locator('[data-testid="review-summary"]')).toContainText('15000');
    
    // Submit form
    await page.click('[data-testid="submit-form"]');
    
    // Verify submission success
    await expect(page.locator('[data-testid="submission-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirmation-number"]')).toBeVisible();
    
    // Verify data validation occurs
    await page.waitForSelector('[data-testid="validation-status"]');
    await expect(page.locator('[data-testid="validation-status"]')).toHaveText('Validated');
  });

  test('Admin monitors workflow performance', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin/dashboard');
    
    // Verify dashboard loads
    await expect(page.locator('h1')).toContainText('System Dashboard');
    
    // Check system health metrics
    await expect(page.locator('[data-testid="system-health"]')).toHaveText('Healthy');
    await expect(page.locator('[data-testid="active-workflows"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-responses"]')).toBeVisible();
    
    // View workflow execution details
    await page.click('[data-testid="workflow-executions-tab"]');
    await expect(page.locator('[data-testid="execution-list"]')).toBeVisible();
    
    // Check performance metrics
    const avgResponseTime = await page.textContent('[data-testid="avg-response-time"]');
    expect(parseFloat(avgResponseTime.replace('ms', ''))).toBeLessThan(100);
    
    // Verify error rate
    const errorRate = await page.textContent('[data-testid="error-rate"]');
    expect(parseFloat(errorRate.replace('%', ''))).toBeLessThan(1);
    
    // Check resource utilization
    await page.click('[data-testid="resources-tab"]');
    const cpuUsage = await page.textContent('[data-testid="cpu-usage"]');
    expect(parseFloat(cpuUsage.replace('%', ''))).toBeLessThan(80);
    
    const memoryUsage = await page.textContent('[data-testid="memory-usage"]');
    expect(parseFloat(memoryUsage.replace('%', ''))).toBeLessThan(85);
  });
});
```

## Phase 5: Performance & Security Testing (Week 6)

### Performance Test Implementation

**Load Testing with Artillery**:
```yaml
# tests/performance/workflow-load-test.yml
config:
  target: 'http://localhost:8000'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 300
      arrivalRate: 20
      name: "Normal load"
    - duration: 120
      arrivalRate: 50
      name: "High load"
    - duration: 60
      arrivalRate: 100
      name: "Stress test"
  payload:
    path: "test-data.csv"
    fields:
      - "workflow_id"
      - "form_data"

scenarios:
  - name: "Workflow execution performance"
    weight: 60
    flow:
      - post:
          url: "/api/workflows/{{ workflow_id }}/run"
          headers:
            Authorization: "Bearer {{ $processEnvironment.TEST_TOKEN }}"
          json:
            trigger_data: "{{ form_data }}"
          capture:
            - json: "$.workflow_run_id"
              as: "run_id"
      - think: 2
      - get:
          url: "/api/workflow-runs/{{ run_id }}/status"
          headers:
            Authorization: "Bearer {{ $processEnvironment.TEST_TOKEN }}"
          expect:
            - statusCode: 200

  - name: "Form submission performance"
    weight: 40
    flow:
      - post:
          url: "/api/forms/supplier_form/submit"
          json:
            data: "{{ form_data }}"
            metadata:
              source: "load_test"
          expect:
            - statusCode: 201
            - contentType: json

  - name: "Dashboard queries performance"
    weight: 20
    flow:
      - get:
          url: "/api/dashboard/metrics"
          headers:
            Authorization: "Bearer {{ $processEnvironment.TEST_TOKEN }}"
          expect:
            - statusCode: 200
            - hasProperty: "active_workflows"
            - hasProperty: "total_responses"
```

### Security Test Implementation

**Security Testing with pytest**:
```python
# tests/security/test_api_security.py
import pytest
import jwt
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.main import app

class TestAPISecurity:
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_unauthorized_access_blocked(self, client):
        """Test that unauthorized requests are blocked"""
        response = client.get("/api/workflows")
        assert response.status_code == 401
        
        response = client.post("/api/workflows", json={"name": "test"})
        assert response.status_code == 401
    
    def test_expired_token_rejected(self, client):
        """Test that expired JWT tokens are rejected"""
        # Create expired token
        expired_token = jwt.encode(
            {"sub": "test@example.com", "exp": datetime.utcnow() - timedelta(hours=1)},
            "test_secret",
            algorithm="HS256"
        )
        
        response = client.get(
            "/api/workflows",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401
    
    def test_sql_injection_prevention(self, client, auth_headers):
        """Test SQL injection prevention"""
        malicious_payloads = [
            "'; DROP TABLE workflows; --",
            "' OR '1'='1",
            "'; DELETE FROM users WHERE '1'='1'; --",
            "' UNION SELECT * FROM users --"
        ]
        
        for payload in malicious_payloads:
            response = client.get(
                f"/api/workflows?name={payload}",
                headers=auth_headers
            )
            # Should be sanitized or rejected, not cause server error
            assert response.status_code in [200, 400, 422]
            
            # Verify no data corruption
            response = client.get("/api/workflows", headers=auth_headers)
            assert response.status_code == 200  # Service still functional
    
    def test_xss_prevention(self, client, auth_headers):
        """Test XSS prevention in form submissions"""
        xss_payloads = [
            '<script>alert("XSS")</script>',
            '<img src="x" onerror="alert(1)">',
            'javascript:alert(document.cookie)',
            '<svg onload="alert(1)">'
        ]
        
        for payload in xss_payloads:
            response = client.post(
                "/api/forms/test_form/submit",
                json={
                    "data": {
                        "company_name": payload,
                        "description": f"Company description with {payload}"
                    }
                },
                headers=auth_headers
            )
            
            assert response.status_code in [201, 400, 422]
            
            # Verify stored data is sanitized
            if response.status_code == 201:
                response_id = response.json()["id"]
                get_response = client.get(f"/api/responses/{response_id}", headers=auth_headers)
                data = get_response.json()["data"]
                
                # Check that dangerous scripts are removed/escaped
                assert "<script>" not in str(data)
                assert "javascript:" not in str(data)
                assert "onerror=" not in str(data)
    
    def test_file_upload_security(self, client, auth_headers):
        """Test file upload security"""
        # Test malicious file types
        malicious_files = [
            ("malicious.exe", b"MZ\x90\x00", "application/x-executable"),
            ("script.js", b"alert('XSS')", "application/javascript"),
            ("shell.php", b"<?php system($_GET['cmd']); ?>", "application/x-php")
        ]
        
        for filename, content, content_type in malicious_files:
            response = client.post(
                "/api/forms/test_form/upload",
                files={"file": (filename, content, content_type)},
                headers=auth_headers
            )
            
            # Should reject dangerous file types
            assert response.status_code in [400, 422, 415]
    
    def test_rate_limiting(self, client, auth_headers):
        """Test rate limiting protection"""
        # Make rapid requests to trigger rate limiting
        responses = []
        for i in range(100):
            response = client.get("/api/workflows", headers=auth_headers)
            responses.append(response.status_code)
            
            if response.status_code == 429:  # Too Many Requests
                break
        
        # Verify rate limiting kicks in
        assert 429 in responses, "Rate limiting should have been triggered"
    
    def test_rbac_enforcement(self, client):
        """Test role-based access control"""
        # Create tokens for different roles
        admin_token = create_test_token("admin@test.com", ["admin", "user"])
        user_token = create_test_token("user@test.com", ["user"])
        readonly_token = create_test_token("readonly@test.com", ["readonly"])
        
        # Test admin-only endpoints
        admin_response = client.get(
            "/api/admin/system-health",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_response.status_code == 200
        
        user_response = client.get(
            "/api/admin/system-health",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert user_response.status_code == 403
        
        # Test write permissions
        workflow_data = {"name": "Test", "nodes": [], "edges": []}
        
        user_write = client.post(
            "/api/workflows",
            json=workflow_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert user_write.status_code == 201
        
        readonly_write = client.post(
            "/api/workflows",
            json=workflow_data,
            headers={"Authorization": f"Bearer {readonly_token}"}
        )
        assert readonly_write.status_code == 403
    
    def test_data_encryption_at_rest(self, client, auth_headers, db_session):
        """Test that sensitive data is encrypted in database"""
        # Submit form with sensitive data
        sensitive_data = {
            "ssn": "123-45-6789",
            "credit_card": "4111-1111-1111-1111",
            "password": "supersecret123"
        }
        
        response = client.post(
            "/api/forms/sensitive_form/submit",
            json={"data": sensitive_data},
            headers=auth_headers
        )
        assert response.status_code == 201
        
        # Check database directly - sensitive fields should be encrypted
        from backend.models.form_response import FormResponse
        db_response = db_session.query(FormResponse).filter_by(
            id=response.json()["id"]
        ).first()
        
        # Sensitive data should not be stored in plain text
        raw_data = str(db_response.data)
        assert "123-45-6789" not in raw_data
        assert "4111-1111-1111-1111" not in raw_data
        assert "supersecret123" not in raw_data

def create_test_token(email: str, roles: list) -> str:
    """Helper to create test JWT tokens"""
    return jwt.encode(
        {
            "sub": email,
            "roles": roles,
            "exp": datetime.utcnow() + timedelta(hours=1)
        },
        "test_secret",
        algorithm="HS256"
    )
```

## Testing Metrics & Monitoring

### Coverage Requirements
- **Unit Tests**: ≥90% statement coverage, ≥85% branch coverage
- **Integration Tests**: 100% API endpoint coverage, all database operations
- **E2E Tests**: 100% critical user journeys, 95% feature coverage
- **Performance Tests**: All high-traffic endpoints, concurrent scenarios
- **Security Tests**: All input validation, authentication/authorization

### Quality Gates
1. All tests must pass before merge
2. Coverage thresholds must be met
3. No high/critical security vulnerabilities
4. Performance benchmarks within acceptable ranges
5. E2E tests pass on all supported browsers

### Continuous Monitoring
- Real-time test execution dashboards
- Performance regression detection
- Security vulnerability alerts
- Flaky test identification and resolution
- Test execution time optimization

This comprehensive testing implementation plan ensures the ConcertMaster platform maintains the highest quality standards while enabling rapid development and deployment cycles.