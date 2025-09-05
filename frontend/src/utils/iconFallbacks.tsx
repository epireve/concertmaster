// Icon Fallbacks - Temporary solution for missing lucide-react exports
// This file provides fallback icons for missing lucide-react exports to prevent build failures

import React from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  Move, 
  Laptop, 
  TabletSmartphone, 
  Smartphone,
  RotateCcw,
  Repeat,
  Download,
  Search,
  Layers,
  SlidersHorizontal,
  Zap,
  Grid3X3,
  BarChart3,
  Shield,
  Eye,
  ChevronRight,
  MoreVertical,
  Settings,
  Send,
  GitBranch,
  Pause,
  Database,
  Globe,
  Building,
  RefreshCw,
  Calculator,
  Clock,
  Save,
  Plus
} from 'lucide-react';

// Icon component type
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// Create fallback icons for missing exports
export const ArrowUp: IconComponent = ChevronUp;
export const ArrowDown: IconComponent = ChevronDown;
export const Move3D: IconComponent = Move;
export const Move: IconComponent = Move;
export const Monitor: IconComponent = Laptop;
export const Tablet: IconComponent = TabletSmartphone;
export { Smartphone };
export { ChevronUp };
export { ChevronDown };

export const Undo: IconComponent = RotateCcw;
export const Redo: IconComponent = Repeat;
export { Download };
export { Search };
export { Layers };
export const Filter: IconComponent = Search;
export { Zap };

export const LayoutGrid: IconComponent = Grid3X3;
export { BarChart3 };
export { Shield };
export const Accessibility: IconComponent = Eye;

export { ChevronRight };
export { MoreVertical };
export const Grid: IconComponent = Grid3X3;
export { SlidersHorizontal };

// Additional missing exports
export const Layout: IconComponent = Grid3X3;
export const GripVertical: IconComponent = MoreVertical;
export const Undo2: IconComponent = RotateCcw;
export const Redo2: IconComponent = Repeat;

// Workflow node icons
export { Send };
export { GitBranch };
export { RotateCcw };
export { Pause };
export { Database };
export { Globe };
export { Building };
export { RefreshCw };
export { Calculator };
export { Clock };
export { Save };
export { Plus };

// Additional missing icons with sensible fallbacks
export const ZoomIn: IconComponent = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
    <line x1="11" y1="8" x2="11" y2="14"/>
  </svg>
);

export const ZoomOut: IconComponent = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);

// Simple placeholder icon for any missing icons
export const PlaceholderIcon: IconComponent = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <path d="M9 9h6v6H9z"/>
  </svg>
);

// Export a helper function to get any icon with fallback
export const getIconWithFallback = (iconName: string): IconComponent => {
  const iconMap: Record<string, IconComponent> = {
    ArrowUp,
    ArrowDown,
    Move3D,
    Monitor,
    Tablet,
    Smartphone,
    Undo,
    Redo,
    Download,
    Search,
    Layers,
    Filter,
    Zap,
    LayoutGrid,
    BarChart3,
    Shield,
    Accessibility,
    ChevronRight,
    MoreVertical,
    Grid,
    SlidersHorizontal,
    Send,
    GitBranch,
    RotateCcw,
    Pause,
    Database,
    Globe,
    Building,
    RefreshCw,
    Calculator,
    ZoomIn,
    ZoomOut,
  };

  return iconMap[iconName] || PlaceholderIcon;
};