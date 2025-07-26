-- School Management System - Complete Database Schema
-- This file contains all the tables needed for the school management system

-- Set charset and collation
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS school_management_system 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE school_management_system;

-- =============================================
-- MIGRATION TRACKING TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

-- Users table - main user table for all user types
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

-- Roles table for role-based access control
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

-- User roles junction table
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

-- Password reset tokens
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

-- =============================================
-- ACADEMIC STRUCTURE TABLES
-- =============================================

-- Academic years table
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

-- Subjects table
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

-- Classes table
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

-- Students table (extends users table)
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

-- Teachers table (extends users table)
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

-- Parents table (extends users table)
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

-- Student-Parent relationships
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

-- =============================================
-- ASSESSMENT AND GRADING TABLES
-- =============================================

-- Assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type ENUM('exam', 'quiz', 'test', 'assignment', 'project', 'presentation', 'practical') NOT NULL,
  subject_id INT NOT NULL,
  class_id INT NOT NULL,
  teacher_id INT NOT NULL,
  academic_year_id INT,
  total_marks INT NOT NULL,
  passing_marks INT NOT NULL,
  duration INT, -- in minutes
  assessment_date DATE,
  assessment_time TIME,
  instructions TEXT,
  status ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled') DEFAULT 'draft',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_title (title),
  INDEX idx_type (type),
  INDEX idx_subject_id (subject_id),
  INDEX idx_class_id (class_id),
  INDEX idx_teacher_id (teacher_id),
  INDEX idx_assessment_date (assessment_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Assessment results table
CREATE TABLE IF NOT EXISTS assessment_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT NOT NULL,
  student_id INT NOT NULL,
  marks_obtained DECIMAL(5,2) NOT NULL,
  percentage DECIMAL(5,2),
  grade VARCHAR(5),
  remarks TEXT,
  is_absent BOOLEAN DEFAULT FALSE,
  submission_date TIMESTAMP,
  graded_by INT,
  graded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_assessment_id (assessment_id),
  INDEX idx_student_id (student_id),
  INDEX idx_marks_obtained (marks_obtained),
  INDEX idx_percentage (percentage),
  INDEX idx_grade (grade),
  INDEX idx_is_absent (is_absent),
  UNIQUE KEY unique_assessment_student (assessment_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- ATTENDANCE TABLES
-- =============================================

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  class_id INT NOT NULL,
  subject_id INT,
  teacher_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  period_number INT,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  remarks TEXT,
  marked_by INT,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_student_id (student_id),
  INDEX idx_class_id (class_id),
  INDEX idx_subject_id (subject_id),
  INDEX idx_teacher_id (teacher_id),
  INDEX idx_attendance_date (attendance_date),
  INDEX idx_status (status),
  INDEX idx_period_number (period_number),
  UNIQUE KEY unique_student_date_period (student_id, attendance_date, period_number, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- HEALTH RECORDS TABLES
-- =============================================

-- Health records table
CREATE TABLE IF NOT EXISTS health_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  student_id INT NOT NULL,
  record_type ENUM('routine_checkup', 'illness', 'injury', 'vaccination', 'emergency', 'follow_up', 'physical_exam') NOT NULL,
  record_date DATE NOT NULL,
  height DECIMAL(5,2), -- in cm
  weight DECIMAL(5,2), -- in kg
  blood_pressure VARCHAR(20),
  temperature DECIMAL(4,1), -- in celsius
  pulse_rate INT,
  symptoms TEXT,
  diagnosis TEXT,
  treatment TEXT,
  medications TEXT,
  doctor_name VARCHAR(100),
  follow_up_date DATE,
  notes TEXT,
  status ENUM('active', 'resolved', 'ongoing', 'follow_up_required') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_student_id (student_id),
  INDEX idx_record_type (record_type),
  INDEX idx_record_date (record_date),
  INDEX idx_follow_up_date (follow_up_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- LIBRARY TABLES
-- =============================================

-- Library categories table
CREATE TABLE IF NOT EXISTS library_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_category_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (parent_category_id) REFERENCES library_categories(id) ON DELETE SET NULL,
  INDEX idx_name (name),
  INDEX idx_parent_category_id (parent_category_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(20) UNIQUE,
  category_id INT,
  publisher VARCHAR(100),
  published_year YEAR,
  edition VARCHAR(50),
  language VARCHAR(50) DEFAULT 'English',
  pages INT,
  total_copies INT NOT NULL DEFAULT 1,
  available_copies INT NOT NULL DEFAULT 1,
  location VARCHAR(100),
  description TEXT,
  status ENUM('available', 'checked_out', 'reserved', 'damaged', 'lost', 'under_repair') DEFAULT 'available',
  added_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id) REFERENCES library_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_title (title),
  INDEX idx_author (author),
  INDEX idx_isbn (isbn),
  INDEX idx_category_id (category_id),
  INDEX idx_status (status),
  INDEX idx_available_copies (available_copies)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Book borrowing records table
CREATE TABLE IF NOT EXISTS book_borrowings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  borrower_id INT NOT NULL,
  borrower_type ENUM('student', 'teacher', 'staff') NOT NULL,
  borrowed_date DATE NOT NULL,
  due_date DATE NOT NULL,
  returned_date DATE,
  renewal_count INT DEFAULT 0,
  fine_amount DECIMAL(8,2) DEFAULT 0.00,
  fine_paid BOOLEAN DEFAULT FALSE,
  status ENUM('borrowed', 'returned', 'overdue', 'lost', 'damaged') DEFAULT 'borrowed',
  notes TEXT,
  issued_by INT,
  returned_to INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (returned_to) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_book_id (book_id),
  INDEX idx_borrower_id (borrower_id),
  INDEX idx_borrowed_date (borrowed_date),
  INDEX idx_due_date (due_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TRANSPORTATION TABLES
-- =============================================

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  vehicle_number VARCHAR(20) NOT NULL UNIQUE,
  vehicle_type ENUM('school_bus', 'mini_bus', 'van', 'car', 'truck') NOT NULL,
  model VARCHAR(100),
  capacity INT NOT NULL,
  fuel_type ENUM('petrol', 'diesel', 'cng', 'electric', 'hybrid') DEFAULT 'diesel',
  registration_date DATE,
  insurance_expiry DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  status ENUM('active', 'inactive', 'under_maintenance', 'out_of_service') DEFAULT 'active',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_vehicle_number (vehicle_number),
  INDEX idx_vehicle_type (vehicle_type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  route_name VARCHAR(100) NOT NULL,
  route_code VARCHAR(20) UNIQUE,
  description TEXT,
  start_location VARCHAR(200),
  end_location VARCHAR(200),
  total_distance DECIMAL(6,2), -- in km
  vehicle_id INT,
  morning_start_time TIME,
  evening_start_time TIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_route_name (route_name),
  INDEX idx_route_code (route_code),
  INDEX idx_vehicle_id (vehicle_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- COMMUNICATION TABLES
-- =============================================

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  sender_id INT NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message_body TEXT NOT NULL,
  message_type ENUM('announcement', 'notice', 'personal', 'emergency', 'reminder') DEFAULT 'personal',
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  is_draft BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_sender_id (sender_id),
  INDEX idx_message_type (message_type),
  INDEX idx_priority (priority),
  INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Message recipients table
CREATE TABLE IF NOT EXISTS message_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  recipient_id INT NOT NULL,
  recipient_type ENUM('individual', 'class', 'grade', 'all_students', 'all_teachers', 'all_parents') DEFAULT 'individual',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  is_archived BOOLEAN DEFAULT FALSE,

  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_message_id (message_id),
  INDEX idx_recipient_id (recipient_id),
  INDEX idx_is_read (is_read),
  UNIQUE KEY unique_message_recipient (message_id, recipient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_type ENUM('academic', 'sports', 'cultural', 'social', 'meeting', 'workshop', 'ceremony', 'holiday', 'other') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  location VARCHAR(200),
  organizer VARCHAR(100),
  capacity INT,
  status ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed') DEFAULT 'scheduled',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_title (title),
  INDEX idx_event_type (event_type),
  INDEX idx_start_date (start_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- FEE MANAGEMENT TABLES
-- =============================================

-- Fee categories table
CREATE TABLE IF NOT EXISTS fee_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_name (name),
  INDEX idx_is_mandatory (is_mandatory),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fee structures table
CREATE TABLE IF NOT EXISTS fee_structures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  class_id INT,
  academic_year_id INT NOT NULL,
  fee_category_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  late_fee_amount DECIMAL(8,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_category_id) REFERENCES fee_categories(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_name (name),
  INDEX idx_class_id (class_id),
  INDEX idx_academic_year_id (academic_year_id),
  INDEX idx_fee_category_id (fee_category_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student fees table
CREATE TABLE IF NOT EXISTS student_fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  student_id INT NOT NULL,
  fee_structure_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0.00,
  pending_amount DECIMAL(10,2),
  discount_amount DECIMAL(8,2) DEFAULT 0.00,
  late_fee_amount DECIMAL(8,2) DEFAULT 0.00,
  due_date DATE,
  status ENUM('pending', 'partial', 'paid', 'overdue', 'waived') DEFAULT 'pending',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_uuid (uuid),
  INDEX idx_student_id (student_id),
  INDEX idx_fee_structure_id (fee_structure_id),
  INDEX idx_status (status),
  UNIQUE KEY unique_student_fee_structure (student_id, fee_structure_id, academic_year_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- ADMINISTRATIVE TABLES
-- =============================================

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type ENUM('string', 'number', 'boolean', 'json', 'date') DEFAULT 'string',
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  category VARCHAR(50) DEFAULT 'general',
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_setting_key (setting_key),
  INDEX idx_category (category),
  INDEX idx_is_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_table_name (table_name),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- INSERT DEFAULT DATA
-- =============================================

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

-- Insert default library categories
INSERT IGNORE INTO library_categories (name, description) VALUES
('Fiction', 'Fictional literature and novels'),
('Non-Fiction', 'Non-fictional books and references'),
('Science', 'Science and technology books'),
('Mathematics', 'Mathematics and related subjects'),
('History', 'Historical books and references'),
('Geography', 'Geography and earth sciences'),
('Literature', 'Literature and language arts'),
('Biography', 'Biographical and autobiographical works'),
('Reference', 'Reference books and encyclopedias'),
('Children', 'Children and young adult books'),
('Textbook', 'Academic textbooks and course materials');

-- Insert default fee categories
INSERT IGNORE INTO fee_categories (name, description, is_mandatory) VALUES
('Tuition Fee', 'Monthly tuition fees', TRUE),
('Admission Fee', 'One-time admission fee', TRUE),
('Development Fee', 'Annual development charges', TRUE),
('Examination Fee', 'Examination and assessment fees', TRUE),
('Library Fee', 'Library usage and maintenance fee', FALSE),
('Laboratory Fee', 'Science laboratory usage fee', FALSE),
('Sports Fee', 'Sports activities and equipment fee', FALSE),
('Transportation Fee', 'School bus transportation fee', FALSE),
('Uniform Fee', 'School uniform and accessories', FALSE),
('Miscellaneous Fee', 'Other miscellaneous charges', FALSE);

-- Insert default system settings
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description, category) VALUES
('school_name', 'School Management System', 'string', 'Name of the school', 'general'),
('school_address', '', 'string', 'School address', 'general'),
('school_phone', '', 'string', 'School contact phone', 'general'),
('school_email', '', 'string', 'School contact email', 'general'),
('academic_year_start_month', '4', 'number', 'Academic year start month (1-12)', 'academic'),
('attendance_grace_period', '15', 'number', 'Grace period for attendance in minutes', 'attendance'),
('late_fee_grace_days', '7', 'number', 'Grace days before applying late fee', 'fees'),
('max_students_per_class', '40', 'number', 'Maximum students allowed per class', 'academic'),
('library_max_books_per_student', '3', 'number', 'Maximum books a student can borrow', 'library'),
('library_default_loan_days', '14', 'number', 'Default book loan period in days', 'library');

-- Record all migrations as executed
INSERT IGNORE INTO migrations (filename) VALUES
('001_create_users_and_auth_tables.js'),
('002_create_academic_structure_tables.js'),
('003_create_assessment_and_grading_tables.js'),
('004_create_attendance_and_timetable_tables.js'),
('005_create_health_and_library_tables.js'),
('006_create_transportation_and_communication_tables.js'),
('007_create_fees_and_admin_tables.js');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- SCHEMA CREATION COMPLETE
-- =============================================

SELECT 'School Management System database schema created successfully!' as message;
