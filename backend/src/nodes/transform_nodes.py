"""
ConcertMaster Transform Nodes
Nodes that transform, map, and manipulate data within workflows
"""

from typing import Dict, Any, List, Union, Optional
import json
import re
import logging
from datetime import datetime
import ast
import operator
from decimal import Decimal, InvalidOperation

from ..services.node_executor import TransformNode

logger = logging.getLogger(__name__)

class DataMapperNode(TransformNode):
    """
    Map data fields between different schemas
    
    Configuration:
    - input_schema: Input data schema definition
    - output_schema: Output data schema definition  
    - mapping_rules: Field mapping rules
    - default_values: Default values for missing fields
    """
    
    node_type = "DataMapper"
    description = "Map and transform data fields between different schemas"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute data mapping transformation"""
        
        mapping_rules = self.config.get("mapping_rules", {})
        default_values = self.config.get("default_values", {})
        
        # Extract source data
        source_data = input_data
        if "data" in input_data:
            source_data = input_data["data"]
        
        # Apply mapping rules
        mapped_data = {}
        
        for output_field, mapping_rule in mapping_rules.items():
            try:
                mapped_value = await self._apply_mapping_rule(source_data, mapping_rule)
                if mapped_value is not None:
                    mapped_data[output_field] = mapped_value
                elif output_field in default_values:
                    mapped_data[output_field] = default_values[output_field]
                    
            except Exception as e:
                self.log("warning", f"Failed to map field '{output_field}': {str(e)}")
                # Use default value if available
                if output_field in default_values:
                    mapped_data[output_field] = default_values[output_field]
        
        # Add default values for unmapped fields
        for field, default_value in default_values.items():
            if field not in mapped_data:
                mapped_data[field] = default_value
        
        return {
            "mapped_data": mapped_data,
            "mapping_applied": True,
            "source_fields_count": len(self._flatten_dict(source_data)),
            "output_fields_count": len(mapped_data),
            "processed_at": datetime.utcnow().isoformat()
        }
    
    async def _apply_mapping_rule(self, source_data: Dict[str, Any], rule: Union[str, Dict[str, Any]]) -> Any:
        """Apply a single mapping rule to extract/transform data"""
        
        if isinstance(rule, str):
            # Simple field path mapping
            return self._get_nested_value(source_data, rule)
        
        elif isinstance(rule, dict):
            rule_type = rule.get("type", "field")
            
            if rule_type == "field":
                # Field path with optional transformation
                field_path = rule.get("field", "")
                value = self._get_nested_value(source_data, field_path)
                
                # Apply transformation if specified
                transform = rule.get("transform")
                if transform and value is not None:
                    value = await self._apply_transformation(value, transform)
                
                return value
            
            elif rule_type == "constant":
                # Constant value
                return rule.get("value")
            
            elif rule_type == "expression":
                # Expression evaluation
                expression = rule.get("expression", "")
                return await self._evaluate_expression(expression, source_data)
            
            elif rule_type == "concat":
                # String concatenation
                fields = rule.get("fields", [])
                separator = rule.get("separator", "")
                values = []
                
                for field in fields:
                    value = self._get_nested_value(source_data, field)
                    if value is not None:
                        values.append(str(value))
                
                return separator.join(values) if values else None
            
            elif rule_type == "condition":
                # Conditional mapping
                condition = rule.get("condition", {})
                if await self._evaluate_condition(condition, source_data):
                    return await self._apply_mapping_rule(source_data, rule.get("if_true"))
                else:
                    return await self._apply_mapping_rule(source_data, rule.get("if_false"))
        
        return None
    
    async def _apply_transformation(self, value: Any, transform: Dict[str, Any]) -> Any:
        """Apply transformation to a value"""
        
        transform_type = transform.get("type", "")
        
        if transform_type == "upper":
            return str(value).upper()
        
        elif transform_type == "lower":
            return str(value).lower()
        
        elif transform_type == "trim":
            return str(value).strip()
        
        elif transform_type == "format":
            format_string = transform.get("format", "{}")
            return format_string.format(value)
        
        elif transform_type == "regex_replace":
            pattern = transform.get("pattern", "")
            replacement = transform.get("replacement", "")
            return re.sub(pattern, replacement, str(value))
        
        elif transform_type == "type_cast":
            target_type = transform.get("target_type", "string")
            
            if target_type == "int":
                return int(float(value))
            elif target_type == "float":
                return float(value)
            elif target_type == "string":
                return str(value)
            elif target_type == "boolean":
                return bool(value) and str(value).lower() not in ["false", "0", ""]
        
        return value
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get nested value using dot notation path"""
        
        if not path:
            return data
        
        parts = path.split(".")
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            elif isinstance(current, list) and part.isdigit():
                index = int(part)
                if 0 <= index < len(current):
                    current = current[index]
                else:
                    return None
            else:
                return None
        
        return current
    
    def _flatten_dict(self, d: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
        """Flatten nested dictionary for field counting"""
        
        items = []
        for k, v in d.items():
            new_key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key).items())
            else:
                items.append((new_key, v))
        return dict(items)
    
    async def _evaluate_expression(self, expression: str, data: Dict[str, Any]) -> Any:
        """Safely evaluate expression with data context"""
        
        # Simple expression evaluation - in production would use a safer evaluator
        try:
            # Replace field references with actual values
            safe_expression = expression
            
            # Find field references like ${field.path}
            field_refs = re.findall(r'\$\{([^}]+)\}', expression)
            for field_ref in field_refs:
                value = self._get_nested_value(data, field_ref)
                safe_expression = safe_expression.replace(f"${{{field_ref}}}", str(value))
            
            # Evaluate simple arithmetic expressions
            # This is a simplified implementation - would use ast.literal_eval or similar in production
            if re.match(r'^[\d\s+\-*/().]+$', safe_expression):
                return eval(safe_expression)
            
            return safe_expression
            
        except Exception as e:
            self.log("error", f"Failed to evaluate expression '{expression}': {str(e)}")
            return None
    
    async def _evaluate_condition(self, condition: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """Evaluate conditional expression"""
        
        field = condition.get("field", "")
        operator_type = condition.get("operator", "equals")
        value = condition.get("value")
        
        field_value = self._get_nested_value(data, field)
        
        if operator_type == "equals":
            return field_value == value
        elif operator_type == "not_equals":
            return field_value != value
        elif operator_type == "greater_than":
            return float(field_value) > float(value)
        elif operator_type == "less_than":
            return float(field_value) < float(value)
        elif operator_type == "contains":
            return str(value) in str(field_value)
        elif operator_type == "starts_with":
            return str(field_value).startswith(str(value))
        elif operator_type == "ends_with":
            return str(field_value).endswith(str(value))
        elif operator_type == "regex_match":
            return bool(re.search(str(value), str(field_value)))
        
        return False
    
    async def validate_config(self) -> List[str]:
        """Validate data mapper configuration"""
        
        errors = []
        
        # Check required fields
        if not self.config.get("mapping_rules"):
            errors.append("DataMapper requires 'mapping_rules' configuration")
        
        # Validate mapping rules structure
        mapping_rules = self.config.get("mapping_rules", {})
        for output_field, rule in mapping_rules.items():
            if isinstance(rule, dict):
                rule_type = rule.get("type", "field")
                
                if rule_type == "field" and not rule.get("field"):
                    errors.append(f"Field mapping rule for '{output_field}' missing 'field' property")
                elif rule_type == "expression" and not rule.get("expression"):
                    errors.append(f"Expression mapping rule for '{output_field}' missing 'expression' property")
                elif rule_type == "concat" and not rule.get("fields"):
                    errors.append(f"Concat mapping rule for '{output_field}' missing 'fields' property")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "mapping_rules": {
                    "type": "object",
                    "title": "Mapping Rules",
                    "description": "Rules for mapping input fields to output fields",
                    "additionalProperties": {
                        "oneOf": [
                            {"type": "string"},
                            {
                                "type": "object",
                                "properties": {
                                    "type": {"enum": ["field", "constant", "expression", "concat", "condition"]},
                                    "field": {"type": "string"},
                                    "value": {},
                                    "expression": {"type": "string"},
                                    "fields": {"type": "array", "items": {"type": "string"}},
                                    "separator": {"type": "string"},
                                    "transform": {
                                        "type": "object",
                                        "properties": {
                                            "type": {"enum": ["upper", "lower", "trim", "format", "regex_replace", "type_cast"]},
                                            "format": {"type": "string"},
                                            "pattern": {"type": "string"},
                                            "replacement": {"type": "string"},
                                            "target_type": {"enum": ["string", "int", "float", "boolean"]}
                                        }
                                    }
                                }
                            }
                        ]
                    }
                },
                "default_values": {
                    "type": "object",
                    "title": "Default Values",
                    "description": "Default values for output fields when mapping fails",
                    "additionalProperties": {}
                }
            },
            "required": ["mapping_rules"],
            "additionalProperties": False
        }


