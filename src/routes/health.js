const express = require('express');
const { body, query } = require('express-validator');
const {
  getStudentHealthRecords,
  createHealthRecord,
  updateHealthRecord,
  recordVaccination,
  getStudentVaccinations,
  recordNurseVisit,
  getStudentNurseVisits
} = require('../controllers/healthController');
const { authenticate, authorize, checkResourceOwnership } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/health/student/:studentId
 * @desc    Get student health records
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/student/:studentId', [
  validationRules.uuid('studentId'),
  query('type')
    .optional()
    .isIn(['illness', 'injury', 'allergy', 'medication', 'checkup', 'other'])
    .withMessage('Type must be illness, injury, allergy, medication, checkup, or other'),
  handleValidationErrors,
  checkResourceOwnership('studentId', 'student')
], getStudentHealthRecords);

/**
 * @route   POST /api/health/records
 * @desc    Create health record
 * @access  Private (Admin, Teacher)
 */
router.post('/records', [
  authorize(['admin', 'teacher']),
  body('studentId')
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  body('type')
    .isIn(['illness', 'injury', 'allergy', 'medication', 'checkup', 'other'])
    .withMessage('Type must be illness, injury, allergy, medication, checkup, or other'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title is required and must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('dateRecorded')
    .isISO8601()
    .withMessage('Date recorded must be in valid ISO format'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Severity must be low, medium, high, or critical'),
  body('treatment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Treatment must be less than 1000 characters'),
  body('followUpRequired')
    .optional()
    .isBoolean()
    .withMessage('Follow up required must be a boolean'),
  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Follow up date must be in valid ISO format'),
  handleValidationErrors
], createHealthRecord);

/**
 * @route   PUT /api/health/records/:id
 * @desc    Update health record
 * @access  Private (Admin, Teacher)
 */
router.put('/records/:id', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  body('type')
    .optional()
    .isIn(['illness', 'injury', 'allergy', 'medication', 'checkup', 'other'])
    .withMessage('Type must be illness, injury, allergy, medication, checkup, or other'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('dateRecorded')
    .optional()
    .isISO8601()
    .withMessage('Date recorded must be in valid ISO format'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Severity must be low, medium, high, or critical'),
  body('treatment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Treatment must be less than 1000 characters'),
  body('followUpRequired')
    .optional()
    .isBoolean()
    .withMessage('Follow up required must be a boolean'),
  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Follow up date must be in valid ISO format'),
  body('status')
    .optional()
    .isIn(['active', 'resolved', 'ongoing'])
    .withMessage('Status must be active, resolved, or ongoing'),
  handleValidationErrors
], updateHealthRecord);

/**
 * @route   POST /api/health/vaccination
 * @desc    Record vaccination
 * @access  Private (Admin, Teacher)
 */
router.post('/vaccination', [
  authorize(['admin', 'teacher']),
  body('studentId')
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  body('vaccineName')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Vaccine name is required and must be less than 255 characters'),
  body('dateAdministered')
    .isISO8601()
    .withMessage('Date administered must be in valid ISO format'),
  body('doseNumber')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Dose number must be between 1 and 10'),
  body('administeredBy')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Administered by must be less than 255 characters'),
  body('batchNumber')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Batch number must be less than 100 characters'),
  body('nextDueDate')
    .optional()
    .isISO8601()
    .withMessage('Next due date must be in valid ISO format'),
  body('sideEffects')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Side effects must be less than 1000 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], recordVaccination);

/**
 * @route   GET /api/health/vaccinations/:studentId
 * @desc    Get student vaccinations
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/vaccinations/:studentId', [
  validationRules.uuid('studentId'),
  handleValidationErrors,
  checkResourceOwnership('studentId', 'student')
], getStudentVaccinations);

/**
 * @route   POST /api/health/nurse-visit
 * @desc    Record nurse visit
 * @access  Private (Admin, Teacher)
 */
router.post('/nurse-visit', [
  authorize(['admin', 'teacher']),
  body('studentId')
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  body('visitDate')
    .isISO8601()
    .withMessage('Visit date must be in valid ISO format'),
  body('reason')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Reason is required and must be less than 255 characters'),
  body('symptoms')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Symptoms must be less than 1000 characters'),
  body('treatment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Treatment must be less than 1000 characters'),
  body('medication')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Medication must be less than 500 characters'),
  body('temperature')
    .optional()
    .isFloat({ min: 30, max: 50 })
    .withMessage('Temperature must be between 30 and 50 degrees Celsius'),
  body('bloodPressure')
    .optional()
    .trim()
    .matches(/^\d{2,3}\/\d{2,3}$/)
    .withMessage('Blood pressure must be in format XXX/XXX'),
  body('pulse')
    .optional()
    .isInt({ min: 40, max: 200 })
    .withMessage('Pulse must be between 40 and 200 bpm'),
  body('weight')
    .optional()
    .isFloat({ min: 1, max: 200 })
    .withMessage('Weight must be between 1 and 200 kg'),
  body('height')
    .optional()
    .isFloat({ min: 30, max: 250 })
    .withMessage('Height must be between 30 and 250 cm'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must be less than 2000 characters'),
  body('parentNotified')
    .optional()
    .isBoolean()
    .withMessage('Parent notified must be a boolean'),
  body('sentHome')
    .optional()
    .isBoolean()
    .withMessage('Sent home must be a boolean'),
  handleValidationErrors
], recordNurseVisit);

/**
 * @route   GET /api/health/nurse-visits/:studentId
 * @desc    Get student nurse visits
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/nurse-visits/:studentId', [
  validationRules.uuid('studentId'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
  checkResourceOwnership('studentId', 'student')
], getStudentNurseVisits);

module.exports = router;
