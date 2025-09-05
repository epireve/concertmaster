/**
 * Cross-Browser Compatibility Tests
 * Testing form functionality across different browsers and devices
 */

import { test, expect, Page, BrowserContext, Browser } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';

// Browser configurations
const browserConfigs = [
  { name: 'Chrome', browser: 'chromium' },
  { name: 'Firefox', browser: 'firefox' },
  { name: 'Safari', browser: 'webkit' },
];

const deviceConfigs = [
  { name: 'Desktop', viewport: { width: 1920, height: 1080 } },
  { name: 'Tablet', viewport: { width: 768, height: 1024 } },
  { name: 'Mobile', viewport: { width: 375, height: 667 } },
];

// Test utilities
class CrossBrowserFormTester {
  constructor(private page: Page) {}

  async createTestForm(title: string = 'Cross-Browser Test Form') {
    await this.page.goto('/forms/builder');
    await this.page.waitForLoadState('networkidle');

    // Create form
    await this.page.fill('[data-testid="form-title-input"]', title);
    
    // Add various field types to test browser compatibility
    const fieldTypes = ['text', 'email', 'number', 'select', 'textarea', 'date', 'file'];
    
    for (const fieldType of fieldTypes) {
      await this.page.click(`[data-testid="field-palette-${fieldType}"]`);
      await this.page.waitForTimeout(200);
    }

    // Save form
    await this.page.click('[data-testid="save-form-button"]');
    await this.page.waitForSelector('[data-testid="save-success-message"]');

    // Get form ID from URL
    const url = this.page.url();
    return url.split('/').pop();
  }

  async testFormRendering() {
    // Check if all elements render correctly
    await expect(this.page.locator('[data-testid="form-canvas"]')).toBeVisible();
    await expect(this.page.locator('input[type="text"]')).toBeVisible();
    await expect(this.page.locator('input[type="email"]')).toBeVisible();
    await expect(this.page.locator('select')).toBeVisible();
    await expect(this.page.locator('textarea')).toBeVisible();
  }

  async testFormInteraction() {
    // Test basic interactions
    await this.page.fill('input[type="text"]', 'Test Input');
    await this.page.fill('input[type="email"]', 'test@example.com');
    await this.page.selectOption('select', { index: 1 });
    await this.page.fill('textarea', 'Test message');

    // Verify values were set
    await expect(this.page.locator('input[type="text"]')).toHaveValue('Test Input');
    await expect(this.page.locator('input[type="email"]')).toHaveValue('test@example.com');
    await expect(this.page.locator('textarea')).toHaveValue('Test message');
  }

  async testFormSubmission() {
    await this.page.click('[data-testid="submit-form-button"]');
    await this.page.waitForSelector('[data-testid="submission-success"]', { timeout: 10000 });
    
    await expect(this.page.locator('[data-testid="submission-success"]')).toBeVisible();
  }
}

// Cross-browser test suite
test.describe('Cross-Browser Compatibility', () => {
  for (const browserConfig of browserConfigs) {
    test.describe(`${browserConfig.name} Browser Tests`, () => {
      let browser: Browser;
      let context: BrowserContext;
      let page: Page;

      test.beforeAll(async () => {
        browser = await (browserConfig.browser as any)().launch();
        context = await browser.newContext();
        page = await context.newPage();
      });

      test.afterAll(async () => {
        await browser.close();
      });

      test('renders form builder correctly', async () => {
        const formTester = new CrossBrowserFormTester(page);
        
        await page.goto('/forms/builder');
        await page.waitForLoadState('networkidle');

        // Check basic elements are present
        await expect(page.locator('[data-testid="form-title-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="field-palette"]')).toBeVisible();
        await expect(page.locator('[data-testid="form-canvas"]')).toBeVisible();

        // Test drag and drop functionality
        const textField = page.locator('[data-testid="field-palette-text"]');
        const canvas = page.locator('[data-testid="form-canvas"]');
        
        await textField.dragTo(canvas);
        await expect(page.locator('[data-testid="field-text"]')).toBeVisible();
      });

      test('handles form field interactions properly', async () => {
        const formTester = new CrossBrowserFormTester(page);
        const formId = await formTester.createTestForm();

        await page.goto(`/forms/${formId}/preview`);
        await formTester.testFormRendering();
        await formTester.testFormInteraction();
      });

      test('validates form fields across browsers', async () => {
        await page.goto('/forms/preview/validation-test');

        // Test HTML5 validation
        const emailInput = page.locator('input[type="email"]');
        await emailInput.fill('invalid-email');
        
        await page.click('[data-testid="submit-form-button"]');

        // Different browsers may show different validation messages
        const isValidationPresent = await page.locator('[data-testid="validation-error"]').isVisible() ||
                                   await page.locator('input:invalid').isVisible();
        
        expect(isValidationPresent).toBe(true);
      });

      test('supports file upload functionality', async () => {
        await page.goto('/forms/preview/file-upload-test');

        // Create a test file
        const fileContent = 'Test file content';
        const fileName = 'test-file.txt';

        await page.setInputFiles('input[type="file"]', {
          name: fileName,
          mimeType: 'text/plain',
          buffer: Buffer.from(fileContent)
        });

        // Verify file was selected
        const fileInput = page.locator('input[type="file"]');
        const files = await fileInput.evaluate((input: HTMLInputElement) => {
          return input.files ? Array.from(input.files).map(f => f.name) : [];
        });

        expect(files).toContain(fileName);
      });

      test('handles date input consistently', async () => {
        await page.goto('/forms/preview/date-test');

        const dateInput = page.locator('input[type="date"]');
        const testDate = '2024-06-15';

        await dateInput.fill(testDate);
        await expect(dateInput).toHaveValue(testDate);
      });

      test('supports CSS Grid and Flexbox layouts', async () => {
        await page.goto('/forms/builder');

        // Check if CSS Grid is supported
        const gridSupported = await page.evaluate(() => {
          return CSS.supports('display', 'grid');
        });

        // Check if Flexbox is supported
        const flexSupported = await page.evaluate(() => {
          return CSS.supports('display', 'flex');
        });

        expect(gridSupported).toBe(true);
        expect(flexSupported).toBe(true);

        // Verify layout renders correctly
        await expect(page.locator('[data-testid="form-layout"]')).toBeVisible();
      });

      test('maintains functionality with JavaScript disabled', async () => {
        // Create context with JavaScript disabled
        const noJsContext = await browser.newContext({ javaScriptEnabled: false });
        const noJsPage = await noJsContext.newPage();

        await noJsPage.goto('/forms/preview/no-js-test');

        // Basic form should still be functional
        await expect(noJsPage.locator('form')).toBeVisible();
        await expect(noJsPage.locator('input[type="text"]')).toBeVisible();
        await expect(noJsPage.locator('button[type="submit"]')).toBeVisible();

        await noJsContext.close();
      });
    });
  }
});

