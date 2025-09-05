"""
ConcertMaster Workflow Engine
Core workflow execution and management system
"""

from typing import Dict, Any, List, Optional, Union
from uuid import UUID, uuid4
from datetime import datetime
import asyncio
import json
import logging
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from ..database.connection import get_db_session
from ..models.workflow import Workflow, WorkflowRun, NodeExecution
from ..schemas.workflow import WorkflowCreate, WorkflowUpdate, WorkflowDefinition
from .node_executor import NodeExecutor
from .state_manager import StateManager
from .workflow_scheduler import WorkflowScheduler
from .workflow_validator import WorkflowValidator

logger = logging.getLogger(__name__)

class WorkflowStatus(str, Enum):
    """Workflow execution status"""
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"

class WorkflowEngine:
    """
    Core workflow engine for managing workflow lifecycles and execution
    
    Handles:
    - Workflow CRUD operations
    - Workflow execution orchestration
    - State management
    - Scheduling
    - Error handling and recovery
    """
    
    def __init__(self):
        self.node_executor = NodeExecutor()
        self.state_manager = StateManager()
        self.scheduler = WorkflowScheduler()
        self.validator = WorkflowValidator()
        
        # Execution tracking
        self._active_executions: Dict[str, asyncio.Task] = {}
        
        logger.info("WorkflowEngine initialized")
    
    # Workflow Management Methods
    
    async def create_workflow(
        self,
        workflow_data: WorkflowCreate,
        user_id: UUID,
        session: AsyncSession = None
    ) -> Workflow:
        """Create a new workflow with validation"""
        
        if session is None:
            async with get_db_session() as session:
                return await self._create_workflow_impl(workflow_data, user_id, session)
        else:
            return await self._create_workflow_impl(workflow_data, user_id, session)
    
    async def _create_workflow_impl(
        self,
        workflow_data: WorkflowCreate,
        user_id: UUID,
        session: AsyncSession
    ) -> Workflow:
        """Internal workflow creation implementation"""
        
        # Validate workflow definition
        validation_result = await self.validator.validate_workflow(workflow_data.definition)
        if not validation_result.is_valid:
            raise ValueError(f"Invalid workflow definition: {validation_result.errors}")
        
        # Create workflow instance
        workflow = Workflow(
            id=uuid4(),
            name=workflow_data.name,
            description=workflow_data.description,
            definition=workflow_data.definition.dict(),
            created_by=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            is_template=workflow_data.is_template or False,
            is_active=True
        )
        
        session.add(workflow)
        await session.commit()
        await session.refresh(workflow)
        
        # Schedule if needed
        if self._has_schedule_triggers(workflow.definition):
            await self.scheduler.schedule_workflow(workflow.id, workflow.definition)
        
        logger.info(f"Created workflow: {workflow.id}")
        return workflow
    
    async def get_workflow(
        self,
        workflow_id: UUID,
        session: AsyncSession = None
    ) -> Optional[Workflow]:
        """Get workflow by ID"""
        
        if session is None:
            async with get_db_session() as session:
                return await self._get_workflow_impl(workflow_id, session)
        else:
            return await self._get_workflow_impl(workflow_id, session)
    
    async def _get_workflow_impl(
        self,
        workflow_id: UUID,
        session: AsyncSession
    ) -> Optional[Workflow]:
        """Internal workflow retrieval implementation"""
        
        result = await session.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        return result.scalar_one_or_none()
    
    async def list_workflows(
        self,
        user_id: UUID = None,
        is_template: bool = None,
        is_active: bool = True,
        limit: int = 100,
        offset: int = 0,
        session: AsyncSession = None
    ) -> List[Workflow]:
        """List workflows with filtering"""
        
        if session is None:
            async with get_db_session() as session:
                return await self._list_workflows_impl(
                    user_id, is_template, is_active, limit, offset, session
                )
        else:
            return await self._list_workflows_impl(
                user_id, is_template, is_active, limit, offset, session
            )
    
    async def _list_workflows_impl(
        self,
        user_id: UUID,
        is_template: bool,
        is_active: bool,
        limit: int,
        offset: int,
        session: AsyncSession
    ) -> List[Workflow]:
        """Internal workflow listing implementation"""
        
        query = select(Workflow)
        
        # Apply filters
        if user_id is not None:
            query = query.where(Workflow.created_by == user_id)
        if is_template is not None:
            query = query.where(Workflow.is_template == is_template)
        if is_active is not None:
            query = query.where(Workflow.is_active == is_active)
            
        query = query.order_by(Workflow.created_at.desc())
        query = query.limit(limit).offset(offset)
        
        result = await session.execute(query)
        return result.scalars().all()
    
    async def update_workflow(
        self,
        workflow_id: UUID,
        workflow_data: WorkflowUpdate,
        session: AsyncSession = None
    ) -> Optional[Workflow]:
        """Update existing workflow"""
        
        if session is None:
            async with get_db_session() as session:
                return await self._update_workflow_impl(workflow_id, workflow_data, session)
        else:
            return await self._update_workflow_impl(workflow_id, workflow_data, session)
    
    async def _update_workflow_impl(
        self,
        workflow_id: UUID,
        workflow_data: WorkflowUpdate,
        session: AsyncSession
    ) -> Optional[Workflow]:
        """Internal workflow update implementation"""
        
        # Get existing workflow
        workflow = await self._get_workflow_impl(workflow_id, session)
        if not workflow:
            return None
        
        # Update fields
        update_data = workflow_data.dict(exclude_unset=True)
        if update_data:
            # Validate new definition if provided
            if 'definition' in update_data:
                validation_result = await self.validator.validate_workflow(
                    WorkflowDefinition.parse_obj(update_data['definition'])
                )
                if not validation_result.is_valid:
                    raise ValueError(f"Invalid workflow definition: {validation_result.errors}")
            
            update_data['updated_at'] = datetime.utcnow()
            
            await session.execute(
                update(Workflow)
                .where(Workflow.id == workflow_id)
                .values(**update_data)
            )
            await session.commit()
            
            # Refresh workflow
            await session.refresh(workflow)
            
            # Update scheduling if definition changed
            if 'definition' in update_data:
                await self.scheduler.reschedule_workflow(workflow_id, workflow.definition)
        
        logger.info(f"Updated workflow: {workflow_id}")
        return workflow
    
    async def delete_workflow(
        self,
        workflow_id: UUID,
        session: AsyncSession = None
    ) -> bool:
        """Delete workflow (soft delete by marking inactive)"""
        
        if session is None:
            async with get_db_session() as session:
                return await self._delete_workflow_impl(workflow_id, session)
        else:
            return await self._delete_workflow_impl(workflow_id, session)
    
    async def _delete_workflow_impl(
        self,
        workflow_id: UUID,
        session: AsyncSession
    ) -> bool:
        """Internal workflow deletion implementation"""
        
        # Cancel any active executions
        await self.cancel_workflow_execution(workflow_id)
        
        # Unschedule workflow
        await self.scheduler.unschedule_workflow(workflow_id)
        
        # Soft delete (mark as inactive)
        result = await session.execute(
            update(Workflow)
            .where(Workflow.id == workflow_id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )
        
        await session.commit()
        
        success = result.rowcount > 0
        if success:
            logger.info(f"Deleted workflow: {workflow_id}")
        
        return success
    
    # Workflow Execution Methods
    
    async def execute_workflow(
        self,
        workflow_id: UUID,
        trigger_data: Dict[str, Any] = None,
        user_id: UUID = None
    ) -> WorkflowRun:
        """Execute workflow with given trigger data"""
        
        async with get_db_session() as session:
            # Get workflow
            workflow = await self._get_workflow_impl(workflow_id, session)
            if not workflow:
                raise ValueError(f"Workflow not found: {workflow_id}")
            
            if not workflow.is_active:
                raise ValueError(f"Workflow is not active: {workflow_id}")
            
            # Create workflow run
            workflow_run = WorkflowRun(
                id=uuid4(),
                workflow_id=workflow_id,
                status=WorkflowStatus.PENDING,
                trigger_data=trigger_data or {},
                started_at=datetime.utcnow(),
                created_by=user_id
            )
            
            session.add(workflow_run)
            await session.commit()
            await session.refresh(workflow_run)
        
        # Start execution asynchronously
        execution_task = asyncio.create_task(
            self._execute_workflow_async(workflow_run.id, workflow.definition)
        )
        
        # Track active execution
        self._active_executions[str(workflow_run.id)] = execution_task
        
        # Set up cleanup callback
        execution_task.add_done_callback(
            lambda t: self._cleanup_execution(str(workflow_run.id))
        )
        
        logger.info(f"Started workflow execution: {workflow_run.id}")
        return workflow_run
    
    async def _execute_workflow_async(
        self,
        workflow_run_id: UUID,
        workflow_definition: Dict[str, Any]
    ):
        """Asynchronous workflow execution implementation"""
        
        try:
            async with get_db_session() as session:
                # Update status to running
                await session.execute(
                    update(WorkflowRun)
                    .where(WorkflowRun.id == workflow_run_id)
                    .values(status=WorkflowStatus.RUNNING)
                )
                await session.commit()
            
            # Initialize workflow state
            await self.state_manager.initialize_workflow_state(workflow_run_id)
            
            # Execute workflow nodes
            await self._execute_workflow_nodes(workflow_run_id, workflow_definition)
            
            # Mark as completed
            async with get_db_session() as session:
                await session.execute(
                    update(WorkflowRun)
                    .where(WorkflowRun.id == workflow_run_id)
                    .values(
                        status=WorkflowStatus.COMPLETED,
                        completed_at=datetime.utcnow()
                    )
                )
                await session.commit()
            
            logger.info(f"Workflow execution completed: {workflow_run_id}")
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {workflow_run_id}, error: {str(e)}")
            
            # Mark as failed
            async with get_db_session() as session:
                await session.execute(
                    update(WorkflowRun)
                    .where(WorkflowRun.id == workflow_run_id)
                    .values(
                        status=WorkflowStatus.FAILED,
                        completed_at=datetime.utcnow(),
                        error={"error": str(e), "type": type(e).__name__}
                    )
                )
                await session.commit()
            
            raise
    
    async def _execute_workflow_nodes(
        self,
        workflow_run_id: UUID,
        workflow_definition: Dict[str, Any]
    ):
        """Execute workflow nodes in topological order"""
        
        nodes = workflow_definition.get('nodes', [])
        edges = workflow_definition.get('edges', [])
        
        # Build execution graph
        node_graph = self._build_execution_graph(nodes, edges)
        
        # Execute nodes in topological order
        executed_nodes = set()
        
        while len(executed_nodes) < len(nodes):
            # Find nodes ready for execution (all dependencies satisfied)
            ready_nodes = []
            for node in nodes:
                node_id = node['id']
                if node_id not in executed_nodes:
                    dependencies = node_graph.get(node_id, {}).get('dependencies', [])
                    if all(dep in executed_nodes for dep in dependencies):
                        ready_nodes.append(node)
            
            if not ready_nodes:
                raise RuntimeError("Circular dependency detected in workflow")
            
            # Execute ready nodes in parallel
            tasks = []
            for node in ready_nodes:
                task = self._execute_single_node(workflow_run_id, node)
                tasks.append(task)
            
            # Wait for all nodes to complete
            await asyncio.gather(*tasks)
            
            # Mark nodes as executed
            for node in ready_nodes:
                executed_nodes.add(node['id'])
    
    async def _execute_single_node(
        self,
        workflow_run_id: UUID,
        node: Dict[str, Any]
    ):
        """Execute a single workflow node"""
        
        node_id = node['id']
        node_type = node['type']
        node_config = node.get('config', {})
        
        try:
            # Get input data from previous nodes or workflow state
            input_data = await self.state_manager.get_node_input_data(
                workflow_run_id, node_id
            )
            
            # Create node execution record
            async with get_db_session() as session:
                node_execution = NodeExecution(
                    id=uuid4(),
                    workflow_run_id=workflow_run_id,
                    node_id=node_id,
                    node_type=node_type,
                    status="running",
                    input_data=input_data,
                    started_at=datetime.utcnow()
                )
                session.add(node_execution)
                await session.commit()
                await session.refresh(node_execution)
            
            # Execute node
            output_data = await self.node_executor.execute_node(
                node_type, node_config, input_data
            )
            
            # Save output data and update status
            async with get_db_session() as session:
                await session.execute(
                    update(NodeExecution)
                    .where(NodeExecution.id == node_execution.id)
                    .values(
                        status="completed",
                        output_data=output_data,
                        completed_at=datetime.utcnow()
                    )
                )
                await session.commit()
            
            # Update workflow state with node output
            await self.state_manager.save_node_output_data(
                workflow_run_id, node_id, output_data
            )
            
            logger.debug(f"Node execution completed: {node_id}")
            
        except Exception as e:
            logger.error(f"Node execution failed: {node_id}, error: {str(e)}")
            
            # Update node execution with error
            async with get_db_session() as session:
                await session.execute(
                    update(NodeExecution)
                    .where(NodeExecution.workflow_run_id == workflow_run_id)
                    .where(NodeExecution.node_id == node_id)
                    .values(
                        status="failed",
                        error={"error": str(e), "type": type(e).__name__},
                        completed_at=datetime.utcnow()
                    )
                )
                await session.commit()
            
            raise
    
    def _build_execution_graph(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """Build node execution graph from workflow definition"""
        
        graph = {}
        
        # Initialize nodes
        for node in nodes:
            node_id = node['id']
            graph[node_id] = {
                'node': node,
                'dependencies': [],
                'dependents': []
            }
        
        # Add edges
        for edge in edges:
            from_node = edge['from']
            to_node = edge['to']
            
            if from_node in graph and to_node in graph:
                graph[to_node]['dependencies'].append(from_node)
                graph[from_node]['dependents'].append(to_node)
        
        return graph
    
    def _has_schedule_triggers(self, workflow_definition: Dict[str, Any]) -> bool:
        """Check if workflow has schedule trigger nodes"""
        
        nodes = workflow_definition.get('nodes', [])
        for node in nodes:
            if node.get('type') == 'ScheduleTrigger':
                return True
        return False
    
    def _cleanup_execution(self, workflow_run_id: str):
        """Cleanup completed execution task"""
        
        if workflow_run_id in self._active_executions:
            del self._active_executions[workflow_run_id]
    
    # Execution Management Methods
    
    async def get_workflow_run(
        self,
        workflow_run_id: UUID,
        session: AsyncSession = None
    ) -> Optional[WorkflowRun]:
        """Get workflow run by ID"""
        
        if session is None:
            async with get_db_session() as session:
                return await self._get_workflow_run_impl(workflow_run_id, session)
        else:
            return await self._get_workflow_run_impl(workflow_run_id, session)
    
    async def _get_workflow_run_impl(
        self,
        workflow_run_id: UUID,
        session: AsyncSession
    ) -> Optional[WorkflowRun]:
        """Internal workflow run retrieval implementation"""
        
        result = await session.execute(
            select(WorkflowRun)
            .options(selectinload(WorkflowRun.node_executions))
            .where(WorkflowRun.id == workflow_run_id)
        )
        return result.scalar_one_or_none()
    
    async def cancel_workflow_execution(self, workflow_run_id: UUID) -> bool:
        """Cancel running workflow execution"""
        
        workflow_run_id_str = str(workflow_run_id)
        
        # Cancel execution task if running
        if workflow_run_id_str in self._active_executions:
            task = self._active_executions[workflow_run_id_str]
            task.cancel()
            
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        # Update status in database
        async with get_db_session() as session:
            result = await session.execute(
                update(WorkflowRun)
                .where(WorkflowRun.id == workflow_run_id)
                .where(WorkflowRun.status.in_([WorkflowStatus.PENDING, WorkflowStatus.RUNNING]))
                .values(
                    status=WorkflowStatus.CANCELLED,
                    completed_at=datetime.utcnow()
                )
            )
            await session.commit()
            
            success = result.rowcount > 0
            if success:
                logger.info(f"Cancelled workflow execution: {workflow_run_id}")
            
            return success
    
    async def get_active_executions(self) -> Dict[str, Dict[str, Any]]:
        """Get currently active workflow executions"""
        
        active_info = {}
        for workflow_run_id, task in self._active_executions.items():
            active_info[workflow_run_id] = {
                'status': 'running' if not task.done() else 'completed',
                'done': task.done(),
                'cancelled': task.cancelled() if task.done() else False
            }
        
        return active_info
    
    async def cleanup(self):
        """Cleanup resources and cancel active executions"""
        
        # Cancel all active executions
        for workflow_run_id, task in list(self._active_executions.items()):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        self._active_executions.clear()
        logger.info("WorkflowEngine cleanup completed")