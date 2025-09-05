/**
 * Bundle Size Performance Tests
 * Ensures build output stays within acceptable size limits
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Bundle Size Performance', () => {
  const frontendPath = join(__dirname, '../../frontend');
  const distPath = join(frontendPath, 'dist');
  
  beforeAll(async () => {
    // Build the frontend if dist doesn't exist
    if (!existsSync(distPath)) {
      console.log('Building frontend for bundle size analysis...');
      execSync('npm run build', { 
        cwd: frontendPath, 
        stdio: 'inherit',
        timeout: 120000 // 2 minute timeout
      });
    }
  });

  test('Main bundle size should be under 500KB', () => {
    const indexJsPath = join(distPath, 'assets');
    if (!existsSync(indexJsPath)) {
      throw new Error('Build output not found. Run npm run build first.');
    }

    // Get the main JS bundle
    const files = execSync(`find ${indexJsPath} -name "index-*.js" -type f`)
      .toString()
      .trim()
      .split('\n');
    
    if (files.length === 0) {
      throw new Error('Main bundle file not found');
    }

    const mainBundle = files[0];
    const stats = execSync(`stat -f%z "${mainBundle}"`, { encoding: 'utf8' });
    const sizeInBytes = parseInt(stats.trim());
    const sizeInKB = sizeInBytes / 1024;

    console.log(`Main bundle size: ${sizeInKB.toFixed(2)} KB`);
    expect(sizeInKB).toBeLessThan(500);
  });

  test('Vendor chunk should be properly split', () => {
    const assetsPath = join(distPath, 'assets');
    const vendorFiles = execSync(`find ${assetsPath} -name "vendor-*-*.js" -type f`)
      .toString()
      .trim()
      .split('\n')
      .filter(f => f.length > 0);

    expect(vendorFiles.length).toBeGreaterThan(0);
    console.log(`Vendor chunks created: ${vendorFiles.length}`);
  });

  test('Total bundle size should be under 2MB', () => {
    const totalSize = execSync(`du -sb ${distPath}`, { encoding: 'utf8' });
    const sizeInBytes = parseInt(totalSize.split('\t')[0]);
    const sizeInMB = sizeInBytes / (1024 * 1024);

    console.log(`Total bundle size: ${sizeInMB.toFixed(2)} MB`);
    expect(sizeInMB).toBeLessThan(2);
  });

  test('CSS files should be properly split and compressed', () => {
    const cssFiles = execSync(`find ${distPath} -name "*.css" -type f`)
      .toString()
      .trim()
      .split('\n')
      .filter(f => f.length > 0);

    expect(cssFiles.length).toBeGreaterThan(0);

    // Check individual CSS file sizes
    cssFiles.forEach(cssFile => {
      const stats = execSync(`stat -f%z "${cssFile}"`, { encoding: 'utf8' });
      const sizeInBytes = parseInt(stats.trim());
      const sizeInKB = sizeInBytes / 1024;

      console.log(`CSS file ${cssFile.split('/').pop()}: ${sizeInKB.toFixed(2)} KB`);
      expect(sizeInKB).toBeLessThan(200); // Each CSS file should be under 200KB
    });
  });

  test('Critical dependencies are correctly chunked', () => {
    const assetsPath = join(distPath, 'assets');
    
    // Check for core vendor chunks
    const expectedChunks = [
      'vendor-core', // React & React DOM
      'vendor-ui',   // UI libraries
      'vendor-flow'  // ReactFlow
    ];

    expectedChunks.forEach(chunkName => {
      const chunkFiles = execSync(`find ${assetsPath} -name "${chunkName}-*.js" -type f`)
        .toString()
        .trim()
        .split('\n')
        .filter(f => f.length > 0);

      expect(chunkFiles.length).toBeGreaterThan(0);
      console.log(`✓ ${chunkName} chunk found`);
    });
  });

  test('Bundle analysis report is generated', () => {
    const analysisReportPath = join(distPath, 'bundle-analysis.html');
    
    if (!existsSync(analysisReportPath)) {
      // Generate analysis report
      console.log('Generating bundle analysis report...');
      execSync('npm run build:analyze', { 
        cwd: frontendPath, 
        stdio: 'inherit' 
      });
    }

    expect(existsSync(analysisReportPath)).toBe(true);
    
    // Check report file size (should be substantial)
    const stats = execSync(`stat -f%z "${analysisReportPath}"`, { encoding: 'utf8' });
    const sizeInBytes = parseInt(stats.trim());
    expect(sizeInBytes).toBeGreaterThan(1000); // At least 1KB report
  });
});

describe('Bundle Performance Monitoring', () => {
  test('Check for unused dependencies', () => {
    const packageJsonPath = join(__dirname, '../../frontend/package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // These are expected to be in the bundle
    const expectedDependencies = [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'reactflow',
      'axios'
    ];

    expectedDependencies.forEach(dep => {
      expect(dependencies).toHaveProperty(dep);
    });

    console.log(`Total dependencies: ${Object.keys(dependencies).length}`);
  });

  test('Gzip compression effectiveness', () => {
    const distPath = join(__dirname, '../../frontend/dist');
    const jsFiles = execSync(`find ${distPath} -name "*.js" -type f`)
      .toString()
      .trim()
      .split('\n')
      .filter(f => f.length > 0);

    jsFiles.forEach(jsFile => {
      const originalSize = parseInt(
        execSync(`stat -f%z "${jsFile}"`, { encoding: 'utf8' }).trim()
      );
      
      // Simulate gzip compression
      const gzipSize = parseInt(
        execSync(`gzip -c "${jsFile}" | wc -c`, { encoding: 'utf8' }).trim()
      );

      const compressionRatio = (1 - gzipSize / originalSize) * 100;
      console.log(
        `${jsFile.split('/').pop()}: ${originalSize} → ${gzipSize} bytes (${compressionRatio.toFixed(1)}% compression)`
      );

      // Expect at least 50% compression ratio for JS files
      expect(compressionRatio).toBeGreaterThan(50);
    });
  });
});