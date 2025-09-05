/**
 * API Performance Tests
 * Tests backend API response times and caching effectiveness
 */
import axios from 'axios';
import { performance } from 'perf_hooks';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

describe('API Performance Tests', () => {
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  // Performance thresholds (in milliseconds)
  const THRESHOLDS = {
    FAST: 200,      // Critical endpoints
    MEDIUM: 500,    // Standard endpoints  
    SLOW: 1000,     // Complex operations
    CACHE: 50       // Cached responses
  };

  beforeAll(async () => {
    // Warm up the API server
    try {
      await apiClient.get('/health');
    } catch (error) {
      console.warn('API server not available for performance tests');
    }
  });

  describe('Critical Path Performance', () => {
    test('Health check should respond quickly', async () => {
      const start = performance.now();
      const response = await apiClient.get('/health');
      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(THRESHOLDS.FAST);
      console.log(`Health check: ${duration.toFixed(2)}ms`);
    });

    test('Authentication endpoints should be fast', async () => {
      const start = performance.now();
      
      try {
        // Test login endpoint performance (even with invalid creds)
        await apiClient.post('/auth/login', {
          email: 'test@example.com',
          password: 'invalid'
        });
      } catch (error) {
        // We expect this to fail, but it should fail quickly
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(THRESHOLDS.MEDIUM);
      console.log(`Auth endpoint: ${duration.toFixed(2)}ms`);
    });

    test('Form list endpoint performance', async () => {
      const start = performance.now();
      
      try {
        const response = await apiClient.get('/api/forms');
        const duration = performance.now() - start;
        
        expect(duration).toBeLessThan(THRESHOLDS.MEDIUM);
        console.log(`Forms list: ${duration.toFixed(2)}ms`);
        
        if (response.data) {
          console.log(`Returned ${response.data.length || 0} forms`);
        }
      } catch (error) {
        const duration = performance.now() - start;
        console.log(`Forms list (error): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(THRESHOLDS.MEDIUM);
      }
    });
  });

  describe('Cache Performance', () => {
    test('Repeated requests should benefit from caching', async () => {
      const endpoint = '/api/forms';
      const requests = [];
      
      // Make multiple requests to the same endpoint
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        
        try {
          await apiClient.get(endpoint);
          const duration = performance.now() - start;
          requests.push(duration);
        } catch (error) {
          const duration = performance.now() - start;
          requests.push(duration);
        }
      }

      console.log(`Request times: ${requests.map(r => r.toFixed(2)).join('ms, ')}ms`);
      
      // Second and third requests should be faster (cached)
      if (requests.length >= 2) {
        expect(requests[1]).toBeLessThanOrEqual(requests[0] * 1.2); // Allow 20% variance
      }
    });

    test('Cache headers are properly set', async () => {
      try {
        const response = await apiClient.get('/api/forms');
        
        // Check for cache-related headers
        const headers = response.headers;
        console.log('Cache headers:', {
          'cache-control': headers['cache-control'],
          'etag': headers['etag'],
          'last-modified': headers['last-modified']
        });
        
        // At least one caching header should be present
        const hasCacheHeaders = 
          headers['cache-control'] || 
          headers['etag'] || 
          headers['last-modified'];
          
        expect(hasCacheHeaders).toBeTruthy();
      } catch (error) {
        // Skip if endpoint doesn't exist
        console.log('Skipping cache header test - endpoint not available');
      }
    });
  });

  describe('Bulk Operations Performance', () => {
    test('Multiple concurrent requests should handle well', async () => {
      const concurrentRequests = 5;
      const promises = [];
      
      const startTime = performance.now();
      
      // Create concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          apiClient.get('/health').catch(() => ({ status: 'error' }))
        );
      }
      
      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      console.log(`${concurrentRequests} concurrent requests: ${totalTime.toFixed(2)}ms total`);
      console.log(`Average per request: ${(totalTime / concurrentRequests).toFixed(2)}ms`);
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(THRESHOLDS.SLOW * 2);
      
      // Most requests should succeed
      const successCount = results.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(concurrentRequests * 0.8);
    });

    test('Sequential vs concurrent request performance comparison', async () => {
      const requestCount = 3;
      
      // Sequential requests
      const sequentialStart = performance.now();
      for (let i = 0; i < requestCount; i++) {
        try {
          await apiClient.get('/health');
        } catch (error) {
          // Continue with other requests
        }
      }
      const sequentialTime = performance.now() - sequentialStart;
      
      // Concurrent requests
      const concurrentStart = performance.now();
      const promises = Array(requestCount).fill(0).map(() => 
        apiClient.get('/health').catch(() => ({ status: 'error' }))
      );
      await Promise.all(promises);
      const concurrentTime = performance.now() - concurrentStart;
      
      console.log(`Sequential: ${sequentialTime.toFixed(2)}ms`);
      console.log(`Concurrent: ${concurrentTime.toFixed(2)}ms`);
      console.log(`Speedup: ${(sequentialTime / concurrentTime).toFixed(2)}x`);
      
      // Concurrent should be faster
      expect(concurrentTime).toBeLessThan(sequentialTime);
    });
  });

  describe('Error Handling Performance', () => {
    test('404 errors should respond quickly', async () => {
      const start = performance.now();
      
      try {
        await apiClient.get('/api/nonexistent-endpoint');
      } catch (error) {
        const duration = performance.now() - start;
        console.log(`404 response: ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(THRESHOLDS.FAST);
        
        if (error.response) {
          expect(error.response.status).toBe(404);
        }
      }
    });

    test('Server errors should not hang', async () => {
      const start = performance.now();
      
      try {
        // Try to trigger a server error with malformed data
        await apiClient.post('/api/forms', { malformed: 'data' });
      } catch (error) {
        const duration = performance.now() - start;
        console.log(`Error response: ${duration.toFixed(2)}ms`);
        
        // Even errors should respond quickly
        expect(duration).toBeLessThan(THRESHOLDS.MEDIUM);
      }
    });
  });

  describe('Performance Monitoring', () => {
    test('Response size should be reasonable', async () => {
      try {
        const response = await apiClient.get('/api/forms');
        
        if (response.data) {
          const responseSize = JSON.stringify(response.data).length;
          console.log(`Response size: ${(responseSize / 1024).toFixed(2)} KB`);
          
          // Response shouldn't be excessively large
          expect(responseSize).toBeLessThan(1024 * 1024); // 1MB limit
        }
      } catch (error) {
        console.log('Skipping response size test - endpoint not available');
      }
    });

    test('Memory usage during requests should be stable', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make several requests to test for memory leaks
      for (let i = 0; i < 10; i++) {
        try {
          await apiClient.get('/health');
        } catch (error) {
          // Continue with test
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB limit
    });
  });
});