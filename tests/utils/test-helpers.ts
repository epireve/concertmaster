/**
 * Test Utilities and Helpers
 * Shared utilities for comprehensive form testing
 */

import { Page, expect, Locator } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// Form field types and their configurations
export interface FieldConfig {
  id: string;
  type: string;
  label: string;
  required: boolean;
  validation?: Record<string, any>;
  options?: Array<{ label: string; value: string }>;
  properties?: Record<string, any>;
}

export interface FormConfig {
  title: string;
  description?: string;
  fields: FieldConfig[];
  sections?: Array<{ title: string; properties?: Record<string, any> }>;
  settings?: Record<string, any>;
}

/**
 * Test Data Generator for Forms
 */
export class TestDataGenerator {
  /**
   * Generate a complete form configuration
   */
  generateCompleteFormData(): FormConfig {
    return {
      title: 'Comprehensive Test Form',
      description: 'A complete form for testing all functionality',
      fields: [
        {
          id: 'personal_info',
          type: 'text',
          label: 'Full Name',
          required: true,
          validation: { minLength: 2, maxLength: 50 },
          properties: { placeholder: 'Enter your full name' }
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          properties: { placeholder: 'your.email@example.com' }
        },
        {
          id: 'phone',
          type: 'phone',
          label: 'Phone Number',
          required: false,
          properties: { placeholder: '+1 (555) 123-4567' }
        },
        {
          id: 'age',
          type: 'number',
          label: 'Age',
          required: true,
          validation: { min: 18, max: 120 }
        },
        {
          id: 'country',
          type: 'select',
          label: 'Country',
          required: true,
          options: [
            { label: 'United States', value: 'usa' },
            { label: 'Canada', value: 'canada' },
            { label: 'United Kingdom', value: 'uk' },
            { label: 'Germany', value: 'germany' },
            { label: 'France', value: 'france' }
          ]
        },
        {
          id: 'interests',
          type: 'multiselect',
          label: 'Interests',
          required: false,
          options: [
            { label: 'Technology', value: 'technology' },
            { label: 'Sports', value: 'sports' },
            { label: 'Music', value: 'music' },
            { label: 'Travel', value: 'travel' },
            { label: 'Reading', value: 'reading' }
          ]
        },
        {
          id: 'biography',
          type: 'textarea',
          label: 'Tell us about yourself',
          required: false,
          validation: { maxLength: 500 },
          properties: { rows: 4 }
        },
        {
          id: 'newsletter',
          type: 'checkbox',
          label: 'Subscribe to newsletter',
          required: false
        },
        {
          id: 'preferred_contact',
          type: 'radio',
          label: 'Preferred contact method',
          required: true,
          options: [
            { label: 'Email', value: 'email' },
            { label: 'Phone', value: 'phone' },
            { label: 'SMS', value: 'sms' }
          ]
        },
        {
          id: 'birth_date',
          type: 'date',
          label: 'Birth Date',
          required: false
        },
        {
          id: 'website',
          type: 'url',
          label: 'Personal Website',
          required: false,
          properties: { placeholder: 'https://your-website.com' }
        },
        {
          id: 'profile_picture',
          type: 'file',
          label: 'Profile Picture',
          required: false,
          validation: {
            allowedTypes: ['image/jpeg', 'image/png'],
            maxSize: '5MB'
          }
        }
      ],
      sections: [
        { title: 'Personal Information' },
        { title: 'Contact Details' },
        { title: 'Preferences' }
      ],
      settings: {
        submitButtonText: 'Submit Application',
        successMessage: 'Thank you for your application!',
        redirectUrl: '/thank-you',
        emailNotifications: true
      }
    };
  }

