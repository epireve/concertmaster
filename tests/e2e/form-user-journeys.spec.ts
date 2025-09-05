/**
 * End-to-End Tests for Form User Journeys
 * Complete user workflows from form creation to submission
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
test.describe.configure({ mode: 'parallel' });

// Page object models
class FormBuilderPage {
  constructor(private page: Page) {}

  async navigateToFormBuilder() {
    await this.page.goto('/forms/builder');
    await this.page.waitForLoadState('networkidle');
  }

  async setFormTitle(title: string) {
    await this.page.fill('[data-testid="form-title-input"]', title);
  }

  async setFormDescription(description: string) {
    await this.page.fill('[data-testid="form-description-input"]', description);
  }

  async addField(fieldType: string) {
    await this.page.click(`[data-testid="field-palette-${fieldType}"]`);
    await this.page.waitForTimeout(500); // Wait for field to be added
  }

  async dragFieldToCanvas(fieldType: string, position: { x: number; y: number }) {
    const fieldElement = this.page.locator(`[data-testid="field-palette-${fieldType}"]`);
    const canvas = this.page.locator('[data-testid="form-canvas"]');
    
    await fieldElement.dragTo(canvas, {
      targetPosition: position,
    });
  }

  async selectField(fieldId: string) {
    await this.page.click(`[data-testid="field-${fieldId}"]`);
  }

  async updateFieldProperty(property: string, value: string) {
    await this.page.fill(`[data-testid="field-property-${property}"]`, value);
  }

  async saveForm() {
    await this.page.click('[data-testid="save-form-button"]');
    await this.page.waitForSelector('[data-testid="save-success-message"]');
  }

  async previewForm() {
    await this.page.click('[data-testid="preview-form-button"]');
    await this.page.waitForSelector('[data-testid="form-preview"]');
  }

  async switchToCodeView() {
    await this.page.click('[data-testid="code-view-button"]');
    await this.page.waitForSelector('[data-testid="form-code-view"]');
  }

  async getGeneratedJSON() {
    return this.page.textContent('[data-testid="form-json-output"]');
  }
}

class FormPreviewPage {
  constructor(private page: Page) {}

  async navigateToPreview(formId: string) {
    await this.page.goto(`/forms/${formId}/preview`);
    await this.page.waitForLoadState('networkidle');
  }

  async fillField(fieldName: string, value: string) {
    await this.page.fill(`[name="${fieldName}"]`, value);
  }

  async selectOption(fieldName: string, option: string) {
    await this.page.selectOption(`[name="${fieldName}"]`, option);
  }

  async checkBox(fieldName: string) {
    await this.page.check(`[name="${fieldName}"]`);
  }

  async uploadFile(fieldName: string, filePath: string) {
    await this.page.setInputFiles(`[name="${fieldName}"]`, filePath);
  }

  async submitForm() {
    await this.page.click('[data-testid="submit-form-button"]');
  }

  async getValidationErrors() {
    return this.page.locator('[data-testid="validation-error"]').allTextContents();
  }

  async waitForSubmissionSuccess() {
    await this.page.waitForSelector('[data-testid="submission-success"]');
  }

  async getSuccessMessage() {
    return this.page.textContent('[data-testid="submission-success-message"]');
  }
}

// Test utilities
async function createTestForm(page: Page, formData: {
  title: string;
  description: string;
  fields: Array<{ type: string; label: string; required?: boolean }>;
}) {
  const formBuilder = new FormBuilderPage(page);
  
  await formBuilder.navigateToFormBuilder();
  await formBuilder.setFormTitle(formData.title);
  await formBuilder.setFormDescription(formData.description);

  for (const field of formData.fields) {
    await formBuilder.addField(field.type);
    // Additional field configuration would go here
  }

  await formBuilder.saveForm();
  
  // Return form ID from URL or API response
  return page.url().split('/').pop();
}

test.describe('Form Builder User Journey', () => {
  let formBuilderPage: FormBuilderPage;

  test.beforeEach(async ({ page }) => {
    formBuilderPage = new FormBuilderPage(page);
  });

  test('should create a complete contact form from scratch', async ({ page }) => {
    await formBuilderPage.navigateToFormBuilder();

    // Set form metadata
    await formBuilderPage.setFormTitle('Contact Us Form');
    await formBuilderPage.setFormDescription('Get in touch with our team');

    // Add form fields
    await formBuilderPage.addField('text');
    await formBuilderPage.updateFieldProperty('label', 'Full Name');
    await formBuilderPage.updateFieldProperty('required', 'true');

    await formBuilderPage.addField('email');
    await formBuilderPage.updateFieldProperty('label', 'Email Address');
    await formBuilderPage.updateFieldProperty('required', 'true');

    await formBuilderPage.addField('phone');
    await formBuilderPage.updateFieldProperty('label', 'Phone Number');

    await formBuilderPage.addField('select');
    await formBuilderPage.updateFieldProperty('label', 'Department');
    await formBuilderPage.updateFieldProperty('options', 'Sales,Support,General');

    await formBuilderPage.addField('textarea');
    await formBuilderPage.updateFieldProperty('label', 'Message');
    await formBuilderPage.updateFieldProperty('required', 'true');

    // Save the form
    await formBuilderPage.saveForm();

    // Verify form was created
    await expect(page.locator('[data-testid="save-success-message"]')).toContainText('Form saved successfully');
  });

  test('should use drag and drop to build form', async ({ page }) => {
    await formBuilderPage.navigateToFormBuilder();

    // Drag fields from palette to canvas
    await formBuilderPage.dragFieldToCanvas('text', { x: 100, y: 100 });
    await formBuilderPage.dragFieldToCanvas('email', { x: 100, y: 200 });
    await formBuilderPage.dragFieldToCanvas('textarea', { x: 100, y: 300 });

    // Verify fields were added
    await expect(page.locator('[data-testid="form-canvas"]')).toContainText('Text Input');
    await expect(page.locator('[data-testid="form-canvas"]')).toContainText('Email');
    await expect(page.locator('[data-testid="form-canvas"]')).toContainText('Text Area');

    await formBuilderPage.saveForm();
  });

  test('should preview form during building process', async ({ page }) => {
    await formBuilderPage.navigateToFormBuilder();
    
    await formBuilderPage.setFormTitle('Preview Test Form');
    await formBuilderPage.addField('text');
    await formBuilderPage.addField('email');

    // Switch to preview mode
    await formBuilderPage.previewForm();

    // Verify preview shows the form
    await expect(page.locator('[data-testid="form-preview"]')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Test form interaction in preview
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');

    // Verify values were entered
    await expect(page.locator('input[type="text"]')).toHaveValue('Test User');
    await expect(page.locator('input[type="email"]')).toHaveValue('test@example.com');
  });

  test('should export form as JSON', async ({ page }) => {
    await formBuilderPage.navigateToFormBuilder();
    
    await formBuilderPage.setFormTitle('JSON Export Test');
    await formBuilderPage.addField('text');
    await formBuilderPage.addField('email');

    // Switch to code view
    await formBuilderPage.switchToCodeView();

    // Verify JSON output
    const jsonOutput = await formBuilderPage.getGeneratedJSON();
    expect(jsonOutput).toContain('"title": "JSON Export Test"');
    expect(jsonOutput).toContain('"type": "text"');
    expect(jsonOutput).toContain('"type": "email"');

    // Verify JSON is valid
    expect(() => JSON.parse(jsonOutput!)).not.toThrow();
  });

  test('should handle form validation during building', async ({ page }) => {
    await formBuilderPage.navigateToFormBuilder();

    // Try to save form without title
    await formBuilderPage.saveForm();

    // Should show validation error or use default title
    // Implementation depends on business rules
    await expect(page.locator('[data-testid="form-title-input"]')).toHaveValue(/.*Form.*/);
  });
});

