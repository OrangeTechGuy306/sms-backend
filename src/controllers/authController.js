const { executeQuery, executeTransaction } = require('../config/database');
const { hashPassword, comparePassword, generatePasswordResetToken, generateEmailVerificationToken } = require('../utils/password');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { sanitizeInput } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * User login
 */
async function login(req, res) {
  try {
    const { email, password } = sanitizeInput(req.body);

    // Get user with password hash
    const userQuery = `
      SELECT id, email, password_hash, user_type, first_name, last_name, status, last_login
      FROM users
      WHERE email = ?
    `;
    
    const users = await executeQuery(userQuery, [email]);
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await executeQuery(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Get user profile based on user type
    let profile = null;
    switch (user.user_type) {
      case 'student':
        const studentQuery = `
          SELECT s.*, c.name as class_name
          FROM students s
          LEFT JOIN classes c ON s.class_id = c.id
          WHERE s.user_id = ?
        `;
        const students = await executeQuery(studentQuery, [user.id]);
        profile = students[0] || null;
        break;

      case 'teacher':
        const teacherQuery = `
          SELECT t.*
          FROM teachers t
          WHERE t.user_id = ?
        `;
        const teachers = await executeQuery(teacherQuery, [user.id]);
        profile = teachers[0] || null;
        break;

      case 'admin':
        // For admin users, get their roles from user_roles table
        const adminQuery = `
          SELECT
            u.first_name,
            u.last_name,
            u.phone,
            u.email,
            GROUP_CONCAT(r.name) as roles
          FROM users u
          LEFT JOIN user_roles ur ON u.id = ur.user_id
          LEFT JOIN roles r ON ur.role_id = r.id
          WHERE u.id = ?
          GROUP BY u.id
        `;
        const admins = await executeQuery(adminQuery, [user.id]);
        profile = admins[0] || null;
        break;

      case 'parent':
        const parentQuery = 'SELECT * FROM parents WHERE user_id = ?';
        const parents = await executeQuery(parentQuery, [user.id]);
        profile = parents[0] || null;
        break;
    }

    logger.info(`User ${user.email} logged in successfully`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name || profile?.first_name || '',
          last_name: user.last_name || profile?.last_name || '',
          user_type: user.user_type,
          status: user.status,
          profile
        }
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
}

/**
 * Refresh access token
 */
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user from database
    const userQuery = `
      SELECT id, email, user_type, status
      FROM users 
      WHERE id = ? AND status = 'active'
    `;
    
    const users = await executeQuery(userQuery, [decoded.userId]);
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const user = users[0];

    // Generate new tokens
    const tokens = generateTokenPair(user);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
}

/**
 * Get current user profile
 */
async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    // Get user basic info
    const userQuery = `
      SELECT id, email, user_type, status, last_login, created_at
      FROM users 
      WHERE id = ?
    `;
    
    const users = await executeQuery(userQuery, [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Get detailed profile based on user type
    let profile = null;
    switch (userType) {
      case 'student':
        const studentQuery = `
          SELECT s.*, c.name as class_name, gl.name as grade_level, ay.name as academic_year
          FROM students s
          LEFT JOIN classes c ON s.current_class_id = c.id
          LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
          LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
          WHERE s.user_id = ?
        `;
        const students = await executeQuery(studentQuery, [userId]);
        profile = students[0] || null;
        break;

      case 'teacher':
        const teacherQuery = `
          SELECT t.*, d.name as department_name
          FROM teachers t
          LEFT JOIN departments d ON t.department_id = d.id
          WHERE t.user_id = ?
        `;
        const teachers = await executeQuery(teacherQuery, [userId]);
        profile = teachers[0] || null;
        break;

      case 'admin':
        const adminQuery = 'SELECT * FROM admins WHERE user_id = ?';
        const admins = await executeQuery(adminQuery, [userId]);
        profile = admins[0] || null;
        break;

      case 'parent':
        const parentQuery = `
          SELECT p.*, 
                 GROUP_CONCAT(CONCAT(s.first_name, ' ', s.last_name) SEPARATOR ', ') as children_names
          FROM parents p
          LEFT JOIN student_parents sp ON p.id = sp.parent_id
          LEFT JOIN students s ON sp.student_id = s.id
          WHERE p.user_id = ?
          GROUP BY p.id
        `;
        const parents = await executeQuery(parentQuery, [userId]);
        profile = parents[0] || null;
        break;
    }

    res.json({
      success: true,
      data: {
        user,
        profile
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
}

/**
 * Update user profile
 */
async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const updates = sanitizeInput(req.body);

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updates.password;
    delete updates.email;
    delete updates.user_type;
    delete updates.status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Update profile based on user type
    let updateQuery;
    let queryParams;

    switch (userType) {
      case 'student':
        const studentFields = ['first_name', 'last_name', 'middle_name', 'phone', 'address'];
        const studentUpdates = Object.keys(updates)
          .filter(key => studentFields.includes(key))
          .map(key => `${key} = ?`);
        
        if (studentUpdates.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No valid student fields to update'
          });
        }

        updateQuery = `
          UPDATE students 
          SET ${studentUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `;
        queryParams = [
          ...Object.keys(updates)
            .filter(key => studentFields.includes(key))
            .map(key => updates[key]),
          userId
        ];
        break;

      case 'teacher':
        const teacherFields = ['first_name', 'last_name', 'middle_name', 'phone', 'address', 'qualification', 'specialization'];
        const teacherUpdates = Object.keys(updates)
          .filter(key => teacherFields.includes(key))
          .map(key => `${key} = ?`);
        
        if (teacherUpdates.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No valid teacher fields to update'
          });
        }

        updateQuery = `
          UPDATE teachers 
          SET ${teacherUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `;
        queryParams = [
          ...Object.keys(updates)
            .filter(key => teacherFields.includes(key))
            .map(key => updates[key]),
          userId
        ];
        break;

      case 'admin':
        const adminFields = ['first_name', 'last_name', 'phone'];
        const adminUpdates = Object.keys(updates)
          .filter(key => adminFields.includes(key))
          .map(key => `${key} = ?`);
        
        if (adminUpdates.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No valid admin fields to update'
          });
        }

        updateQuery = `
          UPDATE admins 
          SET ${adminUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `;
        queryParams = [
          ...Object.keys(updates)
            .filter(key => adminFields.includes(key))
            .map(key => updates[key]),
          userId
        ];
        break;

      case 'parent':
        const parentFields = ['first_name', 'last_name', 'phone', 'work_phone', 'address', 'occupation'];
        const parentUpdates = Object.keys(updates)
          .filter(key => parentFields.includes(key))
          .map(key => `${key} = ?`);
        
        if (parentUpdates.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No valid parent fields to update'
          });
        }

        updateQuery = `
          UPDATE parents 
          SET ${parentUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `;
        queryParams = [
          ...Object.keys(updates)
            .filter(key => parentFields.includes(key))
            .map(key => updates[key]),
          userId
        ];
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type'
        });
    }

    await executeQuery(updateQuery, queryParams);

    logger.info(`User ${userId} updated profile`);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
}

module.exports = {
  login,
  refreshToken,
  getProfile,
  updateProfile
};
