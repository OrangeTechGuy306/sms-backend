const express = require('express');
const { body, query } = require('express-validator');
const {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject
} = require('../controllers/subjectController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/subjects
 * @desc    Get all subjects with pagination and filtering
 * @access  Private (All authenticated users)
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
  query('department_id')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  query('is_core')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Is core must be true or false'),
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  query('sort_by')
    .optional()
    .isIn(['name', 'code', 'credit_hours', 'created_at'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getSubjects);

/**
 * @route   POST /api/subjects
 * @desc    Create new subject
 * @access  Private (Admin, Teacher)
 */
router.post('/', [
  authorize(['admin', 'teacher']),
  validationRules.subjectCode(),
  validationRules.subjectName(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('departmentId')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  body('creditHours')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Credit hours must be between 1 and 10'),
  body('isCore')
    .optional()
    .isBoolean()
    .withMessage('Is core must be a boolean'),
  handleValidationErrors
], createSubject);

/**
 * @route   GET /api/subjects/:id
 * @desc    Get subject by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], getSubjectById);

/**
 * @route   PUT /api/subjects/:id
 * @desc    Update subject
 * @access  Private (Admin, Teacher)
 */
router.put('/:id', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Subject name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('departmentId')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  body('creditHours')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Credit hours must be between 1 and 10'),
  body('isCore')
    .optional()
    .isBoolean()
    .withMessage('Is core must be a boolean'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  handleValidationErrors
], updateSubject);

/**
 * @route   DELETE /api/subjects/:id
 * @desc    Delete subject
 * @access  Private (Admin only)
 */
router.delete('/:id', [
  authorize(['admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], deleteSubject);

module.exports = router;
