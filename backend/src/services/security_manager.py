"""
Comprehensive Security Management Service
Handles authentication, authorization, encryption, and security monitoring
"""

import asyncio
import logging
import hashlib
import secrets
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import bcrypt
import jwt
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from ..config import settings
from ..database.models import User, AuditLog
from ..services.cache_manager import CacheManager

logger = logging.getLogger(__name__)

class SecurityManager:
    """Enhanced security management with comprehensive protection"""
    
    def __init__(self, cache_manager: Optional[CacheManager] = None):
        self.cache_manager = cache_manager
        self._encryption_key = None
        self._fernet = None
        self._initialize_encryption()
        
        # Security configuration
        self.config = {
            'password_min_length': 12,
            'password_require_uppercase': True,
            'password_require_lowercase': True,
            'password_require_numbers': True,
            'password_require_symbols': True,
            'max_login_attempts': 5,
            'lockout_duration': 900,  # 15 minutes
            'session_timeout': 1800,  # 30 minutes
            'token_rotation_interval': 3600,  # 1 hour
            'audit_retention_days': 90
        }
    
    def _initialize_encryption(self):
        """Initialize encryption for sensitive data"""
        try:
            # Use a derived key for encryption
            password = settings.SECRET_KEY.encode()
            salt = b'concertmaster_security'  # In production, use a secure random salt
            
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            self._encryption_key = base64.urlsafe_b64encode(kdf.derive(password))
            self._fernet = Fernet(self._encryption_key)
            logger.info("Encryption initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            raise
    
    # Password Management
    def hash_password(self, password: str) -> str:
        """Hash password with enhanced security"""
        # Validate password strength first
        if not self.validate_password_strength(password):
            raise ValueError("Password does not meet security requirements")
        
        # Use bcrypt with high cost factor
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify password with timing attack protection"""
        try:
            # Always perform the hash operation to prevent timing attacks
            result = bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
            return result
        except Exception as e:
            logger.warning(f"Password verification error: {e}")
            # Always return False on error, but take same time as valid check
            bcrypt.checkpw(b"dummy", b"$2b$12$dummy.hash.to.prevent.timing.attacks.abcdefghijk")
            return False
    
    def validate_password_strength(self, password: str) -> bool:
        """Validate password meets security requirements"""
        if len(password) < self.config['password_min_length']:
            return False
        
        checks = [
            (self.config['password_require_uppercase'], any(c.isupper() for c in password)),
            (self.config['password_require_lowercase'], any(c.islower() for c in password)),
            (self.config['password_require_numbers'], any(c.isdigit() for c in password)),
            (self.config['password_require_symbols'], any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password))
        ]
        
        return all(passed for required, passed in checks if required)
    
    def get_password_strength_errors(self, password: str) -> List[str]:
        """Get detailed password validation errors"""
        errors = []
        
        if len(password) < self.config['password_min_length']:
            errors.append(f"Password must be at least {self.config['password_min_length']} characters long")
        
        if self.config['password_require_uppercase'] and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        
        if self.config['password_require_lowercase'] and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        
        if self.config['password_require_numbers'] and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one number")
        
        if self.config['password_require_symbols'] and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            errors.append("Password must contain at least one special character")
        
        return errors
    
    # Authentication with Rate Limiting
    async def authenticate_user(self, email: str, password: str, ip_address: str, 
                               user_agent: str, db: AsyncSession) -> Tuple[Optional[User], str]:
        """Authenticate user with comprehensive security checks"""
        
        # Check if account is locked
        if await self._is_account_locked(email):
            await self._log_security_event("account_locked_attempt", {
                "email": email, "ip_address": ip_address
            })
            return None, "Account temporarily locked due to too many failed attempts"
        
        # Rate limiting check
        if not await self._check_rate_limit(email, ip_address):
            await self._log_security_event("rate_limit_exceeded", {
                "email": email, "ip_address": ip_address
            })
            return None, "Too many login attempts. Please try again later."
        
        try:
            # Get user with parameterized query
            result = await db.execute(
                text("SELECT * FROM users WHERE email = :email AND is_active = TRUE"),
                {"email": email.lower()}
            )
            user_data = result.fetchone()
            
            if not user_data:
                await self._record_failed_attempt(email, ip_address, "user_not_found")
                return None, "Invalid email or password"
            
            user = User(**dict(user_data))
            
            # Verify password
            if not self.verify_password(password, user.password_hash):
                await self._record_failed_attempt(email, ip_address, "invalid_password")
                return None, "Invalid email or password"
            
            # Successful authentication
            await self._clear_failed_attempts(email, ip_address)
            await self._update_last_login(user.id, ip_address, user_agent, db)
            
            await self._log_security_event("successful_login", {
                "user_id": str(user.id),
                "email": email,
                "ip_address": ip_address,
                "user_agent": user_agent
            })
            
            return user, "Authentication successful"
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            await self._log_security_event("authentication_error", {
                "email": email, "error": str(e), "ip_address": ip_address
            })
            return None, "Authentication service unavailable"
    
    async def _is_account_locked(self, email: str) -> bool:
        """Check if account is temporarily locked"""
        if not self.cache_manager:
            return False
        
        lock_key = f"account_lock:{email}"
        return await self.cache_manager.get(lock_key) is not None
    
    async def _check_rate_limit(self, email: str, ip_address: str) -> bool:
        """Check authentication rate limits"""
        if not self.cache_manager:
            return True
        
        email_key = f"login_attempts:{email}"
        ip_key = f"login_attempts:ip:{ip_address}"
        
        email_attempts = await self.cache_manager.get(email_key) or 0
        ip_attempts = await self.cache_manager.get(ip_key) or 0
        
        return (email_attempts < self.config['max_login_attempts'] and 
                ip_attempts < self.config['max_login_attempts'] * 3)  # More lenient for IP
    
    async def _record_failed_attempt(self, email: str, ip_address: str, reason: str):
        """Record failed authentication attempt"""
        if not self.cache_manager:
            return
        
        email_key = f"login_attempts:{email}"
        ip_key = f"login_attempts:ip:{ip_address}"
        
        # Increment counters
        email_attempts = await self.cache_manager.increment(email_key, ttl=self.config['lockout_duration'])
        await self.cache_manager.increment(ip_key, ttl=self.config['lockout_duration'])
        
        # Lock account if too many attempts
        if email_attempts >= self.config['max_login_attempts']:
            lock_key = f"account_lock:{email}"
            await self.cache_manager.set(lock_key, True, ttl=self.config['lockout_duration'])
            
            await self._log_security_event("account_locked", {
                "email": email,
                "ip_address": ip_address,
                "attempts": email_attempts,
                "reason": reason
            })
    
    async def _clear_failed_attempts(self, email: str, ip_address: str):
        """Clear failed authentication attempts"""
        if not self.cache_manager:
            return
        
        email_key = f"login_attempts:{email}"
        ip_key = f"login_attempts:ip:{ip_address}"
        lock_key = f"account_lock:{email}"
        
        await self.cache_manager.delete(email_key)
        await self.cache_manager.delete(ip_key)
        await self.cache_manager.delete(lock_key)
    
    async def _update_last_login(self, user_id: str, ip_address: str, user_agent: str, db: AsyncSession):
        """Update user's last login information"""
        try:
            await db.execute(
                text("""
                    UPDATE users 
                    SET last_login_at = :login_time,
                        metadata = jsonb_set(
                            COALESCE(metadata, '{}'),
                            '{last_login_ip}',
                            :ip_address::jsonb
                        )
                    WHERE id = :user_id
                """),
                {
                    "login_time": datetime.utcnow(),
                    "user_id": user_id,
                    "ip_address": f'"{ip_address}"'  # JSON string format
                }
            )
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to update last login for user {user_id}: {e}")
    
    # Token Management
    def create_access_token(self, user_data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token with enhanced security"""
        to_encode = user_data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
        
        # Add security claims
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "nbf": datetime.utcnow(),  # Not before
            "type": "access",
            "jti": secrets.token_urlsafe(16),  # JWT ID for token tracking
            "iss": "concertmaster",  # Issuer
            "aud": "concertmaster-api"  # Audience
        })
        
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    def create_refresh_token(self, user_id: str) -> str:
        """Create refresh token with extended expiry"""
        to_encode = {
            "sub": user_id,
            "type": "refresh",
            "exp": datetime.utcnow() + timedelta(days=30),
            "iat": datetime.utcnow(),
            "nbf": datetime.utcnow(),
            "jti": secrets.token_urlsafe(16),
            "iss": "concertmaster",
            "aud": "concertmaster-api"
        }
        
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token with comprehensive validation"""
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.JWT_ALGORITHM],
                audience="concertmaster-api",
                issuer="concertmaster"
            )
            
            # Verify token type
            if payload.get("type") != "access":
                return None
            
            # Check if token is blacklisted
            jti = payload.get("jti")
            if jti and await self._is_token_blacklisted(jti):
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.info("Token has expired")
            return None
        except jwt.InvalidAudienceError:
            logger.warning("Invalid token audience")
            return None
        except jwt.InvalidIssuerError:
            logger.warning("Invalid token issuer")
            return None
        except jwt.JWTError as e:
            logger.warning(f"JWT verification failed: {e}")
            return None
    
    async def _is_token_blacklisted(self, jti: str) -> bool:
        """Check if token is blacklisted"""
        if not self.cache_manager:
            return False
        
        blacklist_key = f"token_blacklist:{jti}"
        return await self.cache_manager.get(blacklist_key) is not None
    
    async def blacklist_token(self, token: str):
        """Blacklist a token (for logout)"""
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_exp": False}  # Don't verify expiry for blacklisting
            )
            
            jti = payload.get("jti")
            exp = payload.get("exp")
            
            if jti and exp and self.cache_manager:
                # Calculate remaining TTL
                ttl = exp - datetime.utcnow().timestamp()
                if ttl > 0:
                    blacklist_key = f"token_blacklist:{jti}"
                    await self.cache_manager.set(blacklist_key, True, ttl=int(ttl))
                    
        except Exception as e:
            logger.error(f"Failed to blacklist token: {e}")
    
    # Data Encryption
    def encrypt_sensitive_data(self, data: str) -> str:
        """Encrypt sensitive data for storage"""
        try:
            encrypted = self._fernet.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise
    
    def decrypt_sensitive_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted = self._fernet.decrypt(encrypted_bytes)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise
    
    # Security Event Logging
    async def _log_security_event(self, event_type: str, details: Dict[str, Any]):
        """Log security events for monitoring"""
        try:
            event_data = {
                "event_type": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "details": details
            }
            
            # Log to application logger
            logger.info(f"Security event: {event_type}", extra=event_data)
            
            # Store in cache for real-time monitoring
            if self.cache_manager:
                event_key = f"security_events:{datetime.utcnow().strftime('%Y%m%d%H')}"
                await self.cache_manager.lpush(event_key, event_data)
                await self.cache_manager.expire(event_key, 86400)  # 24 hours
                
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")
    
    # User Management
    async def create_user(self, user_data: Dict[str, Any], db: AsyncSession) -> User:
        """Create new user with security validations"""
        try:
            # Validate password
            password_errors = self.get_password_strength_errors(user_data["password"])
            if password_errors:
                raise HTTPException(
                    status_code=400,
                    detail=f"Password validation failed: {', '.join(password_errors)}"
                )
            
            # Check for existing user
            result = await db.execute(
                text("SELECT id FROM users WHERE email = :email OR username = :username"),
                {"email": user_data["email"].lower(), "username": user_data["username"]}
            )
            existing_user = result.fetchone()
            
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="User with this email or username already exists"
                )
            
            # Create user with hashed password
            user = User(
                email=user_data["email"].lower(),
                username=user_data["username"],
                password_hash=self.hash_password(user_data["password"]),
                first_name=user_data.get("first_name"),
                last_name=user_data.get("last_name"),
                is_active=True,
                is_admin=False
            )
            
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
            await self._log_security_event("user_created", {
                "user_id": str(user.id),
                "email": user.email,
                "username": user.username
            })
            
            logger.info(f"Created user: {user.email}")
            return user
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"User creation error: {e}")
            raise HTTPException(status_code=500, detail="Failed to create user")
    
    # Security Monitoring
    async def get_security_metrics(self) -> Dict[str, Any]:
        """Get security metrics for monitoring"""
        if not self.cache_manager:
            return {"error": "Cache manager not available"}
        
        try:
            # Get today's security events
            today_key = f"security_events:{datetime.utcnow().strftime('%Y%m%d%H')}"
            events = await self.cache_manager.lrange(today_key, 0, -1) or []
            
            # Count events by type
            event_counts = {}
            for event in events:
                event_type = event.get("event_type", "unknown")
                event_counts[event_type] = event_counts.get(event_type, 0) + 1
            
            return {
                "total_events": len(events),
                "event_types": event_counts,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get security metrics: {e}")
            return {"error": str(e)}