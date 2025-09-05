"""
Node Router - REST API endpoints for workflow node management
Provides information about available node types, schemas, and validation.
"""

import logging
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from ...services.node_executor import NodeExecutor
from ...auth.security import get_current_user
from ...schemas.node import NodeTypeResponse, NodeSchemaResponse, NodeValidationRequest, NodeValidationResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize node executor
node_executor = NodeExecutor()


@router.get("/types", response_model=List[NodeTypeResponse])
async def get_node_types(
    category: Optional[str] = Query(None, description="Filter by node category"),
    current_user = Depends(get_current_user)
):
    """Get all available node types"""
    try:
        # Get all available nodes organized by category
        nodes_by_category = node_executor.get_available_nodes()
        
        # Flatten and filter if category specified
        node_types = []
        for cat, nodes in nodes_by_category.items():
            if category and cat != category:
                continue
            
            for node in nodes:
                node_types.append(NodeTypeResponse(
                    type=node["type"],
                    category=node["category"],
                    description=node["description"],
                    version=node["version"],
                    class_name=node["class_name"]
                ))
        
        return node_types
        
    except Exception as e:
        logger.error(f"Failed to get node types: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get node types"
        )


@router.get("/categories")
async def get_node_categories(
    current_user = Depends(get_current_user)
):
    """Get all available node categories"""
    try:
        nodes_by_category = node_executor.get_available_nodes()
        
        categories = []
        for category, nodes in nodes_by_category.items():
            categories.append({
                "category": category,
                "node_count": len(nodes),
                "description": f"Node category for {category} operations"
            })
        
        return {
            "categories": categories,
            "total_categories": len(categories)
        }
        
    except Exception as e:
        logger.error(f"Failed to get node categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get node categories"
        )


@router.get("/{node_type}/schema", response_model=NodeSchemaResponse)
async def get_node_schema(
    node_type: str,
    current_user = Depends(get_current_user)
):
    """Get configuration schema for a specific node type"""
    try:
        schema = await node_executor.get_node_schema(node_type)
        
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node type '{node_type}' not found"
            )
        
        # Get node info for additional details
        node_info = node_executor.registry.get_node_info(node_type)
        
        return NodeSchemaResponse(
            node_type=node_type,
            schema=schema,
            category=node_info["category"] if node_info else "unknown",
            description=node_info["description"] if node_info else "",
            version=node_info["version"] if node_info else "1.0.0"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get schema for node type {node_type}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get node schema"
        )


@router.post("/validate", response_model=NodeValidationResponse)
async def validate_node_config(
    validation_request: NodeValidationRequest,
    current_user = Depends(get_current_user)
):
    """Validate node configuration against schema"""
    try:
        errors = await node_executor.validate_node_config(
            validation_request.node_type,
            validation_request.config
        )
        
        is_valid = len(errors) == 0
        
        return NodeValidationResponse(
            node_type=validation_request.node_type,
            config=validation_request.config,
            is_valid=is_valid,
            errors=errors,
            warnings=[]  # Could add warnings in the future
        )
        
    except Exception as e:
        logger.error(f"Failed to validate node config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate node configuration"
        )


@router.get("/{node_type}/examples")
async def get_node_examples(
    node_type: str,
    current_user = Depends(get_current_user)
):
    """Get example configurations for a node type"""
    try:
        # Check if node type exists
        node_class = node_executor.registry.get(node_type)
        if not node_class:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node type '{node_type}' not found"
            )
        
        # Generate example configurations based on node type
        examples = await _generate_node_examples(node_type)
        
        return {
            "node_type": node_type,
            "examples": examples
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get examples for node type {node_type}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get node examples"
        )