  /**
   * Generate a contact form configuration
   */
  generateContactFormData(): FormConfig {
    return {
      title: 'Contact Us',
      description: 'Get in touch with our team',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Your Name',
          required: true,
          validation: { minLength: 2 }
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          required: true
        },
        {
          id: 'subject',
          type: 'select',
          label: 'Subject',
          required: true,
          options: [
            { label: 'General Inquiry', value: 'general' },
            { label: 'Technical Support', value: 'support' },
            { label: 'Sales Question', value: 'sales' },
            { label: 'Bug Report', value: 'bug' }
          ]
        },
        {
          id: 'message',
          type: 'textarea',
          label: 'Message',
          required: true,
          validation: { minLength: 10, maxLength: 1000 }
        },
        {
          id: 'urgent',
          type: 'checkbox',
          label: 'This is urgent',
          required: false
        }
      ]
    };
  }

  /**
   * Generate form data for validation testing
   */
  generateValidationTestFormData(): FormConfig {
    return {
      title: 'Validation Test Form',
      description: 'Form designed to test all validation scenarios',
      fields: [
        {
          id: 'required_text',
          type: 'text',
          label: 'Required Text Field',
          required: true,
          validation: { minLength: 3, maxLength: 20 }
        },
        {
          id: 'pattern_text',
          type: 'text',
          label: 'Pattern Text (letters only)',
          required: true,
          validation: {
            pattern: '^[a-zA-Z\\s]+$',
            errorMessage: 'Only letters and spaces are allowed'
          }
        },
        {
          id: 'email_field',
          type: 'email',
          label: 'Email Field',
          required: true
        },
        {
          id: 'number_range',
          type: 'number',
          label: 'Number (1-100)',
          required: true,
          validation: { min: 1, max: 100 }
        },
        {
          id: 'phone_validation',
          type: 'phone',
          label: 'Phone Number',
          required: true
        },
        {
          id: 'url_validation',
          type: 'url',
          label: 'Website URL',
          required: false
        },
        {
          id: 'date_validation',
          type: 'date',
          label: 'Future Date',
          required: false
        }
      ]
    };
  }

  /**
   * Generate multi-step form configuration
   */
  generateMultiStepFormData(): FormConfig {
    return {
      title: 'Multi-Step Application Form',
      description: 'Complete application in multiple steps',
      fields: [
        // Step 1: Personal Info
        {
          id: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true,
          properties: { section: 'step-1' }
        },
        {
          id: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          properties: { section: 'step-1' }
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          properties: { section: 'step-1' }
        },
        // Step 2: Contact Info
        {
          id: 'phone',
          type: 'phone',
          label: 'Phone Number',
          required: true,
          properties: { section: 'step-2' }
        },
        {
          id: 'address',
          type: 'textarea',
          label: 'Address',
          required: true,
          properties: { section: 'step-2' }
        },
        // Step 3: Preferences
        {
          id: 'country',
          type: 'select',
          label: 'Country',
          required: true,
          options: [
            { label: 'USA', value: 'usa' },
            { label: 'Canada', value: 'canada' },
            { label: 'UK', value: 'uk' }
          ],
          properties: { section: 'step-3' }
        },
        {
          id: 'newsletter',
          type: 'checkbox',
          label: 'Subscribe to newsletter',
          required: false,
          properties: { section: 'step-3' }
        }
      ],
      sections: [
        { title: 'Personal Information', properties: { step: 1 } },
        { title: 'Contact Information', properties: { step: 2 } },
        { title: 'Preferences', properties: { step: 3 } }
      ],
      settings: {
        multiStep: true,
        showProgressBar: true
      }
    };
  }

  /**
   * Generate form submission data
   */
  generateFormSubmissionData(formConfig: FormConfig): Record<string, any> {
    const submissionData: Record<string, any> = {};

    for (const field of formConfig.fields) {
      if (field.required || Math.random() > 0.3) {
        submissionData[field.id] = this.getTestValueForField(field);
      }
    }

    return submissionData;
  }

  /**
   * Get appropriate test value for a field type
   */
  getTestValueForField(field: FieldConfig): any {
    switch (field.type) {
      case 'text':
        return field.id.includes('name') ? 'John Doe' : `Test value for ${field.label}`;
      case 'email':
        return 'test@example.com';
      case 'phone':
        return '+1234567890';
      case 'number':
        const min = field.validation?.min || 1;
        const max = field.validation?.max || 100;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      case 'select':
        return field.options?.[0]?.value || 'option1';
      case 'multiselect':
        return field.options?.slice(0, 2).map(opt => opt.value) || ['option1'];
      case 'radio':
        return field.options?.[0]?.value || 'option1';
      case 'checkbox':
        return Math.random() > 0.5;
      case 'textarea':
        return 'This is a longer test message for textarea fields.';
      case 'date':
        return '2023-06-15';
      case 'datetime':
        return '2023-06-15T10:30:00';
      case 'url':
        return 'https://example.com';
      case 'file':
        return {
          filename: 'test-file.pdf',
          size: 1024 * 100, // 100KB
          type: 'application/pdf'
        };
      default:
        return 'test value';
    }
  }

  /**
   * Generate large form for performance testing
   */
  generateLargeFormData(fieldCount: number): FormConfig {
    const fields: FieldConfig[] = [];
    const fieldTypes = ['text', 'email', 'number', 'select', 'textarea'];

    for (let i = 0; i < fieldCount; i++) {
      const type = fieldTypes[i % fieldTypes.length];
      
      fields.push({
        id: `field_${i}`,
        type,
        label: `Field ${i + 1}`,
        required: i % 3 === 0,
        validation: type === 'number' ? { min: 1, max: 1000 } : undefined,
        options: type === 'select' ? [
          { label: 'Option A', value: 'a' },
          { label: 'Option B', value: 'b' },
          { label: 'Option C', value: 'c' }
        ] : undefined
      });
    }

    return {
      title: `Large Performance Test Form (${fieldCount} fields)`,
      description: 'Form generated for performance testing',
      fields
    };
  }

  /**
   * Create a test file for upload testing
   */
  async createTestFile(filename: string, contentType: string, sizeKB: number = 1): Promise<string> {
    const tempDir = tmpdir();
    const filePath = join(tempDir, filename);
    
    // Generate test content
    let content: Buffer;
    
    if (contentType === 'application/pdf') {
      // Minimal PDF content
      content = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n%%EOF');
    } else if (contentType.startsWith('image/')) {
      // Minimal image content (1x1 pixel)
      content = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE
      ]);
    } else {
      // Text content
      const baseContent = `Test file content for ${filename}`;
      const targetSize = sizeKB * 1024;
      const repeatCount = Math.ceil(targetSize / baseContent.length);
      content = Buffer.from(baseContent.repeat(repeatCount));
    }
    
    // Pad to desired size if needed
    if (content.length < sizeKB * 1024) {
      const padding = Buffer.alloc(sizeKB * 1024 - content.length, 0);
      content = Buffer.concat([content, padding]);
    }
    
    await writeFile(filePath, content);
    return filePath;
  }

  /**
   * Generate malicious file content for security testing
   */
  async createMaliciousTestFile(filename: string): Promise<string> {
    const tempDir = tmpdir();
    const filePath = join(tempDir, filename);
    
    let content: Buffer;
    
    if (filename.endsWith('.exe')) {
      // PE executable header
      content = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
    } else if (filename.includes('script')) {
      // JavaScript content
      content = Buffer.from('<script>alert("XSS")</script>');
    } else {
      // Generic malicious pattern
      content = Buffer.from('MZ\x90\x00malicious content');
    }
    
    await writeFile(filePath, content);
    return filePath;
  }
}

