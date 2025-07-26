const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Muhammedokoh1050',
  database: process.env.DB_NAME || 'school_management_system',
  charset: 'utf8mb4',
  timezone: '+00:00'
};

async function runMigrations() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');
    
    // Create migrations table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Migrations table created');
    
    // Migration 1: Users and Auth Tables
    console.log('Running migration 1: Users and Auth Tables...');
    
    // Users table
    await connection.execute(`
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
    
    // Roles table
    await connection.execute(`
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
    
    // Insert default roles
    await connection.execute(`
      INSERT IGNORE INTO roles (name, description, is_system_role, permissions) VALUES
      ('Super Admin', 'Full system access', TRUE, '["*"]'),
      ('Principal', 'School administration access', TRUE, '["users.*", "academic.*", "reports.*"]'),
      ('Teacher', 'Teaching and class management', TRUE, '["classes.*", "students.read", "grades.*", "attendance.*"]'),
      ('Student', 'Student portal access', TRUE, '["profile.read", "grades.read", "attendance.read"]'),
      ('Parent', 'Parent portal access', TRUE, '["children.*", "fees.*", "communication.*"]')
    `);
    
    // Record migration
    await connection.execute(
      'INSERT IGNORE INTO migrations (filename) VALUES (?)',
      ['001_create_users_and_auth_tables.js']
    );
    
    console.log('✅ Migration 1 completed');
    
    // Migration 2: Academic Structure
    console.log('Running migration 2: Academic Structure...');
    
    // Academic years table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_current BOOLEAN DEFAULT FALSE,
        status ENUM('active', 'completed', 'upcoming') DEFAULT 'upcoming',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name),
        INDEX idx_is_current (is_current),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Subjects table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) UNIQUE,
        description TEXT,
        department VARCHAR(100),
        grade_levels JSON,
        credit_hours INT DEFAULT 1,
        is_mandatory BOOLEAN DEFAULT TRUE,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_uuid (uuid),
        INDEX idx_name (name),
        INDEX idx_code (code),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Classes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        grade_level VARCHAR(20) NOT NULL,
        section VARCHAR(10),
        academic_year_id INT,
        class_teacher_id INT,
        capacity INT NOT NULL DEFAULT 30,
        current_strength INT DEFAULT 0,
        room_number VARCHAR(20),
        description TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
        FOREIGN KEY (class_teacher_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_uuid (uuid),
        INDEX idx_name (name),
        INDEX idx_grade_level (grade_level),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Students table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        student_id VARCHAR(20) NOT NULL UNIQUE,
        class_id INT,
        admission_number VARCHAR(50) UNIQUE,
        admission_date DATE,
        roll_number VARCHAR(20),
        blood_group VARCHAR(5),
        nationality VARCHAR(50) DEFAULT 'Indian',
        status ENUM('active', 'inactive', 'transferred', 'graduated', 'dropped') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
        INDEX idx_student_id (student_id),
        INDEX idx_class_id (class_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Record migration
    await connection.execute(
      'INSERT IGNORE INTO migrations (filename) VALUES (?)',
      ['002_create_academic_structure_tables.js']
    );
    
    console.log('✅ Migration 2 completed');
    console.log('🎉 Basic migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run migrations
runMigrations();