@router.get("/execution/history")
async def get_execution_history(
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get node execution history"""
    try:
        history = node_executor.get_execution_history(limit=limit, status=status_filter)
        
        return {
            "history": history,
            "total_records": len(history),
            "filter": {
                "limit": limit,
                "status": status_filter
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get execution history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get execution history"
        )


@router.get("/execution/stats")
async def get_execution_stats(
    current_user = Depends(get_current_user)
):
    """Get node execution statistics"""
    try:
        stats = node_executor.get_execution_stats()
        
        return {
            "stats": stats,
            "success_rate_percentage": round(stats["success_rate"] * 100, 2)
        }
        
    except Exception as e:
        logger.error(f"Failed to get execution stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get execution statistics"
        )


@router.post("/test")
async def test_node_execution(
    test_request: Dict[str, Any],
    current_user = Depends(get_current_user)
):
    """Test node execution with provided configuration and input data"""
    try:
        node_type = test_request.get("node_type")
        config = test_request.get("config", {})
        input_data = test_request.get("input_data", {})
        timeout = test_request.get("timeout", 30.0)
        
        if not node_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="node_type is required"
            )
        
        # Execute the node in test mode
        try:
            output_data = await node_executor.execute_node(
                node_type=node_type,
                config=config,
                input_data=input_data,
                timeout=timeout
            )
            
            return {
                "success": True,
                "node_type": node_type,
                "output_data": output_data,
                "execution_info": "Test execution completed successfully"
            }
            
        except Exception as execution_error:
            return {
                "success": False,
                "node_type": node_type,
                "error": str(execution_error),
                "error_type": type(execution_error).__name__,
                "execution_info": "Test execution failed"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test node execution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test node execution"
        )


@router.get("/templates")
async def get_node_templates(
    category: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get pre-built node configuration templates"""
    try:
        templates = await _get_node_templates(category)
        
        return {
            "templates": templates,
            "total_templates": len(templates),
            "category_filter": category
        }
        
    except Exception as e:
        logger.error(f"Failed to get node templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get node templates"
        )


async def _generate_node_examples(node_type: str) -> List[Dict[str, Any]]:
    """Generate example configurations for a node type"""
    
    examples = []
    
    # Basic examples based on node type
    if "trigger" in node_type.lower():
        if "schedule" in node_type.lower():
            examples.append({
                "name": "Daily at 9 AM",
                "description": "Trigger workflow every day at 9 AM",
                "config": {
                    "id": "daily_9am",
                    "cron": "0 9 * * *",
                    "timezone": "UTC"
                }
            })
            examples.append({
                "name": "Weekly on Monday",
                "description": "Trigger workflow every Monday at 10 AM",
                "config": {
                    "id": "weekly_monday",
                    "cron": "0 10 * * 1",
                    "timezone": "America/New_York"
                }
            })
        
        elif "webhook" in node_type.lower():
            examples.append({
                "name": "Simple webhook",
                "description": "Basic webhook trigger",
                "config": {
                    "id": "simple_webhook",
                    "endpoint_path": "/webhook/simple",
                    "authentication": {"type": "none"}
                }
            })
    
    elif "transform" in node_type.lower():
        if "mapper" in node_type.lower():
            examples.append({
                "name": "Field mapping",
                "description": "Map fields from input to output format",
                "config": {
                    "id": "field_mapper",
                    "mappings": [
                        {"source": "firstName", "target": "first_name"},
                        {"source": "lastName", "target": "last_name"}
                    ]
                }
            })
        
        elif "calculator" in node_type.lower():
            examples.append({
                "name": "Simple calculation",
                "description": "Calculate total from input values",
                "config": {
                    "id": "total_calc",
                    "formula": "input.price * input.quantity",
                    "output_field": "total"
                }
            })
    
    elif "output" in node_type.lower():
        if "database" in node_type.lower():
            examples.append({
                "name": "Insert record",
                "description": "Insert data into database table",
                "config": {
                    "id": "db_insert",
                    "connection": "default",
                    "table": "users",
                    "operation": "insert"
                }
            })
    
    # If no specific examples, provide a generic one
    if not examples:
        examples.append({
            "name": "Basic configuration",
            "description": f"Basic configuration for {node_type}",
            "config": {
                "id": f"basic_{node_type.lower().replace(' ', '_')}"
            }
        })
    
    return examples


async def _get_node_templates(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get pre-built node configuration templates"""
    
    templates = [
        {
            "id": "email_notification",
            "name": "Email Notification",
            "category": "output",
            "description": "Send email notifications to users",
            "node_type": "EmailNotificationNode",
            "config": {
                "id": "email_notification",
                "recipient": "{{workflow.variables.email}}",
                "subject": "Workflow Completed",
                "template": "default_notification"
            }
        },
        {
            "id": "data_validation",
            "name": "Data Validation",
            "category": "transform",
            "description": "Validate incoming data against schema",
            "node_type": "DataValidatorNode",
            "config": {
                "id": "data_validator",
                "schema": {
                    "type": "object",
                    "required": ["name", "email"]
                },
                "strict": True
            }
        },
        {
            "id": "conditional_branch",
            "name": "Conditional Branch",
            "category": "logic",
            "description": "Branch workflow based on condition",
            "node_type": "ConditionalNode",
            "config": {
                "id": "conditional_branch",
                "condition": "input.score > 80",
                "true_branch": "approval_path",
                "false_branch": "review_path"
            }
        }
    ]
    
    # Filter by category if specified
    if category:
        templates = [t for t in templates if t["category"] == category]
    
    return templates