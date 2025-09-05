"""
Vanilla JavaScript Code Generator
Generates vanilla HTML/CSS/JS from Visual Builder definitions
"""

import logging
from typing import Dict, List, Any, Optional
import json

from .framework_generators import BaseFrameworkGenerator
from ...schemas.visual_builder import FrameworkType

logger = logging.getLogger(__name__)


class VanillaGenerator(BaseFrameworkGenerator):
    """Vanilla JavaScript code generator"""
    
    def __init__(self, framework: FrameworkType):
        super().__init__(framework)
    
    def generate_component(self, component_definition: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate vanilla JavaScript component"""
        try:
            config = config or {}
            component_name = component_definition.get('name', 'Component')
            
            # Generate component files
            files = {
                f"{component_name}.html": self._generate_component_html(component_definition),
                f"{component_name}.css": self._generate_component_css(component_definition),
                f"{component_name}.js": self._generate_component_js(component_definition, config),
            }
            
            # Add TypeScript if enabled
            if config.get('typescript', False):
                files[f"{component_name}.ts"] = self._generate_component_ts(component_definition, config)
                del files[f"{component_name}.js"]
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_required_dependencies(component_definition),
                'metadata': {
                    'framework': 'vanilla',
                    'component_name': component_name,
                    'typescript': config.get('typescript', False),
                    'module_type': config.get('module_type', 'es6')
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate vanilla component: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def generate_page(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate vanilla JavaScript page"""
        try:
            config = config or {}
            page_name = page_definition.get('name', 'Page')
            
            files = {
                f"{page_name.lower()}.html": self._generate_page_html(page_definition, components, config),
                f"{page_name.lower()}.css": self._generate_page_css(page_definition),
                f"{page_name.lower()}.js": self._generate_page_js(page_definition, components, config),
            }
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_page_dependencies(page_definition, components),
                'metadata': {
                    'framework': 'vanilla',
                    'page_name': page_name,
                    'components_count': len(components)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate vanilla page: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def generate_project(self, project_definition: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate complete vanilla JavaScript project"""
        try:
            config = config or {}
            project_name = project_definition.get('name', 'vanilla-app')
            
            files = {}
            
            # Generate main HTML file
            files['index.html'] = self._generate_index_html(project_definition, config)
            
            # Generate CSS files
            files['css/styles.css'] = self._generate_global_styles(project_definition)
            files['css/normalize.css'] = self._generate_normalize_css()
            
            # Generate JavaScript files
            if config.get('typescript', False):
                files['src/main.ts'] = self._generate_main_ts(project_definition, config)
                files['tsconfig.json'] = self._generate_tsconfig(config)
            else:
                files['js/main.js'] = self._generate_main_js(project_definition, config)
            
            # Generate utility files
            files['js/utils.js'] = self._generate_utils_js()
            files['js/dom.js'] = self._generate_dom_helpers()
            
            # Generate configuration files
            if config.get('build_tool') == 'vite':
                files['vite.config.js'] = self._generate_vite_config(project_definition, config)
                files['package.json'] = self._generate_vite_package_json(project_definition, config)
            elif config.get('build_tool') == 'webpack':
                files['webpack.config.js'] = self._generate_webpack_config(project_definition, config)
                files['package.json'] = self._generate_webpack_package_json(project_definition, config)
            else:
                files['package.json'] = self._generate_basic_package_json(project_definition, config)
            
            # Generate additional files
            files['.gitignore'] = self._generate_gitignore()
            files['README.md'] = self._generate_readme(project_definition)
            
            # Generate service worker if PWA is enabled
            if config.get('pwa', False):
                files['sw.js'] = self._generate_service_worker()
                files['manifest.json'] = self._generate_web_manifest(project_definition)
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_project_dependencies(project_definition, config),
                'scripts': self._get_project_scripts(config),
                'metadata': {
                    'framework': 'vanilla',
                    'project_name': project_name,
                    'typescript': config.get('typescript', False),
                    'build_tool': config.get('build_tool', 'none'),
                    'pwa': config.get('pwa', False)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate vanilla project: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def _get_file_extensions(self) -> Dict[str, str]:
        """Get vanilla JavaScript file extensions"""
        return {
            'component': '.js',
            'page': '.html',
            'style': '.css',
            'script': '.js',
            'typescript': '.ts'
        }
    
    def _load_templates(self) -> Dict[str, str]:
        """Load vanilla JavaScript templates"""
        return {
            'component_class': """class {component_name} {{
  constructor(element, options = {{}}) {{
    this.element = element;
    this.options = {{ ...this.defaultOptions, ...options }};
    this.init();
  }}
  
  get defaultOptions() {{
    return {{
      {default_options}
    }};
  }}
  
  init() {{
    this.render();
    this.bindEvents();
  }}
  
  render() {{
    this.element.innerHTML = this.template();
  }}
  
  template() {{
    return `{template_content}`;
  }}
  
  {methods}
  
  bindEvents() {{
    {event_bindings}
  }}
  
  destroy() {{
    // Cleanup logic
    this.element.innerHTML = '';
  }}
}}""",
            'component_function': """function create{component_name}(container, options = {{}}) {{
  const defaultOptions = {{
    {default_options}
  }};
  
  const config = {{ ...defaultOptions, ...options }};
  
  function render() {{
    container.innerHTML = `{template_content}`;
    bindEvents();
  }}
  
  function bindEvents() {{
    {event_bindings}
  }}
  
  {methods}
  
  // Public API
  const api = {{
    render,
    destroy: () => container.innerHTML = ''
  }};
  
  // Initialize
  render();
  
  return api;
}}"""
        }
    
    def _generate_component_html(self, component_definition: Dict[str, Any]) -> str:
        """Generate component HTML"""
        component_name = component_definition.get('name', 'Component')
        definition = component_definition.get('definition', {})
        
        if not definition:
            return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{component_name}</title>
    <link rel="stylesheet" href="{component_name}.css">
</head>
<body>
    <div class="{component_name.lower()}">
        <p>{component_name} Component</p>
    </div>
    <script src="{component_name}.js"></script>
</body>
</html>"""
        
        # Generate HTML structure
        html_content = self._render_html_structure(definition)
        
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{component_name}</title>
    <link rel="stylesheet" href="{component_name}.css">
</head>
<body>
    {html_content}
    <script src="{component_name}.js"></script>
</body>
</html>"""
    
    def _generate_component_css(self, component_definition: Dict[str, Any]) -> str:
        """Generate component CSS"""
        styles = component_definition.get('styles', {})
        component_name = component_definition.get('name', 'component').lower()
        
        css_rules = []
        
        # Base component styles
        css_rules.append(f".{component_name} {{")
        css_rules.append("  /* Component base styles */")
        
        if styles:
            for property, value in styles.items():
                css_property = self._camel_to_kebab(property)
                css_rules.append(f"  {css_property}: {value};")
        else:
            css_rules.append("  display: block;")
            css_rules.append("  padding: 1rem;")
        
        css_rules.append("}")
        
        # Add responsive styles
        css_rules.extend([
            "",
            "/* Responsive styles */",
            "@media (max-width: 768px) {",
            f"  .{component_name} {{",
            "    padding: 0.5rem;",
            "  }",
            "}"
        ])
        
        return "\n".join(css_rules)
    
    def _generate_component_js(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate component JavaScript"""
        component_name = component_definition.get('name', 'Component')
        events = component_definition.get('events', {})
        state_management = component_definition.get('state_management', {})
        props = component_definition.get('props_schema', {})
        definition = component_definition.get('definition', {})
        
        use_class = config.get('use_classes', True)
        
        # Generate default options
        default_options = self._generate_default_options(props)
        
        # Generate template content
        template_content = self._generate_template_string(definition)
        
        # Generate methods
        methods = self._generate_js_methods(events, state_management)
        
        # Generate event bindings
        event_bindings = self._generate_js_event_bindings(events)
        
        if use_class:
            template = self.templates['component_class']
        else:
            template = self.templates['component_function']
        
        return template.format(
            component_name=component_name,
            default_options=default_options,
            template_content=template_content,
            methods=methods,
            event_bindings=event_bindings
        )
    
    def _generate_component_ts(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate TypeScript component"""
        component_name = component_definition.get('name', 'Component')
        props = component_definition.get('props_schema', {})
        
        # Generate TypeScript interfaces
        interfaces = self._generate_ts_interfaces(component_name, props)
        
        # Generate TypeScript class
        ts_class = self._generate_ts_class(component_definition, config)
        
        return f"""// TypeScript interfaces
{interfaces}

// Component implementation
{ts_class}

// Export component
export default {component_name};"""
    
    def _render_html_structure(self, definition: Dict[str, Any], indent: int = 2) -> str:
        """Render component definition as HTML"""
        component_type = definition.get('type', 'div')
        props = definition.get('props', {})
        children = definition.get('children', [])
        events = definition.get('events', {})
        
        # Format HTML attributes
        html_attrs = self._format_html_attributes(props, events)
        attrs_part = f" {html_attrs}" if html_attrs else ""
        
        # Render children
        children_content = self._render_html_children(children, indent + 2)
        
        indent_str = " " * indent
        if children_content.strip():
            return f"{indent_str}<{component_type}{attrs_part}>\n{children_content}\n{indent_str}</{component_type}>"
        else:
            return f"{indent_str}<{component_type}{attrs_part}></{component_type}>"
    
    def _format_html_attributes(self, props: Dict[str, Any], events: Dict[str, Any] = None) -> str:
        """Format HTML attributes"""
        attrs = []
        
        # Regular attributes
        for key, value in props.items():
            if key == 'className':
                key = 'class'  # Use 'class' instead of 'className' in HTML
            
            if isinstance(value, bool):
                if value:
                    attrs.append(key)
            else:
                attrs.append(f'{key}="{value}"')
        
        # Event attributes (data attributes for JS binding)
        if events:
            for event_name in events.keys():
                attrs.append(f'data-on-{event_name}="true"')
        
        return " ".join(attrs)
    
    def _render_html_children(self, children: Any, indent: int) -> str:
        """Render HTML children"""
        if not children:
            return ""
        
        if isinstance(children, str):
            indent_str = " " * indent
            return f"{indent_str}{children}"
        
        if isinstance(children, list):
            rendered_children = []
            for child in children:
                if isinstance(child, dict):
                    rendered_children.append(self._render_html_structure(child, indent))
                else:
                    indent_str = " " * indent
                    rendered_children.append(f"{indent_str}{child}")
            
            return "\n".join(rendered_children)
        
        return str(children)
    
    def _generate_default_options(self, props: Dict[str, Any]) -> str:
        """Generate default options for component"""
        if not props:
            return ""
        
        options = []
        for prop_name, prop_config in props.items():
            default_value = prop_config.get('default')
            if default_value is not None:
                options.append(f"      {prop_name}: {json.dumps(default_value)}")
        
        return ",\n".join(options)
    
    def _generate_template_string(self, definition: Dict[str, Any]) -> str:
        """Generate template string for JavaScript"""
        if not definition:
            return "<div>Component content</div>"
        
        # Convert HTML structure to template string
        html = self._render_html_structure(definition, 0).strip()
        
        # Escape backticks for template literals
        html = html.replace('`', '\\`')
        html = html.replace('${', '\\${')
        
        return html
    
    def _generate_js_methods(self, events: Dict[str, Any], state: Dict[str, Any]) -> str:
        """Generate JavaScript methods"""
        methods = []
        
        # State management methods
        if state:
            methods.append("""  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }""")
        
        # Event handler methods
        for event_name, event_config in events.items():
            method_name = f"handle{event_name.title()}"
            
            if isinstance(event_config, str):
                methods.append(f"""  {method_name}(event) {{
    {event_config}
  }}""")
            elif isinstance(event_config, dict):
                handler_body = event_config.get('handler', '// Handler logic')
                methods.append(f"""  {method_name}(event) {{
    {handler_body}
  }}""")
        
        return "\n\n".join(methods)
    
    def _generate_js_event_bindings(self, events: Dict[str, Any]) -> str:
        """Generate JavaScript event bindings"""
        if not events:
            return "// No events to bind"
        
        bindings = []
        for event_name in events.keys():
            method_name = f"handle{event_name.title()}"
            bindings.append(f"""    this.element.querySelectorAll('[data-on-{event_name}]').forEach(el => {{
      el.addEventListener('{event_name}', this.{method_name}.bind(this));
    }});""")
        
        return "\n".join(bindings)
    
    def _generate_ts_interfaces(self, component_name: str, props: Dict[str, Any]) -> str:
        """Generate TypeScript interfaces"""
        interfaces = []
        
        # Props interface
        if props:
            prop_definitions = []
            for prop_name, prop_config in props.items():
                prop_type = self._get_typescript_type(prop_config)
                optional = "?" if not prop_config.get('required', True) else ""
                prop_definitions.append(f"  {prop_name}{optional}: {prop_type};")
            
            interfaces.append(f"""interface {component_name}Options {{
{chr(10).join(prop_definitions)}
}}""")
        else:
            interfaces.append(f"interface {component_name}Options {{}}")
        
        return "\n\n".join(interfaces)
    
    def _generate_ts_class(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate TypeScript class"""
        component_name = component_definition.get('name', 'Component')
        
        return f"""class {component_name} {{
  private element: HTMLElement;
  private options: {component_name}Options;
  
  constructor(element: HTMLElement, options: {component_name}Options = {{}}) {{
    this.element = element;
    this.options = options;
    this.init();
  }}
  
  private init(): void {{
    this.render();
    this.bindEvents();
  }}
  
  private render(): void {{
    this.element.innerHTML = this.template();
  }}
  
  private template(): string {{
    return `<div>{component_name} Component</div>`;
  }}
  
  private bindEvents(): void {{
    // Event binding logic
  }}
  
  public destroy(): void {{
    this.element.innerHTML = '';
  }}
}}"""
    
    def _get_typescript_type(self, config: Dict[str, Any]) -> str:
        """Get TypeScript type"""
        config_type = config.get('type', 'any')
        
        type_mapping = {
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'object': 'any',
            'array': 'any[]',
            'function': '() => void'
        }
        
        return type_mapping.get(config_type, 'any')
    
    def _get_required_dependencies(self, component_definition: Dict[str, Any]) -> List[str]:
        """Get required dependencies for component"""
        return []  # Vanilla components don't require external dependencies
    
    def _generate_page_html(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any]) -> str:
        """Generate page HTML"""
        page_name = page_definition.get('name', 'Page')
        title = page_definition.get('title', page_name)
        
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="{page_name.lower()}.css">
</head>
<body>
    <div class="page {page_name.lower()}">
        <header>
            <h1>{title}</h1>
        </header>
        <main>
            <p>Page content goes here</p>
        </main>
        <footer>
            <p>&copy; 2024 {title}</p>
        </footer>
    </div>
    <script src="{page_name.lower()}.js"></script>
</body>
</html>"""
    
    def _generate_page_css(self, page_definition: Dict[str, Any]) -> str:
        """Generate page CSS"""
        page_name = page_definition.get('name', 'page').lower()
        
        return f""".page {{
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}}

.{page_name} {{
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}}

header {{
  background: #f8f9fa;
  padding: 2rem 0;
  text-align: center;
  border-bottom: 1px solid #dee2e6;
}}

main {{
  flex: 1;
  padding: 2rem 0;
}}

footer {{
  background: #343a40;
  color: white;
  text-align: center;
  padding: 1rem 0;
  margin-top: auto;
}}

/* Responsive styles */
@media (max-width: 768px) {{
  .page {{
    padding: 0 0.5rem;
  }}
  
  header, main, footer {{
    padding: 1rem 0;
  }}
}}"""
    
    def _generate_page_js(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any]) -> str:
        """Generate page JavaScript"""
        page_name = page_definition.get('name', 'Page')
        
        return f"""// {page_name} JavaScript
document.addEventListener('DOMContentLoaded', function() {{
  console.log('{page_name} loaded');
  
  // Initialize page functionality
  init{page_name}();
}});

function init{page_name}() {{
  // Page initialization logic
  setupEventListeners();
  loadPageContent();
}}

function setupEventListeners() {{
  // Add event listeners for page interactions
}}

function loadPageContent() {{
  // Load dynamic content if needed
}}"""
    
    def _get_page_dependencies(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]]) -> List[str]:
        """Get page dependencies"""
        return []  # Vanilla pages don't require external dependencies
    
    def _generate_index_html(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate main index.html"""
        project_name = project_definition.get('name', 'Vanilla App')
        
        pwa_meta = """
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#2196F3">""" if config.get('pwa', False) else ""
        
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{project_name}</title>
    <meta name="description" content="{project_definition.get('description', 'A vanilla JavaScript application')}">
    <link rel="stylesheet" href="css/normalize.css">
    <link rel="stylesheet" href="css/styles.css">{pwa_meta}
</head>
<body>
    <div id="app">
        <header class="app-header">
            <h1>Welcome to {project_name}</h1>
        </header>
        <main class="app-content">
            <p>Your application content goes here.</p>
        </main>
        <footer class="app-footer">
            <p>&copy; 2024 {project_name}</p>
        </footer>
    </div>
    
    <script src="js/utils.js"></script>
    <script src="js/dom.js"></script>
    <script src="js/main.js"></script>
</body>
</html>"""
    
    def _generate_global_styles(self, project_definition: Dict[str, Any]) -> str:
        """Generate global CSS styles"""
        return """/* Global Styles */
:root {
  --primary-color: #2196F3;
  --secondary-color: #FFC107;
  --success-color: #4CAF50;
  --danger-color: #F44336;
  --warning-color: #FF9800;
  --info-color: #00BCD4;
  --light-color: #F8F9FA;
  --dark-color: #343A40;
  
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --border-radius: 4px;
  --box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  --transition: all 0.3s ease;
}

* {
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  line-height: 1.6;
  color: var(--dark-color);
  margin: 0;
  padding: 0;
  background-color: #ffffff;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: var(--primary-color);
  color: white;
  padding: 2rem 1rem;
  text-align: center;
}

.app-header h1 {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 300;
}

.app-content {
  flex: 1;
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.app-footer {
  background: var(--light-color);
  padding: 1rem;
  text-align: center;
  border-top: 1px solid #dee2e6;
}

/* Utility Classes */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  margin: -0.5rem;
}

.col {
  flex: 1;
  padding: 0.5rem;
}

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 1rem; }
.mt-4 { margin-top: 1.5rem; }

.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 1rem; }
.mb-4 { margin-bottom: 1.5rem; }

