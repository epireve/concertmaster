# Phase 2: Visual Builder - Technical Integration Specifications
*ConcertMaster - Data Orchestration Platform*

## Integration Overview

This document defines the technical integration points between Phase 2 Visual Builder components and existing Phase 1 Core Engine infrastructure, ensuring seamless communication and data flow.

---

## 1. Backend API Integration

### 1.1 Enhanced Node Management API

#### Node Discovery & Metadata
```python
# backend/src/api/routers/node_router.py
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel

class NodeSearchRequest(BaseModel):
    query: Optional[str] = None
    categories: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    favorites_only: Optional[bool] = False
    limit: int = 50
    offset: int = 0

class NodeDefinitionResponse(BaseModel):
    type: str
    category: str
    label: str
    description: str
    icon: str
    color: str
    version: str
    inputs: List[str]
    outputs: List[str]
    schema: Dict[str, Any]
    examples: List[Dict[str, Any]]
    tags: List[str]
    is_custom: bool = False
    is_deprecated: bool = False

router = APIRouter(prefix="/api/nodes", tags=["nodes"])

@router.get("/search", response_model=List[NodeDefinitionResponse])
async def search_nodes(
    request: NodeSearchRequest = Depends(),
    current_user: User = Depends(get_current_user)
):
    """Enhanced node search with filtering and favorites"""
    nodes = await node_service.search_nodes(
        query=request.query,
        categories=request.categories,
        tags=request.tags,
        user_id=current_user.id if request.favorites_only else None,
        limit=request.limit,
        offset=request.offset
    )
    return nodes

@router.get("/categories", response_model=List[Dict[str, Any]])
async def get_node_categories():
    """Get all node categories with counts"""
    categories = await node_service.get_categories_with_counts()
    return categories

@router.get("/{node_type}/schema", response_model=Dict[str, Any])
async def get_node_schema(node_type: str):
    """Get JSON schema for node configuration"""
    schema = await node_service.get_node_schema(node_type)
    if not schema:
        raise HTTPException(404, "Node type not found")
    return schema

@router.post("/{node_type}/validate")
async def validate_node_config(
    node_type: str,
    config: Dict[str, Any]
):
    """Validate node configuration against schema"""
    validation_result = await node_service.validate_config(node_type, config)
    return validation_result
```

#### User Favorites Management
```python
# backend/src/api/routers/favorites_router.py
@router.get("/nodes", response_model=List[str])
async def get_favorite_nodes(current_user: User = Depends(get_current_user)):
    """Get user's favorite node types"""
    favorites = await favorites_service.get_user_favorites(
        current_user.id, "node"
    )
    return [f.item_id for f in favorites]

@router.post("/nodes/{node_type}")
async def add_favorite_node(
    node_type: str,
    current_user: User = Depends(get_current_user)
):
    """Add node to user favorites"""
    await favorites_service.add_favorite(
        current_user.id, "node", node_type
    )
    return {"status": "added"}

@router.delete("/nodes/{node_type}")
async def remove_favorite_node(
    node_type: str,
    current_user: User = Depends(get_current_user)
):
    """Remove node from user favorites"""
    await favorites_service.remove_favorite(
        current_user.id, "node", node_type
    )
    return {"status": "removed"}
```

### 1.2 Real-time Collaboration API

