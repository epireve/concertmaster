import * as yup from 'yup';
import { 
  validationPatterns, 
  fileValidation, 
  commonSchemas, 
  formSchemas,
  validationUtils 
} from '@/components/shared/validation';

describe('Validation Patterns', () => {
  describe('email pattern', () => {
    it('validates correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@example-domain.com'
      ];

      validEmails.forEach(email => {
        expect(validationPatterns.email.test(email)).toBe(true);
      });
    });

    it('rejects invalid email formats', () => {
      const invalidEmails = [
        'plaintext',
        '@missinglocal.com',
        'missing-domain@',
        'spaces @example.com',
        'double@@example.com',
        'ending.dot.@example.com'
      ];

      invalidEmails.forEach(email => {
        expect(validationPatterns.email.test(email)).toBe(false);
      });
    });
  });

  describe('phone pattern', () => {
    it('validates correct phone formats', () => {
      const validPhones = [
        '1234567890',
        '+1234567890',
        '+44123456789',
        '555123456'
      ];

      validPhones.forEach(phone => {
        expect(validationPatterns.phone.test(phone)).toBe(true);
      });
    });

    it('rejects invalid phone formats', () => {
      const invalidPhones = [
        '123',
        'abcd1234567',
        '++1234567890',
        '+',
        '0123456789012345678' // Too long
      ];

      invalidPhones.forEach(phone => {
        expect(validationPatterns.phone.test(phone)).toBe(false);
      });
    });
  });

  describe('URL pattern', () => {
    it('validates correct URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://test.org',
        'example.com',
        'subdomain.example.com',
        'https://example.com/path',
        'http://example.com/path?query=1'
      ];

      validUrls.forEach(url => {
        expect(validationPatterns.url.test(url)).toBe(true);
      });
    });

    it('rejects invalid URL formats', () => {
      const invalidUrls = [
        'not-a-url',
        'http://',
        'https://.',
        'ftp://invalid',
        'javascript:alert(1)'
      ];

      invalidUrls.forEach(url => {
        expect(validationPatterns.url.test(url)).toBe(false);
      });
    });
  });

  describe('strong password pattern', () => {
    it('validates strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MySecure@Pass1',
        'ComplexP@ssw0rd',
        'Test123!@#'
      ];

      strongPasswords.forEach(password => {
        expect(validationPatterns.strongPassword.test(password)).toBe(true);
      });
    });

    it('rejects weak passwords', () => {
      const weakPasswords = [
        'password',      // No uppercase, number, special char
        'PASSWORD',      // No lowercase, number, special char
        'Password',      // No number, special char
        'Password123',   // No special char
        'Pass123!',      // Too short
        '12345678!'      // No letters
      ];

      weakPasswords.forEach(password => {
        expect(validationPatterns.strongPassword.test(password)).toBe(false);
      });
    });
  });

  describe('zip code pattern', () => {
    it('validates US zip codes', () => {
      const validZips = ['12345', '12345-6789'];
      
      validZips.forEach(zip => {
        expect(validationPatterns.zipCode.test(zip)).toBe(true);
      });
    });

    it('rejects invalid zip codes', () => {
      const invalidZips = ['1234', '123456', '12345-678', 'abcde'];
      
      invalidZips.forEach(zip => {
        expect(validationPatterns.zipCode.test(zip)).toBe(false);
      });
    });
  });

  describe('credit card pattern', () => {
    it('validates credit card numbers', () => {
      const validCards = [
        '4111111111111111',    // Visa
        '5555555555554444',    // Mastercard
        '378282246310005',     // Amex
        '4111111111111111111'  // 19 digits
      ];

      validCards.forEach(card => {
        expect(validationPatterns.creditCard.test(card)).toBe(true);
      });
    });

    it('rejects invalid card numbers', () => {
      const invalidCards = [
        '411111111111',        // Too short
        '41111111111111111111', // Too long
        '411111111111111a',     // Contains letter
        '4111-1111-1111-1111'   // Contains dashes
      ];

      invalidCards.forEach(card => {
        expect(validationPatterns.creditCard.test(card)).toBe(false);
      });
    });
  });

  describe('alphanumeric pattern', () => {
    it('validates alphanumeric strings', () => {
      const valid = ['abc123', 'ABC', '123', 'Test123'];
      
      valid.forEach(str => {
        expect(validationPatterns.alphanumeric.test(str)).toBe(true);
      });
    });

    it('rejects non-alphanumeric strings', () => {
      const invalid = ['abc-123', 'test@123', 'hello world', 'test_123'];
      
      invalid.forEach(str => {
        expect(validationPatterns.alphanumeric.test(str)).toBe(false);
      });
    });
  });

  describe('slug pattern', () => {
    it('validates URL-friendly slugs', () => {
      const validSlugs = ['hello-world', 'test123', 'my-awesome-post'];
      
      validSlugs.forEach(slug => {
        expect(validationPatterns.slug.test(slug)).toBe(true);
      });
    });

    it('rejects invalid slugs', () => {
      const invalidSlugs = ['Hello World', 'test_123', 'UPPERCASE', 'test--double'];
      
      invalidSlugs.forEach(slug => {
        expect(validationPatterns.slug.test(slug)).toBe(false);
      });
    });
  });
});

