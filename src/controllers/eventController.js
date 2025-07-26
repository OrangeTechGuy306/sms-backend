const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all events with pagination and filtering
 */
async function getEvents(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      type = '',
      status = '',
      date_from = '',
      date_to = '',
      sort_by = 'start_date',
      sort_order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (type) {
      whereConditions.push('e.type = ?');
      queryParams.push(type);
    }

    if (status) {
      whereConditions.push('e.status = ?');
      queryParams.push(status);
    }

    if (date_from) {
      whereConditions.push('e.start_date >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('e.start_date <= ?');
      queryParams.push(date_to);
    }

    // Validate sort parameters
    const allowedSortFields = ['title', 'start_date', 'end_date', 'type', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'start_date';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM events e
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get events
    const eventsQuery = `
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
        e.status,
        e.created_at,
        CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name,
        (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id) as attendee_count
      FROM events e
      LEFT JOIN users creator ON e.created_by = creator.id
      WHERE ${whereClause}
      ORDER BY e.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const events = await executeQuery(eventsQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        events,
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
    logger.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve events'
    });
  }
}

/**
 * Get event by ID
 */
async function getEventById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format'
      });
    }

    const eventQuery = `
      SELECT 
        e.*,
        CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name
      FROM events e
      LEFT JOIN users creator ON e.created_by = creator.id
      WHERE e.id = ?
    `;

    const events = await executeQuery(eventQuery, [id]);

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const event = events[0];

    // Get event attendees
    const attendeesQuery = `
      SELECT 
        ea.id as attendance_id,
        ea.status as attendance_status,
        ea.response_date,
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.user_type,
        u.email
      FROM event_attendees ea
      JOIN users u ON ea.user_id = u.id
      WHERE ea.event_id = ?
      ORDER BY u.first_name, u.last_name
    `;

    const attendees = await executeQuery(attendeesQuery, [id]);

    res.json({
      success: true,
      data: {
        event,
        attendees
      }
    });

  } catch (error) {
    logger.error('Get event by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve event'
    });
  }
}

/**
 * Create new event
 */
async function createEvent(req, res) {
  try {
    const eventData = sanitizeInput(req.body);
    
    const {
      title,
      description = '',
      type,
      startDate,
      endDate,
      startTime = null,
      endTime = null,
      location = '',
      isAllDay = false,
      attendeeIds = []
    } = eventData;

    // Validate required fields
    if (!title || !type || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, type, startDate'
      });
    }

    // Create event
    const insertQuery = `
      INSERT INTO events (title, description, type, start_date, end_date, start_time, end_time, location, is_all_day, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `;

    const result = await executeQuery(insertQuery, [
      title, description, type, startDate, endDate || startDate, startTime, endTime, location, isAllDay, req.user.id
    ]);

    const eventId = result.insertId;

    // Add attendees if provided
    if (attendeeIds.length > 0) {
      const attendeeQueries = attendeeIds.map(userId => ({
        query: 'INSERT INTO event_attendees (event_id, user_id, status) VALUES (?, ?, "invited")',
        params: [eventId, userId]
      }));

      await executeTransaction(attendeeQueries);
    }

    logger.info(`Event created: ${title} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        eventId
      }
    });

  } catch (error) {
    logger.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event'
    });
  }
}

/**
 * Update event
 */
async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format'
      });
    }

    // Check if event exists
    const existingEvent = await executeQuery('SELECT id FROM events WHERE id = ?', [id]);
    if (existingEvent.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.created_by;
    delete updates.created_at;
    delete updates.updated_at;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Build update query
    const allowedFields = [
      'title', 'description', 'type', 'start_date', 'end_date', 
      'start_time', 'end_time', 'location', 'is_all_day', 'status'
    ];

    const updateFields = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map(key => `${key} = ?`);

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updateQuery = `
      UPDATE events 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const queryParams = [
      ...Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .map(key => updates[key]),
      id
    ];

    await executeQuery(updateQuery, queryParams);

    logger.info(`Event updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Event updated successfully'
    });

  } catch (error) {
    logger.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event'
    });
  }
}

/**
 * Delete event
 */
async function deleteEvent(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format'
      });
    }

    // Check if event exists
    const existingEvent = await executeQuery('SELECT title FROM events WHERE id = ?', [id]);
    if (existingEvent.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const { title } = existingEvent[0];

    // Delete event and attendees in transaction
    const queries = [
      { query: 'DELETE FROM event_attendees WHERE event_id = ?', params: [id] },
      { query: 'DELETE FROM events WHERE id = ?', params: [id] }
    ];

    await executeTransaction(queries);

    logger.info(`Event deleted: ${title} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    logger.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event'
    });
  }
}

/**
 * Respond to event invitation
 */
async function respondToEvent(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format'
      });
    }

    // Check if user is invited to the event
    const attendeeExists = await executeQuery(
      'SELECT id FROM event_attendees WHERE event_id = ? AND user_id = ?',
      [id, userId]
    );

    if (attendeeExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event invitation not found'
      });
    }

    // Update attendance status
    await executeQuery(
      'UPDATE event_attendees SET status = ?, response_date = CURRENT_TIMESTAMP WHERE event_id = ? AND user_id = ?',
      [status, id, userId]
    );

    logger.info(`User ${userId} responded to event ${id} with status: ${status}`);

    res.json({
      success: true,
      message: 'Event response recorded successfully'
    });

  } catch (error) {
    logger.error('Respond to event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to event'
    });
  }
}

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  respondToEvent
};