#### WebSocket Connection Manager
```python
# backend/src/services/collaboration_service.py
from typing import Dict, Set, List
from fastapi import WebSocket
import json
import asyncio
from datetime import datetime

class CollaborationManager:
    def __init__(self):
        # workflow_id -> Set[WebSocket connections]
        self.active_sessions: Dict[str, Set[WebSocket]] = {}
        # connection_id -> user info
        self.user_sessions: Dict[str, Dict[str, any]] = {}
        # workflow_id -> edit history
        self.edit_history: Dict[str, List[Dict[str, any]]] = {}

    async def connect(self, websocket: WebSocket, workflow_id: str, user_id: str):
        """Connect user to collaborative session"""
        await websocket.accept()
        
        if workflow_id not in self.active_sessions:
            self.active_sessions[workflow_id] = set()
        
        self.active_sessions[workflow_id].add(websocket)
        connection_id = f"{user_id}_{id(websocket)}"
        
        self.user_sessions[connection_id] = {
            "user_id": user_id,
            "workflow_id": workflow_id,
            "websocket": websocket,
            "joined_at": datetime.utcnow()
        }

        # Notify other users of new connection
        await self.broadcast_to_workflow(workflow_id, {
            "type": "user_joined",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }, exclude_websocket=websocket)

        return connection_id

    async def disconnect(self, connection_id: str):
        """Handle user disconnection"""
        if connection_id not in self.user_sessions:
            return
        
        session_info = self.user_sessions[connection_id]
        workflow_id = session_info["workflow_id"]
        user_id = session_info["user_id"]
        websocket = session_info["websocket"]
        
        # Remove from active sessions
        if workflow_id in self.active_sessions:
            self.active_sessions[workflow_id].discard(websocket)
            if not self.active_sessions[workflow_id]:
                del self.active_sessions[workflow_id]
        
        del self.user_sessions[connection_id]
        
        # Notify other users of disconnection
        await self.broadcast_to_workflow(workflow_id, {
            "type": "user_left",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def handle_message(self, connection_id: str, message: str):
        """Process incoming collaboration message"""
        try:
            data = json.loads(message)
            session_info = self.user_sessions.get(connection_id)
            if not session_info:
                return
            
            workflow_id = session_info["workflow_id"]
            user_id = session_info["user_id"]
            
            # Add user and timestamp to message
            data["user_id"] = user_id
            data["timestamp"] = datetime.utcnow().isoformat()
            
            # Handle different message types
            if data["type"] == "cursor_update":
                await self.handle_cursor_update(workflow_id, data)
            elif data["type"] == "selection_update":
                await self.handle_selection_update(workflow_id, data)
            elif data["type"] == "workflow_edit":
                await self.handle_workflow_edit(workflow_id, data)
            
        except json.JSONDecodeError:
            # Invalid JSON - ignore
            pass
        except Exception as e:
            logger.error(f"Error handling collaboration message: {e}")

    async def handle_cursor_update(self, workflow_id: str, data: Dict):
        """Handle cursor position updates"""
        # Broadcast cursor update to other users
        await self.broadcast_to_workflow(
            workflow_id, 
            data, 
            exclude_user_id=data["user_id"]
        )

    async def handle_selection_update(self, workflow_id: str, data: Dict):
        """Handle selection updates"""
        await self.broadcast_to_workflow(
            workflow_id, 
            data, 
            exclude_user_id=data["user_id"]
        )

    async def handle_workflow_edit(self, workflow_id: str, data: Dict):
        """Handle workflow edit operations"""
        # Store in edit history
        if workflow_id not in self.edit_history:
            self.edit_history[workflow_id] = []
        
        self.edit_history[workflow_id].append(data)
        
        # Apply edit to database
        await self.apply_workflow_edit(workflow_id, data)
        
        # Broadcast to other users
        await self.broadcast_to_workflow(
            workflow_id, 
            data, 
            exclude_user_id=data["user_id"]
        )

    async def apply_workflow_edit(self, workflow_id: str, edit_data: Dict):
        """Apply edit operation to workflow in database"""
        try:
            operation = edit_data.get("operation")
            target = edit_data.get("target")  # 'node' or 'edge'
            payload = edit_data.get("payload")
            
            if operation == "add" and target == "node":
                # Add new node to workflow
                await workflow_service.add_node_to_workflow(
                    workflow_id, payload
                )
            elif operation == "update" and target == "node":
                # Update existing node
                await workflow_service.update_workflow_node(
                    workflow_id, payload["node_id"], payload
                )
            elif operation == "delete" and target == "node":
                # Delete node from workflow
                await workflow_service.remove_node_from_workflow(
                    workflow_id, payload["node_id"]
                )
            elif operation == "add" and target == "edge":
                # Add new edge
                await workflow_service.add_edge_to_workflow(
                    workflow_id, payload
                )
            elif operation == "delete" and target == "edge":
                # Delete edge
                await workflow_service.remove_edge_from_workflow(
                    workflow_id, payload["edge_id"]
                )
                
        except Exception as e:
            logger.error(f"Error applying workflow edit: {e}")

    async def broadcast_to_workflow(
        self, 
        workflow_id: str, 
        message: Dict, 
        exclude_websocket: WebSocket = None,
        exclude_user_id: str = None
    ):
        """Broadcast message to all users in workflow session"""
        if workflow_id not in self.active_sessions:
            return
        
        message_str = json.dumps(message)
        disconnected = []
        
        for websocket in self.active_sessions[workflow_id]:
            # Skip excluded websocket
            if websocket == exclude_websocket:
                continue
            
            # Skip excluded user
            if exclude_user_id:
                session = next(
                    (s for s in self.user_sessions.values() 
                     if s["websocket"] == websocket), 
                    None
                )
                if session and session["user_id"] == exclude_user_id:
                    continue
            
            try:
                await websocket.send_text(message_str)
            except:
                # Connection lost - mark for cleanup
                disconnected.append(websocket)
        
        # Clean up disconnected websockets
        for websocket in disconnected:
            self.active_sessions[workflow_id].discard(websocket)

# Global collaboration manager instance
collaboration_manager = CollaborationManager()
```