class CalculatorNode(TransformNode):
    """
    Perform calculations on input data
    
    Configuration:
    - formula: Mathematical formula to execute
    - input_fields: Fields to use in calculation
    - output_field: Name of output field
    - precision: Decimal precision for results
    """
    
    node_type = "Calculator"
    description = "Perform mathematical calculations on data fields"
    version = "1.0.0"
    
    # Safe operators for formula evaluation
    SAFE_OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Mod: operator.mod,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }
    
    # Safe functions
    SAFE_FUNCTIONS = {
        'abs': abs,
        'round': round,
        'min': min,
        'max': max,
        'sum': sum,
        'len': len,
    }
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute calculation"""
        
        formula = self.config.get("formula", "")
        input_fields = self.config.get("input_fields", [])
        output_field = self.config.get("output_field", "result")
        precision = self.config.get("precision", 2)
        
        # Extract values for calculation
        calculation_context = {}
        
        # Add input field values to context
        for field in input_fields:
            value = self._get_nested_value(input_data, field)
            if value is not None:
                try:
                    # Try to convert to number
                    if isinstance(value, str):
                        # Handle different number formats
                        cleaned_value = value.replace(",", "").strip()
                        if "." in cleaned_value:
                            calculation_context[field.replace(".", "_")] = float(cleaned_value)
                        else:
                            calculation_context[field.replace(".", "_")] = int(cleaned_value)
                    else:
                        calculation_context[field.replace(".", "_")] = float(value)
                except (ValueError, TypeError):
                    self.log("warning", f"Could not convert field '{field}' value '{value}' to number")
                    calculation_context[field.replace(".", "_")] = 0
        
        # Execute calculation
        try:
            result = await self._safe_eval(formula, calculation_context)
            
            # Apply precision if result is numeric
            if isinstance(result, (int, float)):
                if precision >= 0:
                    result = round(result, precision)
            
            return {
                output_field: result,
                "calculation_performed": True,
                "formula": formula,
                "input_values": calculation_context,
                "calculated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.log("error", f"Calculation failed: {str(e)}")
            return {
                output_field: None,
                "calculation_performed": False,
                "formula": formula,
                "error": str(e),
                "calculated_at": datetime.utcnow().isoformat()
            }
    
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
    
    async def _safe_eval(self, expression: str, context: Dict[str, Any]) -> Any:
        """Safely evaluate mathematical expression"""
        
        # Replace field names with underscores in expression
        safe_expression = expression
        for field in context:
            original_field = field.replace("_", ".")
            safe_expression = safe_expression.replace(original_field, field)
        
        try:
            # Parse expression into AST
            tree = ast.parse(safe_expression, mode='eval')
            
            # Evaluate AST with context
            return self._eval_ast_node(tree.body, context)
            
        except Exception as e:
            raise ValueError(f"Invalid formula: {str(e)}")
    
    def _eval_ast_node(self, node: ast.AST, context: Dict[str, Any]) -> Any:
        """Evaluate AST node safely"""
        
        if isinstance(node, ast.Constant):  # Numbers, strings
            return node.value
        
        elif isinstance(node, ast.Name):  # Variable names
            if node.id in context:
                return context[node.id]
            elif node.id in self.SAFE_FUNCTIONS:
                return self.SAFE_FUNCTIONS[node.id]
            else:
                raise ValueError(f"Unknown variable: {node.id}")
        
        elif isinstance(node, ast.BinOp):  # Binary operations
            left = self._eval_ast_node(node.left, context)
            right = self._eval_ast_node(node.right, context)
            op_type = type(node.op)
            
            if op_type in self.SAFE_OPERATORS:
                return self.SAFE_OPERATORS[op_type](left, right)
            else:
                raise ValueError(f"Unsupported operator: {op_type}")
        
        elif isinstance(node, ast.UnaryOp):  # Unary operations
            operand = self._eval_ast_node(node.operand, context)
            op_type = type(node.op)
            
            if op_type in self.SAFE_OPERATORS:
                return self.SAFE_OPERATORS[op_type](operand)
            else:
                raise ValueError(f"Unsupported unary operator: {op_type}")
        
        elif isinstance(node, ast.Call):  # Function calls
            func_name = node.func.id if isinstance(node.func, ast.Name) else None
            
            if func_name in self.SAFE_FUNCTIONS:
                args = [self._eval_ast_node(arg, context) for arg in node.args]
                return self.SAFE_FUNCTIONS[func_name](*args)
            else:
                raise ValueError(f"Unsupported function: {func_name}")
        
        else:
            raise ValueError(f"Unsupported AST node type: {type(node)}")
    
    async def validate_config(self) -> List[str]:
        """Validate calculator configuration"""
        
        errors = []
        
        # Check required fields
        if not self.config.get("formula"):
            errors.append("Calculator requires 'formula' field")
        
        if not self.config.get("input_fields"):
            errors.append("Calculator requires 'input_fields' list")
        
        if not self.config.get("output_field"):
            errors.append("Calculator requires 'output_field' name")
        
        # Validate formula syntax
        formula = self.config.get("formula", "")
        if formula:
            try:
                ast.parse(formula, mode='eval')
            except SyntaxError as e:
                errors.append(f"Invalid formula syntax: {str(e)}")
        
        # Validate precision
        precision = self.config.get("precision")
        if precision is not None and (not isinstance(precision, int) or precision < 0):
            errors.append("precision must be a non-negative integer")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "formula": {
                    "type": "string",
                    "title": "Formula",
                    "description": "Mathematical formula to execute (e.g., 'price * quantity * (1 + tax_rate)')",
                    "examples": [
                        "price * quantity",
                        "subtotal * (1 + tax_rate)",
                        "(revenue - costs) / revenue * 100"
                    ]
                },
                "input_fields": {
                    "type": "array",
                    "title": "Input Fields",
                    "description": "List of field paths to use in calculation",
                    "items": {"type": "string"},
                    "minItems": 1
                },
                "output_field": {
                    "type": "string",
                    "title": "Output Field",
                    "description": "Name for the calculated result field",
                    "default": "result"
                },
                "precision": {
                    "type": "integer",
                    "title": "Precision",
                    "description": "Number of decimal places for result (use -1 for no rounding)",
                    "default": 2,
                    "minimum": -1
                }
            },
            "required": ["formula", "input_fields", "output_field"],
            "additionalProperties": False
        }


class AggregatorNode(TransformNode):
    """
    Aggregate multiple data records
    
    Configuration:
    - group_by: Fields to group by
    - aggregation_method: How to aggregate (sum, avg, count, etc.)
    - target_field: Field to aggregate
    - output_structure: How to structure output
    """
    
    node_type = "Aggregator"
    description = "Aggregate multiple data records using various aggregation methods"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute data aggregation"""
        
        # Extract data to aggregate
        data_source = input_data.get("data", input_data)
        
        # Handle different input data structures
        if isinstance(data_source, dict):
            # Single record - convert to list
            records = [data_source]
        elif isinstance(data_source, list):
            # Multiple records
            records = data_source
        else:
            records = []
        
        if not records:
            return {
                "aggregated_data": {},
                "record_count": 0,
                "groups_count": 0,
                "aggregated_at": datetime.utcnow().isoformat()
            }
        
        group_by = self.config.get("group_by", [])
        aggregation_method = self.config.get("aggregation_method", "count")
        target_field = self.config.get("target_field", "")
        
        # Group records
        grouped_data = await self._group_records(records, group_by)
        
        # Aggregate each group
        aggregated_results = {}
        
        for group_key, group_records in grouped_data.items():
            aggregated_value = await self._aggregate_group(
                group_records, aggregation_method, target_field
            )
            
            # Structure the output
            if isinstance(group_key, tuple) and len(group_by) > 1:
                # Multiple grouping fields
                result_key = "_".join(str(k) for k in group_key)
                group_info = dict(zip(group_by, group_key))
            else:
                # Single grouping field or no grouping
                result_key = str(group_key) if group_key != "_all_" else "total"
                group_info = {group_by[0]: group_key} if group_by else {}
            
            aggregated_results[result_key] = {
                **group_info,
                "aggregated_value": aggregated_value,
                "record_count": len(group_records),
                "aggregation_method": aggregation_method
            }
        
        return {
            "aggregated_data": aggregated_results,
            "record_count": len(records),
            "groups_count": len(aggregated_results),
            "group_by_fields": group_by,
            "aggregation_method": aggregation_method,
            "target_field": target_field,
            "aggregated_at": datetime.utcnow().isoformat()
        }
    
    async def _group_records(self, records: List[Dict[str, Any]], group_by: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """Group records by specified fields"""
        
        if not group_by:
            # No grouping - all records in one group
            return {"_all_": records}
        
        groups = {}
        
        for record in records:
            # Build group key
            if len(group_by) == 1:
                group_key = self._get_nested_value(record, group_by[0])
                group_key = str(group_key) if group_key is not None else "null"
            else:
                group_values = []
                for field in group_by:
                    value = self._get_nested_value(record, field)
                    group_values.append(str(value) if value is not None else "null")
                group_key = tuple(group_values)
            
            # Add to group
            if group_key not in groups:
                groups[group_key] = []
            groups[group_key].append(record)
        
        return groups
    
    async def _aggregate_group(self, records: List[Dict[str, Any]], method: str, target_field: str) -> Any:
        """Aggregate a group of records using specified method"""
        
        if method == "count":
            return len(records)
        
        # Extract values for aggregation
        values = []
        for record in records:
            if target_field:
                value = self._get_nested_value(record, target_field)
                if value is not None:
                    try:
                        numeric_value = float(value)
                        values.append(numeric_value)
                    except (ValueError, TypeError):
                        pass
        
        if not values:
            return 0 if method in ["sum", "avg", "count"] else None
        
        if method == "sum":
            return sum(values)
        elif method == "avg":
            return sum(values) / len(values)
        elif method == "min":
            return min(values)
        elif method == "max":
            return max(values)
        elif method == "median":
            sorted_values = sorted(values)
            n = len(sorted_values)
            if n % 2 == 0:
                return (sorted_values[n//2 - 1] + sorted_values[n//2]) / 2
            else:
                return sorted_values[n//2]
        elif method == "distinct_count":
            return len(set(values))
        elif method == "first":
            return values[0] if values else None
        elif method == "last":
            return values[-1] if values else None
        
        return None
    
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
        """Validate aggregator configuration"""
        
        errors = []
        
        # Validate aggregation method
        valid_methods = ["count", "sum", "avg", "min", "max", "median", "distinct_count", "first", "last"]
        aggregation_method = self.config.get("aggregation_method", "count")
        
        if aggregation_method not in valid_methods:
            errors.append(f"Invalid aggregation_method '{aggregation_method}'. Must be one of: {', '.join(valid_methods)}")
        
        # Check if target field is required for the method
        target_field = self.config.get("target_field", "")
        requires_target = aggregation_method in ["sum", "avg", "min", "max", "median", "distinct_count", "first", "last"]
        
        if requires_target and not target_field:
            errors.append(f"Aggregation method '{aggregation_method}' requires 'target_field' to be specified")
        
        # Validate group_by is a list
        group_by = self.config.get("group_by", [])
        if not isinstance(group_by, list):
            errors.append("'group_by' must be a list of field names")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "group_by": {
                    "type": "array",
                    "title": "Group By",
                    "description": "Fields to group records by before aggregating",
                    "items": {"type": "string"},
                    "default": []
                },
                "aggregation_method": {
                    "type": "string",
                    "title": "Aggregation Method",
                    "description": "Method to use for aggregation",
                    "enum": ["count", "sum", "avg", "min", "max", "median", "distinct_count", "first", "last"],
                    "default": "count"
                },
                "target_field": {
                    "type": "string",
                    "title": "Target Field",
                    "description": "Field to aggregate (required for sum, avg, min, max, etc.)"
                },
                "output_structure": {
                    "type": "string",
                    "title": "Output Structure",
                    "description": "How to structure the aggregated output",
                    "enum": ["grouped", "flat", "summary"],
                    "default": "grouped"
                }
            },
            "required": ["aggregation_method"],
            "additionalProperties": False
        }