import React from 'react';
import { useForm } from '../../hooks/useForm';
import {
  Form,
  FormSection,
  FormActions,
  FormGroup,
  ControlledInput,
  ControlledSelect,
  ControlledTextarea,
  ControlledCheckbox,
  ControlledRadioGroup,
  ControlledFileUpload,
  ControlledMultiSelect,
  formSchemas,
} from '../shared';

export const ExampleForm: React.FC = () => {
  const form = useForm({
    schema: formSchemas.userRegistration,
    onSubmit: async (data) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Form submitted:', data);
    },
    enableAutoSave: true,
    successMessage: 'Registration completed successfully!',
    showToastMessages: true,
  });

  const mockFileUpload = async (file: File) => {
    // Simulate file upload
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { url: `https://example.com/uploads/${file.name}` };
  };

  const skillOptions = [
    { label: 'JavaScript', value: 'javascript' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'React', value: 'react' },
    { label: 'Node.js', value: 'nodejs' },
    { label: 'Python', value: 'python' },
  ];

  const categoryOptions = [
    { label: 'Developer', value: 'developer' },
    { label: 'Designer', value: 'designer' },
    { label: 'Manager', value: 'manager' },
  ];

  const experienceOptions = [
    { label: 'Junior (0-2 years)', value: 'junior' },
    { label: 'Mid-level (3-5 years)', value: 'mid' },
    { label: 'Senior (6+ years)', value: 'senior' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          User Registration Form
        </h1>
        <p className="text-lg text-gray-600">
          Complete example showcasing all form components with validation, accessibility, and responsive design.
        </p>
      </div>

      <Form 
        form={form} 
        onSubmit={form.submitForm}
        layout="vertical"
        spacing="comfortable"
        className="space-y-8"
      >
        {/* Personal Information Section */}
        <FormSection
          title="Personal Information"
          description="Basic information about yourself"
        >
          <FormGroup columns={2} spacing="normal">
            <ControlledInput
              name="firstName"
              label="First Name"
              placeholder="Enter your first name"
              required
            />
            
            <ControlledInput
              name="lastName"
              label="Last Name"
              placeholder="Enter your last name"
              required
            />
          </FormGroup>

          <ControlledInput
            name="email"
            type="email"
            label="Email Address"
            placeholder="Enter your email address"
            helpText="We'll never share your email with anyone else"
            required
          />

          <ControlledInput
            name="phone"
            type="tel"
            label="Phone Number"
            placeholder="Enter your phone number"
            helpText="Optional - for account recovery purposes"
          />
        </FormSection>

        {/* Professional Information Section */}
        <FormSection
          title="Professional Information"
          description="Tell us about your professional background"
        >
          <FormGroup columns={2}>
            <ControlledSelect
              name="category"
              label="Job Category"
              placeholder="Select your job category"
              options={categoryOptions}
              required
            />
            
            <ControlledRadioGroup
              name="experience"
              label="Experience Level"
              options={experienceOptions}
              required
            />
          </FormGroup>

          <ControlledMultiSelect
            name="skills"
            label="Technical Skills"
            placeholder="Select your technical skills"
            options={skillOptions}
            helpText="Select all that apply"
          />

          <ControlledTextarea
            name="bio"
            label="Professional Bio"
            placeholder="Tell us about your professional background and experience"
            showCharacterCount
            maxLength={500}
            autoResize
            minRows={3}
            maxRows={6}
          />
        </FormSection>

        {/* Documents Section */}
        <FormSection
          title="Documents"
          description="Upload your resume and profile picture"
          collapsible
        >
          <FormGroup columns={2}>
            <ControlledFileUpload
              name="resume"
              label="Resume"
              description="Upload your resume (PDF, DOC, DOCX)"
              accept=".pdf,.doc,.docx"
              maxSize={5 * 1024 * 1024} // 5MB
              onUpload={mockFileUpload}
            />
            
            <ControlledFileUpload
              name="avatar"
              label="Profile Picture"
              description="Upload a profile picture (JPG, PNG)"
              accept="image/*"
              maxSize={2 * 1024 * 1024} // 2MB
              onUpload={mockFileUpload}
            />
          </FormGroup>
        </FormSection>

        {/* Security Section */}
        <FormSection
          title="Security"
          description="Set up your account security"
        >
          <ControlledInput
            name="password"
            type="password"
            label="Password"
            placeholder="Enter a secure password"
            helpText="Must be at least 8 characters with uppercase, lowercase, number, and special character"
            required
          />

          <ControlledInput
            name="confirmPassword"
            type="password"
            label="Confirm Password"
            placeholder="Confirm your password"
            required
          />
        </FormSection>

        {/* Preferences Section */}
        <FormSection
          title="Preferences"
          description="Customize your account preferences"
        >
          <div className="space-y-4">
            <ControlledCheckbox
              name="terms"
              label="I agree to the Terms of Service and Privacy Policy"
              required
            />
            
            <ControlledCheckbox
              name="newsletter"
              label="Subscribe to our newsletter"
              description="Get updates about new features and opportunities"
              variant="switch"
            />
            
            <ControlledCheckbox
              name="notifications"
              label="Enable push notifications"
              description="Receive notifications about important account updates"
              variant="switch"
            />
          </div>
        </FormSection>

        {/* Form Actions */}
        <FormActions
          submitLabel="Create Account"
          submitVariant="primary"
          showCancel
          cancelLabel="Clear Form"
          onCancel={() => form.resetForm()}
          align="right"
        />
      </Form>

      {/* Form State Debug Info (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Form State (Development)</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Is Valid:</strong> {form.isValid ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Is Dirty:</strong> {form.isDirty ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Is Submitting:</strong> {form.isSubmitting ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Has Errors:</strong> {form.hasErrors ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Submit Count:</strong> {form.formState.submitCount}
            </div>
            <div>
              <strong>Has Unsaved:</strong> {form.formState.hasUnsavedChanges ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