#### WebSocket Endpoint
```python
# backend/src/api/websocket.py
from fastapi import WebSocket, WebSocketDisconnect, Depends
from fastapi.routing import APIRouter
from backend.src.auth.security import get_current_user_websocket

router = APIRouter()

@router.websocket("/ws/collaborate/{workflow_id}")
async def websocket_collaborate(
    websocket: WebSocket,
    workflow_id: str,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time collaboration"""
    try:
        # Authenticate user
        user = await get_current_user_websocket(token)
        if not user:
            await websocket.close(code=4001, reason="Unauthorized")
            return
        
        # Verify user has access to workflow
        has_access = await workflow_service.user_has_access(
            user.id, workflow_id
        )
        if not has_access:
            await websocket.close(code=4003, reason="Forbidden")
            return
        
        # Connect to collaboration session
        connection_id = await collaboration_manager.connect(
            websocket, workflow_id, user.id
        )
        
        # Handle messages
        while True:
            message = await websocket.receive_text()
            await collaboration_manager.handle_message(connection_id, message)
            
    except WebSocketDisconnect:
        # Handle disconnection
        if 'connection_id' in locals():
            await collaboration_manager.disconnect(connection_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if 'connection_id' in locals():
            await collaboration_manager.disconnect(connection_id)
```

### 1.3 Workflow Template API

```python
# backend/src/api/routers/template_router.py
class WorkflowTemplate(BaseModel):
    id: str
    name: str
    description: str
    category: str
    tags: List[str]
    workflow_definition: Dict[str, Any]
    parameters: List[Dict[str, Any]]
    created_by: str
    created_at: datetime
    is_public: bool = False
    usage_count: int = 0
    rating: Optional[float] = None

@router.get("/templates", response_model=List[WorkflowTemplate])
async def list_templates(
    category: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    search: Optional[str] = None,
    is_public: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """List available workflow templates"""
    templates = await template_service.search_templates(
        category=category,
        tags=tags,
        search=search,
        is_public=is_public,
        user_id=current_user.id,
        limit=limit,
        offset=offset
    )
    return templates

@router.post("/templates", response_model=WorkflowTemplate)
async def create_template(
    template_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Create new workflow template"""
    template = await template_service.create_template(
        template_data, current_user.id
    )
    return template

@router.post("/workflows/from-template/{template_id}")
async def create_workflow_from_template(
    template_id: str,
    parameters: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user)
):
    """Create new workflow from template"""
    workflow = await template_service.instantiate_template(
        template_id, parameters or {}, current_user.id
    )
    return workflow
```

