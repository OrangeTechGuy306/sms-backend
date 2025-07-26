-- School Management System Database Schema
-- Created for MySQL 8.0+

-- Create database
CREATE DATABASE IF NOT EXISTS school_management_system 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE school_management_system;

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- CORE USER TABLES
-- =============================================

-- Users table (base table for all user types)
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type ENUM('student', 'teacher', 'admin', 'parent') NOT NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    last_login TIMESTAMP NULL,
    password_reset_token VARCHAR(255) NULL,
    password_reset_expires TIMESTAMP NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_user_type (user_type),
    INDEX idx_status (status)
);

-- Academic years table
CREATE TABLE academic_years (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'completed', 'upcoming') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_current (is_current),
    INDEX idx_dates (start_date, end_date)
);

-- Departments table
CREATE TABLE departments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    head_teacher_id VARCHAR(36) NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_status (status)
);

-- Grade levels table
CREATE TABLE grade_levels (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(50) NOT NULL,
    level_number INT NOT NULL,
    description TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_level (level_number),
    INDEX idx_level (level_number)
);

-- Classes table
CREATE TABLE classes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    grade_level_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    class_teacher_id VARCHAR(36) NULL,
    capacity INT DEFAULT 30,
    room_number VARCHAR(50),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE RESTRICT,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
    INDEX idx_grade_year (grade_level_id, academic_year_id),
    INDEX idx_name (name)
);

-- Subjects table
CREATE TABLE subjects (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    department_id VARCHAR(36) NULL,
    credit_hours INT DEFAULT 1,
    is_core BOOLEAN DEFAULT TRUE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_code (code),
    INDEX idx_name (name),
    INDEX idx_department (department_id)
);

-- =============================================
-- STUDENT RELATED TABLES
-- =============================================

-- Students table
CREATE TABLE students (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) UNIQUE NOT NULL,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender ENUM('male', 'female', 'other') NOT NULL,
    blood_group VARCHAR(5),
    nationality VARCHAR(100),
    religion VARCHAR(100),
    address TEXT,
    phone VARCHAR(20),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(100),
    admission_date DATE NOT NULL,
    admission_number VARCHAR(50) UNIQUE,
    current_class_id VARCHAR(36),
    academic_year_id VARCHAR(36) NOT NULL,
    passport_photo VARCHAR(255),
    medical_conditions TEXT,
    allergies TEXT,
    status ENUM('active', 'graduated', 'transferred', 'suspended', 'expelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (current_class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
    INDEX idx_student_id (student_id),
    INDEX idx_name (first_name, last_name),
    INDEX idx_class (current_class_id),
    INDEX idx_status (status)
);

-- Parents/Guardians table
CREATE TABLE parents (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    relationship ENUM('father', 'mother', 'guardian', 'other') NOT NULL,
    occupation VARCHAR(100),
    phone VARCHAR(20),
    work_phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_name (first_name, last_name)
);

-- Student-Parent relationships
CREATE TABLE student_parents (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    parent_id VARCHAR(36) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_parent (student_id, parent_id),
    INDEX idx_student (student_id),
    INDEX idx_parent (parent_id)
);

-- =============================================
-- TEACHER RELATED TABLES
-- =============================================

-- Teachers table
CREATE TABLE teachers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) UNIQUE NOT NULL,
    teacher_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    phone VARCHAR(20),
    address TEXT,
    qualification VARCHAR(255),
    experience_years INT DEFAULT 0,
    specialization VARCHAR(255),
    joining_date DATE NOT NULL,
    salary DECIMAL(10,2),
    department_id VARCHAR(36),
    status ENUM('active', 'on_leave', 'resigned', 'terminated') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_name (first_name, last_name),
    INDEX idx_department (department_id),
    INDEX idx_status (status)
);

