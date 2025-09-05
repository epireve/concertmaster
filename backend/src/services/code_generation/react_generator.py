"""
React Code Generator
Generates React components and applications from Visual Builder definitions
"""

import logging
from typing import Dict, List, Any, Optional
import json
import re

from .framework_generators import BaseFrameworkGenerator, GenerationMode
from ...schemas.visual_builder import FrameworkType

logger = logging.getLogger(__name__)


class ReactGenerator(BaseFrameworkGenerator):
    """React-specific code generator"""
    
    def __init__(self, framework: FrameworkType):
        super().__init__(framework)
        self.component_imports = set()
        self.hook_imports = set()
    
    def generate_component(self, component_definition: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate React component code"""
        try:
            config = config or {}
            
            # Validate component definition
            is_valid, errors = self.validate_component_definition(component_definition)
            if not is_valid:
                raise ValueError(f"Invalid component definition: {errors}")
            
            component_name = component_definition.get('name', 'Component')
            component_type = component_definition.get('component_type', 'functional')
            
            # Generate component code
            if component_type == 'class':
                code = self._generate_class_component(component_definition, config)
            else:
                code = self._generate_functional_component(component_definition, config)
            
            # Generate supporting files
            files = {
                f"{component_name}.tsx": code,
                f"{component_name}.module.css": self._generate_styles(component_definition),
                f"{component_name}.test.tsx": self._generate_tests(component_definition),
            }
            
            # Add TypeScript types if enabled
            if config.get('typescript', True):
                files[f"{component_name}.types.ts"] = self._generate_types(component_definition)
            
            # Add Storybook stories if enabled
            if config.get('storybook', False):
                files[f"{component_name}.stories.tsx"] = self._generate_stories(component_definition)
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_required_dependencies(component_definition),
                'metadata': {
                    'framework': 'react',
                    'component_name': component_name,
                    'component_type': component_type,
                    'typescript': config.get('typescript', True),
                    'has_styles': bool(component_definition.get('styles')),
                    'has_tests': True,
                    'has_storybook': config.get('storybook', False)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate React component: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def generate_page(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate React page component"""
        try:
            config = config or {}
            page_name = page_definition.get('name', 'Page')
            
            # Generate main page component
            page_code = self._generate_page_component(page_definition, components, config)
            
            # Generate routing configuration
            routing_code = self._generate_routing_config(page_definition, config)
            
            files = {
                f"{page_name}.tsx": page_code,
                f"{page_name}.module.css": self._generate_page_styles(page_definition),
                "routing.ts": routing_code,
            }
            
            # Add layout components if needed
            if page_definition.get('layout_definition'):
                layout_code = self._generate_layout_component(page_definition.get('layout_definition'))
                files["Layout.tsx"] = layout_code
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_page_dependencies(page_definition, components),
                'metadata': {
                    'framework': 'react',
                    'page_name': page_name,
                    'has_routing': bool(page_definition.get('path')),
                    'components_count': len(components)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate React page: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def generate_project(self, project_definition: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate complete React project"""
        try:
            config = config or {}
            project_name = project_definition.get('name', 'react-app')
            
            files = {}
            
            # Generate package.json
            files['package.json'] = self._generate_package_json(project_definition, config)
            
            # Generate main app files
            files['src/App.tsx'] = self._generate_app_component(project_definition, config)
            files['src/index.tsx'] = self._generate_index_file(project_definition, config)
            files['src/index.css'] = self._generate_global_styles(project_definition)
            
            # Generate configuration files
            files['tsconfig.json'] = self._generate_tsconfig(config)
            files['vite.config.ts'] = self._generate_vite_config(project_definition, config)
            files['.gitignore'] = self._generate_gitignore()
            files['README.md'] = self._generate_readme(project_definition)
            
            # Generate environment files
            files['.env.example'] = self._generate_env_example(project_definition)
            
            # Generate additional configuration files
            if config.get('eslint', True):
                files['.eslintrc.json'] = self._generate_eslint_config()
                files['.eslintignore'] = self._generate_eslintignore()
            
            if config.get('prettier', True):
                files['.prettierrc'] = self._generate_prettier_config()
                files['.prettierignore'] = self._generate_prettierignore()
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_project_dependencies(project_definition, config),
                'scripts': self._get_project_scripts(config),
                'metadata': {
                    'framework': 'react',
                    'project_name': project_name,
                    'build_tool': config.get('build_tool', 'vite'),
                    'typescript': config.get('typescript', True),
                    'has_routing': config.get('routing', True),
                    'has_state_management': config.get('state_management'),
                    'has_testing': config.get('testing', True)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate React project: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def _get_file_extensions(self) -> Dict[str, str]:
        """Get React-specific file extensions"""
        return {
            'component': '.tsx',
            'page': '.tsx',
            'style': '.module.css',
            'test': '.test.tsx',
            'story': '.stories.tsx',
            'type': '.types.ts',
            'config': '.ts'
        }
    
    def _load_templates(self) -> Dict[str, str]:
        """Load React-specific templates"""
        return {
            'functional_component': """import React from 'react';
import styles from './{component_name}.module.css';
{type_imports}

{interface_definition}

const {component_name}: React.FC<{component_name}Props> = ({{{props_destructuring}}}) => {{
  {state_definitions}
  {effect_hooks}
  {event_handlers}
  
  return (
    {jsx_content}
  );
}};

export default {component_name};""",
            'class_component': """import React, {{ Component }} from 'react';
import styles from './{component_name}.module.css';
{type_imports}

{interface_definition}

class {component_name} extends Component<{component_name}Props, {component_name}State> {{
  {constructor}
  
  {lifecycle_methods}
  {event_handlers}
  
  render() {{
    return (
      {jsx_content}
    );
  }}
}}

export default {component_name};""",
            'test_template': """import React from 'react';
import {{ render, screen }} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {component_name} from './{component_name}';

describe('{component_name}', () => {{
  it('renders without crashing', () => {{
    render(<{component_name} />);
  }});
  
  {additional_tests}
}});""",
            'story_template': """import type {{ Meta, StoryObj }} from '@storybook/react';
import {component_name} from './{component_name}';

const meta: Meta<typeof {component_name}> = {{
  title: 'Components/{component_name}',
  component: {component_name},
  parameters: {{
    layout: 'centered',
  }},
  tags: ['autodocs'],
}};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {{
  args: {{
    {default_props}
  }},
}};

{additional_stories}"""
        }
    
    def _generate_functional_component(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate functional React component"""
        component_name = component_definition.get('name', 'Component')
        props = component_definition.get('props_schema', {})
        definition = component_definition.get('definition', {})
        events = component_definition.get('events', {})
        state_management = component_definition.get('state_management', {})
        
        # Generate props interface
        interface_definition = self._generate_props_interface(component_name, props)
        
        # Generate props destructuring
        props_destructuring = self._generate_props_destructuring(props)
        
        # Generate state hooks
        state_definitions = self._generate_state_hooks(state_management)
        
        # Generate effect hooks
        effect_hooks = self._generate_effect_hooks(component_definition)
        
        # Generate event handlers
        event_handlers = self._generate_react_event_handlers(events)
        
        # Generate JSX content
        jsx_content = self._generate_jsx_content(definition)
        
        # Generate imports
        type_imports = self._generate_type_imports(component_definition)
        
        template = self.templates['functional_component']
        return template.format(
            component_name=component_name,
            interface_definition=interface_definition,
            props_destructuring=props_destructuring,
            state_definitions=state_definitions,
            effect_hooks=effect_hooks,
            event_handlers=event_handlers,
            jsx_content=jsx_content,
            type_imports=type_imports
        )
    
    def _generate_class_component(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate class-based React component"""
        # Similar implementation for class components
        # For brevity, implementing basic version
        component_name = component_definition.get('name', 'Component')
        return f"""import React, {{ Component }} from 'react';

class {component_name} extends Component {{
  render() {{
    return (
      <div className="{component_name.lower()}">
        {component_name} Component
      </div>
    );
  }}
}}

export default {component_name};"""
    
    def _generate_props_interface(self, component_name: str, props: Dict[str, Any]) -> str:
        """Generate TypeScript interface for component props"""
        if not props:
            return f"interface {component_name}Props {{}}"
        
        prop_definitions = []
        for prop_name, prop_config in props.items():
            prop_type = self._get_typescript_type(prop_config)
            optional = "?" if prop_config.get('required', False) is False else ""
            prop_definitions.append(f"  {prop_name}{optional}: {prop_type};")
        
        return f"""interface {component_name}Props {{
{chr(10).join(prop_definitions)}
}}"""
    
    def _generate_props_destructuring(self, props: Dict[str, Any]) -> str:
        """Generate props destructuring for functional component"""
        if not props:
            return ""
        
        prop_names = []
        for prop_name, prop_config in props.items():
            if prop_config.get('default') is not None:
                default_value = json.dumps(prop_config['default'])
                prop_names.append(f"{prop_name} = {default_value}")
            else:
                prop_names.append(prop_name)
        
        return ", ".join(prop_names)
    
    def _generate_state_hooks(self, state_management: Dict[str, Any]) -> str:
        """Generate useState hooks"""
        if not state_management:
            return ""
        
        hooks = []
        for state_name, state_config in state_management.items():
            initial_value = json.dumps(state_config.get('initial', None))
            hooks.append(f"  const [{state_name}, set{state_name.title()}] = useState({initial_value});")
        
        if hooks:
            self.hook_imports.add('useState')
        
        return "\n".join(hooks)
    
    def _generate_effect_hooks(self, component_definition: Dict[str, Any]) -> str:
        """Generate useEffect hooks"""
        effects = []
        
        # Generate effect for component lifecycle
        if component_definition.get('lifecycle'):
            lifecycle = component_definition['lifecycle']
            if lifecycle.get('onMount'):
                effects.append("""  useEffect(() => {
    // Component mounted
  }, []);""")
                self.hook_imports.add('useEffect')
        
        return "\n".join(effects)
    
    def _generate_react_event_handlers(self, events: Dict[str, Any]) -> str:
        """Generate React event handlers"""
        if not events:
            return ""
        
        handlers = []
        for event_name, event_config in events.items():
            handler_name = f"handle{event_name.title()}"
            
            if isinstance(event_config, str):
                # Simple handler
                handlers.append(f"""  const {handler_name} = () => {{
    {event_config}
  }};""")
            elif isinstance(event_config, dict):
                # Complex handler with parameters
                params = event_config.get('parameters', [])
                body = event_config.get('handler', '// Handler logic')
                
                param_str = ", ".join(params) if params else ""
                handlers.append(f"""  const {handler_name} = ({param_str}) => {{
    {body}
  }};""")
        
        return "\n".join(handlers)
    
    def _generate_jsx_content(self, definition: Dict[str, Any]) -> str:
        """Generate JSX content from component definition"""
        if not definition:
            return "    <div>Component content</div>"
        
        return f"    {self._render_component_tree(definition, 4)}"
    
    def _render_component_tree(self, component: Dict[str, Any], indent: int = 4) -> str:
        """Render component tree as JSX"""
        component_type = component.get('type', 'div')
        props = component.get('props', {})
        children = component.get('children', [])
        events = component.get('events', {})
        
        # Format props for JSX
        jsx_props = self._format_jsx_props(props, events)
        props_part = f" {jsx_props}" if jsx_props else ""
        
        # Render children
        children_content = self._render_jsx_children(children, indent + 2)
        
        indent_str = " " * indent
        if children_content.strip():
            return f"<{component_type}{props_part}>\n{children_content}\n{indent_str}</{component_type}>"
        else:
            return f"<{component_type}{props_part} />"
    
    def _format_jsx_props(self, props: Dict[str, Any], events: Dict[str, Any] = None) -> str:
        """Format props for JSX"""
        jsx_props = []
        
        # Regular props
        for key, value in props.items():
            if key == 'class':
                key = 'className'  # React uses className instead of class
            
            if isinstance(value, str):
                jsx_props.append(f'{key}="{value}"')
            elif isinstance(value, bool):
                if value:
                    jsx_props.append(key)
                else:
                    jsx_props.append(f'{key}={{{str(value).lower()}}}')
            else:
                jsx_props.append(f'{key}={{{json.dumps(value)}}}')
        
        # Event handlers
        if events:
            for event_name in events.keys():
                handler_name = f"handle{event_name.title()}"
                jsx_props.append(f'on{event_name.title()}={{{handler_name}}}')
        
        return " ".join(jsx_props)
    
    def _render_jsx_children(self, children: Any, indent: int) -> str:
        """Render JSX children"""
        if not children:
            return ""
        
        if isinstance(children, str):
            indent_str = " " * indent
            return f"{indent_str}{children}"
        
        if isinstance(children, list):
            rendered_children = []
            for child in children:
                if isinstance(child, dict):
                    rendered_children.append(self._render_component_tree(child, indent))
                else:
                    indent_str = " " * indent
                    rendered_children.append(f"{indent_str}{child}")
            
            return "\n".join(rendered_children)
        
        return str(children)
    
    def _generate_styles(self, component_definition: Dict[str, Any]) -> str:
        """Generate CSS module styles"""
        styles = component_definition.get('styles', {})
        component_name = component_definition.get('name', 'component').lower()
        
        if not styles:
            return f".{component_name} {{\n  /* Component styles */\n}}"
        
        css_rules = [f".{component_name} {{"]
        for property, value in styles.items():
            css_property = self._camel_to_kebab(property)
            css_rules.append(f"  {css_property}: {value};")
        css_rules.append("}")
        
        return "\n".join(css_rules)
    
    def _generate_tests(self, component_definition: Dict[str, Any]) -> str:
        """Generate Jest tests"""
        component_name = component_definition.get('name', 'Component')
        
        basic_tests = """  it('renders without crashing', () => {
    render(<""" + component_name + """ />);
  });
  
  it('displays correct content', () => {
    render(<""" + component_name + """ />);
    // Add specific content assertions
  });"""
        
        template = self.templates['test_template']
        return template.format(
            component_name=component_name,
            additional_tests=basic_tests
        )
    
    def _generate_types(self, component_definition: Dict[str, Any]) -> str:
        """Generate TypeScript type definitions"""
        component_name = component_definition.get('name', 'Component')
        props = component_definition.get('props_schema', {})
        
        types = [f"// Type definitions for {component_name}"]
        types.append("")
        types.append(self._generate_props_interface(component_name, props))
        
        return "\n".join(types)
    
    def _generate_stories(self, component_definition: Dict[str, Any]) -> str:
        """Generate Storybook stories"""
        component_name = component_definition.get('name', 'Component')
        props = component_definition.get('default_props', {})
        
        default_props_str = ""
        if props:
            prop_lines = [f"    {key}: {json.dumps(value)}," for key, value in props.items()]
            default_props_str = "\n".join(prop_lines)
        
        template = self.templates['story_template']
        return template.format(
            component_name=component_name,
            default_props=default_props_str,
            additional_stories=""
        )
    
    def _get_typescript_type(self, prop_config: Dict[str, Any]) -> str:
        """Get TypeScript type from prop configuration"""
        prop_type = prop_config.get('type', 'any')
        
        type_mapping = {
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'object': 'object',
            'array': 'any[]',
            'function': '() => void'
        }
        
        return type_mapping.get(prop_type, 'any')
    
    def _generate_type_imports(self, component_definition: Dict[str, Any]) -> str:
        """Generate type imports"""
        imports = []
        
        if self.hook_imports:
            hook_imports = ", ".join(sorted(self.hook_imports))
            imports.append(f"import React, {{ {hook_imports} }} from 'react';")
        else:
            imports.append("import React from 'react';")
        
        return "\n".join(imports) if imports else ""
    
    def _get_required_dependencies(self, component_definition: Dict[str, Any]) -> List[str]:
        """Get required npm dependencies for component"""
        dependencies = ['react', 'react-dom']
        
        # Add dependencies based on component features
        if component_definition.get('state_management'):
            dependencies.append('@types/react')
        
        return dependencies
    
    def _generate_page_component(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any]) -> str:
        """Generate React page component"""
        page_name = page_definition.get('name', 'Page')
        layout = page_definition.get('layout_definition', {})
        
        return f"""import React from 'react';
import styles from './{page_name}.module.css';

const {page_name}: React.FC = () => {{
  return (
    <div className={{styles.{page_name.lower()}}}>
      <h1>{page_name}</h1>
      {/* Page content */}
    </div>
  );
}};

export default {page_name};"""
    
    def _generate_page_styles(self, page_definition: Dict[str, Any]) -> str:
        """Generate page-specific styles"""
        page_name = page_definition.get('name', 'page').lower()
        return f""".{page_name} {{
  padding: 1rem;
  min-height: 100vh;
}}"""
    
    def _generate_routing_config(self, page_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate routing configuration"""
        return """// Routing configuration
import { RouteObject } from 'react-router-dom';

export const routes: RouteObject[] = [
  // Add your routes here
];"""
    
    def _generate_layout_component(self, layout_definition: Dict[str, Any]) -> str:
        """Generate layout component"""
        return """import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="layout">
      {children}
    </div>
  );
};

export default Layout;"""
    
    def _get_page_dependencies(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]]) -> List[str]:
        """Get dependencies for page generation"""
        return ['react', 'react-dom', 'react-router-dom']
    
    def _generate_package_json(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate package.json"""
        project_name = project_definition.get('name', 'react-app')
        
        package_json = {
            "name": project_name,
            "version": "0.1.0",
            "private": True,
            "type": "module",
            "scripts": {
                "dev": "vite",
                "build": "tsc && vite build",
                "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
                "preview": "vite preview",
                "test": "jest"
            },
            "dependencies": {
                "react": "^18.2.0",
                "react-dom": "^18.2.0"
            },
            "devDependencies": {
                "@types/react": "^18.2.43",
                "@types/react-dom": "^18.2.17",
                "@typescript-eslint/eslint-plugin": "^6.14.0",
                "@typescript-eslint/parser": "^6.14.0",
                "@vitejs/plugin-react": "^4.2.1",
                "eslint": "^8.55.0",
                "eslint-plugin-react-hooks": "^4.6.0",
                "eslint-plugin-react-refresh": "^0.4.5",
                "typescript": "^5.2.2",
                "vite": "^5.0.8"
            }
        }
        
        return json.dumps(package_json, indent=2)
    
    def _generate_app_component(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate main App component"""
        project_name = project_definition.get('name', 'App')
        
        return f"""import React from 'react';
import './App.css';

function App() {{
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to {project_name}</h1>
      </header>
    </div>
  );
}}

export default App;"""
    
    def _generate_index_file(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate index.tsx"""
        return """import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);"""
    
    def _generate_global_styles(self, project_definition: Dict[str, Any]) -> str:
        """Generate global CSS styles"""
        return """body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

* {
  box-sizing: border-box;
}"""
    
    def _generate_tsconfig(self, config: Dict[str, Any]) -> str:
        """Generate TypeScript configuration"""
        tsconfig = {
            "compilerOptions": {
                "target": "ES2020",
                "useDefineForClassFields": True,
                "lib": ["ES2020", "DOM", "DOM.Iterable"],
                "module": "ESNext",
                "skipLibCheck": True,
                "moduleResolution": "bundler",
                "allowImportingTsExtensions": True,
                "resolveJsonModule": True,
                "isolatedModules": True,
                "noEmit": True,
                "jsx": "react-jsx",
                "strict": True,
                "noUnusedLocals": True,
                "noUnusedParameters": True,
                "noFallthroughCasesInSwitch": True
            },
            "include": ["src"],
            "references": [{"path": "./tsconfig.node.json"}]
        }
        
        return json.dumps(tsconfig, indent=2)
    
    def _generate_vite_config(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate Vite configuration"""
        return """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})"""
    
    def _generate_gitignore(self) -> str:
        """Generate .gitignore file"""
        return """# Dependencies
/node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Production
/build
/dist

# Environment variables
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
Thumbs.db"""
    
    def _generate_readme(self, project_definition: Dict[str, Any]) -> str:
        """Generate README.md"""
        project_name = project_definition.get('name', 'React App')
        
        return f"""# {project_name}

A React application generated by Visual Builder.

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Available Scripts

- `npm run dev` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm run lint` - Runs the linter
- `npm run preview` - Preview the production build

## Learn More

To learn more about React, check out the [React documentation](https://reactjs.org/).
"""
    
    def _generate_env_example(self, project_definition: Dict[str, Any]) -> str:
        """Generate .env.example file"""
        return """# Environment Variables Example
# Copy this file to .env.local and fill in your values

# API Configuration
REACT_APP_API_URL=http://localhost:8000
REACT_APP_API_VERSION=v1

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_DEBUG_MODE=false"""
    
    def _generate_eslint_config(self) -> str:
        """Generate ESLint configuration"""
        eslint_config = {
            "root": True,
            "env": {"browser": True, "es2020": True},
            "extends": [
                "eslint:recommended",
                "@typescript-eslint/recommended",
                "eslint-plugin-react-hooks/recommended"
            ],
            "ignorePatterns": ["dist", ".eslintrc.cjs"],
            "parser": "@typescript-eslint/parser",
            "plugins": ["react-refresh"],
            "rules": {
                "react-refresh/only-export-components": [
                    "warn",
                    {"allowConstantExport": True}
                ]
            }
        }
        
        return json.dumps(eslint_config, indent=2)
    
    def _generate_eslintignore(self) -> str:
        """Generate .eslintignore file"""
        return """dist/
build/
node_modules/
public/
*.config.js
*.config.ts"""
    
    def _generate_prettier_config(self) -> str:
        """Generate Prettier configuration"""
        prettier_config = {
            "semi": True,
            "trailingComma": "es5",
            "singleQuote": True,
            "printWidth": 100,
            "tabWidth": 2,
            "useTabs": False
        }
        
        return json.dumps(prettier_config, indent=2)
    
    def _generate_prettierignore(self) -> str:
        """Generate .prettierignore file"""
        return """dist/
build/
node_modules/
public/
coverage/
*.min.js
*.min.css"""
    
    def _get_project_dependencies(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> List[str]:
        """Get all project dependencies"""
        dependencies = [
            'react', 'react-dom', '@types/react', '@types/react-dom',
            'typescript', 'vite', '@vitejs/plugin-react'
        ]
        
        if config.get('routing', True):
            dependencies.extend(['react-router-dom', '@types/react-router-dom'])
        
        if config.get('state_management') == 'redux':
            dependencies.extend(['@reduxjs/toolkit', 'react-redux'])
        elif config.get('state_management') == 'zustand':
            dependencies.append('zustand')
        
        if config.get('styling') == 'styled-components':
            dependencies.append('styled-components')
        elif config.get('styling') == 'emotion':
            dependencies.extend(['@emotion/react', '@emotion/styled'])
        
        if config.get('testing', True):
            dependencies.extend(['jest', '@testing-library/react', '@testing-library/jest-dom'])
        
        return dependencies
    
    def _get_project_scripts(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Get npm scripts for the project"""
        return {
            "dev": "vite",
            "build": "tsc && vite build",
            "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
            "preview": "vite preview",
            "test": "jest",
            "test:watch": "jest --watch",
            "type-check": "tsc --noEmit"
        }