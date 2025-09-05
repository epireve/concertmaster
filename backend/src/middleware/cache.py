"""
Redis Caching Middleware for Performance Optimization
Provides caching layer for frequently accessed API endpoints
"""
import json
import redis
import logging
from functools import wraps
from flask import request, current_app, jsonify
from typing import Optional, Any, Dict, Union
import hashlib
import time

logger = logging.getLogger(__name__)

class RedisCache:
    """Redis caching utility for API responses"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()  # Test connection
            logger.info("Redis cache initialized successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Falling back to no-cache mode.")
            self.redis_client = None
    
    def _generate_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from request parameters"""
        key_data = {
            'prefix': prefix,
            'args': args,
            'kwargs': kwargs,
            'method': request.method,
            'path': request.path,
            'query': dict(request.args)
        }
        key_string = json.dumps(key_data, sort_keys=True)
        return f"cache:{hashlib.md5(key_string.encode()).hexdigest()}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value"""
        if not self.redis_client:
            return None
        
        try:
            cached_data = self.redis_client.get(key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set cached value with TTL"""
        if not self.redis_client:
            return False
        
        try:
            serialized_value = json.dumps(value, default=str)
            return self.redis_client.setex(key, ttl, serialized_value)
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete cached value"""
        if not self.redis_client:
            return False
        
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    def clear_pattern(self, pattern: str) -> int:
        """Clear cache entries matching pattern"""
        if not self.redis_client:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
        except Exception as e:
            logger.error(f"Cache clear pattern error: {e}")
        
        return 0

# Global cache instance
cache = RedisCache()

def cached_response(ttl: int = 300, key_prefix: str = "api"):
    """
    Decorator for caching API responses
    
    Args:
        ttl: Time to live in seconds
        key_prefix: Cache key prefix for organization
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = cache._generate_cache_key(key_prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for key: {cache_key}")
                return jsonify(cached_result)
            
            # Execute function and cache result
            try:
                result = func(*args, **kwargs)
                
                # Cache successful responses
                if hasattr(result, 'status_code') and result.status_code == 200:
                    if hasattr(result, 'get_json'):
                        response_data = result.get_json()
                        if response_data:
                            cache.set(cache_key, response_data, ttl)
                            logger.debug(f"Cached result for key: {cache_key}")
                elif isinstance(result, (dict, list)):
                    cache.set(cache_key, result, ttl)
                    logger.debug(f"Cached result for key: {cache_key}")
                
                return result
                
            except Exception as e:
                logger.error(f"Function execution error: {e}")
                raise
        
        return wrapper
    return decorator

def invalidate_cache_pattern(pattern: str):
    """Utility function to invalidate cache by pattern"""
    return cache.clear_pattern(f"cache:*{pattern}*")

def cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    if not cache.redis_client:
        return {"status": "disabled", "message": "Redis not available"}
    
    try:
        info = cache.redis_client.info()
        return {
            "status": "active",
            "connected_clients": info.get("connected_clients", 0),
            "used_memory_human": info.get("used_memory_human", "0B"),
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0),
            "hit_rate": round(
                info.get("keyspace_hits", 0) / max(
                    info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1
                ) * 100, 2
            )
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Performance monitoring decorator
def monitor_performance(func):
    """Decorator to monitor API performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Log slow requests
            if execution_time > 1.0:  # Log requests taking more than 1 second
                logger.warning(
                    f"Slow API call: {func.__name__} took {execution_time:.2f}s"
                )
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(
                f"API error in {func.__name__} after {execution_time:.2f}s: {e}"
            )
            raise
    
    return wrapper