-- Teacher-Subject assignments
CREATE TABLE teacher_subjects (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    teacher_id VARCHAR(36) NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    UNIQUE KEY unique_assignment (teacher_id, subject_id, class_id, academic_year_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_subject (subject_id),
    INDEX idx_class (class_id)
);

-- =============================================
-- ADMIN RELATED TABLES
-- =============================================

-- Admin users table
CREATE TABLE admins (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    permissions JSON,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_name (first_name, last_name),
    INDEX idx_role (role)
);

-- =============================================
-- ATTENDANCE TABLES
-- =============================================

-- Attendance records
CREATE TABLE attendance (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
    time_in TIME NULL,
    time_out TIME NULL,
    remarks TEXT,
    marked_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_student_date (student_id, date),
    INDEX idx_date (date),
    INDEX idx_class_date (class_id, date),
    INDEX idx_status (status)
);

-- =============================================
-- ACADEMIC RECORDS TABLES
-- =============================================

-- Terms/Semesters
CREATE TABLE terms (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    status ENUM('upcoming', 'active', 'completed') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    INDEX idx_academic_year (academic_year_id),
    INDEX idx_current (is_current),
    INDEX idx_dates (start_date, end_date)
);

-- Assessment types (CA1, CA2, Exam, etc.)
CREATE TABLE assessment_types (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    weight_percentage DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) DEFAULT 100.00,
    description TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_code (code),
    INDEX idx_name (name)
);

-- Student results/grades
CREATE TABLE student_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    term_id VARCHAR(36) NOT NULL,
    assessment_type_id VARCHAR(36) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) DEFAULT 100.00,
    grade VARCHAR(5),
    remarks TEXT,
    teacher_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_type_id) REFERENCES assessment_types(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_result (student_id, subject_id, term_id, assessment_type_id),
    INDEX idx_student_term (student_id, term_id),
    INDEX idx_subject_term (subject_id, term_id),
    INDEX idx_class_term (class_id, term_id)
);

-- Grade scales
CREATE TABLE grade_scales (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    grade VARCHAR(5) NOT NULL,
    min_score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) NOT NULL,
    gpa_value DECIMAL(3,2),
    description VARCHAR(100),
    academic_year_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    INDEX idx_academic_year (academic_year_id),
    INDEX idx_score_range (min_score, max_score)
);

-- =============================================
-- FINANCIAL TABLES
-- =============================================

-- Fee types
CREATE TABLE fee_types (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    frequency ENUM('one_time', 'monthly', 'termly', 'yearly') DEFAULT 'termly',
    grade_level_id VARCHAR(36) NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    due_date DATE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    INDEX idx_name (name),
    INDEX idx_grade_year (grade_level_id, academic_year_id)
);

-- Student fees
CREATE TABLE student_fees (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    fee_type_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0.00,
    final_amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('pending', 'partial', 'paid', 'overdue', 'waived') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
);

-- Fee payments
CREATE TABLE fee_payments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_fee_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'bank_transfer', 'cheque', 'card', 'online') NOT NULL,
    transaction_reference VARCHAR(255),
    payment_date DATE NOT NULL,
    received_by VARCHAR(36) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_student_fee (student_fee_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_reference (transaction_reference)
);

-- =============================================
-- COMMUNICATION TABLES
-- =============================================

-- Messages
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sender_id VARCHAR(36) NOT NULL,
    recipient_id VARCHAR(36) NULL,
    recipient_type ENUM('individual', 'class', 'grade', 'all_students', 'all_teachers', 'all_parents') DEFAULT 'individual',
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    message_type ENUM('general', 'announcement', 'urgent', 'academic') DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    attachments JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sender (sender_id),
    INDEX idx_recipient (recipient_id),
    INDEX idx_type (message_type),
    INDEX idx_read (is_read),
    INDEX idx_created (created_at)
);

-- Message recipients (for group messages)
CREATE TABLE message_recipients (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    message_id VARCHAR(36) NOT NULL,
    recipient_id VARCHAR(36) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_message_recipient (message_id, recipient_id),
    INDEX idx_message (message_id),
    INDEX idx_recipient (recipient_id)
);

