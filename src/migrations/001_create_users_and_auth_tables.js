const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const up = async () => {
  logger.info('Creating users and authentication tables...');

  // Users table - main user table for all user types
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      user_type ENUM('admin', 'teacher', 'student', 'parent') NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      date_of_birth DATE,
      gender ENUM('male', 'female', 'other'),
      address TEXT,
      profile_picture VARCHAR(255),
      status ENUM('active', 'inactive', 'suspended', 'graduated') DEFAULT 'active',
      email_verified BOOLEAN DEFAULT FALSE,
      last_login TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_email (email),
      INDEX idx_user_type (user_type),
      INDEX idx_status (status),
      INDEX idx_uuid (uuid),
      INDEX idx_name (first_name, last_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Roles table for role-based access control
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      permissions JSON,
      is_system_role BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // User roles junction table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      role_id INT NOT NULL,
      assigned_by INT,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE KEY unique_user_role (user_id, role_id),
      INDEX idx_user_id (user_id),
      INDEX idx_role_id (role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Password reset tokens
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_user_id (user_id),
      INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Email verification tokens
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // User sessions for tracking active sessions
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      session_token VARCHAR(255) NOT NULL UNIQUE,
      ip_address VARCHAR(45),
      user_agent TEXT,
      expires_at TIMESTAMP NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_session_token (session_token),
      INDEX idx_user_id (user_id),
      INDEX idx_expires_at (expires_at),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Insert default roles
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

  logger.info('Users and authentication tables created successfully');
};

const down = async () => {
  logger.info('Dropping users and authentication tables...');
  
  await executeQuery('DROP TABLE IF EXISTS user_sessions');
  await executeQuery('DROP TABLE IF EXISTS email_verification_tokens');
  await executeQuery('DROP TABLE IF EXISTS password_reset_tokens');
  await executeQuery('DROP TABLE IF EXISTS user_roles');
  await executeQuery('DROP TABLE IF EXISTS roles');
  await executeQuery('DROP TABLE IF EXISTS users');
  
  logger.info('Users and authentication tables dropped');
};

module.exports = { up, down };
