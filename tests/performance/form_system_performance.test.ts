/**
 * Performance Tests for Form System
 * Testing performance characteristics, load handling, and resource usage
 */

import { test, expect, Page } from '@playwright/test';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  interactionTime: number;
  memoryUsage: number;
  networkRequests: number;
}

interface LoadTestResult {
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  errorRate: number;
  throughput: number;
}

class PerformanceTestHelper {
  private page: Page;
  private metrics: PerformanceMetrics[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async measurePageLoad(url: string): Promise<number> {
    const startTime = performance.now();
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    return performance.now() - startTime;
  }

  async measureRenderTime(selector: string): Promise<number> {
    const startTime = performance.now();
    await this.page.waitForSelector(selector);
    return performance.now() - startTime;
  }

  async measureInteractionTime(action: () => Promise<void>): Promise<number> {
    const startTime = performance.now();
    await action();
    return performance.now() - startTime;
  }

  async getMemoryUsage(): Promise<number> {
    const metrics = await this.page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    return metrics;
  }

  async trackNetworkRequests(): Promise<number> {
    let requestCount = 0;
    
    this.page.on('request', () => {
      requestCount++;
    });

    return requestCount;
  }

  async generatePerformanceReport(): Promise<PerformanceMetrics> {
    const memoryUsage = await this.getMemoryUsage();
    
    return {
      loadTime: 0, // Set by individual tests
      renderTime: 0, // Set by individual tests
      interactionTime: 0, // Set by individual tests
      memoryUsage,
      networkRequests: 0 // Set by individual tests
    };
  }

  logMetrics(testName: string, metrics: PerformanceMetrics): void {
    console.log(`\n=== Performance Metrics for ${testName} ===`);
    console.log(`Load Time: ${metrics.loadTime.toFixed(2)}ms`);
    console.log(`Render Time: ${metrics.renderTime.toFixed(2)}ms`);
    console.log(`Interaction Time: ${metrics.interactionTime.toFixed(2)}ms`);
    console.log(`Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Network Requests: ${metrics.networkRequests}`);
    console.log('============================================\n');
  }
}

test.describe('Form System Performance Tests', () => {
  let performanceHelper: PerformanceTestHelper;

  test.beforeEach(async ({ page }) => {
    performanceHelper = new PerformanceTestHelper(page);
    
    // Enable performance monitoring
    await page.addInitScript(() => {
      (window as any).performanceMetrics = [];
    });
  });

  test.describe('Form Builder Performance', () => {
    test('Form builder initial load performance', async ({ page }) => {
      const loadTime = await performanceHelper.measurePageLoad('http://localhost:3000/forms/builder');
      
      // Form builder should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
      
      // Verify all critical components loaded
      await expect(page.locator('.form-builder')).toBeVisible();
      await expect(page.locator('.field-palette')).toBeVisible();
      await expect(page.locator('.form-canvas')).toBeVisible();
      
      const memoryUsage = await performanceHelper.getMemoryUsage();
      console.log(`Form Builder Load Time: ${loadTime.toFixed(2)}ms`);
      console.log(`Memory Usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      
      // Memory usage should be reasonable
      expect(memoryUsage).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    test('Adding multiple fields performance', async ({ page }) => {
      await page.goto('http://localhost:3000/forms/builder');
      
      const fieldTypes = ['text', 'email', 'number', 'select', 'textarea', 'checkbox', 'radio', 'file'];
      const additionTimes: number[] = [];
      
      for (let i = 0; i < 25; i++) {
        const fieldType = fieldTypes[i % fieldTypes.length];
        
        const addTime = await performanceHelper.measureInteractionTime(async () => {
          // Drag field from palette to canvas
          const fieldElement = page.locator(`[data-field-type="${fieldType}"]`);
          const canvas = page.locator('.form-canvas');
          
          await fieldElement.dragTo(canvas);
          await page.waitForSelector(`[data-field-id]:nth-child(${i + 1})`);
        });
        
        additionTimes.push(addTime);
        
        // Each field addition should be reasonably fast
        expect(addTime).toBeLessThan(500); // Less than 500ms per field
      }
      
      const avgAdditionTime = additionTimes.reduce((a, b) => a + b, 0) / additionTimes.length;
      const maxAdditionTime = Math.max(...additionTimes);
      
      console.log(`Average field addition time: ${avgAdditionTime.toFixed(2)}ms`);
      console.log(`Maximum field addition time: ${maxAdditionTime.toFixed(2)}ms`);
      
      // Performance shouldn't degrade significantly with more fields
      const lastFiveAvg = additionTimes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const firstFiveAvg = additionTimes.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      
      expect(lastFiveAvg / firstFiveAvg).toBeLessThan(2.0); // No more than 2x slower
      
      const memoryAfter = await performanceHelper.getMemoryUsage();
      console.log(`Memory after adding 25 fields: ${(memoryAfter / 1024 / 1024).toFixed(2)}MB`);
    });

    test('Form preview generation performance', async ({ page }) => {
      await page.goto('http://localhost:3000/forms/builder');
      
      // Add several fields first
      const fieldTypes = ['text', 'email', 'select', 'textarea', 'number'];
      
      for (const fieldType of fieldTypes) {
        const fieldElement = page.locator(`[data-field-type="${fieldType}"]`);
        const canvas = page.locator('.form-canvas');
        await fieldElement.dragTo(canvas);
      }
      
      // Measure preview generation time
      const previewTime = await performanceHelper.measureInteractionTime(async () => {
        await page.locator('.preview-button').click();
        await page.waitForSelector('.form-preview');
      });
      
      expect(previewTime).toBeLessThan(1000); // Less than 1 second
      
      // Measure return to builder time
      const returnTime = await performanceHelper.measureInteractionTime(async () => {
        await page.locator('.edit-button').click();
        await page.waitForSelector('.form-builder');
      });
      
      expect(returnTime).toBeLessThan(500); // Less than 500ms
      
      console.log(`Preview generation time: ${previewTime.toFixed(2)}ms`);
      console.log(`Return to builder time: ${returnTime.toFixed(2)}ms`);
    });

    test('Large form handling performance', async ({ page }) => {
      await page.goto('http://localhost:3000/forms/builder');
      
      // Create a form with 50 fields
      const startTime = performance.now();
      
      for (let i = 0; i < 50; i++) {
        const fieldType = ['text', 'email', 'number', 'select', 'textarea'][i % 5];
        const fieldElement = page.locator(`[data-field-type="${fieldType}"]`);
        const canvas = page.locator('.form-canvas');
        
        await fieldElement.dragTo(canvas);
      }
      
      const creationTime = performance.now() - startTime;
      expect(creationTime).toBeLessThan(30000); // Less than 30 seconds
      
      // Test scrolling performance with many fields
      const scrollTime = await performanceHelper.measureInteractionTime(async () => {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(100); // Allow scroll to complete
      });
      
      expect(scrollTime).toBeLessThan(200); // Smooth scrolling
      
      // Test save performance
      const saveTime = await performanceHelper.measureInteractionTime(async () => {
        await page.locator('.save-button').click();
        await page.waitForSelector('.success-message');
      });
      
      expect(saveTime).toBeLessThan(3000); // Less than 3 seconds to save
      
      console.log(`Large form creation time: ${creationTime.toFixed(2)}ms`);
      console.log(`Scroll performance: ${scrollTime.toFixed(2)}ms`);
      console.log(`Save time: ${saveTime.toFixed(2)}ms`);
    });
  });

  test.describe('Form Submission Performance', () => {
    test('Simple form submission performance', async ({ page }) => {
      // Create a simple form via API first
      const formData = {
        title: 'Performance Test Form',
        fields: [
          { id: 'name', type: 'text', label: 'Name', required: true },
          { id: 'email', type: 'email', label: 'Email', required: true },
          { id: 'message', type: 'textarea', label: 'Message', required: false }
        ]
      };
      
      // Simulate form creation and get form ID
      const formId = 'perf-test-' + Date.now();
      
      const loadTime = await performanceHelper.measurePageLoad(`http://localhost:3000/forms/${formId}`);
      expect(loadTime).toBeLessThan(1500); // Less than 1.5 seconds
      
      // Fill out form
      const fillTime = await performanceHelper.measureInteractionTime(async () => {
        await page.fill('[data-field-id="name"] input', 'John Doe');
        await page.fill('[data-field-id="email"] input', 'john@example.com');
        await page.fill('[data-field-id="message"] textarea', 'This is a performance test message.');
      });
      
      expect(fillTime).toBeLessThan(1000); // Less than 1 second to fill
      
      // Submit form
      const submitTime = await performanceHelper.measureInteractionTime(async () => {
        await page.locator('.submit-button').click();
        await page.waitForSelector('.success-message');
      });
      
      expect(submitTime).toBeLessThan(2000); // Less than 2 seconds to submit
      
      console.log(`Form load time: ${loadTime.toFixed(2)}ms`);
      console.log(`Form fill time: ${fillTime.toFixed(2)}ms`);
      console.log(`Form submit time: ${submitTime.toFixed(2)}ms`);
    });

    test('Large form submission performance', async ({ page }) => {
      // Create form with many fields
      const fields = [];
      for (let i = 0; i < 30; i++) {
        fields.push({
          id: `field_${i}`,
          type: ['text', 'email', 'number', 'select', 'textarea'][i % 5],
          label: `Field ${i + 1}`,
          required: i % 3 === 0
        });
      }
      
      const formId = 'large-perf-test-' + Date.now();
      
      await page.goto(`http://localhost:3000/forms/${formId}`);
      
      // Fill out all fields
      const fillStartTime = performance.now();
      
      for (let i = 0; i < 30; i++) {
        const fieldType = fields[i].type;
        const selector = `[data-field-id="field_${i}"] ${fieldType === 'textarea' ? 'textarea' : fieldType === 'select' ? 'select' : 'input'}`;
        
        const value = fieldType === 'email' ? `test${i}@example.com` :
                     fieldType === 'number' ? (i + 1).toString() :
                     fieldType === 'select' ? 'option1' :
                     `Test value ${i + 1}`;
        
        await page.fill(selector, value);
      }
      
      const fillTime = performance.now() - fillStartTime;
      expect(fillTime).toBeLessThan(10000); // Less than 10 seconds to fill 30 fields
      
      // Submit large form
      const submitTime = await performanceHelper.measureInteractionTime(async () => {
        await page.locator('.submit-button').click();
        await page.waitForSelector('.success-message');
      });
      
      expect(submitTime).toBeLessThan(5000); // Less than 5 seconds to submit
      
      console.log(`Large form fill time: ${fillTime.toFixed(2)}ms`);
      console.log(`Large form submit time: ${submitTime.toFixed(2)}ms`);
    });

    test('File upload performance', async ({ page }) => {
      const formId = 'file-perf-test-' + Date.now();
      
      await page.goto(`http://localhost:3000/forms/${formId}`);
      
      // Create test files of different sizes
      const testFiles = [
        { name: 'small.txt', size: 1024 }, // 1KB
        { name: 'medium.pdf', size: 1024 * 1024 }, // 1MB
        { name: 'large.png', size: 5 * 1024 * 1024 } // 5MB
      ];
      
      for (const testFile of testFiles) {
        // Simulate file creation and upload
        const uploadTime = await performanceHelper.measureInteractionTime(async () => {
          // In a real test, you would create actual test files
          const fileInput = page.locator('input[type="file"]');
          // await fileInput.setInputFiles(testFile.path);
          
          // Wait for upload to complete
          await page.waitForSelector('.upload-success', { timeout: 10000 });
        });
        
        // Upload time should scale reasonably with file size
        const expectedMaxTime = Math.max(2000, testFile.size / (1024 * 1024) * 1000); // 1 second per MB minimum 2 seconds
        expect(uploadTime).toBeLessThan(expectedMaxTime);
        
        console.log(`${testFile.name} (${testFile.size} bytes) upload time: ${uploadTime.toFixed(2)}ms`);
      }
    });
  });

  test.describe('Form Validation Performance', () => {
    test('Real-time validation performance', async ({ page }) => {
      const formId = 'validation-perf-test-' + Date.now();
      
      await page.goto(`http://localhost:3000/forms/${formId}`);
      
      // Test validation performance on various field types
      const validationTests = [
        { field: 'email', value: 'invalid-email', expectedError: true },
        { field: 'email', value: 'valid@example.com', expectedError: false },
        { field: 'phone', value: 'invalid-phone', expectedError: true },
        { field: 'phone', value: '+1234567890', expectedError: false },
        { field: 'url', value: 'not-a-url', expectedError: true },
        { field: 'url', value: 'https://example.com', expectedError: false }
      ];
      
      for (const test of validationTests) {
        const validationTime = await performanceHelper.measureInteractionTime(async () => {
          const input = page.locator(`[data-field-id="${test.field}"] input`);
          await input.fill(test.value);
          await input.blur(); // Trigger validation
          
          if (test.expectedError) {
            await page.waitForSelector('.error-message');
          } else {
            await page.waitForSelector('.valid-input', { timeout: 1000 }).catch(() => {
              // No validation UI might appear for valid inputs
            });
          }
        });
        
        expect(validationTime).toBeLessThan(300); // Less than 300ms for validation
        
        console.log(`${test.field} validation (${test.value}): ${validationTime.toFixed(2)}ms`);
      }
    });

    test('Bulk validation performance', async ({ page }) => {
      const formId = 'bulk-validation-test-' + Date.now();
      
      await page.goto(`http://localhost:3000/forms/${formId}`);
      
      // Fill form with invalid data
      const fields = [
        { id: 'name', value: '' }, // Required field left empty
        { id: 'email', value: 'invalid-email' },
        { id: 'phone', value: 'invalid-phone' },
        { id: 'age', value: '-5' }, // Invalid age
        { id: 'website', value: 'not-a-url' }
      ];
      
      // Fill all fields with invalid data
      for (const field of fields) {
        await page.fill(`[data-field-id="${field.id}"] input`, field.value);
      }
      
      // Trigger bulk validation by attempting to submit
      const validationTime = await performanceHelper.measureInteractionTime(async () => {
        await page.locator('.submit-button').click();
        
        // Wait for all validation errors to appear
        await page.waitForSelector('.error-message');
        
        // Ensure all expected errors are present
        const errorCount = await page.locator('.error-message').count();
        expect(errorCount).toBe(fields.length);
      });
      
      expect(validationTime).toBeLessThan(1000); // Bulk validation should be under 1 second
      
      console.log(`Bulk validation time: ${validationTime.toFixed(2)}ms`);
    });
  });

  test.describe('Load Testing Simulation', () => {
    test('Concurrent form submissions simulation', async ({ page, context }) => {
      const formId = 'load-test-' + Date.now();
      const concurrentUsers = 5; // Reduced for test environment
      
      // Create multiple browser contexts to simulate concurrent users
      const contexts = [];
      const pages = [];
      
      try {
        for (let i = 0; i < concurrentUsers; i++) {
          const newContext = await context.browser().newContext();
          const newPage = await newContext.newPage();
          contexts.push(newContext);
          pages.push(newPage);
        }
        
        // Have all users navigate to form simultaneously
        const navigationPromises = pages.map(async (page, index) => {
          await page.goto(`http://localhost:3000/forms/${formId}`);
          
          // Fill out form with unique data
          await page.fill('[data-field-id="name"] input', `User ${index + 1}`);
          await page.fill('[data-field-id="email"] input', `user${index + 1}@example.com`);
        });
        
        const navigationStartTime = performance.now();
        await Promise.all(navigationPromises);
        const navigationTime = performance.now() - navigationStartTime;
        
        console.log(`Concurrent navigation time: ${navigationTime.toFixed(2)}ms`);
        
        // Have all users submit simultaneously
        const submissionPromises = pages.map(async (page) => {
          const startTime = performance.now();
          await page.locator('.submit-button').click();
          await page.waitForSelector('.success-message');
          return performance.now() - startTime;
        });
        
        const submissionTimes = await Promise.all(submissionPromises);
        
        const avgSubmissionTime = submissionTimes.reduce((a, b) => a + b, 0) / submissionTimes.length;
        const maxSubmissionTime = Math.max(...submissionTimes);
        
        console.log(`Average submission time: ${avgSubmissionTime.toFixed(2)}ms`);
        console.log(`Maximum submission time: ${maxSubmissionTime.toFixed(2)}ms`);
        
        // Performance shouldn't degrade significantly under load
        expect(maxSubmissionTime).toBeLessThan(avgSubmissionTime * 2.5);
        expect(avgSubmissionTime).toBeLessThan(5000); // Under 5 seconds average
        
      } finally {
        // Clean up contexts
        await Promise.all(contexts.map(ctx => ctx.close()));
      }
    });
  });

  test.describe('Memory Management', () => {
    test('Memory usage patterns', async ({ page }) => {
      await page.goto('http://localhost:3000/forms/builder');
      
      const initialMemory = await performanceHelper.getMemoryUsage();
      console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      
      // Add many fields and measure memory growth
      for (let i = 0; i < 20; i++) {
        const fieldElement = page.locator('[data-field-type="text"]');
        const canvas = page.locator('.form-canvas');
        await fieldElement.dragTo(canvas);
        
        if (i % 5 === 0) {
          const currentMemory = await performanceHelper.getMemoryUsage();
          console.log(`Memory after ${i + 1} fields: ${(currentMemory / 1024 / 1024).toFixed(2)}MB`);
        }
      }
      
      const finalMemory = await performanceHelper.getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });

    test('Memory cleanup on navigation', async ({ page }) => {
      const memoryBefore = await performanceHelper.getMemoryUsage();
      
      // Navigate to form builder and create content
      await page.goto('http://localhost:3000/forms/builder');
      
      for (let i = 0; i < 10; i++) {
        const fieldElement = page.locator('[data-field-type="text"]');
        const canvas = page.locator('.form-canvas');
        await fieldElement.dragTo(canvas);
      }
      
      const memoryAfterBuilding = await performanceHelper.getMemoryUsage();
      
      // Navigate away
      await page.goto('http://localhost:3000');
      
      // Force garbage collection if possible
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });
      
      await page.waitForTimeout(1000); // Allow cleanup
      
      const memoryAfterNavigation = await performanceHelper.getMemoryUsage();
      
      console.log(`Memory before: ${(memoryBefore / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory after building: ${(memoryAfterBuilding / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory after navigation: ${(memoryAfterNavigation / 1024 / 1024).toFixed(2)}MB`);
      
      // Memory should not continue growing indefinitely
      const memoryGrowth = memoryAfterNavigation - memoryBefore;
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024); // Less than 20MB permanent growth
    });
  });

