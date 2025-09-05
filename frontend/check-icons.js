try {
  const { 
    ChevronUp, ChevronDown, GripVertical, ZoomIn, ZoomOut, 
    Layers, Monitor, Tablet, Smartphone, Undo2, Redo2, Download,
    Search, Filter, Zap, Layout, BarChart3, Shield, Accessibility,
    ChevronRight, Move, MoreVertical, Grid, Send, GitBranch,
    RotateCcw, Pause, Database, Globe, Building, RefreshCw
  } = require('lucide-react');
  
  console.log('All icons loaded successfully');
  
  const icons = {
    ChevronUp: !!ChevronUp,
    ChevronDown: !!ChevronDown,
    GripVertical: !!GripVertical,
    ZoomIn: !!ZoomIn,
    ZoomOut: !!ZoomOut,
    Layers: !!Layers,
    Monitor: !!Monitor,
    Tablet: !!Tablet,
    Smartphone: !!Smartphone,
    Undo2: !!Undo2,
    Redo2: !!Redo2,
    Download: !!Download,
    Search: !!Search,
    Filter: !!Filter,
    Zap: !!Zap,
    Layout: !!Layout,
    BarChart3: !!BarChart3,
    Shield: !!Shield,
    Accessibility: !!Accessibility,
    ChevronRight: !!ChevronRight,
    Move: !!Move,
    MoreVertical: !!MoreVertical,
    Grid: !!Grid,
    Send: !!Send,
    GitBranch: !!GitBranch,
    RotateCcw: !!RotateCcw,
    Pause: !!Pause,
    Database: !!Database,
    Globe: !!Globe,
    Building: !!Building,
    RefreshCw: !!RefreshCw,
  };
  
  console.log(icons);
} catch (error) {
  console.error('Error loading icons:', error.message);
}