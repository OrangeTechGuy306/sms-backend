const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get attendance records with pagination and filtering
 */
async function getAttendance(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      student_id = '',
      class_id = '',
      date = '',
      status = '',
      date_from = '',
      date_to = '',
      sort_by = 'date',
      sort_order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (student_id && isValidUUID(student_id)) {
      whereConditions.push('a.student_id = ?');
      queryParams.push(student_id);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('a.class_id = ?');
      queryParams.push(class_id);
    }

    if (date) {
      whereConditions.push('a.date = ?');
      queryParams.push(date);
    }

    if (date_from) {
      whereConditions.push('a.date >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('a.date <= ?');
      queryParams.push(date_to);
    }

    if (status) {
      whereConditions.push('a.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['date', 'student_name', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'date';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get attendance records
    const attendanceQuery = `
      SELECT 
        a.id,
        a.date,
        a.status,
        a.time_in,
        a.time_out,
        a.remarks,
        a.created_at,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        s.student_id,
        c.name as class_name,
        CONCAT(marker.first_name, ' ', marker.last_name) as marked_by_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON a.class_id = c.id
      LEFT JOIN users u ON a.marked_by = u.id
      LEFT JOIN teachers marker ON u.id = marker.user_id
      WHERE ${whereClause}
      ORDER BY 
        ${sortField === 'student_name' ? 's.first_name' : 
          sortField === 'date' ? 'a.date' : 
          `a.${sortField}`} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const attendance = await executeQuery(attendanceQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        attendance,
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
    logger.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance records'
    });
  }
}

/**
 * Mark attendance
 */
async function markAttendance(req, res) {
  try {
    const attendanceData = sanitizeInput(req.body);
    
    const {
      studentId,
      classId,
      date,
      status,
      timeIn = null,
      timeOut = null,
      remarks = ''
    } = attendanceData;

    // Validate required fields
    if (!studentId || !classId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, classId, date, status'
      });
    }

    // Check if attendance already exists for this student and date
    const existingAttendance = await executeQuery(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ?',
      [studentId, date]
    );

    if (existingAttendance.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this student on this date'
      });
    }

    // Create attendance record
    const insertQuery = `
      INSERT INTO attendance (student_id, class_id, date, status, time_in, time_out, remarks, marked_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(insertQuery, [
      studentId, classId, date, status, timeIn, timeOut, remarks, req.user.id
    ]);

    logger.info(`Attendance marked for student ${studentId} on ${date} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        attendanceId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance'
    });
  }
}

/**
 * Update attendance
 */
async function updateAttendance(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance ID format'
      });
    }

    // Check if attendance exists
    const existingAttendance = await executeQuery('SELECT id FROM attendance WHERE id = ?', [id]);
    if (existingAttendance.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.student_id;
    delete updates.class_id;
    delete updates.date;
    delete updates.marked_by;
    delete updates.created_at;
    delete updates.updated_at;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Build update query
    const allowedFields = ['status', 'time_in', 'time_out', 'remarks'];

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
      UPDATE attendance 
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

    logger.info(`Attendance updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Attendance updated successfully'
    });

  } catch (error) {
    logger.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update attendance'
    });
  }
}

/**
 * Get student attendance history
 */
async function getStudentAttendance(req, res) {
  try {
    const { studentId } = req.params;
    const { date_from, date_to, limit = 50 } = req.query;

    if (!isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    let whereConditions = ['a.student_id = ?'];
    let queryParams = [studentId];

    if (date_from) {
      whereConditions.push('a.date >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('a.date <= ?');
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get attendance records
    const attendanceQuery = `
      SELECT 
        a.id,
        a.date,
        a.status,
        a.time_in,
        a.time_out,
        a.remarks,
        c.name as class_name
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
      ORDER BY a.date DESC
      LIMIT ?
    `;

    const attendance = await executeQuery(attendanceQuery, [...queryParams, parseInt(limit)]);

    // Get attendance statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_days,
        ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_percentage
      FROM attendance a
      WHERE ${whereClause}
    `;

    const stats = await executeQuery(statsQuery, queryParams);

    res.json({
      success: true,
      data: {
        attendance,
        statistics: stats[0]
      }
    });

  } catch (error) {
    logger.error('Get student attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student attendance'
    });
  }
}

/**
 * Get class attendance for a specific date
 */
async function getClassAttendance(req, res) {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    if (!isValidUUID(classId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID format'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    // Get all students in the class with their attendance for the date
    const attendanceQuery = `
      SELECT 
        s.id as student_id,
        s.student_id as student_number,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        a.id as attendance_id,
        a.status,
        a.time_in,
        a.time_out,
        a.remarks
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
      WHERE s.current_class_id = ? AND s.status = 'active'
      ORDER BY s.first_name, s.last_name
    `;

    const attendance = await executeQuery(attendanceQuery, [date, classId]);

    // Get class attendance summary for the date
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_students,
        COUNT(a.id) as marked_students,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
      WHERE s.current_class_id = ? AND s.status = 'active'
    `;

    const summary = await executeQuery(summaryQuery, [date, classId]);

    res.json({
      success: true,
      data: {
        date,
        attendance,
        summary: summary[0]
      }
    });

  } catch (error) {
    logger.error('Get class attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class attendance'
    });
  }
}

/**
 * Bulk mark attendance for a class
 */
async function bulkMarkAttendance(req, res) {
  try {
    const attendanceData = sanitizeInput(req.body);
    
    const {
      classId,
      date,
      attendanceRecords
    } = attendanceData;

    // Validate required fields
    if (!classId || !date || !attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: classId, date, attendanceRecords'
      });
    }

    // Prepare bulk insert/update queries
    const queries = attendanceRecords.map(record => ({
      query: `
        INSERT INTO attendance (student_id, class_id, date, status, time_in, time_out, remarks, marked_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        time_in = VALUES(time_in),
        time_out = VALUES(time_out),
        remarks = VALUES(remarks),
        updated_at = CURRENT_TIMESTAMP
      `,
      params: [
        record.studentId,
        classId,
        date,
        record.status,
        record.timeIn || null,
        record.timeOut || null,
        record.remarks || '',
        req.user.id
      ]
    }));

    await executeTransaction(queries);

    logger.info(`Bulk attendance marked for class ${classId} on ${date} by user ${req.user.id}`);

    res.json({
      success: true,
      message: `Attendance marked for ${attendanceRecords.length} students`
    });

  } catch (error) {
    logger.error('Bulk mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark bulk attendance'
    });
  }
}

module.exports = {
  getAttendance,
  markAttendance,
  updateAttendance,
  getStudentAttendance,
  getClassAttendance,
  bulkMarkAttendance
};
