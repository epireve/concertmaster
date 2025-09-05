/**
 * Global E2E Test Teardown
 * Cleans up test environment and resources after all tests complete
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test environment cleanup...');

  try {
    // Clean up test database
    console.log('🗑️ Cleaning test database...');
    await cleanupTestDatabase();

    // Stop development servers (they'll be running in background)
    console.log('🛑 Stopping test servers...');
    await stopTestServers();

    // Clean up temporary files
    console.log('📁 Cleaning temporary files...');
    await cleanupTemporaryFiles();

    // Generate test artifacts summary
    console.log('📋 Generating test artifacts summary...');
    await generateTestSummary();

    console.log('✅ E2E test environment cleanup completed!');

  } catch (error) {
    console.error('❌ E2E test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

async function cleanupTestDatabase() {
  try {
    // Call backend endpoint to clean up test data
    await fetch('http://localhost:8000/test/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.warn('Failed to cleanup database via API:', error.message);
  }

  // Remove test data file
  const testDataPath = path.resolve(__dirname, '../../backend/test_data.json');
  if (fs.existsSync(testDataPath)) {
    fs.unlinkSync(testDataPath);
  }
}

async function stopTestServers() {
  try {
    // Kill processes that might be running on test ports
    const ports = [3000, 8000];
    
    ports.forEach(port => {
      try {
        // Find and kill processes on each port
        execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'pipe' });
      } catch (error) {
        // Ignore errors - processes might not be running
      }
    });

    // Give processes time to terminate
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.warn('Some processes may not have been stopped:', error.message);
  }
}

async function cleanupTemporaryFiles() {
  const tempPaths = [
    path.resolve(__dirname, '../e2e-results/temp'),
    path.resolve(__dirname, '../coverage/temp'),
    path.resolve(__dirname, '../../frontend/.next'),
    path.resolve(__dirname, '../../backend/__pycache__')
  ];

  tempPaths.forEach(tempPath => {
    if (fs.existsSync(tempPath)) {
      try {
        fs.rmSync(tempPath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to remove ${tempPath}:`, error.message);
      }
    }
  });

  // Clean up any remaining lock files
  const lockFiles = [
    path.resolve(__dirname, '../../frontend/package-lock.json'),
    path.resolve(__dirname, '../../backend/.pytest_cache')
  ];

  lockFiles.forEach(lockFile => {
    if (fs.existsSync(lockFile)) {
      try {
        if (fs.statSync(lockFile).isDirectory()) {
          fs.rmSync(lockFile, { recursive: true, force: true });
        } else {
          // Don't remove package-lock.json, just skip it
          if (!lockFile.includes('package-lock.json')) {
            fs.unlinkSync(lockFile);
          }
        }
      } catch (error) {
        console.warn(`Failed to remove ${lockFile}:`, error.message);
      }
    }
  });
}

async function generateTestSummary() {
  const resultsDir = path.resolve(__dirname, '../e2e-results');
  const summaryPath = path.join(resultsDir, 'test-summary.json');

  if (!fs.existsSync(resultsDir)) {
    return;
  }

  const summary = {
    timestamp: new Date().toISOString(),
    testRun: {
      environment: 'e2e',
      node_version: process.version,
      platform: process.platform
    },
    artifacts: []
  };

  // List all files in results directory
  try {
    const files = fs.readdirSync(resultsDir);
    
    files.forEach(file => {
      const filePath = path.join(resultsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        summary.artifacts.push({
          name: file,
          size: stats.size,
          created: stats.mtime.toISOString(),
          type: getFileType(file)
        });
      }
    });
  } catch (error) {
    console.warn('Failed to analyze test artifacts:', error.message);
  }

  // Save summary
  try {
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Test summary saved to: ${summaryPath}`);
  } catch (error) {
    console.warn('Failed to save test summary:', error.message);
  }
}

function getFileType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  
  switch (extension) {
    case '.png':
    case '.jpg':
    case '.jpeg':
      return 'screenshot';
    case '.webm':
    case '.mp4':
      return 'video';
    case '.json':
      return 'data';
    case '.html':
      return 'report';
    case '.xml':
      return 'test-results';
    case '.log':
      return 'log';
    case '.trace':
      return 'trace';
    default:
      return 'other';
  }
}

export default globalTeardown;