describe('File Validation', () => {
  const createMockFile = (name: string, size: number, type: string): File => {
    const file = new File(['content'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  describe('maxSize validation', () => {
    const validator = fileValidation.maxSize(1024); // 1KB limit

    it('accepts files within size limit', () => {
      const smallFile = createMockFile('small.txt', 512, 'text/plain');
      expect(validator(smallFile)).toBe(true);
    });

    it('rejects files exceeding size limit', () => {
      const largeFile = createMockFile('large.txt', 2048, 'text/plain');
      expect(validator(largeFile)).toBe(false);
    });

    it('handles undefined file', () => {
      expect(validator(undefined)).toBe(true);
    });
  });

  describe('allowedTypes validation', () => {
    const validator = fileValidation.allowedTypes(['.pdf', '.doc', 'image/*']);

    it('accepts files with allowed extensions', () => {
      const pdfFile = createMockFile('test.pdf', 1024, 'application/pdf');
      const docFile = createMockFile('test.doc', 1024, 'application/msword');
      
      expect(validator(pdfFile)).toBe(true);
      expect(validator(docFile)).toBe(true);
    });

    it('accepts files matching MIME type patterns', () => {
      const imageFile = createMockFile('test.jpg', 1024, 'image/jpeg');
      expect(validator(imageFile)).toBe(true);
    });

    it('rejects files with disallowed types', () => {
      const exeFile = createMockFile('malware.exe', 1024, 'application/x-executable');
      expect(validator(exeFile)).toBe(false);
    });

    it('handles undefined file', () => {
      expect(validator(undefined)).toBe(true);
    });
  });

  describe('requiredFile validation', () => {
    it('validates single file objects', () => {
      expect(fileValidation.requiredFile({ status: 'success' })).toBe(true);
      expect(fileValidation.requiredFile({ status: 'pending' })).toBe(true);
      expect(fileValidation.requiredFile({ status: 'error' })).toBe(false);
      expect(fileValidation.requiredFile(null)).toBe(false);
    });

    it('validates file arrays', () => {
      expect(fileValidation.requiredFile([{ status: 'success' }])).toBe(true);
      expect(fileValidation.requiredFile([{ status: 'error' }])).toBe(false);
      expect(fileValidation.requiredFile([])).toBe(false);
    });
  });
});

describe('Common Schemas', () => {
  describe('email schema', () => {
    it('validates correct emails', async () => {
      await expect(commonSchemas.email.validate('test@example.com')).resolves.toBe('test@example.com');
    });

    it('rejects invalid emails', async () => {
      await expect(commonSchemas.email.validate('invalid-email')).rejects.toThrow('Please enter a valid email address');
    });

    it('requires email field', async () => {
      await expect(commonSchemas.email.validate('')).rejects.toThrow('Email is required');
    });
  });

  describe('password schema', () => {
    it('validates strong passwords', async () => {
      await expect(commonSchemas.password.validate('Password123!')).resolves.toBe('Password123!');
    });

    it('rejects passwords without uppercase', async () => {
      await expect(commonSchemas.password.validate('password123!')).rejects.toThrow('at least one uppercase letter');
    });

    it('rejects passwords without lowercase', async () => {
      await expect(commonSchemas.password.validate('PASSWORD123!')).rejects.toThrow('at least one lowercase letter');
    });

    it('rejects passwords without numbers', async () => {
      await expect(commonSchemas.password.validate('Password!')).rejects.toThrow('at least one number');
    });

    it('rejects passwords without special characters', async () => {
      await expect(commonSchemas.password.validate('Password123')).rejects.toThrow('at least one special character');
    });

    it('rejects passwords that are too short', async () => {
      await expect(commonSchemas.password.validate('Pass1!')).rejects.toThrow('at least 8 characters');
    });
  });

  describe('confirmPassword schema', () => {
    it('validates matching passwords', async () => {
      const schema = yup.object({
        password: yup.string(),
        confirmPassword: commonSchemas.confirmPassword('password')
      });

      await expect(schema.validate({
        password: 'test123',
        confirmPassword: 'test123'
      })).resolves.toEqual({
        password: 'test123',
        confirmPassword: 'test123'
      });
    });

    it('rejects non-matching passwords', async () => {
      const schema = yup.object({
        password: yup.string(),
        confirmPassword: commonSchemas.confirmPassword('password')
      });

      await expect(schema.validate({
        password: 'test123',
        confirmPassword: 'different'
      })).rejects.toThrow('Passwords must match');
    });
  });

  describe('date schemas', () => {
    it('validates future dates', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      await expect(commonSchemas.futureDate.validate(futureDate)).resolves.toEqual(futureDate);
    });

    it('rejects past dates for future schema', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      await expect(commonSchemas.futureDate.validate(pastDate)).rejects.toThrow('Date must be in the future');
    });

    it('validates past dates', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      await expect(commonSchemas.pastDate.validate(pastDate)).resolves.toEqual(pastDate);
    });

    it('rejects future dates for past schema', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      await expect(commonSchemas.pastDate.validate(futureDate)).rejects.toThrow('Date must be in the past');
    });
  });

  describe('number schemas', () => {
    it('validates positive numbers', async () => {
      await expect(commonSchemas.positiveNumber.validate(5)).resolves.toBe(5);
      await expect(commonSchemas.positiveNumber.validate(0.1)).resolves.toBe(0.1);
    });

    it('rejects negative numbers', async () => {
      await expect(commonSchemas.positiveNumber.validate(-1)).rejects.toThrow('Must be a positive number');
    });

    it('rejects zero', async () => {
      await expect(commonSchemas.positiveNumber.validate(0)).rejects.toThrow('Must be a positive number');
    });
  });

  describe('boolean schemas', () => {
    it('validates required true boolean', async () => {
      await expect(commonSchemas.requiredBoolean.validate(true)).resolves.toBe(true);
    });

    it('rejects false for required boolean', async () => {
      await expect(commonSchemas.requiredBoolean.validate(false)).rejects.toThrow('This field is required');
    });
  });

  describe('array schemas', () => {
    it('validates non-empty arrays', async () => {
      await expect(commonSchemas.requiredArray.validate(['item'])).resolves.toEqual(['item']);
    });

    it('rejects empty arrays', async () => {
      await expect(commonSchemas.requiredArray.validate([])).rejects.toThrow('Please select at least one option');
    });
  });
});