---

## 2. Frontend Architecture Integration

### 2.1 Enhanced State Management

#### Collaboration Store
```typescript
// frontend/src/store/collaborationStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface UserCursor {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

interface UserSelection {
  userId: string;
  userName: string;
  selectedNodes: string[];
  selectedEdges: string[];
}

interface CollaborationState {
  // Connection state
  isConnected: boolean;
  connectionId: string | null;
  currentUsers: Map<string, UserInfo>;
  
  // Real-time data
  userCursors: Map<string, UserCursor>;
  userSelections: Map<string, UserSelection>;
  
  // Actions
  connect: (workflowId: string, token: string) => Promise<void>;
  disconnect: () => void;
  sendCursor: (position: { x: number; y: number }) => void;
  sendSelection: (nodeIds: string[], edgeIds: string[]) => void;
  sendEdit: (edit: WorkflowEdit) => void;
  
  // Event handlers
  onUserJoined: (userId: string, userInfo: UserInfo) => void;
  onUserLeft: (userId: string) => void;
  onCursorUpdate: (userId: string, cursor: UserCursor) => void;
  onSelectionUpdate: (userId: string, selection: UserSelection) => void;
  onWorkflowEdit: (edit: WorkflowEdit) => void;
}

export const useCollaborationStore = create<CollaborationState>()(
  subscribeWithSelector((set, get) => ({
    isConnected: false,
    connectionId: null,
    currentUsers: new Map(),
    userCursors: new Map(),
    userSelections: new Map(),
    
    connect: async (workflowId: string, token: string) => {
      const wsUrl = `${process.env.REACT_APP_WS_URL}/ws/collaborate/${workflowId}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        set({ isConnected: true });
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { onUserJoined, onUserLeft, onCursorUpdate, onSelectionUpdate, onWorkflowEdit } = get();
        
        switch (data.type) {
          case 'user_joined':
            onUserJoined(data.user_id, data.user_info);
            break;
          case 'user_left':
            onUserLeft(data.user_id);
            break;
          case 'cursor_update':
            onCursorUpdate(data.user_id, data.cursor);
            break;
          case 'selection_update':
            onSelectionUpdate(data.user_id, data.selection);
            break;
          case 'workflow_edit':
            onWorkflowEdit(data);
            break;
        }
      };
      
      ws.onclose = () => {
        set({ isConnected: false, connectionId: null });
      };
      
      // Store websocket reference
      (get() as any).ws = ws;
    },
    
    disconnect: () => {
      const ws = (get() as any).ws;
      if (ws) {
        ws.close();
        delete (get() as any).ws;
      }
      set({ 
        isConnected: false, 
        connectionId: null,
        currentUsers: new Map(),
        userCursors: new Map(),
        userSelections: new Map()
      });
    },
    
    sendCursor: (position: { x: number; y: number }) => {
      const ws = (get() as any).ws;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'cursor_update',
          cursor: position
        }));
      }
    },
    
    sendSelection: (nodeIds: string[], edgeIds: string[]) => {
      const ws = (get() as any).ws;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'selection_update',
          selection: { selectedNodes: nodeIds, selectedEdges: edgeIds }
        }));
      }
    },
    
    sendEdit: (edit: WorkflowEdit) => {
      const ws = (get() as any).ws;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'workflow_edit',
          operation: edit.operation,
          target: edit.target,
          payload: edit.payload
        }));
      }
    },
    
    // Event handlers
    onUserJoined: (userId: string, userInfo: UserInfo) => {
      set(state => ({
        currentUsers: new Map(state.currentUsers).set(userId, userInfo)
      }));
    },
    
    onUserLeft: (userId: string) => {
      set(state => {
        const newUsers = new Map(state.currentUsers);
        const newCursors = new Map(state.userCursors);
        const newSelections = new Map(state.userSelections);
        
        newUsers.delete(userId);
        newCursors.delete(userId);
        newSelections.delete(userId);
        
        return {
          currentUsers: newUsers,
          userCursors: newCursors,
          userSelections: newSelections
        };
      });
    },
    
    onCursorUpdate: (userId: string, cursor: UserCursor) => {
      set(state => ({
        userCursors: new Map(state.userCursors).set(userId, cursor)
      }));
    },
    
    onSelectionUpdate: (userId: string, selection: UserSelection) => {
      set(state => ({
        userSelections: new Map(state.userSelections).set(userId, selection)
      }));
    },
    
    onWorkflowEdit: (edit: WorkflowEdit) => {
      // Apply edit to workflow store
      const workflowStore = useWorkflowStore.getState();
      workflowStore.applyEdit(edit);
    }
  }))
);
```

#### Enhanced Workflow Store
```typescript
// frontend/src/store/workflowStore.ts - Enhanced version
interface WorkflowState {
  // Existing state...
  workflows: Map<string, Workflow>;
  activeWorkflowId: string | null;
  
