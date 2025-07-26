const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all fee types with pagination and filtering
 */
async function getFeeTypes(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      grade_level_id = '',
      academic_year_id = '',
      frequency = '',
      is_mandatory = '',
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
      whereConditions.push('(ft.name LIKE ? OR ft.description LIKE ?)');
      queryParams.push(searchTerm, searchTerm);
    }

    if (grade_level_id && isValidUUID(grade_level_id)) {
      whereConditions.push('ft.grade_level_id = ?');
      queryParams.push(grade_level_id);
    }

    if (academic_year_id && isValidUUID(academic_year_id)) {
      whereConditions.push('ft.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    if (frequency) {
      whereConditions.push('ft.frequency = ?');
      queryParams.push(frequency);
    }

    if (is_mandatory !== '') {
      whereConditions.push('ft.is_mandatory = ?');
      queryParams.push(is_mandatory === 'true');
    }

    if (status) {
      whereConditions.push('ft.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['name', 'amount', 'due_date', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'name';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM fee_types ft
      LEFT JOIN grade_levels gl ON ft.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON ft.academic_year_id = ay.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get fee types
    const feeTypesQuery = `
      SELECT 
        ft.id,
        ft.name,
        ft.description,
        ft.amount,
        ft.is_mandatory,
        ft.frequency,
        ft.due_date,
        ft.status,
        ft.created_at,
        gl.name as grade_level,
        ay.name as academic_year,
        (SELECT COUNT(*) FROM student_fees sf WHERE sf.fee_type_id = ft.id) as assigned_students
      FROM fee_types ft
      LEFT JOIN grade_levels gl ON ft.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON ft.academic_year_id = ay.id
      WHERE ${whereClause}
      ORDER BY ft.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const feeTypes = await executeQuery(feeTypesQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        feeTypes,
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
    logger.error('Get fee types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve fee types'
    });
  }
}

/**
 * Create new fee type
 */
async function createFeeType(req, res) {
  try {
    const feeData = sanitizeInput(req.body);
    
    const {
      name,
      description = '',
      amount,
      isMandatory = true,
      frequency = 'termly',
      gradeLevelId = null,
      academicYearId,
      dueDate = null
    } = feeData;

    // Validate required fields
    if (!name || !amount || !academicYearId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, amount, academicYearId'
      });
    }

    // Create fee type
    const insertQuery = `
      INSERT INTO fee_types (name, description, amount, is_mandatory, frequency, grade_level_id, academic_year_id, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    const result = await executeQuery(insertQuery, [
      name, description, amount, isMandatory, frequency, gradeLevelId, academicYearId, dueDate
    ]);

    logger.info(`Fee type created: ${name} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Fee type created successfully',
      data: {
        feeTypeId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Create fee type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create fee type'
    });
  }
}

/**
 * Get student fees
 */
async function getStudentFees(req, res) {
  try {
    const { studentId } = req.params;
    const { academic_year_id, status } = req.query;

    if (!isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    let whereConditions = ['sf.student_id = ?'];
    let queryParams = [studentId];

    if (academic_year_id && isValidUUID(academic_year_id)) {
      whereConditions.push('ft.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    if (status) {
      whereConditions.push('sf.status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    const feesQuery = `
      SELECT 
        sf.id,
        sf.amount,
        sf.discount,
        sf.final_amount,
        sf.due_date,
        sf.status,
        sf.created_at,
        ft.name as fee_type_name,
        ft.description as fee_type_description,
        ft.frequency,
        ft.is_mandatory,
        ay.name as academic_year,
        (SELECT COALESCE(SUM(fp.amount), 0) FROM fee_payments fp WHERE fp.student_fee_id = sf.id) as paid_amount,
        (sf.final_amount - COALESCE((SELECT SUM(fp.amount) FROM fee_payments fp WHERE fp.student_fee_id = sf.id), 0)) as balance
      FROM student_fees sf
      JOIN fee_types ft ON sf.fee_type_id = ft.id
      JOIN academic_years ay ON ft.academic_year_id = ay.id
      WHERE ${whereClause}
      ORDER BY sf.due_date ASC, ft.name
    `;

    const fees = await executeQuery(feesQuery, queryParams);

    // Calculate summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_fees,
        SUM(sf.final_amount) as total_amount,
        SUM(COALESCE((SELECT SUM(fp.amount) FROM fee_payments fp WHERE fp.student_fee_id = sf.id), 0)) as total_paid,
        SUM(sf.final_amount - COALESCE((SELECT SUM(fp.amount) FROM fee_payments fp WHERE fp.student_fee_id = sf.id), 0)) as total_balance,
        SUM(CASE WHEN sf.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN sf.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN sf.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count
      FROM student_fees sf
      JOIN fee_types ft ON sf.fee_type_id = ft.id
      WHERE ${whereClause}
    `;

    const summary = await executeQuery(summaryQuery, queryParams);

    res.json({
      success: true,
      data: {
        fees,
        summary: summary[0]
      }
    });

  } catch (error) {
    logger.error('Get student fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student fees'
    });
  }
}

/**
 * Assign fee to student
 */
async function assignFeeToStudent(req, res) {
  try {
    const feeData = sanitizeInput(req.body);
    
    const {
      studentId,
      feeTypeId,
      amount,
      discount = 0,
      dueDate
    } = feeData;

    // Validate required fields
    if (!studentId || !feeTypeId || !amount || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, feeTypeId, amount, dueDate'
      });
    }

    // Check if fee is already assigned to student
    const existingFee = await executeQuery(
      'SELECT id FROM student_fees WHERE student_id = ? AND fee_type_id = ?',
      [studentId, feeTypeId]
    );

    if (existingFee.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Fee is already assigned to this student'
      });
    }

    const finalAmount = amount - discount;

    // Create student fee
    const insertQuery = `
      INSERT INTO student_fees (student_id, fee_type_id, amount, discount, final_amount, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    const result = await executeQuery(insertQuery, [
      studentId, feeTypeId, amount, discount, finalAmount, dueDate
    ]);

    logger.info(`Fee assigned to student ${studentId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Fee assigned to student successfully',
      data: {
        studentFeeId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Assign fee to student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign fee to student'
    });
  }
}

