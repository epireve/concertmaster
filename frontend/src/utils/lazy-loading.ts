/**
 * Lazy Loading Utilities
 * Optimized code splitting and dynamic imports for performance
 */
import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Enhanced lazy loading with retry and error handling
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  maxRetries: number = 3
): LazyExoticComponent<T> {
  return lazy(() => {
    let retryCount = 0;
    
    const loadComponent = async (): Promise<{ default: T }> => {
      try {
        return await importFn();
      } catch (error) {
        console.error(`Failed to load component ${componentName}:`, error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying to load ${componentName} (attempt ${retryCount}/${maxRetries})`);
          
          // Exponential backoff delay
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retryCount) * 1000)
          );
          
          return loadComponent();
        }
        
        throw error;
      }
    };
    
    return loadComponent();
  });
}

/**
 * Preload component for better UX
 */
export function preloadComponent<T>(importFn: () => Promise<T>): () => Promise<T> {
  let componentPromise: Promise<T> | null = null;
  
  return () => {
    if (!componentPromise) {
      componentPromise = importFn().catch((error) => {
        // Reset promise on error so retry is possible
        componentPromise = null;
        throw error;
      });
    }
    return componentPromise;
  };
}

/**
 * Lazy load with prefetch on hover
 */
export function lazyWithPrefetch<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string
): { 
  Component: LazyExoticComponent<T>;
  prefetch: () => void;
} {
  const preloader = preloadComponent(importFn);
  
  return {
    Component: lazyWithRetry(importFn, componentName),
    prefetch: () => {
      preloader().catch(error => {
        console.warn(`Failed to prefetch ${componentName}:`, error);
      });
    }
  };
}

/**
 * Intersection Observer for lazy loading images and components
 */
export class LazyLoader {
  private observer: IntersectionObserver | null = null;
  private loadedElements = new Set<Element>();

  constructor(options: IntersectionObserverInit = {}) {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        this.handleIntersection.bind(this),
        {
          rootMargin: '50px 0px', // Load 50px before element enters viewport
          threshold: 0.1,
          ...options,
        }
      );
    }
  }

  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !this.loadedElements.has(entry.target)) {
        this.loadedElements.add(entry.target);
        this.loadElement(entry.target);
        this.observer?.unobserve(entry.target);
      }
    });
  }

  private loadElement(element: Element) {
    // Handle lazy loading of images
    if (element instanceof HTMLImageElement) {
      const dataSrc = element.dataset.src;
      if (dataSrc) {
        element.src = dataSrc;
        element.classList.remove('lazy-loading');
        element.classList.add('lazy-loaded');
      }
    }

    // Handle custom lazy loading callbacks
    const lazyCallback = element.getAttribute('data-lazy-callback');
    if (lazyCallback && window[lazyCallback as keyof Window]) {
      (window[lazyCallback as keyof Window] as Function)(element);
    }

    // Dispatch custom event for component-level handling
    element.dispatchEvent(new CustomEvent('lazyload', {
      detail: { element }
    }));
  }

  observe(element: Element) {
    if (this.observer) {
      this.observer.observe(element);
    } else {
      // Fallback for browsers without IntersectionObserver
      this.loadElement(element);
    }
  }

  unobserve(element: Element) {
    if (this.observer) {
      this.observer.unobserve(element);
    }
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.loadedElements.clear();
  }
}

/**
 * Hook for using lazy loader in React components
 */
export function useLazyLoader() {
  const loaderRef = React.useRef<LazyLoader | null>(null);

  React.useEffect(() => {
    if (!loaderRef.current) {
      loaderRef.current = new LazyLoader();
    }

    return () => {
      if (loaderRef.current) {
        loaderRef.current.disconnect();
        loaderRef.current = null;
      }
    };
  }, []);

  return loaderRef.current;
}

/**
 * Lazy loading configuration for different component types
 */
export const LazyComponents = {

  // Heavy components with prefetch
  WorkflowCanvas: lazyWithPrefetch(
    () => import('@/components/workflow/WorkflowCanvas'),
    'WorkflowCanvas'
  ),
};

// Global lazy loader instance
export const globalLazyLoader = new LazyLoader();

// Auto-initialize lazy loading for images with data-src
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => globalLazyLoader.observe(img));
  });
}

// Export React for the hook
import * as React from 'react';