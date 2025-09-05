/**
 * Comprehensive End-to-End Form User Journey Tests
 * Testing complete user workflows from form creation to submission
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { FormBuilder, FormPreview } from '../page-objects/form-pages';
import { ApiClient } from '../utils/api-client';
import { TestDataGenerator } from '../utils/test-data-generator';
import { AccessibilityHelper } from '../utils/accessibility-helper';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  viewport: { width: 1280, height: 720 },
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
};

test.describe('Comprehensive Form User Journeys', () => {
  let apiClient: ApiClient;
  let testData: TestDataGenerator;
  let a11yHelper: AccessibilityHelper;

  test.beforeAll(async () => {
    apiClient = new ApiClient(TEST_CONFIG.apiBaseUrl);
    testData = new TestDataGenerator();
    a11yHelper = new AccessibilityHelper();
  });

  test.beforeEach(async ({ page, context }) => {
    // Set viewport and basic configuration
    await page.setViewportSize(TEST_CONFIG.viewport);
    
    // Enable detailed console logging for debugging
    page.on('console', msg => console.log(`Browser Console: ${msg.text()}`));
    page.on('pageerror', error => console.error(`Page Error: ${error.message}`));
    
    // Set up request/response logging
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`API Request: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`API Response: ${response.status()} ${response.url()}`);
      }
    });
  });

  test.describe('Form Builder Journey', () => {
    test('Complete form creation workflow', async ({ page }) => {
      const formBuilder = new FormBuilder(page);
      
      // Navigate to form builder
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/builder`);
      await expect(page).toHaveTitle(/Form Builder/);
      
      // Check initial state
      await expect(formBuilder.titleInput).toHaveValue('Untitled Form');
      await expect(formBuilder.canvas).toContainText('Start building your form');
      
      // Create comprehensive form
      const formData = testData.generateCompleteFormData();
      
      // Set form title and description
      await formBuilder.setFormTitle(formData.title);
      await formBuilder.setFormDescription(formData.description);
      
      // Add various field types
      for (const field of formData.fields) {
        await formBuilder.addField(field.type, field.config);
        
        // Verify field was added
        await expect(formBuilder.getFieldElement(field.id)).toBeVisible();
        
        // Configure field properties
        await formBuilder.configureField(field.id, field.properties);
      }
      
      // Add form sections
      for (const section of formData.sections) {
        await formBuilder.addSection(section.title);
        await formBuilder.configureSectionProperties(section.title, section.properties);
      }
      
      // Configure form settings
      await formBuilder.openSettings();
      await formBuilder.configureFormSettings(formData.settings);
      await formBuilder.closeSettings();
      
      // Preview form
      await formBuilder.previewForm();
      
      // Verify form preview renders correctly
      const formPreview = new FormPreview(page);
      await expect(formPreview.formTitle).toHaveText(formData.title);
      await expect(formPreview.formDescription).toHaveText(formData.description);
      
      // Verify all fields are present
      for (const field of formData.fields) {
        await expect(formPreview.getFieldByLabel(field.properties.label)).toBeVisible();
      }
      
      // Return to builder
      await formPreview.exitPreview();
      
      // Save form
      await formBuilder.saveForm();
      
      // Verify save success
      await expect(page.locator('.toast')).toContainText('Form saved successfully');
    });

    test('Form builder accessibility compliance', async ({ page }) => {
      const formBuilder = new FormBuilder(page);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/builder`);
      
      // Run accessibility audit
      const violations = await a11yHelper.auditPage(page);
      expect(violations.length).toBe(0);
      
      // Test keyboard navigation
      await formBuilder.testKeyboardNavigation();
      
      // Test screen reader compatibility
      await a11yHelper.testScreenReaderLabels(page);
      
      // Test focus management
      await formBuilder.testFocusManagement();
      
      // Test color contrast
      await a11yHelper.testColorContrast(page);
    });

    test('Form builder performance with large forms', async ({ page }) => {
      const formBuilder = new FormBuilder(page);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/builder`);
      
      // Create form with many fields
      const largeFormData = testData.generateLargeFormData(50);
      
      const startTime = Date.now();
      
      // Add all fields
      for (const field of largeFormData.fields) {
        await formBuilder.addField(field.type, field.config);
      }
      
      const buildTime = Date.now() - startTime;
      console.log(`Form build time for 50 fields: ${buildTime}ms`);
      
      // Performance should be reasonable
      expect(buildTime).toBeLessThan(10000); // Less than 10 seconds
      
      // Test form rendering performance
      const renderStart = Date.now();
      await formBuilder.previewForm();
      const renderTime = Date.now() - renderStart;
      
      console.log(`Form render time: ${renderTime}ms`);
      expect(renderTime).toBeLessThan(3000); // Less than 3 seconds
    });
  });

  test.describe('Form Submission Journey', () => {
    test('Complete form submission workflow', async ({ page }) => {
      // First, create a form to submit
      const formData = testData.generateContactFormData();
      const createdForm = await apiClient.createForm(formData);
      
      // Navigate to the form
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      const formPreview = new FormPreview(page);
      
      // Verify form loads correctly
      await expect(formPreview.formTitle).toHaveText(formData.title);
      await expect(formPreview.submitButton).toBeVisible();
      
      // Fill out the form
      const submissionData = testData.generateFormSubmissionData(formData);
      
      for (const [fieldId, value] of Object.entries(submissionData)) {
        const field = formData.fields.find(f => f.id === fieldId);
        await formPreview.fillField(field.type, fieldId, value);
      }
      
      // Verify form validation
      await formPreview.triggerValidation();
      
      // Should have no validation errors for valid data
      const validationErrors = await formPreview.getValidationErrors();
      expect(validationErrors).toHaveLength(0);
      
      // Submit form
      await formPreview.submitForm();
      
      // Verify submission success
      await expect(page.locator('.success-message')).toBeVisible();
      await expect(page.locator('.success-message')).toContainText('Thank you for your submission');
      
      // Verify submission was saved via API
      const submissions = await apiClient.getFormSubmissions(createdForm.id);
      expect(submissions).toHaveLength(1);
      
      const submission = submissions[0];
      for (const [fieldId, expectedValue] of Object.entries(submissionData)) {
        expect(submission.data[fieldId]).toBe(expectedValue);
      }
    });

    test('Form validation error handling', async ({ page }) => {
      const formData = testData.generateValidationTestFormData();
      const createdForm = await apiClient.createForm(formData);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      const formPreview = new FormPreview(page);
      
      // Try to submit empty form
      await formPreview.submitForm();
      
      // Should show validation errors
      const validationErrors = await formPreview.getValidationErrors();
      expect(validationErrors.length).toBeGreaterThan(0);
      
      // Verify specific error messages
      const requiredFields = formData.fields.filter(f => f.required);
      for (const field of requiredFields) {
        await expect(page.locator(`[data-field-id="${field.id}"] .error`))
          .toContainText('required');
      }
      
      // Test individual field validation
      const emailField = formData.fields.find(f => f.type === 'email');
      if (emailField) {
        await formPreview.fillField('email', emailField.id, 'invalid-email');
        await formPreview.triggerValidation();
        
        await expect(page.locator(`[data-field-id="${emailField.id}"] .error`))
          .toContainText('valid email');
      }
      
      // Test pattern validation
      const patternField = formData.fields.find(f => f.validation?.pattern);
      if (patternField) {
        await formPreview.fillField('text', patternField.id, 'invalid123');
        await formPreview.triggerValidation();
        
        await expect(page.locator(`[data-field-id="${patternField.id}"] .error`))
          .toBeVisible();
      }
    });

    test('File upload workflow', async ({ page }) => {
      const formData = testData.generateFileUploadFormData();
      const createdForm = await apiClient.createForm(formData);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      const formPreview = new FormPreview(page);
      
      // Find file upload field
      const fileField = formData.fields.find(f => f.type === 'file');
      const fileUploadElement = page.locator(`[data-field-id="${fileField.id}"] input[type="file"]`);
      
      // Upload valid file
      const testFilePath = await testData.createTestFile('document.pdf', 'application/pdf');
      await fileUploadElement.setInputFiles(testFilePath);
      
      // Verify file upload progress
      await expect(page.locator('.upload-progress')).toBeVisible();
      await expect(page.locator('.upload-success')).toBeVisible();
      
      // Verify file appears in form
      await expect(page.locator('.uploaded-file')).toContainText('document.pdf');
      
      // Test file validation
      const invalidFilePath = await testData.createTestFile('malicious.exe', 'application/x-executable');
      await fileUploadElement.setInputFiles(invalidFilePath);
      
      // Should show error for invalid file type
      await expect(page.locator('.upload-error')).toContainText('file type not allowed');
      
      // Complete form submission with valid file
      const validFilePath = await testData.createTestFile('resume.pdf', 'application/pdf');
      await fileUploadElement.setInputFiles(validFilePath);
      
      await expect(page.locator('.upload-success')).toBeVisible();
      
      // Fill other required fields
      await formPreview.fillField('text', 'name', 'John Doe');
      await formPreview.fillField('email', 'email', 'john@example.com');
      
      // Submit form
      await formPreview.submitForm();
      
      // Verify submission includes file
      await expect(page.locator('.success-message')).toBeVisible();
      
      const submissions = await apiClient.getFormSubmissions(createdForm.id);
      expect(submissions[0].data.resume).toBeDefined();
    });
  });

  test.describe('Multi-step Form Journey', () => {
    test('Complete multi-step form workflow', async ({ page }) => {
      const formData = testData.generateMultiStepFormData();
      const createdForm = await apiClient.createForm(formData);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      const formPreview = new FormPreview(page);
      
      // Verify progress indicator
      await expect(page.locator('.progress-bar')).toBeVisible();
      await expect(page.locator('.step-indicator')).toContainText('Step 1 of 3');
      
      // Step 1: Personal Information
      await expect(page.locator('.step-title')).toContainText('Personal Information');
      
      await formPreview.fillField('text', 'firstName', 'John');
      await formPreview.fillField('text', 'lastName', 'Doe');
      await formPreview.fillField('email', 'email', 'john.doe@example.com');
      
      // Next step
      await page.locator('.next-button').click();
      
      // Verify step 2
      await expect(page.locator('.step-indicator')).toContainText('Step 2 of 3');
      await expect(page.locator('.step-title')).toContainText('Contact Information');
      
      await formPreview.fillField('phone', 'phone', '+1234567890');
      await formPreview.fillField('textarea', 'address', '123 Main St, City, State 12345');
      
      // Test back navigation
      await page.locator('.back-button').click();
      
      // Should return to step 1 with data preserved
      await expect(page.locator('.step-indicator')).toContainText('Step 1 of 3');
      await expect(page.locator('[data-field-id="firstName"] input')).toHaveValue('John');
      
      // Continue to step 2 and 3
      await page.locator('.next-button').click();
      await page.locator('.next-button').click();
      
      // Step 3: Preferences
      await expect(page.locator('.step-title')).toContainText('Preferences');
      
      await formPreview.fillField('select', 'country', 'usa');
      await formPreview.fillField('checkbox', 'newsletter', true);
      
      // Submit final form
      await formPreview.submitForm();
      
      // Verify submission
      await expect(page.locator('.success-message')).toBeVisible();
      
      const submissions = await apiClient.getFormSubmissions(createdForm.id);
      const submission = submissions[0];
      
      expect(submission.data.firstName).toBe('John');
      expect(submission.data.lastName).toBe('Doe');
      expect(submission.data.email).toBe('john.doe@example.com');
      expect(submission.data.phone).toBe('+1234567890');
      expect(submission.data.country).toBe('usa');
      expect(submission.data.newsletter).toBe(true);
    });

    test('Multi-step form validation and error handling', async ({ page }) => {
      const formData = testData.generateMultiStepFormData();
      const createdForm = await apiClient.createForm(formData);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      // Try to advance without filling required fields
      await page.locator('.next-button').click();
      
      // Should show validation errors and stay on step 1
      await expect(page.locator('.step-indicator')).toContainText('Step 1 of 3');
      await expect(page.locator('.error')).toBeVisible();
      
      // Fill minimum required fields
      await page.fill('[data-field-id="firstName"] input', 'John');
      await page.fill('[data-field-id="email"] input', 'john@example.com');
      
      // Should now be able to advance
      await page.locator('.next-button').click();
      await expect(page.locator('.step-indicator')).toContainText('Step 2 of 3');
    });
  });

  test.describe('Form Analytics Journey', () => {
    test('Form view and submission tracking', async ({ page }) => {
      const formData = testData.generateAnalyticsFormData();
      const createdForm = await apiClient.createForm(formData);
      
      // View form multiple times
      for (let i = 0; i < 3; i++) {
        await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
        await page.waitForLoadState('networkidle');
      }
      
      // Submit form once
      const formPreview = new FormPreview(page);
      await formPreview.fillField('text', 'name', 'Test User');
      await formPreview.fillField('email', 'email', 'test@example.com');
      await formPreview.submitForm();
      
      // Check analytics data
      const analytics = await apiClient.getFormAnalytics(createdForm.id);
      
      expect(analytics.views).toBeGreaterThanOrEqual(3);
      expect(analytics.submissions).toBe(1);
      expect(analytics.conversionRate).toBeGreaterThan(0);
    });
  });

  test.describe('Form Collaboration Journey', () => {
    test('Multiple users editing form simultaneously', async ({ page, context }) => {
      // Create initial form
      const formData = testData.generateCollaborationFormData();
      const createdForm = await apiClient.createForm(formData);
      
      // Open form in first browser context
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/builder/${createdForm.id}`);
      
      // Open form in second browser context
      const secondContext = await context.browser().newContext();
      const secondPage = await secondContext.newPage();
      await secondPage.goto(`${TEST_CONFIG.frontendUrl}/forms/builder/${createdForm.id}`);
      
      const formBuilder1 = new FormBuilder(page);
      const formBuilder2 = new FormBuilder(secondPage);
      
      // Make changes from first user
      await formBuilder1.addField('text', { label: 'Field from User 1' });
      
      // Make changes from second user
      await formBuilder2.addField('email', { label: 'Field from User 2' });
      
      // Check for collaboration indicators
      await expect(page.locator('.collaboration-indicator')).toBeVisible();
      await expect(secondPage.locator('.collaboration-indicator')).toBeVisible();
      
      // Verify changes are synced
      await page.waitForTimeout(2000); // Wait for sync
      
      await expect(page.locator('[data-field-label="Field from User 2"]')).toBeVisible();
      await expect(secondPage.locator('[data-field-label="Field from User 1"]')).toBeVisible();
      
      await secondContext.close();
    });
  });

  test.describe('Form Security Journey', () => {
    test('CSRF protection workflow', async ({ page }) => {
      const formData = testData.generateSecurityFormData();
      const createdForm = await apiClient.createForm(formData);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      // Verify CSRF token is present
      const csrfToken = await page.locator('input[name="csrf_token"]').getAttribute('value');
      expect(csrfToken).toBeTruthy();
      expect(csrfToken.length).toBeGreaterThan(10);
      
      const formPreview = new FormPreview(page);
      
      // Fill and submit form normally
      await formPreview.fillField('text', 'name', 'Test User');
      await formPreview.submitForm();
      
      // Should succeed with valid token
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('Rate limiting protection', async ({ page }) => {
      const formData = testData.generateSecurityFormData();
      const createdForm = await apiClient.createForm(formData);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      const formPreview = new FormPreview(page);
      
      // Submit multiple times rapidly
      for (let i = 0; i < 10; i++) {
        await formPreview.fillField('text', 'name', `Test User ${i}`);
        await formPreview.submitForm();
        
        if (i < 5) {
          // First few should succeed
          await expect(page.locator('.success-message')).toBeVisible();
        } else {
          // Later submissions should be rate limited
          await expect(page.locator('.error-message')).toContainText('rate limit');
          break;
        }
        
        // Reset form for next submission
        await page.reload();
      }
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`Form functionality in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
        test.skip(currentBrowser !== browserName, `Test specific to ${browserName}`);
        
        const formData = testData.generateCompatibilityFormData();
        const createdForm = await apiClient.createForm(formData);
        
        await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
        
        const formPreview = new FormPreview(page);
        
        // Test all field types work correctly
        for (const field of formData.fields) {
          const testValue = testData.getTestValueForField(field);
          await formPreview.fillField(field.type, field.id, testValue);
          
          // Verify field value was set
          const actualValue = await formPreview.getFieldValue(field.id);
          expect(actualValue).toBe(testValue);
        }
        
        // Test form submission
        await formPreview.submitForm();
        await expect(page.locator('.success-message')).toBeVisible();
        
        // Verify submission data
        const submissions = await apiClient.getFormSubmissions(createdForm.id);
        expect(submissions).toHaveLength(1);
      });
    });
  });

  test.describe('Mobile Responsiveness Journey', () => {
    test('Form interaction on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      const formData = testData.generateMobileFormData();
      const createdForm = await apiClient.createForm(formData);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      const formPreview = new FormPreview(page);
      
      // Verify mobile-friendly layout
      await expect(page.locator('.form-container')).toHaveCSS('max-width', '100%');
      
      // Test touch interactions
      await formPreview.fillField('text', 'name', 'Mobile User');
      await formPreview.fillField('email', 'email', 'mobile@example.com');
      
      // Test date picker on mobile
      const dateField = page.locator('[data-field-id="date"] input');
      await dateField.tap();
      
      // Should open mobile-friendly date picker
      await expect(page.locator('.date-picker, input[type="date"]')).toBeVisible();
      
      // Test select field on mobile
      const selectField = page.locator('[data-field-id="category"] select');
      await selectField.tap();
      
      // Submit form
      await formPreview.submitForm();
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('Form builder responsive behavior', async ({ page }) => {
      // Test various viewport sizes
      const viewports = [
        { width: 320, height: 568 }, // iPhone SE
        { width: 375, height: 667 }, // iPhone 8
        { width: 768, height: 1024 }, // iPad
        { width: 1024, height: 768 }, // Desktop
      ];
      
      const formBuilder = new FormBuilder(page);
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`${TEST_CONFIG.frontendUrl}/forms/builder`);
        
        // Verify responsive layout
        await expect(formBuilder.canvas).toBeVisible();
        await expect(formBuilder.toolbar).toBeVisible();
        
        // Test adding fields at different viewport sizes
        await formBuilder.addField('text', { label: `Field at ${viewport.width}x${viewport.height}` });
        
        // Verify field is added correctly
        await expect(page.locator('.form-field').last()).toBeVisible();
      }
    });
  });

  test.describe('Performance Journey', () => {
    test('Form loading performance', async ({ page }) => {
      const formData = testData.generatePerformanceTestForm(20); // 20 fields
      const createdForm = await apiClient.createForm(formData);
      
      // Measure page load time
      const startTime = Date.now();
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      console.log(`Form load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(3000); // Should load in under 3 seconds
      
      // Verify all fields are rendered
      const fieldCount = await page.locator('.form-field').count();
      expect(fieldCount).toBe(20);
    });

    test('Large form submission performance', async ({ page }) => {
      const formData = testData.generateLargeFormData(50);
      const createdForm = await apiClient.createForm(formData);
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/forms/${createdForm.id}`);
      
      const formPreview = new FormPreview(page);
      
      // Fill all fields
      const startFillTime = Date.now();
      for (const field of formData.fields) {
        const testValue = testData.getTestValueForField(field);
        await formPreview.fillField(field.type, field.id, testValue);
      }
      const fillTime = Date.now() - startFillTime;
      
      console.log(`Form fill time: ${fillTime}ms`);
      
      // Submit form and measure time
      const startSubmitTime = Date.now();
      await formPreview.submitForm();
      await expect(page.locator('.success-message')).toBeVisible();
      const submitTime = Date.now() - startSubmitTime;
      
      console.log(`Form submission time: ${submitTime}ms`);
      expect(submitTime).toBeLessThan(10000); // Should submit in under 10 seconds
    });
  });
});

// Cleanup after all tests
test.afterAll(async () => {
  // Clean up any test data created during tests
  console.log('Cleaning up test data...');
  // Implementation depends on your cleanup strategy
});