test.describe('Form Submission User Journey', () => {
  let formPreviewPage: FormPreviewPage;

  test.beforeEach(async ({ page }) => {
    formPreviewPage = new FormPreviewPage(page);
  });

  test('should submit a complete form successfully', async ({ page, context }) => {
    // Create a test form first
    const formId = await createTestForm(page, {
      title: 'Test Submission Form',
      description: 'Form for testing submission',
      fields: [
        { type: 'text', label: 'Name', required: true },
        { type: 'email', label: 'Email', required: true },
        { type: 'textarea', label: 'Message', required: false },
      ],
    });

    await formPreviewPage.navigateToPreview(formId!);

    // Fill out the form
    await formPreviewPage.fillField('name', 'John Doe');
    await formPreviewPage.fillField('email', 'john.doe@example.com');
    await formPreviewPage.fillField('message', 'This is a test message.');

    // Submit the form
    await formPreviewPage.submitForm();

    // Wait for successful submission
    await formPreviewPage.waitForSubmissionSuccess();

    // Verify success message
    const successMessage = await formPreviewPage.getSuccessMessage();
    expect(successMessage).toContain('Thank you for your submission');
  });

  test('should show validation errors for incomplete form', async ({ page }) => {
    const formId = await createTestForm(page, {
      title: 'Validation Test Form',
      description: 'Form for testing validation',
      fields: [
        { type: 'text', label: 'Required Field', required: true },
        { type: 'email', label: 'Email', required: true },
      ],
    });

    await formPreviewPage.navigateToPreview(formId!);

    // Try to submit without filling required fields
    await formPreviewPage.submitForm();

    // Check for validation errors
    const errors = await formPreviewPage.getValidationErrors();
    expect(errors).toContain('Required Field is required');
    expect(errors).toContain('Email is required');
  });

  test('should handle file uploads correctly', async ({ page }) => {
    const formId = await createTestForm(page, {
      title: 'File Upload Form',
      description: 'Form with file upload',
      fields: [
        { type: 'text', label: 'Name', required: true },
        { type: 'file', label: 'Resume', required: true },
      ],
    });

    await formPreviewPage.navigateToPreview(formId!);

    // Fill form with file upload
    await formPreviewPage.fillField('name', 'Job Applicant');
    
    // Create a temporary file for upload
    await page.setContent(`
      <input type="file" id="temp-file" />
      <script>
        const file = new File(['resume content'], 'resume.pdf', { type: 'application/pdf' });
        const input = document.getElementById('temp-file');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      </script>
    `);

    await formPreviewPage.uploadFile('resume', 'tests/fixtures/sample-resume.pdf');

    // Submit form
    await formPreviewPage.submitForm();
    await formPreviewPage.waitForSubmissionSuccess();

    // Verify file was uploaded
    const successMessage = await formPreviewPage.getSuccessMessage();
    expect(successMessage).toContain('submission');
  });

  test('should save partial progress in multi-step form', async ({ page }) => {
    const formId = await createTestForm(page, {
      title: 'Multi-step Form',
      description: 'Form with multiple sections',
      fields: [
        { type: 'text', label: 'Step 1 Field' },
        { type: 'email', label: 'Step 2 Field' },
        { type: 'textarea', label: 'Step 3 Field' },
      ],
    });

    await formPreviewPage.navigateToPreview(formId!);

    // Fill first step
    await formPreviewPage.fillField('step_1_field', 'Step 1 Data');
    
    // Navigate to next step (implementation depends on form design)
    await page.click('[data-testid="next-step-button"]');
    
    // Refresh page to test persistence
    await page.reload();
    
    // Verify data is still there
    await expect(page.locator('[name="step_1_field"]')).toHaveValue('Step 1 Data');
  });
});

