const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all assessments with pagination and filtering
 */
async function getAssessments(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      subject_id = '',
      teacher_id = '',
      class_id = '',
      assessment_type = '',
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
      whereConditions.push('(a.title LIKE ? OR a.description LIKE ?)');
      queryParams.push(searchTerm, searchTerm);
    }

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('a.subject_id = ?');
      queryParams.push(subject_id);
    }

    if (teacher_id && isValidUUID(teacher_id)) {
      whereConditions.push('a.teacher_id = ?');
      queryParams.push(teacher_id);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('a.class_id = ?');
      queryParams.push(class_id);
    }

    if (assessment_type) {
      whereConditions.push('a.assessment_type = ?');
      queryParams.push(assessment_type);
    }

    if (status) {
      whereConditions.push('a.status = ?');
      queryParams.push(status);
    }

    // Role-based access control
    if (req.user.user_type === 'teacher') {
      whereConditions.push('a.teacher_id = ?');
      queryParams.push(req.user.teacher_id);
    } else if (req.user.user_type === 'student') {
      whereConditions.push(`(
        a.status IN ('published', 'active', 'completed') AND
        (a.class_id = (SELECT current_class_id FROM students WHERE user_id = ?) OR
         a.grade_level_id = (SELECT gl.id FROM students s 
                            JOIN classes c ON s.current_class_id = c.id 
                            JOIN grade_levels gl ON c.grade_level_id = gl.id 
                            WHERE s.user_id = ?))
      )`);
      queryParams.push(req.user.id, req.user.id);
    }

    // Validate sort parameters
    const allowedSortFields = ['title', 'assessment_type', 'scheduled_date', 'total_marks', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM assessments a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get assessments
    const assessmentsQuery = `
      SELECT 
        a.id,
        a.title,
        a.description,
        a.subject_id,
        a.teacher_id,
        a.class_id,
        a.grade_level_id,
        a.academic_year_id,
        a.term_id,
        a.assessment_type,
        a.total_marks,
        a.passing_marks,
        a.duration_minutes,
        a.scheduled_date,
        a.start_time,
        a.end_time,
        a.status,
        a.is_online,
        a.created_at,
        a.updated_at,
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name,
        COUNT(DISTINCT aq.id) as total_questions,
        COUNT(DISTINCT saa.id) as total_attempts
      FROM assessments a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN grade_levels gl ON a.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      LEFT JOIN assessment_questions aq ON a.id = aq.assessment_id
      LEFT JOIN student_assessment_attempts saa ON a.id = saa.assessment_id
      WHERE ${whereClause}
      GROUP BY a.id
      ORDER BY a.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const assessments = await executeQuery(assessmentsQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Assessments retrieved successfully',
      data: {
        assessments,
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

    logger.info(`User ${req.user.id} retrieved assessments - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get assessment by ID with questions
 */
async function getAssessmentById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assessment ID format'
      });
    }

    // Get assessment details
    const assessmentQuery = `
      SELECT 
        a.id,
        a.title,
        a.description,
        a.subject_id,
        a.teacher_id,
        a.class_id,
        a.grade_level_id,
        a.academic_year_id,
        a.term_id,
        a.assessment_type,
        a.total_marks,
        a.passing_marks,
        a.duration_minutes,
        a.scheduled_date,
        a.start_time,
        a.end_time,
        a.instructions,
        a.status,
        a.is_online,
        a.created_at,
        a.updated_at,
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        t.email as teacher_email,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name
      FROM assessments a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN grade_levels gl ON a.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      WHERE a.id = ?
    `;

    const assessmentResult = await executeQuery(assessmentQuery, [id]);

    if (assessmentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    const assessment = assessmentResult[0];

    // Check access permissions
    if (req.user.user_type === 'teacher' && assessment.teacher_id !== req.user.teacher_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own assessments.'
      });
    }

    if (req.user.user_type === 'student') {
      // Students can only view published/active assessments for their class
      if (!['published', 'active', 'completed'].includes(assessment.status)) {
        return res.status(403).json({
          success: false,
          message: 'Assessment not available for students yet.'
        });
      }

      const studentClassQuery = 'SELECT current_class_id FROM students WHERE user_id = ?';
      const studentClass = await executeQuery(studentClassQuery, [req.user.id]);
      
      if (studentClass.length === 0 || 
          (assessment.class_id && assessment.class_id !== studentClass[0].current_class_id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view assessments for your class.'
        });
      }
    }

    // Get assessment questions (hide correct answers for students during active assessment)
    const includeAnswers = req.user.user_type !== 'student' || assessment.status === 'completed';
    
    const questionsQuery = `
      SELECT 
        aq.id,
        aq.question_number,
        aq.question_text,
        aq.question_type,
        aq.marks,
        aq.options,
        ${includeAnswers ? 'aq.correct_answer,' : ''}
        ${includeAnswers ? 'aq.explanation,' : ''}
        aq.created_at,
        aq.updated_at
      FROM assessment_questions aq
      WHERE aq.assessment_id = ?
      ORDER BY aq.question_number
    `;

    const questions = await executeQuery(questionsQuery, [id]);

    // Get student's attempt if student is viewing
    let studentAttempt = null;
    if (req.user.user_type === 'student') {
      const attemptQuery = `
        SELECT 
          saa.id,
          saa.attempt_number,
          saa.start_time,
          saa.end_time,
          saa.submitted_at,
          saa.total_marks_obtained,
          saa.percentage,
          saa.grade,
          saa.status,
          saa.answers,
          saa.teacher_feedback
        FROM student_assessment_attempts saa
        WHERE saa.assessment_id = ? AND saa.student_id = (SELECT id FROM students WHERE user_id = ?)
        ORDER BY saa.attempt_number DESC
        LIMIT 1
      `;

      const attemptResult = await executeQuery(attemptQuery, [id, req.user.id]);
      if (attemptResult.length > 0) {
        studentAttempt = attemptResult[0];
      }
    }

    res.json({
      success: true,
      message: 'Assessment retrieved successfully',
      data: {
        ...assessment,
        questions,
        student_attempt: studentAttempt
      }
    });

    logger.info(`User ${req.user.id} retrieved assessment ${id}`);

  } catch (error) {
    logger.error('Error retrieving assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Create new assessment
 */
async function createAssessment(req, res) {
  try {
    const {
      title,
      description,
      subject_id,
      class_id,
      grade_level_id,
      academic_year_id,
      term_id,
      assessment_type,
      total_marks,
      passing_marks,
      duration_minutes,
      scheduled_date,
      start_time,
      end_time,
      instructions,
      status = 'draft',
      is_online = false
    } = sanitizeInput(req.body);

    // Validate required fields
    if (!title || !subject_id || !academic_year_id || !assessment_type || !total_marks || !passing_marks) {
      return res.status(400).json({
        success: false,
        message: 'Title, subject, academic year, assessment type, total marks, and passing marks are required'
      });
    }

    // Validate assessment type
    const validTypes = ['quiz', 'test', 'exam', 'assignment', 'project', 'presentation'];
    if (!validTypes.includes(assessment_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assessment type'
      });
    }

    // Validate marks
    if (passing_marks > total_marks) {
      return res.status(400).json({
        success: false,
        message: 'Passing marks cannot be greater than total marks'
      });
    }

    // Get teacher ID from user
    let teacher_id;
    if (req.user.user_type === 'teacher') {
      teacher_id = req.user.teacher_id;
    } else if (req.user.user_type === 'admin') {
      if (!req.body.teacher_id || !isValidUUID(req.body.teacher_id)) {
        return res.status(400).json({
          success: false,
          message: 'Teacher ID is required when creating assessment as admin'
        });
      }
      teacher_id = req.body.teacher_id;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Only teachers and admins can create assessments'
      });
    }

    // Validate UUIDs
    const uuidFields = [
      { field: 'subject_id', value: subject_id },
      { field: 'academic_year_id', value: academic_year_id }
    ];

    if (class_id) uuidFields.push({ field: 'class_id', value: class_id });
    if (grade_level_id) uuidFields.push({ field: 'grade_level_id', value: grade_level_id });
    if (term_id) uuidFields.push({ field: 'term_id', value: term_id });

    for (const { field, value } of uuidFields) {
      if (!isValidUUID(value)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field} format`
        });
      }
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

    // Create assessment
    const insertQuery = `
      INSERT INTO assessments (
        title, description, subject_id, teacher_id, class_id, grade_level_id,
        academic_year_id, term_id, assessment_type, total_marks, passing_marks,
        duration_minutes, scheduled_date, start_time, end_time, instructions,
        status, is_online
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      title, description, subject_id, teacher_id, class_id, grade_level_id,
      academic_year_id, term_id, assessment_type, total_marks, passing_marks,
      duration_minutes, scheduled_date, start_time, end_time, instructions,
      status, is_online
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const assessmentId = result.insertId;

    // Get the created assessment with related data
    const createdAssessment = await executeQuery(`
      SELECT 
        a.id,
        a.title,
        a.description,
        a.subject_id,
        a.teacher_id,
        a.class_id,
        a.grade_level_id,
        a.academic_year_id,
        a.term_id,
        a.assessment_type,
        a.total_marks,
        a.passing_marks,
        a.duration_minutes,
        a.scheduled_date,
        a.start_time,
        a.end_time,
        a.instructions,
        a.status,
        a.is_online,
        a.created_at,
        a.updated_at,
        s.name as subject_name,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        c.name as class_name,
        gl.name as grade_level_name,
        ay.name as academic_year_name
      FROM assessments a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN grade_levels gl ON a.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      WHERE a.id = ?
    `, [assessmentId]);

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      data: createdAssessment[0]
    });

    logger.info(`User ${req.user.id} created assessment ${assessmentId} for subject ${subject_id}`);

  } catch (error) {
    logger.error('Error creating assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assessment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Add question to assessment
 */
async function addAssessmentQuestion(req, res) {
  try {
    const { id } = req.params;
    const {
      question_number,
      question_text,
      question_type,
      marks,
      options,
      correct_answer,
      explanation
    } = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assessment ID format'
      });
    }

    // Validate required fields
    if (!question_number || !question_text || !question_type || !marks) {
      return res.status(400).json({
        success: false,
        message: 'Question number, text, type, and marks are required'
      });
    }

    // Validate question type
    const validTypes = ['multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank'];
    if (!validTypes.includes(question_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question type'
      });
    }

    // Check if assessment exists
    const assessmentQuery = 'SELECT id, teacher_id, status FROM assessments WHERE id = ?';
    const assessmentResult = await executeQuery(assessmentQuery, [id]);

    if (assessmentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    const assessment = assessmentResult[0];

    // Check permissions
    if (req.user.user_type === 'teacher' && assessment.teacher_id !== req.user.teacher_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only modify your own assessments.'
      });
    }

    // Don't allow modification of published/active assessments
    if (['published', 'active', 'completed'].includes(assessment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify questions of published or active assessments'
      });
    }

    // Check for existing question with same number
    const existingQuestionQuery = `
      SELECT id FROM assessment_questions
      WHERE assessment_id = ? AND question_number = ?
    `;

    const existingQuestion = await executeQuery(existingQuestionQuery, [id, question_number]);

    if (existingQuestion.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Question number already exists for this assessment'
      });
    }

    // Validate options for multiple choice questions
    if (question_type === 'multiple_choice') {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Multiple choice questions must have at least 2 options'
        });
      }
    }

    // Create question
    const insertQuery = `
      INSERT INTO assessment_questions (
        assessment_id, question_number, question_text, question_type,
        marks, options, correct_answer, explanation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      id, question_number, question_text, question_type,
      marks, JSON.stringify(options), correct_answer, explanation
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const questionId = result.insertId;

    // Get the created question
    const createdQuestion = await executeQuery(`
      SELECT
        aq.id,
        aq.assessment_id,
        aq.question_number,
        aq.question_text,
        aq.question_type,
        aq.marks,
        aq.options,
        aq.correct_answer,
        aq.explanation,
        aq.created_at,
        aq.updated_at
      FROM assessment_questions aq
      WHERE aq.id = ?
    `, [questionId]);

    res.status(201).json({
      success: true,
      message: 'Assessment question added successfully',
      data: createdQuestion[0]
    });

    logger.info(`User ${req.user.id} added question ${questionId} to assessment ${id}`);

  } catch (error) {
    logger.error('Error adding assessment question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add assessment question',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Submit student assessment attempt
 */
async function submitAssessmentAttempt(req, res) {
  try {
    const { id } = req.params;
    const { answers } = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assessment ID format'
      });
    }

    // Only students can submit attempts
    if (req.user.user_type !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit assessment attempts'
      });
    }

    // Get student ID
    const studentQuery = 'SELECT id FROM students WHERE user_id = ?';
    const studentResult = await executeQuery(studentQuery, [req.user.id]);

    if (studentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const studentId = studentResult[0].id;

    // Check if assessment exists and is available
    const assessmentQuery = `
      SELECT
        a.id, a.title, a.status, a.total_marks, a.passing_marks,
        a.scheduled_date, a.start_time, a.end_time, a.duration_minutes
      FROM assessments a
      WHERE a.id = ? AND a.status IN ('published', 'active')
    `;

    const assessmentResult = await executeQuery(assessmentQuery, [id]);

    if (assessmentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found or not available for submission'
      });
    }

    const assessment = assessmentResult[0];

    // Check if student has already submitted
    const existingAttemptQuery = `
      SELECT id, status FROM student_assessment_attempts
      WHERE assessment_id = ? AND student_id = ? AND status = 'submitted'
    `;

    const existingAttempt = await executeQuery(existingAttemptQuery, [id, studentId]);

    if (existingAttempt.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Assessment already submitted'
      });
    }

    // Get or create attempt record
    let attemptId;
    const inProgressAttemptQuery = `
      SELECT id FROM student_assessment_attempts
      WHERE assessment_id = ? AND student_id = ? AND status = 'in_progress'
    `;

    const inProgressAttempt = await executeQuery(inProgressAttemptQuery, [id, studentId]);

    if (inProgressAttempt.length > 0) {
      attemptId = inProgressAttempt[0].id;
    } else {
      // Create new attempt
      const createAttemptQuery = `
        INSERT INTO student_assessment_attempts (
          assessment_id, student_id, attempt_number, start_time, status
        ) VALUES (?, ?, 1, NOW(), 'in_progress')
      `;

      const createResult = await executeQuery(createAttemptQuery, [id, studentId]);
      attemptId = createResult.insertId;
    }

    // Calculate score (basic implementation)
    let totalMarksObtained = 0;
    const questionsQuery = `
      SELECT id, question_number, correct_answer, marks, question_type
      FROM assessment_questions
      WHERE assessment_id = ?
      ORDER BY question_number
    `;

    const questions = await executeQuery(questionsQuery, [id]);

    for (const question of questions) {
      const studentAnswer = answers[question.question_number];
      if (studentAnswer && studentAnswer === question.correct_answer) {
        totalMarksObtained += parseFloat(question.marks);
      }
    }

    const percentage = (totalMarksObtained / assessment.total_marks) * 100;
    const grade = percentage >= (assessment.passing_marks / assessment.total_marks) * 100 ? 'Pass' : 'Fail';

    // Update attempt with submission
    const updateAttemptQuery = `
      UPDATE student_assessment_attempts
      SET
        end_time = NOW(),
        submitted_at = NOW(),
        total_marks_obtained = ?,
        percentage = ?,
        grade = ?,
        status = 'submitted',
        answers = ?
      WHERE id = ?
    `;

    await executeQuery(updateAttemptQuery, [
      totalMarksObtained, percentage, grade, JSON.stringify(answers), attemptId
    ]);

    // Get the updated attempt
    const submittedAttempt = await executeQuery(`
      SELECT
        saa.id,
        saa.attempt_number,
        saa.start_time,
        saa.end_time,
        saa.submitted_at,
        saa.total_marks_obtained,
        saa.percentage,
        saa.grade,
        saa.status,
        a.title as assessment_title,
        a.total_marks
      FROM student_assessment_attempts saa
      JOIN assessments a ON saa.assessment_id = a.id
      WHERE saa.id = ?
    `, [attemptId]);

    res.json({
      success: true,
      message: 'Assessment submitted successfully',
      data: submittedAttempt[0]
    });

    logger.info(`Student ${studentId} submitted assessment ${id} with score ${totalMarksObtained}/${assessment.total_marks}`);

  } catch (error) {
    logger.error('Error submitting assessment attempt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit assessment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getAssessments,
  getAssessmentById,
  createAssessment,
  addAssessmentQuestion,
  submitAssessmentAttempt
};
