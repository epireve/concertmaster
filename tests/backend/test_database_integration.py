"""
Database Integration Tests
Test database models, transactions, and data integrity
"""

import pytest
import asyncio
from uuid import uuid4
from datetime import datetime, timedelta
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from backend.src.database.models import (
    Base, User, Organization, UserOrganization, Workflow, Form, FormSubmission,
    WorkflowExecution, NodeExecution, Integration, Webhook, AuditLog, PerformanceMetric
)


@pytest.mark.database
class TestUserModel:
    """Test User model operations"""
    
    async def test_create_user(self, async_session: AsyncSession):
        """Test creating a new user"""
        user = User(
            email="test@example.com",
            username="testuser",
            password_hash="$2b$12$test.hash",
            first_name="Test",
            last_name="User"
        )
        
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)
        
        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.full_name == "Test User"
        assert user.is_active is True
        assert user.is_admin is False
        assert user.created_at is not None
        assert user.updated_at is not None
    
    async def test_user_unique_constraints(self, async_session: AsyncSession):
        """Test user unique constraints"""
        # Create first user
        user1 = User(
            email="unique@example.com",
            username="unique_user",
            password_hash="$2b$12$test.hash"
        )
        async_session.add(user1)
        await async_session.commit()
        
        # Try to create second user with same email
        user2 = User(
            email="unique@example.com",  # Same email
            username="different_user",
            password_hash="$2b$12$test.hash"
        )
        async_session.add(user2)
        
        with pytest.raises(IntegrityError):
            await async_session.commit()
        
        await async_session.rollback()
        
        # Try to create user with same username
        user3 = User(
            email="different@example.com",
            username="unique_user",  # Same username
            password_hash="$2b$12$test.hash"
        )
        async_session.add(user3)
        
        with pytest.raises(IntegrityError):
            await async_session.commit()
    
    async def test_user_full_name_property(self, async_session: AsyncSession):
        """Test user full_name property logic"""
        # User with both first and last name
        user1 = User(
            email="test1@example.com",
            username="test1",
            password_hash="$2b$12$test.hash",
            first_name="John",
            last_name="Doe"
        )
        assert user1.full_name == "John Doe"
        
        # User with only first name
        user2 = User(
            email="test2@example.com",
            username="test2",
            password_hash="$2b$12$test.hash",
            first_name="Jane"
        )
        assert user2.full_name == "test2"
        
        # User with no names
        user3 = User(
            email="test3@example.com",
            username="test3",
            password_hash="$2b$12$test.hash"
        )
        assert user3.full_name == "test3"


@pytest.mark.database
class TestOrganizationModel:
    """Test Organization model operations"""
    
    async def test_create_organization(self, async_session: AsyncSession):
        """Test creating an organization"""
        org = Organization(
            name="Test Organization",
            slug="test-org",
            description="A test organization",
            settings={"theme": "dark", "notifications": True}
        )
        
        async_session.add(org)
        await async_session.commit()
        await async_session.refresh(org)
        
        assert org.id is not None
        assert org.name == "Test Organization"
        assert org.slug == "test-org"
        assert org.settings["theme"] == "dark"
        assert org.created_at is not None
    
    async def test_organization_unique_slug(self, async_session: AsyncSession):
        """Test organization slug uniqueness"""
        org1 = Organization(name="Org 1", slug="same-slug")
        org2 = Organization(name="Org 2", slug="same-slug")
        
        async_session.add(org1)
        await async_session.commit()
        
        async_session.add(org2)
        with pytest.raises(IntegrityError):
            await async_session.commit()


