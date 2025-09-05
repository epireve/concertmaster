import * as yup from 'yup';

// Common validation patterns
export const validationPatterns = {
  email: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  creditCard: /^[0-9]{13,19}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
};

// File validation helpers
export const fileValidation = {
  maxSize: (maxBytes: number) => (file?: File) => {
    if (!file) return true;
    return file.size <= maxBytes;
  },
  
  allowedTypes: (types: string[]) => (file?: File) => {
    if (!file) return true;
    return types.some(type => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      return file.type.match(type.replace('*', '.*'));
    });
  },
  
  requiredFile: (value: any) => {
    if (Array.isArray(value)) {
      return value.length > 0 && value.some(f => f.status === 'success' || f.status === 'pending');
    }
    return value && (value.status === 'success' || value.status === 'pending');
  }
};

// Common validation schemas
export const commonSchemas = {
  // Basic text validations
  requiredString: yup.string().required('This field is required'),
  optionalString: yup.string().optional(),
  
  // Email validation
  email: yup.string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  
  optionalEmail: yup.string()
    .email('Please enter a valid email address')
    .optional(),
    
  // Phone validation
  phone: yup.string()
    .matches(validationPatterns.phone, 'Please enter a valid phone number')
    .required('Phone number is required'),
    
  optionalPhone: yup.string()
    .matches(validationPatterns.phone, 'Please enter a valid phone number')
    .optional(),
    
  // URL validation
  url: yup.string()
    .matches(validationPatterns.url, 'Please enter a valid URL')
    .required('URL is required'),
    
  optionalUrl: yup.string()
    .matches(validationPatterns.url, 'Please enter a valid URL')
    .optional(),
    
  // Password validation
  password: yup.string()
    .min(8, 'Password must be at least 8 characters long')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/\d/, 'Password must contain at least one number')
    .matches(/[@$!%*?&]/, 'Password must contain at least one special character')
    .required('Password is required'),
    
  // Confirm password
  confirmPassword: (passwordFieldName: string = 'password') => 
    yup.string()
      .oneOf([yup.ref(passwordFieldName)], 'Passwords must match')
      .required('Please confirm your password'),
      
  // Number validations
  positiveNumber: yup.number()
    .positive('Must be a positive number')
    .required('This field is required'),
    
  optionalPositiveNumber: yup.number()
    .positive('Must be a positive number')
    .optional(),
    
  // Boolean validations
  requiredBoolean: yup.boolean()
    .oneOf([true], 'This field is required')
    .required('This field is required'),
    
  optionalBoolean: yup.boolean().optional(),
  
  // Array validations
  requiredArray: yup.array()
    .min(1, 'Please select at least one option')
    .required('This field is required'),
    
  // Date validations
  futureDate: yup.date()
    .min(new Date(), 'Date must be in the future')
    .required('Date is required'),
    
  pastDate: yup.date()
    .max(new Date(), 'Date must be in the past')
    .required('Date is required'),
    
  // File validations
  requiredFile: yup.mixed()
    .test('required-file', 'Please upload a file', fileValidation.requiredFile)
    .required('File is required'),
    
  optionalFile: yup.mixed().optional(),
  
  // Image file validation
  imageFile: (maxSize: number = 5 * 1024 * 1024) => yup.mixed()
    .test('file-size', `File size must be less than ${formatFileSize(maxSize)}`, 
      fileValidation.maxSize(maxSize))
    .test('file-type', 'Only image files are allowed',
      fileValidation.allowedTypes(['image/*']))
    .required('Image is required'),
    
  // Document file validation
  documentFile: (maxSize: number = 10 * 1024 * 1024) => yup.mixed()
    .test('file-size', `File size must be less than ${formatFileSize(maxSize)}`,
      fileValidation.maxSize(maxSize))
    .test('file-type', 'Only PDF, DOC, and DOCX files are allowed',
      fileValidation.allowedTypes(['.pdf', '.doc', '.docx']))
    .required('Document is required'),
};

