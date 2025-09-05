"""
Database Connection Manager
Handles PostgreSQL connections, connection pooling, and health checks.
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

import asyncpg
from asyncpg import Pool, Connection
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ..config import settings
from .models import Base

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Database connection and session management"""

    def __init__(self):
        self.async_engine = None
        self.async_session_factory = None
        self.connection_pool: Optional[Pool] = None
        self._is_initialized = False

    async def initialize(self) -> None:
        """Initialize database connections and create tables"""
        try:
            logger.info("Initializing database connections...")

            # Create async SQLAlchemy engine
            self.async_engine = create_async_engine(
                settings.ASYNC_DATABASE_URL,
                echo=settings.DEBUG,
                pool_size=20,
                max_overflow=30,
                pool_pre_ping=True,
                pool_recycle=3600,
            )

            # Create session factory
            self.async_session_factory = async_sessionmaker(
                self.async_engine,
                class_=AsyncSession,
                expire_on_commit=False
            )

            # Create asyncpg connection pool for raw queries
            self.connection_pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                min_size=5,
                max_size=20,
                command_timeout=60,
                server_settings={
                    'jit': 'off'
                }
            )

            # Create tables if they don't exist
            await self._create_tables()

            self._is_initialized = True
            logger.info("✅ Database initialized successfully")

        except Exception as e:
            logger.error(f"❌ Failed to initialize database: {e}")
            raise

    async def _create_tables(self) -> None:
        """Create database tables using SQLAlchemy metadata"""
        try:
            async with self.async_engine.begin() as conn:
                # Import all models to ensure they're registered
                from . import models  # noqa
                
                # Create all tables
                await conn.run_sync(Base.metadata.create_all)
                logger.info("Database tables created/verified")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise

    @asynccontextmanager
    async def get_session(self) -> AsyncSession:
        """Get async database session"""
        if not self._is_initialized:
            raise RuntimeError("DatabaseManager not initialized")

        async with self.async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Database session error: {e}")
                raise
            finally:
                await session.close()

    @asynccontextmanager
    async def get_connection(self) -> Connection:
        """Get raw asyncpg connection"""
        if not self.connection_pool:
            raise RuntimeError("Connection pool not initialized")

        async with self.connection_pool.acquire() as connection:
            try:
                yield connection
            except Exception as e:
                logger.error(f"Database connection error: {e}")
                raise

    async def execute_raw(self, query: str, *args) -> Any:
        """Execute raw SQL query"""
        async with self.get_connection() as conn:
            return await conn.fetch(query, *args)

    async def execute_raw_one(self, query: str, *args) -> Any:
        """Execute raw SQL query and fetch one result"""
        async with self.get_connection() as conn:
            return await conn.fetchrow(query, *args)

    async def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            if not self._is_initialized:
                return {"status": "not_initialized", "error": "Database not initialized"}

            # Test SQLAlchemy connection
            async with self.get_session() as session:
                await session.execute("SELECT 1")

            # Test raw connection
            async with self.get_connection() as conn:
                await conn.fetchval("SELECT 1")

            return {
                "status": "healthy",
                "pool_size": self.connection_pool.get_size() if self.connection_pool else 0,
                "pool_idle": self.connection_pool.get_idle_size() if self.connection_pool else 0
            }

        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}

    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        try:
            stats = await self.health_check()
            if stats["status"] != "healthy":
                return stats

            # Get additional database stats
            async with self.get_connection() as conn:
                db_stats = await conn.fetchrow("""
                    SELECT
                        pg_database_size(current_database()) as db_size,
                        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
                        (SELECT count(*) FROM pg_stat_activity) as total_connections
                """)

            return {
                **stats,
                "database_size_bytes": db_stats["db_size"],
                "active_connections": db_stats["active_connections"],
                "total_connections": db_stats["total_connections"]
            }

        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            return {"status": "error", "error": str(e)}

    async def close(self) -> None:
        """Close all database connections"""
        try:
            logger.info("Closing database connections...")

            if self.connection_pool:
                await self.connection_pool.close()

            if self.async_engine:
                await self.async_engine.dispose()

            self._is_initialized = False
            logger.info("✅ Database connections closed")

        except Exception as e:
            logger.error(f"Error closing database: {e}")


# Global database manager instance
db_manager = DatabaseManager()


async def get_db_session():
    """Dependency to get database session"""
    async with db_manager.get_session() as session:
        yield session


async def get_db_connection():
    """Dependency to get raw database connection"""
    async with db_manager.get_connection() as connection:
        yield connection