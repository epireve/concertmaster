"""
Base Model for SQLAlchemy ORM
Provides common functionality for all database models.
"""

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import declared_attr

class CustomBase:
    """Custom base class for all models"""
    
    @declared_attr
    def __tablename__(cls):
        # Generate table name from class name (CamelCase -> snake_case)
        import re
        name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', cls.__name__)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()
    
    def to_dict(self):
        """Convert model instance to dictionary"""
        return {column.name: getattr(self, column.name) 
                for column in self.__table__.columns}
    
    def update_from_dict(self, data: dict):
        """Update model instance from dictionary"""
        for key, value in data.items():
            if hasattr(self, key):
                setattr(self, key, value)

# Create declarative base
Base = declarative_base(cls=CustomBase)