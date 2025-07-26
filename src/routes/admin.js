const express = require('express');
const { body, query } = require('express-validator');
const {
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All admin routes require admin authorization
router.use(authenticate);
router.use(authorize(['admin']));

/**
 * @route   GET /api/admin
 * @desc    Get all admin users with pagination and filtering
 * @access  Private (Admin only)
 */
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('role')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Role must be less than 100 characters'),
  query('sort_by')
    .optional()
    .isIn(['first_name', 'last_name', 'role', 'created_at'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getAdmins);

/**
 * @route   POST /api/admin
 * @desc    Create new admin user
 * @access  Private (Admin only)
 */
router.post('/', [
  validationRules.email(),
  validationRules.firstName(),
  validationRules.lastName(),
  body('role')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Role is required and must be less than 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  body('generatePassword')
    .optional()
    .isBoolean()
    .withMessage('Generate password must be a boolean'),
  body('password')
    .if(body('generatePassword').equals(false))
    .notEmpty()
    .withMessage('Password is required when not generating automatically')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters'),
  handleValidationErrors
], createAdmin);

/**
 * @route   GET /api/admin/:id
 * @desc    Get admin user by ID
 * @access  Private (Admin only)
 */
router.get('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], getAdminById);

/**
 * @route   PUT /api/admin/:id
 * @desc    Update admin user
 * @access  Private (Admin only)
 */
router.put('/:id', [
  validationRules.uuid('id'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('role')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Role must be between 1 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  handleValidationErrors
], updateAdmin);

/**
 * @route   DELETE /api/admin/:id
 * @desc    Delete admin user
 * @access  Private (Admin only)
 */
router.delete('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], deleteAdmin);

module.exports = router;