/**
 * API Client for testing backend endpoints
 */
export class ApiClient {
  constructor(private baseUrl: string) {}

  async createForm(formData: FormConfig): Promise<{ id: string; [key: string]: any }> {
    const response = await fetch(`${this.baseUrl}/api/v1/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create form: ${response.status}`);
    }
    
    return response.json();
  }

  async getForm(formId: string): Promise<FormConfig> {
    const response = await fetch(`${this.baseUrl}/api/v1/forms/${formId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get form: ${response.status}`);
    }
    
    return response.json();
  }

  async submitFormResponse(formId: string, data: Record<string, any>): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/forms/${formId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to submit form: ${response.status}`);
    }
    
    return response.json();
  }

  async getFormSubmissions(formId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/forms/${formId}/submissions`);
    
    if (!response.ok) {
      throw new Error(`Failed to get submissions: ${response.status}`);
    }
    
    return response.json();
  }

  async getFormAnalytics(formId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/forms/${formId}/analytics`);
    
    if (!response.ok) {
      throw new Error(`Failed to get analytics: ${response.status}`);
    }
    
    return response.json();
  }

  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${this.baseUrl}/api/v1/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.status}`);
    }
    
    return response.json();
  }
}

/**
 * Accessibility Testing Helper
 */
export class AccessibilityHelper {
  async auditPage(page: Page): Promise<any[]> {
    // Install axe-core if not already installed
    await page.addScriptTag({ 
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js' 
    });
    
    // Run accessibility audit
    const results = await page.evaluate(() => {
      return new Promise((resolve) => {
        (window as any).axe.run((err: any, results: any) => {
          if (err) resolve([]);
          resolve(results.violations || []);
        });
      });
    });
    
    return results as any[];
  }

