const express = require('express');
const { body } = require('express-validator');
const { 
  getLessonNotes, 
  getLessonNoteById, 
  createLessonNote, 
  updateLessonNote, 
  deleteLessonNote 
} = require('../controllers/lessonNotesController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

/**
 * @route   GET /api/lesson-notes
 * @desc    Get all lesson notes with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get('/', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  validationRules.search(),
  handleValidationErrors
], getLessonNotes);

/**
 * @route   POST /api/lesson-notes
 * @desc    Create new lesson note
 * @access  Private (Teachers and Admins only)
 */
router.post('/', [
  authenticate,
  authorize(['teacher', 'admin']),
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title is required and must be less than 255 characters'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content is required and must be less than 10000 characters'),
  body('subject_id')
    .isUUID()
    .withMessage('Valid subject ID is required'),
  body('academic_year_id')
    .isUUID()
    .withMessage('Valid academic year ID is required'),
  body('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  body('grade_level_id')
    .optional()
    .isUUID()
    .withMessage('Grade level ID must be a valid UUID'),
  body('teacher_id')
    .optional()
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),
  body('lesson_date')
    .optional()
    .isISO8601()
    .withMessage('Lesson date must be a valid date'),
  body('objectives')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Objectives must be less than 2000 characters'),
  body('materials')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Materials must be less than 2000 characters'),
  body('homework')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Homework must be less than 2000 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('is_public must be a boolean value'),
  handleValidationErrors
], createLessonNote);

/**
 * @route   GET /api/lesson-notes/:id
 * @desc    Get lesson note by ID
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id', [
  authenticate,
  validationRules.uuid('id'),
  handleValidationErrors
], getLessonNoteById);

/**
 * @route   PUT /api/lesson-notes/:id
 * @desc    Update lesson note
 * @access  Private (Teachers and Admins only)
 */
router.put('/:id', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('id'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  body('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  body('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  body('grade_level_id')
    .optional()
    .isUUID()
    .withMessage('Grade level ID must be a valid UUID'),
  body('lesson_date')
    .optional()
    .isISO8601()
    .withMessage('Lesson date must be a valid date'),
  body('objectives')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Objectives must be less than 2000 characters'),
  body('materials')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Materials must be less than 2000 characters'),
  body('homework')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Homework must be less than 2000 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('is_public must be a boolean value'),
  handleValidationErrors
], updateLessonNote);

/**
 * @route   DELETE /api/lesson-notes/:id
 * @desc    Delete lesson note
 * @access  Private (Teachers and Admins only)
 */
router.delete('/:id', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], deleteLessonNote);

/**
 * @route   GET /api/lesson-notes/teacher/:teacherId
 * @desc    Get lesson notes by teacher
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
  // Redirect to main endpoint with teacher filter
  req.query.teacher_id = req.params.teacherId;
  return getLessonNotes(req, res);
});

/**
 * @route   GET /api/lesson-notes/subject/:subjectId
 * @desc    Get lesson notes by subject
 * @access  Private (All authenticated users)
 */
router.get('/subject/:subjectId', [
  authenticate,
  validationRules.uuid('subjectId'),
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], async (req, res) => {
  // Redirect to main endpoint with subject filter
  req.query.subject_id = req.params.subjectId;
  return getLessonNotes(req, res);
});

/**
 * @route   GET /api/lesson-notes/class/:classId
 * @desc    Get lesson notes by class
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
  return getLessonNotes(req, res);
});

/**
 * @route   POST /api/lesson-notes/:id/publish
 * @desc    Publish lesson note
 * @access  Private (Teachers and Admins only)
 */
router.post('/:id/publish', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // Update status to published
  req.body = { status: 'published' };
  return updateLessonNote(req, res);
});

/**
 * @route   POST /api/lesson-notes/:id/archive
 * @desc    Archive lesson note
 * @access  Private (Teachers and Admins only)
 */
router.post('/:id/archive', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // Update status to archived
  req.body = { status: 'archived' };
  return updateLessonNote(req, res);
});

module.exports = router;
