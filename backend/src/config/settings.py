"""
ConcertMaster Configuration Management
Environment-based configuration with validation
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List, Optional, Dict, Any
import os
from pathlib import Path

class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application
    APP_NAME: str = "ConcertMaster"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    
    # Security
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # Database
    DATABASE_URL: str
    ASYNC_DATABASE_URL: str = ""
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_TIMEOUT: int = 30
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_POOL_SIZE: int = 10
    CACHE_TTL: int = 3600
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_TASK_TIMEOUT: int = 300
    CELERY_MAX_RETRIES: int = 3
    
    # File Storage
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = [".json", ".csv", ".xlsx", ".xml"]
    
    # Integration
    WEBHOOK_SECRET: Optional[str] = None
    EMAIL_HOST: Optional[str] = None
    EMAIL_PORT: int = 587
    EMAIL_USERNAME: Optional[str] = None
    EMAIL_PASSWORD: Optional[str] = None
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 1000
    RATE_LIMIT_WINDOW: int = 3600  # 1 hour
    
    # Monitoring
    METRICS_ENABLED: bool = True
    AUDIT_ENABLED: bool = True
    PERFORMANCE_MONITORING: bool = True
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v):
        if not v:
            raise ValueError("DATABASE_URL is required")
        return v
    
    @field_validator("SECRET_KEY")
    @classmethod 
    def validate_secret_key(cls, v):
        if not v or len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v
    
    @property
    def upload_path(self) -> Path:
        """Get upload directory path"""
        path = Path(self.UPLOAD_DIR)
        path.mkdir(exist_ok=True)
        return path
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Global settings instance
settings = Settings()

# Environment-specific configurations
class DatabaseConfig:
    """Database configuration helper"""
    
    @staticmethod
    def get_async_url(sync_url: str) -> str:
        """Convert sync database URL to async"""
        return sync_url.replace("postgresql://", "postgresql+asyncpg://")
    
    @staticmethod
    def get_alembic_url(async_url: str) -> str:
        """Convert async URL back to sync for Alembic"""
        return async_url.replace("postgresql+asyncpg://", "postgresql://")

class CeleryConfig:
    """Celery configuration"""
    
    broker_url = settings.CELERY_BROKER_URL
    result_backend = settings.CELERY_RESULT_BACKEND
    task_serializer = 'json'
    accept_content = ['json']
    result_serializer = 'json'
    timezone = 'UTC'
    enable_utc = True
    task_track_started = True
    task_time_limit = settings.CELERY_TASK_TIMEOUT
    task_soft_time_limit = settings.CELERY_TASK_TIMEOUT - 30
    worker_prefetch_multiplier = 1
    task_acks_late = True
    worker_disable_rate_limits = False
    task_default_retry_delay = 60
    task_max_retries = settings.CELERY_MAX_RETRIES
    
    # Task routing
    task_routes = {
        'concertmaster.tasks.workflow_execution': {'queue': 'workflow'},
        'concertmaster.tasks.form_processing': {'queue': 'forms'},
        'concertmaster.tasks.integration_sync': {'queue': 'integration'},
        'concertmaster.tasks.email_notifications': {'queue': 'notifications'},
    }

class RedisConfig:
    """Redis configuration helper"""
    
    @staticmethod
    def get_connection_kwargs():
        return {
            'max_connections': settings.REDIS_POOL_SIZE,
            'retry_on_timeout': True,
            'socket_keepalive': True,
            'socket_keepalive_options': {},
            'health_check_interval': 30,
        }