  // New collaboration features
  editHistory: WorkflowEdit[];
  undoStack: WorkflowEdit[];
  redoStack: WorkflowEdit[];
  
  // Selection and clipboard
  selectedNodes: string[];
  selectedEdges: string[];
  clipboard: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  } | null;
  
  // Enhanced actions
  applyEdit: (edit: WorkflowEdit) => void;
  undo: () => void;
  redo: () => void;
  selectMultiple: (nodeIds: string[], edgeIds: string[]) => void;
  copySelection: () => void;
  pasteFromClipboard: (position: { x: number; y: number }) => void;
  bulkDelete: (nodeIds: string[], edgeIds: string[]) => void;
  bulkMove: (nodeIds: string[], delta: { x: number; y: number }) => void;
  alignNodes: (nodeIds: string[], alignment: 'horizontal' | 'vertical') => void;
}

// Implementation details...
```

### 2.2 Enhanced Node Palette Component

```typescript
// frontend/src/components/workflow/EnhancedNodePalette.tsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Star, Filter, Grid, List } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../../../hooks/useDebounce';
import { nodeApi } from '../../../api/nodes';

interface EnhancedNodePaletteProps {
  onNodeDrag: (nodeType: string) => void;
}

export const EnhancedNodePalette: React.FC<EnhancedNodePaletteProps> = ({
  onNodeDrag
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Fetch nodes with filtering
  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['nodes', 'search', debouncedSearch, selectedCategories, showFavoritesOnly],
    queryFn: () => nodeApi.searchNodes({
      query: debouncedSearch || undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      favorites_only: showFavoritesOnly
    })
  });
  
  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['nodes', 'categories'],
    queryFn: () => nodeApi.getCategories()
  });
  
  // Fetch user favorites
  const { data: favoriteNodes = [] } = useQuery({
    queryKey: ['favorites', 'nodes'],
    queryFn: () => nodeApi.getFavoriteNodes()
  });
  
  // Group nodes by category
  const groupedNodes = useMemo(() => {
    const groups: Record<string, typeof nodes> = {};
    nodes.forEach(node => {
      if (!groups[node.category]) {
        groups[node.category] = [];
      }
      groups[node.category].push(node);
    });
    return groups;
  }, [nodes]);
  
  // Handle category filter toggle
  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);
  
  // Handle favorite toggle
  const toggleFavorite = useCallback(async (nodeType: string) => {
    const isFavorite = favoriteNodes.includes(nodeType);
    if (isFavorite) {
      await nodeApi.removeFavoriteNode(nodeType);
    } else {
      await nodeApi.addFavoriteNode(nodeType);
    }
    // Query will be refetched automatically due to mutation
  }, [favoriteNodes]);
  
  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Node Library</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <List size={16} /> : <Grid size={16} />}
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        {/* Quick Filters */}
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              showFavoritesOnly
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            <Star size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            <span>Favorites Only</span>
          </button>
          
          <div className="text-xs text-gray-500">
            {nodes.length} nodes found
          </div>
        </div>
      </div>
      
      {/* Category Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2 mb-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Categories</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => toggleCategory(category.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategories.includes(category.name)
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              {category.label} ({category.count})
            </button>
          ))}
        </div>
      </div>
      
      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading nodes...</div>
          </div>
        ) : Object.keys(groupedNodes).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Search size={32} className="mb-2 opacity-50" />
            <div className="text-sm">No nodes found</div>
            <div className="text-xs mt-1">Try adjusting your search or filters</div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNodes).map(([categoryName, categoryNodes]) => (
              <NodeCategorySection
                key={categoryName}
                categoryName={categoryName}
                nodes={categoryNodes}
                favoriteNodes={favoriteNodes}
                viewMode={viewMode}
                onNodeDrag={onNodeDrag}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Footer Tips */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 space-y-1">
          <div>💡 Drag nodes to canvas to add them</div>
          <div>⭐ Click star to favorite frequently used nodes</div>
          <div>🔍 Use search to find nodes quickly</div>
        </div>
      </div>
    </div>
  );
};
```

### 2.3 Real-time Canvas Integration

```typescript
// frontend/src/components/workflow/CollaborativeCanvas.tsx
import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, { 
  useNodesState, 
  useEdgesState,
  Background,
  Controls,
  MiniMap
} from 'reactflow';
import { useCollaborationStore } from '../../store/collaborationStore';
import { useWorkflowStore } from '../../store/workflowStore';
import { UserCursors } from './UserCursors';
import { UserSelections } from './UserSelections';

