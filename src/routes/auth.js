const express = require('express');
const { body } = require('express-validator');
const { login, refreshToken, getProfile, updateProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    User login
 * @access  Public
 */
router.post('/login', [
  validationRules.email(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
], login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
  handleValidationErrors
], refreshToken);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', [
  authenticate,
  // Optional validations for profile fields
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('middle_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Middle name must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]*$/)
    .withMessage('Middle name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('work_phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid work phone number'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  
  body('qualification')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Qualification must be less than 255 characters'),
  
  body('specialization')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Specialization must be less than 255 characters'),
  
  body('occupation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Occupation must be less than 100 characters'),
  
  handleValidationErrors
], updateProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    User logout (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticate, (req, res) => {
  // In a stateless JWT system, logout is typically handled client-side
  // by removing the token from storage. However, we can log the logout event.
  const logger = require('../utils/logger');
  logger.info(`User ${req.user.id} logged out`);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', [
  validationRules.email(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { generatePasswordResetToken } = require('../utils/password');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');
    
    const { email } = sanitizeInput(req.body);
    
    // Check if user exists
    const userQuery = 'SELECT id, email FROM users WHERE email = ? AND status = "active"';
    const users = await executeQuery(userQuery, [email]);
    
    // Always return success to prevent email enumeration
    if (users.length === 0) {
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    }
    
    const user = users[0];
    const { token, expires } = generatePasswordResetToken();
    
    // Save reset token
    await executeQuery(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [token, expires, user.id]
    );
    
    // TODO: Send email with reset link
    // For now, we'll just log it (in production, integrate with email service)
    logger.info(`Password reset requested for user ${user.email}. Token: ${token}`);
    
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
    
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  validationRules.password(),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { hashPassword } = require('../utils/password');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');
    
    const { token, password } = sanitizeInput(req.body);
    
    // Find user with valid reset token
    const userQuery = `
      SELECT id, email 
      FROM users 
      WHERE password_reset_token = ? 
        AND password_reset_expires > NOW() 
        AND status = 'active'
    `;
    const users = await executeQuery(userQuery, [token]);
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    const user = users[0];
    const hashedPassword = await hashPassword(password);
    
    // Update password and clear reset token
    await executeQuery(
      `UPDATE users 
       SET password_hash = ?, 
           password_reset_token = NULL, 
           password_reset_expires = NULL 
       WHERE id = ?`,
      [hashedPassword, user.id]
    );
    
    logger.info(`Password reset completed for user ${user.email}`);
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
    
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password (authenticated user)
 * @access  Private
 */
router.post('/change-password', [
  authenticate,
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  validationRules.password(),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { hashPassword, comparePassword } = require('../utils/password');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');
    
    const userId = req.user.id;
    const { currentPassword, password } = sanitizeInput(req.body);
    
    // Get current password hash
    const userQuery = 'SELECT password_hash FROM users WHERE id = ?';
    const users = await executeQuery(userQuery, [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = users[0];
    
    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password_hash);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(password);
    
    // Update password
    await executeQuery(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    logger.info(`Password changed for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

module.exports = router;
