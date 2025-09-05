"""
ConcertMaster State Management System
Manages workflow execution state, node data flow, and persistence
"""

from typing import Dict, Any, Optional, List, Union
from uuid import UUID
import json
import asyncio
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from ..config import settings
from ..database.connection import get_db_session
from ..models.workflow import WorkflowState, NodeState

logger = logging.getLogger(__name__)

class StateScope(str, Enum):
    """State scope levels"""
    WORKFLOW = "workflow"  # Entire workflow instance
    NODE = "node"         # Individual node execution
    GLOBAL = "global"     # Cross-workflow shared state

@dataclass
class StateKey:
    """Structured state key for consistent access"""
    workflow_run_id: str
    scope: StateScope
    node_id: Optional[str] = None
    key: Optional[str] = None
    
    def __str__(self) -> str:
        parts = [self.scope.value, self.workflow_run_id]
        if self.node_id:
            parts.append(self.node_id)
        if self.key:
            parts.append(self.key)
        return ":".join(parts)

class StateManager:
    """
    Manages workflow execution state with Redis caching and PostgreSQL persistence
    
    Features:
    - Fast Redis-based state access
    - PostgreSQL persistence for durability
    - Automatic cleanup of expired state
    - Node input/output data management
    - Workflow variable storage
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.default_ttl = settings.CACHE_TTL
        self._lock = asyncio.Lock()
        
        logger.info("StateManager initialized")
    
    async def initialize(self):
        """Initialize Redis connection"""
        if not self.redis_client:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                encoding="utf-8"
            )
            await self.redis_client.ping()
            logger.info("StateManager Redis connection established")
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            self.redis_client = None
            logger.info("StateManager Redis connection closed")
    
    # Workflow State Management
    
    async def initialize_workflow_state(
        self,
        workflow_run_id: UUID,
        initial_data: Dict[str, Any] = None
    ):
        """Initialize state for a new workflow execution"""
        
        workflow_run_id_str = str(workflow_run_id)
        
        # Initialize workflow state
        workflow_state = {
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "variables": initial_data or {},
            "node_outputs": {},
            "execution_path": []
        }
        
        # Store in Redis
        state_key = StateKey(workflow_run_id_str, StateScope.WORKFLOW)
        await self._set_redis_state(str(state_key), workflow_state)
        
        # Store in database
        async with get_db_session() as session:
            db_state = WorkflowState(
                workflow_run_id=workflow_run_id,
                state_data=workflow_state,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(db_state)
            await session.commit()
        
        logger.info(f"Initialized workflow state: {workflow_run_id}")
    
    async def get_workflow_state(
        self,
        workflow_run_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get current workflow state"""
        
        workflow_run_id_str = str(workflow_run_id)
        state_key = StateKey(workflow_run_id_str, StateScope.WORKFLOW)
        
        # Try Redis first
        state = await self._get_redis_state(str(state_key))
        if state:
            return state
        
        # Fallback to database
        async with get_db_session() as session:
            result = await session.execute(
                select(WorkflowState).where(
                    WorkflowState.workflow_run_id == workflow_run_id
                )
            )
            db_state = result.scalar_one_or_none()
            
            if db_state:
                # Cache in Redis
                await self._set_redis_state(str(state_key), db_state.state_data)
                return db_state.state_data
        
        return None
    
    async def update_workflow_state(
        self,
        workflow_run_id: UUID,
        updates: Dict[str, Any]
    ):
        """Update workflow state"""
        
        workflow_run_id_str = str(workflow_run_id)
        state_key = StateKey(workflow_run_id_str, StateScope.WORKFLOW)
        
        async with self._lock:
            # Get current state
            current_state = await self.get_workflow_state(workflow_run_id) or {}
            
            # Apply updates
            updated_state = {**current_state, **updates}
            updated_state["updated_at"] = datetime.utcnow().isoformat()
            
            # Store in Redis
            await self._set_redis_state(str(state_key), updated_state)
            
            # Store in database
            async with get_db_session() as session:
                await session.execute(
                    update(WorkflowState)
                    .where(WorkflowState.workflow_run_id == workflow_run_id)
                    .values(
                        state_data=updated_state,
                        updated_at=datetime.utcnow()
                    )
                )
                await session.commit()
        
        logger.debug(f"Updated workflow state: {workflow_run_id}")
    
    # Node State Management
    
    async def save_node_output_data(
        self,
        workflow_run_id: UUID,
        node_id: str,
        output_data: Dict[str, Any]
    ):
        """Save node output data for use by subsequent nodes"""
        
        workflow_run_id_str = str(workflow_run_id)
        
        # Store node output
        node_state_key = StateKey(workflow_run_id_str, StateScope.NODE, node_id, "output")
        await self._set_redis_state(str(node_state_key), output_data)
        
        # Update workflow state with node output
        workflow_state = await self.get_workflow_state(workflow_run_id) or {}
        node_outputs = workflow_state.get("node_outputs", {})
        node_outputs[node_id] = output_data
        
        await self.update_workflow_state(workflow_run_id, {
            "node_outputs": node_outputs
        })
        
        # Store in database
        async with get_db_session() as session:
            node_state = NodeState(
                workflow_run_id=workflow_run_id,
                node_id=node_id,
                state_type="output",
                state_data=output_data,
                created_at=datetime.utcnow()
            )
            session.add(node_state)
            await session.commit()
        
        logger.debug(f"Saved node output: {workflow_run_id}:{node_id}")
    
    async def get_node_input_data(
        self,
        workflow_run_id: UUID,
        node_id: str
    ) -> Dict[str, Any]:
        """Get input data for a node based on workflow configuration"""
        
        workflow_run_id_str = str(workflow_run_id)
        
        # Get workflow state
        workflow_state = await self.get_workflow_state(workflow_run_id)
        if not workflow_state:
            return {}
        
        # Build input data from previous node outputs and workflow variables
        input_data = {
            # Include workflow variables
            "workflow": {
                "variables": workflow_state.get("variables", {}),
                "run_id": workflow_run_id_str,
                "status": workflow_state.get("status", "unknown")
            },
            # Include all previous node outputs
            "nodes": workflow_state.get("node_outputs", {})
        }
        
        # Add trigger data if this is the first node
        if "trigger_data" in workflow_state:
            input_data["trigger"] = workflow_state["trigger_data"]
        
        return input_data
    
    async def save_node_state(
        self,
        workflow_run_id: UUID,
        node_id: str,
        state_type: str,
        state_data: Dict[str, Any]
    ):
        """Save arbitrary node state data"""
        
        workflow_run_id_str = str(workflow_run_id)
        
        # Store in Redis
        state_key = StateKey(workflow_run_id_str, StateScope.NODE, node_id, state_type)
        await self._set_redis_state(str(state_key), state_data)
        
        # Store in database
        async with get_db_session() as session:
            node_state = NodeState(
                workflow_run_id=workflow_run_id,
                node_id=node_id,
                state_type=state_type,
                state_data=state_data,
                created_at=datetime.utcnow()
            )
            session.add(node_state)
            await session.commit()
        
        logger.debug(f"Saved node state: {workflow_run_id}:{node_id}:{state_type}")
    
    async def get_node_state(
        self,
        workflow_run_id: UUID,
        node_id: str,
        state_type: str
    ) -> Optional[Dict[str, Any]]:
        """Get node state data"""
        
        workflow_run_id_str = str(workflow_run_id)
        state_key = StateKey(workflow_run_id_str, StateScope.NODE, node_id, state_type)
        
        # Try Redis first
        state = await self._get_redis_state(str(state_key))
        if state:
            return state
        
        # Fallback to database
        async with get_db_session() as session:
            result = await session.execute(
                select(NodeState).where(
                    NodeState.workflow_run_id == workflow_run_id,
                    NodeState.node_id == node_id,
                    NodeState.state_type == state_type
                )
            )
            db_state = result.scalar_one_or_none()
            
            if db_state:
                # Cache in Redis
                await self._set_redis_state(str(state_key), db_state.state_data)
                return db_state.state_data
        
        return None
    
    # Variable Management
    
    async def set_workflow_variable(
        self,
        workflow_run_id: UUID,
        variable_name: str,
        value: Any
    ):
        """Set a workflow variable"""
        
        workflow_state = await self.get_workflow_state(workflow_run_id) or {}
        variables = workflow_state.get("variables", {})
        variables[variable_name] = value
        
        await self.update_workflow_state(workflow_run_id, {
            "variables": variables
        })
        
        logger.debug(f"Set workflow variable: {workflow_run_id}:{variable_name}")
    
    async def get_workflow_variable(
        self,
        workflow_run_id: UUID,
        variable_name: str,
        default: Any = None
    ) -> Any:
        """Get a workflow variable"""
        
        workflow_state = await self.get_workflow_state(workflow_run_id)
        if not workflow_state:
            return default
        
        variables = workflow_state.get("variables", {})
        return variables.get(variable_name, default)
    
    async def set_global_variable(
        self,
        variable_name: str,
        value: Any,
        ttl: int = None
    ):
        """Set a global variable (shared across workflows)"""
        
        state_key = StateKey("global", StateScope.GLOBAL, None, variable_name)
        await self._set_redis_state(str(state_key), value, ttl or self.default_ttl)
        
        logger.debug(f"Set global variable: {variable_name}")
    
    async def get_global_variable(
        self,
        variable_name: str,
        default: Any = None
    ) -> Any:
        """Get a global variable"""
        
        state_key = StateKey("global", StateScope.GLOBAL, None, variable_name)
        value = await self._get_redis_state(str(state_key))
        return value if value is not None else default
    
    # Execution Path Tracking
    
    async def add_execution_step(
        self,
        workflow_run_id: UUID,
        node_id: str,
        step_data: Dict[str, Any] = None
    ):
        """Add a step to the workflow execution path"""
        
        workflow_state = await self.get_workflow_state(workflow_run_id) or {}
        execution_path = workflow_state.get("execution_path", [])
        
        step = {
            "node_id": node_id,
            "timestamp": datetime.utcnow().isoformat(),
            "data": step_data or {}
        }
        execution_path.append(step)
        
        await self.update_workflow_state(workflow_run_id, {
            "execution_path": execution_path
        })
    
    async def get_execution_path(
        self,
        workflow_run_id: UUID
    ) -> List[Dict[str, Any]]:
        """Get the workflow execution path"""
        
        workflow_state = await self.get_workflow_state(workflow_run_id)
        if not workflow_state:
            return []
        
        return workflow_state.get("execution_path", [])
    
    # State Cleanup
    
    async def cleanup_workflow_state(
        self,
        workflow_run_id: UUID
    ):
        """Clean up all state data for a workflow"""
        
        workflow_run_id_str = str(workflow_run_id)
        
        # Clean up Redis keys
        pattern = f"*:{workflow_run_id_str}:*"
        async for key in self.redis_client.scan_iter(match=pattern):
            await self.redis_client.delete(key)
        
        # Remove workflow state key
        workflow_state_key = StateKey(workflow_run_id_str, StateScope.WORKFLOW)
        await self.redis_client.delete(str(workflow_state_key))
        
        # Clean up database records (optional - may want to keep for audit)
        # async with get_db_session() as session:
        #     await session.execute(
        #         delete(WorkflowState).where(
        #             WorkflowState.workflow_run_id == workflow_run_id
        #         )
        #     )
        #     await session.execute(
        #         delete(NodeState).where(
        #             NodeState.workflow_run_id == workflow_run_id
        #         )
        #     )
        #     await session.commit()
        
        logger.info(f"Cleaned up workflow state: {workflow_run_id}")
    
    async def cleanup_expired_state(self, max_age_days: int = 30):
        """Clean up expired state data"""
        
        cutoff_date = datetime.utcnow() - timedelta(days=max_age_days)
        
        async with get_db_session() as session:
            # Clean up old workflow states
            await session.execute(
                delete(WorkflowState).where(
                    WorkflowState.updated_at < cutoff_date
                )
            )
            
            # Clean up old node states
            await session.execute(
                delete(NodeState).where(
                    NodeState.created_at < cutoff_date
                )
            )
            
            await session.commit()
        
        logger.info(f"Cleaned up expired state data older than {max_age_days} days")
    
    # Redis Helper Methods
    
    async def _set_redis_state(
        self,
        key: str,
        value: Any,
        ttl: int = None
    ):
        """Set state in Redis with optional TTL"""
        
        if not self.redis_client:
            await self.initialize()
        
        serialized_value = json.dumps(value, default=str)
        
        if ttl:
            await self.redis_client.setex(key, ttl, serialized_value)
        else:
            await self.redis_client.set(key, serialized_value)
    
    async def _get_redis_state(self, key: str) -> Optional[Any]:
        """Get state from Redis"""
        
        if not self.redis_client:
            await self.initialize()
        
        value = await self.redis_client.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                logger.error(f"Failed to deserialize state for key: {key}")
                return None
        
        return None
    
    # Health Check and Statistics
    
    async def health_check(self) -> Dict[str, Any]:
        """Check state manager health"""
        
        try:
            if not self.redis_client:
                await self.initialize()
            
            # Test Redis connection
            await self.redis_client.ping()
            redis_status = "healthy"
        except Exception as e:
            redis_status = f"unhealthy: {str(e)}"
        
        # Get Redis info
        try:
            info = await self.redis_client.info()
            redis_memory = info.get('used_memory_human', 'unknown')
            redis_connected_clients = info.get('connected_clients', 'unknown')
        except Exception:
            redis_memory = 'unknown'
            redis_connected_clients = 'unknown'
        
        return {
            "redis_status": redis_status,
            "redis_memory": redis_memory,
            "redis_connected_clients": redis_connected_clients
        }
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get state manager statistics"""
        
        try:
            if not self.redis_client:
                await self.initialize()
            
            # Count workflow states
            workflow_state_count = 0
            async for key in self.redis_client.scan_iter(match="workflow:*"):
                workflow_state_count += 1
            
            # Count node states
            node_state_count = 0
            async for key in self.redis_client.scan_iter(match="node:*"):
                node_state_count += 1
            
            # Get database counts
            async with get_db_session() as session:
                workflow_state_db_result = await session.execute(
                    select(WorkflowState.id).count()
                )
                workflow_state_db_count = workflow_state_db_result.scalar()
                
                node_state_db_result = await session.execute(
                    select(NodeState.id).count()
                )
                node_state_db_count = node_state_db_result.scalar()
            
            return {
                "redis_workflow_states": workflow_state_count,
                "redis_node_states": node_state_count,
                "db_workflow_states": workflow_state_db_count,
                "db_node_states": node_state_db_count
            }
            
        except Exception as e:
            logger.error(f"Failed to get state manager stats: {str(e)}")
            return {
                "error": str(e)
            }