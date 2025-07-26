const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Hash password using bcrypt
 * @param {String} password - Plain text password
 * @returns {String} Hashed password
 */
async function hashPassword(password) {
  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new Error('Password hashing failed');
  }
}

/**
 * Compare password with hash
 * @param {String} password - Plain text password
 * @param {String} hash - Hashed password
 * @returns {Boolean} True if password matches
 */
async function comparePassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Error comparing password:', error);
    throw new Error('Password comparison failed');
  }
}

/**
 * Generate random password
 * @param {Number} length - Password length (default: 12)
 * @returns {String} Random password
 */
function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
}

/**
 * Generate secure random token
 * @param {Number} bytes - Number of bytes (default: 32)
 * @returns {String} Random token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Validate password strength
 * @param {String} password - Password to validate
 * @returns {Object} Validation result
 */
function validatePasswordStrength(password) {
  const result = {
    isValid: true,
    errors: [],
    score: 0
  };

  // Minimum length check
  if (password.length < 8) {
    result.isValid = false;
    result.errors.push('Password must be at least 8 characters long');
  } else {
    result.score += 1;
  }

  // Maximum length check
  if (password.length > 128) {
    result.isValid = false;
    result.errors.push('Password must not exceed 128 characters');
  }

  // Lowercase letter check
  if (!/[a-z]/.test(password)) {
    result.isValid = false;
    result.errors.push('Password must contain at least one lowercase letter');
  } else {
    result.score += 1;
  }

  // Uppercase letter check
  if (!/[A-Z]/.test(password)) {
    result.isValid = false;
    result.errors.push('Password must contain at least one uppercase letter');
  } else {
    result.score += 1;
  }

  // Number check
  if (!/\d/.test(password)) {
    result.isValid = false;
    result.errors.push('Password must contain at least one number');
  } else {
    result.score += 1;
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    result.errors.push('Password should contain at least one special character');
    // Not making this required, just recommended
  } else {
    result.score += 1;
  }

  // Common password patterns check
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
    /letmein/i,
    /welcome/i
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      result.isValid = false;
      result.errors.push('Password contains common patterns and is not secure');
      break;
    }
  }

  // Sequential characters check
  if (/(.)\1{2,}/.test(password)) {
    result.errors.push('Password should not contain repeated characters');
  }

  return result;
}

/**
 * Generate password reset token with expiry
 * @returns {Object} Token and expiry
 */
function generatePasswordResetToken() {
  const token = generateSecureToken(32);
  const expires = new Date();
  expires.setHours(expires.getHours() + 1); // 1 hour expiry

  return {
    token,
    expires
  };
}

/**
 * Generate email verification token
 * @returns {String} Verification token
 */
function generateEmailVerificationToken() {
  return generateSecureToken(32);
}

module.exports = {
  hashPassword,
  comparePassword,
  generateRandomPassword,
  generateSecureToken,
  validatePasswordStrength,
  generatePasswordResetToken,
  generateEmailVerificationToken
};
