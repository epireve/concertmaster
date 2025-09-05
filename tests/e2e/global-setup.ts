/**
 * Global E2E Test Setup
 * Configures test environment, starts servers, and prepares test data
 */

import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  // Ensure test environment variables are set
  process.env.NODE_ENV = 'test';
  process.env.REACT_APP_API_URL = 'http://localhost:8000';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/concertmaster_test';

  try {
    // Start backend server if not already running
    console.log('🔧 Starting backend server...');
    await startBackendServer();

    // Start frontend development server if not already running
    console.log('🎨 Starting frontend server...');
    await startFrontendServer();

    // Wait for servers to be ready
    console.log('⏳ Waiting for servers to be ready...');
    await waitForServers();

    // Seed test database with initial data
    console.log('🌱 Seeding test database...');
    await seedTestDatabase();

    // Perform initial browser setup
    console.log('🌐 Performing browser setup...');
    await performBrowserSetup();

    console.log('✅ E2E test environment setup completed!');

  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
    throw error;
  }
}

async function startBackendServer() {
  try {
    // Check if backend is already running
    const response = await fetch('http://localhost:8000/health');
    if (response.ok) {
      console.log('Backend server already running');
      return;
    }
  } catch (error) {
    // Server not running, start it
  }

  // Start backend server in background
  execSync('python -m uvicorn backend.main:app --reload --port 8000 &', {
    cwd: path.resolve(__dirname, '../../'),
    stdio: 'pipe'
  });

  // Give the server time to start
  await new Promise(resolve => setTimeout(resolve, 5000));
}

async function startFrontendServer() {
  try {
    // Check if frontend is already running
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('Frontend server already running');
      return;
    }
  } catch (error) {
    // Server not running, start it
  }

  // Start frontend server in background
  execSync('npm run dev &', {
    cwd: path.resolve(__dirname, '../../frontend'),
    stdio: 'pipe'
  });

  // Give the server time to start
  await new Promise(resolve => setTimeout(resolve, 10000));
}

async function waitForServers() {
  const maxAttempts = 30;
  const delay = 2000;

  // Wait for backend
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        console.log('✅ Backend server is ready');
        break;
      }
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error('Backend server failed to start within timeout');
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Wait for frontend
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:3000');
      if (response.ok) {
        console.log('✅ Frontend server is ready');
        break;
      }
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error('Frontend server failed to start within timeout');
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function seedTestDatabase() {
  const testData = {
    workflows: [
      {
        id: 'test-workflow-1',
        name: 'Sample Data Collection Workflow',
        description: 'Test workflow for E2E testing',
        nodes: [
          {
            id: 'trigger-1',
            type: 'schedule',
            position: { x: 100, y: 100 },
            data: {
              label: 'Daily Trigger',
              config: { cron: '0 9 * * *', timezone: 'UTC' }
            }
          },
          {
            id: 'collection-1',
            type: 'sendForm',
            position: { x: 300, y: 100 },
            data: {
              label: 'Send Form',
              config: { formId: 'test-form-1', deliveryMethod: 'email' }
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'trigger-1',
            target: 'collection-1'
          }
        ],
        status: 'draft',
        isTemplate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    forms: [
      {
        id: 'test-form-1',
        title: 'Test Form',
        description: 'Form for E2E testing',
        fields: [
          {
            id: 'field-1',
            type: 'text',
            label: 'Company Name',
            required: true,
            placeholder: 'Enter company name'
          },
          {
            id: 'field-2',
            type: 'select',
            label: 'Industry',
            required: true,
            options: [
              { label: 'Technology', value: 'tech' },
              { label: 'Manufacturing', value: 'manufacturing' },
              { label: 'Services', value: 'services' }
            ]
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  };

  // Save test data to a JSON file that the backend can read
  const testDataPath = path.resolve(__dirname, '../../backend/test_data.json');
  fs.writeFileSync(testDataPath, JSON.stringify(testData, null, 2));

  try {
    // Call backend endpoint to seed database
    await fetch('http://localhost:8000/test/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
  } catch (error) {
    console.warn('Failed to seed database via API, continuing with file-based seeding');
  }
}

async function performBrowserSetup() {
  // Launch a browser to warm up and verify everything works
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Verify the application loads correctly
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });

    // Take a screenshot for debugging if needed
    const screenshotPath = path.resolve(__dirname, '../e2e-results/setup-screenshot.png');
    await page.screenshot({ path: screenshotPath });

    console.log('✅ Browser setup completed successfully');
  } catch (error) {
    console.error('Browser setup verification failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;