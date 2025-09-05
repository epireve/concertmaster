import { FormSecurityService, SecurityViolation } from '../../backend/src/services/form_security';
import { Request } from 'fastapi';

// Mock dependencies
jest.mock('../../backend/src/services/cache_manager', () => ({
  cache_manager: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  },
  CacheNamespace: {
    RATE_LIMITS: 'rate_limits',
    SESSIONS: 'sessions'
  }
}));

jest.mock('../../backend/src/config', () => ({
  settings: {
    ALLOWED_ORIGINS: ['https://example.com', 'https://app.example.com']
  }
}));

// Mock Request object
const createMockRequest = (overrides: any = {}): Request => ({
  method: 'POST',
  url: { path: '/api/v1/forms', query: '' },
  headers: { get: jest.fn() },
  client: { host: '192.168.1.1' },
  state: {},
  ...overrides
} as any);

describe('FormSecurityService', () => {
  let securityService: FormSecurityService;
  let mockCacheManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset cache manager mock
    mockCacheManager = require('../../backend/src/services/cache_manager').cache_manager;
    mockCacheManager.get.mockResolvedValue(0);
    mockCacheManager.set.mockResolvedValue(undefined);
    mockCacheManager.delete.mockResolvedValue(undefined);
    
    securityService = new FormSecurityService();
  });

  describe('Rate Limiting', () => {
    it('allows requests within rate limit', async () => {
      mockCacheManager.get.mockResolvedValue(2); // 2 requests already made
      
      const request = createMockRequest();
      const result = await securityService.check_rate_limit('test-client', 'form_submit', request);
      
      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate_limits',
        'rate_limit:form_submit:test-client',
        3,
        { ttl: 300 }
      );
    });

    it('blocks requests exceeding rate limit', async () => {
      mockCacheManager.get.mockResolvedValue(5); // At limit
      
      const request = createMockRequest();
      const result = await securityService.check_rate_limit('test-client', 'form_submit', request);
      
      expect(result).toBe(false);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('handles different action types with different limits', async () => {
      const actions = [
        { action: 'form_submit', limit: 5 },
        { action: 'form_view', limit: 50 },
        { action: 'file_upload', limit: 10 }
      ];

      for (const { action, limit } of actions) {
        mockCacheManager.get.mockResolvedValue(limit - 1);
        
        const request = createMockRequest();
        const result = await securityService.check_rate_limit('test-client', action, request);
        
        expect(result).toBe(true);
      }
    });

    it('fails open when cache is unavailable', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache unavailable'));
      
      const request = createMockRequest();
      const result = await securityService.check_rate_limit('test-client', 'form_submit', request);
      
      expect(result).toBe(true); // Should fail open for availability
    });
  });

  describe('Origin Validation', () => {
    it('allows requests with valid origins', async () => {
      const request = createMockRequest({
        headers: {
          get: jest.fn().mockImplementation((header: string) => {
            if (header === 'origin') return 'https://example.com';
            return null;
          })
        }
      });
      
      const result = await securityService.validate_request_origin(request);
      expect(result).toBe(true);
    });

    it('allows requests with wildcard origins', async () => {
      const securityServiceWithWildcard = new FormSecurityService();
      securityServiceWithWildcard.allowed_origins = ['*'];
      
      const request = createMockRequest({
        headers: {
          get: jest.fn().mockImplementation((header: string) => {
            if (header === 'origin') return 'https://any-domain.com';
            return null;
          })
        }
      });
      
      const result = await securityServiceWithWildcard.validate_request_origin(request);
      expect(result).toBe(true);
    });

    it('blocks requests with invalid origins', async () => {
      const request = createMockRequest({
        headers: {
          get: jest.fn().mockImplementation((header: string) => {
            if (header === 'origin') return 'https://malicious-site.com';
            return null;
          })
        }
      });
      
      const result = await securityService.validate_request_origin(request);
      expect(result).toBe(false);
    });

    it('allows requests without origin header (direct API calls)', async () => {
      const request = createMockRequest({
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      });
      
      const result = await securityService.validate_request_origin(request);
      expect(result).toBe(true);
    });

    it('validates referer as fallback when origin is missing', async () => {
      const request = createMockRequest({
        headers: {
          get: jest.fn().mockImplementation((header: string) => {
            if (header === 'referer') return 'https://example.com/page';
            return null;
          })
        }
      });
      
      const result = await securityService.validate_request_origin(request);
      expect(result).toBe(true);
    });
  });

  describe('IP Reputation', () => {
    it('allows requests from clean IPs', async () => {
      const request = createMockRequest();
      const result = await securityService.check_ip_reputation(request);
      
      expect(result).toBe(true);
    });

    it('blocks requests from blocked IPs', async () => {
      await securityService.add_blocked_ip('192.168.1.100', 'manual block');
      
      const request = createMockRequest({
        client: { host: '192.168.1.100' }
      });
      
      const result = await securityService.check_ip_reputation(request);
      expect(result).toBe(false);
    });

    it('blocks requests from private network ranges', async () => {
      const privateIPs = ['10.0.0.1', '172.16.0.1', '192.168.1.1'];
      
      for (const ip of privateIPs) {
        const request = createMockRequest({
          client: { host: ip }
        });
        
        const result = await securityService.check_ip_reputation(request);
        expect(result).toBe(false);
      }
    });

    it('handles forwarded IP headers', async () => {
      const request = createMockRequest({
        headers: {
          get: jest.fn().mockImplementation((header: string) => {
            if (header === 'x-forwarded-for') return '203.0.113.1, 10.0.0.1';
            return null;
          })
        }
      });
      
      // Should use first IP in forwarded chain
      const clientId = securityService._get_client_id(request);
      expect(clientId).toBe('ip:203.0.113.1');
    });

    it('detects suspicious user agents', async () => {
      const suspiciousAgents = [
        'curl/7.68.0',
        'python-requests/2.25.1',
        'Googlebot/2.1',
        'PostmanRuntime/7.26.8'
      ];

      for (const userAgent of suspiciousAgents) {
        const request = createMockRequest({
          headers: {
            get: jest.fn().mockImplementation((header: string) => {
              if (header === 'user-agent') return userAgent;
              return null;
            })
          }
        });

        const isSuspicious = securityService._is_suspicious_user_agent(userAgent);
        expect(isSuspicious).toBe(true);
      }
    });
  });

  describe('Form Data Security Validation', () => {
    it('allows clean form data', async () => {
      const cleanData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello, this is a legitimate message.'
      };
      
      const result = await securityService.validate_form_data_security(cleanData);
      expect(result).toBe(true);
    });

    it('detects XSS attempts', async () => {
      const maliciousData = {
        name: 'John<script>alert("XSS")</script>',
        email: 'john@example.com',
        message: 'Normal message'
      };
      
      const result = await securityService.validate_form_data_security(maliciousData);
      expect(result).toBe(false);
    });

    it('detects SQL injection attempts', async () => {
      const sqlInjectionData = {
        email: "test@example.com'; DROP TABLE users; --",
        password: '1 OR 1=1'
      };
      
      const result = await securityService.validate_form_data_security(sqlInjectionData);
      expect(result).toBe(false);
    });

    it('detects command injection attempts', async () => {
      const commandInjectionData = {
        filename: 'test.txt; cat /etc/passwd',
        path: '../../../etc/passwd'
      };
      
      const result = await securityService.validate_form_data_security(commandInjectionData);
      expect(result).toBe(false);
    });

    it('detects path traversal attempts', async () => {
      const pathTraversalData = {
        file: '../../etc/passwd',
        path: '..\\..\\windows\\system32\\config\\sam'
      };
      
      const result = await securityService.validate_form_data_security(pathTraversalData);
      expect(result).toBe(false);
    });

    it('handles non-string field values gracefully', async () => {
      const mixedData = {
        age: 25,
        active: true,
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' }
      };
      
      const result = await securityService.validate_form_data_security(mixedData);
      expect(result).toBe(true);
    });
  });

  describe('CSRF Protection', () => {
    it('generates and validates CSRF tokens', async () => {
      const clientId = 'test-client';
      
      // Generate token
      const token = await securityService.generate_csrf_token(clientId);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);
      
      // Mock cache to return token data
      mockCacheManager.get.mockResolvedValue({
        created_at: new Date().toISOString(),
        client_id: clientId
      });
      
      // Validate token
      const isValid = await securityService.validate_csrf_token(clientId, token);
      expect(isValid).toBe(true);
      
      // Token should be deleted after use (one-time use)
      expect(mockCacheManager.delete).toHaveBeenCalled();
    });

    it('rejects invalid CSRF tokens', async () => {
      const clientId = 'test-client';
      
      // Mock cache to return null (token not found)
      mockCacheManager.get.mockResolvedValue(null);
      
      const isValid = await securityService.validate_csrf_token(clientId, 'invalid-token');
      expect(isValid).toBe(false);
    });

    it('rejects tokens with mismatched client IDs', async () => {
      const token = await securityService.generate_csrf_token('client-1');
      
      // Mock cache to return token data for different client
      mockCacheManager.get.mockResolvedValue({
        created_at: new Date().toISOString(),
        client_id: 'client-1'
      });
      
      const isValid = await securityService.validate_csrf_token('client-2', token);
      expect(isValid).toBe(false);
    });

    it('handles CSRF token generation failure gracefully', async () => {
      mockCacheManager.set.mockRejectedValue(new Error('Cache error'));
      
      const token = await securityService.generate_csrf_token('test-client');
      
      // Should still return a token (fallback)
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });
  });

  describe('Security Headers', () => {
    it('provides comprehensive security headers', async () => {
      const headers = await securityService.get_security_headers();
      
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(headers).toHaveProperty('Permissions-Policy');
    });

    it('includes proper CSP directives', async () => {
      const headers = await securityService.get_security_headers();
      const csp = headers['Content-Security-Policy'];
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
    });
  });

  describe('Suspicious Behavior Detection', () => {
    it('detects and blocks repeated suspicious activities', async () => {
      mockCacheManager.get
        .mockResolvedValueOnce(3) // First check - 3 suspicious activities
        .mockResolvedValueOnce(5); // Second check - 5 suspicious activities (threshold)
      
      const request = createMockRequest({
        headers: {
          get: jest.fn().mockImplementation((header: string) => {
            if (header === 'user-agent') return 'curl/7.68.0'; // Suspicious
            return null;
          })
        },
        url: { path: '/api/forms', query: '../etc/passwd' } // Suspicious pattern
      });
      
      // First check should pass
      let result = await securityService.check_ip_reputation(request);
      expect(result).toBe(true);
      
      // Second check should block due to accumulated suspicious behavior
      result = await securityService.check_ip_reputation(request);
      expect(result).toBe(false);
    });

    it('identifies suspicious request patterns', async () => {
      const suspiciousRequests = [
        { path: '/api/forms', query: '../../../etc/passwd' },
        { path: '/api/forms', query: '<script>alert(1)</script>' },
        { path: '/api/forms', query: 'union select * from users' },
        { path: '/api/forms', query: 'exec(malicious_code)' }
      ];

      for (const { path, query } of suspiciousRequests) {
        const request = createMockRequest({
          url: { path, query }
        });

        const isSuspicious = await securityService._is_suspicious_request_pattern(request);
        expect(isSuspicious).toBe(true);
      }
    });
  });

  describe('IP Management', () => {
    it('adds and removes blocked IPs', async () => {
      const testIP = '203.0.113.100';
      
      // Add IP to block list
      await securityService.add_blocked_ip(testIP, 'testing');
      
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'sessions',
        `blocked_ip:${testIP}`,
        expect.objectContaining({
          reason: 'testing',
          blocked_at: expect.any(String)
        }),
        { ttl: 86400 * 7 }
      );
      
      // Remove IP from block list
      await securityService.remove_blocked_ip(testIP);
      
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sessions',
        `blocked_ip:${testIP}`
      );
    });
  });

  describe('Security Metrics', () => {
    it('provides security metrics and statistics', async () => {
      const metrics = await securityService.get_security_metrics();
      
      expect(metrics).toHaveProperty('blocked_ips_count');
      expect(metrics).toHaveProperty('blocked_networks_count');
      expect(metrics).toHaveProperty('rate_limit_violations_24h');
      expect(metrics).toHaveProperty('csrf_violations_24h');
      expect(metrics).toHaveProperty('xss_attempts_24h');
      expect(metrics).toHaveProperty('sql_injection_attempts_24h');
      expect(metrics).toHaveProperty('suspicious_requests_24h');
      
      expect(typeof metrics.blocked_ips_count).toBe('number');
      expect(typeof metrics.blocked_networks_count).toBe('number');
    });

    it('handles metrics collection errors gracefully', async () => {
      // Simulate error in metrics collection
      const originalBlockedIps = securityService.blocked_ips;
      Object.defineProperty(securityService, 'blocked_ips', {
        get: () => { throw new Error('Access error'); }
      });
      
      const metrics = await securityService.get_security_metrics();
      expect(metrics).toHaveProperty('error');
      
      // Restore original property
      Object.defineProperty(securityService, 'blocked_ips', {
        value: originalBlockedIps,
        writable: true
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('fails open when rate limiting fails', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache failure'));
      mockCacheManager.set.mockRejectedValue(new Error('Cache failure'));
      
      const request = createMockRequest();
      const result = await securityService.check_rate_limit('test-client', 'form_submit', request);
      
      expect(result).toBe(true); // Should fail open for availability
    });

    it('handles malformed request objects gracefully', async () => {
      const malformedRequest = {
        // Missing required properties
        url: null,
        headers: null,
        client: null
      } as any;
      
      // Should not throw errors
      await expect(securityService.check_ip_reputation(malformedRequest)).resolves.toBe(true);
      await expect(securityService.validate_request_origin(malformedRequest)).resolves.toBe(true);
    });

    it('logs security violations properly', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const request = createMockRequest();
      await securityService._log_security_violation(
        'test-client',
        'test_violation',
        'Test violation details',
        request
      );
      
      expect(mockCacheManager.set).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Client ID Generation', () => {
    it('generates user-based client ID for authenticated requests', () => {
      const request = createMockRequest({
        state: {
          user: { id: 'user123' }
        }
      });
      
      const clientId = securityService._get_client_id(request);
      expect(clientId).toBe('user:user123');
    });

    it('generates IP-based client ID for anonymous requests', () => {
      const request = createMockRequest({
        client: { host: '203.0.113.1' }
      });
      
      const clientId = securityService._get_client_id(request);
      expect(clientId).toBe('ip:203.0.113.1');
    });

    it('handles missing client information gracefully', () => {
      const request = createMockRequest({
        client: null
      });
      
      const clientId = securityService._get_client_id(request);
      expect(clientId).toBe('ip:unknown');
    });
  });
});

describe('SecurityViolation Exception', () => {
  it('creates security violation with proper details', () => {
    const violation = new SecurityViolation('rate_limit', 'Too many requests');
    
    expect(violation.violation_type).toBe('rate_limit');
    expect(violation.details).toBe('Too many requests');
    expect(violation.message).toBe('Security violation: rate_limit - Too many requests');
  });

  it('extends Error class properly', () => {
    const violation = new SecurityViolation('test', 'test details');
    
    expect(violation instanceof Error).toBe(true);
    expect(violation instanceof SecurityViolation).toBe(true);
  });
});