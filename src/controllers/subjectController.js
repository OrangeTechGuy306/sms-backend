const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all subjects with pagination and filtering
 */
async function getSubjects(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      department_id = '',
      is_core = '',
      status = '',
      sort_by = 'name',
      sort_order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(s.name LIKE ? OR s.code LIKE ? OR s.description LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (department_id && isValidUUID(department_id)) {
      whereConditions.push('s.department_id = ?');
      queryParams.push(department_id);
    }

    if (is_core !== '') {
      whereConditions.push('s.is_core = ?');
      queryParams.push(is_core === 'true');
    }

    if (status) {
      whereConditions.push('s.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['name', 'code', 'credit_hours', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'name';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM subjects s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get subjects
    const subjectsQuery = `
      SELECT 
        s.id,
        s.code,
        s.name,
        s.description,
        s.credit_hours,
        s.is_core,
        s.status,
        s.created_at,
        d.name as department_name,
        (SELECT COUNT(*) FROM teacher_subjects ts WHERE ts.subject_id = s.id) as teacher_count,
        (SELECT COUNT(DISTINCT ts.class_id) FROM teacher_subjects ts WHERE ts.subject_id = s.id) as class_count
      FROM subjects s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE ${whereClause}
      ORDER BY s.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const subjects = await executeQuery(subjectsQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        subjects,
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
    logger.error('Get subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subjects'
    });
  }
}

/**
 * Get subject by ID
 */
async function getSubjectById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID format'
      });
    }

    const subjectQuery = `
      SELECT 
        s.*,
        d.name as department_name
      FROM subjects s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `;

    const subjects = await executeQuery(subjectQuery, [id]);

    if (subjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    const subject = subjects[0];

    // Get assigned teachers and classes
    const assignmentsQuery = `
      SELECT 
        t.id as teacher_id,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        c.id as class_id,
        c.name as class_name,
        gl.name as grade_level,
        ts.is_primary,
        ay.name as academic_year
      FROM teacher_subjects ts
      JOIN teachers t ON ts.teacher_id = t.id
      JOIN classes c ON ts.class_id = c.id
      JOIN grade_levels gl ON c.grade_level_id = gl.id
      JOIN academic_years ay ON ts.academic_year_id = ay.id
      WHERE ts.subject_id = ?
      ORDER BY ay.name DESC, gl.level_number, c.name, t.first_name
    `;

    const assignments = await executeQuery(assignmentsQuery, [id]);

    res.json({
      success: true,
      data: {
        subject,
        assignments
      }
    });

  } catch (error) {
    logger.error('Get subject by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subject'
    });
  }
}

/**
 * Create new subject
 */
async function createSubject(req, res) {
  try {
    const subjectData = sanitizeInput(req.body);
    
    const {
      code,
      name,
      description = '',
      departmentId = null,
      creditHours = 1,
      isCore = true
    } = subjectData;

    // Validate required fields
    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, name'
      });
    }

    // Check if code already exists
    const existingSubject = await executeQuery('SELECT id FROM subjects WHERE code = ?', [code]);
    if (existingSubject.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists'
      });
    }

    // Create subject
    const insertQuery = `
      INSERT INTO subjects (code, name, description, department_id, credit_hours, is_core, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `;

    const result = await executeQuery(insertQuery, [code, name, description, departmentId, creditHours, isCore]);

    logger.info(`Subject created: ${code} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: {
        subjectId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Create subject error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Subject with this code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create subject'
    });
  }
}

/**
 * Update subject
 */
async function updateSubject(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID format'
      });
    }

    // Check if subject exists
    const existingSubject = await executeQuery('SELECT id FROM subjects WHERE id = ?', [id]);
    if (existingSubject.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Build update query
    const allowedFields = ['name', 'description', 'department_id', 'credit_hours', 'is_core', 'status'];

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
      UPDATE subjects 
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

    logger.info(`Subject updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Subject updated successfully'
    });

  } catch (error) {
    logger.error('Update subject error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subject'
    });
  }
}

/**
 * Delete subject
 */
async function deleteSubject(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID format'
      });
    }

    // Check if subject exists
    const existingSubject = await executeQuery('SELECT code FROM subjects WHERE id = ?', [id]);
    if (existingSubject.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    const { code } = existingSubject[0];

    // Check for dependencies
    const dependencyChecks = [
      { table: 'teacher_subjects', message: 'Subject has teacher assignments' },
      { table: 'student_results', message: 'Subject has student results' },
      { table: 'timetables', message: 'Subject is used in timetables' }
    ];

    for (const check of dependencyChecks) {
      const result = await executeQuery(`SELECT COUNT(*) as count FROM ${check.table} WHERE subject_id = ?`, [id]);
      if (result[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete subject: ${check.message}`
        });
      }
    }

    // Delete subject
    await executeQuery('DELETE FROM subjects WHERE id = ?', [id]);

    logger.info(`Subject deleted: ${code} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Subject deleted successfully'
    });

  } catch (error) {
    logger.error('Delete subject error:', error);
    
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete subject: Subject has related records'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete subject'
    });
  }
}

module.exports = {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject
};