describe('Form Schemas', () => {
  describe('userRegistration schema', () => {
    const validData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      terms: true,
      newsletter: false
    };

    it('validates complete registration data', async () => {
      await expect(formSchemas.userRegistration.validate(validData)).resolves.toEqual(validData);
    });

    it('requires first name', async () => {
      const data = { ...validData, firstName: '' };
      await expect(formSchemas.userRegistration.validate(data)).rejects.toThrow();
    });

    it('validates first name length', async () => {
      const data = { ...validData, firstName: 'J' };
      await expect(formSchemas.userRegistration.validate(data)).rejects.toThrow('at least 2 characters');
    });

    it('requires terms acceptance', async () => {
      const data = { ...validData, terms: false };
      await expect(formSchemas.userRegistration.validate(data)).rejects.toThrow();
    });

    it('allows optional phone', async () => {
      const dataWithPhone = { ...validData, phone: '+1234567890' };
      const dataWithoutPhone = validData;
      
      await expect(formSchemas.userRegistration.validate(dataWithPhone)).resolves.toEqual(dataWithPhone);
      await expect(formSchemas.userRegistration.validate(dataWithoutPhone)).resolves.toEqual(dataWithoutPhone);
    });
  });

  describe('contactForm schema', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with sufficient length.'
    };

    it('validates complete contact data', async () => {
      await expect(formSchemas.contactForm.validate(validData)).resolves.toEqual(validData);
    });

    it('requires minimum message length', async () => {
      const data = { ...validData, message: 'Too short' };
      await expect(formSchemas.contactForm.validate(data)).rejects.toThrow('at least 10 characters');
    });

    it('limits message length', async () => {
      const data = { ...validData, message: 'x'.repeat(1001) };
      await expect(formSchemas.contactForm.validate(data)).rejects.toThrow('less than 1000 characters');
    });

    it('validates urgency levels', async () => {
      const validUrgencies = ['low', 'medium', 'high'];
      
      for (const urgency of validUrgencies) {
        const data = { ...validData, urgency };
        await expect(formSchemas.contactForm.validate(data)).resolves.toEqual(data);
      }
    });

    it('rejects invalid urgency levels', async () => {
      const data = { ...validData, urgency: 'invalid' };
      await expect(formSchemas.contactForm.validate(data)).rejects.toThrow('Invalid urgency level');
    });
  });

  describe('login schema', () => {
    it('validates login credentials', async () => {
      const data = {
        email: 'user@example.com',
        password: 'password123',
        rememberMe: true
      };

      await expect(formSchemas.login.validate(data)).resolves.toEqual(data);
    });

    it('sets default rememberMe to false', async () => {
      const data = {
        email: 'user@example.com',
        password: 'password123'
      };

      const result = await formSchemas.login.validate(data);
      expect(result.rememberMe).toBe(false);
    });
  });

  describe('address schema', () => {
    const validAddress = {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      country: 'USA'
    };

    it('validates complete address', async () => {
      await expect(formSchemas.address.validate(validAddress)).resolves.toEqual(validAddress);
    });

    it('validates ZIP+4 format', async () => {
      const data = { ...validAddress, zipCode: '12345-6789' };
      await expect(formSchemas.address.validate(data)).resolves.toEqual(data);
    });

    it('rejects invalid zip codes', async () => {
      const data = { ...validAddress, zipCode: '1234' };
      await expect(formSchemas.address.validate(data)).rejects.toThrow('valid zip code');
    });
  });

  describe('payment schema', () => {
    const validPayment = {
      cardNumber: '4111111111111111',
      expiryMonth: 12,
      expiryYear: new Date().getFullYear() + 1,
      cvv: '123',
      cardholderName: 'John Doe'
    };

    it('validates complete payment data', async () => {
      await expect(formSchemas.payment.validate(validPayment)).resolves.toEqual(validPayment);
    });

    it('rejects expired cards', async () => {
      const data = { ...validPayment, expiryYear: 2020 };
      await expect(formSchemas.payment.validate(data)).rejects.toThrow('Card has expired');
    });

    it('validates CVV format', async () => {
      const validCvvs = ['123', '1234'];
      const invalidCvvs = ['12', '12345', 'abc'];

      for (const cvv of validCvvs) {
        const data = { ...validPayment, cvv };
        await expect(formSchemas.payment.validate(data)).resolves.toEqual(data);
      }

      for (const cvv of invalidCvvs) {
        const data = { ...validPayment, cvv };
        await expect(formSchemas.payment.validate(data)).rejects.toThrow();
      }
    });
  });
});