@pytest.mark.database
class TestUserOrganizationRelationship:
    """Test User-Organization many-to-many relationship"""
    
    async def test_user_organization_membership(self, async_session: AsyncSession):
        """Test creating user-organization relationships"""
        # Create user and organization
        user = User(
            email="member@example.com",
            username="member",
            password_hash="$2b$12$test.hash"
        )
        org = Organization(name="Member Org", slug="member-org")
        
        async_session.add_all([user, org])
        await async_session.flush()
        
        # Create membership
        membership = UserOrganization(
            user_id=user.id,
            organization_id=org.id,
            role="admin",
            permissions=["read", "write", "admin"]
        )
        
        async_session.add(membership)
        await async_session.commit()
        await async_session.refresh(membership)
        
        assert membership.role == "admin"
        assert "admin" in membership.permissions
        assert membership.joined_at is not None
    
    async def test_invalid_role_constraint(self, async_session: AsyncSession):
        """Test role constraint validation"""
        user = User(email="test@example.com", username="test", password_hash="hash")
        org = Organization(name="Test", slug="test")
        
        async_session.add_all([user, org])
        await async_session.flush()
        
        membership = UserOrganization(
            user_id=user.id,
            organization_id=org.id,
            role="invalid_role"  # Should fail constraint
        )
        
        async_session.add(membership)
        with pytest.raises(IntegrityError):
            await async_session.commit()