// Responsive design tests
test.describe('Responsive Design Tests', () => {
  for (const device of deviceConfigs) {
    test.describe(`${device.name} Device Tests`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(device.viewport);
      });

      test('adapts form layout for device size', async ({ page }) => {
        await page.goto('/forms/builder');

        // Check if layout adapts to screen size
        const sidebar = page.locator('[data-testid="form-sidebar"]');
        const canvas = page.locator('[data-testid="form-canvas"]');

        if (device.viewport.width < 768) {
          // Mobile: sidebar should be hidden or collapsed
          const sidebarVisible = await sidebar.isVisible();
          if (sidebarVisible) {
            const sidebarWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
            expect(sidebarWidth).toBeLessThan(device.viewport.width * 0.4);
          }
        } else {
          // Desktop/Tablet: sidebar should be visible
          await expect(sidebar).toBeVisible();
        }

        await expect(canvas).toBeVisible();
      });

      test('maintains touch functionality on mobile', async ({ page }) => {
        if (device.viewport.width > 768) {
          test.skip(); // Skip for non-mobile devices
        }

        await page.goto('/forms/preview/touch-test');

        // Test touch interactions
        const button = page.locator('[data-testid="touch-button"]');
        
        // Simulate touch
        await button.tap();
        await expect(page.locator('[data-testid="touch-result"]')).toContainText('touched');
      });

      test('provides adequate touch targets', async ({ page }) => {
        await page.goto('/forms/builder');

        const buttons = page.locator('button');
        const buttonCount = await buttons.count();

        for (let i = 0; i < buttonCount; i++) {
          const button = buttons.nth(i);
          const boundingBox = await button.boundingBox();
          
          if (boundingBox) {
            // Touch targets should be at least 44x44 pixels
            expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            expect(boundingBox.height).toBeGreaterThanOrEqual(44);
          }
        }
      });

      test('handles orientation changes gracefully', async ({ page }) => {
        if (device.viewport.width > 768) {
          test.skip(); // Skip for non-mobile devices
        }

        await page.goto('/forms/builder');

        // Simulate orientation change
        await page.setViewportSize({ 
          width: device.viewport.height, 
          height: device.viewport.width 
        });

        // Form should still be functional
        await expect(page.locator('[data-testid="form-canvas"]')).toBeVisible();
        
        // Revert orientation
        await page.setViewportSize(device.viewport);
      });
    });
  }
});

// Performance tests across browsers
test.describe('Cross-Browser Performance', () => {
  browserConfigs.forEach(browserConfig => {
    test(`measures loading performance in ${browserConfig.name}`, async () => {
      const browser = await (browserConfig.browser as any)().launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate and measure timing
      const startTime = Date.now();
      await page.goto('/forms/builder');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Check performance metrics
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          loadComplete: navigation.loadEventEnd - navigation.navigationStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        };
      });

      // Performance expectations
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
      expect(performanceMetrics.domContentLoaded).toBeLessThan(3000);
      
      if (performanceMetrics.firstContentfulPaint > 0) {
        expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000);
      }

      await browser.close();
    });
  });
});

