const express = require('express');
const { body, query, param } = require('express-validator');
const {
  getStudents,
  getStudentById,
  getStudentAcademicData,
  createStudent,
  updateStudent,
  deleteStudent
} = require('../controllers/studentController');
const { authenticate, authorize, checkResourceOwnership } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/students
 * @desc    Get all students with pagination and filtering
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
  query('class_id')
    .optional()
    .custom((value) => {
      if (!value) return true;
      // Accept UUID format
      if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return true;
      }
      // Accept integer format
      if (/^\d+$/.test(String(value))) {
        return true;
      }
      throw new Error('Class ID must be a valid UUID or integer');
    }),
  query('grade_level_id')
    .optional()
    .custom((value) => {
      if (!value) return true;
      // Accept UUID format
      if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return true;
      }
      // Accept integer format
      if (/^\d+$/.test(String(value))) {
        return true;
      }
      throw new Error('Grade level ID must be a valid UUID or integer');
    }),
  query('status')
    .optional()
    .isIn(['active', 'graduated', 'transferred', 'suspended', 'expelled'])
    .withMessage('Invalid status value'),
  query('sort_by')
    .optional()
    .isIn(['first_name', 'last_name', 'student_id', 'admission_date', 'created_at'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], getStudents);

/**
 * @route   POST /api/students
 * @desc    Create new student
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
  validationRules.dateOfBirth(),
  validationRules.gender(),
  body('bloodGroup')
    .optional()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group'),
  body('nationality')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Nationality must be less than 100 characters'),
  body('religion')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Religion must be less than 100 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  validationRules.phone(),
  body('emergencyContactName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Emergency contact name must be less than 200 characters'),
  body('emergencyContactPhone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid emergency contact phone'),
  body('emergencyContactRelationship')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Emergency contact relationship must be less than 100 characters'),
  body('admissionDate')
    .isISO8601()
    .withMessage('Please provide a valid admission date'),
  body('admissionNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Admission number must be less than 50 characters'),
  body('currentClassId')
    .custom((value) => {
      // Accept UUID, integer, or non-empty string for class ID
      if (!value) {
        throw new Error('Current class ID is required');
      }

      // Convert to string for validation
      const strValue = String(value).trim();

      if (strValue.length === 0) {
        throw new Error('Current class ID cannot be empty');
      }

      // Accept UUID format
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strValue)) {
        return true;
      }

      // Accept integer format
      if (/^\d+$/.test(strValue)) {
        return true;
      }

      // Accept any non-empty string as fallback
      return true;
    })
    .withMessage('Current class ID must be a valid identifier'),
  body('academicYearId')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  body('medicalConditions')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Medical conditions must be less than 1000 characters'),
  body('allergies')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Allergies must be less than 1000 characters'),
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
], createStudent);

/**
 * @route   GET /api/students/:id
 * @desc    Get student by ID
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/:id', [
  validationRules.id('id'),
  handleValidationErrors,
  checkResourceOwnership('id', 'student')
], getStudentById);

/**
 * @route   GET /api/students/:id/academic
 * @desc    Get student academic data (grades, attendance)
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/:id/academic', [
  validationRules.id('id'),
  handleValidationErrors,
  checkResourceOwnership('id', 'student')
], getStudentAcademicData);

/**
 * @route   PUT /api/students/:id
 * @desc    Update student
 * @access  Private (Admin, Student themselves for limited fields)
 */
router.put('/:id', [
  validationRules.id('id'),
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
  body('status')
    .optional()
    .isIn(['active', 'graduated', 'transferred', 'suspended', 'expelled'])
    .withMessage('Invalid status value'),
  handleValidationErrors,
  checkResourceOwnership('id', 'student')
], updateStudent);

/**
 * @route   DELETE /api/students/:id
 * @desc    Delete student
 * @access  Private (Admin only)
 */
router.delete('/:id', [
  authorize(['admin']),
  validationRules.id('id'),
  handleValidationErrors
], deleteStudent);

/**
 * @route   POST /api/students/bulk-delete
 * @desc    Delete multiple students
 * @access  Private (Admin only)
 */
