# ConcertMaster Backend Testing Framework

Comprehensive Python/FastAPI testing suite with async support, database integration, and CI/CD readiness.

## 🧪 Test Suite Overview

### Architecture
- **pytest** with async support (`pytest-asyncio`)
- **FastAPI TestClient** and **httpx AsyncClient** for API testing
- **SQLAlchemy** transaction rollback for database tests
- **Celery** eager mode for background task testing
- **Coverage.py** with HTML, XML, and JSON reporting

### Test Categories

| Category | Description | Files | Coverage |
|----------|-------------|-------|----------|
| **Unit Tests** | Service layer with mocking | `test_services.py` | Business logic |
| **Integration Tests** | Database transactions | `test_database_integration.py` | Data layer |
| **API Tests** | REST endpoint validation | `test_api_endpoints.py` | HTTP layer |
| **Celery Tests** | Background tasks | `test_celery_tasks.py` | Async processing |
| **Error Handling** | Edge cases & failures | `test_error_handling.py` | Exception flows |
| **API Documentation** | Schema validation | `test_api_docs_validation.py` | OpenAPI compliance |
| **Coverage Analysis** | Quality gates | `test_coverage.py` | Quality metrics |

## 🚀 Quick Start

### Prerequisites
```bash
# Install testing dependencies
cd tests/backend
pip install -r requirements.txt

# Or from root requirements
pip install pytest pytest-asyncio httpx sqlalchemy[asyncio] coverage
```

### Running Tests

```bash
# All tests with coverage
python run_tests.py --type all --verbose

# Specific test types
python run_tests.py --type unit
python run_tests.py --type api 
python run_tests.py --type database
python run_tests.py --type celery

# CI pipeline (fast, essential tests)
python run_tests.py --type ci

# Comprehensive suite (all categories)
python run_tests.py --type comprehensive

# Quality gates only
python run_tests.py --quality-gates
```

### Manual pytest Commands
```bash
# Unit tests with coverage
pytest tests/backend/test_services.py -v --cov=backend/src --cov-report=html

# API tests only
pytest -m api --tb=short

# Database tests with transaction rollback
pytest -m database --verbose

# Performance tests
pytest -m performance --tb=short

# Security tests
pytest -m security --strict-markers
```

## 📊 Test Configuration

### pytest.ini
- **Markers**: `unit`, `integration`, `api`, `database`, `celery`, `security`, `performance`, `slow`
- **Coverage**: 80% line, 75% branch targets with fail-under thresholds
- **Reports**: HTML, XML, JSON formats with term-missing output
- **Async Mode**: Auto-detection for async test functions

### conftest.py Features
- **Database Fixtures**: Async sessions with transaction rollback
- **Test Data Factories**: User, Organization, Workflow, Form factories
- **Mock Services**: Cache, Worker, Database managers with AsyncMock
- **API Client Fixtures**: Sync and async test clients with auth overrides
- **Performance Timers**: Millisecond precision for performance tests

## 🗃️ Database Testing

### Transaction Isolation
```python
@pytest.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        async with session.begin():
            yield session
            # Automatic rollback on exit
```

### Test Data Factories
```python
# Create test users with factory
user = user_factory(email="test@example.com", is_admin=True)

# Create workflows with relationships
workflow = workflow_factory(
    created_by=user,
    organization=organization,
    definition={"nodes": [], "edges": []}
)
```

### Comprehensive Database Tests
- **Model Operations**: CRUD with validation
- **Constraint Testing**: Unique, foreign key, check constraints
- **Transaction Behavior**: Rollback, savepoints, concurrent access
- **Performance Testing**: Bulk operations, query optimization
- **Data Integrity**: Cascade deletes, relationship consistency

## 🌐 API Testing

