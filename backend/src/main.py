"""
ConcertMaster - Data Orchestration Platform
FastAPI Backend Main Application
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager
import uvicorn
import logging
from typing import Dict, Any

from .config import settings
from .database.connection import DatabaseManager, get_db_session
from .auth.security import SecurityManager, get_current_active_user
from .api.routers import workflow_router, form_router, execution_router, node_router, integration_router
from .services.worker_manager import WorkerManager
from .services.cache_manager import CacheManager
from .middleware.logging_middleware import LoggingMiddleware
from .middleware.rate_limiting import RateLimitingMiddleware

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize managers
db_manager = DatabaseManager()
security_manager = SecurityManager()
worker_manager = WorkerManager()
cache_manager = CacheManager()

# Set up manager dependencies
security_manager.set_cache_manager(cache_manager)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("🚀 Starting ConcertMaster backend...")
    
    # Initialize database
    await db_manager.initialize()
    
    # Initialize Redis cache
    await cache_manager.initialize()
    
    # Initialize Celery workers
    await worker_manager.initialize()
    
    logger.info("✅ ConcertMaster backend initialized")
    yield
    
    # Cleanup
    logger.info("🔄 Shutting down ConcertMaster backend...")
    await db_manager.close()
    await cache_manager.close()
    await worker_manager.close()
    logger.info("✅ ConcertMaster backend shutdown complete")

# Initialize FastAPI application
app = FastAPI(
    title="ConcertMaster API",
    description="Data Orchestration Platform with Visual Workflow Builder",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Security middleware
from .middleware.security_middleware import (
    SecurityHeadersMiddleware,
    RateLimitingMiddleware as EnhancedRateLimitingMiddleware,
    RequestValidationMiddleware,
    AuditLoggingMiddleware,
    SecurityEventMiddleware
)
from .services.security_manager import SecurityManager

# Initialize security manager
security_manager = SecurityManager(cache_manager)

# Enhanced security middleware (order matters)
app.add_middleware(SecurityEventMiddleware, security_logger=None)
app.add_middleware(AuditLoggingMiddleware)
app.add_middleware(RequestValidationMiddleware)
app.add_middleware(EnhancedRateLimitingMiddleware, cache_manager=cache_manager)
app.add_middleware(SecurityHeadersMiddleware)

# Legacy middleware (keep for compatibility)
app.add_middleware(LoggingMiddleware)

# Security scheme
security = HTTPBearer()

# API Routes
app.include_router(
    workflow_router,
    prefix="/api/v1/workflows",
    tags=["workflows"],
    dependencies=[Depends(get_current_active_user)]
)

app.include_router(
    form_router,
    prefix="/api/v1/forms",
    tags=["forms"],
    dependencies=[Depends(get_current_active_user)]
)

app.include_router(
    execution_router,
    prefix="/api/v1/executions",
    tags=["executions"],
    dependencies=[Depends(get_current_active_user)]
)

app.include_router(
    node_router,
    prefix="/api/v1/nodes",
    tags=["nodes"],
    dependencies=[Depends(get_current_active_user)]
)

app.include_router(
    integration_router,
    prefix="/api/v1/integrations",
    tags=["integrations"],
    dependencies=[Depends(get_current_active_user)]
)

# Health check endpoints
@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": await db_manager.health_check(),
        "cache": await cache_manager.health_check(),
        "workers": await worker_manager.health_check()
    }

@app.get("/api/v1/status")
async def api_status() -> Dict[str, Any]:
    """API status with detailed metrics"""
    return {
        "api": "online",
        "database": await db_manager.get_stats(),
        "cache": await cache_manager.get_stats(),
        "workers": await worker_manager.get_stats()
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )