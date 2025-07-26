const express = require('express');
const { body, query, param } = require('express-validator');
const {
  getStudentDashboard,
  getStudentProfile,
  updateStudentProfile,
  getStudentAttendance,
  getStudentGrades,
  getStudentFees,
  getStudentTimetable,
  getStudentSubjects,
  getStudentEvents
} = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication and student role
router.use(authenticate);
router.use(authorize(['student']));

/**
 * @route   GET /api/student-portal/dashboard
 * @desc    Get student dashboard data
 * @access  Private (Student only - own data)
 */
router.get('/dashboard', getStudentDashboard);

/**
 * @route   GET /api/student-portal/profile
 * @desc    Get student profile
 * @access  Private (Student only - own data)
 */
router.get('/profile', getStudentProfile);

/**
 * @route   PUT /api/student-portal/profile
 * @desc    Update student profile (limited fields)
 * @access  Private (Student only - own data)
 */
router.put('/profile', [
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('address')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('emergency_contact_name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),
  body('emergency_contact_phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid emergency contact phone number'),
  body('emergency_contact_relation')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Emergency contact relation must be between 2 and 50 characters'),
  body('medical_conditions')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Medical conditions must be less than 1000 characters'),
  handleValidationErrors
], updateStudentProfile);

/**
 * @route   GET /api/student-portal/attendance
 * @desc    Get student attendance records
 * @access  Private (Student only - own data)
 */
router.get('/attendance', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100'),
  query('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  handleValidationErrors
], getStudentAttendance);

/**
 * @route   GET /api/student-portal/grades
 * @desc    Get student grades/results
 * @access  Private (Student only - own data)
 */
router.get('/grades', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  query('assessment_type')
    .optional()
    .isIn(['quiz', 'test', 'exam', 'assignment', 'project'])
    .withMessage('Invalid assessment type'),
  query('academic_year')
    .optional()
    .isLength({ min: 4, max: 20 })
    .withMessage('Academic year must be between 4 and 20 characters'),
  handleValidationErrors
], getStudentGrades);

/**
 * @route   GET /api/student-portal/fees
 * @desc    Get student fee records
 * @access  Private (Student only - own data)
 */
router.get('/fees', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('payment_status')
    .optional()
    .isIn(['pending', 'paid', 'overdue', 'cancelled'])
    .withMessage('Invalid payment status'),
  query('academic_year')
    .optional()
    .isLength({ min: 4, max: 20 })
    .withMessage('Academic year must be between 4 and 20 characters'),
  handleValidationErrors
], getStudentFees);

/**
 * @route   GET /api/student-portal/timetable
 * @desc    Get student timetable
 * @access  Private (Student only - own data)
 */
router.get('/timetable', getStudentTimetable);

/**
 * @route   GET /api/student-portal/subjects
 * @desc    Get student subjects
 * @access  Private (Student only - own data)
 */
router.get('/subjects', getStudentSubjects);

/**
 * @route   GET /api/student-portal/events
 * @desc    Get student events
 * @access  Private (Student only)
 */
router.get('/events', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('upcoming_only')
    .optional()
    .isBoolean()
    .withMessage('Upcoming only must be a boolean value'),
  handleValidationErrors
], getStudentEvents);

module.exports = router;
