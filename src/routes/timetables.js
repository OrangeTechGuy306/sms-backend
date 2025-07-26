const express = require('express');
const { body } = require('express-validator');
const { 
  getTimetables, 
  getTimetableById, 
  createTimetable, 
  updateTimetable, 
  deleteTimetable,
  addTimetablePeriod
} = require('../controllers/timetableController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

/**
 * @route   GET /api/timetables
 * @desc    Get all timetables with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get('/', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  validationRules.search(),
  handleValidationErrors
], getTimetables);

/**
 * @route   POST /api/timetables
 * @desc    Create new timetable
 * @access  Private (Admins and Teachers only)
 */
router.post('/', [
  authenticate,
  authorize(['admin', 'teacher']),
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be less than 255 characters'),
  body('class_id')
    .isUUID()
    .withMessage('Valid class ID is required'),
  body('academic_year_id')
    .isUUID()
    .withMessage('Valid academic year ID is required'),
  body('term_id')
    .optional()
    .isUUID()
    .withMessage('Term ID must be a valid UUID'),
  body('effective_from')
    .isISO8601()
    .withMessage('Valid effective from date is required'),
  body('effective_to')
    .optional()
    .isISO8601()
    .withMessage('Effective to date must be a valid date'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'inactive'])
    .withMessage('Status must be draft, active, or inactive'),
  handleValidationErrors
], createTimetable);

/**
 * @route   GET /api/timetables/:id
 * @desc    Get timetable by ID with periods
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id', [
  authenticate,
  validationRules.uuid('id'),
  handleValidationErrors
], getTimetableById);

/**
 * @route   PUT /api/timetables/:id
 * @desc    Update timetable
 * @access  Private (Admins and Creators only)
 */
router.put('/:id', [
  authenticate,
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('effective_from')
    .optional()
    .isISO8601()
    .withMessage('Effective from date must be a valid date'),
  body('effective_to')
    .optional()
    .isISO8601()
    .withMessage('Effective to date must be a valid date'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'inactive'])
    .withMessage('Status must be draft, active, or inactive'),
  handleValidationErrors
], updateTimetable);

/**
 * @route   DELETE /api/timetables/:id
 * @desc    Delete timetable
 * @access  Private (Admins and Creators only)
 */
router.delete('/:id', [
  authenticate,
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  handleValidationErrors
], deleteTimetable);

/**
 * @route   POST /api/timetables/:id/periods
 * @desc    Add period to timetable
 * @access  Private (Admins and Creators only)
 */
router.post('/:id/periods', [
  authenticate,
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  body('day_of_week')
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Valid day of week is required'),
  body('period_number')
    .isInt({ min: 1, max: 20 })
    .withMessage('Period number must be between 1 and 20'),
  body('start_time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('end_time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  body('teacher_id')
    .optional()
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),
  body('room_number')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Room number must be less than 50 characters'),
  body('period_type')
    .optional()
    .isIn(['regular', 'break', 'lunch', 'assembly', 'free'])
    .withMessage('Period type must be regular, break, lunch, assembly, or free'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  handleValidationErrors
], addTimetablePeriod);

/**
 * @route   GET /api/timetables/class/:classId
 * @desc    Get timetables by class
 * @access  Private (All authenticated users)
 */
router.get('/class/:classId', [
  authenticate,
  validationRules.uuid('classId'),
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], async (req, res) => {
  // Redirect to main endpoint with class filter
  req.query.class_id = req.params.classId;
  return getTimetables(req, res);
});

/**
 * @route   GET /api/timetables/teacher/:teacherId
 * @desc    Get timetables for teacher's classes
 * @access  Private (Teachers and Admins only)
 */
router.get('/teacher/:teacherId', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('teacherId'),
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    // Get classes taught by teacher
    const { executeQuery } = require('../config/database');
    const classesQuery = `
      SELECT DISTINCT ta.class_id
      FROM teacher_assignments ta
      WHERE ta.teacher_id = ? AND ta.status = 'active'
    `;
    
    const classes = await executeQuery(classesQuery, [teacherId]);
    
    if (classes.length === 0) {
      return res.json({
        success: true,
        message: 'No timetables found for teacher',
        data: {
          timetables: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(req.query.limit) || 20,
            hasNextPage: false,
            hasPrevPage: false
          }
        }
      });
    }
    
    // Get timetables for teacher's classes
    const classIds = classes.map(c => c.class_id);
    req.query.class_id = classIds[0]; // For now, get first class
    // TODO: Modify main function to handle multiple class IDs
    
    return getTimetables(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve teacher timetables',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/timetables/:id/activate
 * @desc    Activate timetable
 * @access  Private (Admins and Creators only)
 */
router.post('/:id/activate', [
  authenticate,
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // Update status to active
  req.body = { status: 'active' };
  return updateTimetable(req, res);
});

/**
 * @route   POST /api/timetables/:id/deactivate
 * @desc    Deactivate timetable
 * @access  Private (Admins and Creators only)
 */
router.post('/:id/deactivate', [
  authenticate,
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // Update status to inactive
  req.body = { status: 'inactive' };
  return updateTimetable(req, res);
});

/**
 * @route   GET /api/timetables/:id/export
 * @desc    Export timetable as PDF/Excel
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id/export', [
  authenticate,
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement export functionality
  res.json({
    success: true,
    message: 'Export functionality will be implemented',
    data: {
      downloadUrl: `/api/timetables/${req.params.id}/download`,
      format: req.query.format || 'pdf'
    }
  });
});

module.exports = router;