  async testColorContrast(page: Page): Promise<boolean> {
    const contrastIssues = await page.evaluate(() => {
      const issues: string[] = [];
      const elements = document.querySelectorAll('*');
      
      elements.forEach((el) => {
        const style = window.getComputedStyle(el);
        const textColor = style.color;
        const bgColor = style.backgroundColor;
        
        // Simple contrast check (would need proper color contrast calculation in real implementation)
        if (textColor && bgColor && textColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'rgba(0, 0, 0, 0)') {
          // This is a simplified check - real implementation would calculate actual contrast ratio
          if (textColor === bgColor) {
            issues.push(`Poor contrast: ${textColor} on ${bgColor}`);
          }
        }
      });
      
      return issues;
    });
    
    return contrastIssues.length === 0;
  }

  async testScreenReaderLabels(page: Page): Promise<boolean> {
    const labelIssues = await page.evaluate(() => {
      const issues: string[] = [];
      
      // Check form inputs have labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input, index) => {
        const id = input.id;
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        
        if (!label && !ariaLabel && !ariaLabelledBy) {
          issues.push(`Input ${index} missing label`);
        }
      });
      
      // Check images have alt text
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (!img.alt && !img.getAttribute('aria-label')) {
          issues.push(`Image ${index} missing alt text`);
        }
      });
      
      return issues;
    });
    
    return labelIssues.length === 0;
  }

  async testKeyboardNavigation(page: Page): Promise<boolean> {
    const focusableElements = await page.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    
    if (focusableElements.length === 0) {
      return false;
    }
    
    // Test tab navigation
    for (let i = 0; i < Math.min(5, focusableElements.length); i++) {
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluateHandle(() => document.activeElement);
      
      // Check if an element is focused
      const isFocused = await page.evaluate((element) => {
        return document.activeElement === element;
      }, focusedElement);
      
      if (!isFocused) {
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Form Page Object Model
 */
export class FormBuilder {
  constructor(private page: Page) {}

  get titleInput(): Locator {
    return this.page.locator('[data-testid="form-title-input"]');
  }

  get descriptionInput(): Locator {
    return this.page.locator('[data-testid="form-description-input"]');
  }

  get canvas(): Locator {
    return this.page.locator('[data-testid="form-canvas"]');
  }

  get toolbar(): Locator {
    return this.page.locator('[data-testid="form-toolbar"]');
  }

  async setFormTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
  }

  async setFormDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  async addField(type: string, config: any): Promise<void> {
    const fieldElement = this.page.locator(`[data-field-type="${type}"]`);
    await fieldElement.dragTo(this.canvas);
  }

  getFieldElement(fieldId: string): Locator {
    return this.page.locator(`[data-field-id="${fieldId}"]`);
  }

  async configureField(fieldId: string, properties: any): Promise<void> {
    const field = this.getFieldElement(fieldId);
    await field.click();
    
    // Configure field properties in property panel
    for (const [key, value] of Object.entries(properties)) {
      const input = this.page.locator(`[data-property="${key}"]`);
      if (await input.isVisible()) {
        await input.fill(String(value));
      }
    }
  }

  async previewForm(): Promise<void> {
    await this.page.locator('[data-testid="preview-button"]').click();
  }

  async saveForm(): Promise<void> {
    await this.page.locator('[data-testid="save-button"]').click();
  }

  async openSettings(): Promise<void> {
    await this.page.locator('[data-testid="settings-button"]').click();
  }

  async closeSettings(): Promise<void> {
    await this.page.locator('[data-testid="settings-close"]').click();
  }

  async configureFormSettings(settings: any): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      const input = this.page.locator(`[data-setting="${key}"]`);
      if (await input.isVisible()) {
        await input.fill(String(value));
      }
    }
  }

  async addSection(title: string): Promise<void> {
    await this.page.locator('[data-testid="add-section-button"]').click();
    await this.page.locator('[data-testid="section-title-input"]').fill(title);
    await this.page.locator('[data-testid="confirm-section"]').click();
  }

  async configureSectionProperties(sectionTitle: string, properties: any): Promise<void> {
    const section = this.page.locator(`[data-section-title="${sectionTitle}"]`);
    await section.click();
    
    for (const [key, value] of Object.entries(properties)) {
      const input = this.page.locator(`[data-section-property="${key}"]`);
      if (await input.isVisible()) {
        await input.fill(String(value));
      }
    }
  }

  async testKeyboardNavigation(): Promise<void> {
    // Test keyboard navigation through form builder
    await this.page.keyboard.press('Tab');
    await expect(this.titleInput).toBeFocused();
    
    await this.page.keyboard.press('Tab');
    await expect(this.descriptionInput).toBeFocused();
  }

  async testFocusManagement(): Promise<void> {
    // Test focus management when opening/closing modals
    await this.openSettings();
    
    // Focus should be trapped within settings modal
    const firstInput = this.page.locator('.settings-modal input').first();
    await expect(firstInput).toBeFocused();
    
    await this.closeSettings();
    
    // Focus should return to settings button
    const settingsButton = this.page.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeFocused();
  }
}

