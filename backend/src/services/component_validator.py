"""
Component Validator Service
Validates Visual Builder component definitions
"""

import logging
from typing import Dict, List, Any, Optional
from jsonschema import validate, ValidationError, Draft7Validator
from ..schemas.visual_builder import ComponentValidationResponse, FrameworkType

logger = logging.getLogger(__name__)


class ComponentValidator:
    """Validates Visual Builder component definitions"""
    
    def __init__(self):
        self.base_component_schema = self._get_base_component_schema()
        self.framework_schemas = self._get_framework_schemas()
    
    async def validate_component(
        self,
        component_type: str,
        definition: Dict[str, Any],
        target_framework: FrameworkType,
        validate_props: bool = True,
        validate_events: bool = True
    ) -> ComponentValidationResponse:
        """Validate a component definition"""
        errors = []
        warnings = []
        suggestions = []
        
        try:
            # Basic structure validation
            self._validate_basic_structure(definition, errors)
            
            # Framework-specific validation
            if target_framework in self.framework_schemas:
                self._validate_framework_specific(
                    definition, target_framework, errors, warnings
                )
            
            # Component type validation
            self._validate_component_type(component_type, definition, errors, warnings)
            
            # Props validation
            if validate_props and 'props' in definition:
                self._validate_props(definition['props'], errors, warnings)
            
            # Events validation
            if validate_events and 'events' in definition:
                self._validate_events(definition['events'], errors, warnings)
            
            # Generate suggestions
            suggestions = self._generate_suggestions(definition, target_framework)
            
            is_valid = len(errors) == 0
            
            return ComponentValidationResponse(
                is_valid=is_valid,
                errors=errors,
                warnings=warnings,
                suggestions=suggestions
            )
            
        except Exception as e:
            logger.error(f"Component validation failed: {e}")
            return ComponentValidationResponse(
                is_valid=False,
                errors=[{"field": "general", "message": f"Validation error: {str(e)}"}],
                warnings=warnings,
                suggestions=suggestions
            )
    
    def _validate_basic_structure(self, definition: Dict[str, Any], errors: List[Dict[str, str]]) -> None:
        """Validate basic component structure"""
        required_fields = ['type', 'children']
        
        for field in required_fields:
            if field not in definition:
                errors.append({
                    "field": field,
                    "message": f"Required field '{field}' is missing"
                })
        
        # Validate type
        if 'type' in definition and not isinstance(definition['type'], str):
            errors.append({
                "field": "type",
                "message": "Component type must be a string"
            })
        
        # Validate children
        if 'children' in definition:
            if not isinstance(definition['children'], (list, str, type(None))):
                errors.append({
                    "field": "children",
                    "message": "Children must be a list, string, or null"
                })
            elif isinstance(definition['children'], list):
                for i, child in enumerate(definition['children']):
                    if isinstance(child, dict):
                        self._validate_basic_structure(child, errors)
                    elif not isinstance(child, (str, int, float, bool, type(None))):
                        errors.append({
                            "field": f"children[{i}]",
                            "message": "Child components must be objects or primitive values"
                        })
    
    def _validate_framework_specific(
        self,
        definition: Dict[str, Any],
        framework: FrameworkType,
        errors: List[Dict[str, str]],
        warnings: List[Dict[str, str]]
    ) -> None:
        """Validate framework-specific requirements"""
        
        if framework == FrameworkType.REACT:
            self._validate_react_component(definition, errors, warnings)
        elif framework == FrameworkType.VUE:
            self._validate_vue_component(definition, errors, warnings)
        elif framework == FrameworkType.ANGULAR:
            self._validate_angular_component(definition, errors, warnings)
        elif framework == FrameworkType.VANILLA:
            self._validate_vanilla_component(definition, errors, warnings)
    
    def _validate_react_component(
        self,
        definition: Dict[str, Any],
        errors: List[Dict[str, str]],
        warnings: List[Dict[str, str]]
    ) -> None:
        """Validate React-specific component requirements"""
        
        # Check for React-specific props
        if 'props' in definition:
            props = definition['props']
            
            # Check for reserved props
            reserved_props = {'key', 'ref', 'children'}
            for prop in props:
                if prop in reserved_props:
                    warnings.append({
                        "field": f"props.{prop}",
                        "message": f"'{prop}' is a reserved React prop"
                    })
            
            # Check for common React patterns
            if 'className' not in props and 'class' in props:
                warnings.append({
                    "field": "props.class",
                    "message": "Use 'className' instead of 'class' in React"
                })
        
        # Validate JSX attributes
        if 'type' in definition:
            component_type = definition['type']
            if component_type in ['input', 'textarea', 'select']:
                if 'props' in definition and 'defaultValue' not in definition['props']:
                    warnings.append({
                        "field": "props",
                        "message": f"Consider using 'defaultValue' for {component_type} components"
                    })
    
    def _validate_vue_component(
        self,
        definition: Dict[str, Any],
        errors: List[Dict[str, str]],
        warnings: List[Dict[str, str]]
    ) -> None:
        """Validate Vue-specific component requirements"""
        
        # Check for Vue-specific directives
        if 'props' in definition:
            props = definition['props']
            
            # Check for Vue directives
            vue_directives = ['v-if', 'v-show', 'v-for', 'v-model', 'v-on']
            for prop in props:
                if prop.startswith('v-') and prop not in vue_directives:
                    warnings.append({
                        "field": f"props.{prop}",
                        "message": f"Unknown Vue directive: {prop}"
                    })
    
    def _validate_angular_component(
        self,
        definition: Dict[str, Any],
        errors: List[Dict[str, str]],
        warnings: List[Dict[str, str]]
    ) -> None:
        """Validate Angular-specific component requirements"""
        
        # Check for Angular-specific attributes
        if 'props' in definition:
            props = definition['props']
            
            # Check for Angular directives
            angular_directives = ['*ngIf', '*ngFor', '(click)', '[disabled]', '[(ngModel)]']
            for prop in props:
                if prop.startswith('*') or prop.startswith('(') or prop.startswith('['):
                    if prop not in angular_directives:
                        warnings.append({
                            "field": f"props.{prop}",
                            "message": f"Verify Angular directive syntax: {prop}"
                        })
    
    def _validate_vanilla_component(
        self,
        definition: Dict[str, Any],
        errors: List[Dict[str, str]],
        warnings: List[Dict[str, str]]
    ) -> None:
        """Validate vanilla JavaScript component requirements"""
        
        # Check for standard HTML attributes
        if 'props' in definition:
            props = definition['props']
            
            # Check for non-standard attributes
            standard_attrs = {
                'id', 'class', 'style', 'title', 'lang', 'dir', 'tabindex',
                'contenteditable', 'draggable', 'hidden', 'spellcheck'
            }
            
            for prop in props:
                if not prop.startswith('data-') and prop not in standard_attrs:
                    if 'type' in definition:
                        element_type = definition['type']
                        if not self._is_valid_html_attribute(prop, element_type):
                            warnings.append({
                                "field": f"props.{prop}",
                                "message": f"'{prop}' may not be a valid attribute for {element_type}"
                            })
    
    def _validate_component_type(
        self,
        component_type: str,
        definition: Dict[str, Any],
        errors: List[Dict[str, str]],
        warnings: List[Dict[str, str]]
    ) -> None:
        """Validate component type consistency"""
        
        if 'type' in definition and definition['type'] != component_type:
            warnings.append({
                "field": "type",
                "message": f"Component type '{definition['type']}' doesn't match declared type '{component_type}'"
            })
        
        # Validate type-specific requirements
        if component_type in ['button', 'input', 'form', 'select', 'textarea']:
            self._validate_interactive_component(definition, errors, warnings)
        elif component_type in ['img', 'video', 'audio']:
            self._validate_media_component(definition, errors, warnings)
    
    def _validate_interactive_component(
        self,
        definition: Dict[str, Any],
        errors: List[Dict[str, str]],
        warnings: List[Dict[str, str]]
    ) -> None:
        """Validate interactive component requirements"""
        
        if 'events' not in definition or not definition['events']:
            warnings.append({
                "field": "events",
                "message": "Interactive components should have event handlers"
            })
        
        # Check accessibility
        if 'props' in definition:
            props = definition['props']
            if 'aria-label' not in props and 'title' not in props:
                warnings.append({
                    "field": "props",
                    "message": "Interactive components should have accessibility labels"
                })
    
    def _validate_media_component(
        self,
        definition: Dict[str, Any],
        errors: List[Dict[str, str]],
        warnings: List[Dict[str, str]]
    ) -> None:
        """Validate media component requirements"""
        
        if 'props' in definition:
            props = definition['props']
            
            if definition.get('type') == 'img':
                if 'src' not in props:
                    errors.append({
                        "field": "props.src",
                        "message": "Image components must have a 'src' attribute"
                    })
                if 'alt' not in props:
                    warnings.append({
                        "field": "props.alt",
                        "message": "Image components should have 'alt' text for accessibility"
                    })
    
    def _validate_props(self, props: Dict[str, Any], errors: List[Dict[str, str]], warnings: List[Dict[str, str]]) -> None:
        """Validate component props"""
        
        if not isinstance(props, dict):
            errors.append({
                "field": "props",
                "message": "Props must be an object"
            })
            return
        
        # Check for empty props
        if not props:
            warnings.append({
                "field": "props",
                "message": "Component has no props defined"
            })
        
        # Validate individual props
        for prop_name, prop_value in props.items():
            # Check prop naming
            if not prop_name.replace('-', '').replace('_', '').isalnum():
                warnings.append({
                    "field": f"props.{prop_name}",
                    "message": f"Prop name '{prop_name}' contains special characters"
                })
    
    def _validate_events(self, events: Dict[str, Any], errors: List[Dict[str, str]], warnings: List[Dict[str, str]]) -> None:
        """Validate component events"""
        
        if not isinstance(events, dict):
            errors.append({
                "field": "events",
                "message": "Events must be an object"
            })
            return
        
        # Validate event handlers
        valid_events = {
            'click', 'change', 'input', 'focus', 'blur', 'submit', 'keydown',
            'keyup', 'keypress', 'mouseenter', 'mouseleave', 'scroll'
        }
        
        for event_name, event_handler in events.items():
            if event_name not in valid_events:
                warnings.append({
                    "field": f"events.{event_name}",
                    "message": f"Unknown event type: {event_name}"
                })
            
            # Check handler format
            if not isinstance(event_handler, (str, dict)):
                errors.append({
                    "field": f"events.{event_name}",
                    "message": "Event handlers must be strings or objects"
                })
    
    def _generate_suggestions(self, definition: Dict[str, Any], framework: FrameworkType) -> List[Dict[str, str]]:
        """Generate suggestions for improving the component"""
        suggestions = []
        
        # Performance suggestions
        if 'props' in definition and len(definition['props']) > 10:
            suggestions.append({
                "type": "performance",
                "message": "Consider breaking down components with many props"
            })
        
        # Accessibility suggestions
        if 'type' in definition and definition['type'] in ['button', 'input', 'select']:
            if 'props' in definition:
                props = definition['props']
                if 'aria-label' not in props and 'title' not in props:
                    suggestions.append({
                        "type": "accessibility",
                        "message": "Add aria-label or title for better accessibility"
                    })
        
        # Framework-specific suggestions
        if framework == FrameworkType.REACT:
            suggestions.append({
                "type": "framework",
                "message": "Consider using React.memo() for performance optimization"
            })
        
        return suggestions
    
    def _is_valid_html_attribute(self, attribute: str, element_type: str) -> bool:
        """Check if an attribute is valid for a given HTML element"""
        # Simplified validation - could be expanded with complete HTML spec
        common_attributes = {
            'input': {'type', 'name', 'value', 'placeholder', 'disabled', 'required', 'readonly'},
            'button': {'type', 'disabled', 'form', 'name', 'value'},
            'select': {'name', 'disabled', 'required', 'multiple', 'size'},
            'textarea': {'name', 'rows', 'cols', 'disabled', 'readonly', 'required', 'placeholder'},
            'a': {'href', 'target', 'rel', 'download'},
            'img': {'src', 'alt', 'width', 'height', 'loading'},
            'div': set(),  # div accepts most global attributes
            'span': set(),
        }
        
        if element_type in common_attributes:
            return attribute in common_attributes[element_type]
        
        return True  # Unknown elements assume valid
    
    def _get_base_component_schema(self) -> Dict[str, Any]:
        """Get the base JSON schema for component validation"""
        return {
            "type": "object",
            "required": ["type"],
            "properties": {
                "type": {"type": "string"},
                "props": {"type": "object"},
                "children": {
                    "oneOf": [
                        {"type": "array"},
                        {"type": "string"},
                        {"type": "null"}
                    ]
                },
                "events": {"type": "object"},
                "style": {"type": "object"}
            }
        }
    
    def _get_framework_schemas(self) -> Dict[FrameworkType, Dict[str, Any]]:
        """Get framework-specific validation schemas"""
        return {
            FrameworkType.REACT: {
                "properties": {
                    "props": {
                        "type": "object",
                        "not": {
                            "anyOf": [
                                {"properties": {"class": {}}},
                                {"properties": {"for": {}}}
                            ]
                        }
                    }
                }
            },
            FrameworkType.VUE: {
                "properties": {
                    "props": {
                        "type": "object"
                    }
                }
            }
        }