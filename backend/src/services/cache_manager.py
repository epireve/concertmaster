"""
ConcertMaster Cache Management
Redis-based caching and session management
"""

import redis.asyncio as redis
import json
import pickle
from typing import Any, Optional, Dict, List, Union
from datetime import datetime, timedelta
import logging
import asyncio

from ..config import settings, RedisConfig

logger = logging.getLogger(__name__)

class CacheManager:
    """Redis cache manager for application-wide caching"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.is_connected = False
        self.connection_pool: Optional[redis.ConnectionPool] = None
    
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            # Create connection pool
            self.connection_pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                **RedisConfig.get_connection_kwargs()
            )
            
            # Create Redis client
            self.redis_client = redis.Redis(connection_pool=self.connection_pool)
            
            # Test connection
            await self.redis_client.ping()
            self.is_connected = True
            
            logger.info("Redis connection established")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis connection: {str(e)}")
            self.is_connected = False
            raise
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
        if self.connection_pool:
            await self.connection_pool.disconnect()
        self.is_connected = False
        logger.info("Redis connection closed")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Redis health status"""
        if not self.redis_client or not self.is_connected:
            return {"status": "disconnected", "error": "No Redis connection"}
        
        try:
            # Test basic operations
            test_key = "health_check"
            await self.redis_client.set(test_key, "ok", ex=5)
            result = await self.redis_client.get(test_key)
            await self.redis_client.delete(test_key)
            
            if result == b"ok":
                return {"status": "healthy", "connection": "ok"}
            else:
                return {"status": "unhealthy", "error": "Basic operations failed"}
                
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get Redis statistics"""
        if not self.redis_client or not self.is_connected:
            return {"error": "No Redis connection"}
        
        try:
            info = await self.redis_client.info()
            return {
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory_human", "0B"),
                "used_memory_peak": info.get("used_memory_peak_human", "0B"),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "uptime_in_seconds": info.get("uptime_in_seconds", 0)
            }
        except Exception as e:
            return {"error": str(e)}
    
    # Basic cache operations
    async def set(self, key: str, value: Any, ttl: Optional[int] = None, 
                 json_encode: bool = True) -> bool:
        """Set cache value with optional TTL"""
        if not self.redis_client:
            return False
        
        try:
            # Serialize value
            if json_encode:
                try:
                    serialized_value = json.dumps(value)
                except (TypeError, ValueError):
                    # Fallback to pickle for complex objects
                    serialized_value = pickle.dumps(value)
                    key = f"pickle:{key}"
            else:
                serialized_value = value
            
            # Set with TTL
            ttl = ttl or settings.CACHE_TTL
            await self.redis_client.set(key, serialized_value, ex=ttl)
            return True
            
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {str(e)}")
            return False
    
    async def get(self, key: str, json_decode: bool = True) -> Optional[Any]:
        """Get cache value"""
        if not self.redis_client:
            return None
        
        try:
            value = await self.redis_client.get(key)
            if value is None:
                return None
            
            # Handle pickle serialized objects
            if key.startswith("pickle:"):
                return pickle.loads(value)
            
            # JSON decode
            if json_decode and isinstance(value, bytes):
                try:
                    return json.loads(value.decode('utf-8'))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    return value.decode('utf-8')
            
            return value.decode('utf-8') if isinstance(value, bytes) else value
            
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {str(e)}")
            return None
    
    async def delete(self, key: str) -> bool:
        """Delete cache key"""
        if not self.redis_client:
            return False
        
        try:
            result = await self.redis_client.delete(key)
            return result > 0
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {str(e)}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis_client:
            return False
        
        try:
            result = await self.redis_client.exists(key)
            return result > 0
        except Exception as e:
            logger.error(f"Cache exists error for key {key}: {str(e)}")
            return False
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration for existing key"""
        if not self.redis_client:
            return False
        
        try:
            result = await self.redis_client.expire(key, ttl)
            return result > 0
        except Exception as e:
            logger.error(f"Cache expire error for key {key}: {str(e)}")
            return False
    
    async def keys(self, pattern: str = "*") -> List[str]:
        """Get keys matching pattern"""
        if not self.redis_client:
            return []
        
        try:
            keys = await self.redis_client.keys(pattern)
            return [key.decode('utf-8') if isinstance(key, bytes) else key for key in keys]
        except Exception as e:
            logger.error(f"Cache keys error for pattern {pattern}: {str(e)}")
            return []
    
    async def flush_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self.redis_client:
            return 0
        
        try:
            keys = await self.keys(pattern)
            if keys:
                result = await self.redis_client.delete(*keys)
                return result
            return 0
        except Exception as e:
            logger.error(f"Cache flush pattern error for {pattern}: {str(e)}")
            return 0
    
    async def flush_all(self) -> bool:
        """Flush all cache data"""
        if not self.redis_client:
            return False
        
        try:
            await self.redis_client.flushdb()
            return True
        except Exception as e:
            logger.error(f"Cache flush all error: {str(e)}")
            return False
    
    # Hash operations for structured data
    async def hset(self, name: str, mapping: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Set hash fields"""
        if not self.redis_client:
            return False
        
        try:
            # Serialize values in mapping
            serialized_mapping = {}
            for field, value in mapping.items():
                if isinstance(value, (dict, list)):
                    serialized_mapping[field] = json.dumps(value)
                else:
                    serialized_mapping[field] = str(value)
            
            await self.redis_client.hset(name, mapping=serialized_mapping)
            
            if ttl:
                await self.redis_client.expire(name, ttl)
            
            return True
        except Exception as e:
            logger.error(f"Cache hset error for {name}: {str(e)}")
            return False
    
    async def hget(self, name: str, field: str) -> Optional[Any]:
        """Get hash field"""
        if not self.redis_client:
            return None
        
        try:
            value = await self.redis_client.hget(name, field)
            if value is None:
                return None
            
            value_str = value.decode('utf-8') if isinstance(value, bytes) else value
            
            # Try to JSON decode
            try:
                return json.loads(value_str)
            except json.JSONDecodeError:
                return value_str
                
        except Exception as e:
            logger.error(f"Cache hget error for {name}.{field}: {str(e)}")
            return None
    
    async def hgetall(self, name: str) -> Dict[str, Any]:
        """Get all hash fields"""
        if not self.redis_client:
            return {}
        
        try:
            data = await self.redis_client.hgetall(name)
            result = {}
            
            for field, value in data.items():
                field_str = field.decode('utf-8') if isinstance(field, bytes) else field
                value_str = value.decode('utf-8') if isinstance(value, bytes) else value
                
                # Try to JSON decode values
                try:
                    result[field_str] = json.loads(value_str)
                except json.JSONDecodeError:
                    result[field_str] = value_str
            
            return result
        except Exception as e:
            logger.error(f"Cache hgetall error for {name}: {str(e)}")
            return {}
    
    # Session management
    async def create_session(self, session_id: str, user_data: Dict[str, Any], 
                           ttl: int = 86400) -> bool:
        """Create user session"""
        session_key = f"session:{session_id}"
        session_data = {
            "user_id": user_data.get("user_id"),
            "email": user_data.get("email"),
            "created_at": datetime.now().isoformat(),
            "last_accessed": datetime.now().isoformat(),
            "metadata": user_data.get("metadata", {})
        }
        return await self.hset(session_key, session_data, ttl)
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        session_key = f"session:{session_id}"
        session_data = await self.hgetall(session_key)
        
        if session_data:
            # Update last accessed time
            await self.hset(session_key, {"last_accessed": datetime.now().isoformat()})
            return session_data
        
        return None
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete session"""
        session_key = f"session:{session_id}"
        return await self.delete(session_key)
    
    async def extend_session(self, session_id: str, ttl: int = 86400) -> bool:
        """Extend session expiration"""
        session_key = f"session:{session_id}"
        return await self.expire(session_key, ttl)
    
    # Workflow execution caching
    async def cache_workflow_result(self, workflow_id: str, execution_id: str, 
                                  result: Dict[str, Any], ttl: int = 3600) -> bool:
        """Cache workflow execution result"""
        key = f"workflow_result:{workflow_id}:{execution_id}"
        return await self.set(key, result, ttl)
    
    async def get_workflow_result(self, workflow_id: str, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get cached workflow result"""
        key = f"workflow_result:{workflow_id}:{execution_id}"
        return await self.get(key)
    
    # Rate limiting
    async def increment_counter(self, key: str, ttl: int = 3600) -> int:
        """Increment counter with TTL (for rate limiting)"""
        if not self.redis_client:
            return 0
        
        try:
            # Use pipeline for atomic operations
            pipe = self.redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, ttl)
            results = await pipe.execute()
            return results[0]
        except Exception as e:
            logger.error(f"Counter increment error for {key}: {str(e)}")
            return 0
    
    async def get_counter(self, key: str) -> int:
        """Get counter value"""
        if not self.redis_client:
            return 0
        
        try:
            value = await self.redis_client.get(key)
            return int(value) if value else 0
        except Exception as e:
            logger.error(f"Counter get error for {key}: {str(e)}")
            return 0