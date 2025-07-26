const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const up = async () => {
  logger.info('Creating attendance and timetable tables...');

  // Attendance table
  await executeQuery(`
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
  `);

  // Attendance summary table for quick statistics
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS attendance_summary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      class_id INT NOT NULL,
      month TINYINT NOT NULL,
      year YEAR NOT NULL,
      total_days INT DEFAULT 0,
      present_days INT DEFAULT 0,
      absent_days INT DEFAULT 0,
      late_days INT DEFAULT 0,
      excused_days INT DEFAULT 0,
      attendance_percentage DECIMAL(5,2),
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      INDEX idx_student_id (student_id),
      INDEX idx_class_id (class_id),
      INDEX idx_month_year (month, year),
      INDEX idx_attendance_percentage (attendance_percentage),
      UNIQUE KEY unique_student_month_year (student_id, month, year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Timetables table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS timetables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      class_id INT NOT NULL,
      academic_year_id INT NOT NULL,
      effective_from DATE NOT NULL,
      effective_to DATE,
      is_active BOOLEAN DEFAULT TRUE,
      status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_name (name),
      INDEX idx_class_id (class_id),
      INDEX idx_academic_year_id (academic_year_id),
      INDEX idx_effective_dates (effective_from, effective_to),
      INDEX idx_is_active (is_active),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Timetable periods table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS timetable_periods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      timetable_id INT NOT NULL,
      day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
      period_number INT NOT NULL,
      subject_id INT,
      teacher_id INT,
      room_number VARCHAR(20),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      period_type ENUM('regular', 'break', 'lunch', 'assembly', 'sports', 'library') DEFAULT 'regular',
      is_active BOOLEAN DEFAULT TRUE,
      
      FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
      INDEX idx_timetable_id (timetable_id),
      INDEX idx_day_of_week (day_of_week),
      INDEX idx_period_number (period_number),
      INDEX idx_subject_id (subject_id),
      INDEX idx_teacher_id (teacher_id),
      INDEX idx_time_range (start_time, end_time),
      INDEX idx_period_type (period_type),
      INDEX idx_is_active (is_active),
      UNIQUE KEY unique_timetable_day_period (timetable_id, day_of_week, period_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Teacher schedules table (for individual teacher timetables)
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS teacher_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teacher_id INT NOT NULL,
      class_id INT NOT NULL,
      subject_id INT NOT NULL,
      day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
      period_number INT NOT NULL,
      room_number VARCHAR(20),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      academic_year_id INT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
      INDEX idx_teacher_id (teacher_id),
      INDEX idx_class_id (class_id),
      INDEX idx_subject_id (subject_id),
      INDEX idx_day_of_week (day_of_week),
      INDEX idx_period_number (period_number),
      INDEX idx_time_range (start_time, end_time),
      INDEX idx_is_active (is_active),
      UNIQUE KEY unique_teacher_day_period (teacher_id, day_of_week, period_number, academic_year_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Lesson notes table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS lesson_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      title VARCHAR(200) NOT NULL,
      subject_id INT NOT NULL,
      class_id INT NOT NULL,
      teacher_id INT NOT NULL,
      topic VARCHAR(200),
      objectives TEXT,
      content TEXT,
      activities TEXT,
      resources TEXT,
      homework TEXT,
      assessment_method TEXT,
      duration INT, -- in minutes
      lesson_date DATE,
      status ENUM('draft', 'planned', 'in_progress', 'completed', 'reviewed') DEFAULT 'draft',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_title (title),
      INDEX idx_subject_id (subject_id),
      INDEX idx_class_id (class_id),
      INDEX idx_teacher_id (teacher_id),
      INDEX idx_lesson_date (lesson_date),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Lesson note attachments table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS lesson_note_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lesson_note_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_type VARCHAR(50),
      file_size INT,
      uploaded_by INT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (lesson_note_id) REFERENCES lesson_notes(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_lesson_note_id (lesson_note_id),
      INDEX idx_file_type (file_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  logger.info('Attendance and timetable tables created successfully');
};

const down = async () => {
  logger.info('Dropping attendance and timetable tables...');
  
  await executeQuery('DROP TABLE IF EXISTS lesson_note_attachments');
  await executeQuery('DROP TABLE IF EXISTS lesson_notes');
  await executeQuery('DROP TABLE IF EXISTS teacher_schedules');
  await executeQuery('DROP TABLE IF EXISTS timetable_periods');
  await executeQuery('DROP TABLE IF EXISTS timetables');
  await executeQuery('DROP TABLE IF EXISTS attendance_summary');
  await executeQuery('DROP TABLE IF EXISTS attendance');
  
  logger.info('Attendance and timetable tables dropped');
};

module.exports = { up, down };
