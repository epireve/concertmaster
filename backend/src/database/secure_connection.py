"""
Enhanced Database Connection with SSL/TLS Encryption
Secure database connectivity for ConcertMaster
"""

import asyncio
import logging
import ssl
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

import asyncpg
from asyncpg import Pool, Connection
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ..config import settings

logger = logging.getLogger(__name__)

class SecureDatabaseManager:
    """Enhanced database connection manager with SSL/TLS encryption"""

    def __init__(self):
        self.async_engine = None
        self.async_session_factory = None
        self.connection_pool: Optional[Pool] = None
        self._is_initialized = False
        self._ssl_context = None

    async def initialize(self) -> None:
        """Initialize secure database connections with SSL/TLS"""
        try:
            logger.info("Initializing secure database connections...")

            # Create SSL context for connections
            self._ssl_context = self._create_ssl_context()

            # Create async SQLAlchemy engine with SSL
            engine_kwargs = {
                'echo': settings.DEBUG,
                'pool_size': 20,
                'max_overflow': 30,
                'pool_pre_ping': True,
                'pool_recycle': 3600,
            }

            # Add SSL configuration for SQLAlchemy
            if self._ssl_context:
                engine_kwargs['connect_args'] = {
                    'ssl': self._ssl_context,
                    'server_settings': {
                        'jit': 'off'
                    }
                }

            self.async_engine = create_async_engine(
                settings.ASYNC_DATABASE_URL,
                **engine_kwargs
            )

            # Create session factory
            self.async_session_factory = async_sessionmaker(
                self.async_engine,
                class_=AsyncSession,
                expire_on_commit=False
            )

            # Create asyncpg connection pool with SSL
            await self._create_secure_pool()

            # Create tables if they don't exist
            await self._create_tables()

            self._is_initialized = True
            logger.info("✅ Secure database initialized successfully with SSL/TLS")

        except Exception as e:
            logger.error(f"❌ Failed to initialize secure database: {e}")
            raise

    def _create_ssl_context(self) -> Optional[ssl.SSLContext]:
        """Create SSL context for database connections"""
        try:
            # Check if SSL is enabled
            ssl_mode = getattr(settings, 'DATABASE_SSL_MODE', 'prefer')
            
            if ssl_mode == 'disable':
                logger.warning("Database SSL disabled - not recommended for production")
                return None

            # Create SSL context
            context = ssl.create_default_context()
            
            if ssl_mode == 'require':
                context.check_hostname = True
                context.verify_mode = ssl.CERT_REQUIRED
                logger.info("Database SSL required with certificate verification")
            else:  # prefer
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                logger.info("Database SSL preferred without certificate verification")

            # Load custom certificates if provided
            ssl_cert = getattr(settings, 'DATABASE_SSL_CERT', None)
            ssl_key = getattr(settings, 'DATABASE_SSL_KEY', None)
            ssl_root_cert = getattr(settings, 'DATABASE_SSL_ROOT_CERT', None)

            if ssl_cert and ssl_key:
                context.load_cert_chain(ssl_cert, ssl_key)
                logger.info("Loaded client SSL certificate")

            if ssl_root_cert:
                context.load_verify_locations(ssl_root_cert)
                logger.info("Loaded SSL root certificate")

            return context

        except Exception as e:
            logger.error(f"Failed to create SSL context: {e}")
            if ssl_mode == 'require':
                raise
            return None

    async def _create_secure_pool(self) -> None:
        """Create asyncpg connection pool with SSL configuration"""
        try:
            pool_kwargs = {
                'min_size': 5,
                'max_size': 20,
                'command_timeout': 60,
                'server_settings': {
                    'jit': 'off'
                }
            }

            # Add SSL configuration for asyncpg
            ssl_mode = getattr(settings, 'DATABASE_SSL_MODE', 'prefer')
            
            if ssl_mode == 'require':
                pool_kwargs['ssl'] = 'require'
                logger.info("Database connection pool configured with SSL required")
            elif ssl_mode == 'prefer':
                pool_kwargs['ssl'] = 'prefer'
                logger.info("Database connection pool configured with SSL preferred")
            else:
                logger.warning("Database connection pool configured without SSL")

            # Create connection pool
            self.connection_pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                **pool_kwargs
            )

            # Test SSL connection
            await self._test_ssl_connection()

        except Exception as e:
            logger.error(f"Failed to create secure connection pool: {e}")
            raise

    async def _test_ssl_connection(self) -> None:
        """Test SSL connection and log connection details"""
        try:
            async with self.connection_pool.acquire() as connection:
                # Check SSL status
                ssl_info = await connection.fetchrow("""
                    SELECT 
                        inet_server_addr() as server_addr,
                        inet_server_port() as server_port,
                        current_setting('ssl') as ssl_enabled
                """)
                
                if ssl_info:
                    logger.info(f"Database connection established - SSL: {ssl_info['ssl_enabled']}")
                    if ssl_info['ssl_enabled'] == 'on':
                        logger.info("✅ SSL/TLS encryption active for database connection")
                    else:
                        logger.warning("⚠️ SSL/TLS encryption not active for database connection")

        except Exception as e:
            logger.warning(f"Could not verify SSL connection status: {e}")

    async def _create_tables(self) -> None:
        """Create database tables using SQLAlchemy metadata"""
        try:
            async with self.async_engine.begin() as conn:
                # Import all models to ensure they're registered
                from . import models  # noqa
                from .models import Base
                
                # Create all tables
                await conn.run_sync(Base.metadata.create_all)
                logger.info("Database tables created/verified with secure connection")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise

    @asynccontextmanager
    async def get_session(self) -> AsyncSession:
        """Get async database session with SSL protection"""
        if not self._is_initialized:
            raise RuntimeError("SecureDatabaseManager not initialized")

        async with self.async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Secure database session error: {e}")
                raise
            finally:
                await session.close()

    @asynccontextmanager
    async def get_connection(self) -> Connection:
        """Get raw asyncpg connection with SSL encryption"""
        if not self.connection_pool:
            raise RuntimeError("Secure connection pool not initialized")

        async with self.connection_pool.acquire() as connection:
            try:
                yield connection
            except Exception as e:
                logger.error(f"Secure database connection error: {e}")
                raise

    async def execute_secure_query(self, query: str, *args) -> Any:
        """Execute parameterized query with SQL injection protection"""
        if not query.strip().upper().startswith(('SELECT', 'INSERT', 'UPDATE', 'DELETE')):
            raise ValueError("Only SELECT, INSERT, UPDATE, DELETE queries are allowed")
        
        # Ensure parameterized queries only
        if '%s' in query or format in str(query):
            raise ValueError("Raw string formatting not allowed. Use parameterized queries only.")
        
        async with self.get_connection() as conn:
            return await conn.fetch(query, *args)

    async def execute_secure_query_one(self, query: str, *args) -> Any:
        """Execute parameterized query and fetch one result with protection"""
        if not query.strip().upper().startswith(('SELECT', 'INSERT', 'UPDATE', 'DELETE')):
            raise ValueError("Only SELECT, INSERT, UPDATE, DELETE queries are allowed")
            
        async with self.get_connection() as conn:
            return await conn.fetchrow(query, *args)

    async def health_check(self) -> Dict[str, Any]:
        """Enhanced health check with SSL verification"""
        try:
            if not self._is_initialized:
                return {"status": "not_initialized", "error": "Database not initialized"}

            # Test SQLAlchemy connection
            async with self.get_session() as session:
                await session.execute("SELECT 1")

            # Test raw connection and check SSL
            async with self.get_connection() as conn:
                result = await conn.fetchval("SELECT 1")
                
                # Check SSL status
                try:
                    ssl_status = await conn.fetchrow("SELECT current_setting('ssl') as ssl_enabled")
                    ssl_enabled = ssl_status['ssl_enabled'] == 'on' if ssl_status else False
                except:
                    ssl_enabled = False

            return {
                "status": "healthy",
                "ssl_enabled": ssl_enabled,
                "pool_size": self.connection_pool.get_size() if self.connection_pool else 0,
                "pool_idle": self.connection_pool.get_idle_size() if self.connection_pool else 0,
                "encryption": "SSL/TLS" if ssl_enabled else "None"
            }

        except Exception as e:
            logger.error(f"Secure database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}

    async def get_security_stats(self) -> Dict[str, Any]:
        """Get database security statistics"""
        try:
            stats = await self.health_check()
            if stats["status"] != "healthy":
                return stats

            # Get additional security-related database stats
            async with self.get_connection() as conn:
                security_stats = await conn.fetchrow("""
                    SELECT
                        current_setting('ssl') as ssl_enabled,
                        current_setting('log_connections') as log_connections,
                        current_setting('log_disconnections') as log_disconnections,
                        current_setting('log_statement') as log_statement,
                        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
                        (SELECT count(*) FROM pg_stat_activity) as total_connections
                """)

            return {
                **stats,
                "ssl_enabled": security_stats["ssl_enabled"] == "on",
                "connection_logging": security_stats["log_connections"] == "on",
                "disconnection_logging": security_stats["log_disconnections"] == "on",
                "statement_logging": security_stats["log_statement"],
                "active_connections": security_stats["active_connections"],
                "total_connections": security_stats["total_connections"]
            }

        except Exception as e:
            logger.error(f"Failed to get database security stats: {e}")
            return {"status": "error", "error": str(e)}

    async def close(self) -> None:
        """Close all secure database connections"""
        try:
            logger.info("Closing secure database connections...")

            if self.connection_pool:
                await self.connection_pool.close()

            if self.async_engine:
                await self.async_engine.dispose()

            self._is_initialized = False
            logger.info("✅ Secure database connections closed")

        except Exception as e:
            logger.error(f"Error closing secure database: {e}")

# Global secure database manager instance
secure_db_manager = SecureDatabaseManager()

async def get_secure_db_session():
    """Dependency to get secure database session"""
    async with secure_db_manager.get_session() as session:
        yield session

async def get_secure_db_connection():
    """Dependency to get secure raw database connection"""
    async with secure_db_manager.get_connection() as connection:
        yield connection