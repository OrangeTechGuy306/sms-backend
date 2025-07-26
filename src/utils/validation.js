const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
}

/**
 * Common validation rules
 */
const validationRules = {
  // Email validation
  email: () => body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  // Password validation
  password: () => body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  // Name validation
  firstName: () => body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  lastName: () => body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  // Phone validation
  phone: () => body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  // Date validation
  dateOfBirth: () => body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      
      if (age < 3 || age > 100) {
        throw new Error('Age must be between 3 and 100 years');
      }
      
      return true;
    }),

  // Gender validation
  gender: () => body('gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  // UUID validation
  uuid: (field = 'id') => param(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`),

  // Student ID validation
  studentId: () => body('studentId')
    .optional()
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Student ID can only contain uppercase letters, numbers, and hyphens'),

  // Teacher ID validation
  teacherId: () => body('teacherId')
    .optional()
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Teacher ID can only contain uppercase letters, numbers, and hyphens'),

  // Class validation
  className: () => body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Class name is required and must be less than 100 characters'),

  // Subject validation
  subjectCode: () => body('code')
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Subject code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Subject code can only contain uppercase letters, numbers, and hyphens'),

  subjectName: () => body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Subject name is required and must be less than 100 characters'),

  // Score validation
  score: () => body('score')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Score must be a number between 0 and 100'),

  // Amount validation
  amount: () => body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),

  // Pagination validation
  page: () => query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  limit: () => query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  // Search validation
  search: () => query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  // Status validation
  userStatus: () => body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be active, inactive, or suspended'),

  studentStatus: () => body('status')
    .optional()
    .isIn(['active', 'graduated', 'transferred', 'suspended', 'expelled'])
    .withMessage('Status must be active, graduated, transferred, suspended, or expelled'),

  teacherStatus: () => body('status')
    .optional()
    .isIn(['active', 'on_leave', 'resigned', 'terminated'])
    .withMessage('Status must be active, on_leave, resigned, or terminated'),

  // Attendance validation
  attendanceStatus: () => body('status')
    .isIn(['present', 'absent', 'late', 'excused'])
    .withMessage('Attendance status must be present, absent, late, or excused'),

  attendanceDate: () => body('date')
    .isISO8601()
    .withMessage('Please provide a valid date')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      
      // Don't allow future dates beyond today
      if (date > now) {
        throw new Error('Attendance date cannot be in the future');
      }
      
      // Don't allow dates older than 1 year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (date < oneYearAgo) {
        throw new Error('Attendance date cannot be older than 1 year');
      }
      
      return true;
    }),

  // Message validation
  messageSubject: () => body('subject')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Message subject is required and must be less than 255 characters'),

  messageContent: () => body('message')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content is required and must be less than 5000 characters'),

  // File validation
  fileType: () => body('fileType')
    .optional()
    .isIn(['image', 'document', 'video', 'audio', 'other'])
    .withMessage('File type must be image, document, video, audio, or other'),

  // Event validation
  eventTitle: () => body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Event title is required and must be less than 255 characters')
};

/**
 * Sanitize input data
 */
function sanitizeInput(data) {
  if (typeof data === 'string') {
    return data.trim();
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate date format and range
 */
function isValidDate(dateString, minAge = 0, maxAge = 150) {
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return false;
  }
  
  const now = new Date();
  const age = now.getFullYear() - date.getFullYear();
  
  return age >= minAge && age <= maxAge;
}

module.exports = {
  validationRules,
  handleValidationErrors,
  sanitizeInput,
  isValidUUID,
  isValidEmail,
  isValidDate
};
