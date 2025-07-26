const express = require('express');
const { body, query } = require('express-validator');
const {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  respondToEvent
} = require('../controllers/eventController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/events
 * @desc    Get all events with pagination and filtering
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
  query('type')
    .optional()
    .isIn(['academic', 'sports', 'cultural', 'meeting', 'holiday', 'exam', 'other'])
    .withMessage('Invalid event type'),
  query('status')
    .optional()
    .isIn(['active', 'cancelled', 'completed'])
    .withMessage('Status must be active, cancelled, or completed'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be in valid ISO format'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be in valid ISO format'),
  query('sort_by')
    .optional()
    .isIn(['title', 'start_date', 'end_date', 'type', 'created_at'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getEvents);

/**
 * @route   POST /api/events
 * @desc    Create new event
 * @access  Private (Admin, Teacher)
 */
router.post('/', [
  authorize(['admin', 'teacher']),
  validationRules.eventTitle(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('type')
    .isIn(['academic', 'sports', 'cultural', 'meeting', 'holiday', 'exam', 'other'])
    .withMessage('Event type is required and must be valid'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date is required and must be in valid ISO format'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in valid ISO format'),
  body('startTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('endTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must be less than 255 characters'),
  body('isAllDay')
    .optional()
    .isBoolean()
    .withMessage('Is all day must be a boolean'),
  body('attendeeIds')
    .optional()
    .isArray()
    .withMessage('Attendee IDs must be an array'),
  body('attendeeIds.*')
    .optional()
    .isUUID()
    .withMessage('Each attendee ID must be a valid UUID'),
  handleValidationErrors
], createEvent);

/**
 * @route   GET /api/events/:id
 * @desc    Get event by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], getEventById);

/**
 * @route   PUT /api/events/:id
 * @desc    Update event
 * @access  Private (Admin, Teacher)
 */
router.put('/:id', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
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
  body('type')
    .optional()
    .isIn(['academic', 'sports', 'cultural', 'meeting', 'holiday', 'exam', 'other'])
    .withMessage('Event type must be valid'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in valid ISO format'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in valid ISO format'),
  body('startTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('endTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must be less than 255 characters'),
  body('isAllDay')
    .optional()
    .isBoolean()
    .withMessage('Is all day must be a boolean'),
  body('status')
    .optional()
    .isIn(['active', 'cancelled', 'completed'])
    .withMessage('Status must be active, cancelled, or completed'),
  handleValidationErrors
], updateEvent);

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete event
 * @access  Private (Admin only)
 */
router.delete('/:id', [
  authorize(['admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], deleteEvent);

/**
 * @route   POST /api/events/:id/respond
 * @desc    Respond to event invitation
 * @access  Private (All authenticated users)
 */
router.post('/:id/respond', [
  validationRules.uuid('id'),
  body('status')
    .isIn(['attending', 'not_attending', 'maybe'])
    .withMessage('Status must be attending, not_attending, or maybe'),
  handleValidationErrors
], respondToEvent);

/**
 * @route   GET /api/events/calendar/:year/:month
 * @desc    Get calendar events for a specific month
 * @access  Private (All authenticated users)
 */
router.get('/calendar/:year/:month', [
  query('year')
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Year must be between 2020 and 2030'),
  query('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { year, month } = req.params;

    // Calculate first and last day of the month
    const firstDay = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayFormatted = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    const calendarQuery = `
      SELECT
        e.id,
        e.title,
        e.type,
        e.start_date,
        e.end_date,
        e.start_time,
        e.end_time,
        e.location,
        e.is_all_day,
        e.status,
        (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id) as attendee_count
      FROM events e
      WHERE e.status = 'active'
        AND ((e.start_date BETWEEN ? AND ?) OR (e.end_date BETWEEN ? AND ?))
      ORDER BY e.start_date ASC, e.start_time ASC
    `;

    const events = await executeQuery(calendarQuery, [firstDay, lastDayFormatted, firstDay, lastDayFormatted]);

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        month: parseInt(month),
        events
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get calendar events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve calendar events'
    });
  }
});

/**
 * @route   GET /api/events/my-events
 * @desc    Get events for current user
 * @access  Private (All authenticated users)
 */
router.get('/my-events', [
  query('status')
    .optional()
    .isIn(['invited', 'attending', 'not_attending', 'maybe'])
    .withMessage('Status must be invited, attending, not_attending, or maybe'),
  query('upcoming')
    .optional()
    .isBoolean()
    .withMessage('Upcoming must be a boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { status, upcoming } = req.query;
    const userId = req.user.id;

    let whereConditions = ['ea.user_id = ?'];
    let queryParams = [userId];

    if (status) {
      whereConditions.push('ea.status = ?');
      queryParams.push(status);
    }

    if (upcoming === 'true') {
      whereConditions.push('e.start_date >= CURDATE()');
    }

    const whereClause = whereConditions.join(' AND ');

    const myEventsQuery = `
      SELECT
        e.id,
        e.title,
        e.description,
        e.type,
        e.start_date,
        e.end_date,
        e.start_time,
        e.end_time,
        e.location,
        e.is_all_day,
        e.status as event_status,
        ea.status as my_status,
        ea.response_date
      FROM event_attendees ea
      JOIN events e ON ea.event_id = e.id
      WHERE ${whereClause} AND e.status = 'active'
      ORDER BY e.start_date ASC, e.start_time ASC
    `;

    const events = await executeQuery(myEventsQuery, queryParams);

    res.json({
      success: true,
      data: events
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get my events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user events'
    });
  }
});

/**
 * @route   POST /api/events/:id/attendees
 * @desc    Add attendees to event
 * @access  Private (Admin, Teacher)
 */
router.post('/:id/attendees', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('User IDs must be a non-empty array'),
  body('userIds.*')
    .isUUID()
    .withMessage('Each user ID must be a valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeTransaction } = require('../config/database');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');

    const { id } = req.params;
    const { userIds } = sanitizeInput(req.body);

    // Prepare bulk insert queries
    const queries = userIds.map(userId => ({
      query: `
        INSERT INTO event_attendees (event_id, user_id, status)
        VALUES (?, ?, 'invited')
        ON DUPLICATE KEY UPDATE status = 'invited'
      `,
      params: [id, userId]
    }));

    await executeTransaction(queries);

    logger.info(`Attendees added to event ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: `${userIds.length} attendees added to event successfully`
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Add event attendees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add attendees to event'
    });
  }
});

/**
 * @route   GET /api/events/statistics
 * @desc    Get event statistics
 * @access  Private (Admin, Teacher)
 */
router.get('/statistics', [
  authorize(['admin', 'teacher']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');

    // Get total events
    const [totalEvents] = await executeQuery('SELECT COUNT(*) as count FROM events WHERE status = "active"');

    // Get upcoming events (next 30 days)
    const [upcomingEvents] = await executeQuery(`
      SELECT COUNT(*) as count
      FROM events
      WHERE status = 'active'
        AND start_date >= CURDATE()
        AND start_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `);

    // Get total participants
    const [totalParticipants] = await executeQuery(`
      SELECT COUNT(DISTINCT ea.user_id) as count
      FROM event_attendees ea
      JOIN events e ON ea.event_id = e.id
      WHERE e.status = 'active'
    `);

    // Get event types count
    const [eventTypes] = await executeQuery(`
      SELECT COUNT(DISTINCT type) as count
      FROM events
      WHERE status = 'active'
    `);

    const statistics = {
      total_events: totalEvents.count || 0,
      upcoming_events: upcomingEvents.count || 0,
      total_participants: totalParticipants.count || 0,
      event_types: eventTypes.count || 0
    };

    res.json({
      success: true,
      message: 'Event statistics retrieved successfully',
      data: statistics
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get event statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve event statistics'
    });
  }
});

module.exports = router;
