"""
Form Security Service
Security measures including rate limiting, CSRF protection, and security headers.
"""

import hashlib
import hmac
import secrets
import logging
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timezone, timedelta
from ipaddress import ip_address, ip_network

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from ..config import settings
from ..services.cache_manager import cache_manager, CacheNamespace

logger = logging.getLogger(__name__)


class SecurityViolation(Exception):
    """Security violation exception"""
    def __init__(self, violation_type: str, details: str):
        self.violation_type = violation_type
        self.details = details
        super().__init__(f"Security violation: {violation_type} - {details}")


class FormSecurityService:
    """Service for form security and protection"""
    
    def __init__(self):
        # Rate limiting configurations
        self.rate_limits = {
            'form_submit': {'requests': 5, 'window': 300},  # 5 submissions per 5 minutes
            'form_view': {'requests': 50, 'window': 300},   # 50 views per 5 minutes
            'file_upload': {'requests': 10, 'window': 300}  # 10 uploads per 5 minutes
        }
        
        # Suspicious patterns
        self.suspicious_patterns = [
            r'<script[^>]*>.*?</script>',
            r'javascript:',
            r'vbscript:',
            r'data:text/html',
            r'<iframe[^>]*>.*?</iframe>',
            r'<object[^>]*>.*?</object>',
            r'<embed[^>]*>.*?</embed>',
            r'eval\s*\(',
            r'setTimeout\s*\(',
            r'setInterval\s*\(',
        ]
        
        # Blocked IP ranges (can be updated dynamically)
        self.blocked_ips: Set[str] = set()
        self.blocked_networks: List[str] = [
            '10.0.0.0/8',      # Private network
            '172.16.0.0/12',   # Private network  
            '192.168.0.0/16',  # Private network
        ]
        
        # Allowed origins for CORS
        self.allowed_origins = settings.ALLOWED_ORIGINS
        
        # CSRF token expiry
        self.csrf_token_expiry = 3600  # 1 hour
        
    async def check_rate_limit(
        self,
        client_id: str,
        action: str,
        request: Request
    ) -> bool:
        """Check rate limit for client action"""
        try:
            if action not in self.rate_limits:
                return True
            
            config = self.rate_limits[action]
            cache_key = f"rate_limit:{action}:{client_id}"
            
            # Get current requests count
            current_requests = await cache_manager.get(
                CacheNamespace.RATE_LIMITS, 
                cache_key, 
                0
            )
            
            # Check if limit exceeded
            if current_requests >= config['requests']:
                await self._log_security_violation(
                    client_id,
                    "rate_limit_exceeded",
                    f"Action: {action}, Requests: {current_requests}",
                    request
                )
                return False
            
            # Increment counter
            await cache_manager.set(
                CacheNamespace.RATE_LIMITS,
                cache_key,
                current_requests + 1,
                ttl=config['window']
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return True  # Fail open for availability
    
    async def validate_request_origin(self, request: Request) -> bool:
        """Validate request origin for CORS"""
        try:
            origin = request.headers.get('origin')
            referer = request.headers.get('referer')
            
            if not origin and not referer:
                # Allow requests without origin/referer (direct API calls)
                return True
            
            # Check origin
            if origin:
                if origin in self.allowed_origins or '*' in self.allowed_origins:
                    return True
                
                # Check if origin matches allowed patterns
                for allowed_origin in self.allowed_origins:
                    if allowed_origin.endswith('*'):
                        pattern = allowed_origin[:-1]
                        if origin.startswith(pattern):
                            return True
            
            # Check referer as fallback
            if referer:
                for allowed_origin in self.allowed_origins:
                    if referer.startswith(allowed_origin):
                        return True
            
            await self._log_security_violation(
                self._get_client_id(request),
                "invalid_origin",
                f"Origin: {origin}, Referer: {referer}",
                request
            )
            return False
            
        except Exception as e:
            logger.error(f"Origin validation failed: {e}")
            return True  # Fail open
    
    async def check_ip_reputation(self, request: Request) -> bool:
        """Check IP reputation and blocking"""
        try:
            client_ip = self._get_client_ip(request)
            
            # Check blocked IPs
            if client_ip in self.blocked_ips:
                await self._log_security_violation(
                    client_ip,
                    "blocked_ip",
                    f"IP {client_ip} is blocked",
                    request
                )
                return False
            
            # Check blocked networks
            try:
                client_ip_obj = ip_address(client_ip)
                for network_str in self.blocked_networks:
                    network = ip_network(network_str)
                    if client_ip_obj in network:
                        await self._log_security_violation(
                            client_ip,
                            "blocked_network",
                            f"IP {client_ip} in blocked network {network_str}",
                            request
                        )
                        return False
            except ValueError:
                # Invalid IP address format
                logger.warning(f"Invalid IP address format: {client_ip}")
            
            # Check for suspicious behavior patterns
            if await self._check_suspicious_behavior(client_ip, request):
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"IP reputation check failed: {e}")
            return True  # Fail open
    
    async def _check_suspicious_behavior(self, client_ip: str, request: Request) -> bool:
        """Check for suspicious behavior patterns"""
        try:
            cache_key = f"suspicious:{client_ip}"
            
            # Get recent suspicious activities
            suspicious_count = await cache_manager.get(
                CacheNamespace.RATE_LIMITS,
                cache_key,
                0
            )
            
            # Check user agent patterns
            user_agent = request.headers.get('user-agent', '')
            if self._is_suspicious_user_agent(user_agent):
                suspicious_count += 1
            
            # Check request patterns
            if await self._is_suspicious_request_pattern(request):
                suspicious_count += 1
            
            # Update suspicious count
            if suspicious_count > 0:
                await cache_manager.set(
                    CacheNamespace.RATE_LIMITS,
                    cache_key,
                    suspicious_count,
                    ttl=3600  # 1 hour
                )
            
            # Block if too many suspicious activities
            if suspicious_count >= 5:
                await self._log_security_violation(
                    client_ip,
                    "suspicious_behavior",
                    f"Suspicious activity count: {suspicious_count}",
                    request
                )
                return True  # Is suspicious
            
            return False
            
        except Exception as e:
            logger.error(f"Suspicious behavior check failed: {e}")
            return False
    
    def _is_suspicious_user_agent(self, user_agent: str) -> bool:
        """Check if user agent is suspicious"""
        suspicious_patterns = [
            'bot', 'crawler', 'spider', 'scraper',
            'curl', 'wget', 'python', 'requests',
            'postman', 'insomnia'
        ]
        
        user_agent_lower = user_agent.lower()
        for pattern in suspicious_patterns:
            if pattern in user_agent_lower:
                return True
        
        return False
    
    async def _is_suspicious_request_pattern(self, request: Request) -> bool:
        """Check for suspicious request patterns"""
        try:
            # Check for common attack patterns in URL
            path = str(request.url.path)
            query = str(request.url.query)
            
            attack_patterns = [
                '../', '..\\', '/etc/passwd', '/windows/system32',
                '<script', 'javascript:', 'vbscript:',
                'union select', 'drop table', 'insert into',
                'exec(', 'eval(', 'system(',
                '%3cscript', '%3e', '%3c', '&lt;script'
            ]
            
            full_url = f"{path}?{query}"
            for pattern in attack_patterns:
                if pattern in full_url.lower():
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Suspicious request pattern check failed: {e}")
            return False
    
    async def validate_form_data_security(self, form_data: Dict[str, Any]) -> bool:
        """Validate form data for security issues"""
        try:
            import re
            
            # Check for XSS patterns
            for field_name, field_value in form_data.items():
                if not isinstance(field_value, str):
                    continue
                
                # Check for suspicious patterns
                for pattern in self.suspicious_patterns:
                    if re.search(pattern, field_value, re.IGNORECASE):
                        logger.warning(f"Suspicious pattern detected in field {field_name}: {pattern}")
                        return False
                
                # Enhanced SQL injection patterns
                sql_patterns = [
                    r"union\s+select",
                    r"drop\s+table",
                    r"insert\s+into",
                    r"delete\s+from",
                    r"update\s+set",
                    r"exec\s*\(",
                    r"sp_executesql",
                    r"xp_cmdshell",
                    r"sp_makewebtask",
                    r"sp_oacreate",
                    r"information_schema",
                    r"sysobjects",
                    r"syscolumns",
                    r"waitfor\s+delay",
                    r"benchmark\s*\(",
                    r"pg_sleep\s*\(",
                    r"sleep\s*\(",
                ]
                
                for pattern in sql_patterns:
                    if re.search(pattern, field_value, re.IGNORECASE):
                        logger.warning(f"SQL injection pattern detected in field {field_name}: {pattern}")
                        return False
                
                # Check for command injection patterns
                cmd_patterns = [
                    r"&&",
                    r"\|\|",
                    r";\s*cat\s+",
                    r";\s*ls\s+",
                    r";\s*pwd",
                    r";\s*whoami",
                    r";\s*id\s*$",
                    r";\s*uname",
                    r"`.*`",
                    r"\$\(.*\)",
                    r"nc\s+-",
                    r"wget\s+",
                    r"curl\s+",
                ]
                
                for pattern in cmd_patterns:
                    if re.search(pattern, field_value, re.IGNORECASE):
                        logger.warning(f"Command injection pattern detected in field {field_name}: {pattern}")
                        return False
                
                # Check for path traversal attempts
                path_patterns = [
                    r"\.\.\/",
                    r"\.\.\\",
                    r"\/etc\/passwd",
                    r"\/windows\/system32",
                    r"\/proc\/",
                    r"file:\/\/",
                    r"\\\\",
                ]
                
                for pattern in path_patterns:
                    if re.search(pattern, field_value, re.IGNORECASE):
                        logger.warning(f"Path traversal pattern detected in field {field_name}: {pattern}")
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Form data security validation failed: {e}")
            return True  # Fail open to avoid blocking legitimate requests
    
    async def generate_csrf_token(self, client_id: str) -> str:
        """Generate CSRF token for client"""
        try:
            # Generate secure random token
            token = secrets.token_urlsafe(32)
            
            # Store token with expiry
            cache_key = f"csrf:{client_id}:{token}"
            await cache_manager.set(
                CacheNamespace.SESSIONS,
                cache_key,
                {
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'client_id': client_id
                },
                ttl=self.csrf_token_expiry
            )
            
            return token
            
        except Exception as e:
            logger.error(f"CSRF token generation failed: {e}")
            return secrets.token_urlsafe(32)  # Fallback token
    
    async def validate_csrf_token(self, client_id: str, token: str) -> bool:
        """Validate CSRF token"""
        try:
            cache_key = f"csrf:{client_id}:{token}"
            
            # Check if token exists and is valid
            token_data = await cache_manager.get(
                CacheNamespace.SESSIONS,
                cache_key
            )
            
            if not token_data:
                return False
            
            # Verify client ID matches
            if token_data.get('client_id') != client_id:
                return False
            
            # Token is valid, remove it (one-time use)
            await cache_manager.delete(CacheNamespace.SESSIONS, cache_key)
            
            return True
            
        except Exception as e:
            logger.error(f"CSRF token validation failed: {e}")
            return False
    
    async def get_security_headers(self) -> Dict[str, str]:
        """Get security headers for responses"""
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        }
    
    async def _log_security_violation(
        self,
        client_id: str,
        violation_type: str,
        details: str,
        request: Request
    ):
        """Log security violation"""
        violation_data = {
            'client_id': client_id,
            'violation_type': violation_type,
            'details': details,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'ip_address': self._get_client_ip(request),
            'user_agent': request.headers.get('user-agent', ''),
            'path': str(request.url.path),
            'method': request.method
        }
        
        # Log to application logger
        logger.warning(f"Security violation: {violation_type} - {details} - IP: {client_id}")
        
        # Store violation for analysis
        cache_key = f"violation:{datetime.now().strftime('%Y-%m-%d')}:{client_id}"
        violations = await cache_manager.get(CacheNamespace.SESSIONS, cache_key, [])
        violations.append(violation_data)
        
        await cache_manager.set(
            CacheNamespace.SESSIONS,
            cache_key,
            violations,
            ttl=86400  # 24 hours
        )
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        # Check forwarded headers first
        forwarded_for = request.headers.get('x-forwarded-for')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('x-real-ip')
        if real_ip:
            return real_ip.strip()
        
        # Fallback to direct client IP
        return request.client.host if request.client else 'unknown'
    
    def _get_client_id(self, request: Request) -> str:
        """Generate client identifier"""
        # Try to get user ID if authenticated
        if hasattr(request.state, 'user') and request.state.user:
            return f"user:{request.state.user.id}"
        
        # Fallback to IP address
        return f"ip:{self._get_client_ip(request)}"
    
    async def add_blocked_ip(self, ip_address: str, reason: str = "manual"):
        """Add IP to blocked list"""
        try:
            self.blocked_ips.add(ip_address)
            
            # Store in cache for persistence
            cache_key = f"blocked_ip:{ip_address}"
            await cache_manager.set(
                CacheNamespace.SESSIONS,
                cache_key,
                {
                    'reason': reason,
                    'blocked_at': datetime.now(timezone.utc).isoformat()
                },
                ttl=86400 * 7  # 7 days
            )
            
            logger.info(f"IP {ip_address} added to blocked list: {reason}")
            
        except Exception as e:
            logger.error(f"Failed to block IP {ip_address}: {e}")
    
    async def remove_blocked_ip(self, ip_address: str):
        """Remove IP from blocked list"""
        try:
            self.blocked_ips.discard(ip_address)
            
            # Remove from cache
            cache_key = f"blocked_ip:{ip_address}"
            await cache_manager.delete(CacheNamespace.SESSIONS, cache_key)
            
            logger.info(f"IP {ip_address} removed from blocked list")
            
        except Exception as e:
            logger.error(f"Failed to unblock IP {ip_address}: {e}")
    
    async def get_security_metrics(self) -> Dict[str, Any]:
        """Get security metrics and statistics"""
        try:
            # This would typically query a proper metrics store
            # For now, return basic metrics from cache
            
            metrics = {
                'blocked_ips_count': len(self.blocked_ips),
                'blocked_networks_count': len(self.blocked_networks),
                'rate_limit_violations_24h': 0,
                'csrf_violations_24h': 0,
                'xss_attempts_24h': 0,
                'sql_injection_attempts_24h': 0,
                'suspicious_requests_24h': 0
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to get security metrics: {e}")
            return {'error': str(e)}


class SecurityMiddleware(BaseHTTPMiddleware):
    """Security middleware for form endpoints"""
    
    def __init__(self, app, security_service: FormSecurityService):
        super().__init__(app)
        self.security_service = security_service
        
        # Paths that require security checks
        self.protected_paths = [
            '/api/v1/forms',
            '/api/v1/upload',
            '/api/v1/submit'
        ]
    
    async def dispatch(self, request: Request, call_next):
        """Process request with security checks"""
        try:
            # Skip security checks for non-protected paths
            if not any(request.url.path.startswith(path) for path in self.protected_paths):
                return await call_next(request)
            
            # Get client ID
            client_id = self.security_service._get_client_id(request)
            
            # Check IP reputation
            if not await self.security_service.check_ip_reputation(request):
                return JSONResponse(
                    status_code=403,
                    content={'error': 'Access denied'},
                    headers=await self.security_service.get_security_headers()
                )
            
            # Check rate limiting
            action = self._get_action_from_path(request.url.path)
            if not await self.security_service.check_rate_limit(client_id, action, request):
                return JSONResponse(
                    status_code=429,
                    content={'error': 'Rate limit exceeded'},
                    headers={
                        'Retry-After': '300',
                        **await self.security_service.get_security_headers()
                    }
                )
            
            # Check origin validation
            if not await self.security_service.validate_request_origin(request):
                return JSONResponse(
                    status_code=403,
                    content={'error': 'Invalid origin'},
                    headers=await self.security_service.get_security_headers()
                )
            
            # Process request
            response = await call_next(request)
            
            # Add security headers
            security_headers = await self.security_service.get_security_headers()
            for header, value in security_headers.items():
                response.headers[header] = value
            
            return response
            
        except Exception as e:
            logger.error(f"Security middleware error: {e}")
            return JSONResponse(
                status_code=500,
                content={'error': 'Security check failed'},
                headers=await self.security_service.get_security_headers()
            )
    
    def _get_action_from_path(self, path: str) -> str:
        """Determine action type from request path"""
        if '/submit' in path or '/responses' in path:
            return 'form_submit'
        elif '/upload' in path or '/attachments' in path:
            return 'file_upload'
        else:
            return 'form_view'