@pytest.mark.database
class TestWorkflowModel:
    """Test Workflow model operations"""
    
    async def test_create_workflow(self, async_session: AsyncSession, setup_test_data):
        """Test creating a workflow"""
        test_data = setup_test_data
        user = test_data["users"]["user1"]
        org = test_data["organizations"]["org1"]
        
        workflow = Workflow(
            name="Test Workflow",
            description="A comprehensive test workflow",
            organization_id=org.id,
            created_by=user.id,
            definition={
                "nodes": [
                    {
                        "id": "start",
                        "type": "trigger",
                        "position": {"x": 0, "y": 0},
                        "data": {"trigger_type": "manual"}
                    },
                    {
                        "id": "process",
                        "type": "transform",
                        "position": {"x": 200, "y": 0},
                        "data": {"operation": "uppercase"}
                    }
                ],
                "edges": [
                    {
                        "id": "e1",
                        "source": "start",
                        "target": "process"
                    }
                ]
            },
            settings={
                "timeout": 300,
                "retry_count": 3,
                "parallel_execution": False
            },
            tags=["test", "automation", "processing"]
        )
        
        async_session.add(workflow)
        await async_session.commit()
        await async_session.refresh(workflow)
        
        assert workflow.id is not None
        assert workflow.name == "Test Workflow"
        assert workflow.status == "draft"  # Default status
        assert workflow.version == 1  # Default version
        assert len(workflow.definition["nodes"]) == 2
        assert len(workflow.definition["edges"]) == 1
        assert "test" in workflow.tags
        assert workflow.settings["timeout"] == 300
        assert workflow.execution_count == 0
        assert workflow.success_rate == 0.00
    
    async def test_workflow_status_constraint(self, async_session: AsyncSession, setup_test_data):
        """Test workflow status constraint"""
        test_data = setup_test_data
        user = test_data["users"]["user1"]
        org = test_data["organizations"]["org1"]
        
        workflow = Workflow(
            name="Invalid Status Workflow",
            organization_id=org.id,
            created_by=user.id,
            definition={"nodes": [], "edges": []},
            status="invalid_status"
        )
        
        async_session.add(workflow)
        with pytest.raises(IntegrityError):
            await async_session.commit()
    
    async def test_workflow_cascade_delete(self, async_session: AsyncSession, setup_test_data):
        """Test cascade deletion of workflow and related records"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        # Create related records
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            trigger_type="manual",
            triggered_by=test_data["users"]["user1"].id
        )
        
        webhook = Webhook(
            workflow_id=workflow.id,
            name="Test Webhook",
            url_path=f"/webhook/{uuid4().hex}"
        )
        
        async_session.add_all([execution, webhook])
        await async_session.commit()
        
        # Delete workflow
        await async_session.delete(workflow)
        await async_session.commit()
        
        # Verify related records are deleted
        execution_check = await async_session.execute(
            select(WorkflowExecution).where(WorkflowExecution.workflow_id == workflow.id)
        )
        assert execution_check.scalar_one_or_none() is None
        
        webhook_check = await async_session.execute(
            select(Webhook).where(Webhook.workflow_id == workflow.id)
        )
        assert webhook_check.scalar_one_or_none() is None


@pytest.mark.database
class TestFormModel:
    """Test Form model operations"""
    
    async def test_create_form(self, async_session: AsyncSession, setup_test_data):
        """Test creating a form"""
        test_data = setup_test_data
        user = test_data["users"]["user1"]
        org = test_data["organizations"]["org1"]
        
        form = Form(
            name="contact-form",
            title="Contact Us",
            description="A contact form for customer inquiries",
            organization_id=org.id,
            created_by=user.id,
            schema={
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
                            "max_length": 1000
                        }
                    }
                ],
                "layout": {
                    "columns": 1,
                    "spacing": "medium"
                }
            },
            settings={
                "allow_multiple_submissions": False,
                "submit_button_text": "Send Message",
                "success_message": "Thank you for your message!",
                "styling": {
                    "theme": "modern",
                    "primary_color": "#007bff"
                }
            }
        )
        
        async_session.add(form)
        await async_session.commit()
        await async_session.refresh(form)
        
        assert form.id is not None
        assert form.name == "contact-form"
        assert form.title == "Contact Us"
        assert form.status == "draft"
        assert len(form.schema["fields"]) == 3
        assert form.schema["fields"][0]["required"] is True
        assert form.settings["allow_multiple_submissions"] is False
        assert form.submission_count == 0
    
    async def test_form_submission(self, async_session: AsyncSession, setup_test_data):
        """Test creating form submissions"""
        test_data = setup_test_data
        form = test_data["forms"]["form1"]
        user = test_data["users"]["user1"]
        
        submission = FormSubmission(
            form_id=form.id,
            data={
                "name": "John Doe",
                "email": "john@example.com"
            },
            metadata={
                "ip_address": "192.168.1.1",
                "user_agent": "Mozilla/5.0 Test Browser",
                "referrer": "https://example.com"
            },
            submitted_by=user.id
        )
        
        async_session.add(submission)
        await async_session.commit()
        await async_session.refresh(submission)
        
        assert submission.id is not None
        assert submission.form_id == form.id
        assert submission.data["name"] == "John Doe"
        assert submission.data["email"] == "john@example.com"
        assert submission.status == "received"
        assert submission.submitted_at is not None
        assert submission.metadata["ip_address"] == "192.168.1.1"


@pytest.mark.database
class TestWorkflowExecutionModel:
    """Test Workflow Execution and Node Execution models"""
    
    async def test_workflow_execution_lifecycle(self, async_session: AsyncSession, setup_test_data):
        """Test complete workflow execution lifecycle"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        user = test_data["users"]["user1"]
        
        # Create workflow execution
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            trigger_type="manual",
            trigger_data={"input": "test data"},
            triggered_by=user.id,
            priority=3,
            context={"environment": "test", "version": "1.0"}
        )
        
        async_session.add(execution)
        await async_session.flush()
        
        # Simulate execution start
        execution.status = "running"
        execution.started_at = datetime.utcnow()
        
        # Create node executions
        node1 = NodeExecution(
            workflow_execution_id=execution.id,
            node_id="start",
            node_type="trigger",
            status="completed",
            input_data={},
            output_data={"triggered": True},
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            execution_time=50  # 50ms
        )
        
        node2 = NodeExecution(
            workflow_execution_id=execution.id,
            node_id="process",
            node_type="transform",
            status="running",
            input_data={"data": "test"},
            started_at=datetime.utcnow()
        )
        
        async_session.add_all([node1, node2])
        await async_session.commit()
        
        # Complete second node
        node2.status = "completed"
        node2.output_data = {"result": "processed"}
        node2.completed_at = datetime.utcnow()
        node2.execution_time = 100  # 100ms
        
        # Complete workflow execution
        execution.status = "completed"
        execution.completed_at = datetime.utcnow()
        execution.execution_time = 200  # Total 200ms
        
        await async_session.commit()
        await async_session.refresh(execution)
        
        # Verify execution state
        assert execution.status == "completed"
        assert execution.execution_time == 200
        assert execution.priority == 3
        assert execution.context["environment"] == "test"
        
        # Verify node executions
        nodes = await async_session.execute(
            select(NodeExecution)
            .where(NodeExecution.workflow_execution_id == execution.id)
            .order_by(NodeExecution.started_at)
        )
        node_list = nodes.scalars().all()
        
        assert len(node_list) == 2
        assert node_list[0].node_id == "start"
        assert node_list[0].status == "completed"
        assert node_list[1].node_id == "process"
        assert node_list[1].status == "completed"
    
    async def test_execution_priority_constraint(self, async_session: AsyncSession, setup_test_data):
        """Test execution priority constraint"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            trigger_type="manual",
            priority=15  # Should fail constraint (valid range: 1-10)
        )
        
        async_session.add(execution)
        with pytest.raises(IntegrityError):
            await async_session.commit()
    
    async def test_node_execution_status_constraint(self, async_session: AsyncSession, setup_test_data):
        """Test node execution status constraint"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            trigger_type="manual"
        )
        async_session.add(execution)
        await async_session.flush()
        
        node = NodeExecution(
            workflow_execution_id=execution.id,
            node_id="test",
            node_type="test",
            status="invalid_status"  # Should fail constraint
        )
        
        async_session.add(node)
        with pytest.raises(IntegrityError):
            await async_session.commit()


