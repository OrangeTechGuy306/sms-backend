const { executeQuery, executeTransaction } = require('../config/database');
const { hashPassword, generateRandomPassword } = require('../utils/password');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Ensure default roles exist in the database
 */
async function ensureDefaultRoles() {
  try {
    const existingRoles = await executeQuery('SELECT COUNT(*) as count FROM roles');

    if (existingRoles[0].count === 0) {
      logger.info('No roles found, inserting default roles...');

      await executeQuery(`
        INSERT IGNORE INTO roles (name, description, is_system_role, permissions) VALUES
        ('Super Admin', 'Full system access', TRUE, '["*"]'),
        ('Principal', 'School administration access', TRUE, '["users.*", "academic.*", "reports.*"]'),
        ('Vice Principal', 'Assistant administration access', TRUE, '["academic.*", "students.*", "teachers.*"]'),
        ('Teacher', 'Teaching and class management', TRUE, '["classes.*", "students.read", "grades.*", "attendance.*"]'),
        ('Student', 'Student portal access', TRUE, '["profile.read", "grades.read", "attendance.read"]'),
        ('Parent', 'Parent portal access', TRUE, '["children.*", "fees.*", "communication.*"]'),
        ('Librarian', 'Library management', TRUE, '["library.*", "books.*"]'),
        ('Accountant', 'Financial management', TRUE, '["fees.*", "payments.*", "financial_reports.*"]')
      `);

      logger.info('Default roles inserted successfully');
    }
  } catch (error) {
    logger.error('Error ensuring default roles:', error);
  }
}

/**
 * Get all admin users with pagination and filtering
 */
async function getAdmins(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      status = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    // Validate pagination parameters
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const sortField = ['first_name', 'last_name', 'created_at', 'email'].includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build where conditions
    const whereConditions = ["u.user_type = 'admin'"];
    const queryParams = [];

    if (search) {
      whereConditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (role) {
      whereConditions.push('r.name = ?');
      queryParams.push(role);
    }

    if (status) {
      whereConditions.push('u.status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get admin users
    const adminsQuery = `
      SELECT 
        u.id,
        u.uuid,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.last_login,
        u.created_at,
        GROUP_CONCAT(r.name) as roles,
        CONCAT(u.first_name, ' ', u.last_name) as full_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE ${whereClause}
      GROUP BY u.id
      ORDER BY u.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const admins = await executeQuery(adminsQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        admins,
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
    logger.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin users'
    });
  }
}

/**
 * Get admin by ID
 */
async function getAdminById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id) && !Number.isInteger(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin ID format'
      });
    }

    const adminQuery = `
      SELECT 
        u.id,
        u.uuid,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.date_of_birth,
        u.gender,
        u.address,
        u.status,
        u.last_login,
        u.created_at,
        GROUP_CONCAT(r.name) as roles,
        CONCAT(u.first_name, ' ', u.last_name) as full_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.user_type = 'admin' AND (u.id = ? OR u.uuid = ?)
      GROUP BY u.id
    `;

    const admins = await executeQuery(adminQuery, [id, id]);

    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }

    const admin = admins[0];

    res.json({
      success: true,
      data: admin
    });

  } catch (error) {
    logger.error('Get admin by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin user'
    });
  }
}

/**
 * Create new admin user
 */
async function createAdmin(req, res) {
  try {
    // Ensure default roles exist
    await ensureDefaultRoles();

    const adminData = req.body;

    // Validate required fields
    const requiredFields = ['email', 'firstName', 'lastName'];
    const missingFields = requiredFields.filter(field => !adminData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const {
      email,
      firstName,
      lastName,
      role = 'Super Admin',
      phone = '',
      generatePassword = true,
      password = ''
    } = adminData;

    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedFirstName = sanitizeInput(firstName);
    const sanitizedLastName = sanitizeInput(lastName);
    const sanitizedPhone = sanitizeInput(phone);

    // Check if email already exists
    const existingUser = await executeQuery('SELECT id FROM users WHERE email = ?', [sanitizedEmail]);
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Generate or validate password
    const finalPassword = generatePassword ? generateRandomPassword() : password;
    if (!finalPassword || finalPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const hashedPassword = await hashPassword(finalPassword);
    const userUuid = uuidv4();

    // Check if the role exists
    const roleResult = await executeQuery('SELECT id FROM roles WHERE name = ? LIMIT 1', [role]);
    if (roleResult.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Role "${role}" not found. Available roles: Super Admin, Principal, Vice Principal, Teacher, Student, Parent, Librarian, Accountant`
      });
    }

    const roleId = roleResult[0].id;

    // Create user and assign admin role in transaction
    const queries = [
      {
        query: `INSERT INTO users (uuid, email, password_hash, user_type, first_name, last_name, phone, status, email_verified) VALUES (?, ?, ?, 'admin', ?, ?, ?, 'active', TRUE)`,
        params: [userUuid, sanitizedEmail, hashedPassword, sanitizedFirstName, sanitizedLastName, sanitizedPhone]
      },
      {
        query: `INSERT INTO user_roles (user_id, role_id) VALUES (LAST_INSERT_ID(), ?)`,
        params: [roleId]
      }
    ];

    await executeTransaction(queries);

    // Get the created admin
    const newAdmin = await executeQuery('SELECT id, uuid FROM users WHERE email = ?', [sanitizedEmail]);

    logger.info(`Admin user created: ${sanitizedEmail} by user ${req.user?.id || 'system'}`);

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: newAdmin[0].id,
        uuid: newAdmin[0].uuid,
        email: sanitizedEmail,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        role,
        ...(generatePassword && { temporaryPassword: finalPassword })
      }
    });

  } catch (error) {
    logger.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin user'
    });
  }
}

/**
 * Update admin user
 */
async function updateAdmin(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!isValidUUID(id) && !Number.isInteger(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin ID format'
      });
    }

    // Check if admin exists
    const existingAdmin = await executeQuery('SELECT id FROM users WHERE (id = ? OR uuid = ?) AND user_type = "admin"', [id, id]);
    if (existingAdmin.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }

    const userId = existingAdmin[0].id;

    // Build update query
    const allowedFields = ['first_name', 'last_name', 'phone', 'email', 'status'];
    const updateFields = [];
    const queryParams = [];

    Object.keys(updates)
      .filter(key => allowedFields.includes(key) && updates[key] !== undefined)
      .forEach(key => {
        updateFields.push(`${key} = ?`);
        queryParams.push(sanitizeInput(updates[key]));
      });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await executeQuery(updateQuery, [...queryParams, userId]);

    logger.info(`Admin user updated: ${userId} by user ${req.user?.id || 'system'}`);

    res.json({
      success: true,
      message: 'Admin user updated successfully'
    });

  } catch (error) {
    logger.error('Update admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin user'
    });
  }
}

/**
 * Delete admin user
 */
async function deleteAdmin(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id) && !Number.isInteger(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin ID format'
      });
    }

    // Check if admin exists
    const existingAdmin = await executeQuery('SELECT id FROM users WHERE (id = ? OR uuid = ?) AND user_type = "admin"', [id, id]);
    if (existingAdmin.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }

    const userId = existingAdmin[0].id;

    // Prevent self-deletion
    if (req.user && req.user.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own admin account'
      });
    }

    // Delete user (cascade will handle user_roles)
    await executeQuery('DELETE FROM users WHERE id = ?', [userId]);

    logger.info(`Admin user deleted: ${userId} by user ${req.user?.id || 'system'}`);

    res.json({
      success: true,
      message: 'Admin user deleted successfully'
    });

  } catch (error) {
    logger.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin user'
    });
  }
}

module.exports = {
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin
};
