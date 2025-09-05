/**
 * Canvas Toolbar for Visual Builder
 * Features: View modes, zoom controls, canvas settings
 */

import React from 'react';
import { 
  Eye, Code, Settings, Save, Play, Plus, Minus, 
  Grid3x3, Palette, Upload
} from 'lucide-react';

import { ZoomIn, ZoomOut, Layers, Monitor, Tablet, Smartphone, Undo2, Redo2, Download } from '../../utils/iconFallbacks';

interface CanvasToolbarProps {
  viewMode: 'design' | 'preview' | 'code' | 'responsive';
  onViewModeChange: (mode: 'design' | 'preview' | 'code' | 'responsive') => void;
  canvasMode: 'visual' | 'split' | 'preview';
  onCanvasModeChange: (mode: 'visual' | 'split' | 'preview') => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showLayers: boolean;
  onToggleLayers: () => void;
  canvasBackground: string;
  onBackgroundChange: (color: string) => void;
  onSave: () => void;
  onPreview: () => void;
  form: any;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  viewMode,
  onViewModeChange,
  canvasMode,
  onCanvasModeChange,
  zoom,
  onZoomChange,
  showGrid,
  onToggleGrid,
  showLayers,
  onToggleLayers,
  canvasBackground,
  onBackgroundChange,
  onSave,
  onPreview,
  form,
}) => {
  const zoomLevels = [25, 50, 75, 100, 125, 150, 200];

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(zoom);
    if (currentIndex < zoomLevels.length - 1) {
      onZoomChange(zoomLevels[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(zoom);
    if (currentIndex > 0) {
      onZoomChange(zoomLevels[currentIndex - 1]);
    }
  };

  const backgroundColors = [
    { name: 'White', value: '#ffffff' },
    { name: 'Light Gray', value: '#f9fafb' },
    { name: 'Dark Gray', value: '#374151' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Green', value: '#d1fae5' },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left Section - Form Info */}
        <div className="flex items-center space-x-4">
          <form.Field name="title">
            {(field) => (
              <input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 min-w-0"
                placeholder="Form Title"
              />
            )}
          </form.Field>
          
          <div className="text-sm text-gray-500">
            Visual Builder
          </div>
        </div>

        {/* Center Section - View Controls */}
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          {/* View Mode Buttons */}
          <button
            onClick={() => onViewModeChange('design')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'design' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-1.5" />
            Design
          </button>

          <button
            onClick={() => onViewModeChange('preview')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'preview' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-1.5" />
            Preview
          </button>

          <button
            onClick={() => onViewModeChange('code')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'code' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Code className="w-4 h-4 inline mr-1.5" />
            Code
          </button>

          <button
            onClick={() => onViewModeChange('responsive')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'responsive' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Monitor className="w-4 h-4 inline mr-1.5" />
            Responsive
          </button>
        </div>

        {/* Right Section - Tools and Actions */}
        <div className="flex items-center space-x-3">
          {/* Canvas Mode */}
          {viewMode === 'design' && (
            <div className="flex items-center space-x-1 border border-gray-300 rounded-lg">
              <button
                onClick={() => onCanvasModeChange('visual')}
                className={`px-2 py-1 text-xs rounded-l-md ${
                  canvasMode === 'visual' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Visual
              </button>
              <button
                onClick={() => onCanvasModeChange('split')}
                className={`px-2 py-1 text-xs border-l border-gray-300 ${
                  canvasMode === 'split' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Split
              </button>
              <button
                onClick={() => onCanvasModeChange('preview')}
                className={`px-2 py-1 text-xs border-l border-gray-300 rounded-r-md ${
                  canvasMode === 'preview' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Preview
              </button>
            </div>
          )}

          {/* Responsive Preview Buttons */}
          {viewMode === 'responsive' && (
            <div className="flex items-center space-x-1">
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                <Monitor className="w-4 h-4" />
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                <Tablet className="w-4 h-4" />
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          {viewMode === 'design' && (
            <div className="flex items-center space-x-1 border border-gray-300 rounded-lg">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= zoomLevels[0]}
                className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              
              <select
                value={zoom}
                onChange={(e) => onZoomChange(parseInt(e.target.value))}
                className="border-l border-r border-gray-300 px-2 py-1 text-sm bg-transparent focus:outline-none"
              >
                {zoomLevels.map((level) => (
                  <option key={level} value={level}>{level}%</option>
                ))}
              </select>
              
              <button
                onClick={handleZoomIn}
                disabled={zoom >= zoomLevels[zoomLevels.length - 1]}
                className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Canvas Tools */}
          {viewMode === 'design' && (
            <>
              <button
                onClick={onToggleGrid}
                className={`p-2 rounded transition-colors ${
                  showGrid 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Toggle grid"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>

              <button
                onClick={onToggleLayers}
                className={`p-2 rounded transition-colors ${
                  showLayers 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Toggle layers panel"
              >
                <Layers className="w-4 h-4" />
              </button>

              {/* Background Color Picker */}
              <div className="relative group">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                  <Palette className="w-4 h-4" />
                </button>
                
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="text-xs font-medium text-gray-700 mb-2">Canvas Background</div>
                  <div className="grid grid-cols-5 gap-1">
                    {backgroundColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => onBackgroundChange(color.value)}
                        className={`w-6 h-6 rounded border-2 ${
                          canvasBackground === color.value ? 'border-blue-500' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="h-6 w-px bg-gray-300" />

          {/* Action Buttons */}
          <button
            onClick={onSave}
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Save
          </button>

          <button
            onClick={onPreview}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            <Play className="w-4 h-4 mr-1.5" />
            Test
          </button>
        </div>
      </div>
    </div>
  );
};