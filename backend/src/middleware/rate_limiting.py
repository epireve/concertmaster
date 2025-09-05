"""
Rate Limiting Middleware - Request rate limiting and throttling
Implements sliding window rate limiting with Redis backend for distributed systems.
"""

import time
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from ..config import settings
from ..services.cache_manager import CacheManager, CacheNamespace

logger = logging.getLogger(__name__)


class RateLimitExceeded(HTTPException):
    """Rate limit exceeded exception"""
    
    def __init__(self, detail: str = "Rate limit exceeded", headers: Dict[str, str] = None):
        super().__init__(status_code=429, detail=detail, headers=headers)


class RateLimitingMiddleware(BaseHTTPMiddleware):
    """Redis-based rate limiting middleware with sliding window algorithm"""
    
    def __init__(
        self,
        app,
        requests_per_minute: int = None,
        requests_per_hour: int = None,
        burst_size: int = None,
        skip_paths: list = None,
        enabled: bool = None
    ):
        super().__init__(app)
        
        # Use settings or provided values
        self.requests_per_minute = requests_per_minute or settings.RATE_LIMIT_REQUESTS
        self.requests_per_hour = requests_per_hour or settings.RATE_LIMIT_REQUESTS * 60
        self.burst_size = burst_size or min(self.requests_per_minute // 2, 20)
        self.enabled = enabled if enabled is not None else settings.RATE_LIMIT_ENABLED
        
        # Paths to skip rate limiting
        self.skip_paths = skip_paths or [
            "/health", "/api/v1/status", "/docs", "/redoc", "/openapi.json"
        ]
        
        # Initialize cache manager
        self.cache_manager = None
        self._initialized = False
    
    async def _ensure_initialized(self):
        """Ensure cache manager is initialized"""
        if not self._initialized and self.enabled:
            self.cache_manager = CacheManager()
            await self.cache_manager.initialize()
            self._initialized = True
    
    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting"""
        
        # Skip if rate limiting is disabled
        if not self.enabled:
            return await call_next(request)
        
        # Skip rate limiting for certain paths
        if self._should_skip_rate_limiting(request):
            return await call_next(request)
        
        # Initialize if needed
        await self._ensure_initialized()
        
        # Get client identifier
        client_id = self._get_client_identifier(request)
        
        # Check rate limits
        try:
            await self._check_rate_limits(request, client_id)
        except RateLimitExceeded as e:
            return JSONResponse(
                status_code=e.status_code,
                content={"error": e.detail, "retry_after": e.headers.get("Retry-After")},
                headers=e.headers or {}
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        await self._add_rate_limit_headers(response, client_id)
        
        return response
    
    def _should_skip_rate_limiting(self, request: Request) -> bool:
        """Check if request should skip rate limiting"""
        path = request.url.path
        return any(skip_path in path for skip_path in self.skip_paths)
    
    def _get_client_identifier(self, request: Request) -> str:
        """Get unique client identifier for rate limiting"""
        
        # Try to get authenticated user ID first
        user_id = None
        if hasattr(request.state, "user"):
            user_id = getattr(request.state.user, "id", None)
        
        if user_id:
            return f"user:{user_id}"
        
        # Fallback to IP address
        client_ip = request.client.host if request.client else "unknown"
        
        # Check for forwarded headers in case of proxy
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            client_ip = real_ip.strip()
        
        return f"ip:{client_ip}"
    
    async def _check_rate_limits(self, request: Request, client_id: str):
        """Check if client has exceeded rate limits"""
        
        current_time = int(time.time())
        
        # Check burst limit (short-term)
        burst_key = f"burst:{client_id}"
        burst_count = await self._sliding_window_check(
            burst_key, 
            window_size=60,  # 1 minute
            max_requests=self.burst_size,
            current_time=current_time
        )
        
        if burst_count > self.burst_size:
            retry_after = 60  # 1 minute
            raise RateLimitExceeded(
                detail=f"Burst limit exceeded. Maximum {self.burst_size} requests per minute.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.burst_size),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(current_time + retry_after)
                }
            )
        
        # Check per-minute limit
        minute_key = f"minute:{client_id}"
        minute_count = await self._sliding_window_check(
            minute_key,
            window_size=60,  # 1 minute
            max_requests=self.requests_per_minute,
            current_time=current_time
        )
        
        if minute_count > self.requests_per_minute:
            retry_after = 60  # 1 minute
            raise RateLimitExceeded(
                detail=f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(current_time + retry_after)
                }
            )
        
        # Check per-hour limit
        hour_key = f"hour:{client_id}"
        hour_count = await self._sliding_window_check(
            hour_key,
            window_size=3600,  # 1 hour
            max_requests=self.requests_per_hour,
            current_time=current_time
        )
        
        if hour_count > self.requests_per_hour:
            retry_after = 3600  # 1 hour
            raise RateLimitExceeded(
                detail=f"Hourly rate limit exceeded. Maximum {self.requests_per_hour} requests per hour.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.requests_per_hour),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(current_time + retry_after)
                }
            )
    
    async def _sliding_window_check(
        self,
        key: str,
        window_size: int,
        max_requests: int,
        current_time: int
    ) -> int:
        """Implement sliding window rate limiting using Redis"""
        
        if not self.cache_manager:
            return 0
        
        try:
            # Use Redis sorted sets for sliding window
            # Score is timestamp, value is unique request ID
            request_id = f"{current_time}:{time.time_ns()}"
            window_start = current_time - window_size
            
            # Add current request to sorted set
            await self.cache_manager.redis_client.zadd(key, {request_id: current_time})
            
            # Remove old entries outside the window
            await self.cache_manager.redis_client.zremrangebyscore(key, "-inf", window_start)
            
            # Count requests in current window
            count = await self.cache_manager.redis_client.zcard(key)
            
            # Set expiration for cleanup
            await self.cache_manager.redis_client.expire(key, window_size + 60)
            
            return count
            
        except Exception as e:
            logger.error(f"Rate limiting check failed: {e}")
            # Fail open - allow request if Redis is down
            return 0
    
    async def _add_rate_limit_headers(self, response, client_id: str):
        """Add rate limit headers to response"""
        
        try:
            current_time = int(time.time())
            
            # Get current counts
            minute_key = f"minute:{client_id}"
            minute_count = await self.cache_manager.redis_client.zcard(minute_key)
            
            hour_key = f"hour:{client_id}"
            hour_count = await self.cache_manager.redis_client.zcard(hour_key)
            
            # Add headers (using the more restrictive minute limit for headers)
            response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
            response.headers["X-RateLimit-Remaining"] = str(max(0, self.requests_per_minute - minute_count))
            response.headers["X-RateLimit-Reset"] = str(current_time + 60)  # Reset in 1 minute
            
            # Add additional context headers
            response.headers["X-RateLimit-Hour-Limit"] = str(self.requests_per_hour)
            response.headers["X-RateLimit-Hour-Remaining"] = str(max(0, self.requests_per_hour - hour_count))
            
        except Exception as e:
            logger.error(f"Failed to add rate limit headers: {e}")


class AdaptiveRateLimitingMiddleware(BaseHTTPMiddleware):
    """Adaptive rate limiting that adjusts based on system load"""
    
    def __init__(
        self,
        app,
        base_requests_per_minute: int = None,
        max_requests_per_minute: int = None,
        load_threshold: float = 0.8,
        skip_paths: list = None
    ):
        super().__init__(app)
        
        self.base_requests_per_minute = base_requests_per_minute or settings.RATE_LIMIT_REQUESTS
        self.max_requests_per_minute = max_requests_per_minute or self.base_requests_per_minute * 2
        self.load_threshold = load_threshold
        self.skip_paths = skip_paths or ["/health", "/api/v1/status"]
        
        self.current_requests_per_minute = self.base_requests_per_minute
        self.last_adjustment = time.time()
        self.request_count = 0
        self.error_count = 0
        
    async def dispatch(self, request: Request, call_next):
        """Process request with adaptive rate limiting"""
        
        # Skip for certain paths
        if self._should_skip(request):
            return await call_next(request)
        
        # Check current rate limit
        if not await self._check_rate_limit(request):
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded (adaptive)"},
                headers={"Retry-After": "60"}
            )
        
        # Track request
        start_time = time.time()
        self.request_count += 1
        
        # Process request
        try:
            response = await call_next(request)
            
            # Track errors for load assessment
            if response.status_code >= 500:
                self.error_count += 1
            
            # Adjust rate limit based on performance
            await self._adjust_rate_limit(time.time() - start_time, response.status_code)
            
            return response
            
        except Exception as e:
            self.error_count += 1
            await self._adjust_rate_limit(time.time() - start_time, 500)
            raise
    
    def _should_skip(self, request: Request) -> bool:
        """Check if request should skip adaptive rate limiting"""
        return any(path in request.url.path for path in self.skip_paths)
    
    async def _check_rate_limit(self, request: Request) -> bool:
        """Simple in-memory rate limiting (could be enhanced with Redis)"""
        # This is a simplified implementation
        # In production, you'd want to use Redis for distributed rate limiting
        return True  # For now, always allow
    
    async def _adjust_rate_limit(self, response_time: float, status_code: int):
        """Adjust rate limit based on system performance"""
        
        current_time = time.time()
        
        # Only adjust every 60 seconds
        if current_time - self.last_adjustment < 60:
            return
        
        # Calculate error rate
        error_rate = self.error_count / max(self.request_count, 1)
        
        # Adjust based on response time and error rate
        if response_time > 2.0 or error_rate > 0.1:
            # System under stress, decrease rate limit
            self.current_requests_per_minute = max(
                self.base_requests_per_minute // 2,
                int(self.current_requests_per_minute * 0.8)
            )
        elif response_time < 0.5 and error_rate < 0.01:
            # System performing well, increase rate limit
            self.current_requests_per_minute = min(
                self.max_requests_per_minute,
                int(self.current_requests_per_minute * 1.2)
            )
        
        # Reset counters
        self.last_adjustment = current_time
        self.request_count = 0
        self.error_count = 0
        
        logger.info(f"Adjusted rate limit to {self.current_requests_per_minute} requests/minute")


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """IP-based access control middleware"""
    
    def __init__(self, app, whitelist: list = None, blacklist: list = None):
        super().__init__(app)
        self.whitelist = set(whitelist or [])
        self.blacklist = set(blacklist or [])
    
    async def dispatch(self, request: Request, call_next):
        """Check IP access control"""
        
        client_ip = self._get_client_ip(request)
        
        # Check blacklist first
        if self.blacklist and client_ip in self.blacklist:
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied"}
            )
        
        # Check whitelist if configured
        if self.whitelist and client_ip not in self.whitelist:
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied"}
            )
        
        return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        """Get real client IP address"""
        
        # Check forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to direct client IP
        return request.client.host if request.client else "unknown"