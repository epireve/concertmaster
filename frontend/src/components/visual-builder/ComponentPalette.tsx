/**
 * Advanced Component Palette for Visual Builder
 * Features: Categorized components, search, drag preview, quick add
 */

import React, { useState, useMemo } from 'react';
import { useDrag } from 'react-dnd';
import { 
  Type, AlignLeft, Mail, Hash, ChevronDown, CheckSquare, Calendar,
  Upload, Link, Phone, DollarSign, Star, Grid3x3, PenTool, MapPin,
  Search, Plus, Filter, Layers, Zap, Layout, Image, BarChart3
} from 'lucide-react';
import { FormFieldType } from '../../types/forms';

interface ComponentDefinition {
  type: FormFieldType;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  category: 'basic' | 'advanced' | 'media' | 'layout' | 'data' | 'special';
  tags: string[];
  preview?: string;
  popular?: boolean;
}

const componentDefinitions: ComponentDefinition[] = [
  // Basic Components
  {
    type: 'text',
    label: 'Text Input',
    icon: Type,
    description: 'Single line text input field',
    category: 'basic',
    tags: ['input', 'text', 'basic'],
    preview: 'Enter text...',
    popular: true,
  },
  {
    type: 'textarea',
    label: 'Text Area',
    icon: AlignLeft,
    description: 'Multi-line text input for longer content',
    category: 'basic',
    tags: ['input', 'text', 'multiline'],
    preview: 'Enter longer text...',
    popular: true,
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Email input with validation',
    category: 'basic',
    tags: ['input', 'email', 'validation'],
    preview: 'name@example.com',
    popular: true,
  },
  {
    type: 'number',
    label: 'Number',
    icon: Hash,
    description: 'Numeric input with increment controls',
    category: 'basic',
    tags: ['input', 'number', 'numeric'],
    preview: '123',
  },
  {
    type: 'select',
    label: 'Dropdown',
    icon: ChevronDown,
    description: 'Single selection dropdown menu',
    category: 'basic',
    tags: ['select', 'dropdown', 'options'],
    preview: 'Select option...',
    popular: true,
  },

  // Advanced Components
  {
    type: 'radio',
    label: 'Radio Group',
    icon: CheckSquare,
    description: 'Single choice from multiple options',
    category: 'advanced',
    tags: ['radio', 'choice', 'selection'],
  },
  {
    type: 'checkbox',
    label: 'Checkbox Group',
    icon: CheckSquare,
    description: 'Multiple selections allowed',
    category: 'advanced',
    tags: ['checkbox', 'multiple', 'selection'],
  },
  {
    type: 'date',
    label: 'Date Picker',
    icon: Calendar,
    description: 'Date selection with calendar popup',
    category: 'advanced',
    tags: ['date', 'calendar', 'time'],
  },
  {
    type: 'datetime',
    label: 'Date & Time',
    icon: Calendar,
    description: 'Combined date and time picker',
    category: 'advanced',
    tags: ['datetime', 'calendar', 'time'],
  },
  {
    type: 'phone',
    label: 'Phone Number',
    icon: Phone,
    description: 'Phone input with formatting',
    category: 'advanced',
    tags: ['phone', 'contact', 'number'],
  },
  {
    type: 'currency',
    label: 'Currency',
    icon: DollarSign,
    description: 'Currency input with formatting',
    category: 'advanced',
    tags: ['currency', 'money', 'price'],
  },

  // Media Components
  {
    type: 'file',
    label: 'File Upload',
    icon: Upload,
    description: 'File upload with drag & drop',
    category: 'media',
    tags: ['file', 'upload', 'attachment'],
  },

  // Layout Components (future expansion)
  
  // Data Components
  {
    type: 'matrix',
    label: 'Matrix/Grid',
    icon: Grid3x3,
    description: 'Matrix questions with rows and columns',
    category: 'data',
    tags: ['matrix', 'grid', 'table'],
  },
  {
    type: 'rating',
    label: 'Star Rating',
    icon: Star,
    description: 'Interactive star rating widget',
    category: 'data',
    tags: ['rating', 'stars', 'feedback'],
  },

  // Special Components
  {
    type: 'signature',
    label: 'Digital Signature',
    icon: PenTool,
    description: 'Digital signature pad',
    category: 'special',
    tags: ['signature', 'sign', 'legal'],
  },
  {
    type: 'location',
    label: 'Location Picker',
    icon: MapPin,
    description: 'Location picker with map integration',
    category: 'special',
    tags: ['location', 'map', 'address'],
  },
  {
    type: 'url',
    label: 'URL Link',
    icon: Link,
    description: 'URL input with validation',
    category: 'special',
    tags: ['url', 'link', 'website'],
  },
];

