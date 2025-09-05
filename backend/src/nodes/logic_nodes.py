"""
ConcertMaster Logic Nodes
Nodes that control workflow execution flow and implement business logic
"""

from typing import Dict, Any, List
import asyncio
import time
import logging
from datetime import datetime, timedelta

from ..services.node_executor import LogicNode

logger = logging.getLogger(__name__)

class ConditionalNode(LogicNode):
    """
    Branch workflow execution based on conditions
    
    Configuration:
    - conditions: List of condition objects to evaluate
    - logic_operator: How to combine multiple conditions (AND/OR)
    - true_branch: Action when condition is true
    - false_branch: Action when condition is false
    """
    
    node_type = "Conditional"
    description = "Branch workflow execution based on conditional logic"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute conditional logic"""
        
        conditions = self.config.get("conditions", [])
        logic_operator = self.config.get("logic_operator", "AND")
        
        # Evaluate all conditions
        condition_results = []
        
        for i, condition in enumerate(conditions):
            try:
                result = await self._evaluate_condition(condition, input_data)
                condition_results.append({
                    "condition_index": i,
                    "condition": condition,
                    "result": result,
                    "evaluated_at": datetime.utcnow().isoformat()
                })
            except Exception as e:
                self.log("error", f"Failed to evaluate condition {i}: {str(e)}")
                condition_results.append({
                    "condition_index": i,
                    "condition": condition,
                    "result": False,
                    "error": str(e),
                    "evaluated_at": datetime.utcnow().isoformat()
                })
        
        # Combine results based on logic operator
        if logic_operator.upper() == "AND":
            overall_result = all(cr["result"] for cr in condition_results)
        elif logic_operator.upper() == "OR":
            overall_result = any(cr["result"] for cr in condition_results)
        else:
            # Single condition or default to AND
            overall_result = all(cr["result"] for cr in condition_results)
        
        # Determine branch to take
        branch_taken = "true" if overall_result else "false"
        branch_config = self.config.get("true_branch" if overall_result else "false_branch", {})
        
        return {
            "condition_result": overall_result,
            "branch_taken": branch_taken,
            "condition_evaluations": condition_results,
            "logic_operator": logic_operator,
            "branch_config": branch_config,
            "input_data": input_data,  # Pass through for next nodes
            "evaluated_at": datetime.utcnow().isoformat()
        }
    
    async def _evaluate_condition(self, condition: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """Evaluate a single condition"""
        
        condition_type = condition.get("type", "field_comparison")
        
        if condition_type == "field_comparison":
            return await self._evaluate_field_comparison(condition, data)
        
        elif condition_type == "field_existence":
            field_path = condition.get("field", "")
            return self._get_nested_value(data, field_path) is not None
        
        elif condition_type == "expression":
            expression = condition.get("expression", "")
            return await self._evaluate_expression(expression, data)
        
        elif condition_type == "data_validation":
            return await self._evaluate_data_validation(condition, data)
        
        else:
            self.log("warning", f"Unknown condition type: {condition_type}")
            return False
    
    async def _evaluate_field_comparison(self, condition: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """Evaluate field comparison condition"""
        
        field_path = condition.get("field", "")
        operator = condition.get("operator", "equals")
        expected_value = condition.get("value")
        
        field_value = self._get_nested_value(data, field_path)
        
        if operator == "equals":
            return field_value == expected_value
        
        elif operator == "not_equals":
            return field_value != expected_value
        
        elif operator == "greater_than":
            try:
                return float(field_value) > float(expected_value)
            except (ValueError, TypeError):
                return False
        
        elif operator == "less_than":
            try:
                return float(field_value) < float(expected_value)
            except (ValueError, TypeError):
                return False
        
        elif operator == "greater_equal":
            try:
                return float(field_value) >= float(expected_value)
            except (ValueError, TypeError):
                return False
        
        elif operator == "less_equal":
            try:
                return float(field_value) <= float(expected_value)
            except (ValueError, TypeError):
                return False
        
        elif operator == "contains":
            return str(expected_value) in str(field_value)
        
        elif operator == "not_contains":
            return str(expected_value) not in str(field_value)
        
        elif operator == "starts_with":
            return str(field_value).startswith(str(expected_value))
        
        elif operator == "ends_with":
            return str(field_value).endswith(str(expected_value))
        
        elif operator == "in":
            if isinstance(expected_value, list):
                return field_value in expected_value
            return False
        
        elif operator == "not_in":
            if isinstance(expected_value, list):
                return field_value not in expected_value
            return True
        
        elif operator == "is_empty":
            return field_value is None or str(field_value).strip() == ""
        
        elif operator == "is_not_empty":
            return field_value is not None and str(field_value).strip() != ""
        
        else:
            self.log("warning", f"Unknown comparison operator: {operator}")
            return False
    
    async def _evaluate_expression(self, expression: str, data: Dict[str, Any]) -> bool:
        """Evaluate boolean expression"""
        
        # Simple expression evaluation - replace field references
        import re
        
        # Replace field references like ${field.path} with actual values
        def replace_field_ref(match):
            field_path = match.group(1)
            value = self._get_nested_value(data, field_path)
            # Convert to string representation for expression
            if isinstance(value, str):
                return f'"{value}"'
            elif value is None:
                return "None"
            else:
                return str(value)
        
        # Replace field references
        processed_expression = re.sub(r'\$\{([^}]+)\}', replace_field_ref, expression)
        
        try:
            # Evaluate as Python expression (simplified - would use safer evaluator in production)
            # This is a security risk in production - use ast.literal_eval or similar
            result = eval(processed_expression)
            return bool(result)
        except Exception as e:
            self.log("error", f"Failed to evaluate expression '{expression}': {str(e)}")
            return False
    
    async def _evaluate_data_validation(self, condition: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """Evaluate data validation condition"""
        
        validation_type = condition.get("validation_type", "required")
        field_path = condition.get("field", "")
        
        field_value = self._get_nested_value(data, field_path)
        
        if validation_type == "required":
            return field_value is not None and str(field_value).strip() != ""
        
        elif validation_type == "email":
            if field_value is None:
                return False
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            return bool(re.match(email_pattern, str(field_value)))
        
        elif validation_type == "numeric":
            try:
                float(field_value)
                return True
            except (ValueError, TypeError):
                return False
        
        elif validation_type == "min_length":
            min_length = condition.get("min_length", 0)
            return len(str(field_value)) >= min_length
        
        elif validation_type == "max_length":
            max_length = condition.get("max_length", float('inf'))
            return len(str(field_value)) <= max_length
        
        elif validation_type == "pattern":
            pattern = condition.get("pattern", "")
            import re
            return bool(re.match(pattern, str(field_value)))
        
        return False
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get nested value using dot notation path"""
        
        if not path:
            return data
        
        parts = path.split(".")
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        
        return current
    
    async def validate_config(self) -> List[str]:
        """Validate conditional node configuration"""
        
        errors = []
        
        # Check conditions
        conditions = self.config.get("conditions", [])
        if not conditions:
            errors.append("Conditional node requires at least one condition")
        
        # Validate each condition
        for i, condition in enumerate(conditions):
            if not isinstance(condition, dict):
                errors.append(f"Condition {i} must be an object")
                continue
            
            condition_type = condition.get("type", "field_comparison")
            
            if condition_type == "field_comparison":
                if not condition.get("field"):
                    errors.append(f"Condition {i}: field_comparison requires 'field' property")
                if "value" not in condition:
                    errors.append(f"Condition {i}: field_comparison requires 'value' property")
            
            elif condition_type == "expression":
                if not condition.get("expression"):
                    errors.append(f"Condition {i}: expression condition requires 'expression' property")
        
        # Validate logic operator
        logic_operator = self.config.get("logic_operator", "AND")
        if logic_operator.upper() not in ["AND", "OR"]:
            errors.append("logic_operator must be 'AND' or 'OR'")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "conditions": {
                    "type": "array",
                    "title": "Conditions",
                    "description": "List of conditions to evaluate",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "enum": ["field_comparison", "field_existence", "expression", "data_validation"],
                                "description": "Type of condition to evaluate"
                            },
                            "field": {
                                "type": "string",
                                "description": "Field path to evaluate (dot notation)"
                            },
                            "operator": {
                                "enum": ["equals", "not_equals", "greater_than", "less_than", "greater_equal", "less_equal", 
                                        "contains", "not_contains", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"],
                                "description": "Comparison operator"
                            },
                            "value": {
                                "description": "Expected value for comparison"
                            },
                            "expression": {
                                "type": "string",
                                "description": "Boolean expression to evaluate"
                            }
                        }
                    },
                    "minItems": 1
                },
                "logic_operator": {
                    "type": "string",
                    "title": "Logic Operator",
                    "description": "How to combine multiple conditions",
                    "enum": ["AND", "OR"],
                    "default": "AND"
                },
                "true_branch": {
                    "type": "object",
                    "title": "True Branch",
                    "description": "Configuration for when condition is true"
                },
                "false_branch": {
                    "type": "object",
                    "title": "False Branch", 
                    "description": "Configuration for when condition is false"
                }
            },
            "required": ["conditions"],
            "additionalProperties": False
        }