/* Responsive */
@media (max-width: 768px) {
  .app-header h1 {
    font-size: 2rem;
  }
  
  .app-content {
    padding: 1rem;
  }
  
  .row {
    flex-direction: column;
  }
}"""
    
    def _generate_normalize_css(self) -> str:
        """Generate normalize.css"""
        return """/*! normalize.css v8.0.1 | MIT License | github.com/necolas/normalize.css */

html {
  line-height: 1.15;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
}

main {
  display: block;
}

h1 {
  font-size: 2em;
  margin: 0.67em 0;
}

hr {
  box-sizing: content-box;
  height: 0;
  overflow: visible;
}

pre {
  font-family: monospace, monospace;
  font-size: 1em;
}

a {
  background-color: transparent;
}

abbr[title] {
  border-bottom: none;
  text-decoration: underline;
  text-decoration: underline dotted;
}

b,
strong {
  font-weight: bolder;
}

code,
kbd,
samp {
  font-family: monospace, monospace;
  font-size: 1em;
}

small {
  font-size: 80%;
}

sub,
sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub {
  bottom: -0.25em;
}

sup {
  top: -0.5em;
}

img {
  border-style: none;
}

button,
input,
optgroup,
select,
textarea {
  font-family: inherit;
  font-size: 100%;
  line-height: 1.15;
  margin: 0;
}

