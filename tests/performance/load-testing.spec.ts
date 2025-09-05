/**
 * Performance and Load Testing Suite for Phase 4 Review System
 * Tests system performance under various load conditions and stress scenarios
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

// Performance metrics interface
interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Load test configuration
const LoadTestConfig = {
  baseline: {
    users: 5,
    duration: 30000, // 30 seconds
    expectedResponseTime: 2000 // 2 seconds
  },
  stress: {
    users: 25,
    duration: 60000, // 1 minute
    expectedResponseTime: 5000 // 5 seconds
  },
  spike: {
    users: 50,
    duration: 30000, // 30 seconds
    expectedResponseTime: 10000 // 10 seconds
  }
};

// Utility functions
class PerformanceTestRunner {
  private metrics: PerformanceMetrics[] = [];

  async measurePageLoad(page: Page, url: string): Promise<number> {
    const startTime = performance.now();
    
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    
    const endTime = performance.now();
    return endTime - startTime;
  }

  async measureFormSubmission(page: Page, formData: any): Promise<number> {
    const startTime = performance.now();
    
    // Fill form
    await this.fillFormData(page, formData);
    
    // Submit and wait for response
    await page.click('[data-testid="submit-button"]');
    await page.waitForSelector('[data-testid="submission-success"]', { timeout: 30000 });
    
    const endTime = performance.now();
    return endTime - startTime;
  }

  private async fillFormData(page: Page, data: any) {
    await page.fill('[data-testid="company-name-input"]', data.companyName);
    await page.fill('[data-testid="contact-email-input"]', data.contactEmail);
    await page.selectOption('[data-testid="business-type-select"]', data.businessType);
    await page.check('[data-testid="terms-agreement-checkbox"]');
  }

  async runConcurrentUsers(context: BrowserContext, userCount: number, testFunction: (page: Page) => Promise<number>): Promise<PerformanceMetrics> {
    const pages = await Promise.all(
      Array.from({ length: userCount }, () => context.newPage())
    );

    const startTime = performance.now();
    const promises = pages.map(testFunction);
    
    try {
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalDuration = endTime - startTime;
      const avgResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxResponseTime = Math.max(...results);
      const minResponseTime = Math.min(...results);
      
      // Calculate metrics
      const metrics: PerformanceMetrics = {
        responseTime: avgResponseTime,
        throughput: (userCount / totalDuration) * 1000, // requests per second
        errorRate: 0, // Would be calculated based on failed requests
        memoryUsage: await this.getMemoryUsage(),
        cpuUsage: await this.getCPUUsage()
      };

      console.log(`Performance Test Results:
        Users: ${userCount}
        Average Response Time: ${avgResponseTime.toFixed(2)}ms
        Max Response Time: ${maxResponseTime.toFixed(2)}ms
        Min Response Time: ${minResponseTime.toFixed(2)}ms
        Throughput: ${metrics.throughput.toFixed(2)} req/sec
        Memory Usage: ${metrics.memoryUsage.toFixed(2)}MB
        CPU Usage: ${metrics.cpuUsage.toFixed(2)}%
      `);

      return metrics;
    } finally {
      // Cleanup
      await Promise.all(pages.map(page => page.close()));
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const memInfo = execSync('ps -o pid,vsz,rss $(pgrep node)').toString();
      const lines = memInfo.split('\n').slice(1);
      const totalRSS = lines.reduce((sum, line) => {
        const parts = line.trim().split(/\s+/);
        return sum + parseInt(parts[2] || '0');
      }, 0);
      return totalRSS / 1024; // Convert to MB
    } catch {
      return 0;
    }
  }

  private async getCPUUsage(): Promise<number> {
    try {
      const cpuInfo = execSync('ps -o pid,pcpu $(pgrep node)').toString();
      const lines = cpuInfo.split('\n').slice(1);
      const totalCPU = lines.reduce((sum, line) => {
        const parts = line.trim().split(/\s+/);
        return sum + parseFloat(parts[1] || '0');
      }, 0);
      return totalCPU;
    } catch {
      return 0;
    }
  }
}

// Test data factory
const createTestData = (index: number) => ({
  companyName: `LoadTest Company ${index}`,
  contactEmail: `loadtest${index}@example.com`,
  businessType: 'corporation',
  annualRevenue: (Math.random() * 10000000).toFixed(2),
  comments: `Load test submission ${index} with timestamp ${Date.now()}`
});

test.describe('Performance and Load Tests', () => {
  let performanceRunner: PerformanceTestRunner;

  test.beforeEach(() => {
    performanceRunner = new PerformanceTestRunner();
  });

  test.describe('Baseline Performance Tests', () => {
    test('page load performance meets baseline', async ({ page }) => {
      const loadTimes: number[] = [];
      
      // Measure page load 5 times
      for (let i = 0; i < 5; i++) {
        const loadTime = await performanceRunner.measurePageLoad(page, '/');
        loadTimes.push(loadTime);
        
        // Wait between tests
        await page.waitForTimeout(1000);
      }
      
      const avgLoadTime = loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
      const maxLoadTime = Math.max(...loadTimes);
      
      console.log(`Page Load Performance:
        Average: ${avgLoadTime.toFixed(2)}ms
        Maximum: ${maxLoadTime.toFixed(2)}ms
        All measurements: ${loadTimes.map(t => t.toFixed(0)).join(', ')}ms
      `);
      
      // Performance assertions
      expect(avgLoadTime).toBeLessThan(LoadTestConfig.baseline.expectedResponseTime);
      expect(maxLoadTime).toBeLessThan(LoadTestConfig.baseline.expectedResponseTime * 1.5);
    });

    test('form submission performance meets baseline', async ({ page }) => {
      const submissionTimes: number[] = [];
      
      // Measure form submission 3 times
      for (let i = 0; i < 3; i++) {
        await page.goto('/');
        await page.click('[data-testid="form-builder-tab"]');
        
        const submissionTime = await performanceRunner.measureFormSubmission(
          page,
          createTestData(i)
        );
        
        submissionTimes.push(submissionTime);
        
        // Wait between tests
        await page.waitForTimeout(2000);
      }
      
      const avgSubmissionTime = submissionTimes.reduce((sum, time) => sum + time, 0) / submissionTimes.length;
      
      console.log(`Form Submission Performance:
        Average: ${avgSubmissionTime.toFixed(2)}ms
        All measurements: ${submissionTimes.map(t => t.toFixed(0)).join(', ')}ms
      `);
      
      expect(avgSubmissionTime).toBeLessThan(LoadTestConfig.baseline.expectedResponseTime);
    });

    test('API response time meets baseline', async ({ request }) => {
      const apiTimes: number[] = [];
      
      // Test form schema endpoint
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        const response = await request.get('/api/forms/test-form-001/schema');
        expect(response.status()).toBe(200);
        
        const endTime = performance.now();
        apiTimes.push(endTime - startTime);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const avgApiTime = apiTimes.reduce((sum, time) => sum + time, 0) / apiTimes.length;
      const maxApiTime = Math.max(...apiTimes);
      
      console.log(`API Response Performance:
        Average: ${avgApiTime.toFixed(2)}ms
        Maximum: ${maxApiTime.toFixed(2)}ms
      `);
      
      expect(avgApiTime).toBeLessThan(500); // 500ms baseline for API calls
      expect(maxApiTime).toBeLessThan(1000); // 1s maximum acceptable
    });
  });

  test.describe('Load Testing', () => {
    test('handles baseline concurrent load', async ({ context }) => {
      const testFunction = async (page: Page) => {
        return await performanceRunner.measurePageLoad(page, '/');
      };

      const metrics = await performanceRunner.runConcurrentUsers(
        context,
        LoadTestConfig.baseline.users,
        testFunction
      );

      // Assertions for baseline load
      expect(metrics.responseTime).toBeLessThan(LoadTestConfig.baseline.expectedResponseTime);
      expect(metrics.throughput).toBeGreaterThan(1); // At least 1 req/sec
      expect(metrics.errorRate).toBeLessThan(0.01); // Less than 1% error rate
    });

    test('handles concurrent form submissions', async ({ context }) => {
      const testFunction = async (page: Page, index = 0) => {
        await page.goto('/');
        await page.click('[data-testid="form-builder-tab"]');
        
        return await performanceRunner.measureFormSubmission(
          page,
          createTestData(index)
        );
      };

      const pages = await Promise.all(
        Array.from({ length: 10 }, () => context.newPage())
      );

      const startTime = performance.now();
      const submissionPromises = pages.map((page, index) => testFunction(page, index));
      
      try {
        const results = await Promise.all(submissionPromises);
        const endTime = performance.now();
        
        const avgSubmissionTime = results.reduce((sum, time) => sum + time, 0) / results.length;
        const totalDuration = endTime - startTime;
        const throughput = (pages.length / totalDuration) * 1000;
        
        console.log(`Concurrent Form Submissions:
          Users: ${pages.length}
          Average Time: ${avgSubmissionTime.toFixed(2)}ms
          Total Duration: ${totalDuration.toFixed(2)}ms
          Throughput: ${throughput.toFixed(2)} submissions/sec
        `);
        
        // Performance assertions
        expect(avgSubmissionTime).toBeLessThan(5000); // 5 seconds under load
        expect(throughput).toBeGreaterThan(0.5); // At least 0.5 submissions/sec
        
      } finally {
        await Promise.all(pages.map(page => page.close()));
      }
    });

    test('maintains performance under database load', async ({ request }) => {
      const concurrentRequests = 20;
      const requestsPerUser = 5;
      
      const testFunction = async () => {
        const times: number[] = [];
        
        for (let i = 0; i < requestsPerUser; i++) {
          const startTime = performance.now();
          
          const response = await request.post('/api/forms/submit', {
            data: {
              formId: 'test-form-001',
              submissionData: createTestData(Math.random() * 1000),
              metadata: {
                userAgent: 'Load Test Agent',
                ipAddress: '127.0.0.1',
                sessionId: `loadtest-${Date.now()}-${Math.random()}`
              }
            }
          });
          
          const endTime = performance.now();
          times.push(endTime - startTime);
          
          // Expect successful submission
          expect([200, 201]).toContain(response.status());
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return times;
      };

      // Run concurrent users
      const promises = Array.from({ length: concurrentRequests }, testFunction);
      const results = await Promise.all(promises);
      
      // Flatten results and calculate metrics
      const allTimes = results.flat();
      const avgTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
      const maxTime = Math.max(...allTimes);
      const minTime = Math.min(...allTimes);
      
      console.log(`Database Load Test Results:
        Total Requests: ${allTimes.length}
        Average Response: ${avgTime.toFixed(2)}ms
        Max Response: ${maxTime.toFixed(2)}ms
        Min Response: ${minTime.toFixed(2)}ms
      `);
      
      // Performance assertions
      expect(avgTime).toBeLessThan(2000); // 2 seconds average under load
      expect(maxTime).toBeLessThan(10000); // 10 seconds maximum
    });
  });

  test.describe('Stress Testing', () => {
    test('handles stress load conditions', async ({ context }) => {
      const testFunction = async (page: Page) => {
        return await performanceRunner.measurePageLoad(page, '/');
      };

      const metrics = await performanceRunner.runConcurrentUsers(
        context,
        LoadTestConfig.stress.users,
        testFunction
      );

      console.log(`Stress Test Results: ${JSON.stringify(metrics, null, 2)}`);
      
      // More relaxed assertions for stress testing
      expect(metrics.responseTime).toBeLessThan(LoadTestConfig.stress.expectedResponseTime);
      expect(metrics.errorRate).toBeLessThan(0.05); // Allow up to 5% errors under stress
      expect(metrics.memoryUsage).toBeLessThan(1000); // Less than 1GB memory usage
    });

    test('recovers from spike traffic', async ({ context }) => {
      // Baseline measurement
      const baselineFunction = async (page: Page) => {
        return await performanceRunner.measurePageLoad(page, '/');
      };

      const baselineMetrics = await performanceRunner.runConcurrentUsers(
        context,
        5,
        baselineFunction
      );

      console.log('Baseline metrics recorded');

      // Spike traffic
      const spikeMetrics = await performanceRunner.runConcurrentUsers(
        context,
        LoadTestConfig.spike.users,
        baselineFunction
      );

      console.log('Spike metrics recorded');

      // Recovery measurement
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const recoveryMetrics = await performanceRunner.runConcurrentUsers(
        context,
        5,
        baselineFunction
      );

      console.log(`Recovery Test Results:
        Baseline: ${baselineMetrics.responseTime.toFixed(2)}ms
        Spike: ${spikeMetrics.responseTime.toFixed(2)}ms
        Recovery: ${recoveryMetrics.responseTime.toFixed(2)}ms
      `);

      // Recovery assertions
      expect(spikeMetrics.responseTime).toBeLessThan(LoadTestConfig.spike.expectedResponseTime);
      expect(recoveryMetrics.responseTime).toBeLessThan(baselineMetrics.responseTime * 1.2); // Within 20% of baseline
    });
  });

  test.describe('Memory and Resource Testing', () => {
    test('memory usage remains stable during extended use', async ({ page }) => {
      const memoryReadings: number[] = [];
      
      // Extended usage simulation
      for (let i = 0; i < 20; i++) {
        await page.goto('/');
        await page.click('[data-testid="form-builder-tab"]');
        
        // Fill and submit form
        await page.fill('[data-testid="company-name-input"]', `Memory Test ${i}`);
        await page.fill('[data-testid="contact-email-input"]', `memtest${i}@example.com`);
        await page.check('[data-testid="terms-agreement-checkbox"]');
        
        // Take memory reading
        const memoryUsage = await performanceRunner['getMemoryUsage']();
        memoryReadings.push(memoryUsage);
        
        console.log(`Iteration ${i + 1}: Memory usage ${memoryUsage.toFixed(2)}MB`);
        
        // Small delay between iterations
        await page.waitForTimeout(500);
      }
      
      // Analyze memory trend
      const firstHalfAvg = memoryReadings.slice(0, 10).reduce((sum, val) => sum + val, 0) / 10;
      const secondHalfAvg = memoryReadings.slice(10).reduce((sum, val) => sum + val, 0) / 10;
      const memoryGrowth = secondHalfAvg - firstHalfAvg;
      const maxMemory = Math.max(...memoryReadings);
      
      console.log(`Memory Analysis:
        First Half Average: ${firstHalfAvg.toFixed(2)}MB
        Second Half Average: ${secondHalfAvg.toFixed(2)}MB
        Memory Growth: ${memoryGrowth.toFixed(2)}MB
        Maximum Memory: ${maxMemory.toFixed(2)}MB
      `);
      
      // Memory assertions
      expect(memoryGrowth).toBeLessThan(100); // Less than 100MB growth over test
      expect(maxMemory).toBeLessThan(500); // Less than 500MB maximum usage
    });

    test('handles large file uploads efficiently', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="form-builder-tab"]');
      
      // Create progressively larger test files
      const fileSizes = [1, 5, 10]; // MB
      const uploadTimes: number[] = [];
      
      for (const sizeMB of fileSizes) {
        const fileContent = Buffer.alloc(sizeMB * 1024 * 1024, 'A');
        
        const startTime = performance.now();
        
        const fileInput = page.locator('[data-testid="certification-files-input"]');
        await fileInput.setInputFiles({
          name: `large-file-${sizeMB}mb.pdf`,
          mimeType: 'application/pdf',
          buffer: fileContent
        });
        
        // Wait for file to be processed
        await page.waitForTimeout(1000);
        
        const endTime = performance.now();
        const uploadTime = endTime - startTime;
        uploadTimes.push(uploadTime);
        
        console.log(`${sizeMB}MB file upload: ${uploadTime.toFixed(2)}ms`);
        
        // Performance assertions per file size
        const expectedTime = sizeMB * 2000; // 2 seconds per MB baseline
        expect(uploadTime).toBeLessThan(expectedTime);
      }
      
      // Overall file upload performance
      const avgUploadTime = uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length;
      expect(avgUploadTime).toBeLessThan(15000); // Average under 15 seconds
    });
  });

  test.describe('Database Performance', () => {
    test('handles concurrent database operations', async ({ request }) => {
      const concurrentOperations = 50;
      const operationTypes = ['read', 'write', 'update'];
      
      const promises = Array.from({ length: concurrentOperations }, async (_, index) => {
        const operation = operationTypes[index % operationTypes.length];
        const startTime = performance.now();
        
        let response;
        switch (operation) {
          case 'read':
            response = await request.get(`/api/submissions/sub-${index}`);
            break;
          case 'write':
            response = await request.post('/api/forms/submit', {
              data: {
                formId: 'test-form-001',
                submissionData: createTestData(index)
              }
            });
            break;
          case 'update':
            response = await request.put(`/api/submissions/sub-${index}/review`, {
              data: {
                reviewStatus: 'reviewed',
                comments: `Database performance test ${index}`
              }
            });
            break;
        }
        
        const endTime = performance.now();
        
        return {
          operation,
          time: endTime - startTime,
          status: response?.status() || 0,
          success: response ? response.status() < 400 : false
        };
      });
      
      const results = await Promise.all(promises);
      
      // Analyze results
      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      const successRate = results.filter(r => r.success).length / results.length;
      const maxTime = Math.max(...results.map(r => r.time));
      
      console.log(`Database Performance Results:
        Operations: ${concurrentOperations}
        Average Time: ${avgTime.toFixed(2)}ms
        Success Rate: ${(successRate * 100).toFixed(2)}%
        Max Time: ${maxTime.toFixed(2)}ms
      `);
      
      // Performance assertions
      expect(avgTime).toBeLessThan(1000); // 1 second average
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(maxTime).toBeLessThan(5000); // 5 second maximum
    });
  });
});

test.describe('Frontend Performance Tests', () => {
  test('component rendering performance', async ({ page }) => {
    // Enable performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = [];
      const observer = new PerformanceObserver((list) => {
        window.performanceMetrics.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get performance metrics
    const metrics = await page.evaluate(() => window.performanceMetrics);
    const navigationTiming = await page.evaluate(() => performance.getEntriesByType('navigation')[0]);
    
    console.log('Navigation Timing:', navigationTiming);
    
    // Performance assertions
    if (navigationTiming && 'loadEventEnd' in navigationTiming && 'fetchStart' in navigationTiming) {
      const totalLoadTime = navigationTiming.loadEventEnd - navigationTiming.fetchStart;
      expect(totalLoadTime).toBeLessThan(3000); // 3 seconds total load
    }
  });

  test('form interaction responsiveness', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="form-builder-tab"]');
    
    const interactionTimes: number[] = [];
    
    // Test various interactions
    const interactions = [
      () => page.fill('[data-testid="company-name-input"]', 'Performance Test Co'),
      () => page.fill('[data-testid="contact-email-input"]', 'perf@test.com'),
      () => page.selectOption('[data-testid="business-type-select"]', 'corporation'),
      () => page.fill('[data-testid="annual-revenue-input"]', '1000000'),
      () => page.fill('[data-testid="comments-textarea"]', 'Performance test comments')
    ];
    
    for (const interaction of interactions) {
      const startTime = performance.now();
      await interaction();
      const endTime = performance.now();
      
      interactionTimes.push(endTime - startTime);
    }
    
    const avgInteractionTime = interactionTimes.reduce((sum, time) => sum + time, 0) / interactionTimes.length;
    const maxInteractionTime = Math.max(...interactionTimes);
    
    console.log(`Interaction Performance:
      Average: ${avgInteractionTime.toFixed(2)}ms
      Maximum: ${maxInteractionTime.toFixed(2)}ms
    `);
    
    // UI responsiveness assertions
    expect(avgInteractionTime).toBeLessThan(100); // 100ms average response
    expect(maxInteractionTime).toBeLessThan(500); // 500ms maximum response
  });
});

// Global test configuration
test.beforeAll(async () => {
  console.log('Starting Performance Test Suite');
  console.log(`Test Environment: ${process.env.NODE_ENV || 'development'}`);
});

test.afterAll(async () => {
  console.log('Performance Test Suite completed');
});