interface CollaborativeCanvasProps {
  workflowId: string;
  readonly?: boolean;
}

export const CollaborativeCanvas: React.FC<CollaborativeCanvasProps> = ({
  workflowId,
  readonly = false
}) => {
  const workflow = useWorkflowStore(state => state.workflows.get(workflowId));
  const { selectedNodes, selectedEdges, selectMultiple } = useWorkflowStore();
  
  const {
    isConnected,
    userCursors,
    userSelections,
    sendCursor,
    sendSelection,
    sendEdit
  } = useCollaborationStore();
  
  // Convert workflow data to React Flow format
  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow?.nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      selected: selectedNodes.includes(node.id)
    })) || []
  );
  
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    workflow?.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      selected: selectedEdges.includes(edge.id)
    })) || []
  );
  
  // Handle mouse movement for cursor sharing
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isConnected && !readonly) {
      const rect = event.currentTarget.getBoundingClientRect();
      sendCursor({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    }
  }, [isConnected, readonly, sendCursor]);
  
  // Handle selection changes
  const handleSelectionChange = useCallback(() => {
    if (isConnected && !readonly) {
      sendSelection(selectedNodes, selectedEdges);
    }
  }, [isConnected, readonly, selectedNodes, selectedEdges, sendSelection]);
  
  // Send selection updates when selection changes
  useEffect(() => {
    handleSelectionChange();
  }, [handleSelectionChange]);
  
  // Handle node/edge changes and broadcast edits
  const handleNodeDragStop = useCallback((event: React.MouseEvent, node: any) => {
    if (readonly) return;
    
    // Send edit to collaborators
    sendEdit({
      operation: 'update',
      target: 'node',
      payload: {
        node_id: node.id,
        position: node.position
      }
    });
  }, [readonly, sendEdit]);
  
  return (
    <div className="relative w-full h-full" onMouseMove={handleMouseMove}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        className="workflow-canvas"
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
        
        {/* Collaboration overlays */}
        {isConnected && (
          <>
            <UserCursors cursors={Array.from(userCursors.values())} />
            <UserSelections selections={Array.from(userSelections.values())} />
          </>
        )}
      </ReactFlow>
    </div>
  );
};
```

---

## 3. WebSocket Integration Patterns

### 3.1 Connection Management
```typescript
// frontend/src/services/websocket.ts
export class CollaborationWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  async connect(workflowId: string, token: string): Promise<void> {
    const wsUrl = `${WS_BASE_URL}/ws/collaborate/${workflowId}?token=${token}`;
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
      
