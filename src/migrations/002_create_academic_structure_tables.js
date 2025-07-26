const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const up = async () => {
  logger.info('Creating academic structure tables...');

  // Academic years table
  await executeQuery(`
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
      INDEX idx_status (status),
      INDEX idx_dates (start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Subjects table
  await executeQuery(`
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
      INDEX idx_department (department),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Classes table
  await executeQuery(`
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
      INDEX idx_section (section),
      INDEX idx_class_teacher (class_teacher_id),
      INDEX idx_status (status),
      UNIQUE KEY unique_class_section (grade_level, section, academic_year_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Students table (extends users table)
  await executeQuery(`
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
      religion VARCHAR(50),
      category VARCHAR(20),
      mother_tongue VARCHAR(50),
      previous_school TEXT,
      medical_conditions TEXT,
      emergency_contact_name VARCHAR(100),
      emergency_contact_phone VARCHAR(20),
      emergency_contact_relation VARCHAR(50),
      transport_required BOOLEAN DEFAULT FALSE,
      hostel_required BOOLEAN DEFAULT FALSE,
      status ENUM('active', 'inactive', 'transferred', 'graduated', 'dropped') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
      INDEX idx_student_id (student_id),
      INDEX idx_admission_number (admission_number),
      INDEX idx_class_id (class_id),
      INDEX idx_roll_number (roll_number),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Teachers table (extends users table)
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      employee_id VARCHAR(20) NOT NULL UNIQUE,
      designation VARCHAR(100),
      department VARCHAR(100),
      qualification TEXT,
      experience_years INT DEFAULT 0,
      specialization TEXT,
      joining_date DATE,
      salary DECIMAL(10,2),
      employment_type ENUM('permanent', 'contract', 'part_time') DEFAULT 'permanent',
      subjects_taught JSON,
      classes_assigned JSON,
      is_class_teacher BOOLEAN DEFAULT FALSE,
      status ENUM('active', 'inactive', 'on_leave', 'terminated') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_employee_id (employee_id),
      INDEX idx_designation (designation),
      INDEX idx_department (department),
      INDEX idx_is_class_teacher (is_class_teacher),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Parents table (extends users table)
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS parents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      occupation VARCHAR(100),
      annual_income DECIMAL(12,2),
      education_qualification VARCHAR(100),
      office_address TEXT,
      office_phone VARCHAR(20),
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_occupation (occupation),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Student-Parent relationships
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS student_parents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      parent_id INT NOT NULL,
      relationship ENUM('father', 'mother', 'guardian', 'other') NOT NULL,
      is_primary_contact BOOLEAN DEFAULT FALSE,
      is_emergency_contact BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE,
      INDEX idx_student_id (student_id),
      INDEX idx_parent_id (parent_id),
      INDEX idx_relationship (relationship),
      INDEX idx_primary_contact (is_primary_contact),
      UNIQUE KEY unique_student_parent (student_id, parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Class-Subject assignments
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS class_subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      subject_id INT NOT NULL,
      teacher_id INT,
      periods_per_week INT DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
      INDEX idx_class_id (class_id),
      INDEX idx_subject_id (subject_id),
      INDEX idx_teacher_id (teacher_id),
      INDEX idx_is_active (is_active),
      UNIQUE KEY unique_class_subject (class_id, subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  logger.info('Academic structure tables created successfully');
};

const down = async () => {
  logger.info('Dropping academic structure tables...');
  
  await executeQuery('DROP TABLE IF EXISTS class_subjects');
  await executeQuery('DROP TABLE IF EXISTS student_parents');
  await executeQuery('DROP TABLE IF EXISTS parents');
  await executeQuery('DROP TABLE IF EXISTS teachers');
  await executeQuery('DROP TABLE IF EXISTS students');
  await executeQuery('DROP TABLE IF EXISTS classes');
  await executeQuery('DROP TABLE IF EXISTS subjects');
  await executeQuery('DROP TABLE IF EXISTS academic_years');
  
  logger.info('Academic structure tables dropped');
};

module.exports = { up, down };
