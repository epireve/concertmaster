"""
Security Middleware for ConcertMaster
Enhanced security headers, CSP, rate limiting, and request validation
"""

import time
import uuid
from typing import Dict, Any, Optional
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enhanced security headers middleware with CSP support"""
    
    def __init__(self, app, config: Dict[str, Any] = None):
        super().__init__(app)
        self.config = config or {}
        self.nonce_cache = {}
    
    async def dispatch(self, request: Request, call_next):
        # Generate nonce for CSP
        request_id = str(uuid.uuid4())
        nonce = self._generate_nonce()
        
        # Store nonce in request state
        request.state.nonce = nonce
        request.state.request_id = request_id
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        self._add_security_headers(response, nonce)
        
        return response
    
    def _generate_nonce(self) -> str:
        """Generate cryptographic nonce for CSP"""
        import secrets
        import base64
        return base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('ascii')
    
    def _add_security_headers(self, response: Response, nonce: str):
        """Add comprehensive security headers"""
        # Content Security Policy with nonce
        csp_policy = (
            f"default-src 'self'; "
            f"script-src 'self' 'nonce-{nonce}'; "
            f"style-src 'self' 'nonce-{nonce}' 'unsafe-inline'; "
            f"img-src 'self' data: https:; "
            f"font-src 'self' https://fonts.gstatic.com; "
            f"connect-src 'self'; "
            f"media-src 'self'; "
            f"object-src 'none'; "
            f"frame-src 'none'; "
            f"base-uri 'self'; "
            f"form-action 'self'; "
            f"frame-ancestors 'none'; "
            f"upgrade-insecure-requests"
        )
        
        security_headers = {
            "Content-Security-Policy": csp_policy,
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "X-CSP-Nonce": nonce,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
        
        for header, value in security_headers.items():
            response.headers[header] = value

class RateLimitingMiddleware(BaseHTTPMiddleware):
    """Enhanced rate limiting with IP and user-based limits"""
    
    def __init__(self, app, cache_manager=None):
        super().__init__(app)
        self.cache_manager = cache_manager
        self.rate_limits = {
            "/api/v1/auth/login": {"limit": 5, "window": 900},  # 5 attempts per 15 minutes
            "/api/v1/auth/register": {"limit": 3, "window": 3600},  # 3 attempts per hour
            "/api/v1/workflows": {"limit": 100, "window": 3600},  # 100 per hour
            "/api/v1/forms": {"limit": 50, "window": 3600}  # 50 per hour
        }
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/metrics"]:
            return await call_next(request)
        
        # Apply rate limiting
        if not await self._check_rate_limit(request):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": 60
                }
            )
        
        return await call_next(request)
    
    async def _check_rate_limit(self, request: Request) -> bool:
        """Check if request is within rate limits"""
        if not self.cache_manager:
            return True
        
        # Get client IP
        client_ip = self._get_client_ip(request)
        endpoint = self._get_endpoint_pattern(request.url.path)
        
        # Check endpoint-specific rate limits
        rate_config = self.rate_limits.get(endpoint)
        if not rate_config:
            # Default rate limit for other endpoints
            rate_config = {"limit": 1000, "window": 3600}
        
        # Create cache keys
        ip_key = f"rate_limit:ip:{client_ip}:{endpoint}"
        
        # Check current count
        current_count = await self.cache_manager.get(ip_key) or 0
        
        if current_count >= rate_config["limit"]:
            return False
        
        # Increment counter
        await self.cache_manager.increment(ip_key, ttl=rate_config["window"])
        return True
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address safely"""
        # Check for forwarded headers
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        
        x_real_ip = request.headers.get("X-Real-IP")
        if x_real_ip:
            return x_real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _get_endpoint_pattern(self, path: str) -> str:
        """Get endpoint pattern for rate limiting"""
        # Map specific paths to patterns
        for pattern in self.rate_limits.keys():
            if path.startswith(pattern):
                return pattern
        
        # Default pattern
        return "/api/v1/default"

