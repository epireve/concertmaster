"""
Pytest Configuration and Fixtures
Test fixtures for FastAPI backend testing with async support
"""

import asyncio
import os
import pytest
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
import pytest_asyncio

# Import application modules
from backend.src.main import app
from backend.src.config import Settings
from backend.src.database.connection import get_db_session, DatabaseManager
from backend.src.database.models import Base, User, Organization, Workflow, Form
from backend.src.auth.security import get_current_active_user
from backend.src.services.cache_manager import CacheManager
from backend.src.services.worker_manager import WorkerManager

# Test Configuration
class TestSettings(Settings):
    """Test-specific settings"""
    DATABASE_URL: str = "postgresql://test:test@localhost:5432/concertmaster_test"
    ASYNC_DATABASE_URL: str = "postgresql+asyncpg://test:test@localhost:5432/concertmaster_test"
    REDIS_URL: str = "redis://localhost:6379/15"
    CELERY_BROKER_URL: str = "redis://localhost:6379/14"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/13"
    SECRET_KEY: str = "test-secret-key-for-testing-only-32-chars"
    DEBUG: bool = True
    CACHE_TTL: int = 30
    
    class Config:
        env_file = ".env.test"
        case_sensitive = True

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for the session"""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def test_settings() -> TestSettings:
    """Test settings fixture"""
    return TestSettings()

# Database Fixtures
@pytest.fixture(scope="session")
async def async_engine(test_settings):
    """Create async database engine for testing"""
    engine = create_async_engine(
        test_settings.ASYNC_DATABASE_URL,
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Clean up
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest.fixture(scope="session")
def sync_engine(test_settings):
    """Create sync database engine for testing"""
    engine = create_engine(
        test_settings.DATABASE_URL,
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    return engine

@pytest.fixture
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create async database session with transaction rollback"""
    async_session_maker = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        async with session.begin():
            yield session
            # Rollback is automatic when context exits

@pytest.fixture
def sync_session(sync_engine):
    """Create sync database session with transaction rollback"""
    Session = sessionmaker(bind=sync_engine)
    session = Session()
    
    try:
        session.begin()
        yield session
    finally:
        session.rollback()
        session.close()

# Mock Services
@pytest.fixture
def mock_cache_manager():
    """Mock cache manager"""
    mock = AsyncMock(spec=CacheManager)
    mock.get.return_value = None
    mock.set.return_value = True
    mock.delete.return_value = True
    mock.health_check.return_value = {"status": "healthy", "connected": True}
    mock.get_stats.return_value = {"connections": 1, "memory_usage": "10MB"}
    return mock

@pytest.fixture
def mock_worker_manager():
    """Mock worker manager (Celery)"""
    mock = AsyncMock(spec=WorkerManager)
    mock.health_check.return_value = {"status": "healthy", "active_workers": 1}
    mock.get_stats.return_value = {"active_tasks": 0, "pending_tasks": 0}
    return mock

@pytest.fixture
def mock_db_manager():
    """Mock database manager"""
    mock = AsyncMock(spec=DatabaseManager)
    mock.health_check.return_value = {"status": "healthy", "connected": True}
    mock.get_stats.return_value = {"connections": 1, "queries_executed": 0}
    return mock

# Test Data Factories
@pytest.fixture
def user_factory():
    """User factory for creating test users"""
    def _create_user(
        email: str = None,
        username: str = None,
        password_hash: str = "$2b$12$test.hash",
        is_active: bool = True,
        is_admin: bool = False,
        **kwargs
    ) -> User:
        return User(
            id=uuid4(),
            email=email or f"user{uuid4().hex[:8]}@test.com",
            username=username or f"user{uuid4().hex[:8]}",
            password_hash=password_hash,
            is_active=is_active,
            is_admin=is_admin,
            **kwargs
        )
    return _create_user

@pytest.fixture
def organization_factory():
    """Organization factory for creating test organizations"""
    def _create_organization(
        name: str = None,
        slug: str = None,
        **kwargs
    ) -> Organization:
        unique_id = uuid4().hex[:8]
        return Organization(
            id=uuid4(),
            name=name or f"Test Org {unique_id}",
            slug=slug or f"test-org-{unique_id}",
            **kwargs
        )
    return _create_organization

@pytest.fixture
def workflow_factory(user_factory, organization_factory):
    """Workflow factory for creating test workflows"""
    def _create_workflow(
        name: str = None,
        created_by: User = None,
        organization: Organization = None,
        definition: dict = None,
        **kwargs
    ) -> Workflow:
        if created_by is None:
            created_by = user_factory()
        if organization is None:
            organization = organization_factory()
            
        return Workflow(
            id=uuid4(),
            name=name or f"Test Workflow {uuid4().hex[:8]}",
            created_by=created_by.id,
            organization_id=organization.id,
            definition=definition or {
                "nodes": [],
                "edges": []
            },
            **kwargs
        )
    return _create_workflow

