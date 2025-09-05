/**
 * Test Mocking Utilities
 * Centralized mocks for APIs, services, and external dependencies
 */

import { FormSchema, FormField, FormResponse, FormAnalytics } from '../../frontend/src/types/forms';

// API Mock Factory
export class ApiMockFactory {
  private static responses = new Map<string, any>();
  private static delays = new Map<string, number>();
  private static errors = new Map<string, Error>();

  static setResponse(endpoint: string, response: any): void {
    this.responses.set(endpoint, response);
  }

  static setDelay(endpoint: string, delay: number): void {
    this.delays.set(endpoint, delay);
  }

  static setError(endpoint: string, error: Error): void {
    this.errors.set(endpoint, error);
  }

  static async mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();
    const endpoint = this.extractEndpoint(url);

    // Simulate network delay
    const delay = this.delays.get(endpoint) || Math.random() * 100;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Check for configured errors
    if (this.errors.has(endpoint)) {
      throw this.errors.get(endpoint);
    }

    // Get configured response
    const mockResponse = this.responses.get(endpoint);
    if (mockResponse) {
      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default responses based on endpoint patterns
    return this.getDefaultResponse(endpoint, init);
  }

  private static extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url, 'http://localhost');
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  private static getDefaultResponse(endpoint: string, init?: RequestInit): Response {
    const method = init?.method || 'GET';

    // Default responses for common endpoints
    if (endpoint.includes('/forms') && method === 'POST') {
      return new Response(JSON.stringify({
        success: true,
        data: { id: 'new-form-id', message: 'Form created successfully' },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (endpoint.includes('/forms') && method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        data: { forms: [] },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (endpoint.includes('/submissions') && method === 'POST') {
      return new Response(JSON.stringify({
        success: true,
        data: { id: 'new-submission-id', message: 'Submission created successfully' },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default 404 response
    return new Response(JSON.stringify({
      success: false,
      error: { message: 'Not found', code: 'NOT_FOUND' },
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  static reset(): void {
    this.responses.clear();
    this.delays.clear();
    this.errors.clear();
  }
}

// Form API Mocks
export const mockFormApi = {
  createForm: jest.fn(),
  updateForm: jest.fn(),
  deleteForm: jest.fn(),
  getForm: jest.fn(),
  listForms: jest.fn(),
  submitResponse: jest.fn(),
  getResponses: jest.fn(),
  getAnalytics: jest.fn(),
  exportResponses: jest.fn(),
};

// Default mock implementations
mockFormApi.createForm.mockImplementation(async (formData: Partial<FormSchema>) => ({
  success: true,
  data: {
    id: 'new-form-id',
    ...formData,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}));

mockFormApi.updateForm.mockImplementation(async (id: string, formData: Partial<FormSchema>) => ({
  success: true,
  data: {
    id,
    ...formData,
    updatedAt: new Date(),
  },
}));

mockFormApi.deleteForm.mockImplementation(async (id: string) => ({
  success: true,
  data: { id, deleted: true },
}));

mockFormApi.getForm.mockImplementation(async (id: string) => ({
  success: true,
  data: {
    id,
    title: 'Mock Form',
    fields: [],
    settings: {},
    styling: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}));

mockFormApi.listForms.mockImplementation(async () => ({
  success: true,
  data: { forms: [], total: 0, page: 1, limit: 10 },
}));

mockFormApi.submitResponse.mockImplementation(async (formId: string, responseData: any) => ({
  success: true,
  data: {
    id: 'new-response-id',
    formId,
    data: responseData,
    submittedAt: new Date(),
  },
}));

// Storage Mocks
export const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

export const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

// File API Mocks
export class MockFile implements File {
  readonly lastModified: number;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly webkitRelativePath: string = '';

  constructor(
    bits: BlobPart[],
    name: string,
    options?: FilePropertyBag
  ) {
    this.name = name;
    this.size = bits.reduce((size, bit) => size + (typeof bit === 'string' ? bit.length : bit.size || 0), 0);
    this.type = options?.type || '';
    this.lastModified = options?.lastModified || Date.now();
  }

  slice(start?: number, end?: number, contentType?: string): Blob {
    return new Blob([], { type: contentType });
  }

  stream(): ReadableStream<Uint8Array> {
    return new ReadableStream();
  }

  text(): Promise<string> {
    return Promise.resolve('mock file content');
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
}

export class MockFileReader implements FileReader {
  readonly EMPTY = 0;
  readonly LOADING = 1;
  readonly DONE = 2;

  readyState: number = this.EMPTY;
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;

  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsArrayBuffer(file: Blob): void {
    this.mockRead(file, 'arraybuffer');
  }

  readAsBinaryString(file: Blob): void {
    this.mockRead(file, 'binarystring');
  }

  readAsDataURL(file: Blob): void {
    this.mockRead(file, 'dataurl');
  }

  readAsText(file: Blob, encoding?: string): void {
    this.mockRead(file, 'text');
  }

  abort(): void {
    this.readyState = this.EMPTY;
    if (this.onabort) {
      this.onabort(new ProgressEvent('abort'));
    }
  }

  private mockRead(file: Blob, type: string): void {
    this.readyState = this.LOADING;
    
    if (this.onloadstart) {
      this.onloadstart(new ProgressEvent('loadstart'));
    }

    setTimeout(() => {
      this.readyState = this.DONE;
      
      switch (type) {
        case 'text':
          this.result = 'mock file content';
          break;
        case 'dataurl':
          this.result = `data:${file.type};base64,bW9jayBmaWxlIGNvbnRlbnQ=`;
          break;
        case 'arraybuffer':
          this.result = new ArrayBuffer(file.size);
          break;
        case 'binarystring':
          this.result = 'mock binary content';
          break;
        default:
          this.result = null;
      }

      if (this.onload) {
        this.onload(new ProgressEvent('load'));
      }

      if (this.onloadend) {
        this.onloadend(new ProgressEvent('loadend'));
      }
    }, 10);
  }

  addEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  removeEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  dispatchEvent(event: Event): boolean {
    return true;
  }
}

// WebSocket Mock
export class MockWebSocket implements WebSocket {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readonly url: string;
  readyState: number = this.CONNECTING;
  bufferedAmount: number = 0;
  extensions: string = '';
  protocol: string = '';
  binaryType: BinaryType = 'blob';

  onopen: ((this: WebSocket, ev: Event) => any) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
  onerror: ((this: WebSocket, ev: Event) => any) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;

  constructor(url: string | URL, protocols?: string | string[]) {
    this.url = url.toString();
    
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = this.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== this.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    // Mock sending data
    this.bufferedAmount += typeof data === 'string' ? data.length : 0;
    
    // Simulate data being sent
    setTimeout(() => {
      this.bufferedAmount = 0;
    }, 1);
  }

  close(code?: number, reason?: string): void {
    this.readyState = this.CLOSING;
    
    setTimeout(() => {
      this.readyState = this.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code: code || 1000, reason }));
      }
    }, 10);
  }

  addEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  removeEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  dispatchEvent(event: Event): boolean {
    return true;
  }

  // Utility method for testing
  mockReceiveMessage(data: any): void {
    if (this.onmessage && this.readyState === this.OPEN) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }
}

// Notification API Mock
export const mockNotification = {
  requestPermission: jest.fn().mockResolvedValue('granted'),
  permission: 'default' as NotificationPermission,
};

export class MockNotificationInstance implements Notification {
  readonly actions: readonly NotificationAction[] = [];
  readonly badge?: string;
  readonly body?: string;
  readonly data: any;
  readonly dir: NotificationDirection = 'auto';
  readonly icon?: string;
  readonly image?: string;
  readonly lang: string = '';
  readonly renotify: boolean = false;
  readonly requireInteraction: boolean = false;
  readonly silent: boolean = false;
  readonly tag: string = '';
  readonly timestamp: number = Date.now();
  readonly title: string;
  readonly vibrate: readonly number[] = [];

  onclick: ((this: Notification, ev: Event) => any) | null = null;
  onclose: ((this: Notification, ev: Event) => any) | null = null;
  onerror: ((this: Notification, ev: Event) => any) | null = null;
  onshow: ((this: Notification, ev: Event) => any) | null = null;

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.body = options?.body;
    this.icon = options?.icon;
    this.data = options?.data;
    
    // Simulate notification showing
    setTimeout(() => {
      if (this.onshow) {
        this.onshow(new Event('show'));
      }
    }, 10);
  }

  close(): void {
    if (this.onclose) {
      this.onclose(new Event('close'));
    }
  }

  addEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  removeEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  dispatchEvent(event: Event): boolean {
    return true;
  }
}

// Geolocation API Mock
export const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

// Default geolocation success
mockGeolocation.getCurrentPosition.mockImplementation((success: PositionCallback) => {
  const position: GeolocationPosition = {
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
  
  setTimeout(() => success(position), 100);
});

// Performance Observer Mock
export class MockPerformanceObserver implements PerformanceObserver {
  private callback: PerformanceObserverCallback;
  private entries: PerformanceEntry[] = [];

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }

  observe(options: PerformanceObserverInit): void {
    // Mock implementation - would observe performance entries
    setTimeout(() => {
      const list = {
        getEntries: () => this.entries,
        getEntriesByName: (name: string) => this.entries.filter(e => e.name === name),
        getEntriesByType: (type: string) => this.entries.filter(e => e.entryType === type),
      } as PerformanceObserverEntryList;

      this.callback(list, this);
    }, 10);
  }

  disconnect(): void {
    // Mock implementation
  }

  takeRecords(): PerformanceEntryList {
    return this.entries;
  }

  // Test utility to add mock entries
  addMockEntry(entry: PerformanceEntry): void {
    this.entries.push(entry);
  }
}

// Intersection Observer Mock
export class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  private callback: IntersectionObserverCallback;
  private elements: Element[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
  }

  observe(target: Element): void {
    this.elements.push(target);
    
    // Simulate intersection
    setTimeout(() => {
      const entries: IntersectionObserverEntry[] = [{
        target,
        time: Date.now(),
        rootBounds: null,
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRect: target.getBoundingClientRect(),
        intersectionRatio: 1,
        isIntersecting: true,
      }];
      
      this.callback(entries, this);
    }, 10);
  }

  unobserve(target: Element): void {
    this.elements = this.elements.filter(el => el !== target);
  }

  disconnect(): void {
    this.elements = [];
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  // Test utility to trigger intersection
  triggerIntersection(target: Element, isIntersecting: boolean): void {
    const entries: IntersectionObserverEntry[] = [{
      target,
      time: Date.now(),
      rootBounds: null,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: isIntersecting ? target.getBoundingClientRect() : new DOMRect(),
      intersectionRatio: isIntersecting ? 1 : 0,
      isIntersecting,
    }];
    
    this.callback(entries, this);
  }
}

// Resize Observer Mock
export class MockResizeObserver implements ResizeObserver {
  private callback: ResizeObserverCallback;
  private elements: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element, options?: ResizeObserverOptions): void {
    this.elements.push(target);
    
    // Simulate initial observation
    setTimeout(() => {
      const entries: ResizeObserverEntry[] = [{
        target,
        contentRect: target.getBoundingClientRect(),
        borderBoxSize: [{ blockSize: 100, inlineSize: 200 }],
        contentBoxSize: [{ blockSize: 100, inlineSize: 200 }],
        devicePixelContentBoxSize: [{ blockSize: 100, inlineSize: 200 }],
      }];
      
      this.callback(entries, this);
    }, 10);
  }

  unobserve(target: Element): void {
    this.elements = this.elements.filter(el => el !== target);
  }

  disconnect(): void {
    this.elements = [];
  }

  // Test utility to trigger resize
  triggerResize(target: Element, size: { width: number; height: number }): void {
    const entries: ResizeObserverEntry[] = [{
      target,
      contentRect: new DOMRect(0, 0, size.width, size.height),
      borderBoxSize: [{ blockSize: size.height, inlineSize: size.width }],
      contentBoxSize: [{ blockSize: size.height, inlineSize: size.width }],
      devicePixelContentBoxSize: [{ blockSize: size.height, inlineSize: size.width }],
    }];
    
    this.callback(entries, this);
  }
}

// Export all mocks for easy setup
export function setupGlobalMocks(): void {
  // Replace global fetch
  global.fetch = ApiMockFactory.mockFetch;
  
  // Replace storage
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
  Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });
  
  // Replace file APIs
  global.File = MockFile;
  global.FileReader = MockFileReader;
  
  // Replace WebSocket
  global.WebSocket = MockWebSocket;
  
  // Replace Notification
  global.Notification = MockNotificationInstance;
  Object.defineProperty(Notification, 'requestPermission', { 
    value: mockNotification.requestPermission 
  });
  Object.defineProperty(Notification, 'permission', { 
    value: mockNotification.permission 
  });
  
  // Replace Geolocation
  Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation });
  
  // Replace Observers
  global.PerformanceObserver = MockPerformanceObserver;
  global.IntersectionObserver = MockIntersectionObserver;
  global.ResizeObserver = MockResizeObserver;
}

// Cleanup function for tests
export function cleanupMocks(): void {
  ApiMockFactory.reset();
  jest.clearAllMocks();
  
  // Reset localStorage
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  mockLocalStorage.removeItem.mockClear();
  mockLocalStorage.clear.mockClear();
  
  // Reset sessionStorage
  mockSessionStorage.getItem.mockClear();
  mockSessionStorage.setItem.mockClear();
  mockSessionStorage.removeItem.mockClear();
  mockSessionStorage.clear.mockClear();
}