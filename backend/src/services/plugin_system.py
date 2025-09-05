"""
ConcertMaster Plugin System
Extensible node system for workflow orchestration
"""

import importlib
import inspect
import os
import json
import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Type, Union
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class NodeCategory(Enum):
    """Node categories for organization"""
    TRIGGER = "trigger"
    TRANSFORM = "transform"
    ACTION = "action"
    CONDITION = "condition"

class NodeExecutionStatus(Enum):
    """Node execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class NodeExecutionResult:
    """Result of node execution"""
    status: NodeExecutionStatus
    output_data: Dict[str, Any]
    error_message: Optional[str] = None
    execution_time: Optional[float] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

@dataclass
class NodeConfig:
    """Node configuration schema"""
    name: str
    category: NodeCategory
    display_name: str
    description: str
    icon: str
    color: str
    schema: Dict[str, Any]
    default_config: Dict[str, Any]
    is_system: bool = False
    version: str = "1.0.0"

class BaseNode(ABC):
    """Base class for all workflow nodes"""
    
    def __init__(self, node_id: str, config: Dict[str, Any]):
        self.node_id = node_id
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @classmethod
    @abstractmethod
    def get_config(cls) -> NodeConfig:
        """Return node configuration"""
        pass
    
    @abstractmethod
    async def execute(
        self, 
        input_data: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> NodeExecutionResult:
        """Execute the node logic"""
        pass
    
    def validate_config(self) -> List[str]:
        """Validate node configuration"""
        errors = []
        schema = self.get_config().schema
        
        # Basic schema validation
        for field, field_config in schema.get("properties", {}).items():
            if field_config.get("required", False) and field not in self.config:
                errors.append(f"Required field '{field}' is missing")
        
        return errors
    
    async def pre_execute(self, input_data: Dict[str, Any], context: Dict[str, Any]):
        """Pre-execution hook"""
        pass
    
    async def post_execute(self, result: NodeExecutionResult, context: Dict[str, Any]):
        """Post-execution hook"""
        pass

# Built-in Node Implementations

class WebhookTriggerNode(BaseNode):
    """Webhook trigger node"""
    
    @classmethod
    def get_config(cls) -> NodeConfig:
        return NodeConfig(
            name="webhook_trigger",
            category=NodeCategory.TRIGGER,
            display_name="Webhook Trigger",
            description="Trigger workflow from webhook requests",
            icon="webhook",
            color="#10B981",
            schema={
                "type": "object",
                "properties": {
                    "webhook_path": {
                        "type": "string",
                        "title": "Webhook Path",
                        "description": "Unique path for the webhook URL",
                        "required": True
                    },
                    "secret_key": {
                        "type": "string",
                        "title": "Secret Key",
                        "description": "Secret key for webhook validation"
                    },
                    "expected_headers": {
                        "type": "object",
                        "title": "Expected Headers",
                        "description": "Headers to validate in incoming requests"
                    }
                }
            },
            default_config={
                "webhook_path": "/webhook/new-webhook",
                "secret_key": "",
                "expected_headers": {}
            },
            is_system=True
        )
    
    async def execute(self, input_data: Dict[str, Any], context: Dict[str, Any]) -> NodeExecutionResult:
        """Webhook triggers are handled externally"""
        return NodeExecutionResult(
            status=NodeExecutionStatus.COMPLETED,
            output_data=input_data
        )

class FormTriggerNode(BaseNode):
    """Form submission trigger node"""
    
    @classmethod
    def get_config(cls) -> NodeConfig:
        return NodeConfig(
            name="form_trigger",
            category=NodeCategory.TRIGGER,
            display_name="Form Submission",
            description="Trigger workflow from form submissions",
            icon="form",
            color="#10B981",
            schema={
                "type": "object",
                "properties": {
                    "form_id": {
                        "type": "string",
                        "title": "Form ID",
                        "description": "ID of the form to trigger from",
                        "required": True
                    },
                    "field_mapping": {
                        "type": "object",
                        "title": "Field Mapping",
                        "description": "Map form fields to workflow variables"
                    }
                }
            },
            default_config={
                "form_id": "",
                "field_mapping": {}
            },
            is_system=True
        )
    
    async def execute(self, input_data: Dict[str, Any], context: Dict[str, Any]) -> NodeExecutionResult:
        form_data = input_data.get("form_data", {})
        field_mapping = self.config.get("field_mapping", {})
        
        # Map form fields to output variables
        output_data = {}
        for form_field, variable_name in field_mapping.items():
            if form_field in form_data:
                output_data[variable_name] = form_data[form_field]
        
        return NodeExecutionResult(
            status=NodeExecutionStatus.COMPLETED,
            output_data=output_data
        )

class DataTransformNode(BaseNode):
    """Data transformation node"""
    
    @classmethod
    def get_config(cls) -> NodeConfig:
        return NodeConfig(
            name="data_transform",
            category=NodeCategory.TRANSFORM,
            display_name="Data Transform",
            description="Transform data using JavaScript expressions",
            icon="transform",
            color="#3B82F6",
            schema={
                "type": "object",
                "properties": {
                    "transformations": {
                        "type": "array",
                        "title": "Transformations",
                        "description": "List of field transformations",
                        "items": {
                            "type": "object",
                            "properties": {
                                "field": {"type": "string"},
                                "expression": {"type": "string"},
                                "output_field": {"type": "string"}
                            }
                        }
                    }
                }
            },
            default_config={
                "transformations": []
            },
            is_system=True
        )
    
    async def execute(self, input_data: Dict[str, Any], context: Dict[str, Any]) -> NodeExecutionResult:
        output_data = input_data.copy()
        transformations = self.config.get("transformations", [])
        
        for transform in transformations:
            field = transform.get("field")
            expression = transform.get("expression", "")
            output_field = transform.get("output_field", field)
            
            try:
                # Simple expression evaluation (in production, use a sandboxed evaluator)
                if field in input_data:
                    value = input_data[field]
                    # Basic transformations
                    if expression == "uppercase":
                        output_data[output_field] = str(value).upper()
                    elif expression == "lowercase":
                        output_data[output_field] = str(value).lower()
                    elif expression.startswith("format:"):
                        format_str = expression.replace("format:", "")
                        output_data[output_field] = format_str.format(value)
                    else:
                        # For now, just pass through
                        output_data[output_field] = value
            except Exception as e:
                return NodeExecutionResult(
                    status=NodeExecutionStatus.FAILED,
                    output_data={},
                    error_message=f"Transform error: {str(e)}"
                )
        
        return NodeExecutionResult(
            status=NodeExecutionStatus.COMPLETED,
            output_data=output_data
        )

class EmailActionNode(BaseNode):
    """Email sending action node"""
    
    @classmethod
    def get_config(cls) -> NodeConfig:
        return NodeConfig(
            name="email_action",
            category=NodeCategory.ACTION,
            display_name="Send Email",
            description="Send email notifications",
            icon="email",
            color="#F59E0B",
            schema={
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "title": "To Email",
                        "description": "Recipient email address",
                        "required": True
                    },
                    "subject": {
                        "type": "string",
                        "title": "Subject",
                        "description": "Email subject line",
                        "required": True
                    },
                    "template": {
                        "type": "string",
                        "title": "Email Template",
                        "description": "Email body template with variables"
                    },
                    "use_html": {
                        "type": "boolean",
                        "title": "Use HTML",
                        "description": "Send as HTML email"
                    }
                }
            },
            default_config={
                "to": "",
                "subject": "",
                "template": "Hello {{name}}, your request has been processed.",
                "use_html": False
            },
            is_system=True
        )
    
    async def execute(self, input_data: Dict[str, Any], context: Dict[str, Any]) -> NodeExecutionResult:
        # Import here to avoid circular imports
        from .email_service import EmailService
        
        email_service = EmailService()
        
        try:
            # Template rendering (simple replacement for now)
            template = self.config.get("template", "")
            for key, value in input_data.items():
                template = template.replace(f"{{{{{key}}}}}", str(value))
            
            await email_service.send_email(
                to=self.config["to"],
                subject=self.config["subject"],
                body=template,
                is_html=self.config.get("use_html", False)
            )
            
            return NodeExecutionResult(
                status=NodeExecutionStatus.COMPLETED,
                output_data={"email_sent": True, "recipient": self.config["to"]}
            )
            
        except Exception as e:
            return NodeExecutionResult(
                status=NodeExecutionStatus.FAILED,
                output_data={},
                error_message=f"Email sending failed: {str(e)}"
            )

class ConditionNode(BaseNode):
    """Conditional branching node"""
    
    @classmethod
    def get_config(cls) -> NodeConfig:
        return NodeConfig(
            name="condition",
            category=NodeCategory.CONDITION,
            display_name="Condition",
            description="Conditional branching based on data values",
            icon="condition",
            color="#EF4444",
            schema={
                "type": "object",
                "properties": {
                    "field": {
                        "type": "string",
                        "title": "Field to Check",
                        "description": "Field name to evaluate",
                        "required": True
                    },
                    "operator": {
                        "type": "string",
                        "title": "Operator",
                        "enum": ["equals", "not_equals", "greater_than", "less_than", "contains"],
                        "required": True
                    },
                    "value": {
                        "type": "string",
                        "title": "Comparison Value",
                        "description": "Value to compare against",
                        "required": True
                    }
                }
            },
            default_config={
                "field": "",
                "operator": "equals",
                "value": ""
            },
            is_system=True
        )
    
    async def execute(self, input_data: Dict[str, Any], context: Dict[str, Any]) -> NodeExecutionResult:
        field = self.config.get("field")
        operator = self.config.get("operator")
        compare_value = self.config.get("value")
        
        if field not in input_data:
            return NodeExecutionResult(
                status=NodeExecutionStatus.FAILED,
                output_data={},
                error_message=f"Field '{field}' not found in input data"
            )
        
        field_value = input_data[field]
        result = False
        
        try:
            if operator == "equals":
                result = str(field_value) == str(compare_value)
            elif operator == "not_equals":
                result = str(field_value) != str(compare_value)
            elif operator == "greater_than":
                result = float(field_value) > float(compare_value)
            elif operator == "less_than":
                result = float(field_value) < float(compare_value)
            elif operator == "contains":
                result = str(compare_value) in str(field_value)
                
        except (ValueError, TypeError) as e:
            return NodeExecutionResult(
                status=NodeExecutionStatus.FAILED,
                output_data={},
                error_message=f"Condition evaluation error: {str(e)}"
            )
        
        return NodeExecutionResult(
            status=NodeExecutionStatus.COMPLETED,
            output_data={
                **input_data,
                "condition_result": result,
                "branch": "true" if result else "false"
            }
        )

class PluginManager:
    """Plugin system manager"""
    
    def __init__(self):
        self.nodes: Dict[str, Type[BaseNode]] = {}
        self.plugin_paths: List[str] = []
        self._load_system_nodes()
    
    def _load_system_nodes(self):
        """Load built-in system nodes"""
        system_nodes = [
            WebhookTriggerNode,
            FormTriggerNode,
            DataTransformNode,
            EmailActionNode,
            ConditionNode
        ]
        
        for node_class in system_nodes:
            config = node_class.get_config()
            self.nodes[config.name] = node_class
            logger.info(f"Registered system node: {config.name}")
    
    def register_node(self, node_class: Type[BaseNode]):
        """Register a new node type"""
        if not issubclass(node_class, BaseNode):
            raise ValueError("Node class must inherit from BaseNode")
        
        config = node_class.get_config()
        self.nodes[config.name] = node_class
        logger.info(f"Registered node: {config.name}")
    
    def load_plugins_from_directory(self, directory: str):
        """Load plugins from a directory"""
        plugin_path = Path(directory)
        if not plugin_path.exists():
            logger.warning(f"Plugin directory does not exist: {directory}")
            return
        
        for file_path in plugin_path.glob("*.py"):
            if file_path.name.startswith("_"):
                continue
                
            try:
                self._load_plugin_file(file_path)
            except Exception as e:
                logger.error(f"Failed to load plugin {file_path}: {str(e)}")
    
    def _load_plugin_file(self, file_path: Path):
        """Load a single plugin file"""
        spec = importlib.util.spec_from_file_location("plugin", file_path)
        if spec is None or spec.loader is None:
            return
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Find node classes in the module
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if issubclass(obj, BaseNode) and obj != BaseNode:
                self.register_node(obj)
    
    def get_node_class(self, node_type: str) -> Optional[Type[BaseNode]]:
        """Get node class by type"""
        return self.nodes.get(node_type)
    
    def create_node(self, node_type: str, node_id: str, config: Dict[str, Any]) -> Optional[BaseNode]:
        """Create a node instance"""
        node_class = self.get_node_class(node_type)
        if node_class is None:
            logger.error(f"Unknown node type: {node_type}")
            return None
        
        return node_class(node_id, config)
    
    def get_available_nodes(self) -> List[NodeConfig]:
        """Get list of available node configurations"""
        return [cls.get_config() for cls in self.nodes.values()]
    
    def get_nodes_by_category(self, category: NodeCategory) -> List[NodeConfig]:
        """Get nodes filtered by category"""
        return [
            cls.get_config() for cls in self.nodes.values()
            if cls.get_config().category == category
        ]
    
    async def execute_node(
        self, 
        node_type: str, 
        node_id: str, 
        config: Dict[str, Any],
        input_data: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> NodeExecutionResult:
        """Execute a node"""
        node = self.create_node(node_type, node_id, config)
        if node is None:
            return NodeExecutionResult(
                status=NodeExecutionStatus.FAILED,
                output_data={},
                error_message=f"Unknown node type: {node_type}"
            )
        
        # Validate configuration
        validation_errors = node.validate_config()
        if validation_errors:
            return NodeExecutionResult(
                status=NodeExecutionStatus.FAILED,
                output_data={},
                error_message=f"Configuration errors: {', '.join(validation_errors)}"
            )
        
        try:
            await node.pre_execute(input_data, context)
            result = await node.execute(input_data, context)
            await node.post_execute(result, context)
            return result
        except Exception as e:
            logger.exception(f"Node execution failed: {node_id}")
            return NodeExecutionResult(
                status=NodeExecutionStatus.FAILED,
                output_data={},
                error_message=f"Execution error: {str(e)}"
            )

# Global plugin manager instance
plugin_manager = PluginManager()