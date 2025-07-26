const express = require('express');
const { body, query } = require('express-validator');
const {
  getMessages,
  getMessageById,
  sendMessage,
  broadcastMessage,
  markMessage,
  deleteMessage,
  getMessageStats
} = require('../controllers/messageController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/messages
 * @desc    Get messages for a user
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
  query('type')
    .optional()
    .isIn(['sent', 'received'])
    .withMessage('Type must be sent or received'),
  query('is_read')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Is read must be true or false'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sort_by')
    .optional()
    .isIn(['created_at', 'subject', 'is_read'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getMessages);

/**
 * @route   POST /api/messages
 * @desc    Send message
 * @access  Private (All authenticated users)
 */
router.post('/', [
  body('recipientId')
    .isUUID()
    .withMessage('Recipient ID must be a valid UUID'),
  validationRules.messageSubject(),
  validationRules.messageContent(),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),
  handleValidationErrors
], sendMessage);

/**
 * @route   GET /api/messages/stats
 * @desc    Get message statistics
 * @access  Private (All authenticated users)
 */
router.get('/stats', getMessageStats);

/**
 * @route   POST /api/messages/broadcast
 * @desc    Broadcast message to multiple recipients
 * @access  Private (Admin, Teacher)
 */
router.post('/broadcast', [
  authorize(['admin', 'teacher']),
  body('recipientIds')
    .isArray({ min: 1 })
    .withMessage('Recipient IDs must be a non-empty array'),
  body('recipientIds.*')
    .isUUID()
    .withMessage('Each recipient ID must be a valid UUID'),
  validationRules.messageSubject(),
  validationRules.messageContent(),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),
  handleValidationErrors
], broadcastMessage);

/**
 * @route   GET /api/messages/:id
 * @desc    Get message by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], getMessageById);

/**
 * @route   PUT /api/messages/:id/mark
 * @desc    Mark message as read/unread
 * @access  Private (All authenticated users)
 */
router.put('/:id/mark', [
  validationRules.uuid('id'),
  body('isRead')
    .isBoolean()
    .withMessage('Is read must be a boolean'),
  handleValidationErrors
], markMessage);

/**
 * @route   PUT /api/messages/:id/read
 * @desc    Mark message as read (alias for frontend compatibility)
 * @access  Private (All authenticated users)
 */
router.put('/:id/read', [
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  // This is an alias endpoint that automatically marks message as read
  req.body = { isRead: true };
  return markMessage(req, res);
});

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete message
 * @access  Private (All authenticated users)
 */
router.delete('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], deleteMessage);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get conversation list
 * @access  Private (All authenticated users)
 */
router.get('/conversations', async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const userId = req.user.id;

    const conversationsQuery = `
      SELECT
        CASE
          WHEN m.sender_id = ? THEN m.recipient_id
          ELSE m.sender_id
        END as other_user_id,
        CASE
          WHEN m.sender_id = ? THEN CONCAT(recipient.first_name, ' ', recipient.last_name)
          ELSE CONCAT(sender.first_name, ' ', sender.last_name)
        END as other_user_name,
        CASE
          WHEN m.sender_id = ? THEN recipient.user_type
          ELSE sender.user_type
        END as other_user_type,
        MAX(m.created_at) as last_message_time,
        COUNT(*) as message_count,
        SUM(CASE WHEN m.recipient_id = ? AND m.is_read = FALSE THEN 1 ELSE 0 END) as unread_count,
        (SELECT subject FROM messages
         WHERE (sender_id = ? AND recipient_id = other_user_id) OR (sender_id = other_user_id AND recipient_id = ?)
         ORDER BY created_at DESC LIMIT 1) as last_subject
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.sender_id = ? OR m.recipient_id = ?
      GROUP BY other_user_id
      ORDER BY last_message_time DESC
    `;

    const conversations = await executeQuery(conversationsQuery, [
      userId, userId, userId, userId, userId, userId, userId, userId
    ]);

    res.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversations'
    });
  }
});

/**
 * @route   GET /api/messages/conversation/:userId
 * @desc    Get conversation with specific user
 * @access  Private (All authenticated users)
 */
router.get('/conversation/:userId', [
  validationRules.uuid('userId'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { userId: otherUserId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const currentUserId = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conversationQuery = `
      SELECT
        m.id,
        m.subject,
        m.message,
        m.is_read,
        m.priority,
        m.created_at,
        m.sender_id,
        m.recipient_id,
        CONCAT(sender.first_name, ' ', sender.last_name) as sender_name,
        sender.user_type as sender_type
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const messages = await executeQuery(conversationQuery, [
      currentUserId, otherUserId, otherUserId, currentUserId, parseInt(limit), offset
    ]);

    // Mark messages as read if current user is recipient
    if (messages.length > 0) {
      const unreadMessageIds = messages
        .filter(msg => msg.recipient_id === currentUserId && !msg.is_read)
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        const placeholders = unreadMessageIds.map(() => '?').join(',');
        await executeQuery(
          `UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
          unreadMessageIds
        );
      }
    }

    res.json({
      success: true,
      data: messages.reverse() // Reverse to show oldest first
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation'
    });
  }
});

/**
 * @route   POST /api/messages/class-broadcast
 * @desc    Broadcast message to all students in a class
 * @access  Private (Admin, Teacher)
 */
router.post('/class-broadcast', [
  authorize(['admin', 'teacher']),
  body('classId')
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  validationRules.messageSubject(),
  validationRules.messageContent(),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),
  body('includeParents')
    .optional()
    .isBoolean()
    .withMessage('Include parents must be a boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery, executeTransaction } = require('../config/database');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');

    const { classId, subject, message, priority = 'normal', includeParents = false } = sanitizeInput(req.body);

    // Get students in the class
    const studentsQuery = `
      SELECT u.id as user_id
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.current_class_id = ? AND s.status = 'active' AND u.status = 'active'
    `;

    const students = await executeQuery(studentsQuery, [classId]);

    let recipients = students;

    // Include parents if requested
    if (includeParents) {
      const parentsQuery = `
        SELECT DISTINCT pu.id as user_id
        FROM students s
        JOIN student_parents sp ON s.id = sp.student_id
        JOIN parents p ON sp.parent_id = p.id
        JOIN users pu ON p.user_id = pu.id
        WHERE s.current_class_id = ? AND s.status = 'active' AND pu.status = 'active'
      `;

      const parents = await executeQuery(parentsQuery, [classId]);
      recipients = [...students, ...parents];
    }

    if (recipients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No recipients found for this class'
      });
    }

    // Prepare bulk insert queries
    const queries = recipients.map(recipient => ({
      query: `INSERT INTO messages (sender_id, recipient_id, subject, message, priority) VALUES (?, ?, ?, ?, ?)`,
      params: [req.user.id, recipient.user_id, subject, message, priority]
    }));

    await executeTransaction(queries);

    logger.info(`Class broadcast sent from user ${req.user.id} to class ${classId} (${recipients.length} recipients)`);

    res.json({
      success: true,
      message: `Message broadcast to ${recipients.length} recipients successfully`
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Class broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to broadcast message to class'
    });
  }
});

module.exports = router;
