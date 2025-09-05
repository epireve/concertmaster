/**
 * Jest Test Setup Configuration
 * Global test setup for the ConcertMaster testing environment
 */

import '@testing-library/jest-dom';

// Mock crypto.randomUUID for consistent testing
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => `test-uuid-${Date.now()}-${Math.random()}`),
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock matchMedia for CSS media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock Canvas API for React Flow
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Array(4) })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
}));

// Mock fetch API
global.fetch = jest.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  },
});

// Console error suppression for expected errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (
        args[0].includes('Warning: ReactDOM.render is no longer supported') ||
        args[0].includes('Warning: Each child in a list should have a unique "key" prop') ||
        args[0].includes('Not implemented: HTMLCanvasElement.prototype.getContext')
      )
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Add custom matchers for workflow testing
expect.extend({
  toHaveValidWorkflowStructure(received) {
    const pass = 
      received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      Array.isArray(received.nodes) &&
      Array.isArray(received.edges) &&
      ['draft', 'active', 'paused', 'archived', undefined].includes(received.status);
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have valid workflow structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have valid workflow structure`,
        pass: false,
      };
    }
  },
  
  toHaveValidNodeStructure(received) {
    const pass =
      received &&
      typeof received.id === 'string' &&
      typeof received.type === 'string' &&
      typeof received.position === 'object' &&
      typeof received.position.x === 'number' &&
      typeof received.position.y === 'number' &&
      typeof received.data === 'object' &&
      typeof received.data.label === 'string' &&
      typeof received.data.config === 'object';
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have valid node structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have valid node structure`,
        pass: false,
      };
    }
  },
  
  toHaveValidEdgeStructure(received) {
    const pass =
      received &&
      typeof received.id === 'string' &&
      typeof received.source === 'string' &&
      typeof received.target === 'string' &&
      received.source !== received.target;
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have valid edge structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have valid edge structure`,
        pass: false,
      };
    }
  },
});

// Global test data factory
export const TestDataFactory = {
  createMockWorkflow: (overrides = {}) => ({
    id: 'test-workflow-123',
    name: 'Test Workflow',
    description: 'A test workflow for unit tests',
    nodes: [],
    edges: [],
    status: 'draft' as const,
    isTemplate: false,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    ...overrides,
  }),
  
  createMockNode: (overrides = {}) => ({
    id: 'test-node-123',
    type: 'trigger',
    position: { x: 100, y: 100 },
    data: {
      label: 'Test Node',
      config: {},
    },
    ...overrides,
  }),
  
  createMockEdge: (overrides = {}) => ({
    id: 'test-edge-123',
    source: 'node-1',
    target: 'node-2',
    ...overrides,
  }),
  
  createMockWorkflowRun: (overrides = {}) => ({
    id: 'test-run-123',
    workflowId: 'test-workflow-123',
    status: 'running' as const,
    startedAt: new Date('2023-01-01T10:00:00Z'),
    ...overrides,
  }),
  
  createMockNodeExecution: (overrides = {}) => ({
    id: 'test-execution-123',
    workflowRunId: 'test-run-123',
    nodeId: 'test-node-123',
    status: 'completed' as const,
    startedAt: new Date('2023-01-01T10:00:00Z'),
    completedAt: new Date('2023-01-01T10:01:00Z'),
    ...overrides,
  }),
};

// Export type augmentations for Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidWorkflowStructure(): R;
      toHaveValidNodeStructure(): R;
      toHaveValidEdgeStructure(): R;
    }
  }
}