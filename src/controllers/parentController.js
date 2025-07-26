const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get parent's children
 */
async function getParentChildren(req, res) {
  try {
    const { parentId } = req.params;

    if (!isValidUUID(parentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent ID format'
      });
    }

    // Check if user is the parent or admin
    if (req.user.user_type !== 'admin' && req.user.id !== parentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own children.'
      });
    }

    // Get children with their details
    const childrenQuery = `
      SELECT 
        s.id,
        s.student_id,
        s.first_name,
        s.last_name,
        s.date_of_birth,
        s.gender,
        s.admission_date,
        s.current_class_id,
        s.status,
        c.name as class_name,
        gl.name as grade_level_name,
        psr.relationship_type,
        psr.is_primary_contact,
        psr.is_emergency_contact,
        psr.can_pickup,
        psr.can_view_grades,
        psr.can_view_attendance,
        psr.can_receive_communications,
        psr.status as relationship_status
      FROM parent_student_relationships psr
      JOIN students s ON psr.student_id = s.id
      LEFT JOIN classes c ON s.current_class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      WHERE psr.parent_id = ? AND psr.status = 'active'
      ORDER BY s.first_name, s.last_name
    `;

    const children = await executeQuery(childrenQuery, [parentId]);

    res.json({
      success: true,
      message: 'Children retrieved successfully',
      data: {
        parent_id: parentId,
        children
      }
    });

    logger.info(`User ${req.user.id} retrieved children for parent ${parentId}`);

  } catch (error) {
    logger.error('Error retrieving parent children:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve children',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get child's attendance for parent
 */
async function getChildAttendance(req, res) {
  try {
    const { parentId, studentId } = req.params;
    const {
      start_date,
      end_date,
      page = 1,
      limit = 20
    } = req.query;

    if (!isValidUUID(parentId) || !isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent or student ID format'
      });
    }

    // Check if user is the parent or admin
    if (req.user.user_type !== 'admin' && req.user.id !== parentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own children\'s data.'
      });
    }

    // Verify parent-child relationship
    const relationshipQuery = `
      SELECT id, can_view_attendance 
      FROM parent_student_relationships 
      WHERE parent_id = ? AND student_id = ? AND status = 'active'
    `;
    
    const relationshipResult = await executeQuery(relationshipQuery, [parentId, studentId]);
    
    if (relationshipResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent-child relationship not found'
      });
    }

    if (!relationshipResult[0].can_view_attendance) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this child\'s attendance'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build date filter
    let dateFilter = '';
    let queryParams = [studentId];

    if (start_date && end_date) {
      dateFilter = 'AND a.attendance_date BETWEEN ? AND ?';
      queryParams.push(start_date, end_date);
    } else if (start_date) {
      dateFilter = 'AND a.attendance_date >= ?';
      queryParams.push(start_date);
    } else if (end_date) {
      dateFilter = 'AND a.attendance_date <= ?';
      queryParams.push(end_date);
    }

    // Get attendance records
    const attendanceQuery = `
      SELECT 
        a.id,
        a.attendance_date,
        a.status,
        a.check_in_time,
        a.check_out_time,
        a.late_minutes,
        a.notes,
        a.marked_by,
        s.name as subject_name,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name
      FROM attendance a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN teachers t ON a.marked_by = t.id
      WHERE a.student_id = ? ${dateFilter}
      ORDER BY a.attendance_date DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const attendance = await executeQuery(attendanceQuery, [...queryParams, parseInt(limit), offset]);

    // Get attendance summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_days,
        ROUND(
          (SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2
        ) as attendance_percentage
      FROM attendance 
      WHERE student_id = ? ${dateFilter}
    `;

    const summaryResult = await executeQuery(summaryQuery, queryParams);
    const summary = summaryResult[0];

    res.json({
      success: true,
      message: 'Child attendance retrieved successfully',
      data: {
        parent_id: parentId,
        student_id: studentId,
        attendance,
        summary,
        pagination: {
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit)
        }
      }
    });

    logger.info(`Parent ${parentId} viewed attendance for child ${studentId}`);

  } catch (error) {
    logger.error('Error retrieving child attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve child attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get child's grades for parent
 */
async function getChildGrades(req, res) {
  try {
    const { parentId, studentId } = req.params;
    const {
      academic_year_id,
      term_id,
      subject_id
    } = req.query;

    if (!isValidUUID(parentId) || !isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent or student ID format'
      });
    }

    // Check if user is the parent or admin
    if (req.user.user_type !== 'admin' && req.user.id !== parentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own children\'s data.'
      });
    }

    // Verify parent-child relationship
    const relationshipQuery = `
      SELECT id, can_view_grades 
      FROM parent_student_relationships 
      WHERE parent_id = ? AND student_id = ? AND status = 'active'
    `;
    
    const relationshipResult = await executeQuery(relationshipQuery, [parentId, studentId]);
    
    if (relationshipResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent-child relationship not found'
      });
    }

    if (!relationshipResult[0].can_view_grades) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this child\'s grades'
      });
    }

    // Build filters
    let whereConditions = ['r.student_id = ?'];
    let queryParams = [studentId];

    if (academic_year_id && isValidUUID(academic_year_id)) {
      whereConditions.push('r.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    if (term_id && isValidUUID(term_id)) {
      whereConditions.push('r.term_id = ?');
      queryParams.push(term_id);
    }

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('r.subject_id = ?');
      queryParams.push(subject_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get grades/results
    const gradesQuery = `
      SELECT 
        r.id,
        r.subject_id,
        r.assessment_type,
        r.marks_obtained,
        r.total_marks,
        r.percentage,
        r.grade,
        r.remarks,
        r.exam_date,
        r.academic_year_id,
        r.term_id,
        s.name as subject_name,
        s.code as subject_code,
        ay.name as academic_year_name,
        t.name as term_name
      FROM results r
      LEFT JOIN subjects s ON r.subject_id = s.id
      LEFT JOIN academic_years ay ON r.academic_year_id = ay.id
      LEFT JOIN terms t ON r.term_id = t.id
      WHERE ${whereClause}
      ORDER BY r.exam_date DESC, s.name
    `;

    const grades = await executeQuery(gradesQuery, queryParams);

    // Calculate overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_assessments,
        AVG(r.percentage) as average_percentage,
        MAX(r.percentage) as highest_percentage,
        MIN(r.percentage) as lowest_percentage,
        COUNT(DISTINCT r.subject_id) as subjects_count
      FROM results r
      WHERE ${whereClause}
    `;

    const statsResult = await executeQuery(statsQuery, queryParams);
    const stats = statsResult[0];

    // Get subject-wise performance
    const subjectStatsQuery = `
      SELECT 
        s.name as subject_name,
        s.code as subject_code,
        COUNT(r.id) as total_assessments,
        AVG(r.percentage) as average_percentage,
        MAX(r.percentage) as highest_percentage,
        MIN(r.percentage) as lowest_percentage
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      WHERE ${whereClause}
      GROUP BY r.subject_id, s.name, s.code
      ORDER BY s.name
    `;

    const subjectStats = await executeQuery(subjectStatsQuery, queryParams);

    res.json({
      success: true,
      message: 'Child grades retrieved successfully',
      data: {
        parent_id: parentId,
        student_id: studentId,
        grades,
        overall_stats: stats,
        subject_stats: subjectStats
      }
    });

    logger.info(`Parent ${parentId} viewed grades for child ${studentId}`);

  } catch (error) {
    logger.error('Error retrieving child grades:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve child grades',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get parent-teacher meetings
 */
async function getParentTeacherMeetings(req, res) {
  try {
    const { parentId } = req.params;
    const {
      status = '',
      page = 1,
      limit = 20
    } = req.query;

    if (!isValidUUID(parentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent ID format'
      });
    }

    // Check if user is the parent or admin
    if (req.user.user_type !== 'admin' && req.user.id !== parentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own meetings.'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = ['ptm.parent_id = ?'];
    let queryParams = [parentId];

    if (status) {
      whereConditions.push('ptm.status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get meetings
    const meetingsQuery = `
      SELECT 
        ptm.id,
        ptm.teacher_id,
        ptm.student_id,
        ptm.requested_date,
        ptm.requested_time,
        ptm.approved_date,
        ptm.approved_time,
        ptm.meeting_type,
        ptm.purpose,
        ptm.location,
        ptm.duration_minutes,
        ptm.status,
        ptm.teacher_notes,
        ptm.parent_feedback,
        ptm.meeting_notes,
        ptm.created_at,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        s.student_id as student_number
      FROM parent_teacher_meetings ptm
      JOIN teachers t ON ptm.teacher_id = t.id
      JOIN students s ON ptm.student_id = s.id
      WHERE ${whereClause}
      ORDER BY ptm.requested_date DESC, ptm.requested_time DESC
      LIMIT ? OFFSET ?
    `;

    const meetings = await executeQuery(meetingsQuery, [...queryParams, parseInt(limit), offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM parent_teacher_meetings ptm
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Parent-teacher meetings retrieved successfully',
      data: {
        parent_id: parentId,
        meetings,
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

    logger.info(`Parent ${parentId} retrieved meetings - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving parent-teacher meetings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve meetings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Request parent-teacher meeting
 */
async function requestParentTeacherMeeting(req, res) {
  try {
    const { parentId } = req.params;
    const {
      teacher_id,
      student_id,
      requested_date,
      requested_time,
      meeting_type = 'in_person',
      purpose,
      duration_minutes = 30
    } = sanitizeInput(req.body);

    if (!isValidUUID(parentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent ID format'
      });
    }

    // Validate required fields
    if (!teacher_id || !student_id || !requested_date || !requested_time || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Teacher, student, date, time, and purpose are required'
      });
    }

    // Check if user is the parent or admin
    if (req.user.user_type !== 'admin' && req.user.id !== parentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only request meetings for yourself.'
      });
    }

    // Verify parent-child relationship
    const relationshipQuery = `
      SELECT id
      FROM parent_student_relationships
      WHERE parent_id = ? AND student_id = ? AND status = 'active'
    `;

    const relationshipResult = await executeQuery(relationshipQuery, [parentId, student_id]);

    if (relationshipResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent-child relationship not found'
      });
    }

    // Verify teacher exists
    const teacherQuery = 'SELECT id, CONCAT(first_name, " ", last_name) as name FROM teachers WHERE id = ?';
    const teacherResult = await executeQuery(teacherQuery, [teacher_id]);

    if (teacherResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Check for existing pending meeting request
    const existingMeetingQuery = `
      SELECT id FROM parent_teacher_meetings
      WHERE parent_id = ? AND teacher_id = ? AND student_id = ?
        AND status IN ('requested', 'approved')
        AND requested_date >= CURDATE()
    `;

    const existingMeeting = await executeQuery(existingMeetingQuery, [parentId, teacher_id, student_id]);

    if (existingMeeting.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending or approved meeting request with this teacher for this student'
      });
    }

    // Create meeting request
    const insertQuery = `
      INSERT INTO parent_teacher_meetings (
        parent_id, teacher_id, student_id, requested_date, requested_time,
        meeting_type, purpose, duration_minutes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')
    `;

    const insertParams = [
      parentId, teacher_id, student_id, requested_date, requested_time,
      meeting_type, purpose, duration_minutes
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const meetingId = result.insertId;

    // Get the created meeting with details
    const createdMeeting = await executeQuery(`
      SELECT
        ptm.id,
        ptm.parent_id,
        ptm.teacher_id,
        ptm.student_id,
        ptm.requested_date,
        ptm.requested_time,
        ptm.meeting_type,
        ptm.purpose,
        ptm.duration_minutes,
        ptm.status,
        ptm.created_at,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        CONCAT(s.first_name, ' ', s.last_name) as student_name
      FROM parent_teacher_meetings ptm
      JOIN teachers t ON ptm.teacher_id = t.id
      JOIN students s ON ptm.student_id = s.id
      WHERE ptm.id = ?
    `, [meetingId]);

    res.status(201).json({
      success: true,
      message: 'Meeting request submitted successfully',
      data: createdMeeting[0]
    });

    logger.info(`Parent ${parentId} requested meeting with teacher ${teacher_id} for student ${student_id}`);

  } catch (error) {
    logger.error('Error requesting parent-teacher meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request meeting',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get parent communications/messages
 */
async function getParentCommunications(req, res) {
  try {
    const { parentId } = req.params;
    const {
      page = 1,
      limit = 20,
      message_type = '',
      unread_only = false
    } = req.query;

    if (!isValidUUID(parentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent ID format'
      });
    }

    // Check if user is the parent or admin
    if (req.user.user_type !== 'admin' && req.user.id !== parentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own communications.'
      });
    }

    // Verify parent has permission to receive communications
    const parentQuery = `
      SELECT COUNT(*) as count
      FROM parent_student_relationships
      WHERE parent_id = ? AND can_receive_communications = TRUE AND status = 'active'
    `;

    const parentResult = await executeQuery(parentQuery, [parentId]);

    if (parentResult[0].count === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to receive communications'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause for messages sent to this parent
    let whereConditions = [`(
      m.recipient_id = ? OR
      m.recipient_type = 'broadcast' OR
      (m.recipient_type = 'class' AND m.recipient_id IN (
        SELECT DISTINCT s.current_class_id
        FROM parent_student_relationships psr
        JOIN students s ON psr.student_id = s.id
        WHERE psr.parent_id = ? AND psr.status = 'active'
      ))
    )`];
    let queryParams = [parentId, parentId];

    if (message_type) {
      whereConditions.push('m.message_type = ?');
      queryParams.push(message_type);
    }

    if (unread_only === 'true') {
      whereConditions.push(`m.id NOT IN (
        SELECT message_id FROM message_read_status
        WHERE user_id = ? AND is_read = TRUE
      )`);
      queryParams.push(parentId);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get messages
    const messagesQuery = `
      SELECT
        m.id,
        m.subject,
        m.content,
        m.message_type,
        m.priority,
        m.sender_id,
        m.recipient_type,
        m.sent_at,
        m.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as sender_name,
        u.user_type as sender_type,
        CASE
          WHEN mrs.is_read = TRUE THEN TRUE
          ELSE FALSE
        END as is_read,
        mrs.read_at
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_read_status mrs ON m.id = mrs.message_id AND mrs.user_id = ?
      WHERE ${whereClause}
      ORDER BY m.sent_at DESC, m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const messages = await executeQuery(messagesQuery, [parentId, ...queryParams, parseInt(limit), offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get unread count
    const unreadCountQuery = `
      SELECT COUNT(*) as unread_count
      FROM messages m
      WHERE ${whereConditions[0]} AND m.id NOT IN (
        SELECT message_id FROM message_read_status
        WHERE user_id = ? AND is_read = TRUE
      )
    `;

    const unreadResult = await executeQuery(unreadCountQuery, [parentId, parentId, parentId]);
    const unreadCount = unreadResult[0].unread_count;

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Parent communications retrieved successfully',
      data: {
        parent_id: parentId,
        messages,
        unread_count: unreadCount,
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

    logger.info(`Parent ${parentId} retrieved communications - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving parent communications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve communications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getParentChildren,
  getChildAttendance,
  getChildGrades,
  getParentTeacherMeetings,
  requestParentTeacherMeeting,
  getParentCommunications
};
