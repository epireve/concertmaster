// Temporary bypass component for VisualFormBuilder
// This component provides a placeholder that doesn't crash the build
import React from 'react';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface VisualFormBuilderProps {
  initialSchema?: any;
  onSave?: () => void;
  onPreview?: () => void;
}

export const VisualFormBuilder: React.FC<VisualFormBuilderProps> = ({
  initialSchema,
  onSave,
  onPreview
}) => {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            Visual Form Builder
          </h2>
          <div className="flex items-center space-x-2">
            {onPreview && (
              <button 
                onClick={onPreview}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Preview
              </button>
            )}
            {onSave && (
              <button 
                onClick={onSave}
                className="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Visual Builder Under Maintenance
          </h3>
          <p className="text-gray-600 mb-4 max-w-md">
            The visual form builder is temporarily disabled while we resolve some technical issues.
            Please use the standard Form Builder for now.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">
                  Temporary Bypass Active
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                  This is a temporary placeholder to prevent build failures. 
                  The actual visual builder will be restored once technical issues are resolved.
                </p>
              </div>
            </div>
          </div>
          {initialSchema && (
            <div className="text-left bg-white border border-gray-200 rounded-md p-4 max-w-md mx-auto">
              <h5 className="font-medium text-gray-900 mb-2">Schema Preview:</h5>
              <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(initialSchema, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};