@pytest.mark.database
class TestIntegrationModel:
    """Test Integration model operations"""
    
    async def test_create_integration(self, async_session: AsyncSession, setup_test_data):
        """Test creating an integration"""
        test_data = setup_test_data
        user = test_data["users"]["user1"]
        org = test_data["organizations"]["org1"]
        
        integration = Integration(
            name="Gmail SMTP",
            type="email",
            organization_id=org.id,
            created_by=user.id,
            configuration={
                "smtp_server": "smtp.gmail.com",
                "port": 587,
                "use_tls": True,
                "use_ssl": False
            },
            credentials={
                "username": "encrypted_username",
                "password": "encrypted_password",
                "app_password": "encrypted_app_password"
            }
        )
        
        async_session.add(integration)
        await async_session.commit()
        await async_session.refresh(integration)
        
        assert integration.id is not None
        assert integration.name == "Gmail SMTP"
        assert integration.type == "email"
        assert integration.status == "active"  # Default status
        assert integration.configuration["smtp_server"] == "smtp.gmail.com"
        assert integration.usage_count == 0
        assert integration.created_at is not None
    
    async def test_integration_status_constraint(self, async_session: AsyncSession, setup_test_data):
        """Test integration status constraint"""
        test_data = setup_test_data
        user = test_data["users"]["user1"]
        org = test_data["organizations"]["org1"]
        
        integration = Integration(
            name="Invalid Status Integration",
            type="webhook",
            organization_id=org.id,
            created_by=user.id,
            configuration={},
            status="invalid_status"
        )
        
        async_session.add(integration)
        with pytest.raises(IntegrityError):
            await async_session.commit()


@pytest.mark.database
class TestWebhookModel:
    """Test Webhook model operations"""
    
    async def test_create_webhook(self, async_session: AsyncSession, setup_test_data):
        """Test creating webhooks"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        webhook = Webhook(
            workflow_id=workflow.id,
            name="GitHub Push Webhook",
            url_path=f"/webhook/github/{uuid4().hex}",
            secret_key="webhook_secret_key_123"
        )
        
        async_session.add(webhook)
        await async_session.commit()
        await async_session.refresh(webhook)
        
        assert webhook.id is not None
        assert webhook.workflow_id == workflow.id
        assert webhook.name == "GitHub Push Webhook"
        assert webhook.url_path.startswith("/webhook/github/")
        assert webhook.secret_key == "webhook_secret_key_123"
        assert webhook.is_active is True
        assert webhook.request_count == 0
    
    async def test_webhook_unique_url_path(self, async_session: AsyncSession, setup_test_data):
        """Test webhook URL path uniqueness"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        url_path = f"/webhook/unique/{uuid4().hex}"
        
        webhook1 = Webhook(
            workflow_id=workflow.id,
            name="Webhook 1",
            url_path=url_path
        )
        
        webhook2 = Webhook(
            workflow_id=workflow.id,
            name="Webhook 2",
            url_path=url_path  # Same URL path
        )
        
        async_session.add(webhook1)
        await async_session.commit()
        
        async_session.add(webhook2)
        with pytest.raises(IntegrityError):
            await async_session.commit()