class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Request validation and sanitization middleware"""
    
    def __init__(self, app):
        super().__init__(app)
        self.suspicious_patterns = [
            # SQL injection patterns
            r"('|(\\');)|(;\\s*(drop|alter|create|delete|insert|update)\\s)",
            # XSS patterns
            r"<script[^>]*>.*?</script>",
            r"javascript:",
            r"on\\w+\\s*=",
            # Path traversal patterns
            r"\\.\\./",
            r"\\\\\\.\\.\\\\",
            # Command injection patterns
            r";\\s*(cat|ls|pwd|whoami|id|uname)",
            r"\\|\\s*(cat|ls|pwd|whoami|id|uname)",
        ]
    
    async def dispatch(self, request: Request, call_next):
        # Validate request
        if not await self._validate_request(request):
            logger.warning(f"Suspicious request blocked from {request.client.host}: {request.url}")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "error": "Invalid request",
                    "detail": "Request contains suspicious content"
                }
            )
        
        return await call_next(request)
    
    async def _validate_request(self, request: Request) -> bool:
        """Validate request for suspicious content"""
        import re
        
        # Check URL for suspicious patterns
        url_str = str(request.url)
        for pattern in self.suspicious_patterns:
            if re.search(pattern, url_str, re.IGNORECASE):
                return False
        
        # Check headers for suspicious content
        for header_name, header_value in request.headers.items():
            for pattern in self.suspicious_patterns:
                if re.search(pattern, header_value, re.IGNORECASE):
                    return False
        
        # For POST/PUT requests, check body (if JSON)
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    # Read body for validation (this consumes the stream)
                    body = await request.body()
                    body_str = body.decode("utf-8")
                    
                    for pattern in self.suspicious_patterns:
                        if re.search(pattern, body_str, re.IGNORECASE):
                            return False
                except Exception:
                    # If we can't parse the body, allow it through
                    # (FastAPI will handle JSON parsing errors)
                    pass
        
        return True

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Comprehensive audit logging middleware"""
    
    def __init__(self, app, audit_logger=None):
        super().__init__(app)
        self.audit_logger = audit_logger or logger
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Log request
        await self._log_request(request)
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log response
        await self._log_response(request, response, process_time)
        
        return response
    
    async def _log_request(self, request: Request):
        """Log incoming request details"""
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        log_data = {
            "event_type": "request",
            "method": request.method,
            "url": str(request.url),
            "client_ip": client_ip,
            "user_agent": user_agent,
            "content_type": request.headers.get("content-type"),
            "content_length": request.headers.get("content-length"),
            "timestamp": time.time()
        }
        
        self.audit_logger.info(f"Request: {request.method} {request.url.path}", extra=log_data)
    
    async def _log_response(self, request: Request, response: Response, process_time: float):
        """Log response details"""
        client_ip = request.client.host if request.client else "unknown"
        
        log_data = {
            "event_type": "response",
            "method": request.method,
            "url": str(request.url),
            "status_code": response.status_code,
            "client_ip": client_ip,
            "process_time": process_time,
            "timestamp": time.time()
        }
        
        # Log different levels based on status code
        if response.status_code >= 500:
            self.audit_logger.error(f"Server error: {request.method} {request.url.path}", extra=log_data)
        elif response.status_code >= 400:
            self.audit_logger.warning(f"Client error: {request.method} {request.url.path}", extra=log_data)
        else:
            self.audit_logger.info(f"Success: {request.method} {request.url.path}", extra=log_data)

class SecurityEventMiddleware(BaseHTTPMiddleware):
    """Security event detection and alerting middleware"""
    
    def __init__(self, app, security_logger=None):
        super().__init__(app)
        self.security_logger = security_logger
        self.suspicious_threshold = 10  # Number of suspicious events to trigger alert
    
    async def dispatch(self, request: Request, call_next):
        # Check for suspicious activity
        await self._detect_suspicious_activity(request)
        
        return await call_next(request)
    
    async def _detect_suspicious_activity(self, request: Request):
        """Detect and log suspicious activities"""
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "")
        
        suspicious_indicators = []
        
        # Check for automated tools
        bot_patterns = ["bot", "crawler", "spider", "scraper", "automated", "python-requests"]
        if any(pattern in user_agent.lower() for pattern in bot_patterns):
            suspicious_indicators.append("automated_tool")
        
        # Check for unusual request patterns
        if request.method in ["PUT", "DELETE", "PATCH"] and not request.headers.get("authorization"):
            suspicious_indicators.append("unauthenticated_modification")
        
        # Check for unusual paths
        if "/../" in str(request.url) or ".." in str(request.url):
            suspicious_indicators.append("path_traversal_attempt")
        
        # Log suspicious activity
        if suspicious_indicators and self.security_logger:
            self.security_logger.log_suspicious_activity(
                user_id="anonymous",
                activity="suspicious_request",
                details={
                    "indicators": suspicious_indicators,
                    "url": str(request.url),
                    "method": request.method,
                    "user_agent": user_agent
                },
                ip_address=client_ip
            )