### Comprehensive Endpoint Coverage
```python
# Test all HTTP methods and status codes
async def test_workflow_crud_cycle(async_client, auth_headers):
    # CREATE: POST /api/v1/workflows/
    create_response = await async_client.post("/api/v1/workflows/", json=data)
    assert create_response.status_code == 201
    
    # READ: GET /api/v1/workflows/{id}
    workflow_id = create_response.json()["id"]
    get_response = await async_client.get(f"/api/v1/workflows/{workflow_id}")
    assert get_response.status_code == 200
    
    # UPDATE: PUT /api/v1/workflows/{id}
    update_response = await async_client.put(f"/api/v1/workflows/{workflow_id}", json=updates)
    assert update_response.status_code == 200
    
    # DELETE: DELETE /api/v1/workflows/{id}  
    delete_response = await async_client.delete(f"/api/v1/workflows/{workflow_id}")
    assert delete_response.status_code == 200
```

### Authentication & Authorization
- **Header Validation**: Bearer tokens, API keys
- **Permission Testing**: Role-based access control
- **Security Headers**: CORS, CSRF, XSS protection
- **Rate Limiting**: Concurrent request handling

### Schema Validation
- **Request Validation**: JSON schema compliance
- **Response Validation**: Field presence and types
- **Error Format**: Consistent error response structure
- **OpenAPI Compliance**: Documentation accuracy

## ⚙️ Service Layer Testing

### Comprehensive Mocking
```python
@pytest.fixture
def mock_cache_manager():
    mock = AsyncMock(spec=CacheManager)
    mock.get.return_value = None
    mock.set.return_value = True
    mock.health_check.return_value = {"status": "healthy"}
    return mock
```

### Business Logic Coverage
- **Workflow Engine**: Execution, validation, error handling
- **Form Processor**: Validation, sanitization, submission handling  
- **Notification Service**: Email, webhook, batch notifications
- **Cache Manager**: Redis operations with fallback behavior
- **Integration Sync**: Data synchronization and validation

### Error Scenario Testing
- **Network Failures**: Timeout, connection errors
- **Validation Failures**: Invalid data, constraint violations
- **Resource Exhaustion**: Memory, CPU, storage limits
- **Concurrency Issues**: Race conditions, deadlocks

## 🔄 Celery Task Testing

### Background Task Coverage
```python
def test_workflow_execution_task(celery_app, celery_worker):
    # Configure Celery for testing
    celery_app.conf.task_always_eager = True
    
    # Test task execution
    task = ExecuteWorkflowTask()
    result = task.run(execution_id)
    
    assert result["status"] == "completed"
```

### Task Categories Tested
- **Workflow Execution**: Background workflow processing
- **Form Processing**: Form submission handling
- **Notification Dispatch**: Email and webhook sending  
- **Integration Sync**: Data synchronization tasks
- **Scheduled Tasks**: Cleanup, reports, backups

### Advanced Celery Features
- **Task Chaining**: Sequential task execution
- **Parallel Groups**: Concurrent task execution
- **Retry Logic**: Failure handling and retries
- **Performance Testing**: Memory usage, concurrency limits

## 🛡️ Error Handling & Edge Cases

### Comprehensive Error Coverage
- **API Errors**: 4xx, 5xx status codes with proper messages
- **Database Errors**: Constraint violations, connection failures
- **Cache Failures**: Redis unavailability with graceful degradation
- **Validation Errors**: Schema violations, business rule failures
- **Security Attacks**: XSS, SQL injection, CSRF attempts

### Edge Case Testing
- **Boundary Values**: Min/max inputs, empty data, null values
- **Unicode Support**: International characters, emojis
- **Concurrent Access**: Race conditions, resource contention
- **Memory Limits**: Large payloads, deep nesting
- **Time Boundaries**: Date/time edge cases, timezone handling

## 📈 Coverage & Quality Gates

### Coverage Targets
- **Line Coverage**: ≥80% (fail-under: 70%)
- **Branch Coverage**: ≥75% (recommended: 80%)
- **Function Coverage**: ≥80%
- **File Coverage**: No files <50% coverage

### Quality Gates
```python
def test_coverage_quality_gate():
    analyzer = CoverageAnalyzer()
    summary = analyzer.generate_coverage_summary()
    
    assert summary["overall_metrics"]["line_rate"] >= 70.0
    assert len(analyzer.identify_critical_gaps()) == 0
```