// Form-specific schemas
export const formSchemas = {
  // User registration
  userRegistration: yup.object({
    firstName: commonSchemas.requiredString
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name must be less than 50 characters'),
    lastName: commonSchemas.requiredString
      .min(2, 'Last name must be at least 2 characters')
      .max(50, 'Last name must be less than 50 characters'),
    email: commonSchemas.email,
    phone: commonSchemas.optionalPhone,
    password: commonSchemas.password,
    confirmPassword: commonSchemas.confirmPassword(),
    terms: commonSchemas.requiredBoolean,
    newsletter: commonSchemas.optionalBoolean.default(false),
  }),
  
  // User profile
  userProfile: yup.object({
    firstName: commonSchemas.requiredString,
    lastName: commonSchemas.requiredString,
    email: commonSchemas.email,
    phone: commonSchemas.optionalPhone,
    bio: yup.string().max(500, 'Bio must be less than 500 characters').optional(),
    website: commonSchemas.optionalUrl,
    avatar: commonSchemas.optionalFile,
  }),
  
  // Contact form
  contactForm: yup.object({
    name: commonSchemas.requiredString
      .min(2, 'Name must be at least 2 characters'),
    email: commonSchemas.email,
    subject: commonSchemas.requiredString
      .max(100, 'Subject must be less than 100 characters'),
    message: commonSchemas.requiredString
      .min(10, 'Message must be at least 10 characters')
      .max(1000, 'Message must be less than 1000 characters'),
    urgency: yup.string().oneOf(['low', 'medium', 'high'], 'Invalid urgency level'),
    attachments: yup.array().max(5, 'Maximum 5 files allowed').optional(),
  }),
  
  // Login form
  login: yup.object({
    email: commonSchemas.email,
    password: yup.string().required('Password is required'),
    rememberMe: commonSchemas.optionalBoolean.default(false),
  }),
  
  // Password reset
  passwordReset: yup.object({
    email: commonSchemas.email,
  }),
  
  // Change password
  changePassword: yup.object({
    currentPassword: yup.string().required('Current password is required'),
    newPassword: commonSchemas.password,
    confirmPassword: commonSchemas.confirmPassword('newPassword'),
  }),
  
  // Address form
  address: yup.object({
    street: commonSchemas.requiredString,
    city: commonSchemas.requiredString,
    state: commonSchemas.requiredString,
    zipCode: yup.string()
      .matches(validationPatterns.zipCode, 'Please enter a valid zip code')
      .required('Zip code is required'),
    country: commonSchemas.requiredString,
  }),
  
  // Payment form
  payment: yup.object({
    cardNumber: yup.string()
      .matches(validationPatterns.creditCard, 'Please enter a valid card number')
      .required('Card number is required'),
    expiryMonth: yup.number()
      .min(1, 'Invalid month')
      .max(12, 'Invalid month')
      .required('Expiry month is required'),
    expiryYear: yup.number()
      .min(new Date().getFullYear(), 'Card has expired')
      .required('Expiry year is required'),
    cvv: yup.string()
      .matches(/^\d{3,4}$/, 'Please enter a valid CVV')
      .required('CVV is required'),
    cardholderName: commonSchemas.requiredString,
  }),
  
  // Survey/feedback form
  feedback: yup.object({
    rating: yup.number()
      .min(1, 'Please select a rating')
      .max(5, 'Invalid rating')
      .required('Rating is required'),
    categories: commonSchemas.requiredArray,
    feedback: commonSchemas.requiredString
      .min(10, 'Please provide more detailed feedback')
      .max(2000, 'Feedback must be less than 2000 characters'),
    recommend: commonSchemas.requiredBoolean,
    email: commonSchemas.optionalEmail,
  }),
};

// Utility functions for validation
export const validationUtils = {
  // Create conditional validation
  conditional: <T>(condition: (values: T) => boolean, schema: yup.Schema) => 
    yup.mixed().when([], {
      is: () => true,
      then: (schema) => schema.test('conditional', 'This field is required', 
        function(value) {
          const { parent } = this;
          return condition(parent) ? schema.isValidSync(value) : true;
        }
      ),
      otherwise: (schema) => schema.optional()
    }),
    
  // Create dynamic validation based on other field
  dependsOn: <T>(fieldName: keyof T, dependentSchema: yup.Schema) =>
    yup.mixed().when(fieldName as string, (value: any, schema: any) => 
      Boolean(value) ? dependentSchema : schema.optional()
    ),
    
  // Async validation with debouncing
  asyncValidation: (validatorFn: (value: any) => Promise<boolean>, errorMessage: string) => 
    yup.mixed().test('async-validation', errorMessage, async function(value) {
      if (!value) return true;
      
      try {
        return await validatorFn(value);
      } catch (error) {
        return this.createError({ message: errorMessage });
      }
    }),
};

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export Yup for custom schemas
export { yup };
