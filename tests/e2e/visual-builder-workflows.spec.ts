/**
 * End-to-End Tests for Visual Builder Workflows
 * Testing complete user workflows in the Visual Builder application
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Visual Builder E2E Workflows', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Workflow Creation and Management', () => {
    test('should create a complete data collection workflow', async () => {
      // Navigate to workflow builder
      await page.click('[data-testid="create-workflow"]');
      await page.waitForSelector('[data-testid="workflow-canvas"]');

      // Set workflow name
      await page.fill('[data-testid="workflow-name-input"]', 'Supplier Data Collection');
      await page.fill('[data-testid="workflow-description-input"]', 'Automated supplier ESG data collection');

      // Add trigger node
      await page.dragAndDrop(
        '[data-testid="node-palette-trigger"]',
        '[data-testid="workflow-canvas"]',
        { targetPosition: { x: 100, y: 100 } }
      );

      // Configure trigger node
      await page.click('[data-testid="node-trigger-1"]');
      await page.waitForSelector('[data-testid="node-config-panel"]');
      await page.selectOption('[data-testid="trigger-type-select"]', 'schedule');
      await page.fill('[data-testid="cron-expression"]', '0 9 * * MON');
      await page.click('[data-testid="save-node-config"]');

      // Add collection node
      await page.dragAndDrop(
        '[data-testid="node-palette-collection"]',
        '[data-testid="workflow-canvas"]',
        { targetPosition: { x: 300, y: 100 } }
      );

      // Connect trigger to collection
      await page.hover('[data-testid="node-trigger-1"] [data-testid="output-handle"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-collection-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      // Verify connection was created
      await expect(page.locator('[data-testid="edge-trigger-1-collection-1"]')).toBeVisible();

      // Configure collection node
      await page.click('[data-testid="node-collection-1"]');
      await page.selectOption('[data-testid="collection-type-select"]', 'sendForm');
      await page.fill('[data-testid="form-id-input"]', 'esg-supplier-form');
      await page.fill('[data-testid="recipients-input"]', 'suppliers@company.com');
      await page.selectOption('[data-testid="delivery-method"]', 'email');
      await page.click('[data-testid="save-node-config"]');

      // Add transform node
      await page.dragAndDrop(
        '[data-testid="node-palette-transform"]',
        '[data-testid="workflow-canvas"]',
        { targetPosition: { x: 500, y: 100 } }
      );

      // Connect collection to transform
      await page.hover('[data-testid="node-collection-1"] [data-testid="output-handle"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-transform-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      // Add output node
      await page.dragAndDrop(
        '[data-testid="node-palette-output"]',
        '[data-testid="workflow-canvas"]',
        { targetPosition: { x: 700, y: 100 } }
      );

      // Connect transform to output
      await page.hover('[data-testid="node-transform-1"] [data-testid="output-handle"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-output-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      // Save workflow
      await page.click('[data-testid="save-workflow"]');
      await page.waitForSelector('[data-testid="success-notification"]');
      
      // Verify workflow was saved
      await expect(page.locator('[data-testid="success-notification"]')).toContainText('Workflow saved successfully');
    });

    test('should create a workflow with conditional logic', async () => {
      await page.click('[data-testid="create-workflow"]');
      await page.fill('[data-testid="workflow-name-input"]', 'Risk Assessment Workflow');

      // Add form trigger
      await page.dragAndDrop(
        '[data-testid="node-palette-trigger"]',
        '[data-testid="workflow-canvas"]',
        { targetPosition: { x: 100, y: 100 } }
      );

      await page.click('[data-testid="node-trigger-1"]');
      await page.selectOption('[data-testid="trigger-type-select"]', 'form');
      await page.fill('[data-testid="form-id-input"]', 'risk-assessment-form');
      await page.click('[data-testid="save-node-config"]');

      // Add conditional logic node
      await page.dragAndDrop(
        '[data-testid="node-palette-logic"]',
        '[data-testid="workflow-canvas"]',
        { targetPosition: { x: 300, y: 100 } }
      );

      await page.hover('[data-testid="node-trigger-1"] [data-testid="output-handle"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-logic-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      // Configure conditional logic
      await page.click('[data-testid="node-logic-1"]');
      await page.selectOption('[data-testid="logic-type-select"]', 'conditional');
      await page.fill('[data-testid="condition-expression"]', 'riskScore >= 75');
      await page.click('[data-testid="save-node-config"]');

      // Add high-risk path
      await page.dragAndDrop(
        '[data-testid="node-palette-collection"]',
        '[data-testid="workflow-canvas"]',
        { targetPosition: { x: 500, y: 50 } }
      );

      // Add low-risk path
      await page.dragAndDrop(
        '[data-testid="node-palette-output"]',
        '[data-testid="workflow-canvas"]',
        { targetPosition: { x: 500, y: 150 } }
      );

      // Connect conditional branches
      await page.hover('[data-testid="node-logic-1"] [data-testid="output-handle-true"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-collection-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      await page.hover('[data-testid="node-logic-1"] [data-testid="output-handle-false"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-output-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      // Verify conditional paths
      await expect(page.locator('[data-testid="edge-logic-1-collection-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="edge-logic-1-output-1"]')).toBeVisible();

      // Save and verify
      await page.click('[data-testid="save-workflow"]');
      await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();
    });

    test('should validate workflow before saving', async () => {
      await page.click('[data-testid="create-workflow"]');
      
      // Try to save empty workflow
      await page.click('[data-testid="save-workflow"]');
      await expect(page.locator('[data-testid="error-notification"]')).toContainText('Workflow name is required');

      // Add name but no nodes
      await page.fill('[data-testid="workflow-name-input"]', 'Test Workflow');
      await page.click('[data-testid="save-workflow"]');
      await expect(page.locator('[data-testid="error-notification"]')).toContainText('Workflow must have at least one node');

      // Add disconnected nodes
      await page.dragAndDrop('[data-testid="node-palette-trigger"]', '[data-testid="workflow-canvas"]');
      await page.dragAndDrop('[data-testid="node-palette-output"]', '[data-testid="workflow-canvas"]');
      
      await page.click('[data-testid="save-workflow"]');
      await expect(page.locator('[data-testid="error-notification"]')).toContainText('All nodes must be connected');
    });
  });

  test.describe('Form Builder Integration', () => {
    test('should create a form and integrate with workflow', async () => {
      // Create a form first
      await page.click('[data-testid="create-form"]');
      await page.waitForSelector('[data-testid="form-builder"]');

      // Set form details
      await page.fill('[data-testid="form-title-input"]', 'Employee Feedback Form');
      await page.fill('[data-testid="form-description-input"]', 'Annual employee satisfaction survey');

      // Add form fields
      await page.click('[data-testid="add-text-field"]');
      await page.click('[data-testid="preview-field-1"]');
      await page.fill('[data-testid="field-label-input"]', 'Full Name');
      await page.check('[data-testid="field-required-checkbox"]');

      await page.click('[data-testid="add-select-field"]');
      await page.click('[data-testid="preview-field-2"]');
      await page.fill('[data-testid="field-label-input"]', 'Department');
      
      // Add select options
      await page.click('[data-testid="add-option-button"]');
      await page.fill('[data-testid="option-label-0"]', 'Engineering');
      await page.fill('[data-testid="option-value-0"]', 'eng');

      await page.click('[data-testid="add-option-button"]');
      await page.fill('[data-testid="option-label-1"]', 'Sales');
      await page.fill('[data-testid="option-value-1"]', 'sales');

      // Save form
      await page.click('[data-testid="save-form"]');
      await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();

      // Navigate to workflow builder
      await page.click('[data-testid="create-workflow"]');
      await page.fill('[data-testid="workflow-name-input"]', 'Employee Survey Workflow');

      // Add form trigger and select the created form
      await page.dragAndDrop('[data-testid="node-palette-trigger"]', '[data-testid="workflow-canvas"]');
      await page.click('[data-testid="node-trigger-1"]');
      await page.selectOption('[data-testid="trigger-type-select"]', 'form');
      
      // Form should be available in dropdown
      await expect(page.locator('[data-testid="form-select"] option')).toContainText('Employee Feedback Form');
      await page.selectOption('[data-testid="form-select"]', 'employee-feedback-form');

      await page.click('[data-testid="save-node-config"]');
      
      // Add processing and save
      await page.dragAndDrop('[data-testid="node-palette-output"]', '[data-testid="workflow-canvas"]');
      await page.hover('[data-testid="node-trigger-1"] [data-testid="output-handle"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-output-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      await page.click('[data-testid="save-workflow"]');
      await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();
    });
  });

  test.describe('Workflow Execution and Monitoring', () => {
    test('should execute workflow and monitor progress', async () => {
      // Create a simple workflow first
      await page.click('[data-testid="create-workflow"]');
      await page.fill('[data-testid="workflow-name-input"]', 'Test Execution Workflow');

      await page.dragAndDrop('[data-testid="node-palette-trigger"]', '[data-testid="workflow-canvas"]');
      await page.dragAndDrop('[data-testid="node-palette-output"]', '[data-testid="workflow-canvas"]');
      
      // Connect nodes
      await page.hover('[data-testid="node-trigger-1"] [data-testid="output-handle"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-output-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      await page.click('[data-testid="save-workflow"]');

      // Execute workflow
      await page.click('[data-testid="execute-workflow"]');
      await expect(page.locator('[data-testid="execution-started-notification"]')).toBeVisible();

      // Navigate to monitoring page
      await page.click('[data-testid="view-execution"]');
      await page.waitForSelector('[data-testid="execution-monitor"]');

      // Check execution status
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Running');
      await expect(page.locator('[data-testid="node-trigger-1-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="node-output-1-status"]')).toBeVisible();

      // Wait for completion (with timeout)
      await page.waitForSelector('[data-testid="execution-completed"]', { timeout: 30000 });
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Completed');
    });

    test('should handle workflow execution errors', async () => {
      // Create workflow with invalid configuration
      await page.click('[data-testid="create-workflow"]');
      await page.fill('[data-testid="workflow-name-input"]', 'Error Test Workflow');

      await page.dragAndDrop('[data-testid="node-palette-output"]', '[data-testid="workflow-canvas"]');
      await page.click('[data-testid="node-output-1"]');
      
      // Set invalid database configuration
      await page.selectOption('[data-testid="output-type-select"]', 'database');
      await page.fill('[data-testid="database-connection"]', 'invalid://connection');
      await page.click('[data-testid="save-node-config"]');

      await page.click('[data-testid="save-workflow"]');

      // Execute workflow
      await page.click('[data-testid="execute-workflow"]');

      // Check for execution error
      await page.waitForSelector('[data-testid="execution-error"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Database connection failed');
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Failed');
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle large workflows efficiently', async () => {
      await page.click('[data-testid="create-workflow"]');
      await page.fill('[data-testid="workflow-name-input"]', 'Large Workflow Test');

      const startTime = Date.now();

      // Create a workflow with many nodes
      for (let i = 0; i < 20; i++) {
        await page.dragAndDrop(
          '[data-testid="node-palette-transform"]',
          '[data-testid="workflow-canvas"]',
          { targetPosition: { x: 100 + (i % 5) * 150, y: 100 + Math.floor(i / 5) * 100 } }
        );
      }

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all nodes were created
      const nodeCount = await page.locator('[data-testid^="node-transform-"]').count();
      expect(nodeCount).toBe(20);

      // Test canvas interaction performance
      const scrollStartTime = Date.now();
      
      // Zoom and pan operations
      await page.wheel(0, 0, { deltaY: -500 }); // Zoom in
      await page.wheel(0, 0, { deltaY: 500 });  // Zoom out
      
      // Pan the canvas
      await page.mouse.move(400, 300);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(500, 400);
      await page.mouse.up();

      const interactionTime = Date.now() - scrollStartTime;
      expect(interactionTime).toBeLessThan(2000); // Should be responsive
    });

    test('should maintain responsiveness with rapid operations', async () => {
      await page.click('[data-testid="create-workflow"]');
      await page.fill('[data-testid="workflow-name-input"]', 'Rapid Operations Test');

      const startTime = Date.now();

      // Rapidly add and remove nodes
      for (let i = 0; i < 10; i++) {
        await page.dragAndDrop('[data-testid="node-palette-transform"]', '[data-testid="workflow-canvas"]');
        await page.click(`[data-testid="node-transform-${i + 1}"]`);
        await page.keyboard.press('Delete');
      }

      const operationTime = Date.now() - startTime;
      expect(operationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify no nodes remain
      const nodeCount = await page.locator('[data-testid^="node-"]').count();
      expect(nodeCount).toBe(0);
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work correctly in different browsers', async () => {
      // This test runs across different browsers configured in playwright.config.ts
      
      await page.click('[data-testid="create-workflow"]');
      await page.fill('[data-testid="workflow-name-input"]', 'Cross-Browser Test');

      // Test drag and drop works
      await page.dragAndDrop('[data-testid="node-palette-trigger"]', '[data-testid="workflow-canvas"]');
      await expect(page.locator('[data-testid="node-trigger-1"]')).toBeVisible();

      // Test node configuration works
      await page.click('[data-testid="node-trigger-1"]');
      await page.waitForSelector('[data-testid="node-config-panel"]');
      await expect(page.locator('[data-testid="node-config-panel"]')).toBeVisible();

      // Test save functionality
      await page.click('[data-testid="save-workflow"]');
      
      // Should handle browser-specific behaviors correctly
      await expect(page.locator('[data-testid="success-notification"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Accessibility Testing', () => {
    test('should be navigable with keyboard only', async () => {
      await page.click('[data-testid="create-workflow"]');

      // Navigate using Tab key
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to focus on interactive elements
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Should be able to activate elements with Enter/Space
      await page.keyboard.press('Enter');
      
      // Check that action was performed
      expect(await page.isVisible('[data-testid="workflow-name-input"]')).toBeTruthy();
    });

    test('should have proper ARIA labels and roles', async () => {
      await page.click('[data-testid="create-workflow"]');

      // Check for proper ARIA labels
      await expect(page.locator('[data-testid="workflow-canvas"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="node-palette"]')).toHaveAttribute('aria-label');
      
      // Check for proper roles
      await expect(page.locator('[data-testid="node-palette-trigger"]')).toHaveAttribute('role', 'button');
      await expect(page.locator('[data-testid="workflow-canvas"]')).toHaveAttribute('role', 'application');
    });

    test('should support screen reader announcements', async () => {
      await page.click('[data-testid="create-workflow"]');

      // Add a node
      await page.dragAndDrop('[data-testid="node-palette-trigger"]', '[data-testid="workflow-canvas"]');

      // Check for screen reader announcement
      await expect(page.locator('[aria-live="polite"]')).toContainText('Trigger node added');

      // Connect nodes
      await page.dragAndDrop('[data-testid="node-palette-output"]', '[data-testid="workflow-canvas"]');
      await page.hover('[data-testid="node-trigger-1"] [data-testid="output-handle"]');
      await page.mouse.down();
      await page.hover('[data-testid="node-output-1"] [data-testid="input-handle"]');
      await page.mouse.up();

      // Check for connection announcement
      await expect(page.locator('[aria-live="polite"]')).toContainText('Nodes connected');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should adapt to mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

      await page.click('[data-testid="create-workflow"]');

      // Check that mobile layout is applied
      await expect(page.locator('[data-testid="mobile-toolbar"]')).toBeVisible();
      await expect(page.locator('[data-testid="node-palette"]')).toHaveClass(/mobile/);

      // Test touch interactions
      await page.tap('[data-testid="node-palette-trigger"]');
      await page.touchscreen.tap(200, 200); // Tap on canvas

      // Verify node was added
      await expect(page.locator('[data-testid="node-trigger-1"]')).toBeVisible();

      // Test pinch zoom
      await page.touchscreen.tap(300, 300, { points: 2 });
      
      // Should maintain functionality on mobile
      await expect(page.locator('[data-testid="workflow-canvas"]')).toBeVisible();
    });
  });
});