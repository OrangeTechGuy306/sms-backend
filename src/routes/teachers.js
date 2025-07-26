const express = require('express');
const { body, query, param } = require('express-validator');
const {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher
} = require('../controllers/teacherController');
const { authenticate, authorize, checkResourceOwnership } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/teachers
 * @desc    Get all teachers with pagination and filtering
 * @access  Private (Admin, Teacher)
 */
router.get('/', [
  authorize(['admin', 'teacher']),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('department_id')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['active', 'on_leave', 'resigned', 'terminated'])
    .withMessage('Invalid status value'),
  query('sort_by')
    .optional()
    .isIn(['first_name', 'last_name', 'teacher_id', 'joining_date', 'created_at'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getTeachers);

/**
 * @route   POST /api/teachers
 * @desc    Create new teacher
 * @access  Private (Admin only)
 */
router.post('/', [
  authorize(['admin']),
  validationRules.email(),
  validationRules.firstName(),
  validationRules.lastName(),
  body('middleName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Middle name must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]*$/)
    .withMessage('Middle name can only contain letters, spaces, hyphens, and apostrophes'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  validationRules.phone(),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('qualification')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Qualification must be less than 255 characters'),
  body('experienceYears')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50'),
  body('specialization')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Specialization must be less than 255 characters'),
  body('joiningDate')
    .isISO8601()
    .withMessage('Please provide a valid joining date'),
  body('salary')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Salary must be a positive number'),
  body('departmentId')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  body('generatePassword')
    .optional()
    .isBoolean()
    .withMessage('Generate password must be a boolean'),
  body('password')
    .if(body('generatePassword').equals(false))
    .notEmpty()
    .withMessage('Password is required when not generating automatically')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters'),
  handleValidationErrors
], createTeacher);

/**
 * @route   GET /api/teachers/:id
 * @desc    Get teacher by ID
 * @access  Private (Admin, Teacher themselves)
 */
router.get('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors,
  checkResourceOwnership('id', 'teacher')
], getTeacherById);

/**
 * @route   PUT /api/teachers/:id
 * @desc    Update teacher
 * @access  Private (Admin, Teacher themselves for limited fields)
 */
router.put('/:id', [
  validationRules.uuid('id'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('middleName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Middle name must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]*$/)
    .withMessage('Middle name can only contain letters, spaces, hyphens, and apostrophes'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('qualification')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Qualification must be less than 255 characters'),
  body('experienceYears')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50'),
  body('specialization')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Specialization must be less than 255 characters'),
  body('status')
    .optional()
    .isIn(['active', 'on_leave', 'resigned', 'terminated'])
    .withMessage('Invalid status value'),
  handleValidationErrors,
  checkResourceOwnership('id', 'teacher')
], updateTeacher);

/**
 * @route   DELETE /api/teachers/:id
 * @desc    Delete teacher
 * @access  Private (Admin only)
 */
router.delete('/:id', [
  authorize(['admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], deleteTeacher);

/**
 * @route   GET /api/teachers/:id/schedule
 * @desc    Get teacher schedule/timetable
 * @access  Private (Admin, Teacher themselves)
 */
router.get('/:id/schedule', [
  validationRules.uuid('id'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  query('term_id')
    .optional()
    .isUUID()
    .withMessage('Term ID must be a valid UUID'),
  handleValidationErrors,
  checkResourceOwnership('id', 'teacher')
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { id } = req.params;
    const { academic_year_id, term_id } = req.query;

    let whereConditions = ['tt.teacher_id = ?'];
    let queryParams = [id];

    if (academic_year_id) {
      whereConditions.push('tt.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    if (term_id) {
      whereConditions.push('tt.term_id = ?');
      queryParams.push(term_id);
    }

    const scheduleQuery = `
      SELECT
        tt.id,
        s.name as subject_name,
        s.code as subject_code,
        c.name as class_name,
        gl.name as grade_level,
        ts.name as time_slot_name,
        ts.start_time,
        ts.end_time,
        ts.day_of_week,
        tt.room_number,
        tt.effective_from,
        tt.effective_to,
        tt.status,
        ay.name as academic_year,
        t.name as term_name
      FROM timetables tt
      JOIN subjects s ON tt.subject_id = s.id
      JOIN classes c ON tt.class_id = c.id
      JOIN grade_levels gl ON c.grade_level_id = gl.id
      JOIN time_slots ts ON tt.time_slot_id = ts.id
      JOIN academic_years ay ON tt.academic_year_id = ay.id
      LEFT JOIN terms t ON tt.term_id = t.id
      WHERE ${whereConditions.join(' AND ')} AND tt.status = 'active'
      ORDER BY
        FIELD(ts.day_of_week, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
        ts.start_time
    `;

    const schedule = await executeQuery(scheduleQuery, queryParams);

    res.json({
      success: true,
      data: schedule
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get teacher schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve teacher schedule'
    });
  }
});

/**
 * @route   GET /api/teachers/:id/assignments
 * @desc    Get teacher's assignments (subjects and classes)
 * @access  Private (Admin, Teacher themselves)
 */
router.get('/:id/assignments', [
  validationRules.uuid('id'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'completed'])
    .withMessage('Status must be active, inactive, or completed'),
  handleValidationErrors,
  checkResourceOwnership('id', 'teacher')
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { id } = req.params;
    const { academic_year_id, status = 'active' } = req.query;
    const logger = require('../utils/logger');

    let whereConditions = ['ta.teacher_id = ?', 'ta.status = ?'];
    let queryParams = [id, status];

    if (academic_year_id) {
      whereConditions.push('ta.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get teacher assignments with detailed information
    const assignments = await executeQuery(`
      SELECT
        ta.id as assignment_id,
        ta.subject_id,
        s.name as subject_name,
        s.code as subject_code,
        s.credit_hours,
        s.is_core,
        ta.class_id,
        c.name as class_name,
        c.room_number,
        c.capacity,
        gl.name as grade_level,
        ta.is_primary,
        ta.academic_year_id,
        ay.name as academic_year,
        ay.start_date as year_start,
        ay.end_date as year_end,
        ta.status as assignment_status,
        ta.assigned_date,
        ta.created_at,
        ta.updated_at,
        -- Count of students in the class
        (SELECT COUNT(*) FROM students st WHERE st.current_class_id = c.id AND st.status = 'active') as student_count,
        -- Department information
        d.name as department_name
      FROM teacher_assignments ta
      JOIN subjects s ON ta.subject_id = s.id
      JOIN classes c ON ta.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON ta.academic_year_id = ay.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE ${whereClause}
      ORDER BY ay.start_date DESC, gl.name ASC, s.name ASC
    `, queryParams);

    // Get summary statistics
    const summaryStats = await executeQuery(`
      SELECT
        COUNT(*) as total_assignments,
        COUNT(DISTINCT ta.subject_id) as unique_subjects,
        COUNT(DISTINCT ta.class_id) as unique_classes,
        SUM(CASE WHEN ta.is_primary = true THEN 1 ELSE 0 END) as primary_assignments,
        SUM(s.credit_hours) as total_credit_hours
      FROM teacher_assignments ta
      JOIN subjects s ON ta.subject_id = s.id
      WHERE ${whereClause}
    `, queryParams);

    // Get workload by day (if timetable data exists)
    const weeklyWorkload = await executeQuery(`
      SELECT
        tp.day_of_week,
        COUNT(*) as periods_count,
        GROUP_CONCAT(DISTINCT s.name) as subjects
      FROM teacher_assignments ta
      JOIN timetable_periods tp ON ta.subject_id = tp.subject_id AND ta.teacher_id = tp.teacher_id
      JOIN subjects s ON ta.subject_id = s.id
      WHERE ${whereClause}
      GROUP BY tp.day_of_week
      ORDER BY
        CASE tp.day_of_week
          WHEN 'monday' THEN 1
          WHEN 'tuesday' THEN 2
          WHEN 'wednesday' THEN 3
          WHEN 'thursday' THEN 4
          WHEN 'friday' THEN 5
          WHEN 'saturday' THEN 6
          WHEN 'sunday' THEN 7
        END
    `, queryParams);

    // Get recent assignment changes
    const recentChanges = await executeQuery(`
      SELECT
        ta.id as assignment_id,
        s.name as subject_name,
        c.name as class_name,
        ta.status,
        ta.updated_at,
        'assignment' as change_type
      FROM teacher_assignments ta
      JOIN subjects s ON ta.subject_id = s.id
      JOIN classes c ON ta.class_id = c.id
      WHERE ta.teacher_id = ?
        AND ta.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY ta.updated_at DESC
      LIMIT 10
    `, [id]);

    logger.info(`Retrieved ${assignments.length} assignments for teacher ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Teacher assignments retrieved successfully',
      data: {
        assignments,
        summary: summaryStats[0] || {
          total_assignments: 0,
          unique_subjects: 0,
          unique_classes: 0,
          primary_assignments: 0,
          total_credit_hours: 0
        },
        weekly_workload: weeklyWorkload,
        recent_changes: recentChanges,
        filters: {
          academic_year_id: academic_year_id || null,
          status
        }
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get teacher assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve teacher assignments'
    });
  }
});

/**
 * @route   GET /api/teachers/:id/subjects
 * @desc    Get teacher's assigned subjects
 * @access  Private (Admin, Teacher themselves)
 */
router.get('/:id/subjects', [
  validationRules.uuid('id'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  handleValidationErrors,
  checkResourceOwnership('id', 'teacher')
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { id } = req.params;
    const { academic_year_id } = req.query;

    let whereConditions = ['ts.teacher_id = ?'];
    let queryParams = [id];

    if (academic_year_id) {
      whereConditions.push('ts.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    const subjectsQuery = `
      SELECT
        s.id as subject_id,
        s.name as subject_name,
        s.code as subject_code,
        s.description as subject_description,
        c.id as class_id,
        c.name as class_name,
        gl.name as grade_level,
        ts.is_primary,
        ay.name as academic_year,
        COUNT(st.id) as student_count
      FROM teacher_subjects ts
      JOIN subjects s ON ts.subject_id = s.id
      JOIN classes c ON ts.class_id = c.id
      JOIN grade_levels gl ON c.grade_level_id = gl.id
      JOIN academic_years ay ON ts.academic_year_id = ay.id
      LEFT JOIN students st ON c.id = st.current_class_id AND st.status = 'active'
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY s.id, c.id, ts.id
      ORDER BY s.name, c.name
    `;

    const subjects = await executeQuery(subjectsQuery, queryParams);

    res.json({
      success: true,
      data: subjects
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get teacher subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve teacher subjects'
    });
  }
});

/**
 * @route   POST /api/teachers/:id/subjects
 * @desc    Assign subject to teacher
 * @access  Private (Admin only)
 */
router.post('/:id/subjects', [
  authorize(['admin']),
  validationRules.uuid('id'),
  body('subjectId')
    .isUUID()
    .withMessage('Subject ID must be a valid UUID'),
  body('classId')
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  body('academicYearId')
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  body('isPrimary')
    .optional()
    .isBoolean()
    .withMessage('Is primary must be a boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');

    const { id } = req.params;
    const { subjectId, classId, academicYearId, isPrimary = true } = sanitizeInput(req.body);

    // Check if teacher exists
    const teacherExists = await executeQuery('SELECT id FROM teachers WHERE id = ?', [id]);
    if (teacherExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Check if assignment already exists
    const existingAssignment = await executeQuery(
      'SELECT id FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ? AND class_id = ? AND academic_year_id = ?',
      [id, subjectId, classId, academicYearId]
    );

    if (existingAssignment.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Teacher is already assigned to this subject and class'
      });
    }

    // Create assignment
    await executeQuery(
      'INSERT INTO teacher_subjects (teacher_id, subject_id, class_id, academic_year_id, is_primary) VALUES (?, ?, ?, ?, ?)',
      [id, subjectId, classId, academicYearId, isPrimary]
    );

    logger.info(`Subject assigned to teacher: ${id} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Subject assigned to teacher successfully'
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Assign subject to teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign subject to teacher'
    });
  }
});

/**
 * @route   DELETE /api/teachers/:id/subjects/:assignmentId
 * @desc    Remove subject assignment from teacher
 * @access  Private (Admin only)
 */
router.delete('/:id/subjects/:assignmentId', [
  authorize(['admin']),
  validationRules.uuid('id'),
  param('assignmentId')
    .isUUID()
    .withMessage('Assignment ID must be a valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const logger = require('../utils/logger');

    const { id, assignmentId } = req.params;

    // Check if assignment exists and belongs to the teacher
    const assignment = await executeQuery(
      'SELECT id FROM teacher_subjects WHERE id = ? AND teacher_id = ?',
      [assignmentId, id]
    );

    if (assignment.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Delete assignment
    await executeQuery('DELETE FROM teacher_subjects WHERE id = ?', [assignmentId]);

    logger.info(`Subject assignment removed from teacher: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Subject assignment removed successfully'
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Remove subject assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove subject assignment'
    });
  }
});

module.exports = router;