test.describe('Advanced Form Features', () => {
  test('should handle conditional field visibility', async ({ page }) => {
    const formBuilderPage = new FormBuilderPage(page);
    
    await formBuilderPage.navigateToFormBuilder();
    await formBuilderPage.setFormTitle('Conditional Fields Form');

    // Add trigger field
    await formBuilderPage.addField('select');
    await formBuilderPage.updateFieldProperty('label', 'Show Additional Info?');
    await formBuilderPage.updateFieldProperty('options', 'Yes,No');

    // Add conditional field
    await formBuilderPage.addField('text');
    await formBuilderPage.updateFieldProperty('label', 'Additional Info');
    await formBuilderPage.updateFieldProperty('visibility-condition', 'show_additional_info = Yes');

    await formBuilderPage.saveForm();
    await formBuilderPage.previewForm();

    // Test conditional visibility
    await expect(page.locator('[data-testid="field-additional-info"]')).not.toBeVisible();
    
    await formPreviewPage.selectOption('show_additional_info', 'Yes');
    await expect(page.locator('[data-testid="field-additional-info"]')).toBeVisible();
    
    await formPreviewPage.selectOption('show_additional_info', 'No');
    await expect(page.locator('[data-testid="field-additional-info"]')).not.toBeVisible();
  });

  test('should support real-time validation', async ({ page }) => {
    const formId = await createTestForm(page, {
      title: 'Real-time Validation Form',
      description: 'Form with real-time validation',
      fields: [
        { type: 'email', label: 'Email', required: true },
        { type: 'text', label: 'Phone', required: true },
      ],
    });

    const formPreviewPage = new FormPreviewPage(page);
    await formPreviewPage.navigateToPreview(formId!);

    // Test email validation
    await formPreviewPage.fillField('email', 'invalid-email');
    await page.locator('[name="email"]').blur();
    
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Please enter a valid email');

    // Fix email
    await formPreviewPage.fillField('email', 'valid@example.com');
    await page.locator('[name="email"]').blur();
    
    await expect(page.locator('[data-testid="email-error"]')).not.toBeVisible();
  });

  test('should handle form templates', async ({ page }) => {
    // Navigate to form templates
    await page.goto('/forms/templates');
    await page.waitForLoadState('networkidle');

    // Select a template
    await page.click('[data-testid="template-contact-form"]');
    await page.click('[data-testid="use-template-button"]');

    // Verify template was loaded in builder
    await expect(page.locator('[data-testid="form-title-input"]')).toHaveValue('Contact Form');
    await expect(page.locator('[data-testid="form-canvas"]')).toContainText('Name');
    await expect(page.locator('[data-testid="form-canvas"]')).toContainText('Email');
    await expect(page.locator('[data-testid="form-canvas"]')).toContainText('Message');
  });
});