// Accessibility across browsers
test.describe('Cross-Browser Accessibility', () => {
  browserConfigs.forEach(browserConfig => {
    test(`maintains accessibility in ${browserConfig.name}`, async () => {
      const browser = await (browserConfig.browser as any)().launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/forms/preview/accessibility-test');

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.locator(':focus').getAttribute('data-testid');
      expect(focusedElement).toBeTruthy();

      // Test ARIA attributes
      const form = page.locator('form');
      const ariaLabel = await form.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();

      // Test color contrast (simplified check)
      const textElements = page.locator('label, p, span').first();
      const styles = await textElements.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
        };
      });

      expect(styles.color).toBeTruthy();
      expect(styles.backgroundColor).toBeTruthy();

      await browser.close();
    });
  });
});

// Error handling across browsers
test.describe('Cross-Browser Error Handling', () => {
  browserConfigs.forEach(browserConfig => {
    test(`handles errors gracefully in ${browserConfig.name}`, async () => {
      const browser = await (browserConfig.browser as any)().launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      // Monitor console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Test network error handling
      await page.route('**/api/forms/*', route => route.abort());
      await page.goto('/forms/builder');

      // Form should still render despite API errors
      await expect(page.locator('[data-testid="form-canvas"]')).toBeVisible();

      // Should show user-friendly error message
      const errorMessage = page.locator('[data-testid="error-message"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/unable to load|error occurred/i);
      }

      // Check for JavaScript errors (some might be expected due to network failures)
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('Failed to fetch') && 
        !error.includes('Network request failed')
      );
      
      expect(criticalErrors).toHaveLength(0);

      await browser.close();
    });
  });
});

// Feature detection tests
test.describe('Feature Detection and Polyfills', () => {
  test('detects and handles missing features gracefully', async ({ page }) => {
    await page.goto('/forms/builder');

    // Check feature support
    const features = await page.evaluate(() => {
      return {
        formValidation: 'checkValidity' in document.createElement('input'),
        fileApi: 'FileReader' in window,
        dragAndDrop: 'draggable' in document.createElement('div'),
        localStorage: 'localStorage' in window,
        flexbox: CSS.supports('display', 'flex'),
        grid: CSS.supports('display', 'grid'),
        customProperties: CSS.supports('--test', 'test'),
      };
    });

    // All modern features should be supported
    expect(features.formValidation).toBe(true);
    expect(features.fileApi).toBe(true);
    expect(features.dragAndDrop).toBe(true);
    expect(features.localStorage).toBe(true);
    expect(features.flexbox).toBe(true);
    expect(features.grid).toBe(true);
    expect(features.customProperties).toBe(true);
  });

  test('provides fallbacks for unsupported features', async ({ page }) => {
    // Simulate older browser by disabling features
    await page.addInitScript(() => {
      // Mock missing localStorage
      delete (window as any).localStorage;
      
      // Mock missing File API
      delete (window as any).FileReader;
    });

    await page.goto('/forms/builder');

    // Form should still function with fallbacks
    await expect(page.locator('[data-testid="form-canvas"]')).toBeVisible();
    
    // File upload should show fallback UI
    const fileUploadFallback = page.locator('[data-testid="file-upload-fallback"]');
    if (await fileUploadFallback.isVisible()) {
      await expect(fileUploadFallback).toContainText(/file upload not supported/i);
    }
  });
});

// Security tests across browsers
test.describe('Cross-Browser Security', () => {
  browserConfigs.forEach(browserConfig => {
    test(`enforces security measures in ${browserConfig.name}`, async () => {
      const browser = await (browserConfig.browser as any)().launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/forms/preview/security-test');

      // Test XSS prevention
      const textInput = page.locator('input[type="text"]');
      await textInput.fill('<script>alert("XSS")</script>');

      const inputValue = await textInput.inputValue();
      expect(inputValue).not.toContain('<script>');

      // Test CSRF protection (check for tokens)
      const form = page.locator('form');
      const csrfToken = await form.locator('input[name="_token"]').getAttribute('value');
      
      if (csrfToken) {
        expect(csrfToken).toHaveLength(40); // Typical CSRF token length
      }

      await browser.close();
    });
  });
});

// Print and media query tests
test.describe('Print and Media Compatibility', () => {
  test('handles print styles correctly', async ({ page }) => {
    await page.goto('/forms/preview/print-test');

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Check print-specific styles are applied
    const printHidden = page.locator('[data-print="hide"]');
    if (await printHidden.count() > 0) {
      const isHidden = await printHidden.first().isHidden();
      expect(isHidden).toBe(true);
    }

    // Check print-specific content is visible
    const printVisible = page.locator('[data-print="show"]');
    if (await printVisible.count() > 0) {
      const isVisible = await printVisible.first().isVisible();
      expect(isVisible).toBe(true);
    }
  });

  test('responds to reduced motion preferences', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.goto('/forms/builder');

    // Check that animations are reduced or disabled
    const animatedElement = page.locator('[data-testid="animated-element"]');
    if (await animatedElement.count() > 0) {
      const animationDuration = await animatedElement.evaluate(el => {
        return window.getComputedStyle(el).animationDuration;
      });
      
      // Should be 0s or significantly reduced
      expect(animationDuration).toMatch(/^0s|0\.01s$/);
    }
  });
});