@pytest.mark.database
class TestPerformanceMetricModel:
    """Test Performance Metric model operations"""
    
    async def test_create_performance_metrics(self, async_session: AsyncSession, setup_test_data):
        """Test creating performance metrics"""
        test_data = setup_test_data
        workflow = test_data["workflows"]["workflow1"]
        
        metrics = [
            PerformanceMetric(
                metric_type="execution",
                entity_type="workflow",
                entity_id=workflow.id,
                metric_name="execution_time",
                metric_value=250.5,
                unit="milliseconds"
            ),
            PerformanceMetric(
                metric_type="resource",
                entity_type="workflow",
                entity_id=workflow.id,
                metric_name="memory_usage",
                metric_value=64.25,
                unit="megabytes"
            ),
            PerformanceMetric(
                metric_type="throughput",
                entity_type="workflow",
                entity_id=workflow.id,
                metric_name="requests_per_second",
                metric_value=15.75,
                unit="rps"
            )
        ]
        
        async_session.add_all(metrics)
        await async_session.commit()
        
        # Query metrics
        result = await async_session.execute(
            select(PerformanceMetric)
            .where(PerformanceMetric.entity_id == workflow.id)
            .order_by(PerformanceMetric.metric_name)
        )
        saved_metrics = result.scalars().all()
        
        assert len(saved_metrics) == 3
        assert saved_metrics[0].metric_name == "execution_time"
        assert saved_metrics[0].metric_value == 250.5
        assert saved_metrics[0].unit == "milliseconds"


@pytest.mark.database
class TestDatabaseTransactions:
    """Test database transaction handling"""
    
    async def test_transaction_rollback_on_error(self, async_session: AsyncSession):
        """Test transaction rollback on error"""
        # Start with clean state
        user_count_before = await async_session.execute(select(func.count(User.id)))
        initial_count = user_count_before.scalar()
        
        try:
            # Create a valid user
            user1 = User(
                email="valid@example.com",
                username="valid_user",
                password_hash="$2b$12$test.hash"
            )
            async_session.add(user1)
            await async_session.flush()  # Flush but don't commit
            
            # Create an invalid user (duplicate email)
            user2 = User(
                email="valid@example.com",  # Duplicate email
                username="another_user",
                password_hash="$2b$12$test.hash"
            )
            async_session.add(user2)
            
            # This should raise an IntegrityError
            await async_session.commit()
            
        except IntegrityError:
            await async_session.rollback()
        
        # Verify no users were created
        user_count_after = await async_session.execute(select(func.count(User.id)))
        final_count = user_count_after.scalar()
        
        assert final_count == initial_count
    
    async def test_concurrent_transaction_handling(self, async_engine):
        """Test concurrent transaction handling"""
        from sqlalchemy.ext.asyncio import async_sessionmaker
        
        AsyncSessionLocal = async_sessionmaker(
            bind=async_engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
        async def create_user_transaction(session_maker, email, username):
            async with session_maker() as session:
                async with session.begin():
                    user = User(
                        email=email,
                        username=username,
                        password_hash="$2b$12$test.hash"
                    )
                    session.add(user)
                    await session.commit()
                    return user.id
        
        # Run concurrent transactions
        tasks = [
            create_user_transaction(AsyncSessionLocal, f"user{i}@test.com", f"user{i}")
            for i in range(5)
        ]
        
        user_ids = await asyncio.gather(*tasks)
        
        # Verify all users were created
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(func.count(User.id))
                .where(User.id.in_(user_ids))
            )
            count = result.scalar()
            assert count == 5
    
    async def test_nested_transaction_behavior(self, async_session: AsyncSession):
        """Test nested transaction behavior with savepoints"""
        # Create organization first
        org = Organization(name="Test Org", slug="test-org")
        async_session.add(org)
        await async_session.flush()
        
        user_count_before = await async_session.execute(select(func.count(User.id)))
        initial_count = user_count_before.scalar()
        
        try:
            # Savepoint for user creation
            sp1 = await async_session.begin_nested()
            
            user = User(
                email="nested@example.com",
                username="nested_user",
                password_hash="$2b$12$test.hash"
            )
            async_session.add(user)
            await async_session.flush()
            
            try:
                # Another savepoint for organization membership
                sp2 = await async_session.begin_nested()
                
                membership = UserOrganization(
                    user_id=user.id,
                    organization_id=org.id,
                    role="invalid_role"  # This will fail
                )
                async_session.add(membership)
                await sp2.commit()
                
            except IntegrityError:
                await sp2.rollback()
                # User should still exist, but membership should not
            
            await sp1.commit()
            
        except Exception as e:
            await sp1.rollback()
            raise
        
        await async_session.commit()
        
        # Verify user was created but membership was not
        user_count_after = await async_session.execute(select(func.count(User.id)))
        final_count = user_count_after.scalar()
        assert final_count == initial_count + 1
        
        membership_count = await async_session.execute(
            select(func.count(UserOrganization.id))
            .where(UserOrganization.user_id == user.id)
        )
        assert membership_count.scalar() == 0