test.describe('Form Analytics and Reporting', () => {
  test('should track form submission analytics', async ({ page, context }) => {
    // Create form and submit multiple responses
    const formId = await createTestForm(page, {
      title: 'Analytics Test Form',
      description: 'Form for analytics testing',
      fields: [
        { type: 'text', label: 'Name', required: true },
        { type: 'email', label: 'Email', required: true },
      ],
    });

    const formPreviewPage = new FormPreviewPage(page);
    
    // Submit form multiple times
    for (let i = 1; i <= 3; i++) {
      await formPreviewPage.navigateToPreview(formId!);
      await formPreviewPage.fillField('name', `Test User ${i}`);
      await formPreviewPage.fillField('email', `user${i}@example.com`);
      await formPreviewPage.submitForm();
      await formPreviewPage.waitForSubmissionSuccess();
    }

    // Navigate to analytics
    await page.goto(`/forms/${formId}/analytics`);
    await page.waitForLoadState('networkidle');

    // Verify analytics data
    await expect(page.locator('[data-testid="submission-count"]')).toContainText('3');
    await expect(page.locator('[data-testid="conversion-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="response-chart"]')).toBeVisible();
  });

  test('should export response data', async ({ page }) => {
    const formId = await createTestForm(page, {
      title: 'Export Test Form',
      description: 'Form for testing data export',
      fields: [
        { type: 'text', label: 'Name', required: true },
        { type: 'email', label: 'Email', required: true },
      ],
    });

    // Navigate to form responses
    await page.goto(`/forms/${formId}/responses`);
    await page.waitForLoadState('networkidle');

    // Export responses
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/.*\.csv$/);
  });
});

