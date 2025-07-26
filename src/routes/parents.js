const express = require('express');
const { body, query } = require('express-validator');
const { 
  getParentChildren,
  getChildAttendance,
  getChildGrades,
  getParentTeacherMeetings,
  requestParentTeacherMeeting,
  getParentCommunications
} = require('../controllers/parentController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

/**
 * @route   GET /api/parents/:parentId/children
 * @desc    Get parent's children
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/children', [
  authenticate,
  validationRules.uuid('parentId'),
  handleValidationErrors
], getParentChildren);

/**
 * @route   GET /api/parents/:parentId/children/:studentId/attendance
 * @desc    Get child's attendance for parent
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/children/:studentId/attendance', [
  authenticate,
  validationRules.uuid('parentId'),
  validationRules.uuid('studentId'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], getChildAttendance);

/**
 * @route   GET /api/parents/:parentId/children/:studentId/grades
 * @desc    Get child's grades for parent
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/children/:studentId/grades', [
  authenticate,
  validationRules.uuid('parentId'),
  validationRules.uuid('studentId'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  query('term_id')
    .optional()
    .isUUID()
    .withMessage('Term ID must be a valid UUID'),
  query('subject_id')
    .optional()
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  handleValidationErrors
], getChildGrades);

/**
 * @route   GET /api/parents/:parentId/meetings
 * @desc    Get parent-teacher meetings
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/meetings', [
  authenticate,
  validationRules.uuid('parentId'),
  query('status')
    .optional()
    .isIn(['requested', 'approved', 'rejected', 'completed', 'cancelled'])
    .withMessage('Status must be requested, approved, rejected, completed, or cancelled'),
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], getParentTeacherMeetings);

/**
 * @route   POST /api/parents/:parentId/meetings
 * @desc    Request parent-teacher meeting
 * @access  Private (Parents and Admins only)
 */
router.post('/:parentId/meetings', [
  authenticate,
  validationRules.uuid('parentId'),
  body('teacher_id')
    .isUUID()
    .withMessage('Valid teacher ID is required'),
  body('student_id')
    .isUUID()
    .withMessage('Valid student ID is required'),
  body('requested_date')
    .isISO8601()
    .withMessage('Valid requested date is required')
    .custom((value) => {
      const requestedDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (requestedDate < today) {
        throw new Error('Requested date cannot be in the past');
      }
      return true;
    }),
  body('requested_time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Requested time must be in HH:MM format'),
  body('meeting_type')
    .optional()
    .isIn(['in_person', 'video_call', 'phone_call'])
    .withMessage('Meeting type must be in_person, video_call, or phone_call'),
  body('purpose')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Purpose is required and must be between 10 and 1000 characters'),
  body('duration_minutes')
    .optional()
    .isInt({ min: 15, max: 120 })
    .withMessage('Duration must be between 15 and 120 minutes'),
  handleValidationErrors
], requestParentTeacherMeeting);

/**
 * @route   GET /api/parents/:parentId/communications
 * @desc    Get parent communications/messages
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/communications', [
  authenticate,
  validationRules.uuid('parentId'),
  query('message_type')
    .optional()
    .isIn(['announcement', 'alert', 'reminder', 'newsletter', 'personal'])
    .withMessage('Message type must be announcement, alert, reminder, newsletter, or personal'),
  query('unread_only')
    .optional()
    .isBoolean()
    .withMessage('Unread only must be a boolean value'),
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], getParentCommunications);

/**
 * @route   GET /api/parents/:parentId/dashboard
 * @desc    Get parent dashboard summary
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/dashboard', [
  authenticate,
  validationRules.uuid('parentId'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { parentId } = req.params;

    // Check if user is the parent or admin
    if (req.user.user_type !== 'admin' && req.user.id !== parentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own dashboard.'
      });
    }

    // TODO: Implement comprehensive parent dashboard
    res.json({
      success: true,
      message: 'Parent dashboard - to be implemented',
      data: {
        parent_id: parentId,
        children_count: 0,
        unread_messages: 0,
        upcoming_meetings: 0,
        recent_attendance: [],
        recent_grades: [],
        upcoming_events: []
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/parents/:parentId/children/:studentId/timetable
 * @desc    Get child's timetable for parent
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/children/:studentId/timetable', [
  authenticate,
  validationRules.uuid('parentId'),
  validationRules.uuid('studentId'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement child timetable for parents
  res.json({
    success: true,
    message: 'Child timetable for parents - to be implemented',
    data: {
      parent_id: req.params.parentId,
      student_id: req.params.studentId,
      timetable: null
    }
  });
});

/**
 * @route   GET /api/parents/:parentId/children/:studentId/fees
 * @desc    Get child's fee information for parent
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/children/:studentId/fees', [
  authenticate,
  validationRules.uuid('parentId'),
  validationRules.uuid('studentId'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement child fee information for parents
  res.json({
    success: true,
    message: 'Child fee information for parents - to be implemented',
    data: {
      parent_id: req.params.parentId,
      student_id: req.params.studentId,
      fees: {
        total_amount: 0,
        paid_amount: 0,
        outstanding_amount: 0,
        payment_history: []
      }
    }
  });
});

/**
 * @route   GET /api/parents/:parentId/children/:studentId/transportation
 * @desc    Get child's transportation information for parent
 * @access  Private (Parents and Admins only)
 */
router.get('/:parentId/children/:studentId/transportation', [
  authenticate,
  validationRules.uuid('parentId'),
  validationRules.uuid('studentId'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement child transportation information for parents
  res.json({
    success: true,
    message: 'Child transportation information for parents - to be implemented',
    data: {
      parent_id: req.params.parentId,
      student_id: req.params.studentId,
      transportation: {
        route: null,
        pickup_stop: null,
        dropoff_stop: null,
        bus_number: null,
        driver_contact: null
      }
    }
  });
});

/**
 * @route   POST /api/parents/:parentId/communications/:messageId/read
 * @desc    Mark message as read
 * @access  Private (Parents and Admins only)
 */
router.post('/:parentId/communications/:messageId/read', [
  authenticate,
  validationRules.uuid('parentId'),
  validationRules.uuid('messageId'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement mark message as read functionality
  res.json({
    success: true,
    message: 'Message marked as read - to be implemented',
    data: {
      parent_id: req.params.parentId,
      message_id: req.params.messageId,
      read_at: new Date().toISOString()
    }
  });
});

module.exports = router;
