-- Manual Migration Script for School Management System
-- Run this script in your MySQL client (phpMyAdmin, MySQL Workbench, or command line)

-- Set charset and disable foreign key checks temporarily
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS school_management_system 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE school_management_system;

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration 1: Users and Authentication Tables
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

-- Migration 2: Academic Structure Tables
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

-- Record migrations as executed
INSERT IGNORE INTO migrations (filename) VALUES
('001_create_users_and_auth_tables.js'),
('002_create_academic_structure_tables.js');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Insert default roles
INSERT IGNORE INTO roles (name, description, is_system_role, permissions) VALUES
('Super Admin', 'Full system access', TRUE, '["*"]'),
('Principal', 'School administration access', TRUE, '["users.*", "academic.*", "reports.*"]'),
('Vice Principal', 'Assistant administration access', TRUE, '["academic.*", "students.*", "teachers.*"]'),
('Teacher', 'Teaching and class management', TRUE, '["classes.*", "students.read", "grades.*", "attendance.*"]'),
('Student', 'Student portal access', TRUE, '["profile.read", "grades.read", "attendance.read"]'),
('Parent', 'Parent portal access', TRUE, '["children.*", "fees.*", "communication.*"]'),
('Librarian', 'Library management', TRUE, '["library.*", "books.*"]'),
('Accountant', 'Financial management', TRUE, '["fees.*", "payments.*", "financial_reports.*"]');

SELECT 'Basic tables created successfully! You can now run the remaining migrations.' as message;
