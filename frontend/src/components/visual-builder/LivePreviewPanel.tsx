/**
 * Live Preview Panel for Visual Builder
 * Shows real-time form preview with validation
 */

import React from 'react';
import { FormSchema } from '../../types/forms';
import { FormPreview } from '../forms/FormPreview';

interface LivePreviewPanelProps {
  schema: FormSchema;
  interactive: boolean;
  showValidation: boolean;
}

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({
  schema,
  interactive,
  showValidation,
}) => {
  return (
    <div className="h-full bg-gray-50 overflow-auto">
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FormPreview
            schema={schema}
            interactive={interactive}
            showValidation={showValidation}
          />
        </div>
      </div>
    </div>
  );
};