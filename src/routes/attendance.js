const express = require('express');
const { body, query } = require('express-validator');
const {
  getAttendance,
  markAttendance,
  updateAttendance,
  getStudentAttendance,
  getClassAttendance,
  bulkMarkAttendance
} = require('../controllers/attendanceController');
const { authenticate, authorize, checkResourceOwnership } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/attendance
 * @desc    Get attendance records with pagination and filtering
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
  query('student_id')
    .optional()
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in valid ISO format'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be in valid ISO format'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be in valid ISO format'),
  query('status')
    .optional()
    .isIn(['present', 'absent', 'late', 'excused'])
    .withMessage('Status must be present, absent, late, or excused'),
  query('sort_by')
    .optional()
    .isIn(['date', 'student_name', 'status', 'created_at'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getAttendance);

/**
 * @route   POST /api/attendance
 * @desc    Mark attendance
 * @access  Private (Admin, Teacher)
 */
router.post('/', [
  authorize(['admin', 'teacher']),
  body('studentId')
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  body('classId')
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  validationRules.attendanceDate(),
  validationRules.attendanceStatus(),
  body('timeIn')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time in must be in HH:MM format'),
  body('timeOut')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time out must be in HH:MM format'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks must be less than 500 characters'),
  handleValidationErrors
], markAttendance);

/**
 * @route   PUT /api/attendance/:id
 * @desc    Update attendance record
 * @access  Private (Admin, Teacher)
 */
router.put('/:id', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('id'),
  body('status')
    .optional()
    .isIn(['present', 'absent', 'late', 'excused'])
    .withMessage('Status must be present, absent, late, or excused'),
  body('timeIn')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time in must be in HH:MM format'),
  body('timeOut')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time out must be in HH:MM format'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks must be less than 500 characters'),
  handleValidationErrors
], updateAttendance);

/**
 * @route   GET /api/attendance/student/:studentId
 * @desc    Get student attendance history
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/student/:studentId', [
  validationRules.uuid('studentId'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be in valid ISO format'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be in valid ISO format'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200'),
  handleValidationErrors,
  checkResourceOwnership('studentId', 'student')
], getStudentAttendance);

/**
 * @route   GET /api/attendance/class/:classId
 * @desc    Get class attendance for a specific date
 * @access  Private (Admin, Teacher)
 */
router.get('/class/:classId', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('classId'),
  query('date')
    .notEmpty()
    .isISO8601()
    .withMessage('Date is required and must be in valid ISO format'),
  handleValidationErrors
], getClassAttendance);

/**
 * @route   POST /api/attendance/bulk
 * @desc    Bulk mark attendance for a class
 * @access  Private (Admin, Teacher)
 */
router.post('/bulk', [
  authorize(['admin', 'teacher']),
  body('classId')
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  body('date')
    .isISO8601()
    .withMessage('Date must be in valid ISO format'),
  body('attendanceRecords')
    .isArray({ min: 1 })
    .withMessage('Attendance records must be a non-empty array'),
  body('attendanceRecords.*.studentId')
    .isUUID()
    .withMessage('Each record must have a valid student ID'),
  body('attendanceRecords.*.status')
    .isIn(['present', 'absent', 'late', 'excused'])
    .withMessage('Each record must have a valid status'),
  body('attendanceRecords.*.timeIn')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time in must be in HH:MM format'),
  body('attendanceRecords.*.timeOut')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time out must be in HH:MM format'),
  body('attendanceRecords.*.remarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks must be less than 500 characters'),
  handleValidationErrors
], bulkMarkAttendance);

/**
 * @route   GET /api/attendance/report/class/:classId
 * @desc    Get attendance report for a class
 * @access  Private (Admin, Teacher)
 */