-- Notifications
CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    category ENUM('academic', 'financial', 'attendance', 'general', 'system') DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    action_url VARCHAR(255),
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_read (is_read),
    INDEX idx_type (type),
    INDEX idx_category (category),
    INDEX idx_created (created_at)
);

-- =============================================
-- EVENT AND CALENDAR TABLES
-- =============================================

-- Events
CREATE TABLE events (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type ENUM('academic', 'sports', 'cultural', 'meeting', 'holiday', 'exam', 'other') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    location VARCHAR(255),
    organizer_id VARCHAR(36) NOT NULL,
    target_audience ENUM('all', 'students', 'teachers', 'parents', 'staff', 'specific_class') DEFAULT 'all',
    class_id VARCHAR(36) NULL,
    grade_level_id VARCHAR(36) NULL,
    is_mandatory BOOLEAN DEFAULT FALSE,
    max_participants INT,
    registration_required BOOLEAN DEFAULT FALSE,
    registration_deadline DATE,
    status ENUM('draft', 'published', 'cancelled', 'completed') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE SET NULL,
    INDEX idx_dates (start_date, end_date),
    INDEX idx_type (event_type),
    INDEX idx_status (status),
    INDEX idx_organizer (organizer_id)
);

-- Event participants
CREATE TABLE event_participants (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    event_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attendance_status ENUM('registered', 'attended', 'absent', 'cancelled') DEFAULT 'registered',
    remarks TEXT,

    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_participant (event_id, user_id),
    INDEX idx_event (event_id),
    INDEX idx_user (user_id),
    INDEX idx_status (attendance_status)
);

-- =============================================
-- TIMETABLE TABLES
-- =============================================

-- Time slots
CREATE TABLE time_slots (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    is_break BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    INDEX idx_day_time (day_of_week, start_time),
    INDEX idx_academic_year (academic_year_id)
);

-- Timetable entries
CREATE TABLE timetables (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    class_id VARCHAR(36) NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    time_slot_id VARCHAR(36) NOT NULL,
    room_number VARCHAR(50),
    academic_year_id VARCHAR(36) NOT NULL,
    term_id VARCHAR(36) NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status ENUM('active', 'inactive', 'temporary') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    UNIQUE KEY unique_class_timeslot (class_id, time_slot_id, effective_from),
    INDEX idx_class (class_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_timeslot (time_slot_id),
    INDEX idx_dates (effective_from, effective_to)
);

-- =============================================
-- HEALTH RECORDS TABLES
-- =============================================

-- Health records
CREATE TABLE health_records (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    blood_type VARCHAR(5),
    height DECIMAL(5,2),
    weight DECIMAL(5,2),
    bmi DECIMAL(4,2),
    allergies TEXT,
    medical_conditions TEXT,
    medications TEXT,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(100),
    doctor_name VARCHAR(200),
    doctor_phone VARCHAR(20),
    insurance_provider VARCHAR(200),
    insurance_policy_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX idx_student (student_id)
);

-- Vaccinations
CREATE TABLE vaccinations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    vaccine_name VARCHAR(200) NOT NULL,
    vaccination_date DATE NOT NULL,
    next_due_date DATE,
    administered_by VARCHAR(200),
    batch_number VARCHAR(100),
    status ENUM('current', 'due', 'overdue', 'not_required') DEFAULT 'current',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_vaccine (vaccine_name),
    INDEX idx_due_date (next_due_date)
);

-- Nurse visits
CREATE TABLE nurse_visits (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    visit_date DATE NOT NULL,
    visit_time TIME NOT NULL,
    reason TEXT NOT NULL,
    symptoms TEXT,
    treatment TEXT,
    medication_given TEXT,
    temperature DECIMAL(4,2),
    blood_pressure VARCHAR(20),
    pulse_rate INT,
    recommendations TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    nurse_id VARCHAR(36) NOT NULL,
    parent_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_student (student_id),
    INDEX idx_visit_date (visit_date),
    INDEX idx_nurse (nurse_id)
);