interface ComponentPaletteProps {
  onFieldSelect: (fieldType: FormFieldType, position?: { x: number; y: number }) => void;
  selectedField: any;
  form: any;
}

interface DraggableComponentProps {
  component: ComponentDefinition;
  onQuickAdd: () => void;
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ component, onQuickAdd }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'FORM_FIELD',
    item: { fieldType: component.type, component },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const IconComponent = component.icon;

  return (
    <div
      ref={drag}
      className={`group relative bg-white border border-gray-200 rounded-xl p-4 cursor-grab hover:border-blue-300 hover:shadow-md transition-all duration-200 ${
        isDragging ? 'opacity-50 rotate-2 scale-105' : ''
      } ${component.popular ? 'ring-1 ring-blue-100' : ''}`}
      role="button"
      tabIndex={0}
    >
      {/* Popular badge */}
      {component.popular && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium">
          Popular
        </div>
      )}

      {/* Component Icon and Info */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
          <IconComponent className="w-5 h-5 text-blue-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {component.label}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd();
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200"
              title="Quick add"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {component.description}
          </div>

          {/* Preview */}
          {component.preview && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-400 border border-dashed border-gray-200">
              {component.preview}
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-2">
            {component.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Drag hint */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-blue-500 bg-opacity-10 rounded-xl transition-opacity duration-200">
        <div className="text-xs text-blue-600 font-medium flex items-center space-x-1">
          <Layers className="w-3 h-3" />
          <span>Drag to canvas</span>
        </div>
      </div>
    </div>
  );
};

interface ComponentCategoryProps {
  title: string;
  components: ComponentDefinition[];
  expanded: boolean;
  onToggle: () => void;
  onQuickAdd: (fieldType: FormFieldType) => void;
  count: number;
}

const ComponentCategory: React.FC<ComponentCategoryProps> = ({
  title,
  components,
  expanded,
  onToggle,
  onQuickAdd,
  count,
}) => {
  const categoryIcons: Record<string, React.ComponentType<any>> = {
    basic: Type,
    advanced: Zap,
    media: Image,
    layout: Layout,
    data: BarChart3,
    special: Star,
  };

  const CategoryIcon = categoryIcons[title.toLowerCase()] || Type;

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left group"
      >
        <div className="flex items-center space-x-3">
          <CategoryIcon className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full font-medium">
            {count}
          </span>
          <ChevronDown 
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </button>
      
      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          {components.map((component) => (
            <DraggableComponent
              key={component.type}
              component={component}
              onQuickAdd={() => onQuickAdd(component.type)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({
  onFieldSelect,
  selectedField,
  form,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Basic']) // Expand basic category by default
  );
  const [showPopularOnly, setShowPopularOnly] = useState(false);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Filter components based on search and popular filter
  const filteredComponents = useMemo(() => {
    return componentDefinitions.filter(component => {
      const matchesSearch = searchTerm === '' || 
        component.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesPopular = !showPopularOnly || component.popular;
      
      return matchesSearch && matchesPopular;
    });
  }, [searchTerm, showPopularOnly]);

  // Group filtered components by category
  const componentsByCategory = useMemo(() => {
    return filteredComponents.reduce((acc, component) => {
      const category = component.category.charAt(0).toUpperCase() + component.category.slice(1);
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(component);
      return acc;
    }, {} as Record<string, ComponentDefinition[]>);
  }, [filteredComponents]);

  const handleQuickAdd = (fieldType: FormFieldType) => {
    onFieldSelect(fieldType);
  };

  const categoryOrder = ['Basic', 'Advanced', 'Media', 'Layout', 'Data', 'Special'];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Components</h2>
          <button
            onClick={() => setShowPopularOnly(!showPopularOnly)}
            className={`p-2 rounded-md transition-colors ${
              showPopularOnly 
                ? 'bg-blue-100 text-blue-600' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Show popular only"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        {showPopularOnly && (
          <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            Showing popular components only
          </div>
        )}
      </div>
      
      {/* Component List */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(componentsByCategory).length === 0 ? (
          <div className="text-center py-8">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No components found</p>
            <p className="text-gray-400 text-xs mt-1">Try adjusting your search</p>
          </div>
        ) : (
          categoryOrder.map((category) => {
            const components = componentsByCategory[category];
            if (!components || components.length === 0) return null;

            return (
              <ComponentCategory
                key={category}
                title={category}
                components={components}
                expanded={expandedCategories.has(category)}
                onToggle={() => toggleCategory(category)}
                onQuickAdd={handleQuickAdd}
                count={components.length}
              />
            );
          })
        )}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center space-y-1">
          <div className="flex items-center justify-center space-x-2">
            <Layers className="w-3 h-3" />
            <span>Drag components to canvas</span>
          </div>
          <div>or click the + button for quick add</div>
        </div>
      </div>
    </div>
  );
};