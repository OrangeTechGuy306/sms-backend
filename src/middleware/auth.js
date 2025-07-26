const { verifyAccessToken, extractTokenFromHeader } = require('../utils/jwt');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database to ensure they still exist and are active
    const userQuery = `
      SELECT id, email, user_type, status, last_login
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

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      userType: user.user_type,
      status: user.status,
      lastLogin: user.last_login
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.message === 'Token expired') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}

/**
 * Authorization middleware factory
 * Creates middleware that checks if user has required role(s)
 * @param {String|Array} allowedRoles - Role(s) that can access the route
 */
function authorize(allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userRole = req.user.userType;
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!roles.includes(userRole)) { 
        logger.warn(`Unauthorized access attempt by user ${req.user.id} with role ${userRole} to route requiring ${roles.join(', ')}`);
        
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        }); 
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is provided, but doesn't require it
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return next();
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const userQuery = `
      SELECT id, email, user_type, status, last_login
      FROM users 
      WHERE id = ? AND status = 'active'
    `;
    
    const users = await executeQuery(userQuery, [decoded.userId]);
    
    if (users.length > 0) {
      const user = users[0];
      req.user = {
        id: user.id,
        email: user.email,
        userType: user.user_type,
        status: user.status,
        lastLogin: user.last_login
      };
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on token errors
    logger.debug('Optional auth failed:', error.message);
    next();
  }
}

/**
 * Resource ownership middleware
 * Checks if user owns the resource or has admin privileges
 * @param {String} resourceIdParam - Parameter name containing resource ID
 * @param {String} resourceType - Type of resource (student, teacher, etc.)
 */
function checkResourceOwnership(resourceIdParam, resourceType) {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;
      const userType = req.user.userType;

      // Admins can access any resource
      if (userType === 'admin') {
        return next();
      }

      let ownershipQuery;
      let queryParams;

      switch (resourceType) {
        case 'student':
          if (userType === 'student') {
            ownershipQuery = 'SELECT id FROM students WHERE id = ? AND user_id = ?';
            queryParams = [resourceId, userId];
          } else if (userType === 'parent') {
            ownershipQuery = `
              SELECT s.id FROM students s
              JOIN student_parents sp ON s.id = sp.student_id
              JOIN parents p ON sp.parent_id = p.id
              WHERE s.id = ? AND p.user_id = ?
            `;
            queryParams = [resourceId, userId];
          } else if (userType === 'teacher') {
            ownershipQuery = `
              SELECT DISTINCT s.id FROM students s
              JOIN classes c ON s.current_class_id = c.id
              JOIN teacher_subjects ts ON c.id = ts.class_id
              JOIN teachers t ON ts.teacher_id = t.id
              WHERE s.id = ? AND t.user_id = ?
            `;
            queryParams = [resourceId, userId];
          }
          break;

        case 'teacher':
          if (userType === 'teacher') {
            ownershipQuery = 'SELECT id FROM teachers WHERE id = ? AND user_id = ?';
            queryParams = [resourceId, userId];
          }
          break;

        case 'parent':
          if (userType === 'parent') {
            ownershipQuery = 'SELECT id FROM parents WHERE id = ? AND user_id = ?';
            queryParams = [resourceId, userId];
          }
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid resource type'
          });
      }

      if (!ownershipQuery) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const results = await executeQuery(ownershipQuery, queryParams);

      if (results.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - resource not found or not owned'
        });
      }

      next();
    } catch (error) {
      logger.error('Resource ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Access check failed'
      });
    }
  };
}

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  checkResourceOwnership
};
