const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all classes with pagination and filtering
 */
async function getClasses(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      grade_level_id = '',
      academic_year_id = '',
      status = '',
      sort_by = 'name',
      sort_order = 'ASC'
    } = req.query;

    // Validate and parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(c.name LIKE ? OR c.room_number LIKE ?)');
      queryParams.push(searchTerm, searchTerm);
    }

    if (grade_level_id && isValidUUID(grade_level_id)) {
      whereConditions.push('c.grade_level_id = ?');
      queryParams.push(grade_level_id);
    }

    if (academic_year_id && isValidUUID(academic_year_id)) {
      whereConditions.push('c.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    if (status) {
      whereConditions.push('c.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['name', 'capacity', 'room_number', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'name';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get classes
    const classesQuery = `
      SELECT
        c.id,
        c.name,
        c.section,
        c.capacity,
        c.room_number,
        c.status,
        c.created_at,
        gl.name as grade_level,
        gl.level_number,
        ay.name as academic_year,
        CONCAT(u.first_name, ' ', u.last_name) as class_teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.status = 'active') as student_count,
        (SELECT COUNT(DISTINCT ts.subject_id) FROM teacher_subjects ts WHERE ts.class_id = c.id) as subject_count
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE ${whereClause}
      ORDER BY gl.level_number, c.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const classes = await executeQuery(classesQuery, [...queryParams, limitNum.toString(), offset.toString()]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: {
        classes,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    logger.error('Get classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve classes'
    });
  }
}

/**
 * Get class by ID
 */
async function getClassById(req, res) {
  try {
    const { id } = req.params;

    const classQuery = `
      SELECT
        c.*,
        gl.name as grade_level,
        gl.level_number,
        ay.name as academic_year,
        CONCAT(u.first_name, ' ', u.last_name) as class_teacher_name,
        t.id as class_teacher_id
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE c.id = ?
    `;

    const classes = await executeQuery(classQuery, [id]);

    if (classes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const classData = classes[0];

    // Get students in the class
    const studentsQuery = `
      SELECT 
        s.id,
        s.student_id,
        CONCAT(s.first_name, ' ', s.last_name) as full_name,
        s.status,
        s.admission_date
      FROM students s
      WHERE s.current_class_id = ? AND s.status = 'active'
      ORDER BY s.first_name, s.last_name
    `;

    const students = await executeQuery(studentsQuery, [id]);

    // Get subjects taught in the class
    const subjectsQuery = `
      SELECT 
        s.id as subject_id,
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        ts.is_primary
      FROM teacher_subjects ts
      JOIN subjects s ON ts.subject_id = s.id
      JOIN teachers t ON ts.teacher_id = t.id
      WHERE ts.class_id = ?
      ORDER BY s.name
    `;

    const subjects = await executeQuery(subjectsQuery, [id]);

    res.json({
      success: true,
      data: {
        class: classData,
        students,
        subjects
      }
    });

  } catch (error) {
    logger.error('Get class by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class'
    });
  }
}

/**
 * Create new class
 */
async function createClass(req, res) {
  try {
    const classData = sanitizeInput(req.body);
    
    const {
      name,
      gradeLevelId,
      academicYearId,
      classTeacherId = null,
      capacity = 30,
      roomNumber = ''
    } = classData;

    // Validate required fields
    if (!name || !gradeLevelId || !academicYearId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, gradeLevelId, academicYearId'
      });
    }

    // Get grade level name for the grade_level field
    const gradeLevel = await executeQuery(
      'SELECT name FROM grade_levels WHERE id = ?',
      [gradeLevelId]
    );

    if (gradeLevel.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade level ID'
      });
    }

    const gradeLevelName = gradeLevel[0].name;

    // Check if class name already exists for the same grade level and academic year
    const existingClass = await executeQuery(
      'SELECT id FROM classes WHERE name = ? AND grade_level_id = ? AND academic_year_id = ?',
      [name, gradeLevelId, academicYearId]
    );

    if (existingClass.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Class with this name already exists for the selected grade level and academic year'
      });
    }

    // Create class with both grade_level and grade_level_id
    const insertQuery = `
      INSERT INTO classes (name, grade_level, grade_level_id, academic_year_id, class_teacher_id, capacity, room_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    const result = await executeQuery(insertQuery, [name, gradeLevelName, gradeLevelId, academicYearId, classTeacherId, capacity, roomNumber]);

    logger.info(`Class created: ${name} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: {
        classId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Create class error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Class with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create class'
    });
  }
}

/**
 * Update class
 */
async function updateClass(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeInput(req.body);



    // Check if class exists
    const existingClass = await executeQuery('SELECT id FROM classes WHERE id = ?', [id]);
    if (existingClass.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    // Validate field lengths to prevent database errors
    const fieldLimits = {
      name: 100,
      grade_level: 20,
      section: 10,
      room_number: 20
    };

    for (const [field, value] of Object.entries(updates)) {
      if (fieldLimits[field] && typeof value === 'string' && value.length > fieldLimits[field]) {
        return res.status(400).json({
          success: false,
          message: `Field '${field}' exceeds maximum length of ${fieldLimits[field]} characters`
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Build update query
    const allowedFields = [
      'name',
      'grade_level',
      'section',
      'academic_year_id',
      'class_teacher_id',
      'capacity',
      'room_number',
      'description',
      'status',
      'grade_level_id'
    ];

    const updateFields = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map(key => `${key} = ?`);

    // Debug: Log what fields are being updated
    console.log('🔍 Update debug info:');
    console.log('  - Received updates:', Object.keys(updates));
    console.log('  - Allowed fields:', allowedFields);
    console.log('  - Filtered update fields:', Object.keys(updates).filter(key => allowedFields.includes(key)));
    console.log('  - SQL update fields:', updateFields);

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updateQuery = `
      UPDATE classes 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const queryParams = [
      ...Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .map(key => updates[key]),
      id
    ];

    // Debug: Log the final query and parameters
    console.log('  - Final SQL query:', updateQuery);
    console.log('  - Query parameters:', queryParams);

    await executeQuery(updateQuery, queryParams);

    logger.info(`Class updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Class updated successfully'
    });

  } catch (error) {
    logger.error('Update class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update class'
    });
  }
}

/**
 * Delete class
 */
async function deleteClass(req, res) {
  try {
    const { id } = req.params;



    // Check if class exists
    const existingClass = await executeQuery('SELECT name FROM classes WHERE id = ?', [id]);
    if (existingClass.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const { name } = existingClass[0];

    // Check for dependencies
    const dependencyChecks = [
      { table: 'students', column: 'current_class_id', message: 'Class has students assigned' },
      { table: 'teacher_subjects', column: 'class_id', message: 'Class has subject assignments' },
      { table: 'timetables', column: 'class_id', message: 'Class is used in timetables' },
      { table: 'attendance', column: 'class_id', message: 'Class has attendance records' }
    ];

    for (const check of dependencyChecks) {
      const column = check.column || 'class_id';
      const result = await executeQuery(`SELECT COUNT(*) as count FROM ${check.table} WHERE ${column} = ?`, [id]);
      if (result[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete class: ${check.message}`
        });
      }
    }

    // Delete class
    await executeQuery('DELETE FROM classes WHERE id = ?', [id]);

    logger.info(`Class deleted: ${name} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });

  } catch (error) {
    logger.error('Delete class error:', error);
    
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class: Class has related records'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete class'
    });
  }
}

module.exports = {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass
};