router.post('/bulk-delete', [
  authorize(['admin']),
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('Student IDs must be a non-empty array'),
  body('studentIds.*')
    .custom((value) => {
      // Accept UUID format
      if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return true;
      }
      // Accept integer format
      if (/^\d+$/.test(String(value))) {
        return true;
      }
      throw new Error('Each student ID must be a valid UUID or integer');
    }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery, executeTransaction } = require('../config/database');
    const { sanitizeInput } = require('../utils/validation');
    const logger = require('../utils/logger');

    const { studentIds } = sanitizeInput(req.body);

    // Check for dependencies for all students
    const placeholders = studentIds.map(() => '?').join(',');
    const dependencyChecks = [
      { table: 'student_results', message: 'Some students have academic results' },
      { table: 'attendance', message: 'Some students have attendance records' },
      { table: 'student_fees', message: 'Some students have fee records' }
    ];

    for (const check of dependencyChecks) {
      const result = await executeQuery(
        `SELECT COUNT(*) as count FROM ${check.table} WHERE student_id IN (${placeholders})`,
        studentIds
      );
      if (result[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete students: ${check.message}`
        });
      }
    }

    // Get user IDs for the students
    const userIdsResult = await executeQuery(
      `SELECT user_id FROM students WHERE id IN (${placeholders})`,
      studentIds
    );
    const userIds = userIdsResult.map(row => row.user_id);

    // Delete students and users
    const queries = [
      { query: `DELETE FROM students WHERE id IN (${placeholders})`, params: studentIds },
      { query: `DELETE FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`, params: userIds }
    ];

    await executeTransaction(queries);

    logger.info(`Bulk delete: ${studentIds.length} students deleted by user ${req.user.id}`);

    res.json({
      success: true,
      message: `${studentIds.length} students deleted successfully`
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Bulk delete students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete students'
    });
  }
});

/**
 * @route   GET /api/students/:id/documents
 * @desc    Get student documents
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/:id/documents', [
  validationRules.id('id'),
  handleValidationErrors,
  checkResourceOwnership('id', 'student')
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { id } = req.params;

    const documentsQuery = `
      SELECT
        f.id,
        f.filename,
        f.original_filename,
        f.file_size,
        f.mime_type,
        f.file_type,
        f.description,
        f.is_public,
        f.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.related_to_type = 'student' AND f.related_to_id = ?
      ORDER BY f.created_at DESC
    `;

    const documents = await executeQuery(documentsQuery, [id]);

    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get student documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student documents'
    });
  }
});

/**
 * @route   POST /api/students/bulk
 * @desc    Create multiple students in bulk
 * @access  Private (Admin only)
 */
router.post('/bulk', [
  authorize(['admin']),
  body('students')
    .isArray({ min: 1, max: 100 })
    .withMessage('Students must be a non-empty array with maximum 100 students'),
  body('students.*.email')
    .isEmail()
    .withMessage('Each student must have a valid email'),
  body('students.*.firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each student must have a valid first name (1-100 characters)')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('students.*.lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each student must have a valid last name (1-100 characters)')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('students.*.dateOfBirth')
    .isISO8601()
    .withMessage('Each student must have a valid date of birth in ISO format'),
  body('students.*.gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Each student must have a valid gender'),
  body('students.*.classId')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID if provided'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeTransaction, executeQuery, generateId } = require('../config/database');
    const bcrypt = require('bcrypt');
    const { students } = req.body;
    const logger = require('../utils/logger');

    // Check for duplicate emails in the request
    const emails = students.map(s => s.email.toLowerCase());
    const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
    if (duplicateEmails.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Duplicate emails found in request: ${duplicateEmails.join(', ')}`
      });
    }

    // Check for existing emails in database
    const existingUsers = await executeQuery(`
      SELECT email FROM users WHERE email IN (${emails.map(() => '?').join(',')})
    `, emails);

    if (existingUsers.length > 0) {
      const existingEmails = existingUsers.map(u => u.email);
      return res.status(400).json({
        success: false,
        message: `The following emails already exist: ${existingEmails.join(', ')}`
      });
    }

    const results = await executeTransaction(async (connection) => {
      const createdStudents = [];
      const errors = [];

      for (let i = 0; i < students.length; i++) {
        const studentData = students[i];

        try {
          // Generate student ID
          const studentIdNumber = await generateStudentId(connection);

          // Hash default password (student can change it later)
          const defaultPassword = 'student123'; // Should be configurable
          const passwordHash = await bcrypt.hash(defaultPassword, 10);

          // Create user first
          const [userResult] = await connection.execute(`
            INSERT INTO users (
              id, email, password_hash, role, first_name, last_name,
              status, created_at, updated_at
            ) VALUES (?, ?, ?, 'student', ?, ?, 'active', NOW(), NOW())
          `, [
            generateId(),
            studentData.email.toLowerCase(),
            passwordHash,
            studentData.firstName,
            studentData.lastName
          ]);

          // Create student record
          const studentId = generateId();
          const [studentResult] = await connection.execute(`
            INSERT INTO students (
              id, user_id, student_id, first_name, last_name, middle_name,
              date_of_birth, gender, blood_group, nationality, religion,
              class_id, admission_date, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active', NOW(), NOW())
          `, [
            studentId,
            userResult.insertId,
            studentIdNumber,
            studentData.firstName,
            studentData.lastName,
            studentData.middleName || null,
            studentData.dateOfBirth,
            studentData.gender,
            studentData.bloodGroup || null,
            studentData.nationality || null,
            studentData.religion || null,
            studentData.classId || null
          ]);

          // Add contact information if provided
          if (studentData.phone || studentData.address) {
            await connection.execute(`
              INSERT INTO student_contacts (
                id, student_id, phone, address, emergency_contact_name,
                emergency_contact_phone, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
              generateId(),
              studentId,
              studentData.phone || null,
              studentData.address || null,
              studentData.emergencyContactName || null,
              studentData.emergencyContactPhone || null
            ]);
          }

          createdStudents.push({
            id: studentId,
            user_id: userResult.insertId,
            student_id: studentIdNumber,
            email: studentData.email,
            first_name: studentData.firstName,
            last_name: studentData.lastName,
            default_password: defaultPassword
          });

        } catch (error) {
          logger.error(`Error creating student ${i + 1}:`, error);
          errors.push({
            index: i + 1,
            email: studentData.email,
            error: error.message
          });
        }
      }

      if (errors.length > 0 && createdStudents.length === 0) {
        throw new Error(`Failed to create any students. Errors: ${JSON.stringify(errors)}`);
      }

      return { createdStudents, errors };
    });

    logger.info(`Bulk student creation completed by user ${req.user.id}. Created: ${results.createdStudents.length}, Errors: ${results.errors.length}`);

    const response = {
      success: true,
      message: `Successfully created ${results.createdStudents.length} students`,
      data: {
        created_students: results.createdStudents,
        total_created: results.createdStudents.length,
        total_requested: students.length
      }
    };

    if (results.errors.length > 0) {
      response.message += ` with ${results.errors.length} errors`;
      response.data.errors = results.errors;
    }

    res.status(201).json(response);

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Bulk create students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create students in bulk',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to generate student ID
async function generateStudentId(connection) {
  const currentYear = new Date().getFullYear();
  const yearSuffix = currentYear.toString().slice(-2);

  // Get the last student ID for this year
  const [lastStudent] = await connection.execute(`
    SELECT student_id FROM students
    WHERE student_id LIKE ?
    ORDER BY student_id DESC
    LIMIT 1
  `, [`${yearSuffix}%`]);

  let nextNumber = 1;
  if (lastStudent && lastStudent.student_id) {
    const lastNumber = parseInt(lastStudent.student_id.slice(2));
    nextNumber = lastNumber + 1;
  }

  return `${yearSuffix}${nextNumber.toString().padStart(4, '0')}`;
}

/**
 * @route   GET /api/students/class/:classId
 * @desc    Get students by class ID
 * @access  Private (Admin, Teacher)
 */
router.get('/class/:classId', [
  authorize(['admin', 'teacher']),
  validationRules.id('classId'),
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
  query('status')
    .optional()
    .isIn(['active', 'graduated', 'transferred', 'suspended', 'expelled'])
    .withMessage('Invalid status value'),
  query('sort_by')
    .optional()
    .isIn(['first_name', 'last_name', 'student_id', 'admission_date'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { classId } = req.params;
    const {
      page = 1,
      limit = 50,
      search = '',
      status = 'active',
      sort_by = 'first_name',
      sort_order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logger = require('../utils/logger');

    // Build search conditions
    let searchCondition = '';
    let searchParams = [];

    if (search) {
      searchCondition = `
        AND (
          u.first_name LIKE ? OR
          u.last_name LIKE ? OR
          s.student_id LIKE ? OR
          u.email LIKE ?
        )
      `;
      const searchTerm = `%${search}%`;
      searchParams = [searchTerm, searchTerm, searchTerm, searchTerm];
    }

    // Get students in the class
    const studentsQuery = `
      SELECT
        s.id,
        s.student_id,
        u.first_name,
        u.last_name,
        u.email,
        s.date_of_birth,
        s.gender,
        s.blood_group,
        s.admission_date,
        s.status,
        c.name as class_name,
        gl.name as grade_level,
        s.created_at,
        s.updated_at
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      WHERE s.class_id = ?
        AND s.status = ?
        ${searchCondition}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `;

    const queryParams = [classId, status, ...searchParams, parseInt(limit), offset];
    const students = await executeQuery(studentsQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.class_id = ?
        AND s.status = ?
        ${searchCondition}
    `;

    const countParams = [classId, status, ...searchParams];
    const [{ total }] = await executeQuery(countQuery, countParams);

    // Get class information
    const classInfo = await executeQuery(`
      SELECT
        c.id,
        c.name,
        c.capacity,
        c.room_number,
        gl.name as grade_level,
        ay.name as academic_year,
        CONCAT(tu.first_name, ' ', tu.last_name) as class_teacher
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
      LEFT JOIN users tu ON t.user_id = tu.id
      WHERE c.id = ?
    `, [classId]);

    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    logger.info(`Retrieved ${students.length} students for class ${classId} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Students retrieved successfully',
      data: students,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      },
      class_info: classInfo[0] || null,
      filters: {
        search,
        status,
        sort_by,
        sort_order
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get students by class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve students for class'
    });
  }
});

/**
 * @route   POST /api/students/import
 * @desc    Import students from CSV/Excel
 * @access  Private (Admin only)
 */
router.post('/import', [
  authorize(['admin']),
  // File upload validation would be handled by multer middleware
], async (req, res) => {
  try {
    // This would be implemented with multer for file upload
    // and a CSV/Excel parser for processing the data
    res.json({
      success: true,
      message: 'Student import functionality - To be implemented with file upload'
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Import students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import students'
    });
  }
});

/**
 * @route   GET /api/students/export
 * @desc    Export students data
 * @access  Private (Admin, Teacher)
 */
router.get('/export', [
  authorize(['admin', 'teacher']),
  query('format')
    .optional()
    .isIn(['csv', 'excel', 'pdf'])
    .withMessage('Format must be csv, excel, or pdf'),
  query('class_id')
    .optional()
    .custom((value) => {
      if (!value) return true;
      // Accept UUID format
      if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return true;
      }
      // Accept integer format
      if (/^\d+$/.test(String(value))) {
        return true;
      }
      throw new Error('Class ID must be a valid UUID or integer');
    }),
  query('grade_level_id')
    .optional()
    .custom((value) => {
      if (!value) return true;
      // Accept UUID format
      if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return true;
      }
      // Accept integer format
      if (/^\d+$/.test(String(value))) {
        return true;
      }
      throw new Error('Grade level ID must be a valid UUID or integer');
    }),
  handleValidationErrors
], async (req, res) => {
  try {
    // This would generate and return the export file
    res.json({
      success: true,
      message: 'Student export functionality - To be implemented with file generation'
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Export students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export students'
    });
  }
});

module.exports = router;
