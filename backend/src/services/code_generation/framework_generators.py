"""
Framework Generator Factory and Base Classes
Provides code generation for different frontend frameworks
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum

from ...schemas.visual_builder import FrameworkType

logger = logging.getLogger(__name__)


class GenerationMode(str, Enum):
    """Code generation modes"""
    COMPONENT = "component"
    PAGE = "page"
    PROJECT = "project"


class BaseFrameworkGenerator(ABC):
    """Base class for framework-specific code generators"""
    
    def __init__(self, framework: FrameworkType):
        self.framework = framework
        self.file_extensions = self._get_file_extensions()
        self.templates = self._load_templates()
    
    @abstractmethod
    def generate_component(
        self,
        component_definition: Dict[str, Any],
        config: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Generate code for a single component"""
        pass
    
    @abstractmethod
    def generate_page(
        self,
        page_definition: Dict[str, Any],
        components: List[Dict[str, Any]],
        config: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Generate code for a complete page"""
        pass
    
    @abstractmethod
    def generate_project(
        self,
        project_definition: Dict[str, Any],
        config: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Generate complete project structure and code"""
        pass
    
    @abstractmethod
    def _get_file_extensions(self) -> Dict[str, str]:
        """Get file extensions for this framework"""
        pass
    
    @abstractmethod
    def _load_templates(self) -> Dict[str, str]:
        """Load framework-specific templates"""
        pass
    
    def validate_component_definition(self, definition: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate component definition for this framework"""
        errors = []
        
        # Basic validation
        if not isinstance(definition, dict):
            errors.append("Component definition must be a dictionary")
            return False, errors
        
        required_fields = ['type', 'children']
        for field in required_fields:
            if field not in definition:
                errors.append(f"Missing required field: {field}")
        
        # Framework-specific validation
        framework_errors = self._validate_framework_specific(definition)
        errors.extend(framework_errors)
        
        return len(errors) == 0, errors
    
    def _validate_framework_specific(self, definition: Dict[str, Any]) -> List[str]:
        """Framework-specific validation (override in subclasses)"""
        return []
    
    def _generate_imports(self, dependencies: List[str]) -> str:
        """Generate import statements for dependencies"""
        # Base implementation - override in subclasses
        return ""
    
    def _generate_exports(self, component_name: str) -> str:
        """Generate export statements"""
        # Base implementation - override in subclasses
        return f"export default {component_name};"
    
    def _format_props(self, props: Dict[str, Any]) -> str:
        """Format props for the target framework"""
        # Base implementation - override in subclasses
        if not props:
            return ""
        
        formatted_props = []
        for key, value in props.items():
            if isinstance(value, str):
                formatted_props.append(f'{key}="{value}"')
            elif isinstance(value, bool):
                if value:
                    formatted_props.append(key)
                else:
                    formatted_props.append(f'{key}={str(value).lower()}')
            else:
                formatted_props.append(f'{key}={{{str(value)}}}')
        
        return " ".join(formatted_props)
    
    def _format_styles(self, styles: Dict[str, Any]) -> str:
        """Format styles for the target framework"""
        if not styles:
            return ""
        
        css_rules = []
        for property, value in styles.items():
            # Convert camelCase to kebab-case for CSS
            css_property = self._camel_to_kebab(property)
            css_rules.append(f"{css_property}: {value};")
        
        return " ".join(css_rules)
    
    def _camel_to_kebab(self, camel_str: str) -> str:
        """Convert camelCase to kebab-case"""
        import re
        return re.sub('([a-z0-9])([A-Z])', r'\1-\2', camel_str).lower()
    
    def _generate_event_handlers(self, events: Dict[str, Any]) -> str:
        """Generate event handler code"""
        # Base implementation - override in subclasses
        return ""
    
    def _render_children(self, children: Any, indent: int = 2) -> str:
        """Render child components recursively"""
        if not children:
            return ""
        
        if isinstance(children, str):
            return children
        
        if isinstance(children, list):
            rendered_children = []
            for child in children:
                if isinstance(child, dict):
                    rendered_children.append(self._render_component_tree(child, indent + 2))
                else:
                    rendered_children.append(str(child))
            
            return "\n".join(rendered_children)
        
        return str(children)
    
    def _render_component_tree(self, component: Dict[str, Any], indent: int = 2) -> str:
        """Render a component tree to framework-specific markup"""
        # Base implementation - override in subclasses for framework-specific rendering
        component_type = component.get('type', 'div')
        props = component.get('props', {})
        children = component.get('children', [])
        
        # Format props
        props_str = self._format_props(props)
        props_part = f" {props_str}" if props_str else ""
        
        # Render children
        children_content = self._render_children(children, indent + 2)
        
        indent_str = " " * indent
        if children_content:
            return f"{indent_str}<{component_type}{props_part}>\n{children_content}\n{indent_str}</{component_type}>"
        else:
            return f"{indent_str}<{component_type}{props_part} />"


class FrameworkGeneratorFactory:
    """Factory for creating framework-specific generators"""
    
    _generators = {}
    
    @classmethod
    def register_generator(cls, framework: FrameworkType, generator_class):
        """Register a generator for a framework"""
        cls._generators[framework] = generator_class
    
    @classmethod
    def create_generator(cls, framework: FrameworkType) -> BaseFrameworkGenerator:
        """Create a generator for the specified framework"""
        if framework not in cls._generators:
            raise ValueError(f"No generator registered for framework: {framework}")
        
        generator_class = cls._generators[framework]
        return generator_class(framework)
    
    @classmethod
    def get_supported_frameworks(cls) -> List[FrameworkType]:
        """Get list of supported frameworks"""
        return list(cls._generators.keys())
    
    @classmethod
    def is_framework_supported(cls, framework: FrameworkType) -> bool:
        """Check if a framework is supported"""
        return framework in cls._generators


# Initialize factory (generators will register themselves when imported)
def initialize_generators():
    """Initialize all framework generators"""
    from .react_generator import ReactGenerator
    from .vue_generator import VueGenerator  
    from .angular_generator import AngularGenerator
    from .vanilla_generator import VanillaGenerator
    
    # Register generators
    FrameworkGeneratorFactory.register_generator(FrameworkType.REACT, ReactGenerator)
    FrameworkGeneratorFactory.register_generator(FrameworkType.VUE, VueGenerator)
    FrameworkGeneratorFactory.register_generator(FrameworkType.ANGULAR, AngularGenerator)
    FrameworkGeneratorFactory.register_generator(FrameworkType.VANILLA, VanillaGenerator)


# Auto-initialize when module is imported
initialize_generators()