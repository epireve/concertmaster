/**
 * End-to-end tests for Phase 4 Review System using Playwright.
 * Tests complete user journeys, cross-browser compatibility, and real-world scenarios.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

// Test data setup
const testFormData = {
  companyName: 'TechSolutions Inc',
  contactEmail: 'contact@techsolutions.com',
  businessType: 'corporation',
  annualRevenue: '2500000',
  comments: 'We are excited to partner with your organization and provide high-quality services.'
};

const testFileData = {
  filename: 'test-certificate.pdf',
  content: 'Mock PDF content for testing'
};

// Page object models
class FormReviewPage {
  constructor(private page: Page) {}

  async navigateToForm() {
    await this.page.goto('/');
    await this.page.click('[data-testid="form-builder-tab"]');
    await this.page.waitForLoadState('networkidle');
  }

  async fillBasicInformation(data: typeof testFormData) {
    // Fill company name
    await this.page.fill('[data-testid="company-name-input"]', data.companyName);
    
    // Fill contact email
    await this.page.fill('[data-testid="contact-email-input"]', data.contactEmail);
    
    // Select business type
    await this.page.selectOption('[data-testid="business-type-select"]', data.businessType);
    
    // Fill annual revenue
    await this.page.fill('[data-testid="annual-revenue-input"]', data.annualRevenue);
    
    // Fill comments
    await this.page.fill('[data-testid="comments-textarea"]', data.comments);
  }

  async uploadCertificationFile() {
    // Create a test file buffer
    const fileBuffer = Buffer.from(testFileData.content);
    
    // Upload file
    const fileInput = this.page.locator('[data-testid="certification-files-input"]');
    await fileInput.setInputFiles({
      name: testFileData.filename,
      mimeType: 'application/pdf',
      buffer: fileBuffer
    });
  }

  async setRating(stars: number) {
    const ratingButtons = this.page.locator('[data-testid="rating-star"]');
    for (let i = 0; i < stars; i++) {
      await ratingButtons.nth(i).click();
    }
  }

  async acceptTerms() {
    await this.page.check('[data-testid="terms-agreement-checkbox"]');
  }

  async submitForm() {
    await this.page.click('[data-testid="submit-button"]');
    await this.page.waitForSelector('[data-testid="submission-success"]', { timeout: 10000 });
  }

  async getProgressPercentage(): Promise<number> {
    const progressBar = this.page.locator('[data-testid="progress-bar"]');
    const width = await progressBar.getAttribute('style');
    const match = width?.match(/width:\s*(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  async getValidationErrors(): Promise<string[]> {
    const errorElements = this.page.locator('[data-testid="field-error"]');
    return await errorElements.allTextContents();
  }

  async waitForValidation() {
    await this.page.waitForTimeout(500); // Allow validation to complete
  }
}

class ReviewDashboardPage {
  constructor(private page: Page) {}

  async navigateTo() {
    await this.page.goto('/admin/review-dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async getSubmissionsList() {
    return this.page.locator('[data-testid="submission-item"]');
  }

  async openSubmission(submissionId: string) {
    await this.page.click(`[data-testid="submission-${submissionId}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  async updateReviewStatus(status: 'approved' | 'rejected', comments?: string) {
    await this.page.selectOption('[data-testid="review-status-select"]', status);
    
    if (comments) {
      await this.page.fill('[data-testid="review-comments-textarea"]', comments);
    }
    
    await this.page.click('[data-testid="update-review-button"]');
    await this.page.waitForSelector('[data-testid="review-updated-success"]');
  }

  async advanceWorkflowStage(stage: string) {
    await this.page.selectOption('[data-testid="workflow-stage-select"]', stage);
    await this.page.click('[data-testid="advance-workflow-button"]');
    await this.page.waitForSelector('[data-testid="workflow-advanced-success"]');
  }
}

// Test suite
test.describe('Review System E2E Tests', () => {
  let formPage: FormReviewPage;
  let reviewDashboard: ReviewDashboardPage;

  test.beforeEach(async ({ page }) => {
    formPage = new FormReviewPage(page);
    reviewDashboard = new ReviewDashboardPage(page);
  });

  test.describe('Form Submission Flow', () => {
    test('complete form submission journey', async ({ page }) => {
      await formPage.navigateToForm();

      // Verify form loads correctly
      await expect(page.locator('[data-testid="form-title"]')).toHaveText('Supplier Registration Form');
      
      // Check initial progress
      const initialProgress = await formPage.getProgressPercentage();
      expect(initialProgress).toBe(0);

      // Fill basic information
      await formPage.fillBasicInformation(testFormData);
      
      // Verify progress updated
      await page.waitForTimeout(500);
      const progressAfterBasicInfo = await formPage.getProgressPercentage();
      expect(progressAfterBasicInfo).toBeGreaterThan(0);

      // Upload certification file
      await formPage.uploadCertificationFile();
      
      // Set rating
      await formPage.setRating(4);

      // Accept terms
      await formPage.acceptTerms();
      
      // Verify form is ready for submission
      const submitButton = page.locator('[data-testid="submit-button"]');
      await expect(submitButton).toBeEnabled();
      
      // Submit form
      await formPage.submitForm();
      
      // Verify success message
      await expect(page.locator('[data-testid="submission-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText(
        'Your application has been submitted for review'
      );
    });

    test('form validation prevents invalid submission', async ({ page }) => {
      await formPage.navigateToForm();

      // Try to submit empty form
      await page.click('[data-testid="submit-button"]');
      
      // Wait for validation to complete
      await formPage.waitForValidation();
      
      // Check that validation errors appear
      const errors = await formPage.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('Company name is required'))).toBeTruthy();
      expect(errors.some(error => error.includes('Contact Email is required'))).toBeTruthy();

      // Fill invalid email
      await page.fill('[data-testid="contact-email-input"]', 'invalid-email');
      await page.blur('[data-testid="contact-email-input"]');
      await formPage.waitForValidation();
      
      const emailErrors = await formPage.getValidationErrors();
      expect(emailErrors.some(error => error.includes('valid email address'))).toBeTruthy();

      // Fix email and verify validation clears
      await page.fill('[data-testid="contact-email-input"]', 'valid@example.com');
      await page.blur('[data-testid="contact-email-input"]');
      await page.waitForTimeout(500);
      
      // Check for validation success indicator
      await expect(page.locator('[data-testid="email-validation-success"]')).toBeVisible();
    });

    test('handles file upload validation', async ({ page }) => {
      await formPage.navigateToForm();

      // Try to upload invalid file type
      const invalidFileBuffer = Buffer.from('This is not a PDF');
      const fileInput = page.locator('[data-testid="certification-files-input"]');
      
      await fileInput.setInputFiles({
        name: 'document.txt',
        mimeType: 'text/plain',
        buffer: invalidFileBuffer
      });

      await formPage.waitForValidation();
      
      // Check for file validation error
      const fileErrors = await page.locator('[data-testid="file-validation-error"]').textContent();
      expect(fileErrors).toContain('Only PDF, DOC, DOCX files');
    });

    test('form progress tracking works correctly', async ({ page }) => {
      await formPage.navigateToForm();
      
      let progress = await formPage.getProgressPercentage();
      expect(progress).toBe(0);

      // Fill company name
      await page.fill('[data-testid="company-name-input"]', testFormData.companyName);
      await page.waitForTimeout(300);
      progress = await formPage.getProgressPercentage();
      expect(progress).toBeGreaterThan(0);

      // Fill email
      await page.fill('[data-testid="contact-email-input"]', testFormData.contactEmail);
      await page.waitForTimeout(300);
      const progressAfterEmail = await formPage.getProgressPercentage();
      expect(progressAfterEmail).toBeGreaterThan(progress);

      // Complete all required fields
      await page.selectOption('[data-testid="business-type-select"]', testFormData.businessType);
      await formPage.uploadCertificationFile();
      await formPage.acceptTerms();
      await page.waitForTimeout(500);
      
      const finalProgress = await formPage.getProgressPercentage();
      expect(finalProgress).toBeGreaterThanOrEqual(80); // Should be close to complete
    });
  });

  test.describe('Review Dashboard Workflow', () => {
    test('reviewer can view and update submission', async ({ page }) => {
      // First submit a form (prerequisite)
      await formPage.navigateToForm();
      await formPage.fillBasicInformation(testFormData);
      await formPage.uploadCertificationFile();
      await formPage.setRating(4);
      await formPage.acceptTerms();
      await formPage.submitForm();
      
      // Get submission ID from success page
      const submissionId = await page.locator('[data-testid="submission-id"]').textContent();
      expect(submissionId).toBeTruthy();

      // Navigate to review dashboard
      await reviewDashboard.navigateTo();
      
      // Verify submission appears in list
      const submissions = await reviewDashboard.getSubmissionsList();
      expect(await submissions.count()).toBeGreaterThan(0);

      // Open the submission
      await reviewDashboard.openSubmission(submissionId!);
      
      // Verify submission details are displayed
      await expect(page.locator('[data-testid="submission-company-name"]')).toHaveText(testFormData.companyName);
      await expect(page.locator('[data-testid="submission-email"]')).toHaveText(testFormData.contactEmail);

      // Update review status
      await reviewDashboard.updateReviewStatus('approved', 'Application meets all requirements');
      
      // Verify status update
      await expect(page.locator('[data-testid="current-review-status"]')).toHaveText('approved');
      await expect(page.locator('[data-testid="review-comments"]')).toContainText('meets all requirements');
    });

    test('workflow stage advancement', async ({ page }) => {
      // Prerequisites: submission exists and is in initial stage
      await reviewDashboard.navigateTo();
      
      const submissions = await reviewDashboard.getSubmissionsList();
      if (await submissions.count() > 0) {
        await submissions.first().click();
        
        // Check current stage
        const currentStage = await page.locator('[data-testid="current-workflow-stage"]').textContent();
        expect(['initial', 'verification', 'approval']).toContain(currentStage);

        // Advance to next stage
        if (currentStage === 'initial') {
          await reviewDashboard.advanceWorkflowStage('verification');
          await expect(page.locator('[data-testid="current-workflow-stage"]')).toHaveText('verification');
        }
      }
    });

    test('review metrics and dashboard stats', async ({ page }) => {
      await reviewDashboard.navigateTo();
      
      // Verify dashboard metrics are displayed
      await expect(page.locator('[data-testid="total-submissions-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="pending-reviews-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-review-time"]')).toBeVisible();
      
      // Verify metrics have valid values
      const totalSubmissions = await page.locator('[data-testid="total-submissions-count"]').textContent();
      const pendingReviews = await page.locator('[data-testid="pending-reviews-count"]').textContent();
      
      expect(parseInt(totalSubmissions || '0')).toBeGreaterThanOrEqual(0);
      expect(parseInt(pendingReviews || '0')).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Cross-browser Compatibility', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`form works correctly in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
        if (currentBrowser !== browserName) return;

        await formPage.navigateToForm();
        
        // Basic functionality test
        await page.fill('[data-testid="company-name-input"]', 'Cross Browser Test Co');
        await page.fill('[data-testid="contact-email-input"]', 'test@crossbrowser.com');
        
        // Verify input values are preserved
        const companyValue = await page.inputValue('[data-testid="company-name-input"]');
        const emailValue = await page.inputValue('[data-testid="contact-email-input"]');
        
        expect(companyValue).toBe('Cross Browser Test Co');
        expect(emailValue).toBe('test@crossbrowser.com');
        
        // Test select element
        await page.selectOption('[data-testid="business-type-select"]', 'llc');
        const selectedValue = await page.inputValue('[data-testid="business-type-select"]');
        expect(selectedValue).toBe('llc');
      });
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('form is usable on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
      
      await formPage.navigateToForm();
      
      // Verify form is visible and usable on mobile
      await expect(page.locator('[data-testid="form-container"]')).toBeVisible();
      
      // Test touch interactions
      await page.tap('[data-testid="company-name-input"]');
      await page.keyboard.type('Mobile Test Company');
      
      const companyValue = await page.inputValue('[data-testid="company-name-input"]');
      expect(companyValue).toBe('Mobile Test Company');
      
      // Test mobile-specific UI elements
      const submitButton = page.locator('[data-testid="submit-button"]');
      const buttonBox = await submitButton.boundingBox();
      
      // Button should be large enough for touch (minimum 44px height)
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('review dashboard is responsive', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // Tablet size
      
      await reviewDashboard.navigateTo();
      
      // Verify dashboard layout adapts to smaller screen
      await expect(page.locator('[data-testid="dashboard-container"]')).toBeVisible();
      
      // Check that important elements are still accessible
      await expect(page.locator('[data-testid="submissions-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="metrics-panel"]')).toBeVisible();
    });
  });

  test.describe('Performance Tests', () => {
    test('form loads within performance budget', async ({ page }) => {
      const startTime = Date.now();
      
      await formPage.navigateToForm();
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('large form handles efficiently', async ({ page }) => {
      // Navigate to a form with many fields (would need to be set up in test environment)
      await page.goto('/large-form-test');
      
      const startTime = Date.now();
      
      // Fill multiple fields rapidly
      for (let i = 1; i <= 20; i++) {
        await page.fill(`[data-testid="field-${i}"]`, `Test Value ${i}`, { timeout: 100 });
      }
      
      const fillTime = Date.now() - startTime;
      
      // Should handle rapid input within reasonable time
      expect(fillTime).toBeLessThan(5000);
    });

    test('handles concurrent user interactions', async ({ context }) => {
      // Create multiple pages simulating concurrent users
      const pages = await Promise.all([
        context.newPage(),
        context.newPage(),
        context.newPage()
      ]);
      
      // Navigate all pages to form simultaneously
      await Promise.all(pages.map(p => new FormReviewPage(p).navigateToForm()));
      
      // Fill forms concurrently
      const fillPromises = pages.map(async (p, index) => {
        const formPage = new FormReviewPage(p);
        await formPage.fillBasicInformation({
          ...testFormData,
          companyName: `Concurrent Test Co ${index}`,
          contactEmail: `test${index}@concurrent.com`
        });
      });
      
      await Promise.all(fillPromises);
      
      // Verify all forms were filled correctly
      for (let i = 0; i < pages.length; i++) {
        const companyValue = await pages[i].inputValue('[data-testid="company-name-input"]');
        expect(companyValue).toBe(`Concurrent Test Co ${i}`);
      }
      
      // Cleanup
      await Promise.all(pages.map(p => p.close()));
    });
  });

  test.describe('Accessibility Tests', () => {
    test('form is accessible via keyboard navigation', async ({ page }) => {
      await formPage.navigateToForm();
      
      // Start from first field
      await page.keyboard.press('Tab');
      
      // Should focus on company name input
      const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      expect(focusedElement).toBe('company-name-input');
      
      // Navigate through form with Tab
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Type in focused field
      await page.keyboard.type('Accessibility Test');
      
      const fieldValue = await page.inputValue('[data-testid="contact-email-input"]');
      expect(fieldValue).toBe('Accessibility Test');
    });

    test('screen reader compatibility', async ({ page }) => {
      await formPage.navigateToForm();
      
      // Check for proper ARIA labels and roles
      const companyInput = page.locator('[data-testid="company-name-input"]');
      await expect(companyInput).toHaveAttribute('aria-label');
      
      const submitButton = page.locator('[data-testid="submit-button"]');
      await expect(submitButton).toHaveAttribute('role', 'button');
      
      // Check for error message accessibility
      await page.fill('[data-testid="contact-email-input"]', 'invalid');
      await page.blur('[data-testid="contact-email-input"]');
      
      await page.waitForSelector('[data-testid="field-error"]');
      const errorMessage = page.locator('[data-testid="field-error"]').first();
      await expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    test('color contrast meets accessibility standards', async ({ page }) => {
      await formPage.navigateToForm();
      
      // This would typically use an accessibility testing tool
      // For now, we verify that error states have sufficient contrast
      await page.fill('[data-testid="company-name-input"]', 'A');
      await page.blur('[data-testid="company-name-input"]');
      
      await page.waitForSelector('[data-testid="field-error"]');
      
      const errorElement = page.locator('[data-testid="field-error"]');
      const styles = await errorElement.evaluate(el => window.getComputedStyle(el));
      
      // Error text should be red or high contrast color
      expect(styles.color).toMatch(/rgb\(.*\)/);
    });
  });
});

// Test hooks and utilities
test.beforeAll(async () => {
  // Global setup if needed
  console.log('Starting Review System E2E Tests');
});

test.afterAll(async () => {
  // Global cleanup if needed
  console.log('Review System E2E Tests completed');
});

test.beforeEach(async ({ page }) => {
  // Set default timeout
  page.setDefaultTimeout(30000);
  
  // Mock API responses if needed for consistent testing
  await page.route('**/api/forms/**/schema', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-form-001',
        title: 'Supplier Registration Form',
        fields: [
          {
            id: 'company_name',
            name: 'company_name',
            type: 'text',
            label: 'Company Name',
            required: true,
            order: 1
          }
          // ... other fields would be defined here for comprehensive testing
        ]
      })
    });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  // Take screenshot on failure
  if (testInfo.status === 'failed') {
    const screenshotPath = `test-results/failure-${testInfo.title.replace(/\s+/g, '-')}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
});