      this.ws.onclose = (event) => {
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          // Attempt reconnection
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(workflowId, token).catch(() => {
              // Reconnection failed
            });
          }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        }
      };
    });
  }
  
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  onMessage(handler: (data: any) => void): void {
    if (this.ws) {
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handler(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    }
  }
  
  close(): void {
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
  }
}
```

### 3.2 Conflict Resolution
```typescript
// frontend/src/services/conflictResolution.ts
export interface ConflictResolution {
  conflictId: string;
  type: 'node_edit' | 'edge_edit' | 'position_conflict';
  description: string;
  localChange: any;
  remoteChange: any;
  suggestedResolution: 'accept_local' | 'accept_remote' | 'merge' | 'manual';
}

export class ConflictResolver {
  resolveNodePositionConflict(
    localNode: WorkflowNode,
    remoteNode: WorkflowNode
  ): ConflictResolution {
    // If positions are very close, use the most recent timestamp
    const distance = Math.sqrt(
      Math.pow(localNode.position.x - remoteNode.position.x, 2) +
      Math.pow(localNode.position.y - remoteNode.position.y, 2)
    );
    
    if (distance < 10) {
      return {
        conflictId: `position_${localNode.id}`,
        type: 'position_conflict',
        description: 'Node positions are very close',
        localChange: localNode,
        remoteChange: remoteNode,
        suggestedResolution: 'accept_remote' // Prefer remote for small conflicts
      };
    }
    
    return {
      conflictId: `position_${localNode.id}`,
      type: 'position_conflict', 
      description: 'Node positions significantly different',
      localChange: localNode,
      remoteChange: remoteNode,
      suggestedResolution: 'manual' // Require user decision for large conflicts
    };
  }
  
  resolveConfigurationConflict(
    localConfig: any,
    remoteConfig: any
  ): ConflictResolution {
    // Deep merge strategy for configuration conflicts
    const merged = this.deepMergeConfigs(localConfig, remoteConfig);
    
    return {
      conflictId: `config_${Date.now()}`,
      type: 'node_edit',
      description: 'Node configuration changed simultaneously',
      localChange: localConfig,
      remoteChange: remoteConfig,
      suggestedResolution: 'merge'
    };
  }
  
  private deepMergeConfigs(local: any, remote: any): any {
    // Implementation of deep merge logic
    // This would handle merging nested configuration objects
    // while preserving both local and remote changes where possible
    return { ...local, ...remote };
  }
}
```

---

## 4. Performance Optimization

### 4.1 Virtual Rendering
```typescript
// frontend/src/components/workflow/VirtualizedCanvas.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export const VirtualizedCanvas: React.FC<CanvasProps> = ({ nodes, edges }) => {
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  
  // Calculate visible nodes based on viewport
  const visibleNodes = useMemo(() => {
    const viewportBounds = {
      left: -viewport.x / viewport.zoom,
      top: -viewport.y / viewport.zoom,
      right: (-viewport.x + window.innerWidth) / viewport.zoom,
      bottom: (-viewport.y + window.innerHeight) / viewport.zoom
    };
    
    return nodes.filter(node => 
      node.position.x + 200 > viewportBounds.left &&
      node.position.x < viewportBounds.right &&
      node.position.y + 100 > viewportBounds.top &&
      node.position.y < viewportBounds.bottom
    );
  }, [nodes, viewport]);
  
  return (
    <ReactFlow
      nodes={visibleNodes}
      edges={edges}
      onViewportChange={setViewport}
      // ... other props
    />
  );
};
```

### 4.2 Memory Management
```typescript
// frontend/src/hooks/useMemoryOptimizedNodes.ts
export const useMemoryOptimizedNodes = (nodes: WorkflowNode[]) => {
  const nodePool = useRef(new Map<string, React.ComponentType>());
  const renderedNodes = useRef(new Set<string>());
  
  // Clean up unused node components
  useEffect(() => {
    const cleanup = () => {
      const currentNodeIds = new Set(nodes.map(n => n.id));
      
      // Remove components for nodes that no longer exist
      for (const [nodeId, component] of nodePool.current) {
        if (!currentNodeIds.has(nodeId)) {
          nodePool.current.delete(nodeId);
          renderedNodes.current.delete(nodeId);
        }
      }
    };
    
    const interval = setInterval(cleanup, 5000);
    return () => clearInterval(interval);
  }, [nodes]);
  
  return {
    nodePool: nodePool.current,
    renderedNodes: renderedNodes.current
  };
};
```

---

## 5. Testing Integration

### 5.1 WebSocket Testing
```typescript
// frontend/src/__tests__/collaboration.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useCollaborationStore } from '../store/collaborationStore';
import WS from 'jest-websocket-mock';