router.get('/report/class/:classId', [
  authorize(['admin', 'teacher']),
  validationRules.uuid('classId'),
  query('date_from')
    .notEmpty()
    .isISO8601()
    .withMessage('Date from is required and must be in valid ISO format'),
  query('date_to')
    .notEmpty()
    .isISO8601()
    .withMessage('Date to is required and must be in valid ISO format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { classId } = req.params;
    const { date_from, date_to } = req.query;

    // Get attendance summary for each student in the class
    const reportQuery = `
      SELECT
        s.id as student_id,
        s.student_id as student_number,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        COUNT(a.id) as total_marked_days,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_days,
        ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(a.id)) * 100, 2) as attendance_percentage
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date BETWEEN ? AND ?
      WHERE s.current_class_id = ? AND s.status = 'active'
      GROUP BY s.id
      ORDER BY s.first_name, s.last_name
    `;

    const report = await executeQuery(reportQuery, [date_from, date_to, classId]);

    // Get class summary
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT s.id) as total_students,
        COUNT(a.id) as total_attendance_records,
        AVG(CASE WHEN a.status = 'present' THEN 100 ELSE 0 END) as class_average_attendance
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date BETWEEN ? AND ?
      WHERE s.current_class_id = ? AND s.status = 'active'
    `;

    const summary = await executeQuery(summaryQuery, [date_from, date_to, classId]);

    res.json({
      success: true,
      data: {
        period: { from: date_from, to: date_to },
        report,
        summary: summary[0]
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate attendance report'
    });
  }
});

/**
 * @route   GET /api/attendance/statistics
 * @desc    Get attendance statistics
 * @access  Private (Admin, Teacher)
 */
router.get('/statistics', [
  authorize(['admin', 'teacher']),
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be in valid ISO format'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be in valid ISO format'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { class_id, date_from, date_to, academic_year_id } = req.query;
    const logger = require('../utils/logger');

    // Build WHERE conditions
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (class_id) {
      whereConditions.push('a.class_id = ?');
      queryParams.push(class_id);
    }

    if (date_from) {
      whereConditions.push('a.date >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('a.date <= ?');
      queryParams.push(date_to);
    }

    if (academic_year_id) {
      whereConditions.push('c.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Overall attendance statistics
    const overallStats = await executeQuery(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT a.student_id) as total_students,
        COUNT(DISTINCT a.class_id) as total_classes,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
        ROUND(
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(*), 0), 2
        ) as attendance_rate,
        ROUND(
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(*), 0), 2
        ) as absence_rate
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
    `, queryParams);

    // Daily attendance trends (last 30 days or specified range)
    const trendsQuery = `
      SELECT
        DATE(a.date) as attendance_date,
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        ROUND(
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(*), 0), 2
        ) as daily_attendance_rate
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
        ${!date_from && !date_to ? 'AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)' : ''}
      GROUP BY DATE(a.date)
      ORDER BY attendance_date DESC
      LIMIT 30
    `;

    const dailyTrends = await executeQuery(trendsQuery, queryParams);

    // Class-wise statistics
    const classStats = await executeQuery(`
      SELECT
        c.id as class_id,
        c.name as class_name,
        COUNT(*) as total_records,
        COUNT(DISTINCT a.student_id) as student_count,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        ROUND(
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(*), 0), 2
        ) as class_attendance_rate
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
      GROUP BY c.id, c.name
      ORDER BY class_attendance_rate DESC
    `, queryParams);

    // Students with poor attendance (below 75%)
    const poorAttendanceStudents = await executeQuery(`
      SELECT
        s.id as student_id,
        u.first_name,
        u.last_name,
        s.student_id as student_number,
        c.name as class_name,
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND(
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(*), 0), 2
        ) as attendance_rate
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
      GROUP BY s.id, u.first_name, u.last_name, s.student_id, c.name
      HAVING attendance_rate < 75
      ORDER BY attendance_rate ASC
      LIMIT 20
    `, queryParams);

    logger.info(`Attendance statistics retrieved for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Attendance statistics retrieved successfully',
      data: {
        overall: overallStats[0] || {
          total_records: 0,
          total_students: 0,
          total_classes: 0,
          present_count: 0,
          absent_count: 0,
          late_count: 0,
          excused_count: 0,
          attendance_rate: 0,
          absence_rate: 0
        },
        daily_trends: dailyTrends,
        class_statistics: classStats,
        poor_attendance_students: poorAttendanceStudents,
        summary: {
          date_range: {
            from: date_from || 'All time',
            to: date_to || 'Present'
          },
          filters_applied: {
            class_id: class_id || null,
            academic_year_id: academic_year_id || null
          }
        }
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get attendance statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance statistics'
    });
  }
});

module.exports = router;
