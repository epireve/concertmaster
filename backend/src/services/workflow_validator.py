"""
ConcertMaster Workflow Validation System
Validates workflow definitions, DAG structure, and node configurations
"""

from typing import Dict, Any, List, Set, Optional, Tuple
from dataclasses import dataclass
import logging
from enum import Enum

logger = logging.getLogger(__name__)

class ValidationLevel(str, Enum):
    """Validation severity levels"""
    ERROR = "error"      # Blocks workflow execution
    WARNING = "warning"  # Should be addressed but doesn't block
    INFO = "info"        # Informational, no action needed

@dataclass
class ValidationResult:
    """Result of workflow validation"""
    is_valid: bool
    errors: List[str]
    warnings: List[str] 
    info_messages: List[str]
    
    def add_issue(self, level: ValidationLevel, message: str):
        """Add a validation issue"""
        if level == ValidationLevel.ERROR:
            self.errors.append(message)
            self.is_valid = False
        elif level == ValidationLevel.WARNING:
            self.warnings.append(message)
        else:
            self.info_messages.append(message)
    
    def has_issues(self) -> bool:
        """Check if there are any validation issues"""
        return len(self.errors) > 0 or len(self.warnings) > 0

class WorkflowValidator:
    """
    Validates workflow definitions for correctness and best practices
    
    Checks:
    - DAG structure (no cycles)
    - Node configuration validity
    - Edge connectivity
    - Required fields
    - Performance considerations
    """
    
    def __init__(self):
        self.known_node_types = {
            # Trigger nodes
            "ScheduleTrigger", "FormTrigger", "WebhookTrigger", "EmailTrigger",
            # Transform nodes
            "DataMapper", "Calculator", "Aggregator",
            # Logic nodes
            "Conditional", "Loop", "Wait",
            # Output nodes
            "DatabaseWrite", "APICall", "ERPExport"
        }
        
        logger.info("WorkflowValidator initialized")
    
    async def validate_workflow(self, definition: Dict[str, Any]) -> ValidationResult:
        """
        Comprehensive workflow validation
        
        Args:
            definition: Workflow definition dictionary
            
        Returns:
            ValidationResult with errors, warnings, and info messages
        """
        
        result = ValidationResult(
            is_valid=True,
            errors=[],
            warnings=[],
            info_messages=[]
        )
        
        # Basic structure validation
        await self._validate_basic_structure(definition, result)
        
        if not result.is_valid:
            return result  # Stop if basic structure is invalid
        
        # Extract nodes and edges
        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])
        
        # Validate nodes
        await self._validate_nodes(nodes, result)
        
        # Validate edges
        await self._validate_edges(edges, nodes, result)
        
        # Validate DAG structure
        await self._validate_dag_structure(nodes, edges, result)
        
        # Validate workflow flow
        await self._validate_workflow_flow(nodes, edges, result)
        
        # Performance and best practice checks
        await self._validate_performance_considerations(nodes, edges, result)
        
        logger.info(f"Workflow validation completed: {len(result.errors)} errors, {len(result.warnings)} warnings")
        return result
    
    async def _validate_basic_structure(self, definition: Dict[str, Any], result: ValidationResult):
        """Validate basic workflow structure"""
        
        # Check required top-level fields
        required_fields = ["nodes", "edges"]
        for field in required_fields:
            if field not in definition:
                result.add_issue(ValidationLevel.ERROR, f"Missing required field: {field}")
        
        # Check that nodes is a list
        if "nodes" in definition and not isinstance(definition["nodes"], list):
            result.add_issue(ValidationLevel.ERROR, "Field 'nodes' must be a list")
        
        # Check that edges is a list
        if "edges" in definition and not isinstance(definition["edges"], list):
            result.add_issue(ValidationLevel.ERROR, "Field 'edges' must be a list")
        
        # Check for empty workflow
        nodes = definition.get("nodes", [])
        if len(nodes) == 0:
            result.add_issue(ValidationLevel.ERROR, "Workflow must contain at least one node")
    
    async def _validate_nodes(self, nodes: List[Dict[str, Any]], result: ValidationResult):
        """Validate individual nodes"""
        
        node_ids = set()
        
        for i, node in enumerate(nodes):
            node_context = f"Node {i}"
            
            # Check required node fields
            required_fields = ["id", "type"]
            for field in required_fields:
                if field not in node:
                    result.add_issue(ValidationLevel.ERROR, f"{node_context}: Missing required field '{field}'")
                    continue
            
            node_id = node.get("id")
            node_type = node.get("type")
            
            if not node_id or not isinstance(node_id, str):
                result.add_issue(ValidationLevel.ERROR, f"{node_context}: Node ID must be a non-empty string")
                continue
            
            # Check for duplicate node IDs
            if node_id in node_ids:
                result.add_issue(ValidationLevel.ERROR, f"{node_context}: Duplicate node ID '{node_id}'")
            else:
                node_ids.add(node_id)
                node_context = f"Node '{node_id}'"
            
            # Validate node type
            if not node_type or not isinstance(node_type, str):
                result.add_issue(ValidationLevel.ERROR, f"{node_context}: Node type must be a non-empty string")
            elif node_type not in self.known_node_types:
                result.add_issue(ValidationLevel.WARNING, f"{node_context}: Unknown node type '{node_type}'")
            
            # Validate node configuration
            config = node.get("config", {})
            if not isinstance(config, dict):
                result.add_issue(ValidationLevel.ERROR, f"{node_context}: Node config must be an object")
            
            # Node-specific validation
            await self._validate_node_type_specific(node, result)
    
    async def _validate_node_type_specific(self, node: Dict[str, Any], result: ValidationResult):
        """Validate node-specific requirements"""
        
        node_id = node.get("id", "unknown")
        node_type = node.get("type")
        config = node.get("config", {})
        
        # Validate trigger nodes
        if node_type == "ScheduleTrigger":
            if "cron" not in config and "cron_expression" not in config:
                result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': ScheduleTrigger requires 'cron' or 'cron_expression'")
        
        elif node_type == "FormTrigger":
            if "form_id" not in config:
                result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': FormTrigger requires 'form_id'")
        
        elif node_type == "WebhookTrigger":
            if "endpoint_path" not in config:
                result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': WebhookTrigger requires 'endpoint_path'")
        
        # Validate transform nodes
        elif node_type == "DataMapper":
            required_fields = ["input_schema", "output_schema", "mapping_rules"]
            for field in required_fields:
                if field not in config:
                    result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': DataMapper requires '{field}'")
        
        elif node_type == "Calculator":
            required_fields = ["formula", "input_fields", "output_field"]
            for field in required_fields:
                if field not in config:
                    result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': Calculator requires '{field}'")
        
        # Validate logic nodes
        elif node_type == "Conditional":
            if "conditions" not in config:
                result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': Conditional requires 'conditions'")
        
        elif node_type == "Loop":
            required_fields = ["items_source", "iteration_body"]
            for field in required_fields:
                if field not in config:
                    result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': Loop requires '{field}'")
        
        # Validate output nodes
        elif node_type == "DatabaseWrite":
            required_fields = ["connection", "table", "operation"]
            for field in required_fields:
                if field not in config:
                    result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': DatabaseWrite requires '{field}'")
        
        elif node_type == "APICall":
            required_fields = ["endpoint", "method"]
            for field in required_fields:
                if field not in config:
                    result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': APICall requires '{field}'")
        
        elif node_type == "ERPExport":
            required_fields = ["system_type", "connection_details", "mapping"]
            for field in required_fields:
                if field not in config:
                    result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}': ERPExport requires '{field}'")
    
    async def _validate_edges(self, edges: List[Dict[str, Any]], nodes: List[Dict[str, Any]], result: ValidationResult):
        """Validate workflow edges"""
        
        node_ids = {node.get("id") for node in nodes if node.get("id")}
        
        for i, edge in enumerate(edges):
            edge_context = f"Edge {i}"
            
            # Check required edge fields
            required_fields = ["from", "to"]
            for field in required_fields:
                if field not in edge:
                    result.add_issue(ValidationLevel.ERROR, f"{edge_context}: Missing required field '{field}'")
                    continue
            
            from_node = edge.get("from")
            to_node = edge.get("to")
            
            # Validate node references
            if from_node not in node_ids:
                result.add_issue(ValidationLevel.ERROR, f"{edge_context}: Source node '{from_node}' does not exist")
            
            if to_node not in node_ids:
                result.add_issue(ValidationLevel.ERROR, f"{edge_context}: Target node '{to_node}' does not exist")
            
            # Check for self-loops
            if from_node == to_node:
                result.add_issue(ValidationLevel.ERROR, f"{edge_context}: Self-loop detected on node '{from_node}'")
            
            # Validate conditional edges
            condition = edge.get("condition")
            if condition is not None:
                if not isinstance(condition, str):
                    result.add_issue(ValidationLevel.ERROR, f"{edge_context}: Edge condition must be a string")
                elif not condition.strip():
                    result.add_issue(ValidationLevel.WARNING, f"{edge_context}: Empty edge condition")
    
    async def _validate_dag_structure(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], result: ValidationResult):
        """Validate that the workflow forms a valid DAG (no cycles)"""
        
        # Build adjacency list
        graph = {}
        node_ids = set()
        
        for node in nodes:
            node_id = node.get("id")
            if node_id:
                graph[node_id] = []
                node_ids.add(node_id)
        
        for edge in edges:
            from_node = edge.get("from")
            to_node = edge.get("to")
            
            if from_node in graph and to_node in graph:
                graph[from_node].append(to_node)
        
        # Detect cycles using DFS
        visited = set()
        rec_stack = set()
        
        def has_cycle(node: str) -> bool:
            if node in rec_stack:
                return True
            if node in visited:
                return False
            
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in graph.get(node, []):
                if has_cycle(neighbor):
                    return True
            
            rec_stack.remove(node)
            return False
        
        # Check for cycles
        for node_id in node_ids:
            if node_id not in visited:
                if has_cycle(node_id):
                    result.add_issue(ValidationLevel.ERROR, "Workflow contains a cycle - workflows must be acyclic")
                    break
    
    async def _validate_workflow_flow(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], result: ValidationResult):
        """Validate workflow execution flow"""
        
        node_ids = {node.get("id") for node in nodes if node.get("id")}
        
        # Build incoming and outgoing connections
        incoming = {node_id: [] for node_id in node_ids}
        outgoing = {node_id: [] for node_id in node_ids}
        
        for edge in edges:
            from_node = edge.get("from")
            to_node = edge.get("to")
            
            if from_node in outgoing:
                outgoing[from_node].append(to_node)
            if to_node in incoming:
                incoming[to_node].append(from_node)
        
        # Find start nodes (no incoming edges)
        start_nodes = [node_id for node_id in node_ids if not incoming[node_id]]
        
        # Find end nodes (no outgoing edges)
        end_nodes = [node_id for node_id in node_ids if not outgoing[node_id]]
        
        # Check for proper start and end
        if not start_nodes:
            result.add_issue(ValidationLevel.ERROR, "Workflow has no start node (node with no incoming edges)")
        elif len(start_nodes) > 1:
            result.add_issue(ValidationLevel.WARNING, f"Workflow has multiple start nodes: {', '.join(start_nodes)}")
        
        if not end_nodes:
            result.add_issue(ValidationLevel.WARNING, "Workflow has no end node (node with no outgoing edges)")
        
        # Check for isolated nodes
        for node_id in node_ids:
            if not incoming[node_id] and not outgoing[node_id] and len(node_ids) > 1:
                result.add_issue(ValidationLevel.ERROR, f"Node '{node_id}' is isolated (no connections)")
        
        # Validate trigger node placement
        trigger_nodes = []
        for node in nodes:
            node_type = node.get("type", "")
            if node_type.endswith("Trigger"):
                trigger_nodes.append(node.get("id"))
        
        for trigger_node in trigger_nodes:
            if trigger_node not in start_nodes:
                result.add_issue(ValidationLevel.WARNING, f"Trigger node '{trigger_node}' is not a start node")
    
    async def _validate_performance_considerations(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], result: ValidationResult):
        """Check for performance and best practice issues"""
        
        # Check workflow size
        if len(nodes) > 100:
            result.add_issue(ValidationLevel.WARNING, f"Large workflow with {len(nodes)} nodes may have performance implications")
        
        # Check for deeply nested branches
        max_depth = self._calculate_max_depth(nodes, edges)
        if max_depth > 20:
            result.add_issue(ValidationLevel.WARNING, f"Workflow has deep nesting (depth: {max_depth}) which may impact performance")
        
        # Check for potential bottlenecks
        node_fan_in = {}
        node_fan_out = {}
        
        for node in nodes:
            node_id = node.get("id")
            if node_id:
                node_fan_in[node_id] = 0
                node_fan_out[node_id] = 0
        
        for edge in edges:
            from_node = edge.get("from")
            to_node = edge.get("to")
            
            if from_node in node_fan_out:
                node_fan_out[from_node] += 1
            if to_node in node_fan_in:
                node_fan_in[to_node] += 1
        
        # Check for nodes with high fan-out (potential bottlenecks)
        for node_id, fan_out in node_fan_out.items():
            if fan_out > 10:
                result.add_issue(ValidationLevel.WARNING, f"Node '{node_id}' has high fan-out ({fan_out}) which may create a bottleneck")
        
        # Check for nodes with high fan-in (potential synchronization issues)
        for node_id, fan_in in node_fan_in.items():
            if fan_in > 5:
                result.add_issue(ValidationLevel.INFO, f"Node '{node_id}' has high fan-in ({fan_in}) - consider synchronization requirements")
        
        # Check for missing error handling
        has_error_handling = any(
            "error" in node.get("config", {}) or "on_error" in node.get("config", {})
            for node in nodes
        )
        
        if not has_error_handling:
            result.add_issue(ValidationLevel.INFO, "Consider adding error handling to workflow nodes")
    
    def _calculate_max_depth(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> int:
        """Calculate maximum execution depth of the workflow"""
        
        # Build adjacency list
        graph = {}
        node_ids = set()
        
        for node in nodes:
            node_id = node.get("id")
            if node_id:
                graph[node_id] = []
                node_ids.add(node_id)
        
        for edge in edges:
            from_node = edge.get("from")
            to_node = edge.get("to")
            
            if from_node in graph and to_node in graph:
                graph[from_node].append(to_node)
        
        # Find start nodes
        incoming = {node_id: 0 for node_id in node_ids}
        for edge in edges:
            to_node = edge.get("to")
            if to_node in incoming:
                incoming[to_node] += 1
        
        start_nodes = [node_id for node_id in node_ids if incoming[node_id] == 0]
        
        if not start_nodes:
            return 0
        
        # Calculate maximum depth using DFS
        def dfs_depth(node: str, visited: Set[str]) -> int:
            if node in visited:
                return 0  # Cycle detection
            
            visited.add(node)
            max_child_depth = 0
            
            for child in graph.get(node, []):
                child_depth = dfs_depth(child, visited.copy())
                max_child_depth = max(max_child_depth, child_depth)
            
            return 1 + max_child_depth
        
        max_depth = 0
        for start_node in start_nodes:
            depth = dfs_depth(start_node, set())
            max_depth = max(max_depth, depth)
        
        return max_depth
    
    def register_node_type(self, node_type: str):
        """Register a custom node type as valid"""
        self.known_node_types.add(node_type)
        logger.info(f"Registered custom node type: {node_type}")
    
    def get_known_node_types(self) -> Set[str]:
        """Get all known/registered node types"""
        return self.known_node_types.copy()