-- Health screenings
CREATE TABLE health_screenings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    screening_type ENUM('vision', 'hearing', 'dental', 'general', 'bmi', 'other') NOT NULL,
    screening_date DATE NOT NULL,
    result TEXT,
    status ENUM('normal', 'attention_needed', 'follow_up_required', 'abnormal') DEFAULT 'normal',
    recommendations TEXT,
    screened_by VARCHAR(36) NOT NULL,
    next_screening_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (screened_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_student (student_id),
    INDEX idx_type (screening_type),
    INDEX idx_date (screening_date)
);

-- =============================================
-- TRANSPORTATION TABLES
-- =============================================

-- Bus routes
CREATE TABLE bus_routes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    route_name VARCHAR(100) NOT NULL,
    route_number VARCHAR(20) UNIQUE NOT NULL,
    driver_name VARCHAR(200),
    driver_phone VARCHAR(20),
    driver_license VARCHAR(100),
    bus_number VARCHAR(50),
    capacity INT DEFAULT 50,
    start_location VARCHAR(255),
    end_location VARCHAR(255),
    pickup_time TIME,
    drop_time TIME,
    monthly_fee DECIMAL(8,2),
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_route_number (route_number),
    INDEX idx_status (status)
);

-- Route stops
CREATE TABLE route_stops (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    route_id VARCHAR(36) NOT NULL,
    stop_name VARCHAR(200) NOT NULL,
    stop_address TEXT,
    pickup_time TIME,
    drop_time TIME,
    stop_order INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (route_id) REFERENCES bus_routes(id) ON DELETE CASCADE,
    INDEX idx_route (route_id),
    INDEX idx_order (stop_order)
);

-- Student transportation
CREATE TABLE student_transportation (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    route_id VARCHAR(36) NOT NULL,
    pickup_stop_id VARCHAR(36) NOT NULL,
    drop_stop_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_fee DECIMAL(8,2),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES bus_routes(id) ON DELETE CASCADE,
    FOREIGN KEY (pickup_stop_id) REFERENCES route_stops(id) ON DELETE RESTRICT,
    FOREIGN KEY (drop_stop_id) REFERENCES route_stops(id) ON DELETE RESTRICT,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_route (route_id),
    INDEX idx_academic_year (academic_year_id)
);

-- =============================================
-- FILE MANAGEMENT TABLES
-- =============================================

-- Files/Documents
CREATE TABLE files (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type ENUM('image', 'document', 'video', 'audio', 'other') NOT NULL,
    uploaded_by VARCHAR(36) NOT NULL,
    related_to_type ENUM('student', 'teacher', 'admin', 'event', 'message', 'health', 'other') NOT NULL,
    related_to_id VARCHAR(36) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_related (related_to_type, related_to_id),
    INDEX idx_file_type (file_type),
    INDEX idx_created (created_at)
);

-- =============================================
-- SYSTEM SETTINGS TABLES
-- =============================================

-- System settings
CREATE TABLE system_settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_key (setting_key),
    INDEX idx_public (is_public)
);

-- Audit logs
CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(36) NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_table (table_name),
    INDEX idx_record (record_id),
    INDEX idx_created (created_at)
);

-- =============================================
-- INITIAL DATA INSERTS
-- =============================================

-- Insert default academic year
INSERT INTO academic_years (name, start_date, end_date, is_current, status)
VALUES ('2024-2025', '2024-09-01', '2025-06-30', TRUE, 'active');

-- Insert default grade levels
INSERT INTO grade_levels (name, level_number, description) VALUES
('Nursery', 1, 'Nursery level'),
('KG1', 2, 'Kindergarten 1'),
('KG2', 3, 'Kindergarten 2'),
('Grade 1', 4, 'Primary Grade 1'),
('Grade 2', 5, 'Primary Grade 2'),
('Grade 3', 6, 'Primary Grade 3'),
('Grade 4', 7, 'Primary Grade 4'),
('Grade 5', 8, 'Primary Grade 5'),
('Grade 6', 9, 'Primary Grade 6'),
('Grade 7', 10, 'Junior Secondary 1'),
('Grade 8', 11, 'Junior Secondary 2'),
('Grade 9', 12, 'Junior Secondary 3'),
('Grade 10', 13, 'Senior Secondary 1'),
('Grade 11', 14, 'Senior Secondary 2'),
('Grade 12', 15, 'Senior Secondary 3');

