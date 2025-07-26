const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all lesson notes with pagination and filtering
 */
async function getLessonNotes(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      subject_id = '',
      teacher_id = '',
      class_id = '',
      grade_level_id = '',
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
      whereConditions.push('(ln.title LIKE ? OR ln.content LIKE ? OR ln.objectives LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('ln.subject_id = ?');
      queryParams.push(subject_id);
    }

    if (teacher_id && isValidUUID(teacher_id)) {
      whereConditions.push('ln.teacher_id = ?');
      queryParams.push(teacher_id);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('ln.class_id = ?');
      queryParams.push(class_id);
    }

    if (grade_level_id && isValidUUID(grade_level_id)) {
      whereConditions.push('ln.grade_level_id = ?');
      queryParams.push(grade_level_id);
    }

    if (status) {
      whereConditions.push('ln.status = ?');
      queryParams.push(status);
    }

    // Role-based access control
    if (req.user.user_type === 'teacher') {
      whereConditions.push('ln.teacher_id = ?');
      queryParams.push(req.user.teacher_id);
    } else if (req.user.user_type === 'student') {
      whereConditions.push('(ln.is_public = TRUE OR ln.class_id IN (SELECT current_class_id FROM students WHERE user_id = ?))');
      queryParams.push(req.user.id);
    }

    // Validate sort parameters
    const allowedSortFields = ['title', 'lesson_date', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM lesson_notes ln
      LEFT JOIN subjects s ON ln.subject_id = s.id
      LEFT JOIN teachers t ON ln.teacher_id = t.id
      LEFT JOIN classes c ON ln.class_id = c.id
      LEFT JOIN grade_levels gl ON ln.grade_level_id = gl.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get lesson notes
    const lessonNotesQuery = `
      SELECT 
        ln.id,
        ln.title,
        ln.content,
        ln.subject_id,
        ln.teacher_id,
        ln.class_id,
        ln.grade_level_id,
        ln.academic_year_id,
        ln.lesson_date,
        ln.objectives,
        ln.materials,
        ln.homework,
        ln.status,
        ln.is_public,
        ln.created_at,
        ln.updated_at,
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name
      FROM lesson_notes ln
      LEFT JOIN subjects s ON ln.subject_id = s.id
      LEFT JOIN teachers t ON ln.teacher_id = t.id
      LEFT JOIN classes c ON ln.class_id = c.id
      LEFT JOIN grade_levels gl ON ln.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON ln.academic_year_id = ay.id
      WHERE ${whereClause}
      ORDER BY ln.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const lessonNotes = await executeQuery(lessonNotesQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Lesson notes retrieved successfully',
      data: {
        lessonNotes,
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

    logger.info(`User ${req.user.id} retrieved lesson notes - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving lesson notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lesson notes',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get lesson note by ID
 */
async function getLessonNoteById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson note ID format'
      });
    }

    const query = `
      SELECT 
        ln.id,
        ln.title,
        ln.content,
        ln.subject_id,
        ln.teacher_id,
        ln.class_id,
        ln.grade_level_id,
        ln.academic_year_id,
        ln.lesson_date,
        ln.objectives,
        ln.materials,
        ln.homework,
        ln.status,
        ln.is_public,
        ln.created_at,
        ln.updated_at,
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        t.email as teacher_email,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name
      FROM lesson_notes ln
      LEFT JOIN subjects s ON ln.subject_id = s.id
      LEFT JOIN teachers t ON ln.teacher_id = t.id
      LEFT JOIN classes c ON ln.class_id = c.id
      LEFT JOIN grade_levels gl ON ln.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON ln.academic_year_id = ay.id
      WHERE ln.id = ?
    `;

    const result = await executeQuery(query, [id]);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lesson note not found'
      });
    }

    const lessonNote = result[0];

    // Check access permissions
    if (req.user.user_type === 'teacher' && lessonNote.teacher_id !== req.user.teacher_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own lesson notes.'
      });
    }

    if (req.user.user_type === 'student') {
      // Students can only view public lesson notes or notes for their class
      const studentClassQuery = 'SELECT current_class_id FROM students WHERE user_id = ?';
      const studentClass = await executeQuery(studentClassQuery, [req.user.id]);
      
      if (!lessonNote.is_public && 
          (studentClass.length === 0 || lessonNote.class_id !== studentClass[0].current_class_id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view public lesson notes or notes for your class.'
        });
      }
    }

    res.json({
      success: true,
      message: 'Lesson note retrieved successfully',
      data: lessonNote
    });

    logger.info(`User ${req.user.id} retrieved lesson note ${id}`);

  } catch (error) {
    logger.error('Error retrieving lesson note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lesson note',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Create new lesson note
 */
async function createLessonNote(req, res) {
  try {
    const {
      title,
      content,
      subject_id,
      class_id,
      grade_level_id,
      academic_year_id,
      lesson_date,
      objectives,
      materials,
      homework,
      status = 'draft',
      is_public = false
    } = sanitizeInput(req.body);

    // Validate required fields
    if (!title || !content || !subject_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        message: 'Title, content, subject, and academic year are required'
      });
    }

    // Validate UUIDs
    const uuidFields = [
      { field: 'subject_id', value: subject_id },
      { field: 'academic_year_id', value: academic_year_id }
    ];

    if (class_id) uuidFields.push({ field: 'class_id', value: class_id });
    if (grade_level_id) uuidFields.push({ field: 'grade_level_id', value: grade_level_id });

    for (const { field, value } of uuidFields) {
      if (!isValidUUID(value)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field} format`
        });
      }
    }

    // Get teacher ID from user
    let teacher_id;
    if (req.user.user_type === 'teacher') {
      teacher_id = req.user.teacher_id;
    } else if (req.user.user_type === 'admin') {
      // Admin can create lesson notes, but need to specify teacher
      if (!req.body.teacher_id || !isValidUUID(req.body.teacher_id)) {
        return res.status(400).json({
          success: false,
          message: 'Teacher ID is required when creating lesson note as admin'
        });
      }
      teacher_id = req.body.teacher_id;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Only teachers and admins can create lesson notes'
      });
    }

    // Verify subject exists and teacher is assigned to it
    const subjectQuery = `
      SELECT s.id, s.name, ta.teacher_id
      FROM subjects s
      LEFT JOIN teacher_assignments ta ON s.id = ta.subject_id AND ta.teacher_id = ?
      WHERE s.id = ? AND s.status = 'active'
    `;
    
    const subjectResult = await executeQuery(subjectQuery, [teacher_id, subject_id]);
    
    if (subjectResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found or not assigned to teacher'
      });
    }

    // Verify academic year exists and is active
    const academicYearQuery = 'SELECT id FROM academic_years WHERE id = ? AND status IN ("active", "current")';
    const academicYearResult = await executeQuery(academicYearQuery, [academic_year_id]);
    
    if (academicYearResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Academic year not found or not active'
      });
    }

    // Create lesson note
    const insertQuery = `
      INSERT INTO lesson_notes (
        title, content, subject_id, teacher_id, class_id, grade_level_id,
        academic_year_id, lesson_date, objectives, materials, homework,
        status, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      title, content, subject_id, teacher_id, class_id, grade_level_id,
      academic_year_id, lesson_date, objectives, materials, homework,
      status, is_public
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const lessonNoteId = result.insertId;

    // Get the created lesson note with related data
    const createdLessonNote = await executeQuery(`
      SELECT 
        ln.id,
        ln.title,
        ln.content,
        ln.subject_id,
        ln.teacher_id,
        ln.class_id,
        ln.grade_level_id,
        ln.academic_year_id,
        ln.lesson_date,
        ln.objectives,
        ln.materials,
        ln.homework,
        ln.status,
        ln.is_public,
        ln.created_at,
        ln.updated_at,
        s.name as subject_name,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name
      FROM lesson_notes ln
      LEFT JOIN subjects s ON ln.subject_id = s.id
      LEFT JOIN teachers t ON ln.teacher_id = t.id
      LEFT JOIN classes c ON ln.class_id = c.id
      LEFT JOIN grade_levels gl ON ln.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON ln.academic_year_id = ay.id
      WHERE ln.id = ?
    `, [lessonNoteId]);

    res.status(201).json({
      success: true,
      message: 'Lesson note created successfully',
      data: createdLessonNote[0]
    });

    logger.info(`User ${req.user.id} created lesson note ${lessonNoteId} for subject ${subject_id}`);

  } catch (error) {
    logger.error('Error creating lesson note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lesson note',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Update lesson note
 */
async function updateLessonNote(req, res) {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      subject_id,
      class_id,
      grade_level_id,
      lesson_date,
      objectives,
      materials,
      homework,
      status,
      is_public
    } = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson note ID format'
      });
    }

    // Check if lesson note exists and get current data
    const existingQuery = `
      SELECT ln.*, CONCAT(t.first_name, ' ', t.last_name) as teacher_name
      FROM lesson_notes ln
      LEFT JOIN teachers t ON ln.teacher_id = t.id
      WHERE ln.id = ?
    `;

    const existingResult = await executeQuery(existingQuery, [id]);

    if (existingResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lesson note not found'
      });
    }

    const existingLessonNote = existingResult[0];

    // Check permissions
    if (req.user.user_type === 'teacher' && existingLessonNote.teacher_id !== req.user.teacher_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own lesson notes.'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateParams = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateParams.push(title);
    }

    if (content !== undefined) {
      updateFields.push('content = ?');
      updateParams.push(content);
    }

    if (subject_id !== undefined) {
      if (!isValidUUID(subject_id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subject ID format'
        });
      }
      updateFields.push('subject_id = ?');
      updateParams.push(subject_id);
    }

    if (class_id !== undefined) {
      if (class_id && !isValidUUID(class_id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid class ID format'
        });
      }
      updateFields.push('class_id = ?');
      updateParams.push(class_id);
    }

    if (grade_level_id !== undefined) {
      if (grade_level_id && !isValidUUID(grade_level_id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid grade level ID format'
        });
      }
      updateFields.push('grade_level_id = ?');
      updateParams.push(grade_level_id);
    }

    if (lesson_date !== undefined) {
      updateFields.push('lesson_date = ?');
      updateParams.push(lesson_date);
    }

    if (objectives !== undefined) {
      updateFields.push('objectives = ?');
      updateParams.push(objectives);
    }

    if (materials !== undefined) {
      updateFields.push('materials = ?');
      updateParams.push(materials);
    }

    if (homework !== undefined) {
      updateFields.push('homework = ?');
      updateParams.push(homework);
    }

    if (status !== undefined) {
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be draft, published, or archived'
        });
      }
      updateFields.push('status = ?');
      updateParams.push(status);
    }

    if (is_public !== undefined) {
      updateFields.push('is_public = ?');
      updateParams.push(is_public);
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
      UPDATE lesson_notes
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await executeQuery(updateQuery, updateParams);

    // Get updated lesson note with related data
    const updatedLessonNote = await executeQuery(`
      SELECT
        ln.id,
        ln.title,
        ln.content,
        ln.subject_id,
        ln.teacher_id,
        ln.class_id,
        ln.grade_level_id,
        ln.academic_year_id,
        ln.lesson_date,
        ln.objectives,
        ln.materials,
        ln.homework,
        ln.status,
        ln.is_public,
        ln.created_at,
        ln.updated_at,
        s.name as subject_name,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name
      FROM lesson_notes ln
      LEFT JOIN subjects s ON ln.subject_id = s.id
      LEFT JOIN teachers t ON ln.teacher_id = t.id
      LEFT JOIN classes c ON ln.class_id = c.id
      LEFT JOIN grade_levels gl ON ln.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON ln.academic_year_id = ay.id
      WHERE ln.id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Lesson note updated successfully',
      data: updatedLessonNote[0]
    });

    logger.info(`User ${req.user.id} updated lesson note ${id}`);

  } catch (error) {
    logger.error('Error updating lesson note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lesson note',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Delete lesson note
 */
async function deleteLessonNote(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson note ID format'
      });
    }

    // Check if lesson note exists
    const existingQuery = 'SELECT teacher_id FROM lesson_notes WHERE id = ?';
    const existingResult = await executeQuery(existingQuery, [id]);

    if (existingResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lesson note not found'
      });
    }

    const existingLessonNote = existingResult[0];

    // Check permissions
    if (req.user.user_type === 'teacher' && existingLessonNote.teacher_id !== req.user.teacher_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own lesson notes.'
      });
    }

    // Delete lesson note
    const deleteQuery = 'DELETE FROM lesson_notes WHERE id = ?';
    await executeQuery(deleteQuery, [id]);

    res.json({
      success: true,
      message: 'Lesson note deleted successfully'
    });

    logger.info(`User ${req.user.id} deleted lesson note ${id}`);

  } catch (error) {
    logger.error('Error deleting lesson note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lesson note',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getLessonNotes,
  getLessonNoteById,
  createLessonNote,
  updateLessonNote,
  deleteLessonNote
};
