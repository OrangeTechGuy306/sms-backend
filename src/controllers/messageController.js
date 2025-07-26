const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get messages for a user
 */
async function getMessages(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      type = 'received',
      is_read = '',
      search = '',
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user.id;
    const searchTerm = `%${search}%`;

    // Build WHERE clause based on message type
    let whereConditions = [];
    let queryParams = [];

    if (type === 'sent') {
      whereConditions.push('m.sender_id = ?');
      queryParams.push(userId);
    } else {
      whereConditions.push('m.recipient_id = ?');
      queryParams.push(userId);
    }

    if (search) {
      whereConditions.push('(m.subject LIKE ? OR m.message LIKE ?)');
      queryParams.push(searchTerm, searchTerm);
    }

    if (is_read !== '') {
      whereConditions.push('m.is_read = ?');
      queryParams.push(is_read === 'true');
    }

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'subject', 'is_read'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get messages
    const messagesQuery = `
      SELECT 
        m.id,
        m.subject,
        m.message,
        m.is_read,
        m.priority,
        m.created_at,
        CONCAT(sender.first_name, ' ', sender.last_name) as sender_name,
        sender.user_type as sender_type,
        CONCAT(recipient.first_name, ' ', recipient.last_name) as recipient_name,
        recipient.user_type as recipient_type
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE ${whereClause}
      ORDER BY m.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const messages = await executeQuery(messagesQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages'
    });
  }
}

/**
 * Get message by ID
 */
async function getMessageById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    const messageQuery = `
      SELECT 
        m.*,
        CONCAT(sender.first_name, ' ', sender.last_name) as sender_name,
        sender.email as sender_email,
        sender.user_type as sender_type,
        CONCAT(recipient.first_name, ' ', recipient.last_name) as recipient_name,
        recipient.email as recipient_email,
        recipient.user_type as recipient_type
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.id = ? AND (m.sender_id = ? OR m.recipient_id = ?)
    `;

    const messages = await executeQuery(messageQuery, [id, userId, userId]);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or access denied'
      });
    }

    const message = messages[0];

    // Mark as read if user is the recipient
    if (message.recipient_id === userId && !message.is_read) {
      await executeQuery(
        'UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      message.is_read = true;
    }

    res.json({
      success: true,
      data: message
    });

  } catch (error) {
    logger.error('Get message by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve message'
    });
  }
}

/**
 * Send message
 */
async function sendMessage(req, res) {
  try {
    const messageData = sanitizeInput(req.body);
    
    const {
      recipientId,
      subject,
      message,
      priority = 'normal'
    } = messageData;

    // Validate required fields
    if (!recipientId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: recipientId, subject, message'
      });
    }

    // Check if recipient exists
    const recipientExists = await executeQuery('SELECT id FROM users WHERE id = ? AND status = "active"', [recipientId]);
    if (recipientExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found or inactive'
      });
    }

    // Create message
    const insertQuery = `
      INSERT INTO messages (sender_id, recipient_id, subject, message, priority)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(insertQuery, [req.user.id, recipientId, subject, message, priority]);

    logger.info(`Message sent from user ${req.user.id} to user ${recipientId}`);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
}

/**
 * Broadcast message to multiple recipients
 */
async function broadcastMessage(req, res) {
  try {
    const messageData = sanitizeInput(req.body);
    
    const {
      recipientIds,
      subject,
      message,
      priority = 'normal'
    } = messageData;

    // Validate required fields
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0 || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: recipientIds (array), subject, message'
      });
    }

    // Prepare bulk insert queries
    const queries = recipientIds.map(recipientId => ({
      query: `INSERT INTO messages (sender_id, recipient_id, subject, message, priority) VALUES (?, ?, ?, ?, ?)`,
      params: [req.user.id, recipientId, subject, message, priority]
    }));

    await executeTransaction(queries);

    logger.info(`Broadcast message sent from user ${req.user.id} to ${recipientIds.length} recipients`);

    res.status(201).json({
      success: true,
      message: `Message broadcast to ${recipientIds.length} recipients successfully`
    });

  } catch (error) {
    logger.error('Broadcast message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to broadcast message'
    });
  }
}

/**
 * Mark message as read/unread
 */
async function markMessage(req, res) {
  try {
    const { id } = req.params;
    const { isRead } = req.body;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    // Check if message exists and user is the recipient
    const messageExists = await executeQuery(
      'SELECT id FROM messages WHERE id = ? AND recipient_id = ?',
      [id, userId]
    );

    if (messageExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or access denied'
      });
    }

    // Update read status
    const updateQuery = isRead 
      ? 'UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE messages SET is_read = FALSE, read_at = NULL WHERE id = ?';

    await executeQuery(updateQuery, [id]);

    logger.info(`Message ${id} marked as ${isRead ? 'read' : 'unread'} by user ${userId}`);

    res.json({
      success: true,
      message: `Message marked as ${isRead ? 'read' : 'unread'} successfully`
    });

  } catch (error) {
    logger.error('Mark message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update message status'
    });
  }
}

/**
 * Delete message
 */
async function deleteMessage(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    // Check if message exists and user has permission to delete
    const messageExists = await executeQuery(
      'SELECT id FROM messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)',
      [id, userId, userId]
    );

    if (messageExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or access denied'
      });
    }

    // Delete message
    await executeQuery('DELETE FROM messages WHERE id = ?', [id]);

    logger.info(`Message ${id} deleted by user ${userId}`);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
}

/**
 * Get message statistics
 */
async function getMessageStats(req, res) {
  try {
    const userId = req.user.id;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_received,
        SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread_count,
        SUM(CASE WHEN priority = 'high' AND is_read = FALSE THEN 1 ELSE 0 END) as urgent_unread,
        (SELECT COUNT(*) FROM messages WHERE sender_id = ?) as total_sent
      FROM messages 
      WHERE recipient_id = ?
    `;

    const stats = await executeQuery(statsQuery, [userId, userId]);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    logger.error('Get message stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve message statistics'
    });
  }
}

module.exports = {
  getMessages,
  getMessageById,
  sendMessage,
  broadcastMessage,
  markMessage,
  deleteMessage,
  getMessageStats
};
