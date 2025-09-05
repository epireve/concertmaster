"""
ConcertMaster Security and Authentication
JWT-based authentication and authorization system
"""

import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import logging

from ..config import settings
from ..database.connection import get_db_session
from ..database.models import User
from ..services.cache_manager import CacheManager

logger = logging.getLogger(__name__)
security = HTTPBearer()

class SecurityManager:
    """Security manager for authentication and authorization"""
    
    def __init__(self):
        self.cache_manager: Optional[CacheManager] = None
    
    def set_cache_manager(self, cache_manager: CacheManager):
        """Set cache manager instance"""
        self.cache_manager = cache_manager
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception as e:
            logger.error(f"Password verification error: {str(e)}")
            return False
    
    def create_access_token(self, user_data: Dict[str, Any], 
                           expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = user_data.copy()
        
        # Set expiration
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })
        
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self, user_id: str) -> str:
        """Create JWT refresh token"""
        to_encode = {
            "sub": user_id,
            "type": "refresh",
            "exp": datetime.utcnow() + timedelta(days=30),
            "iat": datetime.utcnow()
        }
        
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            
            # Check token type
            if payload.get("type") != "access":
                return None
            
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.JWTError as e:
            logger.warning(f"JWT verification failed: {str(e)}")
            return None
    
    def verify_refresh_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify refresh token"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            
            # Check token type
            if payload.get("type") != "refresh":
                return None
            
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Refresh token has expired")
            return None
        except jwt.JWTError as e:
            logger.warning(f"Refresh token verification failed: {str(e)}")
            return None
    
    async def get_user_from_token(self, token: str, db: AsyncSession) -> Optional[User]:
        """Get user from access token"""
        # Verify token
        payload = self.verify_token(token)
        if not payload:
            return None
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        # Check cache first
        if self.cache_manager:
            cached_user = await self.cache_manager.get(f"user:{user_id}")
            if cached_user:
                return User(**cached_user)
        
        # Get user from database
        try:
            result = await db.execute(
                "SELECT * FROM users WHERE id = %s AND is_active = TRUE",
                (user_id,)
            )
            user_data = result.fetchone()
            
            if user_data:
                user = User(**dict(user_data))
                
                # Cache user data
                if self.cache_manager:
                    user_dict = {
                        "id": str(user.id),
                        "email": user.email,
                        "username": user.username,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "is_active": user.is_active,
                        "is_admin": user.is_admin
                    }
                    await self.cache_manager.set(f"user:{user_id}", user_dict, ttl=300)
                
                return user
            
            return None
            
        except Exception as e:
            logger.error(f"Database error getting user {user_id}: {str(e)}")
            return None
    
    async def authenticate_user(self, email: str, password: str, db: AsyncSession) -> Optional[User]:
        """Authenticate user with email and password"""
        try:
            result = await db.execute(
                "SELECT * FROM users WHERE email = %s AND is_active = TRUE",
                (email.lower(),)
            )
            user_data = result.fetchone()
            
            if not user_data:
                return None
            
            user = User(**dict(user_data))
            
            if not self.verify_password(password, user.password_hash):
                return None
            
            # Update last login
            await db.execute(
                "UPDATE users SET last_login_at = %s WHERE id = %s",
                (datetime.utcnow(), user.id)
            )
            await db.commit()
            
            return user
            
        except Exception as e:
            logger.error(f"Authentication error for {email}: {str(e)}")
            return None
    
    async def create_user(self, user_data: Dict[str, Any], db: AsyncSession) -> User:
        """Create new user"""
        try:
            # Check if user exists
            result = await db.execute(
                "SELECT id FROM users WHERE email = %s OR username = %s",
                (user_data["email"].lower(), user_data["username"])
            )
            existing_user = result.fetchone()
            
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="User with this email or username already exists"
                )
            
            # Create user
            user = User(
                id=uuid.uuid4(),
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
            
            logger.info(f"Created user: {user.email}")
            return user
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"User creation error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to create user")

# Global security manager instance
security_manager = SecurityManager()

# FastAPI Dependencies
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db_session)
) -> User:
    """Dependency to get current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await security_manager.get_user_from_token(credentials.credentials, db)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

async def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Dependency to get current admin user"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

def require_permissions(permissions: list):
    """Decorator factory for permission-based access control"""
    def permission_checker(current_user: User = Depends(get_current_active_user)) -> User:
        # This would check user permissions if implemented
        # For now, just return the user
        return current_user
    
    return permission_checker

# Password validation
def validate_password(password: str) -> bool:
    """Validate password strength"""
    if len(password) < 8:
        return False
    
    # Check for at least one uppercase, lowercase, digit, and special character
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)
    
    return has_upper and has_lower and has_digit and has_special

def get_password_validation_errors(password: str) -> list:
    """Get password validation error messages"""
    errors = []
    
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    
    if not any(c.isupper() for c in password):
        errors.append("Password must contain at least one uppercase letter")
    
    if not any(c.islower() for c in password):
        errors.append("Password must contain at least one lowercase letter")
    
    if not any(c.isdigit() for c in password):
        errors.append("Password must contain at least one digit")
    
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        errors.append("Password must contain at least one special character")
    
    return errors

# Session management with Redis
async def create_user_session(user: User, cache_manager: CacheManager) -> str:
    """Create user session in cache"""
    session_id = str(uuid.uuid4())
    session_data = {
        "user_id": str(user.id),
        "email": user.email,
        "username": user.username,
        "created_at": datetime.utcnow().isoformat()
    }
    
    await cache_manager.create_session(session_id, session_data)
    return session_id

async def invalidate_user_session(session_id: str, cache_manager: CacheManager) -> bool:
    """Invalidate user session"""
    return await cache_manager.delete_session(session_id)