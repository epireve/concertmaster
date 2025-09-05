"""
ConcertMaster Node Execution System
Node registry and execution engine for workflow nodes
"""

from typing import Dict, Any, Type, Optional, List
from abc import ABC, abstractmethod
import logging
import asyncio
import json
from datetime import datetime
from uuid import uuid4

from ..schemas.node import NodeConfig, NodeResult
from .cache_manager import CacheManager

logger = logging.getLogger(__name__)

class BaseNode(ABC):
    """Base class for all workflow nodes"""
    
    # Node metadata
    node_type: str = "base"
    node_category: str = "base"
    description: str = ""
    version: str = "1.0.0"
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize node with configuration"""
        self.config = config
        self.node_id = config.get('id', str(uuid4()))
        self.cache = CacheManager()
    
    @abstractmethod
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the node logic
        
        Args:
            input_data: Data from previous nodes or workflow trigger
            
        Returns:
            Output data to pass to next nodes
        """
        pass
    
    async def validate_config(self) -> List[str]:
        """
        Validate node configuration
        
        Returns:
            List of validation errors (empty if valid)
        """
        return []
    
    async def get_schema(self) -> Dict[str, Any]:
        """
        Get node configuration schema
        
        Returns:
            JSON schema for node configuration
        """
        return {
            "type": "object",
            "properties": {},
            "required": []
        }
    
    def log(self, level: str, message: str, **kwargs):
        """Log node execution events"""
        logger_method = getattr(logger, level.lower(), logger.info)
        logger_method(f"[{self.node_type}:{self.node_id}] {message}", extra=kwargs)


class TriggerNode(BaseNode):
    """Base class for trigger nodes that start workflows"""
    
    node_category = "trigger"
    
    async def should_trigger(self, context: Dict[str, Any]) -> bool:
        """
        Check if the trigger condition is met
        
        Args:
            context: Current workflow context
            
        Returns:
            True if workflow should be triggered
        """
        return True


class TransformNode(BaseNode):
    """Base class for data transformation nodes"""
    
    node_category = "transform"


class OutputNode(BaseNode):
    """Base class for output/destination nodes"""
    
    node_category = "output"


class LogicNode(BaseNode):
    """Base class for logic/control flow nodes"""
    
    node_category = "logic"


class NodeRegistry:
    """Registry for managing available workflow node types"""
    
    def __init__(self):
        self._nodes: Dict[str, Type[BaseNode]] = {}
        self._register_core_nodes()
    
    def register(self, node_class: Type[BaseNode]):
        """Register a node class"""
        node_type = getattr(node_class, 'node_type', None)
        if not node_type:
            raise ValueError(f"Node class {node_class.__name__} must have node_type attribute")
        
        self._nodes[node_type] = node_class
        logger.info(f"Registered node type: {node_type}")
    
    def get(self, node_type: str) -> Optional[Type[BaseNode]]:
        """Get node class by type"""
        return self._nodes.get(node_type)
    
    def list_types(self) -> List[str]:
        """List all registered node types"""
        return list(self._nodes.keys())
    
    def get_nodes_by_category(self, category: str) -> List[str]:
        """Get all node types in a category"""
        return [
            node_type for node_type, node_class in self._nodes.items()
            if getattr(node_class, 'node_category', '') == category
        ]
    
    def get_node_info(self, node_type: str) -> Optional[Dict[str, Any]]:
        """Get node information"""
        node_class = self.get(node_type)
        if not node_class:
            return None
        
        return {
            "type": node_type,
            "category": getattr(node_class, 'node_category', 'unknown'),
            "description": getattr(node_class, 'description', ''),
            "version": getattr(node_class, 'version', '1.0.0'),
            "class_name": node_class.__name__
        }
    
    def _register_core_nodes(self):
        """Register core built-in node types"""
        from ..nodes.trigger_nodes import (
            ScheduleTriggerNode, FormTriggerNode, WebhookTriggerNode, EmailTriggerNode
        )
        from ..nodes.transform_nodes import (
            DataMapperNode, CalculatorNode, AggregatorNode
        )
        from ..nodes.logic_nodes import (
            ConditionalNode, LoopNode, WaitNode
        )
        from ..nodes.output_nodes import (
            DatabaseWriteNode, APICallNode, ERPExportNode
        )
        
        # Register trigger nodes
        self.register(ScheduleTriggerNode)
        self.register(FormTriggerNode)
        self.register(WebhookTriggerNode)
        self.register(EmailTriggerNode)
        
        # Register transform nodes
        self.register(DataMapperNode)
        self.register(CalculatorNode)
        self.register(AggregatorNode)
        
        # Register logic nodes
        self.register(ConditionalNode)
        self.register(LoopNode)
        self.register(WaitNode)
        
        # Register output nodes
        self.register(DatabaseWriteNode)
        self.register(APICallNode)
        self.register(ERPExportNode)


