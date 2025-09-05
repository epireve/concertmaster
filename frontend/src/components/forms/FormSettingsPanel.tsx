import React from 'react';

interface FormSettingsPanelProps {
  form: any; // TanStack form instance
}

export const FormSettingsPanel: React.FC<FormSettingsPanelProps> = ({ form }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Form Settings</h2>
        
        {/* General Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">General</h3>
          
          <div className="space-y-4">
            <form.Field name="settings.allowMultipleSubmissions">
              {(field: any) => (
                <div className="flex items-center">
                  <input
                    id="allowMultiple"
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="allowMultiple" className="ml-2 text-sm text-gray-700">
                    Allow multiple submissions per user
                  </label>
                </div>
              )}
            </form.Field>

            <form.Field name="settings.requireAuthentication">
              {(field: any) => (
                <div className="flex items-center">
                  <input
                    id="requireAuth"
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="requireAuth" className="ml-2 text-sm text-gray-700">
                    Require user authentication
                  </label>
                </div>
              )}
            </form.Field>

            <form.Field name="settings.showProgressBar">
              {(field: any) => (
                <div className="flex items-center">
                  <input
                    id="showProgress"
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="showProgress" className="ml-2 text-sm text-gray-700">
                    Show progress bar
                  </label>
                </div>
              )}
            </form.Field>

            <form.Field name="settings.savePartialResponses">
              {(field: any) => (
                <div className="flex items-center">
                  <input
                    id="savePartial"
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="savePartial" className="ml-2 text-sm text-gray-700">
                    Save partial responses automatically
                  </label>
                </div>
              )}
            </form.Field>
          </div>
        </div>

        {/* Submission Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Submission</h3>
          
          <div className="space-y-4">
            <form.Field name="settings.submitButtonText">
              {(field: any) => (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Submit Button Text
                  </label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Submit"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="settings.confirmationMessage">
              {(field: any) => (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmation Message
                  </label>
                  <textarea
                    value={field.state.value || ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Thank you for your submission!"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="settings.redirectUrl">
              {(field: any) => (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Redirect URL (optional)
                  </label>
                  <input
                    type="url"
                    value={field.state.value || ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com/thank-you"
                  />
                </div>
              )}
            </form.Field>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notifications</h3>
          
          <form.Field name="settings.notificationEmails">
            {(field: any) => (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notification Emails
                </label>
                <textarea
                  value={field.state.value?.join('\n') || ''}
                  onChange={(e) => field.handleChange(e.target.value.split('\n').filter(email => email.trim()))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="admin@company.com&#10;manager@company.com"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Enter one email address per line
                </p>
              </div>
            )}
          </form.Field>
        </div>

        {/* Localization */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Localization</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="settings.language">
              {(field: any) => (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language
                  </label>
                  <select
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="it">Italiano</option>
                    <option value="pt">Português</option>
                  </select>
                </div>
              )}
            </form.Field>

            <form.Field name="settings.timezone">
              {(field: any) => (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                </div>
              )}
            </form.Field>
          </div>
        </div>
      </div>
    </div>
  );
};