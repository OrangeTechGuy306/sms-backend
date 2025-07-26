const express = require('express');
const { body, query, param } = require('express-validator');
const {
  getTeacherDashboard,
  getTeacherProfile,
  updateTeacherProfile,
  getTeacherClasses,
  getTeacherSubjects,
  getTeacherStudents,
  getTeacherTimetable,
  getTeacherAttendance,
  getTeacherAssessments,
  getTeacherLessonNotes,
  getTeacherResults
} = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication and teacher role
router.use(authenticate);
router.use(authorize(['teacher']));

/**
 * @route   GET /api/teacher-portal/dashboard
 * @desc    Get teacher dashboard data
 * @access  Private (Teacher only - own data)
 */
router.get('/dashboard', getTeacherDashboard);

/**
 * @route   GET /api/teacher-portal/profile
 * @desc    Get teacher profile
 * @access  Private (Teacher only - own data)
 */
router.get('/profile', getTeacherProfile);

/**
 * @route   PUT /api/teacher-portal/profile
 * @desc    Update teacher profile (limited fields)
 * @access  Private (Teacher only - own data)
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
  body('qualification')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Qualification must be less than 500 characters'),
  body('specialization')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Specialization must be less than 200 characters'),
  handleValidationErrors
], updateTeacherProfile);

/**
 * @route   GET /api/teacher-portal/classes
 * @desc    Get teacher's assigned classes
 * @access  Private (Teacher only - own data)
 */
router.get('/classes', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
], getTeacherClasses);

/**
 * @route   GET /api/teacher-portal/subjects
 * @desc    Get teacher's assigned subjects
 * @access  Private (Teacher only - own data)
 */
router.get('/subjects', getTeacherSubjects);

/**
 * @route   GET /api/teacher-portal/students
 * @desc    Get students under teacher's classes
 * @access  Private (Teacher only - own data)
 */
router.get('/students', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'graduated', 'transferred'])
    .withMessage('Invalid status'),
  handleValidationErrors
], getTeacherStudents);

/**
 * @route   GET /api/teacher-portal/timetable
 * @desc    Get teacher's timetable/schedule
 * @access  Private (Teacher only - own data)
 */
router.get('/timetable', getTeacherTimetable);

/**
 * @route   GET /api/teacher-portal/attendance
 * @desc    Get attendance records for teacher's classes
 * @access  Private (Teacher only - own data)
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
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  query('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  query('status')
    .optional()
    .isIn(['present', 'absent', 'late', 'excused'])
    .withMessage('Invalid attendance status'),
  handleValidationErrors
], getTeacherAttendance);

/**
 * @route   GET /api/teacher-portal/assessments
 * @desc    Get teacher's assessments
 * @access  Private (Teacher only - own data)
 */
router.get('/assessments', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['draft', 'published', 'completed', 'archived'])
    .withMessage('Invalid assessment status'),
  query('assessment_type')
    .optional()
    .isIn(['quiz', 'test', 'exam', 'assignment', 'project'])
    .withMessage('Invalid assessment type'),
  query('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  handleValidationErrors
], getTeacherAssessments);

/**
 * @route   GET /api/teacher-portal/lesson-notes
 * @desc    Get teacher's lesson notes
 * @access  Private (Teacher only - own data)
 */
router.get('/lesson-notes', [
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
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  handleValidationErrors
], getTeacherLessonNotes);

/**
 * @route   GET /api/teacher-portal/results
 * @desc    Get results for teacher's subjects/classes
 * @access  Private (Teacher only - own data)
 */
router.get('/results', [
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
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  query('assessment_id')
    .optional()
    .isUUID()
    .withMessage('Assessment ID must be a valid UUID'),
  query('student_id')
    .optional()
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  handleValidationErrors
], getTeacherResults);

module.exports = router;