@pytest.mark.database
class TestDatabasePerformance:
    """Test database performance and optimization"""
    
    async def test_bulk_insert_performance(self, async_session: AsyncSession, performance_timer):
        """Test bulk insert performance"""
        users = [
            User(
                email=f"bulk{i}@example.com",
                username=f"bulk_user_{i}",
                password_hash="$2b$12$test.hash"
            )
            for i in range(100)
        ]
        
        performance_timer.start()
        
        async_session.add_all(users)
        await async_session.commit()
        
        performance_timer.stop()
        
        # Should complete in reasonable time (adjust threshold as needed)
        assert performance_timer.elapsed_ms < 5000  # 5 seconds
        
        # Verify all users were created
        count = await async_session.execute(
            select(func.count(User.id))
            .where(User.email.like("bulk%@example.com"))
        )
        assert count.scalar() == 100
    
    async def test_query_performance_with_indexes(
        self, async_session: AsyncSession, performance_timer, setup_test_data
    ):
        """Test query performance (assumes indexes are in place)"""
        # This test would be more meaningful with a larger dataset
        performance_timer.start()
        
        result = await async_session.execute(
            select(User)
            .where(User.email == "user1@test.com")
            .where(User.is_active == True)
        )
        
        performance_timer.stop()
        
        user = result.scalar_one_or_none()
        assert user is not None
        # Query should be fast with proper indexing
        assert performance_timer.elapsed_ms < 100  # 100ms
    
    async def test_complex_join_performance(
        self, async_session: AsyncSession, performance_timer, setup_test_data
    ):
        """Test complex join query performance"""
        performance_timer.start()
        
        result = await async_session.execute(
            select(User, Workflow, Organization)
            .join(Workflow, User.id == Workflow.created_by)
            .join(Organization, Workflow.organization_id == Organization.id)
            .where(User.is_active == True)
            .where(Workflow.status == "draft")
        )
        
        performance_timer.stop()
        
        rows = result.all()
        # Should handle joins efficiently
        assert performance_timer.elapsed_ms < 500  # 500ms
    
    async def test_pagination_performance(
        self, async_session: AsyncSession, performance_timer
    ):
        """Test pagination query performance"""
        # Create multiple workflows for pagination testing
        for i in range(50):
            workflow = Workflow(
                name=f"Pagination Test {i}",
                organization_id=uuid4(),  # We'll ignore foreign key for this test
                created_by=uuid4(),
                definition={"nodes": [], "edges": []}
            )
            async_session.add(workflow)
        
        await async_session.commit()
        
        performance_timer.start()
        
        # Test pagination query
        result = await async_session.execute(
            select(Workflow)
            .where(Workflow.name.like("Pagination Test%"))
            .order_by(Workflow.created_at.desc())
            .offset(10)
            .limit(10)
        )
        
        performance_timer.stop()
        
        workflows = result.scalars().all()
        assert len(workflows) <= 10
        # Pagination should be efficient
        assert performance_timer.elapsed_ms < 200  # 200ms