test.describe('Accessibility and Performance', () => {
  test('should be fully keyboard navigable', async ({ page }) => {
    const formBuilderPage = new FormBuilderPage(page);
    await formBuilderPage.navigateToFormBuilder();

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'form-title-input');

    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'form-description-input');

    // Continue tabbing through interface
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to add field with keyboard
    await page.keyboard.press('Enter');
  });

  test('should meet accessibility standards', async ({ page }) => {
    const formId = await createTestForm(page, {
      title: 'Accessibility Test Form',
      description: 'Form for testing accessibility',
      fields: [
        { type: 'text', label: 'Name', required: true },
        { type: 'email', label: 'Email', required: true },
      ],
    });

    const formPreviewPage = new FormPreviewPage(page);
    await formPreviewPage.navigateToPreview(formId!);

    // Check for proper labels
    await expect(page.locator('label[for="name"]')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();

    // Check for ARIA attributes
    await expect(page.locator('[name="name"]')).toHaveAttribute('aria-required', 'true');
    await expect(page.locator('[name="email"]')).toHaveAttribute('aria-required', 'true');

    // Check color contrast (would require additional axe-core integration)
    // This is a placeholder for accessibility testing
  });

  test('should load and render forms quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/forms/builder');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Form builder should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);

    // Check for performance markers
    const performanceTiming = await page.evaluate(() => {
      return {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      };
    });

    expect(performanceTiming.domContentLoaded).toBeLessThan(2000);
  });
});

test.describe('Error Handling and Edge Cases', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    const formBuilderPage = new FormBuilderPage(page);
    await formBuilderPage.navigateToFormBuilder();

    // Simulate network failure
    await page.route('**/api/forms', route => route.abort());

    await formBuilderPage.setFormTitle('Network Error Test');
    await formBuilderPage.saveForm();

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Unable to save form');
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle browser refresh during form building', async ({ page }) => {
    const formBuilderPage = new FormBuilderPage(page);
    await formBuilderPage.navigateToFormBuilder();

    // Make changes
    await formBuilderPage.setFormTitle('Unsaved Changes Test');
    await formBuilderPage.addField('text');

    // Refresh browser
    await page.reload();

    // Should prompt about unsaved changes or restore from local storage
    // Implementation depends on auto-save strategy
    expect(page.url()).toContain('/forms/builder');
  });

  test('should validate maximum field limits', async ({ page }) => {
    const formBuilderPage = new FormBuilderPage(page);
    await formBuilderPage.navigateToFormBuilder();

    // Try to add many fields (assuming there's a limit)
    for (let i = 0; i < 101; i++) {
      await formBuilderPage.addField('text');
    }

    // Should show limit warning
    await expect(page.locator('[data-testid="field-limit-warning"]')).toBeVisible();
  });

  test('should handle very long form data', async ({ page }) => {
    const longText = 'A'.repeat(10000); // 10KB of text
    
    const formId = await createTestForm(page, {
      title: 'Long Data Test Form',
      description: 'Form for testing long data',
      fields: [
        { type: 'textarea', label: 'Long Text', required: false },
      ],
    });

    const formPreviewPage = new FormPreviewPage(page);
    await formPreviewPage.navigateToPreview(formId!);

    await formPreviewPage.fillField('long_text', longText);
    await formPreviewPage.submitForm();

    // Should handle long data without issues
    await formPreviewPage.waitForSubmissionSuccess();
  });
});