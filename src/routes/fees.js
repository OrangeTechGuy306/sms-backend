const express = require('express');
const { body, query } = require('express-validator');
const {
  getFeeTypes,
  createFeeType,
  getStudentFees,
  assignFeeToStudent,
  recordPayment,
  getPaymentHistory
} = require('../controllers/feeController');
const { authenticate, authorize, checkResourceOwnership } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/fees/types
 * @desc    Get all fee types with pagination and filtering
 * @access  Private (Admin)
 */
router.get('/types', [
  authorize(['admin']),
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
  query('grade_level_id')
    .optional()
    .isUUID()
    .withMessage('Grade level ID must be a valid UUID'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  query('frequency')
    .optional()
    .isIn(['one_time', 'monthly', 'termly', 'yearly'])
    .withMessage('Frequency must be one_time, monthly, termly, or yearly'),
  query('is_mandatory')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Is mandatory must be true or false'),
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  query('sort_by')
    .optional()
    .isIn(['name', 'amount', 'due_date', 'created_at'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getFeeTypes);

/**
 * @route   POST /api/fees/types
 * @desc    Create new fee type
 * @access  Private (Admin only)
 */
router.post('/types', [
  authorize(['admin']),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Fee type name is required and must be less than 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  validationRules.amount(),
  body('isMandatory')
    .optional()
    .isBoolean()
    .withMessage('Is mandatory must be a boolean'),
  body('frequency')
    .optional()
    .isIn(['one_time', 'monthly', 'termly', 'yearly'])
    .withMessage('Frequency must be one_time, monthly, termly, or yearly'),
  body('gradeLevelId')
    .optional()
    .isUUID()
    .withMessage('Grade level ID must be a valid UUID'),
  body('academicYearId')
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be in valid ISO format'),
  handleValidationErrors
], createFeeType);

/**
 * @route   GET /api/fees/student/:studentId
 * @desc    Get student fees
 * @access  Private (Admin, Student themselves, Parents)
 */
router.get('/student/:studentId', [
  validationRules.uuid('studentId'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['pending', 'partial', 'paid', 'overdue', 'waived'])
    .withMessage('Status must be pending, partial, paid, overdue, or waived'),
  handleValidationErrors,
  checkResourceOwnership('studentId', 'student')
], getStudentFees);

/**
 * @route   POST /api/fees/assign
 * @desc    Assign fee to student
 * @access  Private (Admin only)
 */
router.post('/assign', [
  authorize(['admin']),
  body('studentId')
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  body('feeTypeId')
    .isUUID()
    .withMessage('Fee type ID must be a valid UUID'),
  validationRules.amount(),
  body('discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a positive number'),
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be in valid ISO format'),
  handleValidationErrors
], assignFeeToStudent);

/**
 * @route   POST /api/fees/payment
 * @desc    Record fee payment
 * @access  Private (Admin only)
 */
router.post('/payment', [
  authorize(['admin']),
  body('studentFeeId')
    .isUUID()
    .withMessage('Student fee ID must be a valid UUID'),
  validationRules.amount(),
  body('paymentMethod')
    .isIn(['cash', 'bank_transfer', 'cheque', 'card', 'online'])
    .withMessage('Payment method must be cash, bank_transfer, cheque, card, or online'),
  body('transactionReference')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Transaction reference must be less than 255 characters'),
  body('paymentDate')
    .isISO8601()
    .withMessage('Payment date must be in valid ISO format'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks must be less than 1000 characters'),
  handleValidationErrors
], recordPayment);

/**
 * @route   GET /api/fees/payments/:studentId
 * @desc    Get payment history for a student
 * @access  Private (Admin, Student themselves, Parents)
 */
router.get('/payments/:studentId', [
  validationRules.uuid('studentId'),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200'),
  handleValidationErrors,
  checkResourceOwnership('studentId', 'student')
], getPaymentHistory);

/**
 * @route   POST /api/fees/bulk-assign
 * @desc    Bulk assign fees to students
 * @access  Private (Admin only)
 */
router.post('/bulk-assign', [
  authorize(['admin']),
  body('feeTypeId')
    .isUUID()
    .withMessage('Fee type ID must be a valid UUID'),
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('Student IDs must be a non-empty array'),
  body('studentIds.*')
    .isUUID()
    .withMessage('Each student ID must be a valid UUID'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a positive number'),
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be in valid ISO format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeTransaction } = require('../config/database');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');

    const { feeTypeId, studentIds, amount, discount = 0, dueDate } = sanitizeInput(req.body);
    const finalAmount = amount - discount;

    // Prepare bulk insert queries
    const queries = studentIds.map(studentId => ({
      query: `
        INSERT INTO student_fees (student_id, fee_type_id, amount, discount, final_amount, due_date, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
        ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        discount = VALUES(discount),
        final_amount = VALUES(final_amount),
        due_date = VALUES(due_date),
        updated_at = CURRENT_TIMESTAMP
      `,
      params: [studentId, feeTypeId, amount, discount, finalAmount, dueDate]
    }));

    await executeTransaction(queries);

    logger.info(`Bulk fee assignment: ${studentIds.length} students by user ${req.user.id}`);

    res.json({
      success: true,
      message: `Fee assigned to ${studentIds.length} students successfully`
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Bulk assign fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign fees to students'
    });
  }
});

/**
 * @route   GET /api/fees/report/outstanding
 * @desc    Get outstanding fees report
 * @access  Private (Admin only)
 */
router.get('/report/outstanding', [
  authorize(['admin']),
  query('academic_year_id')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  query('class_id')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  query('grade_level_id')
    .optional()
    .isUUID()
    .withMessage('Grade level ID must be a valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { academic_year_id, class_id, grade_level_id } = req.query;

    let whereConditions = ['sf.status IN ("pending", "partial", "overdue")'];
    let queryParams = [];

    if (academic_year_id) {
      whereConditions.push('ft.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    if (class_id) {
      whereConditions.push('s.current_class_id = ?');
      queryParams.push(class_id);
    }

    if (grade_level_id) {
      whereConditions.push('c.grade_level_id = ?');
      queryParams.push(grade_level_id);
    }

    const whereClause = whereConditions.join(' AND ');

    const reportQuery = `
      SELECT
        s.id as student_id,
        s.student_id as student_number,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        c.name as class_name,
        gl.name as grade_level,
        ft.name as fee_type,
        sf.final_amount,
        COALESCE((SELECT SUM(fp.amount) FROM fee_payments fp WHERE fp.student_fee_id = sf.id), 0) as paid_amount,
        (sf.final_amount - COALESCE((SELECT SUM(fp.amount) FROM fee_payments fp WHERE fp.student_fee_id = sf.id), 0)) as outstanding_amount,
        sf.due_date,
        sf.status,
        DATEDIFF(CURDATE(), sf.due_date) as days_overdue
      FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      JOIN fee_types ft ON sf.fee_type_id = ft.id
      LEFT JOIN classes c ON s.current_class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      WHERE ${whereClause}
      ORDER BY sf.due_date ASC, s.first_name, s.last_name
    `;

    const report = await executeQuery(reportQuery, queryParams);

    // Calculate summary
    const summaryQuery = `
      SELECT
        COUNT(*) as total_outstanding_fees,
        COUNT(DISTINCT sf.student_id) as students_with_outstanding,
        SUM(sf.final_amount - COALESCE((SELECT SUM(fp.amount) FROM fee_payments fp WHERE fp.student_fee_id = sf.id), 0)) as total_outstanding_amount,
        SUM(CASE WHEN sf.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count
      FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      JOIN fee_types ft ON sf.fee_type_id = ft.id
      LEFT JOIN classes c ON s.current_class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      WHERE ${whereClause}
    `;

    const summary = await executeQuery(summaryQuery, queryParams);

    res.json({
      success: true,
      data: {
        report,
        summary: summary[0]
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get outstanding fees report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate outstanding fees report'
    });
  }
});

/**
 * @route   GET /api/fees/statistics
 * @desc    Get fee statistics
 * @access  Private (Admin)
 */
router.get('/statistics', [
  authorize(['admin']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');

    // Get fee collection statistics
    const [feeStats] = await executeQuery(`
      SELECT
        SUM(CASE WHEN sf.status = 'paid' THEN ft.amount ELSE 0 END) as total_collected,
        SUM(CASE WHEN sf.status IN ('pending', 'overdue') THEN ft.amount ELSE 0 END) as total_outstanding,
        SUM(CASE WHEN sf.status = 'overdue' THEN ft.amount ELSE 0 END) as overdue_amount,
        COUNT(CASE WHEN sf.status = 'paid' THEN 1 END) as paid_students,
        COUNT(CASE WHEN sf.status IN ('pending', 'overdue') THEN 1 END) as pending_students
      FROM student_fees sf
      JOIN fee_types ft ON sf.fee_type_id = ft.id
      WHERE sf.academic_year_id = (SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1)
    `);

    // Calculate collection rate
    const totalAmount = (feeStats.total_collected || 0) + (feeStats.total_outstanding || 0);
    const collectionRate = totalAmount > 0 ? (feeStats.total_collected / totalAmount) * 100 : 0;

    const statistics = {
      total_collected: feeStats.total_collected || 0,
      total_outstanding: feeStats.total_outstanding || 0,
      overdue_amount: feeStats.overdue_amount || 0,
      paid_students: feeStats.paid_students || 0,
      pending_students: feeStats.pending_students || 0,
      collection_rate: Math.round(collectionRate * 100) / 100
    };

    res.json({
      success: true,
      message: 'Fee statistics retrieved successfully',
      data: statistics
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get fee statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve fee statistics'
    });
  }
});

/**
 * @route   POST /api/fees/:id/mark-paid
 * @desc    Mark fee as paid
 * @access  Private (Admin)
 */
router.post('/:id/mark-paid', [
  authorize(['admin']),
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { id } = req.params;

    // Update fee status to paid
    await executeQuery(`
      UPDATE student_fees
      SET status = 'paid', payment_date = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Fee marked as paid successfully'
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Mark fee as paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark fee as paid'
    });
  }
});

module.exports = router;
