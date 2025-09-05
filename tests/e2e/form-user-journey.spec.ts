import { test, expect, Page } from '@playwright/test';

test.describe('Form User Journeys', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Set up viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Go to the forms page
    await page.goto('/forms');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Contact Form Journey', () => {
    test('completes full contact form submission successfully', async () => {
      // Navigate to contact form
      await page.click('text=Contact Us');
      await expect(page).toHaveURL('/forms/contact');
      
      // Verify form is loaded
      await expect(page.locator('h1')).toHaveText('Contact Us');
      
      // Fill out form fields
      await page.fill('[data-testid="name-input"]', 'John Doe');
      await page.fill('[data-testid="email-input"]', 'john.doe@example.com');
      await page.fill('[data-testid="company-input"]', 'Acme Corporation');
      await page.selectOption('[data-testid="inquiry-type"]', 'general');
      await page.fill('[data-testid="message-textarea"]', 'I am interested in learning more about your services. Please contact me with additional information.');
      
      // Check newsletter subscription
      await page.check('[data-testid="newsletter-checkbox"]');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify loading state
      await expect(page.locator('button[type="submit"]')).toContainText('Sending...');
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      
      // Wait for success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Thank you for your message');
      
      // Verify form is reset
      await expect(page.locator('[data-testid="name-input"]')).toHaveValue('');
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('');
    });

    test('handles form validation errors gracefully', async () => {
      await page.click('text=Contact Us');
      
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // Verify validation errors appear
      await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="name-error"]')).toContainText('Name is required');
      
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
      
      // Fill name but invalid email
      await page.fill('[data-testid="name-input"]', 'John Doe');
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.blur('[data-testid="email-input"]');
      
      // Verify email validation
      await expect(page.locator('[data-testid="email-error"]')).toContainText('Please enter a valid email');
      
      // Fix email and verify error clears
      await page.fill('[data-testid="email-input"]', 'john@example.com');
      await page.blur('[data-testid="email-input"]');
      
      await expect(page.locator('[data-testid="email-error"]')).not.toBeVisible();
    });

    test('shows real-time character count for message field', async () => {
      await page.click('text=Contact Us');
      
      const messageField = page.locator('[data-testid="message-textarea"]');
      const charCount = page.locator('[data-testid="message-char-count"]');
      
      // Initial state
      await expect(charCount).toContainText('0 / 1000');
      
      // Type message and verify count updates
      await messageField.fill('This is a test message');
      await expect(charCount).toContainText('23 / 1000');
      
      // Approach limit
      const longMessage = 'A'.repeat(950);
      await messageField.fill(longMessage);
      await expect(charCount).toContainText('950 / 1000');
      await expect(charCount).toHaveClass(/text-yellow/); // Warning color
      
      // Exceed limit
      const tooLongMessage = 'A'.repeat(1050);
      await messageField.fill(tooLongMessage);
      await expect(charCount).toContainText('1050 / 1000');
      await expect(charCount).toHaveClass(/text-red/); // Error color
      
      // Verify submit is disabled
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });
  });

  test.describe('File Upload Journey', () => {
    test('handles single file upload successfully', async () => {
      await page.click('text=Document Upload');
      
      // Upload single file
      const fileChooser = await page.waitForEvent('filechooser', () =>
        page.click('[data-testid="file-upload"] button')
      );
      await fileChooser.setFiles('tests/fixtures/sample-document.pdf');
      
      // Verify upload progress
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      
      // Wait for completion
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-name"]')).toContainText('sample-document.pdf');
      
      // Verify file actions are available
      await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-download"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-remove"]')).toBeVisible();
    });

    test('shows appropriate error for invalid file types', async () => {
      await page.click('text=Document Upload');
      
      // Try to upload invalid file type
      const fileChooser = await page.waitForEvent('filechooser', () =>
        page.click('[data-testid="file-upload"] button')
      );
      await fileChooser.setFiles('tests/fixtures/malicious-file.exe');
      
      // Verify error message
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-error"]')).toContainText('File type not supported');
      
      // Verify file is not added to list
      await expect(page.locator('[data-testid="file-list"]')).not.toContainText('malicious-file.exe');
      
      // Verify error styling
      await expect(page.locator('[data-testid="file-upload"]')).toHaveClass(/error/);
    });

    test('handles file size limit validation', async () => {
      await page.click('text=Document Upload');
      
      // Set low file size limit for testing
      await page.selectOption('[data-testid="size-limit"]', '1MB');
      
      // Try to upload large file
      const fileChooser = await page.waitForEvent('filechooser', () =>
        page.click('[data-testid="file-upload"] button')
      );
      await fileChooser.setFiles('tests/fixtures/large-file.pdf'); // 5MB file
      
      // Verify size error
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-error"]')).toContainText('File size exceeds 1MB limit');
      
      // Verify file size is displayed
      await expect(page.locator('[data-testid="file-size"]')).toContainText('5 MB');
    });
  });

  test.describe('Accessibility Journey', () => {
    test('supports full keyboard navigation', async () => {
      await page.click('text=Contact Us');
      
      // Navigate through form using only keyboard
      await page.press('body', 'Tab'); // Name field
      await expect(page.locator('[data-testid="name-input"]')).toBeFocused();
      
      await page.press('body', 'Tab'); // Email field
      await expect(page.locator('[data-testid="email-input"]')).toBeFocused();
      
      await page.press('body', 'Tab'); // Company field
      await expect(page.locator('[data-testid="company-input"]')).toBeFocused();
      
      await page.press('body', 'Tab'); // Inquiry type dropdown
      await expect(page.locator('[data-testid="inquiry-type"]')).toBeFocused();
      
      // Use arrow keys to select option
      await page.press('[data-testid="inquiry-type"]', 'ArrowDown');
      await page.press('[data-testid="inquiry-type"]', 'Enter');
      
      await page.press('body', 'Tab'); // Message textarea
      await expect(page.locator('[data-testid="message-textarea"]')).toBeFocused();
      
      await page.press('body', 'Tab'); // Newsletter checkbox
      await expect(page.locator('[data-testid="newsletter-checkbox"]')).toBeFocused();
      
      // Check checkbox with space
      await page.press('[data-testid="newsletter-checkbox"]', 'Space');
      await expect(page.locator('[data-testid="newsletter-checkbox"]')).toBeChecked();
      
      await page.press('body', 'Tab'); // Submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused();
    });

    test('provides proper screen reader announcements', async () => {
      await page.click('text=Contact Us');
      
      // Fill invalid email to trigger error
      await page.fill('[data-testid="email-input"]', 'invalid');
      await page.blur('[data-testid="email-input"]');
      
      // Verify error has role="alert" for screen readers
      const errorElement = page.locator('[data-testid="email-error"]');
      await expect(errorElement).toHaveAttribute('role', 'alert');
      await expect(errorElement).toHaveAttribute('aria-live', 'polite');
      
      // Verify input has aria-describedby pointing to error
      await expect(page.locator('[data-testid="email-input"]')).toHaveAttribute('aria-describedby');
      
      // Verify invalid state
      await expect(page.locator('[data-testid="email-input"]')).toHaveAttribute('aria-invalid', 'true');
      
      // Fix email and verify announcements clear
      await page.fill('[data-testid="email-input"]', 'valid@example.com');
      await page.blur('[data-testid="email-input"]');
      
      await expect(page.locator('[data-testid="email-input"]')).toHaveAttribute('aria-invalid', 'false');
    });
  });
});