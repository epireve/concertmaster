"""
Angular Code Generator
Generates Angular components and applications from Visual Builder definitions
"""

import logging
from typing import Dict, List, Any, Optional
import json

from .framework_generators import BaseFrameworkGenerator
from ...schemas.visual_builder import FrameworkType

logger = logging.getLogger(__name__)


class AngularGenerator(BaseFrameworkGenerator):
    """Angular-specific code generator"""
    
    def __init__(self, framework: FrameworkType):
        super().__init__(framework)
    
    def generate_component(self, component_definition: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate Angular component code"""
        try:
            config = config or {}
            component_name = component_definition.get('name', 'Component')
            
            # Generate component files
            files = {
                f"{self._kebab_case(component_name)}.component.ts": self._generate_component_ts(component_definition, config),
                f"{self._kebab_case(component_name)}.component.html": self._generate_component_html(component_definition),
                f"{self._kebab_case(component_name)}.component.scss": self._generate_component_scss(component_definition),
                f"{self._kebab_case(component_name)}.component.spec.ts": self._generate_component_spec(component_definition),
            }
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_required_dependencies(component_definition),
                'metadata': {
                    'framework': 'angular',
                    'component_name': component_name,
                    'selector': self._generate_selector(component_name),
                    'standalone': config.get('standalone', True)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate Angular component: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def generate_page(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate Angular page component"""
        try:
            config = config or {}
            page_name = page_definition.get('name', 'Page')
            
            files = {
                f"{self._kebab_case(page_name)}.component.ts": self._generate_page_component(page_definition, components, config),
                f"{self._kebab_case(page_name)}.component.html": self._generate_page_html(page_definition),
                f"{self._kebab_case(page_name)}.component.scss": self._generate_page_scss(page_definition),
            }
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_page_dependencies(page_definition, components),
                'metadata': {
                    'framework': 'angular',
                    'page_name': page_name,
                    'components_count': len(components)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate Angular page: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def generate_project(self, project_definition: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate complete Angular project"""
        try:
            config = config or {}
            project_name = project_definition.get('name', 'angular-app')
            
            files = {}
            
            # Generate Angular configuration files
            files['angular.json'] = self._generate_angular_json(project_definition, config)
            files['package.json'] = self._generate_package_json(project_definition, config)
            files['tsconfig.json'] = self._generate_tsconfig(config)
            files['tsconfig.app.json'] = self._generate_app_tsconfig(config)
            files['tsconfig.spec.json'] = self._generate_spec_tsconfig(config)
            
            # Generate source files
            files['src/main.ts'] = self._generate_main_ts(project_definition, config)
            files['src/index.html'] = self._generate_index_html(project_definition)
            files['src/styles.scss'] = self._generate_global_styles(project_definition)
            
            # Generate app module/component
            if config.get('standalone', True):
                files['src/app/app.component.ts'] = self._generate_standalone_app_component(project_definition, config)
            else:
                files['src/app/app.module.ts'] = self._generate_app_module(project_definition, config)
                files['src/app/app.component.ts'] = self._generate_app_component(project_definition, config)
            
            files['src/app/app.component.html'] = self._generate_app_component_html(project_definition)
            files['src/app/app.component.scss'] = self._generate_app_component_scss(project_definition)
            
            # Generate additional files
            files['.gitignore'] = self._generate_gitignore()
            files['README.md'] = self._generate_readme(project_definition)
            
            return {
                'success': True,
                'files': files,
                'dependencies': self._get_project_dependencies(project_definition, config),
                'scripts': self._get_project_scripts(config),
                'metadata': {
                    'framework': 'angular',
                    'project_name': project_name,
                    'standalone': config.get('standalone', True),
                    'has_routing': config.get('routing', True)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate Angular project: {e}")
            return {
                'success': False,
                'error': str(e),
                'files': {},
                'dependencies': [],
                'metadata': {}
            }
    
    def _get_file_extensions(self) -> Dict[str, str]:
        """Get Angular-specific file extensions"""
        return {
            'component': '.component.ts',
            'template': '.component.html',
            'style': '.component.scss',
            'spec': '.component.spec.ts',
            'service': '.service.ts',
            'module': '.module.ts'
        }
    
    def _load_templates(self) -> Dict[str, str]:
        """Load Angular-specific templates"""
        return {
            'component': """import {{ Component{imports} }} from '@angular/core';
{additional_imports}

@Component({{
  selector: '{selector}',
  {standalone_config}templateUrl: './{component_file}.component.html',
  styleUrls: ['./{component_file}.component.scss']
}})
export class {component_name}Component {{{lifecycle_hooks}
  {properties}
  
  {methods}
}}""",
            'standalone_component': """import {{ Component{imports} }} from '@angular/core';
{additional_imports}

@Component({{
  selector: '{selector}',
  standalone: true,
  imports: [{component_imports}],
  templateUrl: './{component_file}.component.html',
  styleUrls: ['./{component_file}.component.scss']
}})
export class {component_name}Component {{{lifecycle_hooks}
  {properties}
  
  {methods}
}}"""
        }
    
    def _generate_component_ts(self, component_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate Angular component TypeScript file"""
        component_name = component_definition.get('name', 'Component')
        props = component_definition.get('props_schema', {})
        events = component_definition.get('events', {})
        state_management = component_definition.get('state_management', {})
        is_standalone = config.get('standalone', True)
        
        # Generate imports
        imports = []
        additional_imports = []
        
        # Determine what Angular features to import
        if props:
            imports.append('Input')
        if events:
            imports.append('Output', 'EventEmitter')
        if component_definition.get('lifecycle'):
            imports.append('OnInit', 'OnDestroy')
        
        imports_str = ', ' + ', '.join(imports) if imports else ''
        
        # Generate properties
        properties = self._generate_component_properties(props, state_management, events)
        
        # Generate methods
        methods = self._generate_component_methods(events)
        
        # Generate lifecycle hooks
        lifecycle_hooks = self._generate_lifecycle_hooks(component_definition)
        
        # Generate component imports for standalone
        component_imports = "CommonModule" if is_standalone else ""
        
        selector = self._generate_selector(component_name)
        component_file = self._kebab_case(component_name)
        
        template = self.templates['standalone_component'] if is_standalone else self.templates['component']
        
        return template.format(
            imports=imports_str,
            additional_imports='\n'.join(additional_imports),
            selector=selector,
            standalone_config='standalone: true,\n  imports: [' + component_imports + '],\n  ' if is_standalone else '',
            component_file=component_file,
            component_name=component_name,
            component_imports=component_imports,
            lifecycle_hooks=lifecycle_hooks,
            properties=properties,
            methods=methods
        )
    
    def _generate_component_html(self, component_definition: Dict[str, Any]) -> str:
        """Generate Angular component HTML template"""
        definition = component_definition.get('definition', {})
        
        if not definition:
            component_name = component_definition.get('name', 'Component')
            return f'<div class="{self._kebab_case(component_name)}">\n  <p>{component_name} works!</p>\n</div>'
        
        return self._render_angular_template(definition)
    
    def _generate_component_scss(self, component_definition: Dict[str, Any]) -> str:
        """Generate Angular component SCSS styles"""
        styles = component_definition.get('styles', {})
        component_name = self._kebab_case(component_definition.get('name', 'component'))
        
        if not styles:
            return f".{component_name} {{\n  // Component styles\n}}"
        
        css_rules = [f".{component_name} {{"]
        for property, value in styles.items():
            css_property = self._camel_to_kebab(property)
            css_rules.append(f"  {css_property}: {value};")
        css_rules.append("}")
        
        return "\n".join(css_rules)
    
    def _generate_component_spec(self, component_definition: Dict[str, Any]) -> str:
        """Generate Angular component test spec"""
        component_name = component_definition.get('name', 'Component')
        
        return f"""import {{ ComponentFixture, TestBed }} from '@angular/core/testing';

import {{ {component_name}Component }} from './{self._kebab_case(component_name)}.component';

describe('{component_name}Component', () => {{
  let component: {component_name}Component;
  let fixture: ComponentFixture<{component_name}Component>;

  beforeEach(async () => {{
    await TestBed.configureTestingModule({{
      declarations: [ {component_name}Component ]
    }})
    .compileComponents();

    fixture = TestBed.createComponent({component_name}Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }});

  it('should create', () => {{
    expect(component).toBeTruthy();
  }});
}});"""
    
    def _generate_component_properties(self, props: Dict[str, Any], state: Dict[str, Any], events: Dict[str, Any]) -> str:
        """Generate component properties"""
        properties = []
        
        # Input properties
        for prop_name, prop_config in props.items():
            prop_type = self._get_typescript_type(prop_config)
            required = '' if prop_config.get('required', True) else '?'
            properties.append(f"@Input() {prop_name}{required}: {prop_type};")
        
        # Output properties (events)
        for event_name in events.keys():
            properties.append(f"@Output() {event_name} = new EventEmitter<any>();")
        
        # State properties
        for state_name, state_config in state.items():
            state_type = self._get_typescript_type(state_config)
            initial_value = json.dumps(state_config.get('initial', None))
            properties.append(f"{state_name}: {state_type} = {initial_value};")
        
        return '\n  '.join(properties)
    
    def _generate_component_methods(self, events: Dict[str, Any]) -> str:
        """Generate component methods"""
        methods = []
        
        for event_name, event_config in events.items():
            method_name = f"on{event_name.title()}"
            
            if isinstance(event_config, str):
                methods.append(f"{method_name}() {{\n    {event_config}\n  }}")
            elif isinstance(event_config, dict):
                body = event_config.get('handler', '// Handler logic')
                methods.append(f"{method_name}() {{\n    {body}\n  }}")
        
        return '\n\n  '.join(methods)
    
    def _generate_lifecycle_hooks(self, component_definition: Dict[str, Any]) -> str:
        """Generate lifecycle hook interfaces"""
        lifecycle = component_definition.get('lifecycle', {})
        hooks = []
        
        if lifecycle.get('onInit'):
            hooks.append(' implements OnInit')
            
        return ''.join(hooks)
    
    def _render_angular_template(self, definition: Dict[str, Any], indent: int = 2) -> str:
        """Render component definition as Angular template"""
        component_type = definition.get('type', 'div')
        props = definition.get('props', {})
        children = definition.get('children', [])
        events = definition.get('events', {})
        
        # Format Angular attributes
        angular_attrs = self._format_angular_attributes(props, events)
        attrs_part = f" {angular_attrs}" if angular_attrs else ""
        
        # Render children
        children_content = self._render_angular_children(children, indent + 2)
        
        indent_str = " " * indent
        if children_content.strip():
            return f"<{component_type}{attrs_part}>\n{children_content}\n{indent_str}</{component_type}>"
        else:
            return f"<{component_type}{attrs_part}></{component_type}>"
    
    def _format_angular_attributes(self, props: Dict[str, Any], events: Dict[str, Any] = None) -> str:
        """Format attributes for Angular template"""
        attrs = []
        
        # Regular attributes and property binding
        for key, value in props.items():
            if isinstance(value, str) and not value.startswith('{{'):
                attrs.append(f'{key}="{value}"')
            else:
                attrs.append(f'[{key}]="{value}"')
        
        # Event binding
        if events:
            for event_name in events.keys():
                method_name = f"on{event_name.title()}"
                attrs.append(f'({event_name})="{method_name}()"')
        
        return " ".join(attrs)
    
    def _render_angular_children(self, children: Any, indent: int) -> str:
        """Render Angular template children"""
        if not children:
            return ""
        
        if isinstance(children, str):
            indent_str = " " * indent
            return f"{indent_str}{children}"
        
        if isinstance(children, list):
            rendered_children = []
            for child in children:
                if isinstance(child, dict):
                    rendered_children.append(self._render_angular_template(child, indent))
                else:
                    indent_str = " " * indent
                    rendered_children.append(f"{indent_str}{child}")
            
            return "\n".join(rendered_children)
        
        return str(children)
    
    def _generate_selector(self, component_name: str) -> str:
        """Generate Angular component selector"""
        return f"app-{self._kebab_case(component_name)}"
    
    def _kebab_case(self, camel_str: str) -> str:
        """Convert CamelCase to kebab-case"""
        import re
        return re.sub('([a-z0-9])([A-Z])', r'\1-\2', camel_str).lower()
    
    def _get_typescript_type(self, config: Dict[str, Any]) -> str:
        """Get TypeScript type from configuration"""
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
    
    def _generate_page_component(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]], config: Dict[str, Any]) -> str:
        """Generate Angular page component"""
        page_name = page_definition.get('name', 'Page')
        
        return f"""import {{ Component }} from '@angular/core';

@Component({{
  selector: 'app-{self._kebab_case(page_name)}',
  templateUrl: './{self._kebab_case(page_name)}.component.html',
  styleUrls: ['./{self._kebab_case(page_name)}.component.scss']
}})
export class {page_name}Component {{
  title = '{page_name}';
}}"""
    
    def _generate_page_html(self, page_definition: Dict[str, Any]) -> str:
        """Generate page HTML template"""
        page_name = page_definition.get('name', 'Page')
        
        return f"""<div class="{self._kebab_case(page_name)}">
  <h1>{{{{ title }}}}</h1>
  <!-- Page content -->
</div>"""
    
    def _generate_page_scss(self, page_definition: Dict[str, Any]) -> str:
        """Generate page SCSS styles"""
        page_name = self._kebab_case(page_definition.get('name', 'page'))
        
        return f""".{page_name} {{
  padding: 1rem;
  min-height: 100vh;
}}"""
    
    def _get_required_dependencies(self, component_definition: Dict[str, Any]) -> List[str]:
        """Get required dependencies for component"""
        return ['@angular/core', '@angular/common']
    
    def _get_page_dependencies(self, page_definition: Dict[str, Any], components: List[Dict[str, Any]]) -> List[str]:
        """Get page dependencies"""
        return ['@angular/core', '@angular/common', '@angular/router']
    
    def _generate_angular_json(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate angular.json configuration"""
        project_name = project_definition.get('name', 'angular-app')
        
        angular_config = {
            "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
            "version": 1,
            "newProjectRoot": "projects",
            "projects": {
                project_name: {
                    "projectType": "application",
                    "schematics": {
                        "@schematics/angular:component": {
                            "style": "scss"
                        }
                    },
                    "root": "",
                    "sourceRoot": "src",
                    "prefix": "app",
                    "architect": {
                        "build": {
                            "builder": "@angular-devkit/build-angular:browser",
                            "options": {
                                "outputPath": "dist/" + project_name,
                                "index": "src/index.html",
                                "main": "src/main.ts",
                                "polyfills": [],
                                "tsConfig": "tsconfig.app.json",
                                "assets": [
                                    "src/favicon.ico",
                                    "src/assets"
                                ],
                                "styles": [
                                    "src/styles.scss"
                                ],
                                "scripts": []
                            }
                        },
                        "serve": {
                            "builder": "@angular-devkit/build-angular:dev-server",
                            "options": {
                                "port": 4200
                            }
                        },
                        "test": {
                            "builder": "@angular-devkit/build-angular:karma",
                            "options": {
                                "polyfills": [],
                                "tsConfig": "tsconfig.spec.json",
                                "assets": [
                                    "src/favicon.ico",
                                    "src/assets"
                                ],
                                "styles": [
                                    "src/styles.scss"
                                ],
                                "scripts": []
                            }
                        }
                    }
                }
            }
        }
        
        return json.dumps(angular_config, indent=2)
    
    def _generate_package_json(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate package.json"""
        project_name = project_definition.get('name', 'angular-app')
        
        package_json = {
            "name": project_name,
            "version": "0.0.0",
            "scripts": {
                "ng": "ng",
                "start": "ng serve",
                "build": "ng build",
                "watch": "ng build --watch --configuration development",
                "test": "ng test"
            },
            "private": True,
            "dependencies": {
                "@angular/animations": "^17.0.0",
                "@angular/common": "^17.0.0",
                "@angular/compiler": "^17.0.0",
                "@angular/core": "^17.0.0",
                "@angular/forms": "^17.0.0",
                "@angular/platform-browser": "^17.0.0",
                "@angular/platform-browser-dynamic": "^17.0.0",
                "@angular/router": "^17.0.0",
                "rxjs": "~7.8.0",
                "tslib": "^2.3.0",
                "zone.js": "~0.14.0"
            },
            "devDependencies": {
                "@angular-devkit/build-angular": "^17.0.0",
                "@angular/cli": "^17.0.0",
                "@angular/compiler-cli": "^17.0.0",
                "@types/jasmine": "~5.1.0",
                "jasmine-core": "~5.1.0",
                "karma": "~6.4.0",
                "karma-chrome-launcher": "~3.2.0",
                "karma-coverage": "~2.2.0",
                "karma-jasmine": "~5.1.0",
                "karma-jasmine-html-reporter": "~2.1.0",
                "typescript": "~5.2.0"
            }
        }
        
        return json.dumps(package_json, indent=2)
    
    def _generate_tsconfig(self, config: Dict[str, Any]) -> str:
        """Generate base TypeScript configuration"""
        tsconfig = {
            "compileOnSave": False,
            "compilerOptions": {
                "baseUrl": "./",
                "outDir": "./dist/out-tsc",
                "forceConsistentCasingInFileNames": True,
                "strict": True,
                "noImplicitOverride": True,
                "noPropertyAccessFromIndexSignature": True,
                "noImplicitReturns": True,
                "noFallthroughCasesInSwitch": True,
                "sourceMap": True,
                "declaration": False,
                "downlevelIteration": True,
                "experimentalDecorators": True,
                "moduleResolution": "node",
                "importHelpers": True,
                "target": "ES2022",
                "module": "ES2022",
                "useDefineForClassFields": False,
                "lib": [
                    "ES2022",
                    "dom"
                ]
            },
            "angularCompilerOptions": {
                "enableI18nLegacyMessageIdFormat": False,
                "strictInjectionParameters": True,
                "strictInputAccessModifiers": True,
                "strictTemplates": True
            }
        }
        
        return json.dumps(tsconfig, indent=2)
    
    def _generate_app_tsconfig(self, config: Dict[str, Any]) -> str:
        """Generate app-specific TypeScript configuration"""
        app_tsconfig = {
            "extends": "./tsconfig.json",
            "compilerOptions": {
                "outDir": "./out-tsc/app",
                "types": []
            },
            "files": [
                "src/main.ts"
            ],
            "include": [
                "src/**/*.d.ts"
            ]
        }
        
        return json.dumps(app_tsconfig, indent=2)
    
    def _generate_spec_tsconfig(self, config: Dict[str, Any]) -> str:
        """Generate spec-specific TypeScript configuration"""
        spec_tsconfig = {
            "extends": "./tsconfig.json",
            "compilerOptions": {
                "outDir": "./out-tsc/spec",
                "types": [
                    "jasmine"
                ]
            },
            "include": [
                "src/**/*.spec.ts",
                "src/**/*.d.ts"
            ]
        }
        
        return json.dumps(spec_tsconfig, indent=2)
    
    def _generate_main_ts(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate main.ts bootstrap file"""
        if config.get('standalone', True):
            return """import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));"""
        else:
            return """import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));"""
    
    def _generate_index_html(self, project_definition: Dict[str, Any]) -> str:
        """Generate index.html"""
        project_name = project_definition.get('name', 'Angular App')
        
        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{project_name}</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>"""
    
    def _generate_global_styles(self, project_definition: Dict[str, Any]) -> str:
        """Generate global SCSS styles"""
        return """/* You can add global styles to this file, and also import other style files */

html, body { height: 100%; }
body { margin: 0; font-family: Roboto, "Helvetica Neue", sans-serif; }

* {
  box-sizing: border-box;
}"""
    
    def _generate_standalone_app_component(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate standalone app component"""
        project_name = project_definition.get('name', 'App')
        
        return f"""import {{ Component }} from '@angular/core';
import {{ CommonModule }} from '@angular/common';
import {{ RouterOutlet }} from '@angular/router';

@Component({{
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
}})
export class AppComponent {{
  title = '{project_name}';
}}"""
    
    def _generate_app_module(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate app module"""
        return """import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }"""
    
    def _generate_app_component(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> str:
        """Generate app component for module-based setup"""
        project_name = project_definition.get('name', 'App')
        
        return f"""import {{ Component }} from '@angular/core';

@Component({{
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
}})
export class AppComponent {{
  title = '{project_name}';
}}"""
    
    def _generate_app_component_html(self, project_definition: Dict[str, Any]) -> str:
        """Generate app component HTML template"""
        return """<div class="app">
  <header class="app-header">
    <h1>Welcome to {{ title }}</h1>
  </header>
  <main class="app-content">
    <router-outlet></router-outlet>
  </main>
</div>"""
    
    def _generate_app_component_scss(self, project_definition: Dict[str, Any]) -> str:
        """Generate app component SCSS styles"""
        return """.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: #1976d2;
  color: white;
  padding: 1rem;
  text-align: center;
  
  h1 {
    margin: 0;
  }
}

.app-content {
  flex: 1;
  padding: 2rem;
}"""
    
    def _generate_gitignore(self) -> str:
        """Generate .gitignore file"""
        return """# See http://help.github.com/ignore-files/ for more about ignoring files.

# Compiled output
/dist
/tmp
/out-tsc
# Only exists if Bazel was run
/bazel-out

# Node
/node_modules
npm-debug.log
yarn-error.log

# IDEs and editors
.idea/
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# Visual Studio Code
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
.history/*

# Miscellaneous
/.angular/cache
.sass-cache/
/connect.lock
/coverage
/libpeerconnection.log
testem.log
/typings

# System files
.DS_Store
Thumbs.db"""
    
    def _generate_readme(self, project_definition: Dict[str, Any]) -> str:
        """Generate README.md"""
        project_name = project_definition.get('name', 'Angular App')
        
        return f"""# {project_name}

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.0.0.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
"""
    
    def _get_project_dependencies(self, project_definition: Dict[str, Any], config: Dict[str, Any]) -> List[str]:
        """Get Angular project dependencies"""
        dependencies = [
            '@angular/animations', '@angular/common', '@angular/compiler',
            '@angular/core', '@angular/forms', '@angular/platform-browser',
            '@angular/platform-browser-dynamic', '@angular/router',
            'rxjs', 'tslib', 'zone.js'
        ]
        
        dev_dependencies = [
            '@angular-devkit/build-angular', '@angular/cli', '@angular/compiler-cli',
            '@types/jasmine', 'jasmine-core', 'karma', 'karma-chrome-launcher',
            'karma-coverage', 'karma-jasmine', 'karma-jasmine-html-reporter',
            'typescript'
        ]
        
        return dependencies + dev_dependencies
    
    def _get_project_scripts(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Get Angular project scripts"""
        return {
            "ng": "ng",
            "start": "ng serve",
            "build": "ng build",
            "watch": "ng build --watch --configuration development",
            "test": "ng test",
            "lint": "ng lint"
        }