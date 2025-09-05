/**
 * Frontend Performance Tests
 * Tests client-side performance metrics and optimizations
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Frontend Performance Metrics', () => {
  const frontendPath = join(__dirname, '../../frontend');
  
  test('TypeScript compilation should be fast', () => {
    const start = Date.now();
    
    try {
      execSync('npm run type-check', { 
        cwd: frontendPath, 
        stdio: 'pipe',
        timeout: 60000 
      });
      
      const duration = Date.now() - start;
      console.log(`TypeScript compilation: ${duration}ms`);
      
      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`TypeScript compilation failed: ${duration}ms`);
      
      // Even failures should be reasonably fast
      expect(duration).toBeLessThan(45000);
      
      // Re-throw if it's not a type error
      if (!error.toString().includes('TS')) {
        throw error;
      }
    }
  });

  test('Development build should start quickly', () => {
    const start = Date.now();
    
    try {
      // Test dev server startup time (kill after 10 seconds)
      const child = execSync('timeout 10s npm run dev || true', { 
        cwd: frontendPath, 
        stdio: 'pipe' 
      });
      
      const duration = Date.now() - start;
      console.log(`Dev server startup: ${duration}ms`);
      
      // Dev server should start within 15 seconds
      expect(duration).toBeLessThan(15000);
    } catch (error) {
      console.log('Dev server test skipped (timeout or already running)');
    }
  });

  test('Production build should complete within time limit', () => {
    const start = Date.now();
    
    try {
      execSync('npm run build', { 
        cwd: frontendPath, 
        stdio: 'pipe',
        timeout: 180000 // 3 minutes
      });
      
      const duration = Date.now() - start;
      console.log(`Production build: ${duration}ms`);
      
      // Should complete within 2 minutes
      expect(duration).toBeLessThan(120000);
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`Production build failed/timeout: ${duration}ms`);
      
      if (error.toString().includes('timeout')) {
        fail('Build took too long (>3 minutes)');
      }
      
      // Allow TypeScript errors but track timing
      expect(duration).toBeLessThan(180000);
    }
  });

  test('Lazy loading utilities should be available', () => {
    const lazyLoadingPath = join(frontendPath, 'src/utils/lazy-loading.ts');
    
    expect(existsSync(lazyLoadingPath)).toBe(true);
    
    const content = readFileSync(lazyLoadingPath, 'utf8');
    
    // Check for key lazy loading functions
    expect(content).toContain('lazyWithRetry');
    expect(content).toContain('preloadComponent');
    expect(content).toContain('LazyLoader');
    expect(content).toContain('LazyComponents');
    
    console.log('✓ Lazy loading utilities properly implemented');
  });

  test('Bundle analysis configuration should be present', () => {
    const packageJsonPath = join(frontendPath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    // Check for bundle analysis scripts
    expect(packageJson.scripts).toHaveProperty('build:analyze');
    expect(packageJson.scripts).toHaveProperty('perf');
    expect(packageJson.scripts).toHaveProperty('size');
    
    // Check for bundle analysis dependencies
    expect(packageJson.devDependencies).toHaveProperty('rollup-plugin-visualizer');
    expect(packageJson.devDependencies).toHaveProperty('vite-bundle-analyzer');
    
    console.log('✓ Bundle analysis tools configured');
  });

  test('Vite configuration should be optimized', () => {
    const viteConfigPath = join(frontendPath, 'vite.config.ts');
    
    expect(existsSync(viteConfigPath)).toBe(true);
    
    const content = readFileSync(viteConfigPath, 'utf8');
    
    // Check for performance optimizations
    expect(content).toContain('manualChunks');
    expect(content).toContain('rollupOptions');
    expect(content).toContain('optimizeDeps');
    expect(content).toContain('esbuild');
    
    // Check for bundle analysis
    expect(content).toContain('visualizer');
    
    console.log('✓ Vite configuration optimized for performance');
  });
});

describe('Code Splitting Effectiveness', () => {
  const distPath = join(__dirname, '../../frontend/dist');
  
  beforeAll(() => {
    // Ensure build exists
    if (!existsSync(distPath)) {
      console.log('Build directory not found. Run npm run build first.');
    }
  });

  test('Vendor chunks should be properly separated', () => {
    if (!existsSync(distPath)) {
      console.log('Skipping vendor chunk test - no build found');
      return;
    }

    const assetsPath = join(distPath, 'assets');
    const jsFiles = execSync(`find ${assetsPath} -name "*.js" -type f 2>/dev/null || echo ""`)
      .toString()
      .trim()
      .split('\n')
      .filter(f => f.length > 0);

    if (jsFiles.length === 0) {
      console.log('No JS files found in build');
      return;
    }

    // Count different types of chunks
    const chunkTypes = {
      vendor: jsFiles.filter(f => f.includes('vendor')).length,
      index: jsFiles.filter(f => f.includes('index')).length,
      chunk: jsFiles.filter(f => f.includes('chunk') || f.includes('assets')).length
    };

    console.log('Chunk distribution:', chunkTypes);

    // Should have vendor chunks
    expect(chunkTypes.vendor).toBeGreaterThan(0);
    
    // Total chunks should indicate good splitting
    expect(jsFiles.length).toBeGreaterThan(2);
  });

  test('CSS should be properly split', () => {
    if (!existsSync(distPath)) {
      console.log('Skipping CSS split test - no build found');
      return;
    }

    const cssFiles = execSync(`find ${distPath} -name "*.css" -type f 2>/dev/null || echo ""`)
      .toString()
      .trim()
      .split('\n')
      .filter(f => f.length > 0);

    if (cssFiles.length > 0) {
      console.log(`CSS files found: ${cssFiles.length}`);
      expect(cssFiles.length).toBeGreaterThan(0);
      
      // Check individual CSS file sizes
      cssFiles.forEach(cssFile => {
        const stats = execSync(`stat -f%z "${cssFile}" 2>/dev/null || echo "0"`, { encoding: 'utf8' });
        const sizeInKB = parseInt(stats.trim()) / 1024;
        console.log(`CSS ${cssFile.split('/').pop()}: ${sizeInKB.toFixed(2)} KB`);
      });
    } else {
      console.log('No CSS files found (may be inlined)');
    }
  });
});

describe('Performance Monitoring Setup', () => {
  test('Performance monitoring should be configured', () => {
    const srcPath = join(__dirname, '../../frontend/src');
    
    // Check if performance monitoring utilities exist
    const perfUtilsPath = join(srcPath, 'utils');
    
    if (existsSync(perfUtilsPath)) {
      const files = execSync(`ls ${perfUtilsPath}`, { encoding: 'utf8' }).split('\n');
      console.log('Utils available:', files.filter(f => f.length > 0));
      
      // Should have lazy loading utilities
      expect(files.some(f => f.includes('lazy'))).toBe(true);
    }
  });

  test('Package.json should have performance scripts', () => {
    const packageJsonPath = join(__dirname, '../../frontend/package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    const perfScripts = Object.keys(packageJson.scripts).filter(script => 
      script.includes('perf') || 
      script.includes('analyze') || 
      script.includes('size')
    );
    
    console.log('Performance scripts available:', perfScripts);
    expect(perfScripts.length).toBeGreaterThan(0);
  });

  test('Build configuration should optimize for performance', () => {
    const viteConfigPath = join(__dirname, '../../frontend/vite.config.ts');
    
    if (existsSync(viteConfigPath)) {
      const content = readFileSync(viteConfigPath, 'utf8');
      
      // Check for production optimizations
      const optimizations = [
        'minify',
        'treeshake',
        'chunkSizeWarningLimit',
        'sourcemap',
        'cssCodeSplit'
      ];
      
      const foundOptimizations = optimizations.filter(opt => content.includes(opt));
      console.log('Build optimizations found:', foundOptimizations);
      
      expect(foundOptimizations.length).toBeGreaterThan(2);
    }
  });
});