describe('Validation Utils', () => {
  describe('conditional validation', () => {
    it('applies validation when condition is true', async () => {
      const schema = yup.object({
        hasAddress: yup.boolean(),
        address: validationUtils.conditional(
          (values: any) => values.hasAddress,
          yup.string().required('Address is required when has address is true')
        )
      });

      await expect(schema.validate({
        hasAddress: true,
        address: '123 Main St'
      })).resolves.toEqual({
        hasAddress: true,
        address: '123 Main St'
      });

      await expect(schema.validate({
        hasAddress: false,
        address: ''
      })).resolves.toEqual({
        hasAddress: false,
        address: ''
      });
    });
  });

  describe('dependsOn validation', () => {
    it('requires field when dependency is present', async () => {
      const schema = yup.object({
        country: yup.string(),
        state: validationUtils.dependsOn('country', yup.string().required('State is required'))
      });

      await expect(schema.validate({
        country: 'US',
        state: 'CA'
      })).resolves.toEqual({
        country: 'US',
        state: 'CA'
      });

      await expect(schema.validate({
        country: '',
        state: ''
      })).resolves.toEqual({
        country: '',
        state: ''
      });
    });
  });

  describe('async validation', () => {
    it('performs async validation', async () => {
      const asyncValidator = validationUtils.asyncValidation(
        async (value: string) => {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 10));
          return value !== 'taken';
        },
        'Username is already taken'
      );

      await expect(asyncValidator.validate('available')).resolves.toBe('available');
      await expect(asyncValidator.validate('taken')).rejects.toThrow('Username is already taken');
    });

    it('handles async validation errors', async () => {
      const asyncValidator = validationUtils.asyncValidation(
        async () => {
          throw new Error('Network error');
        },
        'Validation failed'
      );

      await expect(asyncValidator.validate('test')).rejects.toThrow('Validation failed');
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  it('handles null and undefined values gracefully', async () => {
    const schema = commonSchemas.optionalString;

    await expect(schema.validate(undefined)).resolves.toBeUndefined();
    await expect(schema.validate(null)).resolves.toBeNull();
    await expect(schema.validate('')).resolves.toBe('');
  });

  it('handles malformed data gracefully', async () => {
    const schema = formSchemas.userRegistration;

    // Should handle missing fields
    await expect(schema.validate({})).rejects.toBeTruthy();

    // Should handle wrong data types
    await expect(schema.validate({
      firstName: 123,
      lastName: true,
      email: null
    })).rejects.toBeTruthy();
  });

  it('provides meaningful error messages', async () => {
    try {
      await commonSchemas.email.validate('invalid-email');
    } catch (error) {
      expect(error.message).toContain('valid email address');
    }

    try {
      await commonSchemas.password.validate('weak');
    } catch (error) {
      expect(error.message).toContain('8 characters');
    }
  });
});