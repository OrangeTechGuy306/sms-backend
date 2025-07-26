const express = require('express');
const { body } = require('express-validator');
const { 
  getAssessments, 
  getAssessmentById, 
  createAssessment,
  addAssessmentQuestion,
  submitAssessmentAttempt
} = require('../controllers/assessmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

/**
 * @route   GET /api/assessments
 * @desc    Get all assessments with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get('/', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  validationRules.search(),
  handleValidationErrors
], getAssessments);

/**
 * @route   POST /api/assessments
 * @desc    Create new assessment
 * @access  Private (Teachers and Admins only)
 */
router.post('/', [
  authenticate,
  authorize(['teacher', 'admin']),
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title is required and must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
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
  body('term_id')
    .optional()
    .isUUID()
    .withMessage('Term ID must be a valid UUID'),
  body('teacher_id')
    .optional()
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),
  body('assessment_type')
    .isIn(['quiz', 'test', 'exam', 'assignment', 'project', 'presentation'])
    .withMessage('Assessment type must be quiz, test, exam, assignment, project, or presentation'),
  body('total_marks')
    .isFloat({ min: 1, max: 1000 })
    .withMessage('Total marks must be between 1 and 1000'),
  body('passing_marks')
    .isFloat({ min: 0 })
    .withMessage('Passing marks must be a positive number')
    .custom((value, { req }) => {
      if (value > req.body.total_marks) {
        throw new Error('Passing marks cannot be greater than total marks');
      }
      return true;
    }),
  body('duration_minutes')
    .optional()
    .isInt({ min: 1, max: 600 })
    .withMessage('Duration must be between 1 and 600 minutes'),
  body('scheduled_date')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  body('start_time')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('end_time')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('instructions')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Instructions must be less than 5000 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'active', 'completed', 'cancelled'])
    .withMessage('Status must be draft, published, active, completed, or cancelled'),
  body('is_online')
    .optional()
    .isBoolean()
    .withMessage('is_online must be a boolean value'),
  handleValidationErrors
], createAssessment);

/**
 * @route   GET /api/assessments/:id
 * @desc    Get assessment by ID with questions
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id', [
  authenticate,
  validationRules.uuid('id'),
  handleValidationErrors
], getAssessmentById);

/**
 * @route   POST /api/assessments/:id/questions
 * @desc    Add question to assessment
 * @access  Private (Teachers and Admins only)
 */
router.post('/:id/questions', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('id'),
  body('question_number')
    .isInt({ min: 1, max: 100 })
    .withMessage('Question number must be between 1 and 100'),
  body('question_text')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Question text is required and must be less than 5000 characters'),
  body('question_type')
    .isIn(['multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank'])
    .withMessage('Question type must be multiple_choice, true_false, short_answer, essay, or fill_blank'),
  body('marks')
    .isFloat({ min: 0.1, max: 100 })
    .withMessage('Marks must be between 0.1 and 100'),
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array'),
  body('correct_answer')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Correct answer must be less than 1000 characters'),
  body('explanation')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Explanation must be less than 2000 characters'),
  handleValidationErrors
], addAssessmentQuestion);

/**
 * @route   POST /api/assessments/:id/submit
 * @desc    Submit student assessment attempt
 * @access  Private (Students only)
 */
router.post('/:id/submit', [
  authenticate,
  authorize(['student']),
  validationRules.uuid('id'),
  body('answers')
    .isObject()
    .withMessage('Answers must be an object with question numbers as keys'),
  handleValidationErrors
], submitAssessmentAttempt);

/**
 * @route   GET /api/assessments/subject/:subjectId
 * @desc    Get assessments by subject
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
  return getAssessments(req, res);
});

/**
 * @route   GET /api/assessments/teacher/:teacherId
 * @desc    Get assessments by teacher
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
  return getAssessments(req, res);
});

/**
 * @route   GET /api/assessments/class/:classId
 * @desc    Get assessments by class
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
  return getAssessments(req, res);
});

/**
 * @route   POST /api/assessments/:id/publish
 * @desc    Publish assessment
 * @access  Private (Teachers and Admins only)
 */
router.post('/:id/publish', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement publish assessment functionality
  res.json({
    success: true,
    message: 'Assessment publish functionality - to be implemented',
    data: {
      assessment_id: req.params.id,
      status: 'published'
    }
  });
});

/**
 * @route   GET /api/assessments/:id/results
 * @desc    Get assessment results and statistics
 * @access  Private (Teachers and Admins only)
 */
router.get('/:id/results', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement assessment results functionality
  res.json({
    success: true,
    message: 'Assessment results functionality - to be implemented',
    data: {
      assessment_id: req.params.id,
      total_attempts: 0,
      average_score: 0,
      pass_rate: 0,
      attempts: []
    }
  });
});

/**
 * @route   GET /api/assessments/:id/export
 * @desc    Export assessment as PDF/Word
 * @access  Private (Teachers and Admins only)
 */
router.get('/:id/export', [
  authenticate,
  authorize(['teacher', 'admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement export functionality
  res.json({
    success: true,
    message: 'Assessment export functionality - to be implemented',
    data: {
      assessment_id: req.params.id,
      download_url: `/api/assessments/${req.params.id}/download`,
      format: req.query.format || 'pdf'
    }
  });
});

module.exports = router;
