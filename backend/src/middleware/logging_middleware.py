"""
Logging Middleware - HTTP request/response logging and audit trail
Provides structured logging for API requests, response times, and error tracking.
"""

import time
import logging
import json
import uuid
from typing import Callable, Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import Message

from ..config import settings

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """HTTP logging middleware with structured logging and audit trail"""
    
    def __init__(self, app, skip_paths: list = None, skip_health_checks: bool = True):
        super().__init__(app)
        self.skip_paths = skip_paths or ["/docs", "/redoc", "/openapi.json", "/favicon.ico"]
        self.skip_health_checks = skip_health_checks
        
        if skip_health_checks:
            self.skip_paths.extend(["/health", "/api/v1/status"])
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process HTTP request and response"""
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Skip logging for specified paths
        if self._should_skip_logging(request):
            return await call_next(request)
        
        # Add request ID to headers
        request.state.request_id = request_id
        
        # Record start time
        start_time = time.time()
        start_datetime = datetime.now(timezone.utc)
        
        # Collect request information
        request_info = await self._collect_request_info(request)
        request_info["request_id"] = request_id
        request_info["timestamp"] = start_datetime.isoformat()
        
        # Log incoming request
        self._log_request(request_info)
        
        # Handle request body logging (for POST/PUT/PATCH)
        request_body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            request_body = await self._get_request_body(request)
            if request_body and len(request_body) <= 10000:  # Log body if < 10KB
                request_info["body"] = request_body
        
        # Process request
        response = None
        error_info = None
        
        try:
            response = await call_next(request)
        except Exception as e:
            # Log exception
            error_info = {
                "error_type": type(e).__name__,
                "error_message": str(e),
                "request_id": request_id
            }
            logger.error("Request processing failed", extra=error_info)
            
            # Return error response
            response = JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "request_id": request_id
                }
            )
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Collect response information
        response_info = await self._collect_response_info(response, process_time)
        response_info["request_id"] = request_id
        response_info["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Add processing time header
        response.headers["X-Process-Time"] = str(process_time)
        response.headers["X-Request-ID"] = request_id
        
        # Log response
        self._log_response({**request_info, **response_info})
        
        # Log to audit trail if enabled
        if settings.AUDIT_ENABLED:
            await self._audit_log({
                **request_info,
                **response_info,
                "error": error_info
            })
        
        return response
    
    def _should_skip_logging(self, request: Request) -> bool:
        """Check if request should be skipped from logging"""
        path = request.url.path
        return any(skip_path in path for skip_path in self.skip_paths)
    
    async def _collect_request_info(self, request: Request) -> Dict[str, Any]:
        """Collect request information for logging"""
        
        # Get client information
        client_host = request.client.host if request.client else "unknown"
        
        # Get user agent
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Get user information from headers or JWT
        user_id = request.headers.get("X-User-ID")
        if not user_id and hasattr(request.state, "user"):
            user_id = getattr(request.state.user, "id", None)
        
        return {
            "method": request.method,
            "url": str(request.url),
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "headers": self._filter_headers(dict(request.headers)),
            "client_host": client_host,
            "user_agent": user_agent,
            "user_id": str(user_id) if user_id else None,
            "content_type": request.headers.get("content-type"),
            "content_length": request.headers.get("content-length")
        }
    
    async def _collect_response_info(self, response: Response, process_time: float) -> Dict[str, Any]:
        """Collect response information for logging"""
        
        response_body = None
        
        # Try to get response body for logging (if it's JSON and not too large)
        if hasattr(response, "body") and response.body:
            try:
                if len(response.body) <= 10000:  # Log body if < 10KB
                    body_str = response.body.decode("utf-8")
                    # Try to parse as JSON for better formatting
                    try:
                        response_body = json.loads(body_str)
                    except json.JSONDecodeError:
                        response_body = body_str[:1000]  # Truncate if not JSON
            except Exception:
                pass  # Skip body logging if there's an issue
        
        return {
            "status_code": response.status_code,
            "response_headers": self._filter_headers(dict(response.headers)),
            "content_length": response.headers.get("content-length"),
            "media_type": getattr(response, "media_type", None),
            "process_time": round(process_time, 4),
            "response_body": response_body
        }
    
    def _filter_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        """Filter sensitive headers from logging"""
        
        sensitive_headers = [
            "authorization", "cookie", "x-api-key", "x-auth-token",
            "authentication", "proxy-authorization", "www-authenticate"
        ]
        
        filtered = {}
        for key, value in headers.items():
            if key.lower() in sensitive_headers:
                filtered[key] = "[REDACTED]"
            else:
                filtered[key] = value
        
        return filtered
    
    async def _get_request_body(self, request: Request) -> Optional[str]:
        """Safely get request body for logging"""
        try:
            body = await request.body()
            if body:
                return body.decode("utf-8")[:10000]  # Truncate large bodies
        except Exception as e:
            logger.debug(f"Could not read request body: {e}")
        
        return None
    
    def _log_request(self, request_info: Dict[str, Any]):
        """Log incoming request"""
        logger.info(
            f"Incoming {request_info['method']} {request_info['path']}",
            extra={
                "event": "http_request",
                **request_info
            }
        )
    
    def _log_response(self, log_data: Dict[str, Any]):
        """Log response with appropriate level based on status code"""
        
        status_code = log_data.get("status_code", 0)
        process_time = log_data.get("process_time", 0)
        method = log_data.get("method", "")
        path = log_data.get("path", "")
        
        # Determine log level based on status code
        if 200 <= status_code < 300:
            level = logging.INFO
        elif 300 <= status_code < 400:
            level = logging.INFO
        elif 400 <= status_code < 500:
            level = logging.WARNING
        else:  # 500+
            level = logging.ERROR
        
        # Log with appropriate level
        logger.log(
            level,
            f"Completed {method} {path} - {status_code} ({process_time}s)",
            extra={
                "event": "http_response",
                **log_data
            }
        )
        
        # Log slow requests
        if process_time > 5.0:  # Log requests taking more than 5 seconds
            logger.warning(
                f"Slow request: {method} {path} took {process_time}s",
                extra={
                    "event": "slow_request",
                    **log_data
                }
            )
    
    async def _audit_log(self, audit_data: Dict[str, Any]):
        """Write to audit log for compliance and security monitoring"""
        
        try:
            # This could be extended to write to a separate audit log file,
            # database table, or external service
            audit_logger = logging.getLogger("audit")
            audit_logger.info(
                "API Request",
                extra={
                    "event": "api_audit",
                    "timestamp": audit_data.get("timestamp"),
                    "request_id": audit_data.get("request_id"),
                    "user_id": audit_data.get("user_id"),
                    "method": audit_data.get("method"),
                    "path": audit_data.get("path"),
                    "status_code": audit_data.get("status_code"),
                    "client_host": audit_data.get("client_host"),
                    "user_agent": audit_data.get("user_agent"),
                    "process_time": audit_data.get("process_time"),
                    "error": audit_data.get("error")
                }
            )
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")


# Custom request correlation middleware
class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """Adds correlation ID to requests for distributed tracing"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add correlation ID to request and response"""
        
        # Get or generate correlation ID
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        
        # Store in request state
        request.state.correlation_id = correlation_id
        
        # Process request
        response = await call_next(request)
        
        # Add to response headers
        response.headers["X-Correlation-ID"] = correlation_id
        
        return response


# Performance monitoring middleware  
class PerformanceMiddleware(BaseHTTPMiddleware):
    """Monitor API performance and collect metrics"""
    
    def __init__(self, app):
        super().__init__(app)
        self.request_count = 0
        self.total_time = 0.0
        self.slow_requests = []
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Monitor request performance"""
        
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate metrics
        process_time = time.time() - start_time
        self.request_count += 1
        self.total_time += process_time
        
        # Track slow requests
        if process_time > 2.0:  # Requests taking more than 2 seconds
            self.slow_requests.append({
                "path": request.url.path,
                "method": request.method,
                "time": process_time,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            # Keep only recent slow requests
            if len(self.slow_requests) > 100:
                self.slow_requests = self.slow_requests[-50:]
        
        # Add performance headers
        response.headers["X-Response-Time"] = f"{process_time:.4f}"
        
        return response
    
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        avg_time = self.total_time / self.request_count if self.request_count > 0 else 0
        
        return {
            "total_requests": self.request_count,
            "total_time": round(self.total_time, 4),
            "average_time": round(avg_time, 4),
            "slow_requests_count": len(self.slow_requests),
            "recent_slow_requests": self.slow_requests[-10:]  # Last 10 slow requests
        }