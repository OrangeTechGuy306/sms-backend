const express = require('express');
const { body, query } = require('express-validator');
const {
  getResults,
  getResultById,
  createResult,
  updateResult,
  deleteResult
} = require('../controllers/resultController');
const { authenticate, authorize, checkResourceOwnership } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/results
 * @desc    Get all results with pagination and filtering
 * @access  Private (Admin, Teacher)
 */
router.get('/', [
  authorize(['admin', 'teacher']),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('student_id')
    .optional()
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  query('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  query('term_id')
    .optional()
    .isUUID()
    .withMessage('Term ID must be a valid UUID'),
  query('assessment_type_id')
    .optional()
    .isUUID()
    .withMessage('Assessment type ID must be a valid UUID'),
  query('sort_by')
    .optional()
    .isIn(['score', 'created_at', 'student_name', 'subject_name'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getResults);

/**
 * @route   POST /api/results
 * @desc    Create new result
 * @access  Private (Admin, Teacher)
 */
router.post('/', [
  authorize(['admin', 'teacher']),
  body('studentId')
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  body('subjectId')
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  body('classId')
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  body('termId')
    .isUUID()
    .withMessage('Term ID must be a valid UUID'),
  body('assessmentTypeId')
    .isUUID()
    .withMessage('Assessment type ID must be a valid UUID'),
  validationRules.score(),
  body('maxScore')
    .optional()
    .isFloat({ min: 1, max: 1000 })
    .withMessage('Max score must be between 1 and 1000'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks must be less than 1000 characters'),
  body('teacherId')
    .optional()
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),
  handleValidationErrors
], createResult);

/**
 * @route   GET /api/results/:id
 * @desc    Get result by ID
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], getResultById);

/**
 * @route   PUT /api/results/:id
 * @desc    Update result
 * @access  Private (Admin, Teacher)
 */
router.put('/:id', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  body('score')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Score must be between 0 and 1000'),
  body('maxScore')
    .optional()
    .isFloat({ min: 1, max: 1000 })
    .withMessage('Max score must be between 1 and 1000'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks must be less than 1000 characters'),
  handleValidationErrors
], updateResult);

/**
 * @route   DELETE /api/results/:id
 * @desc    Delete result
 * @access  Private (Admin only)
 */
router.delete('/:id', [
  authorize(['admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], deleteResult);

/**
 * @route   GET /api/results/student/:studentId
 * @desc    Get student's results
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/student/:studentId', [
  validationRules.uuid('studentId'),
  query('term_id')
    .optional()
    .isUUID()
    .withMessage('Term ID must be a valid UUID'),
  query('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  handleValidationErrors,
  checkResourceOwnership('studentId', 'student')
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { studentId } = req.params;
    const { term_id, subject_id } = req.query;

    let whereConditions = ['sr.student_id = ?'];
    let queryParams = [studentId];

    if (term_id) {
      whereConditions.push('sr.term_id = ?');
      queryParams.push(term_id);
    }

    if (subject_id) {
      whereConditions.push('sr.subject_id = ?');
      queryParams.push(subject_id);
    }

    const resultsQuery = `
      SELECT
        sr.id,
        sr.score,
        sr.max_score,
        sr.grade,
        sr.remarks,
        sr.created_at,
        sub.name as subject_name,
        sub.code as subject_code,
        t.name as term_name,
        at.name as assessment_type,
        at.weight_percentage,
        CONCAT(teacher.first_name, ' ', teacher.last_name) as teacher_name,
        ROUND((sr.score / sr.max_score) * 100, 2) as percentage
      FROM student_results sr
      JOIN subjects sub ON sr.subject_id = sub.id
      JOIN terms t ON sr.term_id = t.id
      JOIN assessment_types at ON sr.assessment_type_id = at.id
      JOIN teachers teacher ON sr.teacher_id = teacher.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY t.start_date DESC, sub.name, at.name
    `;

    const results = await executeQuery(resultsQuery, queryParams);

    // Calculate overall statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_results,
        AVG(ROUND((sr.score / sr.max_score) * 100, 2)) as average_percentage,
        MAX(ROUND((sr.score / sr.max_score) * 100, 2)) as highest_percentage,
        MIN(ROUND((sr.score / sr.max_score) * 100, 2)) as lowest_percentage
      FROM student_results sr
      WHERE ${whereConditions.join(' AND ')}
    `;

    const stats = await executeQuery(statsQuery, queryParams);

    res.json({
      success: true,
      data: {
        results,
        statistics: stats[0]
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get student results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student results'
    });
  }
});

/**
 * @route   GET /api/results/class/:classId
 * @desc    Get class results
 * @access  Private (Admin, Teacher)
 */
router.get('/class/:classId', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('classId'),
  query('term_id')
    .optional()
    .isUUID()
    .withMessage('Term ID must be a valid UUID'),
  query('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  query('assessment_type_id')
    .optional()
    .isUUID()
    .withMessage('Assessment type ID must be a valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { classId } = req.params;
    const { term_id, subject_id, assessment_type_id } = req.query;

    let whereConditions = ['sr.class_id = ?'];
    let queryParams = [classId];

    if (term_id) {
      whereConditions.push('sr.term_id = ?');
      queryParams.push(term_id);
    }

    if (subject_id) {
      whereConditions.push('sr.subject_id = ?');
      queryParams.push(subject_id);
    }

    if (assessment_type_id) {
      whereConditions.push('sr.assessment_type_id = ?');
      queryParams.push(assessment_type_id);
    }

    const resultsQuery = `
      SELECT
        sr.id,
        sr.score,
        sr.max_score,
        sr.grade,
        sr.created_at,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        s.student_id,
        sub.name as subject_name,
        sub.code as subject_code,
        t.name as term_name,
        at.name as assessment_type,
        ROUND((sr.score / sr.max_score) * 100, 2) as percentage
      FROM student_results sr
      JOIN students s ON sr.student_id = s.id
      JOIN subjects sub ON sr.subject_id = sub.id
      JOIN terms t ON sr.term_id = t.id
      JOIN assessment_types at ON sr.assessment_type_id = at.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY s.first_name, s.last_name, sub.name, at.name
    `;

    const results = await executeQuery(resultsQuery, queryParams);

    // Calculate class statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_results,
        COUNT(DISTINCT sr.student_id) as total_students,
        AVG(ROUND((sr.score / sr.max_score) * 100, 2)) as class_average,
        MAX(ROUND((sr.score / sr.max_score) * 100, 2)) as highest_score,
        MIN(ROUND((sr.score / sr.max_score) * 100, 2)) as lowest_score
      FROM student_results sr
      WHERE ${whereConditions.join(' AND ')}
    `;

    const stats = await executeQuery(statsQuery, queryParams);

    res.json({
      success: true,
      data: {
        results,
        statistics: stats[0]
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get class results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class results'
    });
  }
});

/**
 * @route   POST /api/results/bulk
 * @desc    Bulk upload results
 * @access  Private (Admin, Teacher)
 */
router.post('/bulk', [
  authorize(['admin', 'teacher']),
  body('results')
    .isArray({ min: 1 })
    .withMessage('Results must be a non-empty array'),
  body('results.*.studentId')
    .isUUID()
    .withMessage('Each result must have a valid student ID'),
  body('results.*.subjectId')
    .isUUID()
    .withMessage('Each result must have a valid subject ID'),
  body('results.*.score')
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Each result must have a valid score'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeTransaction } = require('../config/database');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');

    const { results } = sanitizeInput(req.body);

    // Get teacher ID
    let teacherId = null;
    if (req.user.userType === 'teacher') {
      const { executeQuery } = require('../config/database');
      const teacherQuery = 'SELECT id FROM teachers WHERE user_id = ?';
      const teacherResult = await executeQuery(teacherQuery, [req.user.id]);
      if (teacherResult.length > 0) {
        teacherId = teacherResult[0].id;
      }
    }

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID is required for bulk upload'
      });
    }

    // Prepare bulk insert queries
    const queries = results.map(result => ({
      query: `
        INSERT INTO student_results (
          student_id, subject_id, class_id, term_id, assessment_type_id,
          score, max_score, grade, remarks, teacher_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        score = VALUES(score), max_score = VALUES(max_score),
        grade = VALUES(grade), remarks = VALUES(remarks),
        updated_at = CURRENT_TIMESTAMP
      `,
      params: [
        result.studentId,
        result.subjectId,
        result.classId,
        result.termId,
        result.assessmentTypeId,
        result.score,
        result.maxScore || 100,
        result.grade || 'F',
        result.remarks || '',
        teacherId
      ]
    }));

    await executeTransaction(queries);

    logger.info(`Bulk results uploaded: ${results.length} results by user ${req.user.id}`);

    res.json({
      success: true,
      message: `${results.length} results uploaded successfully`
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Bulk upload results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload results'
    });
  }
});

module.exports = router;
