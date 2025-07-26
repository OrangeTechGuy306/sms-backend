const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all timetables with pagination and filtering
 */
async function getTimetables(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      class_id = '',
      academic_year_id = '',
      status = '',
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(t.name LIKE ? OR c.name LIKE ?)');
      queryParams.push(searchTerm, searchTerm);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('t.class_id = ?');
      queryParams.push(class_id);
    }

    if (academic_year_id && isValidUUID(academic_year_id)) {
      whereConditions.push('t.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    if (status) {
      whereConditions.push('t.status = ?');
      queryParams.push(status);
    }

    // Role-based access control
    if (req.user.user_type === 'teacher') {
      // Teachers can see timetables for classes they teach
      whereConditions.push(`(
        t.class_id IN (
          SELECT DISTINCT ta.class_id 
          FROM teacher_assignments ta 
          WHERE ta.teacher_id = ?
        )
      )`);
      queryParams.push(req.user.teacher_id);
    } else if (req.user.user_type === 'student') {
      // Students can only see their class timetable
      whereConditions.push('t.class_id = (SELECT current_class_id FROM students WHERE user_id = ?)');
      queryParams.push(req.user.id);
    }

    // Validate sort parameters
    const allowedSortFields = ['name', 'effective_from', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM timetables t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN academic_years ay ON t.academic_year_id = ay.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get timetables
    const timetablesQuery = `
      SELECT 
        t.id,
        t.name,
        t.class_id,
        t.academic_year_id,
        t.term_id,
        t.effective_from,
        t.effective_to,
        t.status,
        t.created_by,
        t.created_at,
        t.updated_at,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM timetables t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON t.academic_year_id = ay.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE ${whereClause}
      ORDER BY t.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const timetables = await executeQuery(timetablesQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Timetables retrieved successfully',
      data: {
        timetables,
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

    logger.info(`User ${req.user.id} retrieved timetables - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving timetables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve timetables',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get timetable by ID with periods
 */
async function getTimetableById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timetable ID format'
      });
    }

    // Get timetable details
    const timetableQuery = `
      SELECT 
        t.id,
        t.name,
        t.class_id,
        t.academic_year_id,
        t.term_id,
        t.effective_from,
        t.effective_to,
        t.status,
        t.created_by,
        t.created_at,
        t.updated_at,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM timetables t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON t.academic_year_id = ay.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `;

    const timetableResult = await executeQuery(timetableQuery, [id]);

    if (timetableResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const timetable = timetableResult[0];

    // Check access permissions
    if (req.user.user_type === 'teacher') {
      // Check if teacher teaches this class
      const teacherClassQuery = `
        SELECT COUNT(*) as count
        FROM teacher_assignments ta
        WHERE ta.teacher_id = ? AND ta.class_id = ?
      `;
      const teacherClassResult = await executeQuery(teacherClassQuery, [req.user.teacher_id, timetable.class_id]);
      
      if (teacherClassResult[0].count === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view timetables for classes you teach.'
        });
      }
    } else if (req.user.user_type === 'student') {
      // Check if this is student's class timetable
      const studentClassQuery = 'SELECT current_class_id FROM students WHERE user_id = ?';
      const studentClass = await executeQuery(studentClassQuery, [req.user.id]);
      
      if (studentClass.length === 0 || timetable.class_id !== studentClass[0].current_class_id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your class timetable.'
        });
      }
    }

    // Get timetable periods
    const periodsQuery = `
      SELECT 
        tp.id,
        tp.day_of_week,
        tp.period_number,
        tp.start_time,
        tp.end_time,
        tp.subject_id,
        tp.teacher_id,
        tp.room_number,
        tp.period_type,
        tp.notes,
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name
      FROM timetable_periods tp
      LEFT JOIN subjects s ON tp.subject_id = s.id
      LEFT JOIN teachers t ON tp.teacher_id = t.id
      WHERE tp.timetable_id = ?
      ORDER BY 
        CASE tp.day_of_week
          WHEN 'monday' THEN 1
          WHEN 'tuesday' THEN 2
          WHEN 'wednesday' THEN 3
          WHEN 'thursday' THEN 4
          WHEN 'friday' THEN 5
          WHEN 'saturday' THEN 6
          WHEN 'sunday' THEN 7
        END,
        tp.period_number
    `;

    const periods = await executeQuery(periodsQuery, [id]);

    // Group periods by day
    const groupedPeriods = periods.reduce((acc, period) => {
      if (!acc[period.day_of_week]) {
        acc[period.day_of_week] = [];
      }
      acc[period.day_of_week].push(period);
      return acc;
    }, {});

    res.json({
      success: true,
      message: 'Timetable retrieved successfully',
      data: {
        ...timetable,
        periods: groupedPeriods
      }
    });

    logger.info(`User ${req.user.id} retrieved timetable ${id}`);

  } catch (error) {
    logger.error('Error retrieving timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve timetable',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Create new timetable
 */
async function createTimetable(req, res) {
  try {
    const {
      name,
      class_id,
      academic_year_id,
      term_id,
      effective_from,
      effective_to,
      status = 'draft'
    } = sanitizeInput(req.body);

    // Validate required fields
    if (!name || !class_id || !academic_year_id || !effective_from) {
      return res.status(400).json({
        success: false,
        message: 'Name, class, academic year, and effective from date are required'
      });
    }

    // Validate UUIDs
    const uuidFields = [
      { field: 'class_id', value: class_id },
      { field: 'academic_year_id', value: academic_year_id }
    ];

    if (term_id) uuidFields.push({ field: 'term_id', value: term_id });

    for (const { field, value } of uuidFields) {
      if (!isValidUUID(value)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field} format`
        });
      }
    }

    // Only admins and teachers can create timetables
    if (!['admin', 'teacher'].includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and teachers can create timetables'
      });
    }

    // Verify class exists
    const classQuery = 'SELECT id, name FROM classes WHERE id = ? AND status = "active"';
    const classResult = await executeQuery(classQuery, [class_id]);
    
    if (classResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found or not active'
      });
    }

    // Verify academic year exists
    const academicYearQuery = 'SELECT id FROM academic_years WHERE id = ? AND status IN ("active", "current")';
    const academicYearResult = await executeQuery(academicYearQuery, [academic_year_id]);
    
    if (academicYearResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Academic year not found or not active'
      });
    }

    // Check for overlapping timetables
    const overlapQuery = `
      SELECT id, name 
      FROM timetables 
      WHERE class_id = ? 
        AND academic_year_id = ?
        AND status = 'active'
        AND (
          (effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?))
          OR (effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?))
        )
    `;
    
    const overlapResult = await executeQuery(overlapQuery, [
      class_id, academic_year_id, effective_from, effective_from, 
      effective_to || '9999-12-31', effective_to || '9999-12-31'
    ]);
    
    if (overlapResult.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Overlapping timetable exists: ${overlapResult[0].name}`
      });
    }

    // Create timetable
    const insertQuery = `
      INSERT INTO timetables (
        name, class_id, academic_year_id, term_id, effective_from, 
        effective_to, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      name, class_id, academic_year_id, term_id, effective_from,
      effective_to, status, req.user.id
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const timetableId = result.insertId;

    // Get the created timetable with related data
    const createdTimetable = await executeQuery(`
      SELECT 
        t.id,
        t.name,
        t.class_id,
        t.academic_year_id,
        t.term_id,
        t.effective_from,
        t.effective_to,
        t.status,
        t.created_by,
        t.created_at,
        t.updated_at,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM timetables t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON t.academic_year_id = ay.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [timetableId]);

    res.status(201).json({
      success: true,
      message: 'Timetable created successfully',
      data: createdTimetable[0]
    });

    logger.info(`User ${req.user.id} created timetable ${timetableId} for class ${class_id}`);

  } catch (error) {
    logger.error('Error creating timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create timetable',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Update timetable
 */
async function updateTimetable(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      effective_from,
      effective_to,
      status
    } = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timetable ID format'
      });
    }

    // Check if timetable exists
    const existingQuery = 'SELECT * FROM timetables WHERE id = ?';
    const existingResult = await executeQuery(existingQuery, [id]);

    if (existingResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const existingTimetable = existingResult[0];

    // Only admins and the creator can update timetables
    if (req.user.user_type !== 'admin' && existingTimetable.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update timetables you created.'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateParams = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }

    if (effective_from !== undefined) {
      updateFields.push('effective_from = ?');
      updateParams.push(effective_from);
    }

    if (effective_to !== undefined) {
      updateFields.push('effective_to = ?');
      updateParams.push(effective_to);
    }

    if (status !== undefined) {
      if (!['draft', 'active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be draft, active, or inactive'
        });
      }
      updateFields.push('status = ?');
      updateParams.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Add updated_at field
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);

    const updateQuery = `
      UPDATE timetables
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await executeQuery(updateQuery, updateParams);

    // Get updated timetable with related data
    const updatedTimetable = await executeQuery(`
      SELECT
        t.id,
        t.name,
        t.class_id,
        t.academic_year_id,
        t.term_id,
        t.effective_from,
        t.effective_to,
        t.status,
        t.created_by,
        t.created_at,
        t.updated_at,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM timetables t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON t.academic_year_id = ay.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: updatedTimetable[0]
    });

    logger.info(`User ${req.user.id} updated timetable ${id}`);

  } catch (error) {
    logger.error('Error updating timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update timetable',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Delete timetable
 */
async function deleteTimetable(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timetable ID format'
      });
    }

    // Check if timetable exists
    const existingQuery = 'SELECT created_by, status FROM timetables WHERE id = ?';
    const existingResult = await executeQuery(existingQuery, [id]);

    if (existingResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const existingTimetable = existingResult[0];

    // Only admins and the creator can delete timetables
    if (req.user.user_type !== 'admin' && existingTimetable.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete timetables you created.'
      });
    }

    // Don't allow deletion of active timetables
    if (existingTimetable.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active timetable. Please deactivate it first.'
      });
    }

    // Delete timetable and its periods (cascade delete)
    const deleteQuery = 'DELETE FROM timetables WHERE id = ?';
    await executeQuery(deleteQuery, [id]);

    res.json({
      success: true,
      message: 'Timetable deleted successfully'
    });

    logger.info(`User ${req.user.id} deleted timetable ${id}`);

  } catch (error) {
    logger.error('Error deleting timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete timetable',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Add period to timetable
 */
async function addTimetablePeriod(req, res) {
  try {
    const { id } = req.params;
    const {
      day_of_week,
      period_number,
      start_time,
      end_time,
      subject_id,
      teacher_id,
      room_number,
      period_type = 'regular',
      notes
    } = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timetable ID format'
      });
    }

    // Validate required fields
    if (!day_of_week || !period_number || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'Day of week, period number, start time, and end time are required'
      });
    }

    // Validate day of week
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(day_of_week.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day of week'
      });
    }

    // Validate period type
    const validPeriodTypes = ['regular', 'break', 'lunch', 'assembly', 'free'];
    if (!validPeriodTypes.includes(period_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period type'
      });
    }

    // Check if timetable exists
    const timetableQuery = 'SELECT id, status, created_by FROM timetables WHERE id = ?';
    const timetableResult = await executeQuery(timetableQuery, [id]);

    if (timetableResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const timetable = timetableResult[0];

    // Only admins and the creator can modify timetables
    if (req.user.user_type !== 'admin' && timetable.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only modify timetables you created.'
      });
    }

    // Check for existing period at same day/time
    const existingPeriodQuery = `
      SELECT id FROM timetable_periods
      WHERE timetable_id = ? AND day_of_week = ? AND period_number = ?
    `;

    const existingPeriod = await executeQuery(existingPeriodQuery, [id, day_of_week, period_number]);

    if (existingPeriod.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Period already exists for this day and time slot'
      });
    }

    // Validate UUIDs if provided
    if (subject_id && !isValidUUID(subject_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID format'
      });
    }

    if (teacher_id && !isValidUUID(teacher_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid teacher ID format'
      });
    }

    // Create period
    const insertQuery = `
      INSERT INTO timetable_periods (
        timetable_id, day_of_week, period_number, start_time, end_time,
        subject_id, teacher_id, room_number, period_type, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      id, day_of_week, period_number, start_time, end_time,
      subject_id, teacher_id, room_number, period_type, notes
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const periodId = result.insertId;

    // Get the created period with related data
    const createdPeriod = await executeQuery(`
      SELECT
        tp.id,
        tp.timetable_id,
        tp.day_of_week,
        tp.period_number,
        tp.start_time,
        tp.end_time,
        tp.subject_id,
        tp.teacher_id,
        tp.room_number,
        tp.period_type,
        tp.notes,
        tp.created_at,
        tp.updated_at,
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name
      FROM timetable_periods tp
      LEFT JOIN subjects s ON tp.subject_id = s.id
      LEFT JOIN teachers t ON tp.teacher_id = t.id
      WHERE tp.id = ?
    `, [periodId]);

    res.status(201).json({
      success: true,
      message: 'Timetable period added successfully',
      data: createdPeriod[0]
    });

    logger.info(`User ${req.user.id} added period ${periodId} to timetable ${id}`);

  } catch (error) {
    logger.error('Error adding timetable period:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add timetable period',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getTimetables,
  getTimetableById,
  createTimetable,
  updateTimetable,
  deleteTimetable,
  addTimetablePeriod
};
