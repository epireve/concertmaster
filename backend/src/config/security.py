"""
Enhanced Security Configuration for ConcertMaster
Secure configuration management with encryption and key rotation
"""

import os
import secrets
import base64
import hashlib
from typing import Optional, Dict, Any, List
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic import validator
from pydantic_settings import BaseSettings
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class SecurityConfig(BaseSettings):
    """Enhanced security configuration with encryption support"""
    
    # Encryption keys
    MASTER_KEY: Optional[str] = None
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    REFRESH_TOKEN_EXPIRATION_DAYS: int = 30
    
    # Password security
    PASSWORD_MIN_LENGTH: int = 12
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_NUMBERS: bool = True
    PASSWORD_REQUIRE_SYMBOLS: bool = True
    PASSWORD_BCRYPT_ROUNDS: int = 12
    
    # Session security
    SESSION_TIMEOUT_MINUTES: int = 30
    CONCURRENT_SESSIONS_LIMIT: int = 5
    SESSION_SECURE_COOKIES: bool = True
    SESSION_SAMESITE: str = "strict"
    
    # Rate limiting
    LOGIN_RATE_LIMIT: int = 5  # attempts per window
    LOGIN_RATE_WINDOW: int = 900  # 15 minutes
    API_RATE_LIMIT: int = 1000
    API_RATE_WINDOW: int = 3600
    
    # Security headers
    CSP_ENABLED: bool = True
    HSTS_ENABLED: bool = True
    HSTS_MAX_AGE: int = 31536000  # 1 year
    SECURITY_HEADERS: Dict[str, str] = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }
    
    # Database security
    DB_SSL_MODE: str = "require"
    DB_SSL_CERT: Optional[str] = None
    DB_SSL_KEY: Optional[str] = None
    DB_SSL_ROOT_CERT: Optional[str] = None
    DB_ENCRYPT_CREDENTIALS: bool = True
    
    # CORS security
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_ORIGINS: List[str] = []
    CORS_ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "PATCH"]
    CORS_ALLOW_HEADERS: List[str] = ["Authorization", "Content-Type", "X-CSP-Nonce"]
    CORS_EXPOSE_HEADERS: List[str] = ["X-Total-Count", "X-CSP-Nonce"]
    CORS_MAX_AGE: int = 86400  # 24 hours
    
    # Security monitoring
    AUDIT_ENABLED: bool = True
    AUDIT_RETENTION_DAYS: int = 90
    SECURITY_ALERT_ENABLED: bool = True
    SECURITY_ALERT_THRESHOLD: int = 10
    
    # File upload security
    UPLOAD_MAX_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_ALLOWED_TYPES: List[str] = [".json", ".csv", ".xlsx", ".xml", ".pdf"]
    UPLOAD_SCAN_ENABLED: bool = True
    UPLOAD_QUARANTINE_ENABLED: bool = True
    
    class Config:
        env_prefix = "SECURITY_"
        env_file = ".env"
        case_sensitive = True

    @validator("SECRET_KEY")
    def validate_secret_key(cls, v):
        if not v or len(v) < 64:
            raise ValueError("SECRET_KEY must be at least 64 characters long")
        return v
    
    @validator("CORS_ALLOW_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v or []

class SecretManager:
    """Secure secret management with encryption at rest"""
    
    def __init__(self, master_key: Optional[str] = None):
        self.master_key = master_key
        self._fernet = None
        self._init_encryption()
    
    def _init_encryption(self):
        """Initialize encryption with master key"""
        if not self.master_key:
            # Generate new master key if not provided
            self.master_key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
            logger.warning("Generated new master key. Store securely!")
        
        try:
            # Derive encryption key from master key
            master_bytes = self.master_key.encode() if isinstance(self.master_key, str) else self.master_key
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'concertmaster_salt',  # In production, use random salt stored securely
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(master_bytes))
            self._fernet = Fernet(key)
            logger.info("Encryption initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            raise

    def encrypt_secret(self, secret: str) -> str:
        """Encrypt a secret value"""
        try:
            encrypted = self._fernet.encrypt(secret.encode())
            return base64.urlsafe_b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Failed to encrypt secret: {e}")
            raise

    def decrypt_secret(self, encrypted_secret: str) -> str:
        """Decrypt a secret value"""
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_secret.encode())
            decrypted = self._fernet.decrypt(encrypted_bytes)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Failed to decrypt secret: {e}")
            raise

    def rotate_encryption_key(self, new_master_key: str) -> bool:
        """Rotate encryption key (requires re-encrypting all secrets)"""
        try:
            old_fernet = self._fernet
            
            # Initialize new encryption
            old_master_key = self.master_key
            self.master_key = new_master_key
            self._init_encryption()
            
            logger.info("Encryption key rotated successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to rotate encryption key: {e}")
            # Restore old key
            self.master_key = old_master_key
            self._fernet = old_fernet
            return False