export class FormPreview {
  constructor(private page: Page) {}

  get formTitle(): Locator {
    return this.page.locator('[data-testid="form-title"]');
  }

  get formDescription(): Locator {
    return this.page.locator('[data-testid="form-description"]');
  }

  get submitButton(): Locator {
    return this.page.locator('[data-testid="form-submit"]');
  }

  async fillField(fieldType: string, fieldId: string, value: any): Promise<void> {
    const fieldSelector = `[data-field-id="${fieldId}"]`;
    
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
      case 'number':
        await this.page.fill(`${fieldSelector} input`, String(value));
        break;
      case 'textarea':
        await this.page.fill(`${fieldSelector} textarea`, String(value));
        break;
      case 'select':
        await this.page.selectOption(`${fieldSelector} select`, String(value));
        break;
      case 'checkbox':
        if (value) {
          await this.page.check(`${fieldSelector} input[type="checkbox"]`);
        } else {
          await this.page.uncheck(`${fieldSelector} input[type="checkbox"]`);
        }
        break;
      case 'radio':
        await this.page.check(`${fieldSelector} input[value="${value}"]`);
        break;
      case 'date':
        await this.page.fill(`${fieldSelector} input[type="date"]`, String(value));
        break;
      case 'file':
        if (typeof value === 'string') {
          await this.page.setInputFiles(`${fieldSelector} input[type="file"]`, value);
        }
        break;
    }
  }

  async getFieldValue(fieldId: string): Promise<string> {
    const field = this.page.locator(`[data-field-id="${fieldId}"] input, [data-field-id="${fieldId}"] select, [data-field-id="${fieldId}"] textarea`).first();
    return await field.inputValue();
  }

  getFieldByLabel(label: string): Locator {
    return this.page.locator(`label:has-text("${label}")`).locator('..');
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  async triggerValidation(): Promise<void> {
    // Trigger validation by attempting to submit or focusing/blurring fields
    await this.submitButton.click();
  }

  async getValidationErrors(): Promise<string[]> {
    const errorElements = await this.page.locator('.error-message, .field-error').all();
    const errors: string[] = [];
    
    for (const element of errorElements) {
      const text = await element.textContent();
      if (text) {
        errors.push(text.trim());
      }
    }
    
    return errors;
  }

  async exitPreview(): Promise<void> {
    await this.page.locator('[data-testid="exit-preview"]').click();
  }
}

/**
 * Database Test Helper
 */
export class DatabaseTestHelper {
  async cleanupTestData(testId: string): Promise<void> {
    // Implementation would depend on your database setup
    console.log(`Cleaning up test data for: ${testId}`);
  }

  async createTestUser(): Promise<{ id: string; email: string }> {
    const userId = randomBytes(16).toString('hex');
    const email = `test-${userId}@example.com`;
    
    // In a real implementation, this would create a test user in the database
    return { id: userId, email };
  }

  async createTestForm(formData: FormConfig): Promise<{ id: string }> {
    const formId = `test-form-${randomBytes(16).toString('hex')}`;
    
    // In a real implementation, this would create a form in the database
    return { id: formId };
  }
}

/**
 * Wait for condition helper
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}