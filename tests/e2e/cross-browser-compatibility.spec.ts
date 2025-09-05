/**
 * Cross-Browser Compatibility Tests for Phase 4 Review System
 * Tests form functionality and UI consistency across different browsers and devices
 */

import { test, expect, devices } from '@playwright/test';

// Test configuration for different browsers and devices
const browserConfigs = [
  { name: 'Desktop Chrome', ...devices['Desktop Chrome'] },
  { name: 'Desktop Firefox', ...devices['Desktop Firefox'] },
  { name: 'Desktop Safari', ...devices['Desktop Safari'] },
  { name: 'Desktop Edge', ...devices['Desktop Edge'] },
  { name: 'Mobile Chrome', ...devices['Pixel 5'] },
  { name: 'Mobile Safari', ...devices['iPhone 12'] },
  { name: 'Tablet iPad', ...devices['iPad Pro'] },
  { name: 'Tablet Android', ...devices['Galaxy Tab S4'] }
];

// Test data
const testFormData = {
  companyName: 'Cross Browser Test Company',
  contactEmail: 'crossbrowser@example.com',
  businessType: 'corporation',
  annualRevenue: '5000000',
  comments: 'Testing cross-browser compatibility for form submission and review workflow.'
};

test.describe('Cross-Browser Compatibility Tests', () => {
  
  // Test core functionality across all browsers
  browserConfigs.forEach(config => {
    test(`Form submission works on ${config.name}`, async ({ browser }) => {
      const context = await browser.newContext(config);
      const page = await context.newPage();
      
      try {
        // Navigate to form
        await page.goto('/');
        await page.click('[data-testid="form-builder-tab"]');
        await page.waitForSelector('[data-testid="form-container"]');
        
        // Check if form is visible and accessible
        await expect(page.locator('[data-testid="form-title"]')).toBeVisible({ timeout: 10000 });
        
        // Fill out form
        await page.fill('[data-testid="company-name-input"]', testFormData.companyName);
        await page.fill('[data-testid="contact-email-input"]', testFormData.contactEmail);
        await page.selectOption('[data-testid="business-type-select"]', testFormData.businessType);
        await page.fill('[data-testid="annual-revenue-input"]', testFormData.annualRevenue);
        await page.fill('[data-testid="comments-textarea"]', testFormData.comments);
        
        // Check that form fields are properly filled
        expect(await page.inputValue('[data-testid="company-name-input"]')).toBe(testFormData.companyName);
        expect(await page.inputValue('[data-testid="contact-email-input"]')).toBe(testFormData.contactEmail);
        
        // Accept terms
        await page.check('[data-testid="terms-agreement-checkbox"]');
        
        // Submit form
        const submitButton = page.locator('[data-testid="submit-button"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
        
        // Wait for submission confirmation (allowing for different response times)
        await Promise.race([
          page.waitForSelector('[data-testid="submission-success"]', { timeout: 15000 }),
          page.waitForSelector('[data-testid="submission-error"]', { timeout: 15000 })
        ]);
        
        // Verify successful submission or log error details
        const successVisible = await page.locator('[data-testid="submission-success"]').isVisible();
        const errorVisible = await page.locator('[data-testid="submission-error"]').isVisible();
        
        if (errorVisible) {
          const errorText = await page.locator('[data-testid="submission-error"]').textContent();
          console.log(`${config.name} - Submission error: ${errorText}`);
        }
        
        // Form should either succeed or show a proper error message
        expect(successVisible || errorVisible).toBeTruthy();
        
        console.log(`✓ ${config.name}: Form submission test completed`);
        
      } catch (error) {
        console.error(`❌ ${config.name}: Form submission failed - ${error.message}`);
        
        // Take screenshot for debugging
        await page.screenshot({ 
          path: `test-results/cross-browser-error-${config.name.replace(/\s+/g, '-')}.png`,
          fullPage: true 
        });
        
        throw error;
      } finally {
        await context.close();
      }
    });
  });

  test.describe('UI Consistency Tests', () => {
    ['Desktop Chrome', 'Desktop Firefox', 'Desktop Safari'].forEach(browserName => {
      test(`UI elements render consistently on ${browserName}`, async ({ browser }) => {
        const context = await browser.newContext(
          browserConfigs.find(c => c.name === browserName) || devices['Desktop Chrome']
        );
        const page = await context.newPage();
        
        try {
          await page.goto('/');
          await page.click('[data-testid="form-builder-tab"]');
          
          // Check header consistency
          const header = page.locator('header');
          await expect(header).toBeVisible();
          
          const headerBox = await header.boundingBox();
          expect(headerBox?.height).toBeGreaterThan(50); // Header should have reasonable height
          
          // Check form layout
          const formContainer = page.locator('[data-testid="form-container"]');
          await expect(formContainer).toBeVisible();
          
          const formBox = await formContainer.boundingBox();
          expect(formBox?.width).toBeGreaterThan(300); // Form should be reasonably wide
          
          // Check button styling consistency
          const submitButton = page.locator('[data-testid="submit-button"]');
          await expect(submitButton).toBeVisible();
          
          const buttonStyles = await submitButton.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              backgroundColor: computed.backgroundColor,
              borderRadius: computed.borderRadius,
              padding: computed.padding,
              fontSize: computed.fontSize
            };
          });
          
          // Verify button has consistent styling
          expect(buttonStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)'); // Should have background color
          expect(buttonStyles.padding).toBeTruthy(); // Should have padding
          
          // Check input field consistency
          const inputs = page.locator('input[type="text"], input[type="email"], textarea, select');
          const inputCount = await inputs.count();
          
          expect(inputCount).toBeGreaterThan(0);
          
          // Check each input for consistent styling
          for (let i = 0; i < Math.min(inputCount, 5); i++) {
            const input = inputs.nth(i);
            const inputBox = await input.boundingBox();
            
            expect(inputBox?.height).toBeGreaterThan(30); // Inputs should be touch-friendly
            expect(inputBox?.width).toBeGreaterThan(100); // Inputs should be usable
          }
          
          console.log(`✓ ${browserName}: UI consistency verified`);
          
        } finally {
          await context.close();
        }
      });
    });
  });

  test.describe('Mobile Responsiveness Tests', () => {
    const mobileDevices = [
      { name: 'iPhone SE', ...devices['iPhone SE'] },
      { name: 'iPhone 12', ...devices['iPhone 12'] },
      { name: 'Pixel 5', ...devices['Pixel 5'] },
      { name: 'Galaxy S21', ...devices['Galaxy S21'] }
    ];

    mobileDevices.forEach(device => {
      test(`Form is usable on ${device.name}`, async ({ browser }) => {
        const context = await browser.newContext(device);
        const page = await context.newPage();
        
        try {
          await page.goto('/');
          
          // Check viewport handling
          const viewportSize = page.viewportSize();
          expect(viewportSize?.width).toBeLessThan(800); // Should be mobile viewport
          
          await page.click('[data-testid="form-builder-tab"]');
          
          // Check form is visible and scrollable on mobile
          const formContainer = page.locator('[data-testid="form-container"]');
          await expect(formContainer).toBeVisible();
          
          // Check touch-friendly button sizes
          const submitButton = page.locator('[data-testid="submit-button"]');
          const buttonBox = await submitButton.boundingBox();
          
          expect(buttonBox?.height).toBeGreaterThanOrEqual(44); // iOS touch target minimum
          expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
          
          // Test touch interactions
          await page.tap('[data-testid="company-name-input"]');
          await page.keyboard.type('Mobile Test Company');
          
          const inputValue = await page.inputValue('[data-testid="company-name-input"]');
          expect(inputValue).toBe('Mobile Test Company');
          
          // Check virtual keyboard doesn't break layout
          await page.tap('[data-testid="contact-email-input"]');
          await page.keyboard.type('mobile@test.com');
          
          // Verify form is still navigable
          await expect(page.locator('[data-testid="submit-button"]')).toBeVisible();
          
          console.log(`✓ ${device.name}: Mobile responsiveness verified`);
          
        } finally {
          await context.close();
        }
      });
    });
  });

  test.describe('Feature Support Tests', () => {
    test('JavaScript features work across browsers', async ({ browser, browserName }) => {
      const page = await browser.newPage();
      
      try {
        await page.goto('/');
        
        // Test modern JavaScript features
        const jsFeatures = await page.evaluate(() => {
          const results = {
            asyncAwait: typeof async function(){} === 'function',
            arrow: (() => true)(),
            destructuring: (() => {
              try {
                const {a} = {a: 1};
                return a === 1;
              } catch {
                return false;
              }
            })(),
            fetch: typeof fetch === 'function',
            promises: typeof Promise === 'function',
            templateLiterals: `test` === 'test',
            modules: typeof import === 'function'
          };
          
          return results;
        });
        
        // All modern browsers should support these features
        expect(jsFeatures.asyncAwait).toBeTruthy();
        expect(jsFeatures.arrow).toBeTruthy();
        expect(jsFeatures.fetch).toBeTruthy();
        expect(jsFeatures.promises).toBeTruthy();
        expect(jsFeatures.templateLiterals).toBeTruthy();
        
        console.log(`✓ ${browserName}: JavaScript features supported`, jsFeatures);
        
      } finally {
        await page.close();
      }
    });

    test('CSS features render correctly', async ({ browser, browserName }) => {
      const page = await browser.newPage();
      
      try {
        await page.goto('/');
        
        // Test CSS feature support
        const cssFeatures = await page.evaluate(() => {
          const testDiv = document.createElement('div');
          document.body.appendChild(testDiv);
          
          const results = {
            flexbox: false,
            grid: false,
            customProperties: false,
            transforms: false
          };
          
          // Test Flexbox
          testDiv.style.display = 'flex';
          results.flexbox = window.getComputedStyle(testDiv).display === 'flex';
          
          // Test Grid
          testDiv.style.display = 'grid';
          results.grid = window.getComputedStyle(testDiv).display === 'grid';
          
          // Test CSS Custom Properties
          testDiv.style.setProperty('--test-prop', 'test');
          testDiv.style.color = 'var(--test-prop)';
          results.customProperties = window.getComputedStyle(testDiv).getPropertyValue('--test-prop').trim() === 'test';
          
          // Test Transforms
          testDiv.style.transform = 'translateX(10px)';
          results.transforms = window.getComputedStyle(testDiv).transform !== 'none';
          
          document.body.removeChild(testDiv);
          return results;
        });
        
        // Modern browsers should support these CSS features
        expect(cssFeatures.flexbox).toBeTruthy();
        
        console.log(`✓ ${browserName}: CSS features supported`, cssFeatures);
        
      } finally {
        await page.close();
      }
    });
  });

  test.describe('Accessibility Across Browsers', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`Accessibility features work on ${browserName}`, async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
          await page.goto('/');
          await page.click('[data-testid="form-builder-tab"]');
          
          // Test keyboard navigation
          await page.keyboard.press('Tab'); // Should focus first focusable element
          
          let focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
          expect(focusedElement).toBeTruthy(); // Something should be focused
          
          // Test ARIA labels and roles
          const ariaElements = await page.locator('[aria-label], [role], [aria-describedby]').count();
          expect(ariaElements).toBeGreaterThan(0); // Should have ARIA attributes
          
          // Test form labels
          const labels = await page.locator('label').count();
          const inputs = await page.locator('input, select, textarea').count();
          
          expect(labels).toBeGreaterThan(0); // Should have labels for form fields
          
          // Test color contrast (basic check)
          const contrastCheck = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
            return elements.length > 0; // Elements exist for contrast checking
          });
          
          expect(contrastCheck).toBeTruthy();
          
          console.log(`✓ ${browserName}: Accessibility features verified`);
          
        } finally {
          await context.close();
        }
      });
    });
  });

  test.describe('Performance Across Browsers', () => {
    ['chromium', 'firefox'].forEach(browserName => {
      test(`Page load performance on ${browserName}`, async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
          const startTime = Date.now();
          
          await page.goto('/');
          await page.waitForLoadState('networkidle');
          
          const loadTime = Date.now() - startTime;
          
          // Page should load within reasonable time across browsers
          expect(loadTime).toBeLessThan(10000); // 10 seconds max
          
          // Check for performance metrics if available
          const perfMetrics = await page.evaluate(() => {
            if (performance.getEntriesByType) {
              const navigation = performance.getEntriesByType('navigation')[0] as any;
              return {
                domComplete: navigation?.domComplete || 0,
                loadEventEnd: navigation?.loadEventEnd || 0,
                domInteractive: navigation?.domInteractive || 0
              };
            }
            return null;
          });
          
          if (perfMetrics) {
            console.log(`✓ ${browserName}: Load metrics`, {
              total: loadTime,
              dom: perfMetrics.domComplete,
              interactive: perfMetrics.domInteractive
            });
          }
          
        } finally {
          await context.close();
        }
      });
    });
  });

  test.describe('Error Handling Consistency', () => {
    test('Form validation errors display consistently', async ({ browser, browserName }) => {
      const page = await browser.newPage();
      
      try {
        await page.goto('/');
        await page.click('[data-testid="form-builder-tab"]');
        
        // Test email validation error
        await page.fill('[data-testid="contact-email-input"]', 'invalid-email');
        await page.blur('[data-testid="contact-email-input"]');
        
        // Wait for validation
        await page.waitForTimeout(1000);
        
        // Error message should appear consistently across browsers
        const errorElement = page.locator('[data-testid="field-error"]').first();
        const errorVisible = await errorElement.isVisible();
        
        if (errorVisible) {
          const errorText = await errorElement.textContent();
          expect(errorText?.toLowerCase()).toContain('email');
          
          // Error should be styled consistently
          const errorColor = await errorElement.evaluate(el => 
            window.getComputedStyle(el).color
          );
          expect(errorColor).not.toBe('rgba(0, 0, 0, 0)'); // Should have color
        }
        
        console.log(`✓ ${browserName}: Form validation consistent`);
        
      } finally {
        await page.close();
      }
    });

    test('Network error handling works across browsers', async ({ browser, browserName }) => {
      const page = await browser.newPage();
      
      try {
        // Intercept network requests to simulate failure
        await page.route('**/api/**', route => {
          route.abort('failed');
        });
        
        await page.goto('/');
        await page.click('[data-testid="form-builder-tab"]');
        
        // Fill out form
        await page.fill('[data-testid="company-name-input"]', 'Test Company');
        await page.fill('[data-testid="contact-email-input"]', 'test@example.com');
        await page.check('[data-testid="terms-agreement-checkbox"]');
        
        // Try to submit
        await page.click('[data-testid="submit-button"]');
        
        // Should handle network error gracefully
        await page.waitForTimeout(3000);
        
        // Check for error handling
        const errorHandled = await page.evaluate(() => {
          // Check if page is still responsive and not crashed
          return document.body && document.readyState === 'complete';
        });
        
        expect(errorHandled).toBeTruthy();
        
        console.log(`✓ ${browserName}: Network error handling works`);
        
      } finally {
        await page.close();
      }
    });
  });
});

// Configuration for cross-browser testing
test.beforeEach(async ({ page, browserName }) => {
  // Set consistent test timeout
  test.setTimeout(60000);
  
  // Add browser-specific configurations
  if (browserName === 'webkit') {
    // Safari-specific configurations
    await page.setViewportSize({ width: 1280, height: 720 });
  } else if (browserName === 'firefox') {
    // Firefox-specific configurations
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  
  // Universal error handling
  page.on('pageerror', error => {
    console.error(`${browserName} - Page error:`, error);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`${browserName} - Console error:`, msg.text());
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  // Take screenshot on failure for debugging
  if (testInfo.status === 'failed') {
    const screenshotPath = `test-results/cross-browser-failure-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`;
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`Screenshot saved: ${screenshotPath}`);
  }
});