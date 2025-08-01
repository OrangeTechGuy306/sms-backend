-- Fix Missing Tables for School Management System
-- Execute this script to add missing tables that the controllers expect

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

USE school_management_system;

-- =============================================
-- MISSING TABLES THAT CONTROLLERS EXPECT
-- =============================================

-- Grade levels table (required by classController)
CREATE TABLE IF NOT EXISTS grade_levels (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(50) NOT NULL,
    level_number INT NOT NULL,
    description TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_level (level_number),
    INDEX idx_level (level_number),
    INDEX idx_name (name),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Academic years table (if not exists)
CREATE TABLE IF NOT EXISTS academic_years (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'completed', 'upcoming') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_current (is_current),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update classes table to ensure it has the right structure
-- Add columns to classes table if they don't exist
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS grade_level_id VARCHAR(36),
ADD COLUMN IF NOT EXISTS academic_year_id VARCHAR(36),
ADD COLUMN IF NOT EXISTS class_teacher_id INT,
ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS room_number VARCHAR(50);

-- Teachers table (simplified version for foreign key reference)
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    employee_id VARCHAR(50) UNIQUE,
    department VARCHAR(100),
    qualification TEXT,
    experience_years INT DEFAULT 0,
    specialization VARCHAR(200),
    hire_date DATE,
    salary DECIMAL(10,2),
    status ENUM('active', 'inactive', 'on_leave', 'terminated') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_employee_id (employee_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Students table (simplified version)
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    student_id VARCHAR(50) UNIQUE,
    class_id VARCHAR(36),
    admission_date DATE,
    roll_number VARCHAR(20),
    section VARCHAR(10),
    status ENUM('active', 'inactive', 'graduated', 'transferred', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_student_id (student_id),
    INDEX idx_user_id (user_id),
    INDEX idx_class_id (class_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default grade levels
INSERT IGNORE INTO grade_levels (name, level_number, description) VALUES
('Nursery', 1, 'Nursery level'),
('KG1', 2, 'Kindergarten 1'),
('KG2', 3, 'Kindergarten 2'),
('Grade 1', 4, 'Primary Grade 1'),
('Grade 2', 5, 'Primary Grade 2'),
('Grade 3', 6, 'Primary Grade 3'),
('Grade 4', 7, 'Primary Grade 4'),
('Grade 5', 8, 'Primary Grade 5'),
('Grade 6', 9, 'Middle School Grade 6'),
('Grade 7', 10, 'Middle School Grade 7'),
('Grade 8', 11, 'Middle School Grade 8'),
('Grade 9', 12, 'High School Grade 9'),
('Grade 10', 13, 'High School Grade 10'),
('Grade 11', 14, 'High School Grade 11'),
('Grade 12', 15, 'High School Grade 12');

-- Insert default academic year
INSERT IGNORE INTO academic_years (name, start_date, end_date, is_current, status)
VALUES ('2024-2025', '2024-09-01', '2025-06-30', TRUE, 'active');

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Show completion message
SELECT 'Missing tables and data have been added successfully!' as status;
SELECT COUNT(*) as grade_levels_count FROM grade_levels;
SELECT COUNT(*) as academic_years_count FROM academic_years;