describe('Collaboration WebSocket', () => {
  let server: WS;
  
  beforeEach(() => {
    server = new WS('ws://localhost:8000/ws/collaborate/test-workflow');
  });
  
  afterEach(() => {
    WS.clean();
  });
  
  it('should connect to collaboration session', async () => {
    const { result } = renderHook(() => useCollaborationStore());
    
    await act(async () => {
      await result.current.connect('test-workflow', 'test-token');
    });
    
    await server.connected;
    expect(result.current.isConnected).toBe(true);
  });
  
  it('should handle cursor updates', async () => {
    const { result } = renderHook(() => useCollaborationStore());
    await act(async () => {
      await result.current.connect('test-workflow', 'test-token');
    });
    
    await server.connected;
    
    // Simulate receiving cursor update
    act(() => {
      server.send(JSON.stringify({
        type: 'cursor_update',
        user_id: 'user-123',
        cursor: { x: 100, y: 200, userName: 'Test User', color: '#ff0000' }
      }));
    });
    
    expect(result.current.userCursors.has('user-123')).toBe(true);
    expect(result.current.userCursors.get('user-123')?.x).toBe(100);
  });
});
```

### 5.2 Integration Tests
```typescript
// frontend/src/__tests__/visual-builder-integration.test.tsx
describe('Visual Builder Integration', () => {
  it('should create workflow with real-time collaboration', async () => {
    // Mock backend APIs
    const mockNodeApi = jest.mocked(nodeApi);
    mockNodeApi.searchNodes.mockResolvedValue(mockNodes);
    
    // Mock WebSocket
    const mockWS = new MockWebSocket();
    (global as any).WebSocket = jest.fn(() => mockWS);
    
    const { getByTestId, getAllByTestId } = render(<VisualBuilder />);
    
    // Test node palette search
    const searchInput = getByTestId('node-search');
    fireEvent.change(searchInput, { target: { value: 'trigger' } });
    
    await waitFor(() => {
      expect(mockNodeApi.searchNodes).toHaveBeenCalledWith({
        query: 'trigger'
      });
    });
    
    // Test drag and drop
    const triggerNode = getByTestId('node-scheduleTrigger');
    const canvas = getByTestId('workflow-canvas');
    
    fireEvent.dragStart(triggerNode);
    fireEvent.dragOver(canvas);
    fireEvent.drop(canvas);
    
    // Verify WebSocket message sent
    expect(mockWS.sentMessages).toContain(
      expect.objectContaining({
        type: 'workflow_edit',
        operation: 'add',
        target: 'node'
      })
    );
  });
});
```

This comprehensive technical integration specification ensures that Phase 2 Visual Builder components integrate seamlessly with the existing Phase 1 Core Engine while providing the foundation for advanced collaborative features and performance optimizations.