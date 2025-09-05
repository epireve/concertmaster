"""
Vue Code Generator
Generates Vue components and applications from Visual Builder definitions
"""

import logging
from typing import Dict, List, Any, Optional
import json

from .framework_generators import BaseFrameworkGenerator
from ...schemas.visual_builder import FrameworkType

logger = logging.getLogger(__name__)


class VueGenerator(BaseFrameworkGenerator):
    """Vue-specific code generator"""
    
    def __init__(self, framework: FrameworkType):
        super().__init__(framework)
    
    def generate_component(self, component_definition: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate Vue component code"""
        try:
            config = config or {}
            component_name = component_definition.get('name', 'Component')
            
            # Generate main component file
            code = self._generate_vue_component(component_definition, config)
            
            files = {
                f"{component_name}.vue": code,
                f"{component_name}.spec.ts": self._generate_tests(component_definition),
            }
            
            # Add TypeScript types if enabled
            if config.get('typescript', True):
                files[f"{component_name}.types.ts"] = self._generate_types(component_definition)
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_required_dependencies(component_definition),
                'metadata': {
                    'framework': 'vue',
                    'component_name': component_name,
                    'typescript': config.get('typescript', True),
                    'composition_api': config.get('composition_api', True)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate Vue component: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def generate_page(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate Vue page component"""
        try:
            config = config or {}
            page_name = page_definition.get('name', 'Page')
            
            # Generate main page component
            page_code = self._generate_page_component(page_definition, components, config)
            
            files = {
                f"{page_name}.vue": page_code,
            }
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_page_dependencies(page_definition, components),
                'metadata': {
                    'framework': 'vue',
                    'page_name': page_name,
                    'components_count': len(components)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate Vue page: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def generate_project(self, project_definition: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate complete Vue project"""
        try:
            config = config or {}
            project_name = project_definition.get('name', 'vue-app')
            
            files = {}
            
            # Generate package.json
            files['package.json'] = self._generate_package_json(project_definition, config)
            
            # Generate main app files
            files['src/App.vue'] = self._generate_app_component(project_definition, config)
            files['src/main.ts'] = self._generate_main_file(project_definition, config)
            files['src/style.css'] = self._generate_global_styles(project_definition)
            
            # Generate configuration files
            files['vite.config.ts'] = self._generate_vite_config(project_definition, config)
            files['tsconfig.json'] = self._generate_tsconfig(config)
            files['index.html'] = self._generate_index_html(project_definition)
            files['.gitignore'] = self._generate_gitignore()
            files['README.md'] = self._generate_readme(project_definition)
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_project_dependencies(project_definition, config),
                'scripts': self._get_project_scripts(config),
                'metadata': {
                    'framework': 'vue',
                    'project_name': project_name,
                    'build_tool': config.get('build_tool', 'vite'),
                    'typescript': config.get('typescript', True),
                    'composition_api': config.get('composition_api', True)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate Vue project: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def _get_file_extensions(self) -> Dict[str, str]:
        """Get Vue-specific file extensions"""
        return {
            'component': '.vue',
            'page': '.vue',
            'test': '.spec.ts',
            'type': '.types.ts',
            'config': '.ts'
        }
    
    def _load_templates(self) -> Dict[str, str]:
        """Load Vue-specific templates"""
        return {
            'composition_component': """<template>
  {template_content}
</template>

<script setup lang="ts">
{script_content}
</script>

<style scoped>
{style_content}
</style>""",
            'options_component': """<template>
  {template_content}
</template>

<script lang="ts">
import {{ defineComponent }} from 'vue'

export default defineComponent({{
  name: '{component_name}',
  {component_options}
}})
</script>

<style scoped>
{style_content}
</style>"""
        }
    
    def _generate_vue_component(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate Vue component"""
        use_composition_api = config.get('composition_api', True)
        
        if use_composition_api:
            return self._generate_composition_component(component_definition, config)
        else:
            return self._generate_options_component(component_definition, config)
    
    def _generate_composition_component(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate Vue component using Composition API"""
        component_name = component_definition.get('name', 'Component')
        definition = component_definition.get('definition', {})
        props = component_definition.get('props_schema', {})
        state_management = component_definition.get('state_management', {})
        events = component_definition.get('events', {})
        styles = component_definition.get('styles', {})
        
        # Generate template
        template_content = self._generate_vue_template(definition)
        
        # Generate script content
        script_content = self._generate_composition_script(props, state_management, events)
        
        # Generate styles
        style_content = self._generate_vue_styles(styles)
        
        template = self.templates['composition_component']
        return template.format(
            template_content=template_content,
            script_content=script_content,
            style_content=style_content
        )
    
    def _generate_options_component(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate Vue component using Options API"""
        component_name = component_definition.get('name', 'Component')
        definition = component_definition.get('definition', {})
        props = component_definition.get('props_schema', {})
        state_management = component_definition.get('state_management', {})
        events = component_definition.get('events', {})
        styles = component_definition.get('styles', {})
        
        # Generate template
        template_content = self._generate_vue_template(definition)
        
        # Generate component options
        component_options = self._generate_options_api(props, state_management, events)
        
        # Generate styles
        style_content = self._generate_vue_styles(styles)
        
        template = self.templates['options_component']
        return template.format(
            component_name=component_name,
            template_content=template_content,
            component_options=component_options,
            style_content=style_content
        )
    
    def _generate_vue_template(self, definition: Dict[str, Any]) -> str:
        """Generate Vue template from component definition"""
        if not definition:
            return "  <div>Component content</div>"
        
        return f"  {self._render_vue_template(definition, 2)}"
    
    def _render_vue_template(self, component: Dict[str, Any], indent: int = 2) -> str:
        """Render component tree as Vue template"""
        component_type = component.get('type', 'div')
        props = component.get('props', {})
        children = component.get('children', [])
        events = component.get('events', {})
        
        # Format props for Vue template
        vue_props = self._format_vue_props(props, events)
        props_part = f" {vue_props}" if vue_props else ""
        
        # Render children
        children_content = self._render_vue_children(children, indent + 2)
        
        indent_str = " " * indent
        if children_content.strip():
            return f"<{component_type}{props_part}>\n{children_content}\n{indent_str}</{component_type}>"
        else:
            return f"<{component_type}{props_part} />"
    
    def _format_vue_props(self, props: Dict[str, Any], events: Dict[str, Any] = None) -> str:
        """Format props for Vue template"""
        vue_props = []
        
        # Regular props
        for key, value in props.items():
            if isinstance(value, str):
                vue_props.append(f'{key}="{value}"')
            elif isinstance(value, bool):
                if value:
                    vue_props.append(key)
                else:
                    vue_props.append(f':{key}="false"')
            else:
                vue_props.append(f':{key}="{value}"')
        
        # Event handlers
        if events:
            for event_name in events.keys():
                vue_props.append(f'@{event_name}="handle{event_name.title()}"')
        
        return " ".join(vue_props)
    
    def _render_vue_children(self, children: Any, indent: int) -> str:
        """Render Vue template children"""
        if not children:
            return ""
        
        if isinstance(children, str):
            indent_str = " " * indent
            return f"{indent_str}{children}"
        
        if isinstance(children, list):
            rendered_children = []
            for child in children:
                if isinstance(child, dict):
                    rendered_children.append(self._render_vue_template(child, indent))
                else:
                    indent_str = " " * indent
                    rendered_children.append(f"{indent_str}{child}")
            
            return "\n".join(rendered_children)
        
        return str(children)
    
    def _generate_composition_script(self, props: Dict[str, Any], state: Dict[str, Any], events: Dict[str, Any]) -> str:
        """Generate script content for Composition API"""
        imports = ["import { ref, computed, onMounted } from 'vue'"]
        
        # Generate props interface
        props_interface = self._generate_props_interface(props)
        
        # Generate reactive state
        state_declarations = self._generate_reactive_state(state)
        
        # Generate event handlers
        event_handlers = self._generate_vue_event_handlers(events)
        
        # Generate computed properties
        computed_props = []  # Computed properties support planned for future release
        
        # Generate lifecycle hooks
        lifecycle_hooks = ["onMounted(() => {\n  // Component mounted\n})"]
        
        script_parts = []
        
        if imports:
            script_parts.extend(imports)
            script_parts.append("")
        
        if props_interface:
            script_parts.append(props_interface)
            script_parts.append("")
        
        if state_declarations:
            script_parts.extend(state_declarations)
            script_parts.append("")
        
        if computed_props:
            script_parts.extend(computed_props)
            script_parts.append("")
        
        if event_handlers:
            script_parts.extend(event_handlers)
            script_parts.append("")
        
        if lifecycle_hooks:
            script_parts.extend(lifecycle_hooks)
        
        return "\n".join(script_parts)
    
    def _generate_options_api(self, props: Dict[str, Any], state: Dict[str, Any], events: Dict[str, Any]) -> str:
        """Generate component options for Options API"""
        options = []
        
        # Props
        if props:
            props_def = self._generate_props_definition(props)
            options.append(f"props: {props_def}")
        
        # Data
        if state:
            data_function = self._generate_data_function(state)
            options.append(f"data() {{\n{data_function}\n  }}")
        
        # Methods
        if events:
            methods = self._generate_methods(events)
            options.append(f"methods: {{\n{methods}\n  }}")
        
        # Lifecycle hooks
        options.append("mounted() {\n    // Component mounted\n  }")
        
        return ",\n  ".join(options)
    
    def _generate_props_interface(self, props: Dict[str, Any]) -> str:
        """Generate props interface for TypeScript"""
        if not props:
            return ""
        
        interface_props = []
        for prop_name, prop_config in props.items():
            prop_type = self._get_vue_type(prop_config)
            optional = "?" if not prop_config.get('required', True) else ""
            interface_props.append(f"  {prop_name}{optional}: {prop_type}")
        
        return f"""interface Props {{
{chr(10).join(interface_props)}
}}

const props = defineProps<Props>()"""
    
    def _generate_reactive_state(self, state: Dict[str, Any]) -> List[str]:
        """Generate reactive state declarations"""
        if not state:
            return []
        
        declarations = []
        for state_name, state_config in state.items():
            initial_value = json.dumps(state_config.get('initial', None))
            declarations.append(f"const {state_name} = ref({initial_value})")
        
        return declarations
    
    def _generate_vue_event_handlers(self, events: Dict[str, Any]) -> List[str]:
        """Generate Vue event handlers"""
        if not events:
            return []
        
        handlers = []
        for event_name, event_config in events.items():
            handler_name = f"handle{event_name.title()}"
            
            if isinstance(event_config, str):
                handlers.append(f"const {handler_name} = () => {{\n  {event_config}\n}}")
            elif isinstance(event_config, dict):
                body = event_config.get('handler', '// Handler logic')
                handlers.append(f"const {handler_name} = () => {{\n  {body}\n}}")
        
        return handlers
    
    def _generate_vue_styles(self, styles: Dict[str, Any]) -> str:
        """Generate Vue scoped styles"""
        if not styles:
            return "/* Component styles */"
        
        css_rules = []
        for selector, style_props in styles.items():
            if isinstance(style_props, dict):
                css_rules.append(f"{selector} {{")
                for prop, value in style_props.items():
                    css_property = self._camel_to_kebab(prop)
                    css_rules.append(f"  {css_property}: {value};")
                css_rules.append("}")
        
        return "\n".join(css_rules) if css_rules else "/* Component styles */"
    
    def _generate_props_definition(self, props: Dict[str, Any]) -> str:
        """Generate props definition for Options API"""
        prop_defs = {}
        for prop_name, prop_config in props.items():
            prop_def = {
                "type": self._get_vue_constructor_type(prop_config),
                "required": prop_config.get('required', True)
            }
            if 'default' in prop_config:
                prop_def['default'] = prop_config['default']
            
            prop_defs[prop_name] = prop_def
        
        return json.dumps(prop_defs, indent=2)
    
    def _generate_data_function(self, state: Dict[str, Any]) -> str:
        """Generate data function for Options API"""
        data_obj = {}
        for state_name, state_config in state.items():
            data_obj[state_name] = state_config.get('initial', None)
        
        data_lines = []
        data_lines.append("    return {")
        for key, value in data_obj.items():
            data_lines.append(f"      {key}: {json.dumps(value)},")
        data_lines.append("    }")
        
        return "\n".join(data_lines)
    
    def _generate_methods(self, events: Dict[str, Any]) -> str:
        """Generate methods for Options API"""
        methods = []
        for event_name, event_config in events.items():
            handler_name = f"handle{event_name.title()}"
            
            if isinstance(event_config, str):
                methods.append(f"    {handler_name}() {{\n      {event_config}\n    }}")
            elif isinstance(event_config, dict):
                body = event_config.get('handler', '// Handler logic')
                methods.append(f"    {handler_name}() {{\n      {body}\n    }}")
        
        return ",\n".join(methods)
    
    def _get_vue_type(self, prop_config: Dict[str, Any]) -> str:
        """Get Vue TypeScript type"""
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
    
    def _get_vue_constructor_type(self, prop_config: Dict[str, Any]) -> str:
        """Get Vue constructor type for Options API"""
        prop_type = prop_config.get('type', 'any')
        
        type_mapping = {
            'string': 'String',
            'number': 'Number',
            'boolean': 'Boolean',
            'object': 'Object',
            'array': 'Array',
            'function': 'Function'
        }
        
        return type_mapping.get(prop_type, 'Object')
    
    def _generate_tests(self, component_definition: Dict[str, Any]) -> str:
        """Generate Vue tests"""
        component_name = component_definition.get('name', 'Component')
        
        return f"""import {{ describe, it, expect }} from 'vitest'
import {{ mount }} from '@vue/test-utils'
import {component_name} from './{component_name}.vue'

describe('{component_name}', () => {{
  it('renders properly', () => {{
    const wrapper = mount({component_name})
    expect(wrapper.exists()).toBe(true)
  }})
  
  // Add more specific tests
}})"""
    
    def _generate_types(self, component_definition: Dict[str, Any]) -> str:
        """Generate TypeScript types"""
        component_name = component_definition.get('name', 'Component')
        props = component_definition.get('props_schema', {})
        
        types = [f"// Type definitions for {component_name}"]
        types.append("")
        
        if props:
            interface_props = []
            for prop_name, prop_config in props.items():
                prop_type = self._get_vue_type(prop_config)
                optional = "?" if not prop_config.get('required', True) else ""
                interface_props.append(f"  {prop_name}{optional}: {prop_type};")
            
            types.append(f"export interface {component_name}Props {{")
            types.extend(interface_props)
            types.append("}")
        
        return "\n".join(types)
    
    def _get_required_dependencies(self, component_definition: Dict[str, Any]) -> List[str]:
        """Get required dependencies"""
        return ['vue']
    
    def _generate_page_component(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any]) -> str:
        """Generate Vue page component"""
        page_name = page_definition.get('name', 'Page')
        
        return f"""<template>
  <div class="{page_name.lower()}">
    <h1>{page_name}</h1>
    <!-- Page content -->
  </div>
</template>

<script setup lang="ts">
// Page logic
</script>

<style scoped>
.{page_name.lower()} {{
  padding: 1rem;
  min-height: 100vh;
}}
</style>"""
    
    def _get_page_dependencies(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]]) -> List[str]:
        """Get page dependencies"""
        return ['vue', 'vue-router']
    
    def _generate_package_json(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate package.json"""
        project_name = project_definition.get('name', 'vue-app')
        
        package_json = {
            "name": project_name,
            "version": "0.0.0",
            "private": True,
            "scripts": {
                "build": "vue-tsc && vite build",
                "dev": "vite",
                "preview": "vite preview",
                "type-check": "vue-tsc --noEmit -p tsconfig.json --composite false"
            },
            "dependencies": {
                "vue": "^3.3.11"
            },
            "devDependencies": {
                "@vitejs/plugin-vue": "^4.5.2",
                "@vue/test-utils": "^2.4.3",
                "@vue/tsconfig": "^0.5.1",
                "jsdom": "^23.0.1",
                "typescript": "~5.3.0",
                "vite": "^5.0.10",
                "vitest": "^1.0.4",
                "vue-tsc": "^1.8.25"
            }
        }
        
        return json.dumps(package_json, indent=2)
    
    def _generate_app_component(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate main App.vue"""
        project_name = project_definition.get('name', 'Vue App')
        
        return f"""<script setup lang="ts">
// App logic
</script>

<template>
  <div id="app">
    <header>
      <h1>Welcome to {project_name}</h1>
    </header>
    <main>
      <!-- App content -->
    </main>
  </div>
</template>

<style scoped>
#app {{
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}}
</style>"""
    
    def _generate_main_file(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate main.ts"""
        return """import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')"""
    
    def _generate_global_styles(self, project_definition: Dict[str, Any]) -> str:
        """Generate global styles"""
        return """:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
}"""
    
    def _generate_vite_config(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate Vite config"""
        return """import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})"""
    
    def _generate_tsconfig(self, config: Dict[str, Any]) -> str:
        """Generate TypeScript config"""
        tsconfig = {
            "extends": "@vue/tsconfig/tsconfig.dom.json",
            "include": ["env.d.ts", "src/**/*", "src/**/*.vue"],
            "compilerOptions": {
                "baseUrl": ".",
                "paths": {
                    "@/*": ["./src/*"]
                }
            }
        }
        
        return json.dumps(tsconfig, indent=2)
    
    def _generate_index_html(self, project_definition: Dict[str, Any]) -> str:
        """Generate index.html"""
        project_name = project_definition.get('name', 'Vue App')
        
        return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{project_name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>"""
    
    def _generate_gitignore(self) -> str:
        """Generate .gitignore"""
        return """# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?"""
    
    def _generate_readme(self, project_definition: Dict[str, Any]) -> str:
        """Generate README.md"""
        project_name = project_definition.get('name', 'Vue App')
        
        return f"""# {project_name}

A Vue.js application generated by Visual Builder.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
    1) Run `Extensions: Show Built-in Extensions` from VSCode's command palette
    2) Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```
"""
    
    def _get_project_dependencies(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> List[str]:
        """Get project dependencies"""
        dependencies = [
            'vue', '@vitejs/plugin-vue', 'typescript', 'vite',
            'vue-tsc', '@vue/tsconfig'
        ]
        
        if config.get('router', True):
            dependencies.append('vue-router')
        
        if config.get('state_management') == 'vuex':
            dependencies.append('vuex')
        elif config.get('state_management') == 'pinia':
            dependencies.append('pinia')
        
        if config.get('testing', True):
            dependencies.extend(['@vue/test-utils', 'vitest', 'jsdom'])
        
        return dependencies
    
    def _get_project_scripts(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Get project scripts"""
        return {
            "build": "vue-tsc && vite build",
            "dev": "vite",
            "preview": "vite preview",
            "type-check": "vue-tsc --noEmit -p tsconfig.json --composite false",
            "test:unit": "vitest"
        }