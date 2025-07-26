const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all results with pagination and filtering
 */
async function getResults(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      student_id = '',
      subject_id = '',
      class_id = '',
      term_id = '',
      assessment_type_id = '',
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (student_id && isValidUUID(student_id)) {
      whereConditions.push('sr.student_id = ?');
      queryParams.push(student_id);
    }

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('sr.subject_id = ?');
      queryParams.push(subject_id);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('sr.class_id = ?');
      queryParams.push(class_id);
    }

    if (term_id && isValidUUID(term_id)) {
      whereConditions.push('sr.term_id = ?');
      queryParams.push(term_id);
    }

    if (assessment_type_id && isValidUUID(assessment_type_id)) {
      whereConditions.push('sr.assessment_type_id = ?');
      queryParams.push(assessment_type_id);
    }

    // Validate sort parameters
    const allowedSortFields = ['score', 'created_at', 'student_name', 'subject_name'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM student_results sr
      JOIN students s ON sr.student_id = s.id
      JOIN subjects sub ON sr.subject_id = sub.id
      JOIN classes c ON sr.class_id = c.id
      JOIN terms t ON sr.term_id = t.id
      JOIN assessment_types at ON sr.assessment_type_id = at.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get results
    const resultsQuery = `
      SELECT 
        sr.id,
        sr.score,
        sr.max_score,
        sr.grade,
        sr.remarks,
        sr.created_at,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        s.student_id,
        sub.name as subject_name,
        sub.code as subject_code,
        c.name as class_name,
        t.name as term_name,
        at.name as assessment_type,
        at.weight_percentage,
        CONCAT(teacher.first_name, ' ', teacher.last_name) as teacher_name,
        ROUND((sr.score / sr.max_score) * 100, 2) as percentage
      FROM student_results sr
      JOIN students s ON sr.student_id = s.id
      JOIN subjects sub ON sr.subject_id = sub.id
      JOIN classes c ON sr.class_id = c.id
      JOIN terms t ON sr.term_id = t.id
      JOIN assessment_types at ON sr.assessment_type_id = at.id
      JOIN teachers teacher ON sr.teacher_id = teacher.id
      WHERE ${whereClause}
      ORDER BY 
        ${sortField === 'student_name' ? 's.first_name' : 
          sortField === 'subject_name' ? 'sub.name' : 
          `sr.${sortField}`} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const results = await executeQuery(resultsQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        results,
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
    logger.error('Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve results'
    });
  }
}

/**
 * Get result by ID
 */
async function getResultById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid result ID format'
      });
    }

    const resultQuery = `
      SELECT 
        sr.*,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        s.student_id,
        sub.name as subject_name,
        sub.code as subject_code,
        c.name as class_name,
        t.name as term_name,
        at.name as assessment_type,
        at.weight_percentage,
        at.max_score as assessment_max_score,
        CONCAT(teacher.first_name, ' ', teacher.last_name) as teacher_name,
        ROUND((sr.score / sr.max_score) * 100, 2) as percentage
      FROM student_results sr
      JOIN students s ON sr.student_id = s.id
      JOIN subjects sub ON sr.subject_id = sub.id
      JOIN classes c ON sr.class_id = c.id
      JOIN terms t ON sr.term_id = t.id
      JOIN assessment_types at ON sr.assessment_type_id = at.id
      JOIN teachers teacher ON sr.teacher_id = teacher.id
      WHERE sr.id = ?
    `;

    const results = await executeQuery(resultQuery, [id]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    const result = results[0];

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get result by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve result'
    });
  }
}

/**
 * Create new result
 */
async function createResult(req, res) {
  try {
    const resultData = sanitizeInput(req.body);
    
    const {
      studentId,
      subjectId,
      classId,
      termId,
      assessmentTypeId,
      score,
      maxScore = 100,
      remarks = ''
    } = resultData;

    // Validate required fields
    if (!studentId || !subjectId || !classId || !termId || !assessmentTypeId || score === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if result already exists for this combination
    const existingResult = await executeQuery(
      'SELECT id FROM student_results WHERE student_id = ? AND subject_id = ? AND term_id = ? AND assessment_type_id = ?',
      [studentId, subjectId, termId, assessmentTypeId]
    );

    if (existingResult.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Result already exists for this student, subject, term, and assessment type'
      });
    }

    // Calculate grade based on percentage
    const percentage = (score / maxScore) * 100;
    let grade = 'F';

    // Get grade scale for the current academic year
    const gradeScaleQuery = `
      SELECT grade, min_score, max_score 
      FROM grade_scales gs
      JOIN academic_years ay ON gs.academic_year_id = ay.id
      WHERE ay.is_current = TRUE AND ? BETWEEN gs.min_score AND gs.max_score
      ORDER BY gs.min_score DESC
      LIMIT 1
    `;

    const gradeResult = await executeQuery(gradeScaleQuery, [percentage]);
    if (gradeResult.length > 0) {
      grade = gradeResult[0].grade;
    }

    // Create result
    const insertQuery = `
      INSERT INTO student_results (
        student_id, subject_id, class_id, term_id, assessment_type_id, 
        score, max_score, grade, remarks, teacher_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Get teacher ID from the current user (assuming the teacher is creating the result)
    let teacherId = null;
    if (req.user.userType === 'teacher') {
      const teacherQuery = 'SELECT id FROM teachers WHERE user_id = ?';
      const teacherResult = await executeQuery(teacherQuery, [req.user.id]);
      if (teacherResult.length > 0) {
        teacherId = teacherResult[0].id;
      }
    } else {
      // For admin users, we might need to specify the teacher ID in the request
      teacherId = resultData.teacherId;
    }

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID is required'
      });
    }

    const result = await executeQuery(insertQuery, [
      studentId, subjectId, classId, termId, assessmentTypeId,
      score, maxScore, grade, remarks, teacherId
    ]);

    logger.info(`Result created for student ${studentId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Result created successfully',
      data: {
        resultId: result.insertId,
        grade,
        percentage: Math.round(percentage * 100) / 100
      }
    });

  } catch (error) {
    logger.error('Create result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create result'
    });
  }
}

/**
 * Update result
 */
async function updateResult(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid result ID format'
      });
    }

    // Check if result exists
    const existingResult = await executeQuery('SELECT * FROM student_results WHERE id = ?', [id]);
    if (existingResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    const currentResult = existingResult[0];

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.student_id;
    delete updates.subject_id;
    delete updates.class_id;
    delete updates.term_id;
    delete updates.assessment_type_id;
    delete updates.created_at;
    delete updates.updated_at;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Recalculate grade if score or max_score is updated
    let grade = currentResult.grade;
    const newScore = updates.score !== undefined ? updates.score : currentResult.score;
    const newMaxScore = updates.max_score !== undefined ? updates.max_score : currentResult.max_score;

    if (updates.score !== undefined || updates.max_score !== undefined) {
      const percentage = (newScore / newMaxScore) * 100;
      
      const gradeScaleQuery = `
        SELECT grade, min_score, max_score 
        FROM grade_scales gs
        JOIN academic_years ay ON gs.academic_year_id = ay.id
        WHERE ay.is_current = TRUE AND ? BETWEEN gs.min_score AND gs.max_score
        ORDER BY gs.min_score DESC
        LIMIT 1
      `;

      const gradeResult = await executeQuery(gradeScaleQuery, [percentage]);
      if (gradeResult.length > 0) {
        grade = gradeResult[0].grade;
        updates.grade = grade;
      }
    }

    // Build update query
    const allowedFields = ['score', 'max_score', 'grade', 'remarks'];

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
      UPDATE student_results 
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

    logger.info(`Result updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Result updated successfully',
      data: {
        grade,
        percentage: Math.round(((newScore / newMaxScore) * 100) * 100) / 100
      }
    });

  } catch (error) {
    logger.error('Update result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update result'
    });
  }
}

/**
 * Delete result
 */
async function deleteResult(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid result ID format'
      });
    }

    // Check if result exists
    const existingResult = await executeQuery('SELECT id FROM student_results WHERE id = ?', [id]);
    if (existingResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    // Delete result
    await executeQuery('DELETE FROM student_results WHERE id = ?', [id]);

    logger.info(`Result deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Result deleted successfully'
    });

  } catch (error) {
    logger.error('Delete result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete result'
    });
  }
}

module.exports = {
  getResults,
  getResultById,
  createResult,
  updateResult,
  deleteResult
};