/**
 * Record fee payment
 */
async function recordPayment(req, res) {
  try {
    const paymentData = sanitizeInput(req.body);
    
    const {
      studentFeeId,
      amount,
      paymentMethod,
      transactionReference = '',
      paymentDate,
      remarks = ''
    } = paymentData;

    // Validate required fields
    if (!studentFeeId || !amount || !paymentMethod || !paymentDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentFeeId, amount, paymentMethod, paymentDate'
      });
    }

    // Get student fee details
    const studentFeeQuery = `
      SELECT sf.*, 
             (sf.final_amount - COALESCE((SELECT SUM(fp.amount) FROM fee_payments fp WHERE fp.student_fee_id = sf.id), 0)) as balance
      FROM student_fees sf 
      WHERE sf.id = ?
    `;

    const studentFees = await executeQuery(studentFeeQuery, [studentFeeId]);

    if (studentFees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student fee not found'
      });
    }

    const studentFee = studentFees[0];

    if (amount > studentFee.balance) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds outstanding balance'
      });
    }

    // Record payment and update fee status in transaction
    const newBalance = studentFee.balance - amount;
    const newStatus = newBalance <= 0 ? 'paid' : (newBalance < studentFee.final_amount ? 'partial' : 'pending');

    const queries = [
      {
        query: `INSERT INTO fee_payments (student_fee_id, amount, payment_method, transaction_reference, payment_date, received_by, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [studentFeeId, amount, paymentMethod, transactionReference, paymentDate, req.user.id, remarks]
      },
      {
        query: `UPDATE student_fees SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params: [newStatus, studentFeeId]
      }
    ];

    const results = await executeTransaction(queries);

    logger.info(`Payment recorded for student fee ${studentFeeId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paymentId: results[0].insertId,
        newBalance,
        newStatus
      }
    });

  } catch (error) {
    logger.error('Record payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment'
    });
  }
}

/**
 * Get payment history
 */
async function getPaymentHistory(req, res) {
  try {
    const { studentId } = req.params;
    const { academic_year_id, limit = 50 } = req.query;

    if (!isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    let whereConditions = ['sf.student_id = ?'];
    let queryParams = [studentId];

    if (academic_year_id && isValidUUID(academic_year_id)) {
      whereConditions.push('ft.academic_year_id = ?');
      queryParams.push(academic_year_id);
    }

    const whereClause = whereConditions.join(' AND ');

    const paymentsQuery = `
      SELECT 
        fp.id,
        fp.amount,
        fp.payment_method,
        fp.transaction_reference,
        fp.payment_date,
        fp.remarks,
        fp.created_at,
        ft.name as fee_type_name,
        sf.final_amount as fee_amount,
        CONCAT(u.first_name, ' ', u.last_name) as received_by_name
      FROM fee_payments fp
      JOIN student_fees sf ON fp.student_fee_id = sf.id
      JOIN fee_types ft ON sf.fee_type_id = ft.id
      LEFT JOIN users u ON fp.received_by = u.id
      WHERE ${whereClause}
      ORDER BY fp.payment_date DESC, fp.created_at DESC
      LIMIT ?
    `;

    const payments = await executeQuery(paymentsQuery, [...queryParams, parseInt(limit)]);

    // Calculate payment summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_payments,
        SUM(fp.amount) as total_amount_paid,
        MIN(fp.payment_date) as first_payment_date,
        MAX(fp.payment_date) as last_payment_date
      FROM fee_payments fp
      JOIN student_fees sf ON fp.student_fee_id = sf.id
      JOIN fee_types ft ON sf.fee_type_id = ft.id
      WHERE ${whereClause}
    `;

    const summary = await executeQuery(summaryQuery, queryParams);

    res.json({
      success: true,
      data: {
        payments,
        summary: summary[0]
      }
    });

  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment history'
    });
  }
}

module.exports = {
  getFeeTypes,
  createFeeType,
  getStudentFees,
  assignFeeToStudent,
  recordPayment,
  getPaymentHistory
};