### Automated Reporting
- **HTML Reports**: Interactive coverage visualization
- **XML Reports**: CI/CD integration (Jenkins, GitLab, GitHub)
- **JSON Reports**: Programmatic access and badge generation
- **Badge Generation**: Dynamic coverage badges for README

## 🔧 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Backend Tests
  run: |
    cd tests/backend
    python run_tests.py --type ci --parallel
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: tests/backend/reports/coverage.xml
```

### Quality Metrics
- **Performance Benchmarks**: API response times <500ms
- **Security Scanning**: Vulnerability detection
- **Code Quality**: Style, complexity, maintainability
- **Test Reliability**: Consistent pass rates, flaky test detection

## 📁 File Structure

```
tests/backend/
├── conftest.py                 # Pytest configuration & fixtures
├── pytest.ini                 # Pytest settings & markers  
├── run_tests.py               # Comprehensive test runner
├── test_api_endpoints.py      # REST API endpoint tests
├── test_celery_tasks.py       # Background task tests
├── test_coverage.py           # Coverage analysis & reporting
├── test_database_integration.py # Database & transaction tests
├── test_error_handling.py     # Error scenarios & edge cases
├── test_api_docs_validation.py # OpenAPI schema validation
├── test_services.py           # Service layer unit tests
├── reports/                   # Generated test reports
│   ├── coverage_html_*/       # HTML coverage reports
│   ├── coverage_*.xml         # XML coverage reports  
│   ├── coverage_*.json        # JSON coverage reports
│   └── junit_*.xml           # JUnit test reports
└── README.md                  # This documentation
```

## 🎯 Best Practices

### Test Design
- **AAA Pattern**: Arrange, Act, Assert structure
- **Single Responsibility**: One behavior per test
- **Descriptive Names**: Clear test intent and expectations
- **Test Isolation**: No dependencies between tests
- **Data Factories**: Reusable test data generation

### Performance
- **Async Testing**: Proper async/await usage
- **Database Fixtures**: Transaction rollback for speed
- **Mock External Services**: Avoid network calls in tests  
- **Parallel Execution**: pytest-xdist for speed
- **Selective Testing**: Markers for targeted test runs

### Maintenance
- **Regular Updates**: Keep dependencies current
- **Coverage Monitoring**: Track coverage trends
- **Flaky Test Detection**: Identify unreliable tests
- **Documentation**: Keep test documentation updated
- **Code Review**: Review test code like production code

## 🚨 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check database is running
docker ps | grep postgres

# Reset test database
dropdb concertmaster_test
createdb concertmaster_test
```

**Celery Import Errors**
```bash
# Ensure backend module is importable
export PYTHONPATH="${PYTHONPATH}:${PWD}/backend/src"
```

**Coverage Not Working**
```bash
# Install coverage dependencies
pip install coverage pytest-cov

# Check source paths in pytest.ini
--cov=backend/src  # Adjust path as needed
```

**Async Test Failures**
```bash
# Check asyncio mode in pytest.ini
asyncio_mode = auto

# Use proper async fixtures
@pytest.mark.asyncio
async def test_async_function():
```

### Debug Mode
```bash
# Run tests with debugging
python run_tests.py --type unit --verbose --no-coverage

# Single test with pdb
pytest tests/backend/test_api_endpoints.py::test_create_workflow -s --pdb
```

## 📚 Resources

- [pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [SQLAlchemy Async Testing](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Celery Testing](https://docs.celeryproject.org/en/stable/userguide/testing.html)
- [Coverage.py](https://coverage.readthedocs.io/)

---

## 🤝 Contributing

When adding new tests:

1. **Follow Naming**: `test_*.py` files with `test_*` functions
2. **Add Markers**: Use appropriate pytest markers (`@pytest.mark.unit`)  
3. **Update Fixtures**: Extend `conftest.py` for new test data needs
4. **Document Tests**: Add docstrings explaining test purpose
5. **Run Quality Gates**: Ensure coverage and quality standards are met

For questions or improvements, see the main project documentation or open an issue.

**Happy Testing! 🧪✨**