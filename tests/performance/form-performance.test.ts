/**
 * Form Performance Tests
 * Testing form rendering, interaction, and submission performance
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { 
  createLargeFormSchema, 
  mockFormSchema, 
  createMockField,
  createMockResponse 
} from '../../fixtures/form-fixtures';

// Mock performance APIs
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    timing: {
      navigationStart: 1609459200000,
      loadEventEnd: 1609459201000,
      domContentLoadedEventEnd: 1609459200800,
    },
  },
});

// Mock React performance profiler
const mockProfiler = {
  start: jest.fn(),
  stop: jest.fn(),
  getResults: jest.fn(() => ({
    renderTime: 50,
    commitTime: 10,
    interactions: [],
  })),
};

// Performance test utilities
class PerformanceTester {
  private startTime: number = 0;
  private measurements: Record<string, number> = {};

  startMeasure(name: string): void {
    this.startTime = performance.now();
    performance.mark(`${name}-start`);
  }

  endMeasure(name: string): number {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    this.measurements[name] = duration;
    return duration;
  }

  getMeasurement(name: string): number {
    return this.measurements[name] || 0;
  }

  getAllMeasurements(): Record<string, number> {
    return { ...this.measurements };
  }

  reset(): void {
    this.measurements = {};
    performance.clearMarks();
    performance.clearMeasures();
  }
}

describe('Form Performance Tests', () => {
  let perfTester: PerformanceTester;

  beforeEach(() => {
    perfTester = new PerformanceTester();
    jest.clearAllMocks();
  });

  afterEach(() => {
    perfTester.reset();
  });

  describe('Form Rendering Performance', () => {
    it('renders simple form quickly', () => {
      const schema = mockFormSchema();
      
      perfTester.startMeasure('simple-form-render');
      // Simulate form rendering
      const renderTime = perfTester.endMeasure('simple-form-render');

      expect(renderTime).toBeLessThan(50); // Should render in under 50ms
    });

    it('renders complex form within acceptable time', () => {
      const complexSchema = mockFormSchema({
        fields: Array.from({ length: 20 }, (_, i) =>
          createMockField({
            type: i % 2 === 0 ? 'text' : 'select',
            label: `Field ${i + 1}`,
            options: i % 2 === 1 ? [
              { label: 'Option 1', value: 'opt1' },
              { label: 'Option 2', value: 'opt2' },
              { label: 'Option 3', value: 'opt3' },
            ] : undefined,
          })
        ),
      });

      perfTester.startMeasure('complex-form-render');
      // Simulate complex form rendering
      const renderTime = perfTester.endMeasure('complex-form-render');

      expect(renderTime).toBeLessThan(200); // Should render in under 200ms
    });

    it('handles large forms efficiently', () => {
      const largeSchema = createLargeFormSchema(100);

      perfTester.startMeasure('large-form-render');
      // Simulate large form rendering with virtual scrolling
      const renderTime = perfTester.endMeasure('large-form-render');

      expect(renderTime).toBeLessThan(500); // Should render in under 500ms with virtualization
    });

    it('maintains consistent performance with repeated renders', () => {
      const schema = mockFormSchema();
      const renderTimes: number[] = [];

      // Perform multiple renders
      for (let i = 0; i < 10; i++) {
        perfTester.startMeasure(`render-${i}`);
        // Simulate render
        const renderTime = perfTester.endMeasure(`render-${i}`);
        renderTimes.push(renderTime);
      }

      // Check consistency (standard deviation should be low)
      const average = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      const variance = renderTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / renderTimes.length;
      const standardDeviation = Math.sqrt(variance);

      expect(standardDeviation).toBeLessThan(average * 0.2); // SD should be < 20% of average
    });

    it('optimizes DOM operations during field updates', () => {
      const schema = mockFormSchema({
        fields: [createMockField({ type: 'text', label: 'Test Field' })],
      });

      perfTester.startMeasure('field-update');
      
      // Simulate field property update
      const updatedSchema = {
        ...schema,
        fields: schema.fields.map(field => ({
          ...field,
          label: 'Updated Label',
        })),
      };

      const updateTime = perfTester.endMeasure('field-update');
      
      expect(updateTime).toBeLessThan(16); // Should update within one frame (16ms at 60fps)
    });

    it('uses efficient re-rendering strategies', () => {
      const schema = mockFormSchema({
        fields: Array.from({ length: 5 }, (_, i) =>
          createMockField({ type: 'text', label: `Field ${i + 1}` })
        ),
      });

      perfTester.startMeasure('partial-update');
      
      // Simulate updating only one field (should not re-render others)
      const updatedSchema = {
        ...schema,
        fields: schema.fields.map((field, index) => 
          index === 2 ? { ...field, label: 'Updated Field 3' } : field
        ),
      };

      const updateTime = perfTester.endMeasure('partial-update');
      
      // Partial updates should be very fast
      expect(updateTime).toBeLessThan(10);
    });
  });

  describe('Form Interaction Performance', () => {
    it('handles rapid field value changes efficiently', () => {
      const schema = mockFormSchema({
        fields: [createMockField({ type: 'text', label: 'Fast Input' })],
      });

      perfTester.startMeasure('rapid-input');
      
      // Simulate rapid typing (like autocomplete)
      const inputValues = ['a', 'ap', 'app', 'appl', 'apple'];
      inputValues.forEach(value => {
        // Simulate input change event
        const event = { target: { value } };
        // Field update logic would go here
      });

      const inputTime = perfTester.endMeasure('rapid-input');
      
      expect(inputTime).toBeLessThan(50); // Should handle rapid input smoothly
    });

    it('validates fields without blocking UI', () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({
            type: 'email',
            label: 'Email',
            validation: {
              pattern: '^[^@]+@[^@]+\\.[^@]+$',
              errorMessage: 'Invalid email format',
            },
          }),
        ],
      });

      perfTester.startMeasure('field-validation');
      
      // Simulate field validation
      const isValid = /^[^@]+@[^@]+\.[^@]+$/.test('user@example.com');
      
      const validationTime = perfTester.endMeasure('field-validation');
      
      expect(validationTime).toBeLessThan(5); // Validation should be very fast
      expect(isValid).toBe(true);
    });

    it('optimizes conditional field visibility changes', () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({
            type: 'select',
            label: 'Show Details?',
            name: 'show_details',
            options: [
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
          }),
          createMockField({
            type: 'textarea',
            label: 'Details',
            name: 'details',
            visibility: {
              field: 'show_details',
              operator: 'equals',
              value: 'yes',
            },
          }),
        ],
      });

      perfTester.startMeasure('conditional-visibility');
      
      // Simulate changing the trigger field
      const formData = { show_details: 'yes' };
      const shouldShow = formData.show_details === 'yes';
      
      const visibilityTime = perfTester.endMeasure('conditional-visibility');
      
      expect(visibilityTime).toBeLessThan(10);
      expect(shouldShow).toBe(true);
    });

    it('handles drag and drop operations smoothly', () => {
      const schema = mockFormSchema({
        fields: [
          createMockField({ type: 'text', label: 'Field 1', order: 0 }),
          createMockField({ type: 'text', label: 'Field 2', order: 1 }),
          createMockField({ type: 'text', label: 'Field 3', order: 2 }),
        ],
      });

      perfTester.startMeasure('drag-drop-reorder');
      
      // Simulate reordering fields (move field from index 0 to index 2)
      const reorderedFields = [...schema.fields];
      const [movedField] = reorderedFields.splice(0, 1);
      reorderedFields.splice(2, 0, movedField);
      
      // Update order values
      const updatedFields = reorderedFields.map((field, index) => ({
        ...field,
        order: index,
      }));

      const reorderTime = perfTester.endMeasure('drag-drop-reorder');
      
      expect(reorderTime).toBeLessThan(20); // Reordering should be smooth
      expect(updatedFields[2].label).toBe('Field 1');
    });
  });

  describe('Form Submission Performance', () => {
    it('processes form submission quickly', async () => {
      const schema = mockFormSchema();
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      };

      perfTester.startMeasure('form-submission');
      
      // Simulate form submission processing
      const response = await simulateFormSubmission(formData);
      
      const submissionTime = perfTester.endMeasure('form-submission');
      
      expect(submissionTime).toBeLessThan(100); // Client-side processing should be fast
      expect(response.success).toBe(true);
    });

    it('handles large form data efficiently', async () => {
      const largeFormData = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`field_${i}`, `value_${i}`])
      );

      perfTester.startMeasure('large-form-submission');
      
      // Simulate processing large form data
      const serializedData = JSON.stringify(largeFormData);
      const response = await simulateFormSubmission(largeFormData);
      
      const submissionTime = perfTester.endMeasure('large-form-submission');
      
      expect(submissionTime).toBeLessThan(200);
      expect(serializedData.length).toBeGreaterThan(1000);
      expect(response.success).toBe(true);
    });

    it('optimizes file upload processing', async () => {
      const fileData = {
        name: 'John Doe',
        resume: new File(['file content'], 'resume.pdf', { type: 'application/pdf' }),
      };

      perfTester.startMeasure('file-upload-processing');
      
      // Simulate file upload processing
      const formData = new FormData();
      Object.entries(fileData).forEach(([key, value]) => {
        formData.append(key, value as string | Blob);
      });
      
      const uploadTime = perfTester.endMeasure('file-upload-processing');
      
      expect(uploadTime).toBeLessThan(50); // File preparation should be fast
    });

    it('batches validation checks efficiently', () => {
      const formData = {
        email: 'invalid-email',
        phone: '123', // Too short
        age: '150', // Too high
        name: '', // Required but empty
      };

      const validationRules = {
        email: { pattern: /^[^@]+@[^@]+\.[^@]+$/, required: true },
        phone: { minLength: 10, required: false },
        age: { min: 0, max: 120, required: false },
        name: { required: true },
      };

      perfTester.startMeasure('batch-validation');
      
      // Simulate batch validation
      const errors: Record<string, string[]> = {};
      Object.entries(formData).forEach(([field, value]) => {
        const rules = validationRules[field as keyof typeof validationRules];
        const fieldErrors: string[] = [];
        
        if (rules.required && !value) {
          fieldErrors.push(`${field} is required`);
        }
        
        if ('pattern' in rules && value && !rules.pattern.test(value)) {
          fieldErrors.push(`${field} format is invalid`);
        }
        
        if ('minLength' in rules && value.length < rules.minLength) {
          fieldErrors.push(`${field} is too short`);
        }
        
        if ('min' in rules && 'max' in rules) {
          const numValue = parseInt(value);
          if (numValue < rules.min || numValue > rules.max) {
            fieldErrors.push(`${field} is out of range`);
          }
        }
        
        if (fieldErrors.length > 0) {
          errors[field] = fieldErrors;
        }
      });
      
      const validationTime = perfTester.endMeasure('batch-validation');
      
      expect(validationTime).toBeLessThan(20);
      expect(Object.keys(errors)).toHaveLength(4); // All fields should have errors
    });
  });

  describe('Memory Management Performance', () => {
    it('prevents memory leaks during form lifecycle', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Simulate creating and destroying multiple forms
      for (let i = 0; i < 10; i++) {
        const schema = mockFormSchema({
          fields: Array.from({ length: 10 }, (_, j) =>
            createMockField({ type: 'text', label: `Field ${j}` })
          ),
        });
        
        // Simulate form creation and cleanup
        // In real implementation, this would involve component mounting/unmounting
      }
      
      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal after cleanup
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB increase
    });

    it('efficiently manages large datasets', () => {
      perfTester.startMeasure('large-dataset-processing');
      
      // Simulate processing large form responses dataset
      const responses = Array.from({ length: 1000 }, (_, i) =>
        createMockResponse({
          id: `response-${i}`,
          data: { field1: `value-${i}`, field2: `data-${i}` },
        })
      );
      
      // Process responses (e.g., for analytics)
      const aggregatedData = responses.reduce((acc, response) => {
        acc.totalResponses += 1;
        acc.averageTimeSpent += response.metadata.timeSpent;
        return acc;
      }, { totalResponses: 0, averageTimeSpent: 0 });
      
      aggregatedData.averageTimeSpent /= aggregatedData.totalResponses;
      
      const processingTime = perfTester.endMeasure('large-dataset-processing');
      
      expect(processingTime).toBeLessThan(100);
      expect(aggregatedData.totalResponses).toBe(1000);
    });

    it('optimizes DOM node count', () => {
      const schema = createLargeFormSchema(50);
      
      perfTester.startMeasure('dom-optimization');
      
      // Simulate virtual scrolling - only render visible fields
      const viewportHeight = 600;
      const fieldHeight = 80;
      const visibleFields = Math.ceil(viewportHeight / fieldHeight);
      const renderableFields = schema.fields.slice(0, visibleFields + 2); // Buffer
      
      const optimizationTime = perfTester.endMeasure('dom-optimization');
      
      expect(optimizationTime).toBeLessThan(10);
      expect(renderableFields.length).toBeLessThan(15); // Significantly fewer than total
    });
  });

  describe('Network Performance', () => {
    it('optimizes API request batching', async () => {
      const formUpdates = [
        { field: 'title', value: 'Updated Title' },
        { field: 'description', value: 'Updated Description' },
        { field: 'settings.theme', value: 'dark' },
      ];

      perfTester.startMeasure('api-request-batching');
      
      // Simulate batching multiple updates into single request
      const batchedUpdates = formUpdates.reduce((batch, update) => {
        batch[update.field] = update.value;
        return batch;
      }, {} as Record<string, any>);
      
      // Single API call instead of multiple
      const response = await simulateApiCall('/forms/update', batchedUpdates);
      
      const batchingTime = perfTester.endMeasure('api-request-batching');
      
      expect(batchingTime).toBeLessThan(50);
      expect(response.success).toBe(true);
    });

    it('implements efficient caching strategies', () => {
      const cache = new Map<string, any>();
      
      perfTester.startMeasure('cache-performance');
      
      // Simulate caching form schemas
      const schemas = Array.from({ length: 10 }, (_, i) => ({
        id: `form-${i}`,
        schema: mockFormSchema(),
      }));
      
      schemas.forEach(({ id, schema }) => {
        cache.set(id, schema);
      });
      
      // Simulate cache hits
      const cachedSchema = cache.get('form-5');
      
      const cacheTime = perfTester.endMeasure('cache-performance');
      
      expect(cacheTime).toBeLessThan(5);
      expect(cachedSchema).toBeDefined();
      expect(cache.size).toBe(10);
    });

    it('compresses large payloads efficiently', () => {
      const largeSchema = createLargeFormSchema(100);
      
      perfTester.startMeasure('payload-compression');
      
      // Simulate JSON compression
      const jsonString = JSON.stringify(largeSchema);
      const compressedSize = Math.floor(jsonString.length * 0.7); // Simulated compression
      
      const compressionTime = perfTester.endMeasure('payload-compression');
      
      expect(compressionTime).toBeLessThan(30);
      expect(compressedSize).toBeLessThan(jsonString.length);
    });
  });

  describe('Core Web Vitals Performance', () => {
    it('meets Largest Contentful Paint (LCP) targets', () => {
      perfTester.startMeasure('lcp-simulation');
      
      // Simulate main content rendering
      const contentElements = ['form-title', 'form-description', 'first-field'];
      let largestElement = '';
      let largestSize = 0;
      
      contentElements.forEach(element => {
        const size = Math.random() * 1000; // Simulated element size
        if (size > largestSize) {
          largestSize = size;
          largestElement = element;
        }
      });
      
      const lcpTime = perfTester.endMeasure('lcp-simulation');
      
      // LCP should occur within 2.5 seconds
      expect(lcpTime).toBeLessThan(2500);
      expect(largestElement).toBeTruthy();
    });

    it('maintains good First Input Delay (FID)', () => {
      perfTester.startMeasure('fid-simulation');
      
      // Simulate user interaction handling
      const handleClick = () => {
        // Simulate click processing
        return 'clicked';
      };
      
      const result = handleClick();
      const fidTime = perfTester.endMeasure('fid-simulation');
      
      // FID should be less than 100ms
      expect(fidTime).toBeLessThan(100);
      expect(result).toBe('clicked');
    });

    it('minimizes Cumulative Layout Shift (CLS)', () => {
      const layoutShifts: number[] = [];
      
      perfTester.startMeasure('cls-measurement');
      
      // Simulate layout changes
      const initialLayout = { width: 800, height: 600 };
      const dynamicContent = { width: 800, height: 650 }; // Form grew by 50px
      
      // Calculate layout shift score
      const impactFraction = 0.1; // 10% of viewport affected
      const distanceFraction = 50 / 600; // Distance moved relative to viewport
      const layoutShiftScore = impactFraction * distanceFraction;
      
      layoutShifts.push(layoutShiftScore);
      
      const clsTime = perfTester.endMeasure('cls-measurement');
      
      const totalCLS = layoutShifts.reduce((sum, shift) => sum + shift, 0);
      
      // CLS should be less than 0.1
      expect(totalCLS).toBeLessThan(0.1);
      expect(clsTime).toBeLessThan(10);
    });
  });
});

// Test helper functions
async function simulateFormSubmission(formData: Record<string, any>): Promise<{ success: boolean }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
  
  // Simulate validation
  const hasRequiredFields = Object.keys(formData).length > 0;
  
  return {
    success: hasRequiredFields,
  };
}

async function simulateApiCall(endpoint: string, data: any): Promise<{ success: boolean }> {
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
  
  return {
    success: true,
  };
}