button,
input {
  overflow: visible;
}

button,
select {
  text-transform: none;
}

button,
[type="button"],
[type="reset"],
[type="submit"] {
  -webkit-appearance: button;
}

button::-moz-focus-inner,
[type="button"]::-moz-focus-inner,
[type="reset"]::-moz-focus-inner,
[type="submit"]::-moz-focus-inner {
  border-style: none;
  padding: 0;
}

button:-moz-focusring,
[type="button"]:-moz-focusring,
[type="reset"]:-moz-focusring,
[type="submit"]:-moz-focusring {
  outline: 1px dotted ButtonText;
}

fieldset {
  padding: 0.35em 0.75em 0.625em;
}

legend {
  box-sizing: border-box;
  color: inherit;
  display: table;
  max-width: 100%;
  padding: 0;
  white-space: normal;
}

progress {
  vertical-align: baseline;
}

textarea {
  overflow: auto;
}

[type="checkbox"],
[type="radio"] {
  box-sizing: border-box;
  padding: 0;
}

[type="number"]::-webkit-inner-spin-button,
[type="number"]::-webkit-outer-spin-button {
  height: auto;
}

[type="search"] {
  -webkit-appearance: textfield;
  outline-offset: -2px;
}

[type="search"]::-webkit-search-decoration {
  -webkit-appearance: none;
}