-- Insert default assessment types
INSERT INTO assessment_types (name, code, weight_percentage, max_score) VALUES
('Continuous Assessment 1', 'CA1', 20.00, 100.00),
('Continuous Assessment 2', 'CA2', 20.00, 100.00),
('Final Examination', 'EXAM', 60.00, 100.00);

-- Insert default grade scales
INSERT INTO grade_scales (grade, min_score, max_score, gpa_value, description, academic_year_id)
SELECT 'A+', 90.00, 100.00, 4.00, 'Excellent', id FROM academic_years WHERE is_current = TRUE;

INSERT INTO grade_scales (grade, min_score, max_score, gpa_value, description, academic_year_id)
SELECT 'A', 80.00, 89.99, 3.50, 'Very Good', id FROM academic_years WHERE is_current = TRUE;

INSERT INTO grade_scales (grade, min_score, max_score, gpa_value, description, academic_year_id)
SELECT 'B+', 70.00, 79.99, 3.00, 'Good', id FROM academic_years WHERE is_current = TRUE;

INSERT INTO grade_scales (grade, min_score, max_score, gpa_value, description, academic_year_id)
SELECT 'B', 60.00, 69.99, 2.50, 'Above Average', id FROM academic_years WHERE is_current = TRUE;

INSERT INTO grade_scales (grade, min_score, max_score, gpa_value, description, academic_year_id)
SELECT 'C+', 50.00, 59.99, 2.00, 'Average', id FROM academic_years WHERE is_current = TRUE;

INSERT INTO grade_scales (grade, min_score, max_score, gpa_value, description, academic_year_id)
SELECT 'C', 40.00, 49.99, 1.50, 'Below Average', id FROM academic_years WHERE is_current = TRUE;

INSERT INTO grade_scales (grade, min_score, max_score, gpa_value, description, academic_year_id)
SELECT 'D', 30.00, 39.99, 1.00, 'Poor', id FROM academic_years WHERE is_current = TRUE;

INSERT INTO grade_scales (grade, min_score, max_score, gpa_value, description, academic_year_id)
SELECT 'F', 0.00, 29.99, 0.00, 'Fail', id FROM academic_years WHERE is_current = TRUE;

-- =============================================
-- ADDITIONAL MANAGEMENT TABLES
-- =============================================

-- Lesson Notes table
CREATE TABLE lesson_notes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NULL,
    grade_level_id VARCHAR(36) NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    lesson_date DATE NULL,
    objectives TEXT,
    materials TEXT,
    homework TEXT,
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE SET NULL,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,

    INDEX idx_teacher_subject (teacher_id, subject_id),
    INDEX idx_class_date (class_id, lesson_date),
    INDEX idx_status (status)
);

-- Timetables table
CREATE TABLE timetables (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    term_id VARCHAR(36) NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    status ENUM('draft', 'active', 'inactive') DEFAULT 'draft',
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,

    INDEX idx_class_year (class_id, academic_year_id),
    INDEX idx_effective_dates (effective_from, effective_to),
    INDEX idx_status (status)
);

-- Timetable periods table
CREATE TABLE timetable_periods (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    timetable_id VARCHAR(36) NOT NULL,
    day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
    period_number INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    subject_id VARCHAR(36) NULL,
    teacher_id VARCHAR(36) NULL,
    room_number VARCHAR(50) NULL,
    period_type ENUM('regular', 'break', 'lunch', 'assembly', 'free') DEFAULT 'regular',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,

    UNIQUE KEY unique_timetable_day_period (timetable_id, day_of_week, period_number),
    INDEX idx_day_period (day_of_week, period_number),
    INDEX idx_teacher_time (teacher_id, day_of_week, start_time)
);