@pytest.fixture
def form_factory(user_factory, organization_factory):
    """Form factory for creating test forms"""
    def _create_form(
        name: str = None,
        title: str = None,
        created_by: User = None,
        organization: Organization = None,
        schema: dict = None,
        **kwargs
    ) -> Form:
        if created_by is None:
            created_by = user_factory()
        if organization is None:
            organization = organization_factory()
            
        return Form(
            id=uuid4(),
            name=name or f"test-form-{uuid4().hex[:8]}",
            title=title or f"Test Form {uuid4().hex[:8]}",
            created_by=created_by.id,
            organization_id=organization.id,
            schema=schema or {
                "fields": [
                    {
                        "id": "name",
                        "type": "text",
                        "label": "Name",
                        "required": True
                    }
                ]
            },
            **kwargs
        )
    return _create_form

# Authentication Fixtures
@pytest.fixture
def test_user(user_factory):
    """Create a test user"""
    return user_factory(
        email="test@example.com",
        username="testuser",
        is_active=True
    )

@pytest.fixture
def admin_user(user_factory):
    """Create an admin test user"""
    return user_factory(
        email="admin@example.com",
        username="admin",
        is_active=True,
        is_admin=True
    )

@pytest.fixture
def test_organization(organization_factory):
    """Create a test organization"""
    return organization_factory(
        name="Test Organization",
        slug="test-org"
    )

# API Client Fixtures
@pytest.fixture
def override_get_db(async_session):
    """Override database dependency"""
    async def _override_get_db():
        yield async_session
    return _override_get_db

@pytest.fixture
def override_get_current_user(test_user):
    """Override authentication dependency"""
    def _override_get_current_user():
        return test_user
    return _override_get_current_user

@pytest.fixture
def test_app(
    override_get_db,
    override_get_current_user,
    mock_cache_manager,
    mock_worker_manager,
    mock_db_manager
) -> FastAPI:
    """Create test FastAPI application with overrides"""
    # Override dependencies
    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_user] = override_get_current_user
    
    # Mock services (would need to be injected properly in real implementation)
    # This is a simplified approach for testing
    
    yield app
    
    # Clean up
    app.dependency_overrides.clear()

@pytest.fixture
def client(test_app) -> Generator[TestClient, None, None]:
    """Create test client for synchronous testing"""
    with TestClient(test_app) as test_client:
        yield test_client

@pytest.fixture
async def async_client(test_app) -> AsyncGenerator[AsyncClient, None]:
    """Create async test client for asynchronous testing"""
    async with AsyncClient(app=test_app, base_url="http://test") as client:
        yield client

# Authentication Headers
@pytest.fixture
def auth_headers(test_user) -> dict:
    """Generate authentication headers for API requests"""
    # In real implementation, you would generate a proper JWT token
    # For testing, we'll use a mock token since auth is overridden
    return {
        "Authorization": "Bearer test-token",
        "Content-Type": "application/json"
    }

@pytest.fixture
def admin_auth_headers(admin_user) -> dict:
    """Generate admin authentication headers for API requests"""
    return {
        "Authorization": "Bearer admin-test-token",
        "Content-Type": "application/json"
    }

# Celery Testing
@pytest.fixture
def celery_config():
    """Celery configuration for testing"""
    return {
        'broker_url': 'memory://',
        'result_backend': 'cache+memory://',
        'task_always_eager': True,
        'task_eager_propagates': True,
    }

# Performance Testing
@pytest.fixture
def performance_timer():
    """Timer for performance testing"""
    import time
    
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            
        def start(self):
            self.start_time = time.perf_counter()
            
        def stop(self):
            self.end_time = time.perf_counter()
            
        @property
        def elapsed(self) -> float:
            if self.start_time is None or self.end_time is None:
                raise ValueError("Timer not properly started/stopped")
            return self.end_time - self.start_time
            
        @property
        def elapsed_ms(self) -> float:
            return self.elapsed * 1000
    
    return Timer()

# Database Setup Helpers
@pytest.fixture
async def setup_test_data(async_session, user_factory, organization_factory, workflow_factory, form_factory):
    """Set up comprehensive test data"""
    # Create users
    user1 = user_factory(email="user1@test.com", username="user1")
    user2 = user_factory(email="user2@test.com", username="user2")
    admin = user_factory(email="admin@test.com", username="admin", is_admin=True)
    
    # Create organizations
    org1 = organization_factory(name="Org 1", slug="org1")
    org2 = organization_factory(name="Org 2", slug="org2")
    
    # Add to session
    async_session.add_all([user1, user2, admin, org1, org2])
    await async_session.flush()
    
    # Create workflows
    workflow1 = workflow_factory(
        name="Test Workflow 1",
        created_by=user1,
        organization=org1,
        definition={
            "nodes": [
                {"id": "1", "type": "trigger", "position": {"x": 0, "y": 0}}
            ],
            "edges": []
        }
    )
    
    # Create forms
    form1 = form_factory(
        name="test-form-1",
        title="Test Form 1",
        created_by=user1,
        organization=org1,
        schema={
            "fields": [
                {
                    "id": "name",
                    "type": "text",
                    "label": "Full Name",
                    "required": True
                },
                {
                    "id": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": True
                }
            ]
        }
    )
    
    # Add to session
    async_session.add_all([workflow1, form1])
    await async_session.commit()
    
    return {
        "users": {"user1": user1, "user2": user2, "admin": admin},
        "organizations": {"org1": org1, "org2": org2},
        "workflows": {"workflow1": workflow1},
        "forms": {"form1": form1}
    }

# Cleanup
@pytest.fixture(autouse=True)
async def cleanup_after_test():
    """Cleanup after each test"""
    yield
    # Any cleanup logic here
    pass