class NodeExecutor:
    """
    Node execution engine that handles node instantiation and execution
    """
    
    def __init__(self):
        self.registry = NodeRegistry()
        self.execution_history: List[Dict[str, Any]] = []
        self._execution_lock = asyncio.Lock()
        
        logger.info("NodeExecutor initialized")
    
    async def execute_node(
        self,
        node_type: str,
        config: Dict[str, Any],
        input_data: Dict[str, Any],
        timeout: float = 300.0
    ) -> Dict[str, Any]:
        """
        Execute a node with the given configuration and input data
        
        Args:
            node_type: Type of node to execute
            config: Node configuration
            input_data: Input data for the node
            timeout: Execution timeout in seconds
            
        Returns:
            Node output data
            
        Raises:
            ValueError: If node type is not registered
            TimeoutError: If execution exceeds timeout
        """
        
        async with self._execution_lock:
            # Get node class
            node_class = self.registry.get(node_type)
            if not node_class:
                raise ValueError(f"Unknown node type: {node_type}")
            
            # Create node instance
            node = node_class(config)
            
            # Validate configuration
            validation_errors = await node.validate_config()
            if validation_errors:
                raise ValueError(f"Node configuration invalid: {validation_errors}")
            
            # Record execution start
            execution_id = str(uuid4())
            execution_record = {
                "execution_id": execution_id,
                "node_type": node_type,
                "node_id": config.get('id', 'unknown'),
                "started_at": datetime.utcnow().isoformat(),
                "status": "running"
            }
            self.execution_history.append(execution_record)
            
            try:
                # Execute node with timeout
                node.log("info", f"Starting execution with input: {len(str(input_data))} chars")
                
                output_data = await asyncio.wait_for(
                    node.execute(input_data),
                    timeout=timeout
                )
                
                # Validate output
                if not isinstance(output_data, dict):
                    raise ValueError(f"Node output must be a dictionary, got {type(output_data)}")
                
                # Record successful execution
                execution_record.update({
                    "status": "completed",
                    "completed_at": datetime.utcnow().isoformat(),
                    "output_size": len(str(output_data))
                })
                
                node.log("info", f"Execution completed, output: {len(str(output_data))} chars")
                
                return output_data
                
            except asyncio.TimeoutError:
                execution_record.update({
                    "status": "timeout",
                    "completed_at": datetime.utcnow().isoformat(),
                    "error": f"Execution timed out after {timeout} seconds"
                })
                node.log("error", f"Execution timed out after {timeout} seconds")
                raise TimeoutError(f"Node execution timed out after {timeout} seconds")
                
            except Exception as e:
                execution_record.update({
                    "status": "failed",
                    "completed_at": datetime.utcnow().isoformat(),
                    "error": str(e),
                    "error_type": type(e).__name__
                })
                node.log("error", f"Execution failed: {str(e)}")
                raise
    
    async def validate_node_config(
        self,
        node_type: str,
        config: Dict[str, Any]
    ) -> List[str]:
        """
        Validate node configuration without executing
        
        Args:
            node_type: Type of node to validate
            config: Node configuration to validate
            
        Returns:
            List of validation errors (empty if valid)
        """
        
        node_class = self.registry.get(node_type)
        if not node_class:
            return [f"Unknown node type: {node_type}"]
        
        try:
            node = node_class(config)
            return await node.validate_config()
        except Exception as e:
            return [f"Failed to create node instance: {str(e)}"]
    
    async def get_node_schema(self, node_type: str) -> Optional[Dict[str, Any]]:
        """
        Get configuration schema for a node type
        
        Args:
            node_type: Type of node
            
        Returns:
            JSON schema for node configuration
        """
        
        node_class = self.registry.get(node_type)
        if not node_class:
            return None
        
        try:
            # Create temporary instance to get schema
            temp_config = {"id": "temp"}
            node = node_class(temp_config)
            return await node.get_schema()
        except Exception as e:
            logger.error(f"Failed to get schema for {node_type}: {str(e)}")
            return None
    
    def get_available_nodes(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all available nodes organized by category
        
        Returns:
            Dictionary of node categories with node information
        """
        
        nodes_by_category = {}
        
        for node_type in self.registry.list_types():
            node_info = self.registry.get_node_info(node_type)
            if node_info:
                category = node_info['category']
                if category not in nodes_by_category:
                    nodes_by_category[category] = []
                nodes_by_category[category].append(node_info)
        
        return nodes_by_category
    
    def get_execution_history(
        self,
        limit: int = 100,
        status: str = None
    ) -> List[Dict[str, Any]]:
        """
        Get node execution history
        
        Args:
            limit: Maximum number of records to return
            status: Filter by execution status
            
        Returns:
            List of execution records
        """
        
        history = self.execution_history.copy()
        
        if status:
            history = [record for record in history if record.get('status') == status]
        
        # Sort by start time (most recent first)
        history.sort(key=lambda x: x.get('started_at', ''), reverse=True)
        
        return history[:limit]
    
    def get_execution_stats(self) -> Dict[str, Any]:
        """
        Get execution statistics
        
        Returns:
            Dictionary with execution statistics
        """
        
        total = len(self.execution_history)
        if total == 0:
            return {
                "total_executions": 0,
                "completed": 0,
                "failed": 0,
                "timeout": 0,
                "success_rate": 0.0
            }
        
        completed = sum(1 for record in self.execution_history if record.get('status') == 'completed')
        failed = sum(1 for record in self.execution_history if record.get('status') == 'failed')
        timeout = sum(1 for record in self.execution_history if record.get('status') == 'timeout')
        
        return {
            "total_executions": total,
            "completed": completed,
            "failed": failed,
            "timeout": timeout,
            "success_rate": completed / total if total > 0 else 0.0
        }
    
    def register_node(self, node_class: Type[BaseNode]):
        """Register a custom node class"""
        self.registry.register(node_class)
    
    def clear_history(self):
        """Clear execution history"""
        self.execution_history.clear()
        logger.info("Execution history cleared")


# Node execution result wrapper
class NodeExecutionResult:
    """Wrapper for node execution results with metadata"""
    
    def __init__(
        self,
        data: Dict[str, Any],
        node_type: str,
        node_id: str,
        execution_time: float = None,
        metadata: Dict[str, Any] = None
    ):
        self.data = data
        self.node_type = node_type
        self.node_id = node_id
        self.execution_time = execution_time
        self.metadata = metadata or {}
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return {
            "data": self.data,
            "node_type": self.node_type,
            "node_id": self.node_id,
            "execution_time": self.execution_time,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat()
        }


# Context manager for node execution
class NodeExecutionContext:
    """Context manager for node execution with automatic cleanup"""
    
    def __init__(
        self,
        executor: NodeExecutor,
        node_type: str,
        config: Dict[str, Any],
        input_data: Dict[str, Any]
    ):
        self.executor = executor
        self.node_type = node_type
        self.config = config
        self.input_data = input_data
        self.start_time = None
        self.result = None
    
    async def __aenter__(self):
        self.start_time = datetime.utcnow()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Cleanup logic if needed
        pass
    
    async def execute(self) -> NodeExecutionResult:
        """Execute the node and return wrapped result"""
        if not self.start_time:
            raise RuntimeError("Context manager not entered")
        
        output_data = await self.executor.execute_node(
            self.node_type,
            self.config,
            self.input_data
        )
        
        execution_time = (datetime.utcnow() - self.start_time).total_seconds()
        
        self.result = NodeExecutionResult(
            data=output_data,
            node_type=self.node_type,
            node_id=self.config.get('id', 'unknown'),
            execution_time=execution_time
        )
        
        return self.result