-- Transportation routes table
CREATE TABLE transportation_routes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    route_name VARCHAR(255) NOT NULL,
    route_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    start_location VARCHAR(255) NOT NULL,
    end_location VARCHAR(255) NOT NULL,
    estimated_duration INT NOT NULL, -- in minutes
    distance_km DECIMAL(8,2),
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_route_code (route_code),
    INDEX idx_status (status)
);

-- Transportation buses table
CREATE TABLE transportation_buses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    bus_number VARCHAR(50) UNIQUE NOT NULL,
    license_plate VARCHAR(50) UNIQUE NOT NULL,
    capacity INT NOT NULL,
    model VARCHAR(100),
    year_manufactured YEAR,
    fuel_type ENUM('diesel', 'petrol', 'electric', 'hybrid') DEFAULT 'diesel',
    insurance_expiry DATE,
    last_maintenance DATE,
    next_maintenance DATE,
    gps_device_id VARCHAR(100),
    status ENUM('active', 'maintenance', 'retired') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_bus_number (bus_number),
    INDEX idx_status (status),
    INDEX idx_maintenance (next_maintenance)
);

-- Transportation drivers table
CREATE TABLE transportation_drivers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    date_of_birth DATE NOT NULL,
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    hire_date DATE NOT NULL,
    status ENUM('active', 'on_leave', 'terminated') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_employee_id (employee_id),
    INDEX idx_license (license_number),
    INDEX idx_status (status)
);

-- Route assignments table
CREATE TABLE route_assignments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    route_id VARCHAR(36) NOT NULL,
    bus_id VARCHAR(36) NOT NULL,
    driver_id VARCHAR(36) NOT NULL,
    assistant_driver_id VARCHAR(36) NULL,
    shift_type ENUM('morning', 'afternoon', 'both') NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (route_id) REFERENCES transportation_routes(id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES transportation_buses(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES transportation_drivers(id) ON DELETE CASCADE,
    FOREIGN KEY (assistant_driver_id) REFERENCES transportation_drivers(id) ON DELETE SET NULL,

    INDEX idx_route_bus (route_id, bus_id),
    INDEX idx_driver_date (driver_id, effective_from),
    INDEX idx_status (status)
);

-- Route stops table
CREATE TABLE route_stops (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    route_id VARCHAR(36) NOT NULL,
    stop_name VARCHAR(255) NOT NULL,
    stop_address TEXT,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    stop_order INT NOT NULL,
    pickup_time TIME NULL,
    dropoff_time TIME NULL,
    estimated_students INT DEFAULT 0,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (route_id) REFERENCES transportation_routes(id) ON DELETE CASCADE,

    UNIQUE KEY unique_route_order (route_id, stop_order),
    INDEX idx_route_order (route_id, stop_order),
    INDEX idx_coordinates (latitude, longitude)
);

-- Student transportation table
CREATE TABLE student_transportation (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id VARCHAR(36) NOT NULL,
    route_id VARCHAR(36) NOT NULL,
    pickup_stop_id VARCHAR(36) NOT NULL,
    dropoff_stop_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    monthly_fee DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES transportation_routes(id) ON DELETE CASCADE,
    FOREIGN KEY (pickup_stop_id) REFERENCES route_stops(id) ON DELETE RESTRICT,
    FOREIGN KEY (dropoff_stop_id) REFERENCES route_stops(id) ON DELETE RESTRICT,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,

    INDEX idx_student_route (student_id, route_id),
    INDEX idx_route_year (route_id, academic_year_id),
    INDEX idx_status (status)
);

-- Assessments table
CREATE TABLE assessments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NULL,
    grade_level_id VARCHAR(36) NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    term_id VARCHAR(36) NULL,
    assessment_type ENUM('quiz', 'test', 'exam', 'assignment', 'project', 'presentation') NOT NULL,
    total_marks DECIMAL(8, 2) NOT NULL,
    passing_marks DECIMAL(8, 2) NOT NULL,
    duration_minutes INT NULL,
    scheduled_date DATE NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    instructions TEXT,
    status ENUM('draft', 'published', 'active', 'completed', 'cancelled') DEFAULT 'draft',
    is_online BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE SET NULL,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,

    INDEX idx_subject_teacher (subject_id, teacher_id),
    INDEX idx_class_date (class_id, scheduled_date),
    INDEX idx_status_type (status, assessment_type)
);