::-webkit-file-upload-button {
  -webkit-appearance: button;
  font: inherit;
}

details {
  display: block;
}

summary {
  display: list-item;
}

template {
  display: none;
}

[hidden] {
  display: none;
}"""
    
    def _generate_main_js(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate main JavaScript file"""
        project_name = project_definition.get('name', 'App')
        
        return f"""// {project_name} - Main Application Entry Point
(function() {{
  'use strict';
  
  // Application state
  const AppState = {{
    initialized: false,
    version: '1.0.0'
  }};
  
  // Initialize application
  function initApp() {{
    console.log('Initializing {project_name}...');
    
    // Set up global event listeners
    setupGlobalEvents();
    
    // Initialize components
    initializeComponents();
    
    // Mark as initialized
    AppState.initialized = true;
    
    console.log('{project_name} initialized successfully');
  }}
  
  function setupGlobalEvents() {{
    // Handle global events
    window.addEventListener('resize', debounce(handleResize, 250));
    
    // Handle navigation
    document.addEventListener('click', handleNavigation);
  }}
  
  function handleResize() {{
    console.log('Window resized');
    // Handle responsive behavior
  }}
  
  function handleNavigation(event) {{
    // Handle navigation clicks
    if (event.target.matches('a[data-navigate]')) {{
      event.preventDefault();
      const target = event.target.getAttribute('href');
      navigateTo(target);
    }}
  }}
  
  function navigateTo(url) {{
    console.log('Navigating to:', url);
    // Simple navigation logic
  }}
  
  function initializeComponents() {{
    // Initialize any components on the page
    const components = document.querySelectorAll('[data-component]');
    components.forEach(initComponent);
  }}
  
  function initComponent(element) {{
    const componentType = element.getAttribute('data-component');
    console.log('Initializing component:', componentType);
    
    // Component initialization logic would go here
  }}
  
  // Utility function for debouncing
  function debounce(func, wait) {{
    let timeout;
    return function executedFunction(...args) {{
      const later = () => {{
        clearTimeout(timeout);
        func(...args);
      }};
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    }};
  }}
  
  // Start the application when DOM is ready
  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', initApp);
  }} else {{
    initApp();
  }}
  
  // Expose global API
  window.{project_name}App = {{
    state: AppState,
    navigateTo,
    version: '1.0.0'
  }};
  
}})();"""
    
    def _generate_main_ts(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate main TypeScript file"""
        project_name = project_definition.get('name', 'App')
        
        return f"""// {project_name} - Main Application Entry Point

interface AppState {{
  initialized: boolean;
  version: string;
}}

interface AppAPI {{
  state: AppState;
  navigateTo: (url: string) => void;
  version: string;
}}

class {project_name}Application {{
  private state: AppState = {{
    initialized: false,
    version: '1.0.0'
  }};
  
  constructor() {{
    this.init();
  }}
  
  private init(): void {{
    console.log('Initializing {project_name}...');
    
    this.setupGlobalEvents();
    this.initializeComponents();
    
    this.state.initialized = true;
    console.log('{project_name} initialized successfully');
  }}
  
  private setupGlobalEvents(): void {{
    window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 250));
    document.addEventListener('click', this.handleNavigation.bind(this));
  }}
  
  private handleResize(): void {{
    console.log('Window resized');
  }}
  
  private handleNavigation(event: Event): void {{
    const target = event.target as HTMLElement;
    if (target.matches('a[data-navigate]')) {{
      event.preventDefault();
      const href = target.getAttribute('href');
      if (href) {{
        this.navigateTo(href);
      }}
    }}
  }}
  
  public navigateTo(url: string): void {{
    console.log('Navigating to:', url);
  }}
  
  private initializeComponents(): void {{
    const components = document.querySelectorAll('[data-component]');
    components.forEach(this.initComponent.bind(this));
  }}
  
  private initComponent(element: Element): void {{
    const componentType = element.getAttribute('data-component');
    console.log('Initializing component:', componentType);
  }}
  
  private debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {{
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>): void => {{
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }};
  }}
  
  public getAPI(): AppAPI {{
    return {{
      state: this.state,
      navigateTo: this.navigateTo.bind(this),
      version: this.state.version
    }};
  }}
}}

