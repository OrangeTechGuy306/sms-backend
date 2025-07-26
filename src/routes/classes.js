const express = require('express');
const { body, query } = require('express-validator');
const {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass
} = require('../controllers/classController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/classes
 * @desc    Get all classes with pagination and filtering
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
  query('grade_level_id')
    .optional()
    .isUUID()
    .withMessage('Grade level ID must be a valid UUID'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  query('sort_by')
    .optional()
    .isIn(['name', 'capacity', 'room_number', 'created_at'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getClasses);

/**
 * @route   POST /api/classes
 * @desc    Create new class
 * @access  Private (Admin only)
 */
router.post('/', [
  authorize(['admin']),
  validationRules.className(),
  body('gradeLevelId')
    .isUUID()
    .withMessage('Grade level ID must be a valid UUID'),
  body('academicYearId')
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  body('classTeacherId')
    .optional()
    .isUUID()
    .withMessage('Class teacher ID must be a valid UUID'),
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be between 1 and 100'),
  body('roomNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Room number must be less than 50 characters'),
  handleValidationErrors
], createClass);

/**
 * @route   GET /api/classes/:id
 * @desc    Get class by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], getClassById);

/**
 * @route   PUT /api/classes/:id
 * @desc    Update class
 * @access  Private (Admin only)
 */
router.put('/:id', [
  authorize(['admin']),
  validationRules.uuid('id'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Class name must be between 1 and 100 characters'),
  body('classTeacherId')
    .optional()
    .isUUID()
    .withMessage('Class teacher ID must be a valid UUID'),
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be between 1 and 100'),
  body('roomNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Room number must be less than 50 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  handleValidationErrors
], updateClass);

/**
 * @route   DELETE /api/classes/:id
 * @desc    Delete class
 * @access  Private (Admin only)
 */
router.delete('/:id', [
  authorize(['admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], deleteClass);

/**
 * @route   GET /api/classes/:id/students
 * @desc    Get students in a class
 * @access  Private (Admin, Teacher)
 */
router.get('/:id/students', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { id } = req.params;

    const studentsQuery = `
      SELECT
        s.id,
        s.student_id,
        s.first_name,
        s.last_name,
        s.middle_name,
        s.date_of_birth,
        s.gender,
        s.phone,
        s.status,
        s.admission_date,
        CONCAT(s.first_name, ' ', s.last_name) as full_name,
        u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.class_id = ? AND s.status = 'active'
      ORDER BY s.first_name, s.last_name
    `;

    const students = await executeQuery(studentsQuery, [id]);

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get class students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class students'
    });
  }
});

/**
 * @route   POST /api/classes/:id/students
 * @desc    Add students to class
 * @access  Private (Admin only)
 */
router.post('/:id/students', [
  authorize(['admin']),
  validationRules.uuid('id'),
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('Student IDs must be a non-empty array'),
  body('studentIds.*')
    .isUUID()
    .withMessage('Each student ID must be a valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery, executeTransaction } = require('../config/database');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');

    const { id } = req.params;
    const { studentIds } = sanitizeInput(req.body);

    // Check if class exists
    const classExists = await executeQuery('SELECT id FROM classes WHERE id = ?', [id]);
    if (classExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Update students' current class
    const queries = studentIds.map(studentId => ({
      query: 'UPDATE students SET class_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      params: [id, studentId]
    }));

    await executeTransaction(queries);

    logger.info(`Students added to class ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: `${studentIds.length} students added to class successfully`
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Add students to class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add students to class'
    });
  }
});

/**
 * @route   DELETE /api/classes/:id/students/:studentId
 * @desc    Remove student from class
 * @access  Private (Admin only)
 */
router.delete('/:id/students/:studentId', [
  authorize(['admin']),
  validationRules.uuid('id'),
  validationRules.uuid('studentId'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const logger = require('../utils/logger');

    const { id, studentId } = req.params;

    // Check if student is in the class
    const studentInClass = await executeQuery(
      'SELECT id FROM students WHERE id = ? AND class_id = ?',
      [studentId, id]
    );

    if (studentInClass.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in this class'
      });
    }

    // Remove student from class (set class_id to NULL)
    await executeQuery(
      'UPDATE students SET class_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [studentId]
    );

    logger.info(`Student ${studentId} removed from class ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Student removed from class successfully'
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Remove student from class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove student from class'
    });
  }
});

module.exports = router;