-- Assessment questions table
CREATE TABLE assessment_questions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    assessment_id VARCHAR(36) NOT NULL,
    question_number INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank') NOT NULL,
    marks DECIMAL(8, 2) NOT NULL,
    options JSON NULL, -- For multiple choice questions
    correct_answer TEXT NULL,
    explanation TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,

    UNIQUE KEY unique_assessment_question (assessment_id, question_number),
    INDEX idx_assessment_number (assessment_id, question_number)
);

-- Student assessment attempts table
CREATE TABLE student_assessment_attempts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    assessment_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    attempt_number INT DEFAULT 1,
    start_time TIMESTAMP NULL,
    end_time TIMESTAMP NULL,
    submitted_at TIMESTAMP NULL,
    total_marks_obtained DECIMAL(8, 2) NULL,
    percentage DECIMAL(5, 2) NULL,
    grade VARCHAR(5) NULL,
    status ENUM('not_started', 'in_progress', 'submitted', 'graded') DEFAULT 'not_started',
    answers JSON NULL,
    teacher_feedback TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,

    UNIQUE KEY unique_student_assessment_attempt (student_id, assessment_id, attempt_number),
    INDEX idx_student_assessment (student_id, assessment_id),
    INDEX idx_status (status)
);

-- Library books table
CREATE TABLE library_books (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    isbn VARCHAR(20) UNIQUE NULL,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    publisher VARCHAR(255) NULL,
    publication_year YEAR NULL,
    edition VARCHAR(50) NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100) NULL,
    language VARCHAR(50) DEFAULT 'English',
    pages INT NULL,
    description TEXT,
    location_shelf VARCHAR(50) NULL,
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NULL,
    acquisition_date DATE NULL,
    condition_status ENUM('excellent', 'good', 'fair', 'poor', 'damaged') DEFAULT 'good',
    status ENUM('active', 'inactive', 'lost', 'damaged') DEFAULT 'active',
    cover_image_url VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_isbn (isbn),
    INDEX idx_title (title(100)),
    INDEX idx_author (author),
    INDEX idx_category (category, subcategory),
    INDEX idx_status (status),
    FULLTEXT idx_search (title, author, description)
);

-- Library book loans table
CREATE TABLE library_book_loans (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    book_id VARCHAR(36) NOT NULL,
    borrower_id VARCHAR(36) NOT NULL,
    borrower_type ENUM('student', 'teacher', 'staff') NOT NULL,
    loan_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE NULL,
    renewed_count INT DEFAULT 0,
    fine_amount DECIMAL(10, 2) DEFAULT 0.00,
    fine_paid BOOLEAN DEFAULT FALSE,
    condition_on_loan ENUM('excellent', 'good', 'fair', 'poor') DEFAULT 'good',
    condition_on_return ENUM('excellent', 'good', 'fair', 'poor', 'damaged') NULL,
    notes TEXT,
    status ENUM('active', 'returned', 'overdue', 'lost') DEFAULT 'active',
    issued_by VARCHAR(36) NOT NULL,
    returned_to VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (book_id) REFERENCES library_books(id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (returned_to) REFERENCES users(id) ON DELETE SET NULL,

    INDEX idx_book_status (book_id, status),
    INDEX idx_borrower (borrower_id, borrower_type),
    INDEX idx_due_date (due_date),
    INDEX idx_loan_date (loan_date),
    INDEX idx_status (status)
);

-- Library reservations table
CREATE TABLE library_reservations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    book_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_type ENUM('student', 'teacher', 'staff') NOT NULL,
    reservation_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status ENUM('active', 'fulfilled', 'cancelled', 'expired') DEFAULT 'active',
    priority_order INT DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (book_id) REFERENCES library_books(id) ON DELETE CASCADE,

    INDEX idx_book_user (book_id, user_id),
    INDEX idx_status_priority (status, priority_order),
    INDEX idx_expiry_date (expiry_date)
);