// Initialize application
const app = new {project_name}Application();

// Expose global API
declare global {{
  interface Window {{
    {project_name}App: AppAPI;
  }}
}}

window.{project_name}App = app.getAPI();

export default {project_name}Application;"""
    
    def _generate_utils_js(self) -> str:
        """Generate utility functions"""
        return """// Utility Functions

// DOM Utilities
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Async utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Array utilities
const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const unique = (array) => [...new Set(array)];

// String utilities
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

// Number utilities
const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

// Object utilities
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
const merge = (target, ...sources) => Object.assign(target, ...sources);

// Event utilities
const once = (element, event, callback) => {
  const handler = (e) => {
    callback(e);
    element.removeEventListener(event, handler);
  };
  element.addEventListener(event, handler);
};

// Export utilities
window.Utils = {
  $, $$, sleep, chunk, unique, capitalize, slugify,
  random, clamp, deepClone, merge, once
};"""
    
    def _generate_dom_helpers(self) -> str:
        """Generate DOM helper functions"""
        return """// DOM Helper Functions

const DOM = {
  // Element creation
  create(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else if (key.startsWith('on')) {
        const event = key.slice(2).toLowerCase();
        element.addEventListener(event, value);
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Append children
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });
    
    return element;
  },
  
  // Element manipulation
  addClass(element, className) {
    element.classList.add(className);
    return element;
  },
  
  removeClass(element, className) {
    element.classList.remove(className);
    return element;
  },
  
  toggleClass(element, className) {
    element.classList.toggle(className);
    return element;
  },
  
  hasClass(element, className) {
    return element.classList.contains(className);
  },
  
  // Content manipulation
  setHTML(element, html) {
    element.innerHTML = html;
    return element;
  },
  
  setText(element, text) {
    element.textContent = text;
    return element;
  },
  
  // Event helpers
  on(element, event, callback) {
    element.addEventListener(event, callback);
    return element;
  },
  
  off(element, event, callback) {
    element.removeEventListener(event, callback);
    return element;
  },
  
  // Animation helpers
  fadeIn(element, duration = 300) {
    element.style.opacity = 0;
    element.style.display = 'block';
    
    const start = performance.now();
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = progress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  },
  
  fadeOut(element, duration = 300) {
    const start = performance.now();
    const initialOpacity = parseFloat(getComputedStyle(element).opacity);
    
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = initialOpacity * (1 - progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.style.display = 'none';
      }
    };
    
    requestAnimationFrame(animate);
  }
};

