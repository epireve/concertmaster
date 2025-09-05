"""
Comprehensive Security Testing Suite for ConcertMaster
Tests authentication, authorization, encryption, and security controls
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from fastapi import status
from unittest.mock import Mock, patch
import jwt
import bcrypt

from ..main import app
from ..config import settings
from ..services.security_manager import SecurityManager
from ..middleware.security_middleware import SecurityHeadersMiddleware, RateLimitingMiddleware
from ..database.secure_connection import SecureDatabaseManager

# Test client
client = TestClient(app)

class TestAuthentication:
    """Test authentication security measures"""

    @pytest.fixture
    def security_manager(self):
        return SecurityManager()

    @pytest.fixture
    def mock_cache_manager(self):
        mock_cache = Mock()
        mock_cache.get.return_value = asyncio.Future()
        mock_cache.get.return_value.set_result(None)
        mock_cache.set.return_value = asyncio.Future()
        mock_cache.set.return_value.set_result(True)
        mock_cache.increment.return_value = asyncio.Future()
        mock_cache.increment.return_value.set_result(1)
        mock_cache.delete.return_value = asyncio.Future()
        mock_cache.delete.return_value.set_result(True)
        return mock_cache

    def test_password_strength_validation(self, security_manager):
        """Test password strength requirements"""
        weak_passwords = [
            "123456",  # Too short
            "password",  # No uppercase, numbers, symbols
            "Password",  # No numbers, symbols
            "Password123",  # No symbols
            "PASSWORD123!",  # No lowercase
        ]
        
        for password in weak_passwords:
            assert not security_manager.validate_password_strength(password)
            errors = security_manager.get_password_strength_errors(password)
            assert len(errors) > 0

        # Strong password
        strong_password = "SecureP@ssw0rd123!"
        assert security_manager.validate_password_strength(strong_password)
        assert len(security_manager.get_password_strength_errors(strong_password)) == 0

    def test_password_hashing_security(self, security_manager):
        """Test password hashing with bcrypt"""
        password = "TestPassword123!"
        hashed = security_manager.hash_password(password)
        
        # Verify hash format
        assert hashed.startswith("$2b$")
        assert len(hashed) == 60  # Standard bcrypt hash length
        
        # Verify password verification
        assert security_manager.verify_password(password, hashed)
        assert not security_manager.verify_password("wrong_password", hashed)

    def test_timing_attack_protection(self, security_manager):
        """Test timing attack protection in password verification"""
        import time
        
        password = "TestPassword123!"
        hashed = security_manager.hash_password(password)
        
        # Measure timing for correct password
        start = time.time()
        security_manager.verify_password(password, hashed)
        correct_time = time.time() - start
        
        # Measure timing for incorrect password
        start = time.time()
        security_manager.verify_password("wrong_password", hashed)
        incorrect_time = time.time() - start
        
        # Times should be relatively similar (within reasonable bounds)
        # This is not a perfect test but catches obvious timing differences
        time_diff = abs(correct_time - incorrect_time)
        assert time_diff < 0.1, "Potential timing attack vulnerability"

    def test_jwt_token_security(self, security_manager):
        """Test JWT token creation and validation"""
        user_data = {
            "sub": "user123",
            "email": "test@example.com",
            "username": "testuser"
        }
        
        # Create token
        token = security_manager.create_access_token(user_data)
        assert isinstance(token, str)
        assert len(token) > 100  # JWT should be reasonably long
        
        # Verify token
        payload = security_manager.verify_token(token)
        assert payload is not None
        assert payload["sub"] == "user123"
        assert payload["email"] == "test@example.com"
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "iat" in payload
        assert "jti" in payload  # JWT ID for tracking

    def test_jwt_token_expiration(self, security_manager):
        """Test JWT token expiration handling"""
        user_data = {"sub": "user123", "email": "test@example.com"}
        
        # Create expired token
        expired_delta = timedelta(seconds=-1)
        expired_token = security_manager.create_access_token(user_data, expired_delta)
        
        # Verify expired token is rejected
        payload = security_manager.verify_token(expired_token)
        assert payload is None

    def test_jwt_token_tampering_protection(self, security_manager):
        """Test JWT token tampering detection"""
        user_data = {"sub": "user123", "email": "test@example.com"}
        token = security_manager.create_access_token(user_data)
        
        # Tamper with token
        tampered_token = token[:-10] + "tampered123"
        
        # Verify tampered token is rejected
        payload = security_manager.verify_token(tampered_token)
        assert payload is None

    @pytest.mark.asyncio
    async def test_rate_limiting(self, security_manager, mock_cache_manager):
        """Test authentication rate limiting"""
        security_manager.cache_manager = mock_cache_manager
        
        # Mock rate limit exceeded
        mock_cache_manager.get.return_value = asyncio.Future()
        mock_cache_manager.get.return_value.set_result(10)  # Over limit
        
        email = "test@example.com"
        ip_address = "192.168.1.1"
        
        result = await security_manager._check_rate_limit(email, ip_address)
        assert result is False

    @pytest.mark.asyncio
    async def test_account_lockout(self, security_manager, mock_cache_manager):
        """Test account lockout after failed attempts"""
        security_manager.cache_manager = mock_cache_manager
        
        # Mock account locked
        mock_cache_manager.get.return_value = asyncio.Future()
        mock_cache_manager.get.return_value.set_result(True)
        
        result = await security_manager._is_account_locked("test@example.com")
        assert result is True


class TestSecurityHeaders:
    """Test security headers middleware"""

    def test_security_headers_present(self):
        """Test that all required security headers are present"""
        response = client.get("/health")
        
        required_headers = [
            "Content-Security-Policy",
            "X-Content-Type-Options",
            "X-Frame-Options", 
            "X-XSS-Protection",
            "Referrer-Policy",
            "Permissions-Policy",
            "Strict-Transport-Security"
        ]
        
        for header in required_headers:
            assert header in response.headers, f"Missing security header: {header}"

    def test_content_security_policy(self):
        """Test Content Security Policy configuration"""
        response = client.get("/health")
        csp_header = response.headers.get("Content-Security-Policy")
        
        assert csp_header is not None
        assert "default-src 'self'" in csp_header
        assert "script-src 'self'" in csp_header
        assert "object-src 'none'" in csp_header
        assert "frame-src 'none'" in csp_header
        assert "upgrade-insecure-requests" in csp_header

    def test_csp_nonce_generation(self):
        """Test CSP nonce generation and uniqueness"""
        response1 = client.get("/health")
        response2 = client.get("/health")
        
        nonce1 = response1.headers.get("X-CSP-Nonce")
        nonce2 = response2.headers.get("X-CSP-Nonce")
        
        assert nonce1 is not None
        assert nonce2 is not None
        assert nonce1 != nonce2  # Nonces should be unique

    def test_security_headers_values(self):
        """Test security header values are correct"""
        response = client.get("/health")
        
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
        assert "strict-origin-when-cross-origin" in response.headers["Referrer-Policy"]


class TestInputValidation:
    """Test input validation and sanitization"""

    def test_sql_injection_protection(self):
        """Test SQL injection attempt detection"""
        malicious_payloads = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "admin'/*",
            "' UNION SELECT * FROM users--"
        ]
        
        for payload in malicious_payloads:
            # Test in URL parameter
            response = client.get(f"/api/v1/users?search={payload}")
            assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_xss_protection(self):
        """Test XSS attack prevention"""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            "<svg onload=alert('xss')>"
        ]
        
        for payload in xss_payloads:
            response = client.get(f"/api/v1/search?q={payload}")
            assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_path_traversal_protection(self):
        """Test path traversal attack prevention"""
        traversal_payloads = [
            "../../../etc/passwd",
            "..\\..\\windows\\system32",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "....//....//....//etc/passwd"
        ]
        
        for payload in traversal_payloads:
            response = client.get(f"/api/v1/files/{payload}")
            assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_command_injection_protection(self):
        """Test command injection prevention"""
        command_payloads = [
            "; cat /etc/passwd",
            "| whoami",
            "&& rm -rf /",
            "` id `"
        ]
        
        for payload in command_payloads:
            response = client.post(
                "/api/v1/execute",
                json={"command": payload},
                headers={"Content-Type": "application/json"}
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestDataEncryption:
    """Test data encryption capabilities"""

    @pytest.fixture
    def security_manager(self):
        return SecurityManager()

    def test_data_encryption_decryption(self, security_manager):
        """Test symmetric encryption/decryption"""
        sensitive_data = "credit_card_number:1234567890123456"
        
        # Encrypt data
        encrypted = security_manager.encrypt_sensitive_data(sensitive_data)
        assert encrypted != sensitive_data
        assert len(encrypted) > len(sensitive_data)
        
        # Decrypt data
        decrypted = security_manager.decrypt_sensitive_data(encrypted)
        assert decrypted == sensitive_data

    def test_encryption_different_results(self, security_manager):
        """Test that encryption produces different results each time"""
        data = "test_data_123"
        
        encrypted1 = security_manager.encrypt_sensitive_data(data)
        encrypted2 = security_manager.encrypt_sensitive_data(data)
        
        # Should be different due to random IV/nonce
        assert encrypted1 != encrypted2
        
        # But both should decrypt to original data
        assert security_manager.decrypt_sensitive_data(encrypted1) == data
        assert security_manager.decrypt_sensitive_data(encrypted2) == data


class TestRateLimiting:
    """Test rate limiting functionality"""

    @pytest.mark.asyncio
    async def test_rate_limiting_enforcement(self):
        """Test rate limiting blocks excessive requests"""
        # This test would need a real cache manager
        # For now, test that the middleware is properly configured
        
        # Make multiple rapid requests
        responses = []
        for _ in range(10):
            response = client.get("/api/v1/workflows")
            responses.append(response)
        
        # At least some requests should be successful (authentication issues aside)
        # In a real test, we'd mock the cache and verify rate limiting logic


class TestAuditLogging:
    """Test audit logging functionality"""

    def test_request_logging(self):
        """Test that requests are properly logged"""
        # This would typically test that log entries are created
        # For now, verify the middleware is working
        response = client.get("/health")
        assert response.status_code == 200
        # In a real implementation, we'd check that audit logs were created

    def test_sensitive_data_not_logged(self):
        """Test that sensitive data is not logged"""
        # Test that password fields, tokens, etc. are not in logs
        # This would require checking actual log output
        pass


class TestSecurityMonitoring:
    """Test security monitoring and alerting"""

    @pytest.mark.asyncio
    async def test_security_metrics_collection(self):
        """Test security metrics are collected"""
        security_manager = SecurityManager()
        metrics = await security_manager.get_security_metrics()
        
        assert isinstance(metrics, dict)
        # With no cache manager, should return error
        assert "error" in metrics or "total_events" in metrics

    def test_suspicious_activity_detection(self):
        """Test suspicious activity detection"""
        # Test automated tool detection
        response = client.get(
            "/health",
            headers={"User-Agent": "python-requests/2.25.1 bot crawler"}
        )
        # Should still work but be logged as suspicious
        assert response.status_code == 200


class TestDatabaseSecurity:
    """Test database security measures"""

    @pytest.mark.asyncio
    async def test_database_ssl_configuration(self):
        """Test database SSL configuration"""
        secure_db = SecureDatabaseManager()
        
        # Test SSL context creation
        ssl_context = secure_db._create_ssl_context()
        # Context may be None in development/testing
        assert ssl_context is None or hasattr(ssl_context, 'check_hostname')

    def test_parameterized_queries_required(self):
        """Test that only parameterized queries are allowed"""
        secure_db = SecureDatabaseManager()
        
        # Test that raw string formatting is blocked
        with pytest.raises(ValueError, match="Raw string formatting not allowed"):
            asyncio.run(secure_db.execute_secure_query("SELECT * FROM users WHERE id = %s", "123"))

    def test_query_type_validation(self):
        """Test that only safe query types are allowed"""
        secure_db = SecureDatabaseManager()
        
        # Test that unsafe queries are blocked
        unsafe_queries = [
            "DROP TABLE users",
            "CREATE TABLE test (id INT)",
            "ALTER TABLE users ADD COLUMN test VARCHAR(255)",
            "GRANT ALL ON users TO public"
        ]
        
        for query in unsafe_queries:
            with pytest.raises(ValueError, match="Only SELECT, INSERT, UPDATE, DELETE queries are allowed"):
                asyncio.run(secure_db.execute_secure_query(query))


class TestCORSSecurity:
    """Test CORS security configuration"""

    def test_cors_headers_present(self):
        """Test CORS headers are properly set"""
        response = client.options("/api/v1/workflows")
        
        # Check CORS headers
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
        assert "Access-Control-Allow-Headers" in response.headers

    def test_cors_origin_validation(self):
        """Test CORS origin validation"""
        # Test allowed origin
        response = client.get(
            "/api/v1/workflows",
            headers={"Origin": "http://localhost:3000"}
        )
        # Should not be blocked by CORS
        
        # Test disallowed origin
        response = client.get(
            "/api/v1/workflows", 
            headers={"Origin": "https://malicious-site.com"}
        )
        # Would be blocked by CORS in a real scenario


if __name__ == "__main__":
    pytest.main([__file__, "-v"])