-- Parent-student relationships table (for parent portal)
CREATE TABLE parent_student_relationships (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    parent_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    relationship_type ENUM('father', 'mother', 'guardian', 'stepfather', 'stepmother', 'grandparent', 'other') NOT NULL,
    is_primary_contact BOOLEAN DEFAULT FALSE,
    is_emergency_contact BOOLEAN DEFAULT FALSE,
    can_pickup BOOLEAN DEFAULT TRUE,
    can_view_grades BOOLEAN DEFAULT TRUE,
    can_view_attendance BOOLEAN DEFAULT TRUE,
    can_receive_communications BOOLEAN DEFAULT TRUE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,

    UNIQUE KEY unique_parent_student (parent_id, student_id),
    INDEX idx_parent (parent_id),
    INDEX idx_student (student_id),
    INDEX idx_primary_contact (is_primary_contact),
    INDEX idx_status (status)
);

-- Parent-teacher meeting requests table
CREATE TABLE parent_teacher_meetings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    parent_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    requested_date DATE NOT NULL,
    requested_time TIME NOT NULL,
    approved_date DATE NULL,
    approved_time TIME NULL,
    meeting_type ENUM('in_person', 'video_call', 'phone_call') DEFAULT 'in_person',
    purpose TEXT NOT NULL,
    location VARCHAR(255) NULL,
    duration_minutes INT DEFAULT 30,
    status ENUM('requested', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'requested',
    teacher_notes TEXT NULL,
    parent_feedback TEXT NULL,
    meeting_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,

    INDEX idx_parent_teacher (parent_id, teacher_id),
    INDEX idx_student_date (student_id, requested_date),
    INDEX idx_status (status),
    INDEX idx_approved_date (approved_date, approved_time)
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public, updated_by) VALUES
('school_name', 'Demo School Management System', 'string', 'Name of the school', TRUE, (SELECT id FROM users WHERE user_type = 'admin' LIMIT 1)),
('school_address', '123 Education Street, Learning City', 'string', 'School address', TRUE, (SELECT id FROM users WHERE user_type = 'admin' LIMIT 1)),
('school_phone', '+1-234-567-8900', 'string', 'School contact phone', TRUE, (SELECT id FROM users WHERE user_type = 'admin' LIMIT 1)),
('school_email', 'info@demoschool.edu', 'string', 'School contact email', TRUE, (SELECT id FROM users WHERE user_type = 'admin' LIMIT 1)),
('academic_year_start_month', '9', 'number', 'Month when academic year starts (1-12)', FALSE, (SELECT id FROM users WHERE user_type = 'admin' LIMIT 1)),
('max_students_per_class', '30', 'number', 'Maximum students allowed per class', FALSE, (SELECT id FROM users WHERE user_type = 'admin' LIMIT 1)),
('attendance_grace_period', '15', 'number', 'Grace period in minutes for late attendance', FALSE, (SELECT id FROM users WHERE user_type = 'admin' LIMIT 1)),
('enable_parent_portal', 'true', 'boolean', 'Enable parent portal access', FALSE, (SELECT id FROM users WHERE user_type = 'admin' LIMIT 1));

-- Create indexes for better performance
CREATE INDEX idx_users_email_type ON users(email, user_type);
CREATE INDEX idx_students_name_status ON students(first_name, last_name, status);
CREATE INDEX idx_teachers_name_status ON teachers(first_name, last_name, status);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_results_student_term ON student_results(student_id, term_id);
CREATE INDEX idx_fees_student_status ON student_fees(student_id, status);
CREATE INDEX idx_messages_recipient_read ON messages(recipient_id, is_read);

-- Enable event scheduler (if needed for automated tasks)
-- SET GLOBAL event_scheduler = ON;