class LoopNode(LogicNode):
    """
    Iterate over items and execute sub-workflow
    
    Configuration:
    - items_source: Source of items to iterate over
    - iteration_body: Sub-workflow to execute for each item
    - max_iterations: Maximum number of iterations
    - parallel_execution: Whether to execute iterations in parallel
    """
    
    node_type = "Loop"
    description = "Iterate over a collection of items and execute sub-workflow for each"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute loop iteration"""
        
        items_source = self.config.get("items_source", "")
        max_iterations = self.config.get("max_iterations", 1000)
        parallel_execution = self.config.get("parallel_execution", False)
        iteration_body = self.config.get("iteration_body", {})
        
        # Get items to iterate over
        items = self._get_iteration_items(input_data, items_source)
        
        # Limit iterations for safety
        if len(items) > max_iterations:
            self.log("warning", f"Limiting iterations to {max_iterations} (found {len(items)} items)")
            items = items[:max_iterations]
        
        # Execute iterations
        if parallel_execution:
            results = await self._execute_parallel_iterations(items, iteration_body, input_data)
        else:
            results = await self._execute_sequential_iterations(items, iteration_body, input_data)
        
        # Collect statistics
        successful_iterations = sum(1 for r in results if r.get("success", False))
        failed_iterations = len(results) - successful_iterations
        
        return {
            "loop_completed": True,
            "total_iterations": len(items),
            "successful_iterations": successful_iterations,
            "failed_iterations": failed_iterations,
            "parallel_execution": parallel_execution,
            "iteration_results": results,
            "executed_at": datetime.utcnow().isoformat()
        }
    
    def _get_iteration_items(self, data: Dict[str, Any], items_source: str) -> List[Any]:
        """Get items to iterate over from data source"""
        
        if not items_source:
            return []
        
        # Get items from nested path
        items = self._get_nested_value(data, items_source)
        
        if items is None:
            return []
        
        if isinstance(items, list):
            return items
        elif isinstance(items, dict):
            # Convert dict to list of key-value pairs
            return [{"key": k, "value": v} for k, v in items.items()]
        else:
            # Single item - convert to list
            return [items]
    
    async def _execute_sequential_iterations(
        self, 
        items: List[Any], 
        iteration_body: Dict[str, Any],
        base_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Execute iterations sequentially"""
        
        results = []
        
        for i, item in enumerate(items):
            try:
                # Prepare iteration context
                iteration_data = {
                    **base_data,
                    "iteration": {
                        "index": i,
                        "item": item,
                        "total_items": len(items),
                        "is_first": i == 0,
                        "is_last": i == len(items) - 1
                    }
                }
                
                # Execute iteration body
                iteration_result = await self._execute_iteration_body(iteration_body, iteration_data)
                
                results.append({
                    "iteration_index": i,
                    "item": item,
                    "success": True,
                    "result": iteration_result,
                    "executed_at": datetime.utcnow().isoformat()
                })
                
            except Exception as e:
                self.log("error", f"Iteration {i} failed: {str(e)}")
                results.append({
                    "iteration_index": i,
                    "item": item,
                    "success": False,
                    "error": str(e),
                    "executed_at": datetime.utcnow().isoformat()
                })
        
        return results
    
    async def _execute_parallel_iterations(
        self,
        items: List[Any],
        iteration_body: Dict[str, Any],
        base_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Execute iterations in parallel"""
        
        # Create tasks for parallel execution
        tasks = []
        
        for i, item in enumerate(items):
            iteration_data = {
                **base_data,
                "iteration": {
                    "index": i,
                    "item": item,
                    "total_items": len(items),
                    "is_first": i == 0,
                    "is_last": i == len(items) - 1
                }
            }
            
            task = self._execute_iteration_with_error_handling(i, item, iteration_body, iteration_data)
            tasks.append(task)
        
        # Execute all tasks
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "iteration_index": i,
                    "item": items[i],
                    "success": False,
                    "error": str(result),
                    "executed_at": datetime.utcnow().isoformat()
                })
            else:
                processed_results.append(result)
        
        return processed_results
    
    async def _execute_iteration_with_error_handling(
        self,
        index: int,
        item: Any,
        iteration_body: Dict[str, Any],
        iteration_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute single iteration with error handling"""
        
        try:
            iteration_result = await self._execute_iteration_body(iteration_body, iteration_data)
            
            return {
                "iteration_index": index,
                "item": item,
                "success": True,
                "result": iteration_result,
                "executed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "iteration_index": index,
                "item": item,
                "success": False,
                "error": str(e),
                "executed_at": datetime.utcnow().isoformat()
            }
    
    async def _execute_iteration_body(self, iteration_body: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the iteration body (simplified - would integrate with workflow engine)"""
        
        # This is a simplified implementation
        # In a real system, this would execute a sub-workflow using the workflow engine
        
        body_type = iteration_body.get("type", "passthrough")
        
        if body_type == "passthrough":
            # Simply pass through the data
            return data
        
        elif body_type == "transform":
            # Apply simple transformations
            transformations = iteration_body.get("transformations", {})
            result = dict(data)
            
            for field, transform in transformations.items():
                if transform["type"] == "multiply":
                    current_value = self._get_nested_value(data, field)
                    if current_value is not None:
                        result[field] = float(current_value) * transform["factor"]
                
                elif transform["type"] == "append":
                    current_value = self._get_nested_value(data, field)
                    if current_value is not None:
                        result[field] = str(current_value) + transform["suffix"]
            
            return result
        
        else:
            # Unknown body type - return input data
            return data
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get nested value using dot notation path"""
        
        parts = path.split(".")
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        
        return current
    
    async def validate_config(self) -> List[str]:
        """Validate loop node configuration"""
        
        errors = []
        
        # Check items source
        if not self.config.get("items_source"):
            errors.append("Loop node requires 'items_source' field")
        
        # Check iteration body
        if not self.config.get("iteration_body"):
            errors.append("Loop node requires 'iteration_body' configuration")
        
        # Validate max iterations
        max_iterations = self.config.get("max_iterations", 1000)
        if not isinstance(max_iterations, int) or max_iterations <= 0:
            errors.append("max_iterations must be a positive integer")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "items_source": {
                    "type": "string",
                    "title": "Items Source",
                    "description": "Field path containing items to iterate over (dot notation)"
                },
                "iteration_body": {
                    "type": "object",
                    "title": "Iteration Body",
                    "description": "Sub-workflow or operations to execute for each item"
                },
                "max_iterations": {
                    "type": "integer",
                    "title": "Max Iterations",
                    "description": "Maximum number of iterations to prevent infinite loops",
                    "default": 1000,
                    "minimum": 1,
                    "maximum": 10000
                },
                "parallel_execution": {
                    "type": "boolean",
                    "title": "Parallel Execution",
                    "description": "Execute iterations in parallel for better performance",
                    "default": False
                }
            },
            "required": ["items_source", "iteration_body"],
            "additionalProperties": False
        }