class SecurityEventLogger:
    """Security event logging and monitoring"""
    
    def __init__(self):
        self.logger = logging.getLogger('security')
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup dedicated security logger"""
        handler = logging.FileHandler('logs/security.log')
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s - %(extra)s'
        )
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
    
    def log_authentication_attempt(self, email: str, success: bool, ip_address: str, user_agent: str):
        """Log authentication attempts"""
        event_data = {
            'event_type': 'authentication',
            'email': email,
            'success': success,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'timestamp': str(datetime.utcnow())
        }
        
        if success:
            self.logger.info(f"Successful login: {email}", extra=event_data)
        else:
            self.logger.warning(f"Failed login attempt: {email}", extra=event_data)
    
    def log_authorization_failure(self, user_id: str, resource: str, action: str, ip_address: str):
        """Log authorization failures"""
        event_data = {
            'event_type': 'authorization_failure',
            'user_id': user_id,
            'resource': resource,
            'action': action,
            'ip_address': ip_address,
            'timestamp': str(datetime.utcnow())
        }
        
        self.logger.warning(f"Authorization failure: user {user_id} attempted {action} on {resource}", 
                           extra=event_data)
    
    def log_suspicious_activity(self, user_id: str, activity: str, details: Dict[str, Any], ip_address: str):
        """Log suspicious activities"""
        event_data = {
            'event_type': 'suspicious_activity',
            'user_id': user_id,
            'activity': activity,
            'details': details,
            'ip_address': ip_address,
            'timestamp': str(datetime.utcnow())
        }
        
        self.logger.warning(f"Suspicious activity: {activity} by user {user_id}", extra=event_data)
    
    def log_security_configuration_change(self, changed_by: str, setting: str, old_value: str, new_value: str):
        """Log security configuration changes"""
        event_data = {
            'event_type': 'security_config_change',
            'changed_by': changed_by,
            'setting': setting,
            'old_value': old_value,
            'new_value': new_value,
            'timestamp': str(datetime.utcnow())
        }
        
        self.logger.info(f"Security config changed: {setting} by {changed_by}", extra=event_data)

class CSPManager:
    """Content Security Policy management with nonce support"""
    
    def __init__(self):
        self.nonce_cache = {}
    
    def generate_nonce(self, request_id: str) -> str:
        """Generate cryptographically secure nonce for CSP"""
        nonce = base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('ascii')
        self.nonce_cache[request_id] = nonce
        return nonce
    
    def get_csp_header(self, nonce: str, debug: bool = False) -> str:
        """Generate Content Security Policy header with nonce"""
        policy_parts = [
            "default-src 'self'",
            f"script-src 'self' 'nonce-{nonce}' 'unsafe-inline'" if debug else f"script-src 'self' 'nonce-{nonce}'",
            f"style-src 'self' 'nonce-{nonce}' 'unsafe-inline'" if debug else f"style-src 'self' 'nonce-{nonce}'",
            "img-src 'self' data: https:",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self'",
            "media-src 'self'",
            "object-src 'none'",
            "frame-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests"
        ]
        
        return "; ".join(policy_parts)

# Global instances
security_config = SecurityConfig()
secret_manager = SecretManager(security_config.MASTER_KEY)
security_logger = SecurityEventLogger()
csp_manager = CSPManager()

def get_database_ssl_config() -> Dict[str, Any]:
    """Get database SSL configuration"""
    ssl_config = {}
    
    if security_config.DB_SSL_MODE:
        ssl_config['sslmode'] = security_config.DB_SSL_MODE
    
    if security_config.DB_SSL_CERT:
        ssl_config['sslcert'] = security_config.DB_SSL_CERT
    
    if security_config.DB_SSL_KEY:
        ssl_config['sslkey'] = security_config.DB_SSL_KEY
    
    if security_config.DB_SSL_ROOT_CERT:
        ssl_config['sslrootcert'] = security_config.DB_SSL_ROOT_CERT
    
    return ssl_config

def generate_secure_secret_key() -> str:
    """Generate a cryptographically secure secret key"""
    return base64.urlsafe_b64encode(secrets.token_bytes(64)).decode('ascii')

def validate_security_headers(headers: Dict[str, str]) -> List[str]:
    """Validate security headers and return missing ones"""
    required_headers = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Referrer-Policy'
    ]
    
    missing_headers = []
    for header in required_headers:
        if header not in headers:
            missing_headers.append(header)
    
    return missing_headers