// Export DOM helpers
window.DOM = DOM;"""
    
    def _generate_tsconfig(self, config: Dict[str, Any]) -> str:
        """Generate TypeScript configuration"""
        tsconfig = {
            "compilerOptions": {
                "target": "ES2020",
                "module": "ESNext",
                "lib": ["ES2020", "DOM"],
                "strict": True,
                "esModuleInterop": True,
                "skipLibCheck": True,
                "forceConsistentCasingInFileNames": True,
                "declaration": True,
                "outDir": "./dist",
                "rootDir": "./src"
            },
            "include": ["src/**/*"],
            "exclude": ["node_modules", "dist"]
        }
        
        return json.dumps(tsconfig, indent=2)
    
    def _generate_vite_config(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate Vite configuration"""
        return """import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})"""
    
    def _generate_webpack_config(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate Webpack configuration"""
        return """const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './js/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  mode: process.env.NODE_ENV || 'development',
  devServer: {
    static: './dist',
    port: 3000,
    open: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html'
    })
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      }
    ]
  }
};"""
    
    def _generate_vite_package_json(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate package.json for Vite"""
        project_name = project_definition.get('name', 'vanilla-app')
        
        package_json = {
            "name": project_name,
            "version": "1.0.0",
            "type": "module",
            "scripts": {
                "dev": "vite",
                "build": "vite build",
                "preview": "vite preview"
            },
            "devDependencies": {
                "vite": "^5.0.0"
            }
        }
        
        if config.get('typescript', False):
            package_json["devDependencies"]["typescript"] = "^5.0.0"
        
        return json.dumps(package_json, indent=2)
    
    def _generate_webpack_package_json(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate package.json for Webpack"""
        project_name = project_definition.get('name', 'vanilla-app')
        
        package_json = {
            "name": project_name,
            "version": "1.0.0",
            "scripts": {
                "start": "webpack serve --mode development",
                "build": "webpack --mode production",
                "dev": "webpack --mode development --watch"
            },
            "devDependencies": {
                "webpack": "^5.0.0",
                "webpack-cli": "^5.0.0",
                "webpack-dev-server": "^4.0.0",
                "html-webpack-plugin": "^5.0.0",
                "css-loader": "^6.0.0",
                "style-loader": "^3.0.0"
            }
        }
        
        return json.dumps(package_json, indent=2)
    
    def _generate_basic_package_json(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate basic package.json"""
        project_name = project_definition.get('name', 'vanilla-app')
        
        package_json = {
            "name": project_name,
            "version": "1.0.0",
            "description": project_definition.get('description', 'A vanilla JavaScript application'),
            "main": "js/main.js",
            "scripts": {
                "start": "python -m http.server 8000",
                "serve": "python -m http.server 8000"
            },
            "keywords": ["vanilla", "javascript", "web"],
            "author": "",
            "license": "MIT"
        }
        
        return json.dumps(package_json, indent=2)
    
    def _generate_service_worker(self) -> str:
        """Generate service worker for PWA"""
        return """// Service Worker for PWA functionality
const CACHE_NAME = 'vanilla-app-v1';
const urlsToCache = [
  '/',
  '/css/styles.css',
  '/css/normalize.css',
  '/js/main.js',
  '/js/utils.js',
  '/js/dom.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});"""
    
    def _generate_web_manifest(self, project_definition: Dict[str, Any]) -> str:
        """Generate web app manifest"""
        project_name = project_definition.get('name', 'Vanilla App')
        
        manifest = {
            "name": project_name,
            "short_name": project_name,
            "description": project_definition.get('description', 'A vanilla JavaScript application'),
            "start_url": "/",
            "display": "standalone",
            "background_color": "#ffffff",
            "theme_color": "#2196F3",
            "icons": [
                {
                    "src": "icons/icon-192x192.png",
                    "sizes": "192x192",
                    "type": "image/png"
                },
                {
                    "src": "icons/icon-512x512.png",
                    "sizes": "512x512",
                    "type": "image/png"
                }
            ]
        }
        
        return json.dumps(manifest, indent=2)
    
    def _generate_gitignore(self) -> str:
        """Generate .gitignore file"""
        return """# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build output
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
logs
*.log

# Coverage directory used by tools like istanbul
coverage/

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity"""
    
    def _generate_readme(self, project_definition: Dict[str, Any]) -> str:
        """Generate README.md"""
        project_name = project_definition.get('name', 'Vanilla App')
        
        return f"""# {project_name}

A vanilla JavaScript application generated by Visual Builder.

## Features

- Pure HTML, CSS, and JavaScript
- No external dependencies
- Responsive design
- Modern ES6+ syntax
- Modular architecture

## Getting Started

### Prerequisites

- A modern web browser
- A local web server (optional but recommended)

### Installation

1. Clone or download this project
2. Open `index.html` in your web browser, or
3. Start a local web server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Using PHP
php -S localhost:8000
```

4. Navigate to `http://localhost:8000`

## Project Structure

```
{project_name.lower()}/
├── index.html          # Main HTML file
├── css/
│   ├── styles.css      # Main stylesheet
│   └── normalize.css   # CSS reset
├── js/
│   ├── main.js         # Main application logic
│   ├── utils.js        # Utility functions
│   └── dom.js          # DOM helper functions
└── README.md           # This file
```

## Development

The application is built with vanilla JavaScript using modern ES6+ features:

- ES6 Classes and Modules
- Arrow Functions
- Template Literals
- Destructuring
- Async/Await

## Browser Support

This application supports all modern browsers:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
"""
    
    def _get_project_dependencies(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> List[str]:
        """Get project dependencies"""
        dependencies = []
        
        if config.get('build_tool') == 'vite':
            dependencies.append('vite')
        elif config.get('build_tool') == 'webpack':
            dependencies.extend([
                'webpack', 'webpack-cli', 'webpack-dev-server',
                'html-webpack-plugin', 'css-loader', 'style-loader'
            ])
        
        if config.get('typescript', False):
            dependencies.append('typescript')
        
        return dependencies
    
    def _get_project_scripts(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Get project scripts"""
        if config.get('build_tool') == 'vite':
            return {
                "dev": "vite",
                "build": "vite build",
                "preview": "vite preview"
            }
        elif config.get('build_tool') == 'webpack':
            return {
                "start": "webpack serve --mode development",
                "build": "webpack --mode production",
                "dev": "webpack --mode development --watch"
            }
        else:
            return {
                "start": "python -m http.server 8000",
                "serve": "python -m http.server 8000"
            }