class WaitNode(LogicNode):
    """
    Pause workflow execution for specified duration or until condition is met
    
    Configuration:
    - duration: Time to wait (seconds, minutes, hours, days)
    - continue_condition: Condition to check for early continuation
    - max_wait_time: Maximum time to wait before continuing anyway
    """
    
    node_type = "Wait"
    description = "Pause workflow execution for a specified duration or until condition is met"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute wait operation"""
        
        duration = self.config.get("duration", 0)
        duration_unit = self.config.get("duration_unit", "seconds")
        continue_condition = self.config.get("continue_condition")
        max_wait_time = self.config.get("max_wait_time", 3600)  # 1 hour default
        
        # Convert duration to seconds
        wait_seconds = self._convert_to_seconds(duration, duration_unit)
        
        # Cap wait time for safety
        wait_seconds = min(wait_seconds, max_wait_time)
        
        start_time = datetime.utcnow()
        
        self.log("info", f"Starting wait for {wait_seconds} seconds")
        
        if continue_condition:
            # Wait with condition checking
            result = await self._wait_with_condition(wait_seconds, continue_condition, input_data)
        else:
            # Simple duration wait
            await asyncio.sleep(wait_seconds)
            result = {
                "wait_completed": True,
                "wait_reason": "duration_elapsed",
                "actual_wait_seconds": wait_seconds
            }
        
        end_time = datetime.utcnow()
        actual_duration = (end_time - start_time).total_seconds()
        
        return {
            **result,
            "started_at": start_time.isoformat(),
            "completed_at": end_time.isoformat(),
            "requested_duration": wait_seconds,
            "actual_duration": actual_duration,
            "input_data": input_data  # Pass through for next nodes
        }
    
    async def _wait_with_condition(
        self,
        max_wait_seconds: float,
        condition: Dict[str, Any],
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Wait with periodic condition checking"""
        
        check_interval = self.config.get("check_interval", 5)  # Check every 5 seconds
        elapsed = 0
        checks_performed = 0
        
        while elapsed < max_wait_seconds:
            # Check condition
            try:
                condition_met = await self._check_continue_condition(condition, data)
                checks_performed += 1
                
                if condition_met:
                    return {
                        "wait_completed": True,
                        "wait_reason": "condition_met",
                        "actual_wait_seconds": elapsed,
                        "condition_checks": checks_performed,
                        "condition_result": True
                    }
            
            except Exception as e:
                self.log("error", f"Error checking continue condition: {str(e)}")
            
            # Wait for next check
            sleep_time = min(check_interval, max_wait_seconds - elapsed)
            await asyncio.sleep(sleep_time)
            elapsed += sleep_time
        
        return {
            "wait_completed": True,
            "wait_reason": "max_duration_reached",
            "actual_wait_seconds": elapsed,
            "condition_checks": checks_performed,
            "condition_result": False
        }
    
    async def _check_continue_condition(self, condition: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """Check if continue condition is met"""
        
        condition_type = condition.get("type", "field_comparison")
        
        if condition_type == "field_comparison":
            field_path = condition.get("field", "")
            operator = condition.get("operator", "equals")
            expected_value = condition.get("value")
            
            # Get current field value (would need to refresh from external source)
            field_value = self._get_nested_value(data, field_path)
            
            if operator == "equals":
                return field_value == expected_value
            elif operator == "not_equals":
                return field_value != expected_value
            # Add more operators as needed
        
        elif condition_type == "external_check":
            # Would make external API call or database query
            # Simplified for this implementation
            return False
        
        return False
    
    def _convert_to_seconds(self, duration: float, unit: str) -> float:
        """Convert duration to seconds"""
        
        multipliers = {
            "seconds": 1,
            "minutes": 60,
            "hours": 3600,
            "days": 86400
        }
        
        return duration * multipliers.get(unit, 1)
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get nested value using dot notation path"""
        
        parts = path.split(".")
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        
        return current
    
    async def validate_config(self) -> List[str]:
        """Validate wait node configuration"""
        
        errors = []
        
        # Check duration
        duration = self.config.get("duration", 0)
        if not isinstance(duration, (int, float)) or duration < 0:
            errors.append("duration must be a non-negative number")
        
        # Check duration unit
        duration_unit = self.config.get("duration_unit", "seconds")
        valid_units = ["seconds", "minutes", "hours", "days"]
        if duration_unit not in valid_units:
            errors.append(f"duration_unit must be one of: {', '.join(valid_units)}")
        
        # Check max wait time
        max_wait_time = self.config.get("max_wait_time", 3600)
        if not isinstance(max_wait_time, (int, float)) or max_wait_time <= 0:
            errors.append("max_wait_time must be a positive number")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "duration": {
                    "type": "number",
                    "title": "Duration",
                    "description": "Time to wait",
                    "minimum": 0,
                    "default": 0
                },
                "duration_unit": {
                    "type": "string",
                    "title": "Duration Unit",
                    "description": "Unit for duration",
                    "enum": ["seconds", "minutes", "hours", "days"],
                    "default": "seconds"
                },
                "continue_condition": {
                    "type": "object",
                    "title": "Continue Condition",
                    "description": "Condition to check for early continuation",
                    "properties": {
                        "type": {"enum": ["field_comparison", "external_check"]},
                        "field": {"type": "string"},
                        "operator": {"enum": ["equals", "not_equals", "greater_than", "less_than"]},
                        "value": {}
                    }
                },
                "max_wait_time": {
                    "type": "number",
                    "title": "Max Wait Time",
                    "description": "Maximum time to wait in seconds",
                    "default": 3600,
                    "minimum": 1
                },
                "check_interval": {
                    "type": "number",
                    "title": "Check Interval",
                    "description": "How often to check condition in seconds",
                    "default": 5,
                    "minimum": 1
                }
            },
            "required": ["duration"],
            "additionalProperties": False
        }