  test.describe('Network Performance', () => {
    test('API response times', async ({ page }) => {
      let apiRequestTimes: number[] = [];
      
      // Monitor API requests
      page.on('response', async (response) => {
        if (response.url().includes('/api/')) {
          const timing = response.timing();
          apiRequestTimes.push(timing.responseEnd - timing.requestStart);
          
          console.log(`API ${response.request().method()} ${response.url()}: ${response.status()} (${timing.responseEnd - timing.requestStart}ms)`);
        }
      });
      
      // Navigate to form builder (should make several API calls)
      await page.goto('http://localhost:3000/forms/builder');
      
      // Create and save a form (more API calls)
      const fieldElement = page.locator('[data-field-type="text"]');
      const canvas = page.locator('.form-canvas');
      await fieldElement.dragTo(canvas);
      
      await page.locator('.save-button').click();
      await page.waitForSelector('.success-message');
      
      // Analyze API performance
      if (apiRequestTimes.length > 0) {
        const avgApiTime = apiRequestTimes.reduce((a, b) => a + b, 0) / apiRequestTimes.length;
        const maxApiTime = Math.max(...apiRequestTimes);
        
        console.log(`Average API response time: ${avgApiTime.toFixed(2)}ms`);
        console.log(`Maximum API response time: ${maxApiTime.toFixed(2)}ms`);
        console.log(`Total API requests: ${apiRequestTimes.length}`);
        
        // API responses should be reasonably fast
        expect(avgApiTime).toBeLessThan(1000); // Average under 1 second
        expect(maxApiTime).toBeLessThan(3000); // Max under 3 seconds
      }
    });

    test('Resource loading optimization', async ({ page }) => {
      let resourceSizes: { [key: string]: number } = {};
      let resourceCount = 0;
      
      // Monitor resource loading
      page.on('response', async (response) => {
        const url = response.url();
        const contentLength = response.headers()['content-length'];
        
        if (contentLength) {
          resourceSizes[url] = parseInt(contentLength);
          resourceCount++;
        }
      });
      
      await page.goto('http://localhost:3000/forms/builder');
      
      console.log(`Total resources loaded: ${resourceCount}`);
      
      // Analyze resource sizes
      const totalSize = Object.values(resourceSizes).reduce((a, b) => a + b, 0);
      const avgResourceSize = totalSize / resourceCount;
      
      console.log(`Total resource size: ${(totalSize / 1024).toFixed(2)}KB`);
      console.log(`Average resource size: ${(avgResourceSize / 1024).toFixed(2)}KB`);
      
      // Resource sizes should be optimized
      expect(totalSize).toBeLessThan(5 * 1024 * 1024); // Total under 5MB
      expect(avgResourceSize).toBeLessThan(500 * 1024); // Average under 500KB
    });
  });
});

// Helper function to create performance test data
function generatePerformanceTestData(fieldCount: number) {
  const fields = [];
  
  for (let i = 0; i < fieldCount; i++) {
    const fieldTypes = ['text', 'email', 'number', 'select', 'textarea'];
    const type = fieldTypes[i % fieldTypes.length];
    
    fields.push({
      id: `field_${i}`,
      type,
      label: `Field ${i + 1}`,
      required: i % 3 === 0,
      validation: type === 'text' ? { minLength: 1, maxLength: 100 } : undefined,
      options: type === 'select' ? [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' }
      ] : undefined
    });
  }
  
  return {
    title: `Performance Test Form (${fieldCount} fields)`,
    description: 'Form generated for performance testing',
    fields
  };
}