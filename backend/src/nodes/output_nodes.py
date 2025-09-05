"""
ConcertMaster Output Nodes
Nodes that send data to external systems, databases, and APIs
"""

from typing import Dict, Any, List, Optional
import httpx
import logging
import json
from datetime import datetime
import asyncio

from ..services.node_executor import OutputNode

logger = logging.getLogger(__name__)

class DatabaseWriteNode(OutputNode):
    """
    Write data to database
    
    Configuration:
    - connection: Database connection configuration
    - table: Target table name
    - operation: insert, update, upsert, delete
    - mapping: Field mapping from input to database
    """
    
    node_type = "DatabaseWrite"
    description = "Write data to a database table"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute database write operation"""
        
        connection_config = self.config.get("connection", {})
        table = self.config.get("table", "")
        operation = self.config.get("operation", "insert")
        mapping = self.config.get("mapping", {})
        
        # Map input data to database fields
        db_data = await self._map_data_to_db_fields(input_data, mapping)
        
        # Execute database operation
        try:
            result = await self._execute_database_operation(
                connection_config, table, operation, db_data
            )
            
            return {
                "database_write_successful": True,
                "operation": operation,
                "table": table,
                "rows_affected": result.get("rows_affected", 0),
                "inserted_id": result.get("inserted_id"),
                "executed_at": datetime.utcnow().isoformat(),
                "mapped_data": db_data
            }
            
        except Exception as e:
            self.log("error", f"Database write failed: {str(e)}")
            return {
                "database_write_successful": False,
                "operation": operation,
                "table": table,
                "error": str(e),
                "executed_at": datetime.utcnow().isoformat(),
                "mapped_data": db_data
            }
    
    async def _map_data_to_db_fields(self, input_data: Dict[str, Any], mapping: Dict[str, Any]) -> Dict[str, Any]:
        """Map input data to database field format"""
        
        mapped_data = {}
        
        for db_field, mapping_rule in mapping.items():
            if isinstance(mapping_rule, str):
                # Simple field mapping
                value = self._get_nested_value(input_data, mapping_rule)
            elif isinstance(mapping_rule, dict):
                # Complex mapping with transformation
                source_field = mapping_rule.get("source_field", "")
                value = self._get_nested_value(input_data, source_field)
                
                # Apply transformation if specified
                transform = mapping_rule.get("transform")
                if transform and value is not None:
                    value = await self._apply_transformation(value, transform)
                
                # Apply default value if needed
                if value is None:
                    value = mapping_rule.get("default_value")
            else:
                continue
            
            if value is not None:
                mapped_data[db_field] = value
        
        return mapped_data
    
    async def _apply_transformation(self, value: Any, transform: Dict[str, Any]) -> Any:
        """Apply transformation to a value"""
        
        transform_type = transform.get("type", "")
        
        if transform_type == "string_format":
            format_string = transform.get("format", "{}")
            return format_string.format(value)
        
        elif transform_type == "date_format":
            from datetime import datetime
            date_format = transform.get("format", "%Y-%m-%d %H:%M:%S")
            if isinstance(value, str):
                # Parse datetime string and reformat
                try:
                    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    return dt.strftime(date_format)
                except:
                    return value
            return value
        
        elif transform_type == "type_conversion":
            target_type = transform.get("target_type", "string")
            try:
                if target_type == "integer":
                    return int(float(value))
                elif target_type == "float":
                    return float(value)
                elif target_type == "string":
                    return str(value)
                elif target_type == "boolean":
                    return bool(value) and str(value).lower() not in ["false", "0", ""]
                elif target_type == "json":
                    return json.dumps(value) if not isinstance(value, str) else value
            except:
                return value
        
        return value
    
    async def _execute_database_operation(
        self,
        connection_config: Dict[str, Any],
        table: str,
        operation: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute the actual database operation"""
        
        # This is a simplified implementation
        # In production, would use proper database connections (SQLAlchemy, etc.)
        
        db_type = connection_config.get("type", "postgresql")
        
        if db_type == "postgresql":
            return await self._execute_postgresql_operation(connection_config, table, operation, data)
        elif db_type == "mysql":
            return await self._execute_mysql_operation(connection_config, table, operation, data)
        elif db_type == "sqlite":
            return await self._execute_sqlite_operation(connection_config, table, operation, data)
        else:
            raise ValueError(f"Unsupported database type: {db_type}")
    
    async def _execute_postgresql_operation(
        self,
        connection_config: Dict[str, Any],
        table: str,
        operation: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute PostgreSQL operation"""
        
        # Simulate database operation
        # In real implementation, would use asyncpg or SQLAlchemy
        
        if operation == "insert":
            # Simulate INSERT
            self.log("info", f"Simulated INSERT into {table}: {data}")
            return {
                "rows_affected": 1,
                "inserted_id": 12345,
                "operation": "insert"
            }
        
        elif operation == "update":
            # Simulate UPDATE
            where_clause = connection_config.get("where_clause", {})
            self.log("info", f"Simulated UPDATE {table} SET {data} WHERE {where_clause}")
            return {
                "rows_affected": 1,
                "operation": "update"
            }
        
        elif operation == "upsert":
            # Simulate UPSERT (INSERT ... ON CONFLICT UPDATE)
            self.log("info", f"Simulated UPSERT into {table}: {data}")
            return {
                "rows_affected": 1,
                "inserted_id": 12345,
                "operation": "upsert"
            }
        
        else:
            raise ValueError(f"Unsupported operation: {operation}")
    
    async def _execute_mysql_operation(
        self,
        connection_config: Dict[str, Any],
        table: str,
        operation: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute MySQL operation"""
        
        # Similar to PostgreSQL but with MySQL-specific logic
        self.log("info", f"Simulated MySQL {operation} on {table}: {data}")
        return {"rows_affected": 1, "operation": operation}
    
    async def _execute_sqlite_operation(
        self,
        connection_config: Dict[str, Any],
        table: str,
        operation: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute SQLite operation"""
        
        # Similar to PostgreSQL but with SQLite-specific logic
        self.log("info", f"Simulated SQLite {operation} on {table}: {data}")
        return {"rows_affected": 1, "operation": operation}
    
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
        """Validate database write configuration"""
        
        errors = []
        
        # Check required fields
        if not self.config.get("connection"):
            errors.append("DatabaseWrite requires 'connection' configuration")
        
        if not self.config.get("table"):
            errors.append("DatabaseWrite requires 'table' name")
        
        if not self.config.get("mapping"):
            errors.append("DatabaseWrite requires 'mapping' configuration")
        
        # Validate operation
        operation = self.config.get("operation", "insert")
        valid_operations = ["insert", "update", "upsert", "delete"]
        if operation not in valid_operations:
            errors.append(f"operation must be one of: {', '.join(valid_operations)}")
        
        # Validate connection config
        connection = self.config.get("connection", {})
        if connection and not connection.get("type"):
            errors.append("connection configuration requires 'type' field")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "connection": {
                    "type": "object",
                    "title": "Connection",
                    "description": "Database connection configuration",
                    "properties": {
                        "type": {"enum": ["postgresql", "mysql", "sqlite"], "description": "Database type"},
                        "host": {"type": "string", "description": "Database host"},
                        "port": {"type": "integer", "description": "Database port"},
                        "database": {"type": "string", "description": "Database name"},
                        "username": {"type": "string", "description": "Username"},
                        "password": {"type": "string", "description": "Password"},
                        "connection_string": {"type": "string", "description": "Full connection string"}
                    },
                    "required": ["type"]
                },
                "table": {
                    "type": "string",
                    "title": "Table",
                    "description": "Target table name"
                },
                "operation": {
                    "type": "string",
                    "title": "Operation",
                    "description": "Database operation to perform",
                    "enum": ["insert", "update", "upsert", "delete"],
                    "default": "insert"
                },
                "mapping": {
                    "type": "object",
                    "title": "Field Mapping",
                    "description": "Mapping from input fields to database columns",
                    "additionalProperties": {
                        "oneOf": [
                            {"type": "string"},
                            {
                                "type": "object",
                                "properties": {
                                    "source_field": {"type": "string"},
                                    "default_value": {},
                                    "transform": {
                                        "type": "object",
                                        "properties": {
                                            "type": {"enum": ["string_format", "date_format", "type_conversion"]},
                                            "format": {"type": "string"},
                                            "target_type": {"enum": ["integer", "float", "string", "boolean", "json"]}
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            "required": ["connection", "table", "mapping"],
            "additionalProperties": False
        }


class APICallNode(OutputNode):
    """
    Make HTTP API calls to external services
    
    Configuration:
    - endpoint: API endpoint URL
    - method: HTTP method (GET, POST, PUT, DELETE)
    - headers: HTTP headers to include
    - body_mapping: How to map input data to request body
    - authentication: Authentication configuration
    """
    
    node_type = "APICall"
    description = "Make HTTP API calls to external services"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute API call"""
        
        endpoint = self.config.get("endpoint", "")
        method = self.config.get("method", "POST").upper()
        headers = self.config.get("headers", {})
        body_mapping = self.config.get("body_mapping", {})
        auth_config = self.config.get("authentication", {})
        timeout = self.config.get("timeout", 30)
        
        # Prepare request body
        request_body = await self._prepare_request_body(input_data, body_mapping)
        
        # Prepare headers with authentication
        request_headers = await self._prepare_headers(headers, auth_config)
        
        # Make API call
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(
                    method=method,
                    url=endpoint,
                    headers=request_headers,
                    json=request_body if method in ["POST", "PUT", "PATCH"] else None,
                    params=request_body if method == "GET" else None
                )
                
                # Parse response
                response_data = await self._parse_response(response)
                
                return {
                    "api_call_successful": True,
                    "endpoint": endpoint,
                    "method": method,
                    "status_code": response.status_code,
                    "response_data": response_data,
                    "request_body": request_body,
                    "executed_at": datetime.utcnow().isoformat()
                }
        
        except Exception as e:
            self.log("error", f"API call failed: {str(e)}")
            return {
                "api_call_successful": False,
                "endpoint": endpoint,
                "method": method,
                "error": str(e),
                "request_body": request_body,
                "executed_at": datetime.utcnow().isoformat()
            }
    
    async def _prepare_request_body(self, input_data: Dict[str, Any], body_mapping: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare request body from input data"""
        
        if not body_mapping:
            # No mapping - use input data directly
            return input_data.get("data", input_data)
        
        request_body = {}
        
        for api_field, mapping_rule in body_mapping.items():
            if isinstance(mapping_rule, str):
                # Simple field mapping
                value = self._get_nested_value(input_data, mapping_rule)
            elif isinstance(mapping_rule, dict):
                # Complex mapping
                source_field = mapping_rule.get("source_field", "")
                value = self._get_nested_value(input_data, source_field)
                
                # Apply transformation if specified
                transform = mapping_rule.get("transform")
                if transform and value is not None:
                    value = await self._apply_transformation(value, transform)
                
                # Apply default value if needed
                if value is None:
                    value = mapping_rule.get("default_value")
            else:
                value = mapping_rule  # Literal value
            
            if value is not None:
                request_body[api_field] = value
        
        return request_body
    
    async def _prepare_headers(self, base_headers: Dict[str, str], auth_config: Dict[str, Any]) -> Dict[str, str]:
        """Prepare HTTP headers including authentication"""
        
        headers = dict(base_headers)
        
        # Add content type if not specified
        if "Content-Type" not in headers and "content-type" not in headers:
            headers["Content-Type"] = "application/json"
        
        # Add authentication
        auth_type = auth_config.get("type", "none")
        
        if auth_type == "bearer":
            token = auth_config.get("token", "")
            headers["Authorization"] = f"Bearer {token}"
        
        elif auth_type == "api_key":
            key = auth_config.get("key", "")
            header_name = auth_config.get("header", "X-API-Key")
            headers[header_name] = key
        
        elif auth_type == "basic":
            username = auth_config.get("username", "")
            password = auth_config.get("password", "")
            import base64
            credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
            headers["Authorization"] = f"Basic {credentials}"
        
        return headers
    
    async def _parse_response(self, response: httpx.Response) -> Dict[str, Any]:
        """Parse API response"""
        
        try:
            # Try to parse as JSON first
            return response.json()
        except:
            # Fall back to text response
            return {
                "text": response.text,
                "content_type": response.headers.get("Content-Type", ""),
                "raw_response": True
            }
    
    async def _apply_transformation(self, value: Any, transform: Dict[str, Any]) -> Any:
        """Apply transformation to a value"""
        
        transform_type = transform.get("type", "")
        
        if transform_type == "format":
            format_string = transform.get("format", "{}")
            return format_string.format(value)
        
        elif transform_type == "json_serialize":
            return json.dumps(value) if not isinstance(value, str) else value
        
        elif transform_type == "url_encode":
            import urllib.parse
            return urllib.parse.quote(str(value))
        
        return value
    
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
        """Validate API call configuration"""
        
        errors = []
        
        # Check required fields
        if not self.config.get("endpoint"):
            errors.append("APICall requires 'endpoint' URL")
        
        # Validate HTTP method
        method = self.config.get("method", "POST")
        valid_methods = ["GET", "POST", "PUT", "PATCH", "DELETE"]
        if method.upper() not in valid_methods:
            errors.append(f"method must be one of: {', '.join(valid_methods)}")
        
        # Validate endpoint URL format
        endpoint = self.config.get("endpoint", "")
        if endpoint and not (endpoint.startswith("http://") or endpoint.startswith("https://")):
            errors.append("endpoint must be a valid HTTP/HTTPS URL")
        
        # Validate authentication config
        auth_config = self.config.get("authentication", {})
        if auth_config:
            auth_type = auth_config.get("type", "none")
            valid_auth_types = ["none", "bearer", "api_key", "basic"]
            
            if auth_type not in valid_auth_types:
                errors.append(f"authentication type must be one of: {', '.join(valid_auth_types)}")
            
            if auth_type == "bearer" and not auth_config.get("token"):
                errors.append("Bearer authentication requires 'token' field")
            
            if auth_type == "api_key" and not auth_config.get("key"):
                errors.append("API key authentication requires 'key' field")
            
            if auth_type == "basic":
                if not auth_config.get("username"):
                    errors.append("Basic authentication requires 'username' field")
                if not auth_config.get("password"):
                    errors.append("Basic authentication requires 'password' field")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "endpoint": {
                    "type": "string",
                    "title": "Endpoint URL",
                    "description": "API endpoint URL to call",
                    "format": "uri"
                },
                "method": {
                    "type": "string",
                    "title": "HTTP Method",
                    "description": "HTTP method to use",
                    "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"],
                    "default": "POST"
                },
                "headers": {
                    "type": "object",
                    "title": "Headers",
                    "description": "HTTP headers to include in request",
                    "additionalProperties": {"type": "string"}
                },
                "body_mapping": {
                    "type": "object",
                    "title": "Body Mapping",
                    "description": "How to map input data to request body",
                    "additionalProperties": {
                        "oneOf": [
                            {"type": "string"},
                            {
                                "type": "object",
                                "properties": {
                                    "source_field": {"type": "string"},
                                    "default_value": {},
                                    "transform": {
                                        "type": "object",
                                        "properties": {
                                            "type": {"enum": ["format", "json_serialize", "url_encode"]},
                                            "format": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        ]
                    }
                },
                "authentication": {
                    "type": "object",
                    "title": "Authentication",
                    "description": "Authentication configuration",
                    "properties": {
                        "type": {"enum": ["none", "bearer", "api_key", "basic"]},
                        "token": {"type": "string", "description": "Bearer token"},
                        "key": {"type": "string", "description": "API key"},
                        "header": {"type": "string", "description": "Header name for API key"},
                        "username": {"type": "string", "description": "Username for basic auth"},
                        "password": {"type": "string", "description": "Password for basic auth"}
                    },
                    "required": ["type"]
                },
                "timeout": {
                    "type": "number",
                    "title": "Timeout",
                    "description": "Request timeout in seconds",
                    "default": 30,
                    "minimum": 1
                }
            },
            "required": ["endpoint"],
            "additionalProperties": False
        }


class ERPExportNode(OutputNode):
    """
    Export data to ERP systems (SAP, Oracle, NetSuite, etc.)
    
    Configuration:
    - system_type: Type of ERP system
    - connection_details: ERP connection configuration
    - mapping: Data mapping to ERP format
    - export_mode: How to export data (create, update, batch)
    """
    
    node_type = "ERPExport"
    description = "Export data to ERP systems like SAP, Oracle, or NetSuite"
    version = "1.0.0"
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute ERP export"""
        
        system_type = self.config.get("system_type", "").upper()
        connection_details = self.config.get("connection_details", {})
        mapping = self.config.get("mapping", {})
        export_mode = self.config.get("export_mode", "create")
        
        # Map data to ERP format
        erp_data = await self._map_data_to_erp_format(input_data, mapping, system_type)
        
        # Execute ERP export
        try:
            if system_type == "SAP":
                result = await self._export_to_sap(connection_details, erp_data, export_mode)
            elif system_type == "ORACLE":
                result = await self._export_to_oracle(connection_details, erp_data, export_mode)
            elif system_type == "NETSUITE":
                result = await self._export_to_netsuite(connection_details, erp_data, export_mode)
            else:
                result = await self._export_generic_api(connection_details, erp_data, export_mode)
            
            return {
                "erp_export_successful": True,
                "system_type": system_type,
                "export_mode": export_mode,
                "records_processed": result.get("records_processed", 1),
                "erp_response": result.get("response", {}),
                "mapped_data": erp_data,
                "executed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.log("error", f"ERP export failed: {str(e)}")
            return {
                "erp_export_successful": False,
                "system_type": system_type,
                "export_mode": export_mode,
                "error": str(e),
                "mapped_data": erp_data,
                "executed_at": datetime.utcnow().isoformat()
            }
    
    async def _map_data_to_erp_format(
        self,
        input_data: Dict[str, Any],
        mapping: Dict[str, Any],
        system_type: str
    ) -> Dict[str, Any]:
        """Map data to ERP-specific format"""
        
        erp_data = {}
        
        for erp_field, mapping_rule in mapping.items():
            value = None
            
            if isinstance(mapping_rule, str):
                # Simple field mapping
                value = self._get_nested_value(input_data, mapping_rule)
            elif isinstance(mapping_rule, dict):
                # Complex mapping with ERP-specific formatting
                source_field = mapping_rule.get("source_field", "")
                value = self._get_nested_value(input_data, source_field)
                
                # Apply ERP-specific transformations
                transform = mapping_rule.get("transform")
                if transform and value is not None:
                    value = await self._apply_erp_transformation(value, transform, system_type)
                
                if value is None:
                    value = mapping_rule.get("default_value")
            
            if value is not None:
                erp_data[erp_field] = value
        
        return erp_data
    
    async def _apply_erp_transformation(self, value: Any, transform: Dict[str, Any], system_type: str) -> Any:
        """Apply ERP-specific data transformations"""
        
        transform_type = transform.get("type", "")
        
        if transform_type == "sap_date":
            # SAP date format: YYYYMMDD
            from datetime import datetime
            if isinstance(value, str):
                try:
                    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    return dt.strftime("%Y%m%d")
                except:
                    return value
        
        elif transform_type == "currency_format":
            # Format currency for ERP systems
            try:
                amount = float(value)
                decimal_places = transform.get("decimal_places", 2)
                return round(amount, decimal_places)
            except:
                return value
        
        elif transform_type == "erp_boolean":
            # ERP boolean format (often X/'' or Y/N)
            boolean_format = transform.get("format", "X_blank")
            if boolean_format == "X_blank":
                return "X" if bool(value) else ""
            elif boolean_format == "Y_N":
                return "Y" if bool(value) else "N"
            else:
                return bool(value)
        
        elif transform_type == "pad_zeros":
            # Pad with leading zeros (common for ERP IDs)
            length = transform.get("length", 10)
            return str(value).zfill(length)
        
        return value
    
    async def _export_to_sap(
        self,
        connection_details: Dict[str, Any],
        data: Dict[str, Any],
        export_mode: str
    ) -> Dict[str, Any]:
        """Export data to SAP system"""
        
        # Simulate SAP export
        # In real implementation, would use SAP RFC or REST APIs
        
        sap_endpoint = connection_details.get("endpoint", "")
        client = connection_details.get("client", "")
        
        self.log("info", f"Simulated SAP export to client {client}: {data}")
        
        return {
            "records_processed": 1,
            "response": {
                "status": "SUCCESS",
                "document_number": "SAP_DOC_123456",
                "message": "Document created successfully"
            }
        }
    
    async def _export_to_oracle(
        self,
        connection_details: Dict[str, Any],
        data: Dict[str, Any],
        export_mode: str
    ) -> Dict[str, Any]:
        """Export data to Oracle ERP system"""
        
        # Simulate Oracle export
        self.log("info", f"Simulated Oracle ERP export: {data}")
        
        return {
            "records_processed": 1,
            "response": {
                "status": "SUCCESS",
                "transaction_id": "ORA_TXN_789123"
            }
        }
    
    async def _export_to_netsuite(
        self,
        connection_details: Dict[str, Any],
        data: Dict[str, Any],
        export_mode: str
    ) -> Dict[str, Any]:
        """Export data to NetSuite system"""
        
        # Simulate NetSuite export
        self.log("info", f"Simulated NetSuite export: {data}")
        
        return {
            "records_processed": 1,
            "response": {
                "status": "SUCCESS",
                "internal_id": "NS_ID_456789"
            }
        }
    
    async def _export_generic_api(
        self,
        connection_details: Dict[str, Any],
        data: Dict[str, Any],
        export_mode: str
    ) -> Dict[str, Any]:
        """Export via generic REST API"""
        
        # Use APICallNode logic for generic ERP APIs
        endpoint = connection_details.get("api_endpoint", "")
        
        if endpoint:
            # Make HTTP API call
            async with httpx.AsyncClient() as client:
                response = await client.post(endpoint, json=data)
                return {
                    "records_processed": 1,
                    "response": response.json() if response.status_code == 200 else {"error": response.text}
                }
        
        return {"records_processed": 0, "response": {"error": "No API endpoint configured"}}
    
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
        """Validate ERP export configuration"""
        
        errors = []
        
        # Check required fields
        if not self.config.get("system_type"):
            errors.append("ERPExport requires 'system_type' field")
        
        if not self.config.get("connection_details"):
            errors.append("ERPExport requires 'connection_details' configuration")
        
        if not self.config.get("mapping"):
            errors.append("ERPExport requires 'mapping' configuration")
        
        # Validate system type
        system_type = self.config.get("system_type", "").upper()
        valid_systems = ["SAP", "ORACLE", "NETSUITE", "GENERIC"]
        if system_type not in valid_systems:
            errors.append(f"system_type must be one of: {', '.join(valid_systems)}")
        
        # Validate export mode
        export_mode = self.config.get("export_mode", "create")
        valid_modes = ["create", "update", "upsert", "batch"]
        if export_mode not in valid_modes:
            errors.append(f"export_mode must be one of: {', '.join(valid_modes)}")
        
        return errors
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema"""
        
        return {
            "type": "object",
            "properties": {
                "system_type": {
                    "type": "string",
                    "title": "System Type",
                    "description": "Type of ERP system",
                    "enum": ["SAP", "Oracle", "NetSuite", "Generic"],
                    "default": "Generic"
                },
                "connection_details": {
                    "type": "object",
                    "title": "Connection Details",
                    "description": "ERP system connection configuration",
                    "properties": {
                        "endpoint": {"type": "string", "description": "API endpoint URL"},
                        "client": {"type": "string", "description": "SAP client number"},
                        "username": {"type": "string", "description": "Username"},
                        "password": {"type": "string", "description": "Password"},
                        "api_key": {"type": "string", "description": "API key for authentication"}
                    }
                },
                "mapping": {
                    "type": "object",
                    "title": "Field Mapping",
                    "description": "Mapping from input fields to ERP fields",
                    "additionalProperties": {
                        "oneOf": [
                            {"type": "string"},
                            {
                                "type": "object",
                                "properties": {
                                    "source_field": {"type": "string"},
                                    "default_value": {},
                                    "transform": {
                                        "type": "object",
                                        "properties": {
                                            "type": {"enum": ["sap_date", "currency_format", "erp_boolean", "pad_zeros"]},
                                            "format": {"type": "string"},
                                            "decimal_places": {"type": "integer"},
                                            "length": {"type": "integer"}
                                        }
                                    }
                                }
                            }
                        ]
                    }
                },
                "export_mode": {
                    "type": "string",
                    "title": "Export Mode",
                    "description": "How to export data to ERP",
                    "enum": ["create", "update", "upsert", "batch"],
                    "default": "create"
                }
            },
            "required": ["system_type", "connection_details", "mapping"],
            "additionalProperties": False
        }