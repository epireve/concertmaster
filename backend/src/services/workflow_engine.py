"""
Workflow Engine - Core execution engine for workflow orchestration
Handles workflow creation, execution, state management, and scheduling.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple
from uuid import uuid4, UUID
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from celery import current_app as celery_app

from ..database.connection import DatabaseManager
from ..models.workflow import Workflow, WorkflowRun, NodeExecution, WorkflowStatus, ExecutionStatus
from .state_manager import StateManager
from .node_executor import NodeExecutor
from .workflow_validator import WorkflowValidator
from ..config import settings

logger = logging.getLogger(__name__)


class ExecutionContext:
    """Execution context for workflow runs"""
    
    def __init__(self, workflow_run_id: UUID, workflow: Workflow, trigger_data: Dict[str, Any]):
        self.workflow_run_id = workflow_run_id
        self.workflow = workflow
        self.trigger_data = trigger_data
        self.state = {}
        self.node_outputs = {}
        self.execution_log = []
        
    def log(self, level: str, message: str, node_id: str = None):
        """Add log entry to execution context"""
        entry = {
            "timestamp": datetime.now(timezone.utc),
            "level": level,
            "message": message,
            "node_id": node_id
        }
        self.execution_log.append(entry)
        
    def set_node_output(self, node_id: str, output: Any):
        """Store node execution output"""
        self.node_outputs[node_id] = output
        
    def get_node_output(self, node_id: str) -> Any:
        """Get node execution output"""
        return self.node_outputs.get(node_id)


class WorkflowEngine:
    """Main workflow execution engine"""
    
    def __init__(self, db_manager: DatabaseManager, state_manager: StateManager):
        self.db_manager = db_manager
        self.state_manager = state_manager
        self.node_executor = NodeExecutor()
        self.validator = WorkflowValidator()
        self.active_executions: Dict[UUID, ExecutionContext] = {}
        
    async def create_workflow(
        self, 
        definition: Dict[str, Any], 
        name: str, 
        user_id: UUID,
        description: str = None
    ) -> Workflow:
        """Create new workflow from definition"""
        try:
            # Validate workflow definition
            validation_result = await self.validator.validate_workflow(definition)
            if not validation_result.is_valid:
                raise ValueError(f"Invalid workflow: {validation_result.errors}")
                
            async with self.db_manager.get_session() as session:
                workflow = Workflow(
                    id=uuid4(),
                    name=name,
                    description=description,
                    definition=definition,
                    created_by=user_id,
                    status=WorkflowStatus.DRAFT,
                    version=1
                )
                
                session.add(workflow)
                await session.commit()
                await session.refresh(workflow)
                
                logger.info(f"Created workflow {workflow.id}: {name}")
                return workflow
                
        except Exception as e:
            logger.error(f"Failed to create workflow: {e}")
            raise
    
    async def update_workflow(
        self,
        workflow_id: UUID,
        definition: Dict[str, Any] = None,
        name: str = None,
        description: str = None,
        status: WorkflowStatus = None
    ) -> Workflow:
        """Update existing workflow"""
        try:
            async with self.db_manager.get_session() as session:
                # Get existing workflow
                result = await session.execute(
                    select(Workflow).where(Workflow.id == workflow_id)
                )
                workflow = result.scalar_one_or_none()
                
                if not workflow:
                    raise ValueError(f"Workflow {workflow_id} not found")
                
                # Update fields
                if definition is not None:
                    validation_result = await self.validator.validate_workflow(definition)
                    if not validation_result.is_valid:
                        raise ValueError(f"Invalid workflow: {validation_result.errors}")
                    workflow.definition = definition
                    workflow.version += 1
                    
                if name is not None:
                    workflow.name = name
                    
                if description is not None:
                    workflow.description = description
                    
                if status is not None:
                    workflow.status = status
                    
                workflow.updated_at = datetime.now(timezone.utc)
                
                await session.commit()
                await session.refresh(workflow)
                
                logger.info(f"Updated workflow {workflow_id}")
                return workflow
                
        except Exception as e:
            logger.error(f"Failed to update workflow {workflow_id}: {e}")
            raise
    
    async def execute_workflow(
        self,
        workflow_id: UUID,
        trigger_data: Dict[str, Any] = None,
        user_id: UUID = None
    ) -> WorkflowRun:
        """Execute workflow with given trigger data"""
        try:
            async with self.db_manager.get_session() as session:
                # Get workflow
                result = await session.execute(
                    select(Workflow).where(Workflow.id == workflow_id)
                )
                workflow = result.scalar_one_or_none()
                
                if not workflow:
                    raise ValueError(f"Workflow {workflow_id} not found")
                
                if workflow.status != WorkflowStatus.ACTIVE:
                    raise ValueError(f"Workflow {workflow_id} is not active")
                
                # Create workflow run
                workflow_run = WorkflowRun(
                    id=uuid4(),
                    workflow_id=workflow_id,
                    status=ExecutionStatus.RUNNING,
                    trigger_data=trigger_data or {},
                    started_by=user_id,
                    started_at=datetime.now(timezone.utc)
                )
                
                session.add(workflow_run)
                await session.commit()
                await session.refresh(workflow_run)
                
                # Start async execution
                asyncio.create_task(
                    self._execute_workflow_async(workflow_run.id, workflow, trigger_data or {})
                )
                
                logger.info(f"Started workflow execution {workflow_run.id}")
                return workflow_run
                
        except Exception as e:
            logger.error(f"Failed to execute workflow {workflow_id}: {e}")
            raise
    
    async def _execute_workflow_async(
        self,
        workflow_run_id: UUID,
        workflow: Workflow,
        trigger_data: Dict[str, Any]
    ):
        """Async workflow execution"""
        context = ExecutionContext(workflow_run_id, workflow, trigger_data)
        self.active_executions[workflow_run_id] = context
        
        try:
            context.log("info", "Starting workflow execution")
            
            # Get workflow definition
            definition = workflow.definition
            nodes = definition.get("nodes", [])
            edges = definition.get("edges", [])
            
            # Build execution graph
            execution_graph = self._build_execution_graph(nodes, edges)
            
            # Execute nodes in topological order
            await self._execute_nodes(context, execution_graph, nodes)
            
            # Mark workflow as completed
            await self._complete_workflow_run(workflow_run_id, ExecutionStatus.COMPLETED)
            context.log("info", "Workflow execution completed successfully")
            
        except Exception as e:
            logger.error(f"Workflow execution {workflow_run_id} failed: {e}")
            context.log("error", f"Workflow execution failed: {str(e)}")
            await self._complete_workflow_run(workflow_run_id, ExecutionStatus.FAILED, str(e))
            
        finally:
            # Clean up
            if workflow_run_id in self.active_executions:
                del self.active_executions[workflow_run_id]
    
    def _build_execution_graph(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, List[str]]:
        """Build execution graph from workflow definition"""
        graph = {node["id"]: [] for node in nodes}
        
        for edge in edges:
            from_node = edge["from"]
            to_node = edge["to"]
            
            if from_node in graph:
                graph[from_node].append(to_node)
        
        return graph
    
    def _topological_sort(self, graph: Dict[str, List[str]], nodes: List[Dict]) -> List[str]:
        """Sort nodes in topological order for execution"""
        # Find trigger nodes (no incoming edges)
        incoming = {node["id"]: 0 for node in nodes}
        for node_id, neighbors in graph.items():
            for neighbor in neighbors:
                incoming[neighbor] += 1
        
        # Start with nodes that have no dependencies
        queue = [node_id for node_id, count in incoming.items() if count == 0]
        result = []
        
        while queue:
            node_id = queue.pop(0)
            result.append(node_id)
            
            # Remove edges from this node
            for neighbor in graph[node_id]:
                incoming[neighbor] -= 1
                if incoming[neighbor] == 0:
                    queue.append(neighbor)
        
        return result
    
    async def _execute_nodes(
        self,
        context: ExecutionContext,
        graph: Dict[str, List[str]],
        nodes: List[Dict]
    ):
        """Execute nodes in topological order"""
        node_dict = {node["id"]: node for node in nodes}
        execution_order = self._topological_sort(graph, nodes)
        
        for node_id in execution_order:
            if node_id not in node_dict:
                continue
                
            node = node_dict[node_id]
            
            try:
                context.log("info", f"Executing node {node_id}", node_id)
                
                # Prepare input data
                input_data = self._prepare_node_input(context, node, graph)
                
                # Execute node
                output = await self.node_executor.execute_node(
                    node["type"],
                    node.get("config", {}),
                    input_data
                )
                
                # Store output
                context.set_node_output(node_id, output)
                
                # Save node execution to database
                await self._save_node_execution(
                    context.workflow_run_id,
                    node_id,
                    ExecutionStatus.COMPLETED,
                    input_data,
                    output
                )
                
                context.log("info", f"Node {node_id} completed successfully", node_id)
                
            except Exception as e:
                logger.error(f"Node {node_id} execution failed: {e}")
                context.log("error", f"Node {node_id} execution failed: {str(e)}", node_id)
                
                await self._save_node_execution(
                    context.workflow_run_id,
                    node_id,
                    ExecutionStatus.FAILED,
                    {},
                    None,
                    str(e)
                )
                
                # Stop execution on node failure
                raise
    
    def _prepare_node_input(
        self,
        context: ExecutionContext,
        node: Dict,
        graph: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """Prepare input data for node execution"""
        input_data = {
            "trigger_data": context.trigger_data,
            "workflow_state": context.state
        }
        
        # Add outputs from previous nodes
        node_id = node["id"]
        for other_node_id, neighbors in graph.items():
            if node_id in neighbors:
                output = context.get_node_output(other_node_id)
                if output is not None:
                    input_data[f"node_{other_node_id}"] = output
        
        return input_data
    
    async def _save_node_execution(
        self,
        workflow_run_id: UUID,
        node_id: str,
        status: ExecutionStatus,
        input_data: Dict[str, Any],
        output_data: Any = None,
        error: str = None
    ):
        """Save node execution to database"""
        try:
            async with self.db_manager.get_session() as session:
                node_execution = NodeExecution(
                    id=uuid4(),
                    workflow_run_id=workflow_run_id,
                    node_id=node_id,
                    status=status,
                    input_data=input_data,
                    output_data=output_data,
                    error=error,
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc) if status != ExecutionStatus.RUNNING else None
                )
                
                session.add(node_execution)
                await session.commit()
                
        except Exception as e:
            logger.error(f"Failed to save node execution: {e}")
    
    async def _complete_workflow_run(
        self,
        workflow_run_id: UUID,
        status: ExecutionStatus,
        error: str = None
    ):
        """Mark workflow run as completed"""
        try:
            async with self.db_manager.get_session() as session:
                await session.execute(
                    update(WorkflowRun)
                    .where(WorkflowRun.id == workflow_run_id)
                    .values(
                        status=status,
                        error=error,
                        completed_at=datetime.now(timezone.utc)
                    )
                )
                await session.commit()
                
        except Exception as e:
            logger.error(f"Failed to complete workflow run: {e}")
    
    async def get_workflow_status(self, workflow_run_id: UUID) -> Optional[Dict[str, Any]]:
        """Get workflow execution status"""
        try:
            async with self.db_manager.get_session() as session:
                result = await session.execute(
                    select(WorkflowRun).where(WorkflowRun.id == workflow_run_id)
                )
                workflow_run = result.scalar_one_or_none()
                
                if not workflow_run:
                    return None
                
                # Get node executions
                node_result = await session.execute(
                    select(NodeExecution)
                    .where(NodeExecution.workflow_run_id == workflow_run_id)
                    .order_by(NodeExecution.started_at)
                )
                node_executions = node_result.scalars().all()
                
                return {
                    "workflow_run_id": workflow_run.id,
                    "workflow_id": workflow_run.workflow_id,
                    "status": workflow_run.status,
                    "started_at": workflow_run.started_at,
                    "completed_at": workflow_run.completed_at,
                    "error": workflow_run.error,
                    "node_executions": [
                        {
                            "node_id": ne.node_id,
                            "status": ne.status,
                            "started_at": ne.started_at,
                            "completed_at": ne.completed_at,
                            "error": ne.error
                        }
                        for ne in node_executions
                    ]
                }
                
        except Exception as e:
            logger.error(f"Failed to get workflow status: {e}")
            return None
    
    async def stop_workflow(self, workflow_run_id: UUID) -> bool:
        """Stop running workflow"""
        try:
            if workflow_run_id in self.active_executions:
                context = self.active_executions[workflow_run_id]
                context.log("info", "Workflow execution stopped by user")
                
                # Mark as cancelled
                await self._complete_workflow_run(workflow_run_id, ExecutionStatus.CANCELLED)
                
                # Clean up
                del self.active_executions[workflow_run_id]
                
                logger.info(f"Stopped workflow execution {workflow_run_id}")
                return True
                
            return False
            
        except Exception as e:
            logger.error(f"Failed to stop workflow: {e}")
            return False