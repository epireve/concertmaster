import React from 'react';
import { 
  Type, 
  AlignLeft, 
  Mail, 
  Hash, 
  ChevronDown, 
  CheckSquare, 
  Calendar,
  Upload,
  Link,
  Phone,
  DollarSign,
  Star,
  Grid3x3,
  PenTool,
  MapPin
} from 'lucide-react';
import { FormFieldType } from '../../types/forms';

interface FieldDefinition {
  type: FormFieldType;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  category: 'basic' | 'advanced' | 'special';
}

const fieldDefinitions: FieldDefinition[] = [
  // Basic Fields
  {
    type: 'text',
    label: 'Text Input',
    icon: Type,
    description: 'Single line text input',
    category: 'basic',
  },
  {
    type: 'textarea',
    label: 'Text Area',
    icon: AlignLeft,
    description: 'Multi-line text input',
    category: 'basic',
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Email address input with validation',
    category: 'basic',
  },
  {
    type: 'number',
    label: 'Number',
    icon: Hash,
    description: 'Numeric input field',
    category: 'basic',
  },
  {
    type: 'select',
    label: 'Dropdown',
    icon: ChevronDown,
    description: 'Single selection dropdown',
    category: 'basic',
  },
  {
    type: 'radio',
    label: 'Radio Buttons',
    icon: CheckSquare,
    description: 'Single choice from multiple options',
    category: 'basic',
  },
  {
    type: 'checkbox',
    label: 'Checkboxes',
    icon: CheckSquare,
    description: 'Multiple selections allowed',
    category: 'basic',
  },

  // Advanced Fields
  {
    type: 'date',
    label: 'Date',
    icon: Calendar,
    description: 'Date picker',
    category: 'advanced',
  },
  {
    type: 'datetime',
    label: 'Date & Time',
    icon: Calendar,
    description: 'Date and time picker',
    category: 'advanced',
  },
  {
    type: 'file',
    label: 'File Upload',
    icon: Upload,
    description: 'File upload field',
    category: 'advanced',
  },
  {
    type: 'url',
    label: 'URL',
    icon: Link,
    description: 'URL input with validation',
    category: 'advanced',
  },
  {
    type: 'phone',
    label: 'Phone',
    icon: Phone,
    description: 'Phone number input',
    category: 'advanced',
  },
  {
    type: 'currency',
    label: 'Currency',
    icon: DollarSign,
    description: 'Currency amount input',
    category: 'advanced',
  },

  // Special Fields
  {
    type: 'rating',
    label: 'Rating',
    icon: Star,
    description: 'Star rating widget',
    category: 'special',
  },
  {
    type: 'matrix',
    label: 'Matrix',
    icon: Grid3x3,
    description: 'Matrix/grid questions',
    category: 'special',
  },
  {
    type: 'signature',
    label: 'Signature',
    icon: PenTool,
    description: 'Digital signature pad',
    category: 'special',
  },
  {
    type: 'location',
    label: 'Location',
    icon: MapPin,
    description: 'Location picker with map',
    category: 'special',
  },
];

interface FieldPaletteProps {
  onFieldSelect: (fieldType: FormFieldType) => void;
  onDragStart?: (fieldType: FormFieldType) => void;
  onDragEnd?: () => void;
}

interface DraggableFieldProps {
  definition: FieldDefinition;
  onSelect: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const DraggableField: React.FC<DraggableFieldProps> = ({
  definition,
  onSelect,
  onDragStart,
  onDragEnd,
}) => {
  const { type, label, icon: IconComponent, description } = definition;

  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('field-type', type);
    event.dataTransfer.effectAllowed = 'copy';
    onDragStart?.();
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <div
      className="group bg-white border border-gray-200 rounded-lg p-3 cursor-grab hover:border-gray-300 hover:shadow-sm transition-all duration-200 active:cursor-grabbing"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
          <IconComponent className="w-4 h-4 text-blue-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {label}
          </div>
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
};

interface FieldCategoryProps {
  title: string;
  fields: FieldDefinition[];
  expanded: boolean;
  onToggle: () => void;
  onFieldSelect: (fieldType: FormFieldType) => void;
  onDragStart?: (fieldType: FormFieldType) => void;
  onDragEnd?: () => void;
}

const FieldCategory: React.FC<FieldCategoryProps> = ({
  title,
  fields,
  expanded,
  onToggle,
  onFieldSelect,
  onDragStart,
  onDragEnd,
}) => {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
            {fields.length}
          </span>
          <ChevronDown 
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </button>
      
      {expanded && (
        <div className="mt-2 space-y-2">
          {fields.map((definition) => (
            <DraggableField
              key={definition.type}
              definition={definition}
              onSelect={() => onFieldSelect(definition.type)}
              onDragStart={() => onDragStart?.(definition.type)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FieldPalette: React.FC<FieldPaletteProps> = ({
  onFieldSelect,
  onDragStart,
  onDragEnd,
}) => {
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    new Set(['basic']) // Expand basic category by default
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Group fields by category
  const fieldsByCategory = fieldDefinitions.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldDefinition[]>);

  const categoryLabels = {
    basic: 'Basic Fields',
    advanced: 'Advanced Fields',
    special: 'Special Fields',
  };

  const categoryOrder: Array<keyof typeof categoryLabels> = ['basic', 'advanced', 'special'];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Field Library</h2>
        <p className="text-sm text-gray-600 mt-1">
          Drag fields to add them to your form
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {categoryOrder.map((category) => (
          <FieldCategory
            key={category}
            title={categoryLabels[category]}
            fields={fieldsByCategory[category] || []}
            expanded={expandedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
            onFieldSelect={onFieldSelect}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
      
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center">
          💡 Tip: Drag fields to the form canvas or click to add
        </div>
      </div>
    </div>
  );
};